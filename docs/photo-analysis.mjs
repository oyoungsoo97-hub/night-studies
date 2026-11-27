// Detection views preserve their inverse transform so every result refers to the original photograph.
const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
const full={x:0,y:0,width:1,height:1};
const direct={toPhoto:p=>p,fromPhoto:p=>p,worldToPhoto:p=>p};
const waitFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
function check(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
function box(x,y,w,h){
  const left=clamp(x),top=clamp(y);
  return {x:left,y:top,width:Math.max(.0001,clamp(x+w)-left),height:Math.max(.0001,clamp(y+h)-top)};
}
function validRegion(r){
  if(!r)return full;
  if(![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0)throw RangeError('Invalid image region');
  return box(r.x,r.y,r.width,r.height);
}
function bounds(points){
  let x=1,y=1,r=0,b=0;
  for(const p of points){x=Math.min(x,p.x);y=Math.min(y,p.y);r=Math.max(r,p.x);b=Math.max(b,p.y);}
  return {x,y,width:r-x,height:b-y};
}
function view(image,rect,rotation=0,enhance=false){
  if(rect===full&&!rotation&&!enhance)return {image,...direct};
  const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
  const sw=rect.width*w,sh=rect.height*h,side=640;
  const c=Math.cos(rotation),s=Math.sin(rotation);
  const scale=side*.94/Math.max(Math.abs(sw*c)+Math.abs(sh*s),Math.abs(sh*c)+Math.abs(sw*s));
  const cx=(rect.x+rect.width/2)*w,cy=(rect.y+rect.height/2)*h;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=side;
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.fillStyle='#777';ctx.fillRect(0,0,side,side);ctx.translate(side/2,side/2);ctx.rotate(rotation);ctx.scale(scale,scale);
  if(enhance)ctx.filter='contrast(1.35) brightness(1.14)';ctx.drawImage(image,rect.x*w,rect.y*h,sw,sh,-sw/2,-sh/2,sw,sh);
  return {image:canvas,
    worldToPhoto(p){return {...p,x:c*p.x+s*p.y,y:-s*p.x+c*p.y};},
    toPhoto(p){const dx=(p.x-.5)*side/scale,dy=(p.y-.5)*side/scale;return {...p,x:(cx+c*dx+s*dy)/w,y:(cy-s*dx+c*dy)/h,z:(p.z||0)*side/(scale*w)};},
    fromPhoto(p){const dx=p.x*w-cx,dy=p.y*h-cy;return {x:.5+(c*dx-s*dy)*scale/side,y:.5+(s*dx+c*dy)*scale/side};}
  };
}
function windows(r,w,h){
  const rw=r.width*w,rh=r.height*h;
  const edge=Math.max(Math.min(rw,rh)*.64,Math.max(rw,rh)/4);
  const nw=Math.min(rw,edge)/w,nh=Math.min(rh,edge)/h;
  const nx=Math.min(5,Math.ceil((r.width-nw)/(nw*.83))+1),ny=Math.min(5,Math.ceil((r.height-nh)/(nh*.83))+1);
  const out=[];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)out.push({x:r.x+(r.width-nw)*i/Math.max(1,nx-1),y:r.y+(r.height-nh)*j/Math.max(1,ny-1),width:nw,height:nh});
  return out;
}
function tooClose(a,b,aspect){
  const size=p=>Math.max(.001,Math.hypot(p[33].x-p[263].x,(p[33].y-p[263].y)*aspect));
  return Math.hypot(a[1].x-b[1].x,(a[1].y-b[1].y)*aspect)<Math.max(size(a),size(b))*.63;
}
function bodyWindow(face,frame,w,h){
  if(!face)return frame;const f=bounds(face.landmarks),cx=f.x+f.width/2;
  const wide=Math.max(f.width*5,(f.height*h/w)*2.6);
  return box(cx-wide/2,f.y-f.height*.64,wide,f.height*8);
}
function inside(p,r){return p.x>=r.x && p.y>=r.y && p.x<=r.x+r.width && p.y<=r.y+r.height;}
function readMask(mask){
  if(!mask.hasWebGLTexture()||mask.hasFloat32Array()){
    return {pixels:mask.getAsFloat32Array(),channels:1,width:mask.width,height:mask.height,scale:1};
  }
  // Read a small normalized RGBA8 copy. The supported read format of half-float mask
  // textures varies across GPUs, while RGBA / UNSIGNED_BYTE is portable in WebGL 2.
  const gl=mask.canvas.getContext('webgl2'),width=Math.min(256,mask.width),height=Math.min(256,mask.height);
  const read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),draw=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
  const buffer=gl.getParameter(gl.RENDERBUFFER_BINDING),src=gl.createFramebuffer(),dst=gl.createFramebuffer(),rb=gl.createRenderbuffer();
  try{
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,src);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,mask.getAsWebGLTexture(),0);
    gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA8,width,height);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,dst);gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,rb);
    if(gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE||gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)return null;
    gl.blitFramebuffer(0,0,mask.width,mask.height,0,0,width,height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,dst);
    const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return {pixels,channels:4,width,height,scale:1/255};
  }finally{
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,draw);gl.bindRenderbuffer(gl.RENDERBUFFER,buffer);
    gl.deleteFramebuffer(src);gl.deleteFramebuffer(dst);gl.deleteRenderbuffer(rb);
  }
}
function maskFor(mask,transform,aspect){
  if(!mask)return null;
  const width=Math.round(184/Math.max(1,aspect)),height=Math.round(width*aspect),data=new Uint8Array(width*height);
  const read=readMask(mask);if(!read)return null;
  const {pixels,channels,width:mw,height:mh}=read;let present=false;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const q=transform.fromPhoto({x:(x+.5)/width,y:(y+.5)/height});
    if(q.x>=0&&q.x<1&&q.y>=0&&q.y<1){
      const confidence=pixels[(Math.floor(q.y*mh)*mw+Math.floor(q.x*mw))*channels]*read.scale;
      data[y*width+x]=Math.round(255*clamp(confidence));if(confidence>.35)present=true;
    }
  }
  return present?{width,height,data}:null;
}
function detectPose(task,input,face,roi,aspect){
  let pose=null;
  // MediaPipe owns the mask texture for the duration of this synchronous callback.
  task.detect(input.image,result=>{
    const wanted=face?.landmarks[1]||{x:roi.x+roi.width/2,y:roi.y+roi.height/2};
    const candidates=(result.landmarks||[]).map((l,i)=>{const pts=l.map(input.toPhoto),head=pts[0];return {i,pts,d:Math.hypot(head.x-wanted.x,(head.y-wanted.y)*aspect)};}).sort((a,b)=>a.d-b.d);
    if(!candidates.length)return;
    const {i,pts,d}=candidates[0];
    if(face && d>Math.max(.032,bounds(face.landmarks).width*.76))return;
    if(!face && roi!==full && !inside(pts[0],roi))return;
    let mask=null;
    try{mask=maskFor(result.segmentationMasks?.[i],input,aspect);}catch{/* Some GPU backends cannot read back the matte. */}
    pose={landmarks:pts,mask};
  });
  return pose;
}
export async function analysePortrait(image,createTask,{signal,region,point,pose:wantPose=true}={}){
  const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,aspect=h/w;
  const roi=validRegion(region),primary=view(image,roi);
  let faceTask,poseTask,handTask,pose=null;
  const faces=[],seenHands=[];
  function scanFaces(input){
    const result=faceTask.detect(input.image);
    (result.faceLandmarks||[]).forEach((points,i)=>{
      const l=points.map(input.toPhoto);
      if(!inside(l[1],roi)||faces.some(f=>tooClose(f.landmarks,l,aspect)))return;
      faces.push({landmarks:l,blendshapes:Object.fromEntries((result.faceBlendshapes?.[i]?.categories||[]).map(c=>[c.categoryName,c.score]))});
    });
  }
  function scanHands(input){
    const result=handTask.detect(input.image);
    (result.landmarks||[]).forEach((points,i)=>{
      const l=points.map(input.toPhoto),anchor=l[9];
      if(!inside(anchor,full))return;
      const span=Math.hypot(l[5].x-l[17].x,(l[5].y-l[17].y)*aspect);
      if(seenHands.some(hand=>Math.hypot(anchor.x-hand.landmarks[9].x,(anchor.y-hand.landmarks[9].y)*aspect)<Math.max(.009,span*.74)))return;
      seenHands.push({landmarks:l,worldLandmarks:result.worldLandmarks?.[i]?.map(input.worldToPhoto),handedness:result.handedness?.[i]?.[0]?.categoryName||''});
    });
  }
  try{
    check(signal);faceTask=await createTask('face','IMAGE',signal);scanFaces(primary);
    const initial=faces.length?bounds(faces[0].landmarks):null;
    if(!initial || !region&&(w/h>1.35 || w/h<.68 || initial.width<.50 || faces.length>1)){
      for(const tile of windows(roi,w,h)){await waitFrame();check(signal);scanFaces(view(image,tile));}
    }
    if(!faces.length){
      for(const angle of [0,.52,-.52,Math.PI/2,-Math.PI/2,Math.PI]){
        await waitFrame();check(signal);scanFaces(view(image,roi,angle,true));if(faces.length)break;
      }
    }
    const rank=f=>{const b=bounds(f.landmarks),p=f.landmarks[1];return b.width*b.height/(1+.5*Math.hypot((p.x-roi.x)/roi.width-.5,(p.y-roi.y)/roi.height-.46));};
    faces.sort((a,b)=>rank(b)-rank(a));
    const distanceToPoint=f=>Math.hypot(f.landmarks[1].x-point.x,(f.landmarks[1].y-point.y)*aspect);
    const face=(point&&Number.isFinite(point.x+point.y)?[...faces].sort((a,b)=>distanceToPoint(a)-distanceToPoint(b))[0]:faces[0])||null;
    const bodyBox=bodyWindow(face,roi,w,h);
    faceTask.close();faceTask=null;await waitFrame();check(signal);
    if(wantPose){
      try{
        poseTask=await createTask('pose','IMAGE',signal);
        pose=detectPose(poseTask,view(image,region||faces.length>1?bodyBox:{...full}),face,roi,aspect);
        if(!pose && face)pose=detectPose(poseTask,view(image,bodyBox,0,true),face,roi,aspect);
      }catch(error){if(signal?.aborted)throw error;}
      finally{poseTask?.close();poseTask=null;}
    }
    check(signal);handTask=await createTask('hands','IMAGE',signal);
    scanHands(view(image,region||faces.length>1?bodyBox:full));
    if(seenHands.length<2 && pose){
      for(const [wrist,elbow] of [[15,13],[16,14]]){
        const p=pose.landmarks[wrist],q=pose.landmarks[elbow];
        if((p.visibility??1)<.36 || !inside(p,full))continue;
        const radius=clamp(Math.hypot(p.x-q.x,(p.y-q.y)*aspect)*.86,.065,.28);
        const cx=p.x+(p.x-q.x)*.22,cy=p.y+(p.y-q.y)*.22;
        await waitFrame();check(signal);scanHands(view(image,box(cx-radius,cy-radius/aspect,2*radius,2*radius/aspect)));
      }
    }
    if(seenHands.length<2 && (region||!seenHands.length) && face){
      for(const tile of windows(bodyBox,w,h)){await waitFrame();check(signal);scanHands(view(image,tile));if(seenHands.length>=2)break;}
    }
    let hands=seenHands;
    if(pose){
      const wrists=[pose.landmarks[15],pose.landmarks[16]].filter(p=>(p.visibility??1)>.30 && inside(p,full));
      if(wrists.length){
        const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*aspect);
        const shoulders=distance(pose.landmarks[11],pose.landmarks[12]);
        const matched=new Set();
        for(const wrist of wrists){
          const hand=hands.filter(h=>!matched.has(h)).sort((a,b)=>distance(a.landmarks[0],wrist)-distance(b.landmarks[0],wrist))[0];
          if(hand && distance(hand.landmarks[0],wrist)<Math.max(.045,shoulders*.67))matched.add(hand);
        }
        if(region||faces.length>1)hands=[...matched];else hands=[...matched,...hands.filter(hand=>!matched.has(hand))];
      }
    }else if(faces.length>1 && face){
      hands=hands.filter(h=>faces.every(other=>other===face || Math.hypot(h.landmarks[9].x-face.landmarks[1].x,(h.landmarks[9].y-face.landmarks[1].y)*aspect)<=Math.hypot(h.landmarks[9].x-other.landmarks[1].x,(h.landmarks[9].y-other.landmarks[1].y)*aspect)));
    }
    return {face,faces,hands:hands.slice(0,2),pose};
  }finally{faceTask?.close();poseTask?.close();handTask?.close();}
}

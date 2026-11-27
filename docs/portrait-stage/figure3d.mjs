// Photo-space x and y are measured in image widths. The camera looks down -z.
const limit=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const point=(x,y,z=0)=>({x,y,z});
const between=(a,b,t)=>point(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(a.z,b.z,t));
const length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const smooth=(a,b,x)=>{const t=limit((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const mixColor=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const neutralCloth=[.32,.30,.29];
const neutralSkin=[.64,.47,.37];

function profile(stops,t){
  let i=1;while(i<stops.length-1&&t>stops[i][0])i++;
  const [a,x]=stops[i-1],[b,y]=stops[i];return lerp(x,y,smooth(a,b,t));
}
function frameAt(a,b,fallback) {
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,h=Math.hypot(dx,dy),d=Math.hypot(h,dz);
  if(h<.00005||d<.00005)return fallback||{x:1,y:0,fx:0,fy:0,fz:1};
  return {x:dy/h,y:-dx/h,fx:-dx/h*dz/d,fy:-dy/h*dz/d,fz:h/d};
}
function inPhoto(p,aspect,extra=0){return p.x>=-extra&&p.x<=1+extra&&p.y>=-extra&&p.y<=aspect+extra;}
// Clip the path, not the final vertex coordinates. A cropped elbow or hem ends in a real cap.
function interval(a,b,aspect){
  let lo=0,hi=1;
  for(const [v,delta,max] of [[a.x,b.x-a.x,1],[a.y,b.y-a.y,aspect]]){
    if(Math.abs(delta)<1e-8){if(v<0||v>max)return null;continue;}
    const c=-v/delta,d=(max-v)/delta;lo=Math.max(lo,Math.min(c,d));hi=Math.min(hi,Math.max(c,d));
  }
  return hi-lo>.0001?[lo,hi]:null;
}
function coverage(mask,aspect,x,y) {
  if(!mask?.data)return 1;
  if(x<0||x>1||y<0||y>aspect)return 0;
  const fx=x*(mask.width-1),fy=y/aspect*(mask.height-1),ix=Math.floor(fx),iy=Math.floor(fy),dx=fx-ix,dy=fy-iy;
  const row=iy*mask.width,below=Math.min(mask.height-1,iy+1)*mask.width,j=Math.min(mask.width-1,ix+1),data=mask.data;
  return lerp(lerp(data[row+ix],data[row+j],dx),lerp(data[below+ix],data[below+j],dx),dy)/255;
}
function estimateBound(x,y,axis,sign,guess,mask,aspect,fit){
  if(!fit||!mask||coverage(mask,aspect,x,y)<.42)return guess;
  // Stop on the first silhouette crossing. A neighbouring sleeve must not inflate the rib cage.
  const max=guess*1.36,steps=16;
  for(let i=1;i<=steps;i++){
    const r=max*i/steps,px=x+axis.x*r*sign,py=y+axis.y*r*sign;
    if(coverage(mask,aspect,px,py)<.43){
      const found=Math.max(guess*.24,r-max/steps*.48);
      return lerp(guess,found,fit);
    }
  }
  return lerp(guess,guess*1.15,fit);
}
function palette(sample,mask,aspect,center,axis,width,fallback){
  if(!sample)return fallback;
  const colors=[];
  for(const s of [-.38,-.19,0,.19,.38]){
    const x=center.x+axis.x*width*s,y=center.y+axis.y*width*s;
    if(!inPhoto({x,y},aspect)||coverage(mask,aspect,x,y)<.42)continue;
    const rgb=sample(x,y/aspect);if(rgb?.length===3&&Number.isFinite(rgb[0]+rgb[1]+rgb[2]))colors.push(rgb);
  }
  if(!colors.length)return fallback;
  return fallback.map((_,i)=>{const c=colors.map(v=>v[i]).sort((a,b)=>a-b);return c[c.length>>1];});
}
const torsoWidth=[[0,.255],[.028,.345],[.068,.69],[.115,.96],[.185,1.035],[.29,.98],[.46,.90],[.62,.82],[.78,.84],[.915,.90],[1,.86]];
const torsoDepth=[[0,.12],[.07,.24],[.22,.38],[.4,.415],[.64,.35],[.84,.375],[1,.33]];
const armWidth=[[0,.14],[.045,.68],[.12,1.02],[.24,1],[.41,.82],[.515,.68],[.57,.71],[.64,.76],[.79,.64],[.94,.44],[1,.43]];
const legWidth=[[0,.84],[.06,1.0],[.19,1],[.36,.85],[.5,.64],[.57,.67],[.68,.71],[.83,.53],[.98,.34],[1,.32]];
const fingerWidth=[[0,.90],[.12,1],[.34,.94],[.46,.97],[.57,.83],[.72,.86],[.87,.81],[.92,.79]];
function fingertip(t){
  if(t<=.92)return profile(fingerWidth,t);
  return .79*Math.sqrt(Math.max(.001,1-((t-.92)/.08)**2));
}
function padSilhouette(ctx,pw,ph,mask){
  if(!mask?.data||mask.width<5||mask.height<5)return;
  const mw=mask.width,mh=mask.height,n=mw*mh,rgba=ctx.getImageData(0,0,pw,ph),src=rgba.data.slice();
  const representative=new Int32Array(n);
  for(let y=0;y<mh;y++)for(let x=0;x<mw;x++)representative[y*mw+x]=4*(Math.min(ph-1,Math.floor((y+.5)*ph/mh))*pw+Math.min(pw-1,Math.floor((x+.5)*pw/mw)));
  function nearest(interior){
    const map=new Int32Array(n).fill(-1),queue=new Int32Array(n);let start=0,end=0;
    for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){
      const i=y*mw+x;let safe=true;
      for(const [dx,dy] of [[0,0],[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,1]]){
        const v=mask.data[limit(y+dy,0,mh-1)*mw+limit(x+dx,0,mw-1)];if(interior?v<222:v>29){safe=false;break;}
      }
      if(safe){map[i]=i;queue[end++]=i;}
    }
    while(start<end){
      const i=queue[start++],x=i%mw;
      for(const j of [x?i-1:-1,x+1<mw?i+1:-1,i-mw,i+mw]){
        if(j<0||j>=n||map[j]!==-1)continue;map[j]=map[i];queue[end++]=j;
      }
    }
    return map;
  }
  const fg=nearest(true),bg=nearest(false);if(fg[0]<0||bg[0]<0)return;
  for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){
    const mx=Math.min(mw-1,Math.floor(x*mw/pw)),my=Math.min(mh-1,Math.floor(y*mh/ph)),i=my*mw+mx;
    if(fg[i]===i)continue;
    const f=representative[fg[i]],b=representative[bg[i]],j=4*(y*pw+x),maskWeight=mask.data[i]/255;
    const foreground=Math.hypot(src[j]-src[f],src[j+1]-src[f+1],src[j+2]-src[f+2]);
    const background=Math.hypot(src[j]-src[b],src[j+1]-src[b+1],src[j+2]-src[b+2]);
    const containsBackground=smooth(14,72,foreground-background)*(1-smooth(48,112,background));
    const keep=smooth(.24,.84,maskWeight)*(1-containsBackground);
    for(let k=0;k<3;k++)rgba.data[j+k]=lerp(src[f+k],src[j+k],keep);
  }
  ctx.putImageData(rgba,0,0);
}
function sampleAtlas(photo,aspect,patches,sample,mask,crossed){
  if(!photo||!sample||typeof document==='undefined')return null;
  const w=photo.naturalWidth||photo.width,h=photo.naturalHeight||photo.height;
  if(!w||!h)return null;
  const scale=Math.min(1,1280/Math.max(w,h)),pw=Math.max(2,Math.round(w*scale)),ph=Math.max(2,Math.round(h*scale));
  const size=256,clothOffset=crossed.length?pw:0,swatchX=pw+clothOffset+3;
  const canvas=document.createElement('canvas');canvas.width=swatchX+size+1;canvas.height=Math.max(2*size+4,ph);
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return null;ctx.drawImage(photo,0,0,pw,ph);padSilhouette(ctx,pw,ph,mask);
  if(crossed.length){
    // A second projection reconstructs the sleeve behind crossed fingers. Keep the true hand photograph on the first plate.
    const cloth=ctx.getImageData(0,0,pw,ph),original=cloth.data.slice();
    for(const {hand,seed,width} of crossed){
      const points=hand.map(q=>({x:q.x*pw,y:q.y*ph}));
      const mark=document.createElement('canvas');mark.width=pw;mark.height=ph;
      const m=mark.getContext('2d'),radius=Math.max(2,width*pw*.17);
      m.strokeStyle=m.fillStyle='#fff';m.lineCap=m.lineJoin='round';
      m.beginPath();
      for(const [n,id] of [0,1,2,5,9,13,17].entries())m[n?'lineTo':'moveTo'](points[id].x,points[id].y);
      m.closePath();m.fill();m.lineWidth=2*radius;m.stroke();
      for(let f=0;f<5;f++){
        m.lineWidth=radius*[1.85,1.85,1.85,1.65,1.50][f];m.beginPath();
        for(let j=0;j<4;j++){const p=points[1+4*f+j];m[j?'lineTo':'moveTo'](p.x,p.y);}
        m.stroke();
      }
      const minX=limit(Math.floor(Math.min(...points.map(q=>q.x))-radius*2),0,pw-1),maxX=limit(Math.ceil(Math.max(...points.map(q=>q.x))+radius*2),0,pw-1);
      const minY=limit(Math.floor(Math.min(...points.map(q=>q.y))-radius*2),0,ph-1),maxY=limit(Math.ceil(Math.max(...points.map(q=>q.y))+radius*2),0,ph-1);
      const regionWidth=maxX-minX+1,regionHeight=maxY-minY+1,opacity=m.getImageData(minX,minY,regionWidth,regionHeight).data;
      const grainWidth=Math.max(3,width*pw*.54);
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const alpha=opacity[4*((y-minY)*regionWidth+x-minX)+3]/255;if(!alpha)continue;
        const sx=limit(Math.round(seed.x*pw+grainWidth*((x-minX)/regionWidth-.5)),0,pw-1),sy=limit(Math.round(seed.y/aspect*ph+grainWidth*((y-minY)/regionHeight-.5)),0,ph-1);
        const from=4*(sy*pw+sx),to=4*(y*pw+x);for(let k=0;k<3;k++)cloth.data[to+k]=lerp(cloth.data[to+k],original[from+k],alpha);
      }
    }
    ctx.putImageData(cloth,clothOffset,0);
  }
  patches.forEach(({p,r,tint},i)=>{
    // Extract the small-scale fabric grain, leaving directional shadows and the original front print behind.
    const source=document.createElement('canvas');source.width=source.height=64;
    const sc=source.getContext('2d',{willReadFrequently:true});
    const extent=Math.max(4,Math.min(Math.min(w,h)*.19,w*r));
    sc.drawImage(photo,limit(p.x*w-extent/2,0,Math.max(0,w-extent)),limit(p.y*w-extent/2,0,Math.max(0,h-extent)),extent,extent,0,0,64,64);
    const data=sc.getImageData(0,0,64,64).data,lum=new Float32Array(4096);
    for(let j=0;j<lum.length;j++)lum[j]=(data[j*4]*.22+data[j*4+1]*.69+data[j*4+2]*.09)/255;
    const grain=new Float32Array(4096);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      let mean=0,n=0;for(let yy=Math.max(0,y-4);yy<=Math.min(63,y+4);yy+=2)for(let xx=Math.max(0,x-4);xx<=Math.min(63,x+4);xx+=2){mean+=lum[yy*64+xx];n++;}
      grain[y*64+x]=limit((lum[y*64+x]-mean/n)/Math.max(.10,mean/n),-.30,.30);
    }
    const patch=ctx.createImageData(size,size),mirror=n=>n%128<64?n%128:127-n%128;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const idx=(y*size+x)*4,detail=grain[mirror(y)*64+mirror(x)],fine=grain[mirror(2*y+17)*64+mirror(2*x+37)];
      for(let j=0;j<3;j++)patch.data[idx+j]=Math.round(255*limit(tint[j]*(1+(detail*.60+fine*.18)*smooth(8,34,extent)),0,1));patch.data[idx+3]=255;
    }
    ctx.putImageData(patch,swatchX,i*(size+2));
  });
  return {canvas,front:(x,y,cloth=false)=>[(limit(x,.5/pw,1-.5/pw)*pw+(cloth?clothOffset:0))/canvas.width,limit(y/aspect,.5/ph,1-.5/ph)*ph/canvas.height],
    rear:(k,u,v)=>[(swatchX+1+limit(u,0,1)*(size-3))/canvas.width,(k*(size+2)+1+limit(v,0,1)*(size-3))/canvas.height]};
}

export function buildFigure3D({photo,aspect,face,hands=[],pose,mask=pose?.mask,sample}={}){
  if(!(aspect>0&&Number.isFinite(aspect)))return null;
  const facePoints=face?.landmarks||[],joints=pose?.landmarks||[],rawHands=hands.map(h=>h?.landmarks||h||[]);
  const faceAt=i=>valid(facePoints[i])?point(facePoints[i].x,facePoints[i].y*aspect):null;
  let chin=faceAt(152);const leftCheek=faceAt(234),rightCheek=faceAt(454);
  const faceWidth=leftCheek&&rightCheek?length(leftCheek,rightCheek):0;
  const sideConfidence=(id,threshold=.33)=>valid(joints[id])&&(joints[id].visibility??1)>threshold;
  const shoulders=sideConfidence(11)&&sideConfidence(12);
  const insideHand=rawHands.some(h=>h.length===21&&h.every(valid));
  if(!shoulders&&(!chin||!faceWidth)&&!insideHand)return null;
  const body=joints.map(p=>valid(p)?point(p.x,p.y*aspect):null);
  const span=shoulders?limit(Math.max(length(body[11],body[12]),faceWidth*1.64),.018,1.32):limit(faceWidth*2.18,.045,1.26);
  if(!chin&&shoulders&&sideConfidence(7,.32)&&sideConfidence(8,.32)){
    const ears=between(body[7],body[8],.5),s=between(body[11],body[12],.5);
    chin=between(ears,s,.27);
  }
  const shoulderZ=shoulders?((joints[11].z||0)+(joints[12].z||0))*.5:0;
  for(let i=0;i<body.length;i++)if(body[i])body[i].z=-span*.155+limit((shoulderZ-(joints[i].z||0))*.39,-span*.34,span*.52);
  const rest=[],now=[],drivers=[],sweeps=[],positions=[],uv=[],colors=[],weights=[],indices=[];
  const add=(p,fn)=>{const id=rest.length;rest.push(p);now.push({...p});drivers.push(fn);return id;};
  const fixed=p=>add(p,null);
  const bodyIndex=body.map((p,i)=>p?add(p,(frame,out)=>{
    const q=frame.body?.[i];if(valid(q)){out.x+=q.x-joints[i].x;out.y+=(q.y-joints[i].y)*aspect;if(Number.isFinite(q.dz))out.z+=limit(q.dz,-2*span,2*span);}
  }):-1);
  // References are evaluated in creation order; compound anchors inherit the joints' actual motion.
  function blendIndex(a,b,t){
    return add(between(rest[a],rest[b],t),(_,out)=>{const p=now[a],q=now[b];out.x=lerp(p.x,q.x,t);out.y=lerp(p.y,q.y,t);out.z=lerp(p.z,q.z,t);});
  }
  function attach(p,a,b){
    const start=rest[a],axis=frameAt(start,rest[b]),side=(p.x-start.x)*axis.x+(p.y-start.y)*axis.y;
    const along=(p.x-start.x)*(-axis.y)+(p.y-start.y)*axis.x,dz=p.z-start.z;
    return add(p,(_,out)=>{const aa=now[a],ab=frameAt(aa,now[b],axis);out.x=aa.x+ab.x*side-ab.y*along;out.y=aa.y+ab.y*side+ab.x*along;out.z=aa.z+dz;});
  }
  let atlas=null;
  function roundedJoints(ids,radius){
    if(ids.length<3)return ids;
    const path=[ids[0]];
    for(let i=1;i<ids.length-1;i++){
      const a=ids[i-1],b=ids[i],c=ids[i+1],ab=length(rest[a],rest[b]),bc=length(rest[b],rest[c]);
      if(ab<.001||bc<.001){path.push(b);continue;}
      const left=blendIndex(b,a,Math.min(.36,radius/ab)),right=blendIndex(b,c,Math.min(.36,radius/bc));
      path.push(left);
      for(const t of [.25,.5,.75])path.push(blendIndex(blendIndex(left,b,t),blendIndex(b,right,t),t));
      path.push(right);
    }
    path.push(ids.at(-1));return path;
  }
  function addVertex(p,c,w,tex=atlas?.front(p.x,p.y)){
    const id=positions.length/3;
    positions.push(p.x,p.y,p.z);uv.push(...(tex||[limit(p.x,0,1),limit(p.y/aspect,0,1)]));colors.push(...c);weights.push(w);
    return id;
  }
  const handsInFront=[];
  for(const raw of rawHands){
    if(raw?.length!==21||!raw.every(valid))continue;
    const p=raw.map(v=>point(v.x,v.y*aspect)),width=length(p[5],p[17]);
    if(width<.003)continue;
    function segment(a,b,r){
      const dx=b.x-a.x,dy=b.y-a.y;handsInFront.push({a,dx,dy,d:Math.max(.000001,dx*dx+dy*dy),r});
    }
    const middle=between(p[5],p[17],.5);
    segment(between(p[0],middle,.26),between(p[0],middle,.87),width*.46);
    for(let f=0;f<5;f++)for(let j=0;j<3;j++){const i=1+4*f+j;segment(p[i],p[i+1],width*[.142,.127,.125,.112,.09][f]);}
  }
  function visibleFabric(p){
    let keep=1;
    for(const h of handsInFront){
      const k=limit(((p.x-h.a.x)*h.dx+(p.y-h.a.y)*h.dy)/h.d,0,1),d=Math.hypot(p.x-h.a.x-h.dx*k,p.y-h.a.y-h.dy*k);
      keep=Math.min(keep,smooth(h.r*.73,h.r*1.18,d));if(!keep)return 0;
    }
    return keep;
  }
  // Sweep centreline samples around anatomical cross-sections. Each mesh is independently closed.
  // Rigid cross-sections turn with their live tangent, including finger knuckles, instead of stretching a sheet.
  function tube(ids,shape,{segments=20,sides=24,fit=.65,color=neutralCloth,texture=1,material=1,interior=null,surface="limb",tilt=null}={}){
    if(ids.length<2)return;
    const lengths=[0];for(let i=1;i<ids.length;i++)lengths.push(lengths.at(-1)+length(rest[ids[i-1]],rest[ids[i]]));
    const total=lengths.at(-1);if(total<.0015)return;
    const pieces=[];let rings=null;
    for(let i=1;i<ids.length;i++){
      const a=ids[i-1],b=ids[i],bounds=interval(rest[a],rest[b],aspect);
      if(!bounds){rings=null;continue;}
      const [lo,hi]=bounds;
      if(!rings||lo>.001){rings=[];pieces.push(rings);}
      const n=Math.max(2,Math.ceil(segments*(lengths[i]-lengths[i-1])/total*(hi-lo)));
      for(let j=rings.length?1:0;j<=n;j++){
        const f=lerp(lo,hi,j/n),t=lerp(lengths[i-1],lengths[i],f)/total;
        rings.push({a,b,f,t,c:between(rest[a],rest[b],f),live:point(0,0),...shape(t)});
      }
      if(hi<.999)rings=null;
    }
    for(const rows of pieces){
      if(rows.length<2)continue;
      for(let j=0;j<rows.length;j++){
        const r=rows[j];r.axis=frameAt(rows[Math.max(0,j-1)].c,rows[Math.min(rows.length-1,j+1)].c);
        r.left=estimateBound(r.c.x,r.c.y,r.axis,-1,r.rx,mask,aspect,fit);
        r.right=estimateBound(r.c.x,r.c.y,r.axis,1,r.rx,mask,aspect,fit);
        r.tint=palette(sample,mask,aspect,r.c,r.axis,r.rx,color);
        r.slope=tilt?tilt(r):0;
        r.fabric=surface==="cloth"||surface==="arm";r.clear=!r.fabric||visibleFabric(r.c)>.92;
      }
      for(const row of rows){
        if(!row.fabric)continue;
        const nearest=rows.filter(r=>r.clear).sort((a,b)=>Math.abs(a.t-row.t)-Math.abs(b.t-row.t))[0];
        row.under=nearest?mixColor(color,nearest.tint,.79):color;
      }
      // Filter mask sampling noise longitudinally without flattening joints or hems.
      const measured=rows.map(r=>[r.left,r.right]);
      const dyed=rows.map((r,i)=>{
        const rgb=[0,0,0];let sum=0;
        for(let j=0;j<rows.length;j++){const distance=Math.abs(r.t-rows[j].t);if(distance>.19)continue;
          const k=Math.exp(-((distance/.095)**2));for(let c=0;c<3;c++)rgb[c]+=rows[j].tint[c]*k;sum+=k;}
        return rgb.map(v=>v/sum);
      });
      rows.forEach((r,i)=>{
        r.rear=surface==='cloth'?mixColor(color,dyed[i],.06):(surface==='skin'||surface==='palm')?mixColor(color,dyed[i],.13):mixColor(dyed[i],r.tint,.08);
      });
      rows.forEach((r,i)=>{if(i===0||i===rows.length-1)return;
        for(const [k,j] of [['left',0],['right',1]])r[k]=.22*measured[i-1][j]+.56*measured[i][j]+.22*measured[i+1][j];
      });
      function emit(r,scale){
        const start=positions.length/3,offset=[];
        for(let k=0;k<sides;k++){
          const theta=Math.PI*2*k/sides,co=Math.cos(theta),sn=Math.sin(theta);
          const lateral=(co<0?r.left:r.right)*co*scale;
          let deep=r.rz*sn*scale;
          if(surface==='palm'&&sn<0){
            const ridge=(.5+.5*Math.cos((co+.12)*Math.PI*4))**2;
            deep*=1+.19*ridge*smooth(.12,.51,r.t)*(1-smooth(.9,1,r.t));
          }
          if(surface==='cloth'&&sn<0){
            const blades=Math.exp(-(((Math.abs(co)-.49)/.32)**2)-(((r.t-.29)/.17)**2));
            const groove=Math.exp(-((co/.15)**2))*(1-smooth(.65,.95,r.t));
            deep*=1+.11*blades-.056*groove;
          }
          const skew=lateral*r.slope;
          const p=point(r.c.x+r.axis.x*lateral+r.axis.fx*deep,r.c.y+r.axis.y*lateral+r.axis.fy*deep,r.c.z+r.axis.fz*deep+skew);
          const cov=coverage(mask,aspect,p.x,p.y);
          let w=inPhoto(p,aspect)?smooth(.05,.60,sn)*smooth(.25,.80,cov)*texture*(interior?interior(p,r):1):0;
          if(scale!==1)w=0;
          if(w>.001&&Math.abs(co)>.71&&sample){
            const rgb=sample(limit(p.x,0,1),limit(p.y/aspect,0,1));
            const distance=Math.hypot(rgb[0]-r.tint[0],rgb[1]-r.tint[1],rgb[2]-r.tint[2]);
            w*=1-smooth(.30,.64,distance)*smooth(.71,.92,Math.abs(co));
          }
          const clear=r.fabric&&sn>.01?visibleFabric(p):1;w*=clear;
          let tex=atlas?.front(p.x,p.y,r.fabric);
          // A zero-weight meridian on both sides separates the source projection from the rear swatch.
          // Its width is one complete polygon, so a triangle never interpolates UVs across atlas regions.
          if(atlas&&sn<-.001){
            const border=Math.sin(2*Math.PI/sides)+.004;
            const skinDist=Math.hypot(...r.rear.map((v,i)=>v-tintSkin[i])),clothDist=Math.hypot(...r.rear.map((v,i)=>v-tintCloth[i]));
            const skin=surface==='skin'||surface==='palm'||surface!=='cloth'&&skinDist<clothDist,matched=skin?skinDist:clothDist;
            w=scale===1?smooth(border,Math.min(.97,border+.31),-sn)*limit(1-matched*3.0,0,.87):0;
            tex=atlas.rear(skin?1:0,(theta-Math.PI)/Math.PI,r.t);
          }
          let tint=mixColor(r.rear,mixColor(color,r.tint,material),smooth(.1,.7,sn));
          if(clear<1)tint=mixColor(r.under,tint,clear);
          if(r.nail&&sn<0){
            const nail= r.nail*smooth(.35,.90,-sn);tint=mixColor(tint,mixColor(color,[.945,.74,.70],.34),nail*.75);w*=1-nail*.78;
          }
          addVertex(p,tint,w,tex);offset.push(lateral,deep,skew);
        }
        if(!r.bands)r.bands=[];r.bands.push({start,offset});return start;
      }
      function zip(a,b,reverse=false){
        for(let k=0;k<sides;k++){const n=(k+1)%sides;if(reverse)indices.push(a+k,a+n,b+k,a+n,b+n,b+k);
          else indices.push(a+k,b+k,a+n,a+n,b+k,b+n);}
      }
      const shell=rows.map(r=>emit(r,1));
      for(let j=1;j<shell.length;j++)zip(shell[j-1],shell[j]);
      for(const first of [true,false]){
        const r=first?rows[0]:rows.at(-1);let outer=first?shell[0]:shell.at(-1);
        for(const scale of [.65,.30]){const next=emit(r,scale);zip(outer,next,first);outer=next;}
        const center=addVertex(r.c,r.tint,0);r.cap=center;
        for(let k=0;k<sides;k++){const next=(k+1)%sides;if(first)indices.push(outer+k,outer+next,center);else indices.push(outer+k,center,outer+next);}
      }
      sweeps.push(rows);
    }
  }
  let shoulder=null,hips=null,headAxis=null,shoulderPair=null,hipPair=null;
  if(shoulders){
    shoulderPair=[bodyIndex[11],bodyIndex[12]];shoulder=blendIndex(...shoulderPair,.5);
  }else if(chin&&faceWidth&&chin.y<aspect+.025){
    const forehead=faceAt(10)||point(chin.x,chin.y-faceWidth),h=Math.max(.01,length(forehead,chin));
    const down=point((chin.x-forehead.x)/h,(chin.y-forehead.y)/h),c=point(chin.x+down.x*faceWidth*.57,chin.y+down.y*faceWidth*.57,-span*.16);
    const right=point(down.y,-down.x);
    shoulderPair=[fixed(point(c.x+right.x*span*.5,c.y+right.y*span*.5,c.z)),fixed(point(c.x-right.x*span*.5,c.y-right.y*span*.5,c.z))];
    shoulder=blendIndex(...shoulderPair,.5);
    headAxis=down;
  }
  const maskAt=(p)=>coverage(mask,aspect,p.x,p.y);
  const observedPalm=rawHands.find(h=>h?.length===21&&valid(h[0])&&valid(h[9]));
  const skinPatch=observedPalm?between(point(observedPalm[0].x,observedPalm[0].y*aspect),point(observedPalm[9].x,observedPalm[9].y*aspect),.67):null;
  const cheek=faceAt(205)||faceAt(1)||skinPatch||(sideConfidence(15,.7)&&inPhoto(body[15],aspect)?body[15]:null);
  const tintSkin=cheek?palette(sample,null,aspect,cheek,{x:1,y:0},Math.max(.008,faceWidth*.115),neutralSkin):neutralSkin;
  const tintCloth=shoulder!=null?palette(sample,mask,aspect,point(rest[shoulder].x,rest[shoulder].y+span*.38),{x:1,y:0},span*.4,neutralCloth):neutralCloth;
  const handSlots=new Map(),usedHands=new Set();
  // Match each detected palm to a shoulder chain, by wrist position rather than a handedness label.
  const candidates=[];
  for(let h=0;h<rawHands.length;h++){
    const hand=rawHands[h];if(hand.length!==21||!hand.every(valid))continue;
    for(const i of [15,16])if(body[i])candidates.push({h,i,d:length(body[i],point(hand[0].x,hand[0].y*aspect))});
  }
  candidates.sort((a,b)=>a.d-b.d);
  for(const {h,i,d} of candidates)if(d<Math.max(.045,span*.68)&&!handSlots.has(i)&&!usedHands.has(h)){handSlots.set(i,h);usedHands.add(h);}

  // Fold a crossed hand onto the opposite upper sleeve when the photographed palm covers it.
  const crossed=new Map();
  for(const [wrist,h] of handSlots){
    const other=wrist===15?12:11,end=other+2;
    if(!sideConfidence(other)||!sideConfidence(end))continue;
    const raw=rawHands[h],mid=between(point(raw[5].x,raw[5].y*aspect),point(raw[17].x,raw[17].y*aspect),.5);
    const a=body[other],b=body[end],dx=b.x-a.x,dy=b.y-a.y,t=limit(((mid.x-a.x)*dx+(mid.y-a.y)*dy)/Math.max(.00001,dx*dx+dy*dy),0,1);
    if(length(mid,between(a,b,t))<span*.26){
      // On folded arms the Pose elbow can land on the cuff of the covering arm. Seat it below the wrists
      // if both upper arms hang down and the other wrist is visibly crossed toward the opposite shoulder.
      const otherWrist=31-wrist,ownElbow=wrist-2,ownShoulder=wrist-4;
      if(sideConfidence(otherWrist,.45)&&sideConfidence(ownElbow,.45)&&sideConfidence(ownShoulder,.65)&&
        (body[otherWrist].x-a.x)*(body[ownShoulder].x-a.x)>span*span*.30&&
        body[ownElbow].y-body[ownShoulder].y>span*.41&&b.y-a.y>span*.41){
        const targetY=(raw[0].y*aspect+body[otherWrist].y)*.5+span*.19;
        for(const e of [end,ownElbow])body[e].y+=limit(targetY-body[e].y,0,span*.21);
      }
      const sleeveDepth=p=>{
        const vx=b.x-a.x,vy=b.y-a.y,t=limit(((p.x-a.x)*vx+(p.y-a.y)*vy)/Math.max(.00001,vx*vx+vy*vy),0,1);
        const center=between(a,b,t),radius=span*.145;
        return center.z+span*.022+radius*.89*Math.sqrt(Math.max(.04,1-(length(p,center)/radius)**2));
      };
      const root=point(raw[0].x,raw[0].y*aspect);
      body[wrist].z=sleeveDepth(root);
      crossed.set(h,{sleeveDepth,hand:raw,seed:between(a,b,.31),width:length(point(raw[5].x,raw[5].y*aspect),point(raw[17].x,raw[17].y*aspect))});
    }
  }
  if(shoulder!=null||cheek){
    const chest=shoulder!=null?point(rest[shoulder].x,Math.min(aspect*.95,rest[shoulder].y+span*.38)):point(.5,aspect*.68);
    let swatch=chest,score=Infinity;
    if(sample)for(const dx of [.27,-.27,.19,-.19]){
      const p=point(chest.x+dx*span,chest.y);if(!inPhoto(p,aspect)||maskAt(p)<.75||visibleFabric(p)<.9)continue;
      const center=sample(p.x,p.y/aspect);
      let difference=Math.hypot(...center.map((v,i)=>v-tintCloth[i]));
      for(const d of [-.05,.05]){const edge=sample(limit(p.x+d*span,0,1),p.y/aspect);difference+=.5*Math.hypot(...edge.map((v,i)=>v-center[i]));}
      if(difference<score){score=difference;swatch=p;}
    }
    atlas=sampleAtlas(photo,aspect,[{p:swatch,r:span*.14,tint:tintCloth},{p:cheek||chest,r:Math.max(.003,(faceWidth||span*.24)*.14),tint:tintSkin}],sample,mask,[...crossed.values()]);
  }
  function bindHand(points,h,wrist,elbow,inferred=false){
    const p=points[0],refW=body[wrist],axis=refW&&body[elbow]?frameAt(body[elbow],refW):null;
    const bindZ=refW?.z??span*.02;
    const palmLength=Math.max(.005,length(points[0],points[9]));
    const template=points.map(q=>({...q,z:bindZ+q.z}));
    return template.map((base,i)=>add(base,(frame,out)=>{
      const hand=(!inferred?frame.targets?.[h]:null) || (inferred?frame.puppets?.[p.x<.5?0:1]:null);
      const bodyDriven=valid(frame.body?.[wrist])&&refW;
      const dx=bodyDriven?now[bodyIndex[wrist]].x-refW.x:0,dy=bodyDriven?now[bodyIndex[wrist]].y-refW.y:0;
      const wristDepth=bodyDriven?now[bodyIndex[wrist]].z-refW.z:0;out.z+=wristDepth;
      if(valid(hand?.[i])&&valid(hand[0])){
        const liveRoot=hand[0];
        const puppetScale=inferred&&valid(hand[9])?limit(palmLength/Math.max(.008,length(liveRoot,hand[9])),.15,4):1;
        const rootX=bodyDriven||inferred?p.x+dx:liveRoot.x,rootY=bodyDriven||inferred?p.y+dy:liveRoot.y;
        out.x=rootX+(hand[i].x-liveRoot.x)*puppetScale;out.y=rootY+(hand[i].y-liveRoot.y)*puppetScale;
        if(i>0){
          const mcp=1+4*Math.floor((i-1)/4),fraction=(i-mcp)/3;
          if(valid(hand[mcp])){
            const bend=length(template[mcp],base)-length(hand[mcp],hand[i])*puppetScale;
            out.z+=Number.isFinite(hand[i].dz)?limit(hand[i].dz,-palmLength,palmLength):limit(bend,-.10*palmLength,.75*palmLength)*fraction;
          }
        }
      }else if(bodyDriven){
        const arm=axis&&now[bodyIndex[elbow]]?frameAt(now[bodyIndex[elbow]],now[bodyIndex[wrist]],axis):null;
        if(arm){
          const cs=arm.x*axis.x+arm.y*axis.y,sn=arm.y*axis.x-arm.x*axis.y,sx=base.x-p.x,sy=base.y-p.y;
          out.x=p.x+dx+cs*sx-sn*sy;out.y=p.y+dy+sn*sx+cs*sy;
        }else{out.x+=dx;out.y+=dy;}
      }
      if(inferred&&!hand&&i>0&&Number.isFinite(frame.pose?.hands)){
        const value=frame.pose.hands,amount=limit(Math.abs(value)>1?value/100:value,-1,1),mcp=1+4*Math.floor((i-1)/4);
        const fraction=(i-mcp)/3,root=template[mcp],curl=Math.min(1,Math.abs(amount))*fraction;
        out.x-=(base.x-root.x)*curl*.62;out.y-=(base.y-root.y)*curl*.62;out.z+=palmLength*amount*fraction*.64;
      }
    }));
  }
  const handRoots=new Map(),palmCenters=new Map();
  function handMesh(source,h,wrist,elbow,inferred=false){
    if(source.length!==21||!source.every(valid)||!inPhoto(source[0],aspect,span*.08))return;
    const ids=bindHand(source,h,wrist,elbow,inferred),w=ids[0],knuckles=blendIndex(ids[5],ids[17],.5),size=length(rest[w],rest[knuckles]);
    if(size<.002)return;
    if(wrist!=null){handRoots.set(wrist,w);palmCenters.set(wrist,knuckles);}
    const spread=limit(length(source[5],source[17]),size*.33,size*1.4);
    const handTint=inferred?tintSkin:palette(sample,mask,aspect,between(source[0],source[9],.55),{x:1,y:0},spread*.27,tintSkin);
    const palmEnd=blendIndex(knuckles,w,-.115),palmStart=bodyIndex[elbow]>=0?blendIndex(w,bodyIndex[elbow],.035):blendIndex(w,knuckles,-.08);
    const baseWidth=spread*.64,active=inferred?null:hands[h]?.active;
    tube([palmStart,w,knuckles,palmEnd],t=>({
      rx:baseWidth*profile([[0,.34],[.13,.64],[.34,.83],[.58,1],[.78,1.02],[.94,.91],[1,.72]],t),
      rz:Math.max(spread*.18,size*.15)*profile([[0,.69],[.26,.94],[.58,1],[.91,.69],[1,.46]],t)
    }),{segments:17,sides:36,fit:inferred?.35:.22,color:handTint,texture:inferred?.38:.98,material:inferred?.24:.85,surface:"palm"});
    for(let f=0;f<5;f++){
      const first=1+4*f;if(active&&!active.includes(first+3))continue;
      const radius=spread*[.159,.143,.144,.131,.108][f],path=ids.slice(first,first+4);
      const dip=path[2],tip=path[3];path.splice(3,0,...[.64,.78,.89,.96].map(t=>blendIndex(dip,tip,t)));
      const root=f===0?blendIndex(w,knuckles,.40):blendIndex(path[0],path[1],-.24);path.unshift(root);
      tube(path,t=>{const r=radius*fingertip(t);return {rx:r,rz:r*.89,nail:smooth(.73,.84,t)*(1-smooth(.94,.992,t))};},
        {segments:20,sides:16,fit:mask?.width>150?.11:0,color:handTint,material:inferred?.18:.69,texture:inferred?.26:.98,surface:"skin"});
    }
  }
  for(let h=0;h<rawHands.length;h++){
    const raw=rawHands[h];if(raw?.length!==21||!raw.every(valid))continue;
    const wrist=[...handSlots].find(([,id])=>id===h)?.[0],len=length(point(raw[0].x,raw[0].y*aspect),point(raw[9].x,raw[9].y*aspect));
    const contact=crossed.get(h),points=raw.map(q=>{const p=point(q.x,q.y*aspect);
      const local=limit(-((q.z||0)-(raw[0].z||0))*.69,-len*.65,len*.78);
      p.z=contact?lerp(local,contact.sleeveDepth(p)-body[wrist].z,.86):local;return p;
    });
    handMesh(points,h,wrist,wrist!=null?wrist-2:null);
  }
  function inferredHand(wrist,elbow,handSide){
    if(handRoots.has(wrist)||!sideConfidence(wrist,.73)||!sideConfidence(elbow,.44)||!inPhoto(body[wrist],aspect))return;
    const p=body[wrist],q=body[elbow],pinky=body[wrist+2],index=body[wrist+4];
    const forearm=length(q,p);if(forearm<span*.15||forearm>span*1.45)return;
    const tip=pinky&&index?between(pinky,index,.5):null;
    if(tip&&(!sideConfidence(wrist+2,.67)||!sideConfidence(wrist+4,.67)))return;
    const useTip=tip&&length(p,tip)>span*.052&&length(p,tip)<span*.60;
    const aim=useTip?tip:point(p.x+(p.x-q.x)*.34,p.y+(p.y-q.y)*.34);
    const l=length(p,aim);if(l<.001)return;
    const len=limit(l*1.05,forearm*.37,forearm*.80);
    const ux=(aim.x-p.x)/l,uy=(aim.y-p.y)/l,vx=-uy,vy=ux;
    const cross=useTip?(pinky.x-index.x)*vx+(pinky.y-index.y)*vy:0;
    const sign=Math.abs(cross)>span*.015?Math.sign(cross):handSide;
    const at=(along,across,z=0)=>point(p.x+(ux*along+vx*across*sign)*len,p.y+(uy*along+vy*across*sign)*len,z*len);
    if(!inPhoto(at(.40,0),aspect)||maskAt(at(.35,0))<.38)return;
    const points=[point(p.x,p.y,0)];
    const bases=[[-.23,.23],[-.175,.50],[-.045,.54],[.09,.50],[.205,.43]],ends=[[-.38,.58],[-.21,.94],[-.03,1],[.115,.91],[.24,.76]];
    for(let f=0;f<5;f++)for(const u of [0,.45,.74,1]){
      points.push(at(lerp(bases[f][1],ends[f][1],u),lerp(bases[f][0],ends[f][0],u),.018*Math.sin(Math.PI*u)+.026*u));
    }
    handMesh(points,-1,wrist,elbow,true);
  }
  if(shoulders){inferredHand(15,13,1);inferredHand(16,14,-1);}
  if(shoulder!=null){
    const center=rest[shoulder];
    let hipUsable=sideConfidence(23,.23)&&sideConfidence(24,.23);
    if(hipUsable){const hip=between(body[23],body[24],.5),d=length(center,hip);hipUsable=d>span*.40&&d<span*2.45;}
    if(hipUsable){hipPair=[bodyIndex[23],bodyIndex[24]];hips=blendIndex(...hipPair,.5);}
    else{
      const direction=headAxis||(chin&&length(chin,center)>span*.035?{x:(center.x-chin.x)/length(chin,center),y:(center.y-chin.y)/length(chin,center)}:point(0,1));
      const down=direction.y<.2?point(0,1):direction;
      hips=attach(point(center.x+down.x*span*1.28,center.y+down.y*span*1.28,center.z-span*.054),...shoulderPair);
    }
    const hip=rest[hips],torsoLength=Math.max(.01,length(center,hip)),top=blendIndex(shoulder,hips,-span*.20/torsoLength),bottom=blendIndex(shoulder,hips,1+span*.12/torsoLength);
    // Front-facing forearms can cross the shirt. Preserve the sleeve on its own volume,
    // using neighbouring fabric for the patch behind it to avoid a second printed arm.
    const occluders=[];
    for(const [a,b] of [[13,15],[14,16]]){
      if(!sideConfidence(a,.4)||!sideConfidence(b,.4))continue;
      const p=body[a],q=body[b],dx=q.x-p.x,dy=q.y-p.y;
      if(length(p,q)>.01)occluders.push({p,dx,dy,r:span*.074,d:dx*dx+dy*dy});
    }
    const photoVisibility=p=>{
      let keep=1;
      for(const o of occluders){const t=limit(((p.x-o.p.x)*o.dx+(p.y-o.p.y)*o.dy)/o.d,0,1);
        const d=Math.hypot(p.x-o.p.x-o.dx*t,p.y-o.p.y-o.dy*t);keep=Math.min(keep,smooth(o.r*.62,o.r*1.18,d));
      }
      return keep;
    };
    const slope=(pair,r)=>{
      if(!pair)return 0;const a=rest[pair[0]],b=rest[pair[1]];
      const width=(b.x-a.x)*r.axis.x+(b.y-a.y)*r.axis.y;
      return Math.abs(width)>span*.18?limit((b.z-a.z)/width,-.72,.72):0;
    };
    tube([top,shoulder,hips,bottom],t=>({rx:span*.51*profile(torsoWidth,t),rz:span*.51*profile(torsoDepth,t)}),
      {segments:36,sides:48,fit:.87,color:tintCloth,material:.88,interior:photoVisibility,surface:"cloth",tilt:r=>lerp(slope(shoulderPair,r),slope(hipPair,r),smooth(.20,.88,r.t))});
    const collar=blendIndex(shoulder,hips,.09);
    if(chin&&chin.y<aspect){
      const n=length(chin,center);
      if(n<span*1.15){
        const upper=attach(point(chin.x+(chin.x-center.x)*.18,chin.y+(chin.y-center.y)*.18,-span*.113),shoulder,hips);
        tube([upper,collar],t=>({rx:span*profile([[0,.096],[.18,.14],[.46,.156],[.73,.189],[1,.286]],t),rz:span*profile([[0,.10],[.43,.12],[.84,.145],[1,.16]],t)}),
          {segments:15,sides:32,fit:.34,color:tintSkin,material:.78,surface:"skin"});
      }
    }
    for(const [s,e,w,knee,ankle,heel,toe] of [[11,13,15,25,27,29,31],[12,14,16,26,28,30,32]]){
      let armPath=null;
      if(shoulders&&sideConfidence(e,.22)&&length(body[s],body[e])<span*1.62){
        const socket=blendIndex(blendIndex(bodyIndex[s],shoulder,.32),hips,.055);
        armPath=[socket,bodyIndex[s],bodyIndex[e]];
        if(handRoots.has(w)){const end=handRoots.get(w);armPath.push(end,blendIndex(end,palmCenters.get(w),.12));}
        else if(sideConfidence(w,.22)&&length(body[e],body[w])<span*1.49)armPath.push(bodyIndex[w]);
      }
      if(armPath){
        const radius=span*.143;
        tube(roundedJoints(armPath,span*.13),t=>{const r=radius*profile(armWidth,armPath.length===3?t*.55:t);return {rx:r,rz:r*.89};},
          {segments:28,sides:28,fit:.87,color:tintCloth,material:.94,surface:"arm"});
      }
      const h=knee-2;
      if(!hipPair||!sideConfidence(knee,.32)||!sideConfidence(h,.30)||length(body[h],body[knee])>span*1.95)continue;
      const leg=[blendIndex(bodyIndex[h],hips,.30),bodyIndex[h],bodyIndex[knee]];
      if(sideConfidence(ankle,.33)&&length(body[knee],body[ankle])<span*1.88)leg.push(bodyIndex[ankle]);
      tube(roundedJoints(leg,span*.14),t=>{const r=span*.232*profile(legWidth,leg.length===3?t*.51:t);return {rx:r,rz:r*1.03};},
        {segments:30,sides:26,fit:.89,color:tintCloth});
      if(leg.length===4&&sideConfidence(toe,.4)&&inPhoto(body[ankle],aspect)&&length(body[ankle],body[toe])<span*.88){
        const back=sideConfidence(heel,.37)?bodyIndex[heel]:bodyIndex[ankle];
        tube([bodyIndex[ankle],blendIndex(back,bodyIndex[toe],.15),bodyIndex[toe]],t=>{const r=span*.105*profile([[0,.66],[.16,.88],[.45,1.02],[.77,.91],[.94,.72],[1,.31]],t);return {rx:r,rz:r*.69};},
          {segments:13,sides:18,fit:.60,color:tintCloth});
      }
    }
  }
  if(!indices.length)return null;
  const base=new Float32Array(positions);
  function poseFrame(frame={},out){
    if(!out)out=new Float32Array(base.length);
    if(!frame.body&&!frame.targets?.some(Boolean)&&!frame.puppets?.some(Boolean)&&!frame.pose?.hands){out.set(base);return out;}
    for(let i=0;i<rest.length;i++){const p=now[i],r=rest[i];p.x=r.x;p.y=r.y;p.z=r.z;drivers[i]?.(frame,p);}
    for(const rows of sweeps){
      for(const r of rows){const a=now[r.a],b=now[r.b];r.live.x=lerp(a.x,b.x,r.f);r.live.y=lerp(a.y,b.y,r.f);r.live.z=lerp(a.z,b.z,r.f);}
      for(let j=0;j<rows.length;j++){
        const r=rows[j],c=r.live,axis=frameAt(rows[Math.max(0,j-1)].live,rows[Math.min(rows.length-1,j+1)].live,r.axis);
        for(const {start,offset} of r.bands)for(let k=0;k<offset.length;k+=3){
          const v=start*3+k,side=offset[k],deep=offset[k+1];
          out[v]=c.x+axis.x*side+axis.fx*deep;out[v+1]=c.y+axis.y*side+axis.fy*deep;out[v+2]=c.z+axis.fz*deep+offset[k+2];
        }
        if(r.cap!==undefined){const i=r.cap*3;out[i]=c.x;out[i+1]=c.y;out[i+2]=c.z;}
      }
    }
    return out;
  }
  return {texture:atlas?.canvas,positions:base,uv:new Float32Array(uv),colors:new Float32Array(colors),photoWeight:new Float32Array(weights),
    indices:positions.length/3>65535?new Uint32Array(indices):new Uint16Array(indices),pose:poseFrame};
}

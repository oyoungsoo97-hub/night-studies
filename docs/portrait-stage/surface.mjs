function webgl(canvas){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,depth:false,stencil:false,preserveDrawingBuffer:true,premultipliedAlpha:false});
  if(!gl)return null;
  function shader(type,source){const mod=gl.createShader(type);gl.shaderSource(mod,source);gl.compileShader(mod);if(!gl.getShaderParameter(mod,gl.COMPILE_STATUS))throw Error('shader');return mod;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 pos;attribute vec2 uv;varying vec2 v;void main(){gl_Position=vec4(pos.x*2.-1.,1.-pos.y*2.,0.,1.);v=uv;}'));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D tex;varying vec2 v;void main(){gl_FragColor=texture2D(tex,v);}'));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('program');gl.useProgram(program);
  const uv=gl.createBuffer(),pos=gl.createBuffer(),index=gl.createBuffer(),texture=gl.createTexture();
  const attr=(name,b)=>{const loc=gl.getAttribLocation(program,name);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);};
  attr('uv',uv);attr('pos',pos);gl.bindTexture(gl.TEXTURE_2D,texture);
  for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,axis,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  return {
    set(photo,rig){gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.bufferData(gl.ARRAY_BUFFER,rig.source,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.bufferData(gl.ARRAY_BUFFER,rig.source.byteLength,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,rig.indices,gl.STATIC_DRAW);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,photo);},
    draw(rig,dest){gl.viewport(0,0,canvas.width,canvas.height);gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.bufferSubData(gl.ARRAY_BUFFER,0,dest);gl.drawElements(gl.TRIANGLES,rig.indices.length,gl.UNSIGNED_SHORT,0);}
  };
}
function triangleDraw(ctx,img,source,dest,ids,w,h){
  // Affine texture mapping fallback for browsers without WebGL.
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(img,0,0,w,h);
  for(let i=0;i<ids.length;i+=3){
    const a=ids[i]*2,b=ids[i+1]*2,c=ids[i+2]*2;
    const ax=source[a]*img.naturalWidth,ay=source[a+1]*img.naturalHeight,bx=source[b]*img.naturalWidth-ax,by=source[b+1]*img.naturalHeight-ay,cx=source[c]*img.naturalWidth-ax,cy=source[c+1]*img.naturalHeight-ay,det=bx*cy-cx*by;
    if(Math.abs(det)<.00001)continue;
    const x=dest[a]*w,y=dest[a+1]*h,xx=dest[b]*w-x,xy=dest[b+1]*h-y,yx=dest[c]*w-x,yy=dest[c+1]*h-y;
    const A=(xx*cy-yx*by)/det,C=(yx*bx-xx*cx)/det,B=(xy*cy-yy*by)/det,D=(yy*bx-xy*cx)/det;
    ctx.save();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+xx,y+xy);ctx.lineTo(x+yx,y+yy);ctx.closePath();ctx.clip();ctx.setTransform(A,B,C,D,x-A*ax-C*ay,y-B*ax-D*ay);ctx.drawImage(img,0,0);ctx.restore();
  }
}
const palmOutline=[0,1,2,5,9,13,17];const digits=[[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
export function paperHand(side,wave,aspect){
  const sideSign=side===0?-1:1;
  const wrist={x:side===0?.19:.81,y:aspect*(.91-.15*wave)};
  const coords=[[0,0],[-.28,-.11],[-.52,-.32],[-.67,-.43],[-.75,-.55],[-.29,-.66],[-.38,-.97],[-.44,-1.14],[-.48,-1.28],[-.04,-.73],[-.08,-1.11],[-.08,-1.31],[-.08,-1.48],[.17,-.69],[.22,-1.02],[.28,-1.18],[.32,-1.29],[.36,-.59],[.50,-.79],[.58,-.91],[.66,-1.01]];
  const size=Math.min(.158,aspect*.19),angle=sideSign*(.18+.30*wave),cs=Math.cos(angle),sn=Math.sin(angle);
  return coords.map(([ox,oy],i)=>{const curl=(i>4&&i%4>=2)? .07*Math.abs(wave):0;const x=ox*-sideSign,y=oy+curl;return{x:wrist.x+size*(x*cs-y*sn),y:wrist.y+size*(x*sn+y*cs)};});
}
function drawHand(ctx,hand,side,w,h,aspect){
  const p=hand.map(q=>({x:q.x*w,y:q.y*w})),wrist=p[0],palm=Math.max(w*.025,Math.hypot(wrist.x-p[9].x,wrist.y-p[9].y));
  const fill=side===0?'#f0b8e2':'#e9aa6e',ink='#382538',joint=side===0?'#b275a8':'#bd7852';
  const path=(ids)=>{ctx.beginPath();ids.forEach((k,i)=>i?ctx.lineTo(p[k].x,p[k].y):ctx.moveTo(p[k].x,p[k].y));ctx.closePath();};
  ctx.save();ctx.strokeStyle=ink;ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=Math.max(1.2,palm*.025);
  const root={x:wrist.x+(side===0?-1:1)*palm*.28,y:wrist.y+palm*1.85};
  ctx.beginPath();ctx.moveTo(wrist.x-palm*.30,wrist.y);ctx.lineTo(root.x-palm*.37,root.y);ctx.lineTo(root.x+palm*.34,root.y);ctx.lineTo(wrist.x+palm*.28,wrist.y);ctx.closePath();ctx.fillStyle=joint;ctx.fill();ctx.stroke();
  path(palmOutline);ctx.fillStyle=fill;ctx.fill();ctx.stroke();
  for(const digit of digits){digit.slice(1).forEach((idx,n)=>{const a=p[digit[n]],b=p[idx],r=palm*(.158-n*.022);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineWidth=r*2+Math.max(1,palm*.028);ctx.strokeStyle=ink;ctx.stroke();ctx.lineWidth=r*2;ctx.strokeStyle=fill;ctx.stroke();});}
  for(const idx of [0,2,3,5,6,7,9,10,11,13,14,15,17,18,19]){ctx.beginPath();ctx.arc(p[idx].x,p[idx].y,palm*(idx===0?.059:.032),0,Math.PI*2);ctx.fillStyle=joint;ctx.fill();}ctx.restore();
}
export function makeSurface(canvas){
  let layer=document.createElement('canvas'),gpu;try{gpu=webgl(layer);}catch{}if(!gpu)layer=document.createElement('canvas');
  const ctx=canvas.getContext('2d',{alpha:false});let photo,rig;
  function set(image,model){photo=image;rig=model;if(gpu)gpu.set(photo,rig);}
  function draw({pose,targets=[],puppets=[],raw=false,markers=false,anchors=[],rulers=[],area=null,body=null},width,height){
    if(!photo||!rig)return;const w=width||canvas.width,h=height||canvas.height;
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}if(layer.width!==w||layer.height!==h){layer.width=w;layer.height=h;}
    if(raw){ctx.drawImage(photo,0,0,w,h);return;}
    const dest=rig.deform(pose,targets);if(body&&rig.body?.enabled)rig.body.deform(dest,body,targets);
    if(gpu){gpu.draw(rig,dest);ctx.drawImage(layer,0,0,w,h);}else triangleDraw(ctx,photo,rig.source,dest,rig.indices,w,h);
    if(rig.lips&&pose.jaw>.08){
      // Separate the inner lip edges on a closed-mouth source using the posed landmarks.
      const outline=rig.lips.map(i=>[dest[i*2]*w,dest[i*2+1]*h]);ctx.save();ctx.globalAlpha=Math.min(.90,(pose.jaw-.08)*2.7);ctx.fillStyle='#321c23';ctx.beginPath();const last=outline[outline.length-1];ctx.moveTo((last[0]+outline[0][0])/2,(last[1]+outline[0][1])/2);
      outline.forEach((p,i)=>{const next=outline[(i+1)%outline.length];ctx.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);});ctx.closePath();ctx.fill();ctx.restore();
    }
    puppets.forEach((hand,side)=>{if(hand)drawHand(ctx,hand,side,w,h,rig.aspect);});
    if(markers){
      ctx.save();ctx.strokeStyle='rgba(213,255,175,.28)';ctx.lineWidth=Math.max(.55,w*.0007);ctx.beginPath();const I=rig.indices;
      for(let i=0;i<I.length;i+=3){const a=I[i]*2,b=I[i+1]*2,c=I[i+2]*2;ctx.moveTo(dest[a]*w,dest[a+1]*h);ctx.lineTo(dest[b]*w,dest[b+1]*h);ctx.lineTo(dest[c]*w,dest[c+1]*h);ctx.closePath();}ctx.stroke();ctx.restore();}
    if(markers&&rig.joints){const points=body||rig.joints;ctx.save();ctx.strokeStyle='#e6a5d7';ctx.fillStyle='#ffd9f4';ctx.lineWidth=Math.max(1.2,w*.0022);const links=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
      for(const [a,b] of links){if((rig.joints[a].visibility??1)<.45||(rig.joints[b].visibility??1)<.45)continue;const s=points[a],t=points[b];ctx.beginPath();ctx.moveTo(s.x*w,s.y*h);ctx.lineTo(t.x*w,t.y*h);ctx.stroke();for(const pt of [s,t]){ctx.beginPath();ctx.arc(pt.x*w,pt.y*h,w*.003,0,Math.PI*2);ctx.fill();}}ctx.restore();}
    if(rulers.length){ctx.save();ctx.strokeStyle='#fff39b';ctx.fillStyle='#fff39b';ctx.lineWidth=Math.max(1.5,w*.002);ctx.setLineDash([w*.010,w*.006]);for(const [a,b] of rulers){ctx.beginPath();ctx.moveTo(a.x*w,a.y*w);ctx.lineTo(b.x*w,b.y*w);ctx.stroke();for(const p of [a,b]){ctx.beginPath();ctx.arc(p.x*w,p.y*w,Math.max(2,w*.0035),0,Math.PI*2);ctx.fill();}}ctx.restore();}
    if(area){ctx.save();ctx.strokeStyle='#eafb94';ctx.fillStyle='rgba(228,245,154,.12)';ctx.lineWidth=Math.max(2,w*.003);ctx.fillRect(area.x*w,area.y*h,area.width*w,area.height*h);ctx.strokeRect(area.x*w,area.y*h,area.width*w,area.height*h);ctx.restore();}
    for(const p of anchors){ctx.beginPath();ctx.arc(p.x*w,p.y*h,Math.max(5,w*.011),0,Math.PI*2);ctx.strokeStyle='#eeff86';ctx.lineWidth=Math.max(2,w*.004);ctx.stroke();}
  }
  return {set,draw,gpu:!!gpu};
}

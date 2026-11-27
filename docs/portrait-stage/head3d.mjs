// Photo-fitted head with a projective front material and a reconstructed cranial vault.
import {canonical,topology} from './canonical-head.mjs?v=33c68ade58';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const unit=x=>clamp(x,0,1);
const ease=x=>{x=unit(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const lerp=(a,b,t)=>a.map((v,k)=>mix(v,b[k],t));
const average=(a,b)=>lerp(a,b,.5);
const planar=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const colorDistance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const gaussian=(x,y,sx,sy)=>Math.exp(-.5*((x/sx)**2+(y/sy)**2));
const tau=Math.PI*2;
const eyeLoops=[[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],[263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466]];
const lipLoop=[78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];
const rim=[356,389,251,284,332,297,338,10,109,67,103,54,21,162,127,234,93,132,58,172,136,150,149,176,148,152,377,400,378,379,365,397,288,361,323,454];
const paths=[...eyeLoops,lipLoop].map(loop=>new Set(loop));
const canonicalPoint=i=>canonical.subarray(i*3,i*3+3);
const featureIds=[10,33,133,159,145,263,362,386,374,105,334,234,454,1,13,14,61,291,152];
function faceFromPose(pose,aspect){
  const body=pose?.landmarks;if(!body?.[12])return null;const read=i=>{const p=body[i];return p&&Number.isFinite(p.x+p.y)&&(p.visibility??1)>.16?[p.x,p.y*aspect]:null;};
  const shL=read(11),shR=read(12),nose=read(0),LE=read(5),RE=read(2);if(!nose&&!LE&&!RE)return null;
  let dx=1,dy=0;const span=LE&&RE?planar(LE,RE):0,sw=shL&&shR?planar(shL,shR):0;
  if(span>.002){dx=(RE[0]-LE[0])/span;dy=(RE[1]-LE[1])/span;}else if(sw>.01){dx=(shL[0]-shR[0])/sw;dy=(shL[1]-shR[1])/sw;}
  const earA=read(7),earB=read(8),ears=earA&&earB?planar(earA,earB):0;
  const W=clamp(Math.max(span*2.5,ears*.96,sw*.30),.013,sw>.014?sw*.66:1),mouthL=read(10),mouthR=read(9),mouth=mouthL&&mouthR?average(mouthL,mouthR):null;
  const center=LE&&RE?average(LE,RE):nose?[nose[0]+dy*W*.22,nose[1]-dx*W*.22]:LE||RE;
  if(mouth&&(-dy*(mouth[0]-center[0])+dx*(mouth[1]-center[1]))<0){dx=-dx;dy=-dy;}
  const point=(x,y)=>({x:center[0]+W*(dx*x-dy*y),y:(center[1]+W*(dy*x+dx*y))/aspect});const out=[];
  const eye=(which,outer,inner,top,bottom,brow,side)=>{const c=which||[point(side*.19,0).x,point(side*.19,0).y*aspect];const offset=(x,y)=>({x:c[0]+W*(dx*x-dy*y),y:(c[1]+W*(dy*x+dx*y))/aspect});out[outer]=offset(side*.105,0);out[inner]=offset(-side*.10,0);out[top]=offset(0,-.026);out[bottom]=offset(0,.019);out[brow]=offset(0,-.10);};
  eye(LE,33,133,159,145,105,-1);eye(RE,263,362,386,374,334,1);out[234]=point(-.49,.10);out[454]=point(.49,.10);out[10]=point(0,-.41);out[152]=point(0,.74);
  out[1]=nose?{x:nose[0],y:nose[1]/aspect}:point(0,.22);out[61]=mouthL?{x:mouthL[0],y:mouthL[1]/aspect}:point(-.16,.41);out[291]=mouthR?{x:mouthR[0],y:mouthR[1]/aspect}:point(.16,.41);
  const m=mouth||[point(0,.41).x,point(0,.41).y*aspect];out[13]={x:m[0]+dy*.007*W,y:(m[1]-dx*.007*W)/aspect};out[14]={x:m[0]-dy*.007*W,y:(m[1]+dx*.007*W)/aspect};return {landmarks:out,estimated:true};
}
function fitPoints(face,aspect){
  const L=face?.landmarks;if(!L)return null;
  const valid=i=>L[i]&&Number.isFinite(L[i].x)&&Number.isFinite(L[i].y);
  if(![33,263,152,10].every(valid))return null;
  const flat=i=>[L[i].x,L[i].y*aspect];
  const a=flat(33),b=flat(263),origin=average(a,b),span=planar(a,b);if(span<.003)return null;
  const cs=(b[0]-a[0])/span,sn=(b[1]-a[1])/span;
  const cw=canonical[454*3]-canonical[234*3],eyeWidth=canonical[263*3]-canonical[33*3];
  const eyeY=canonical[33*3+1];const ex=span/eyeWidth;
  const hy=planar(flat(10),flat(152))/(canonical[10*3+1]-canonical[152*3+1]);
  const canonicalXY=i=>{const [x,y]=canonicalPoint(i);return [origin[0]+cs*x*ex+sn*(y-eyeY)*hy,origin[1]+sn*x*ex-cs*(y-eyeY)*hy];};
  // Keep all observed vertices; interpolate only the missing canonical vertices in a hand-marked face.
  const landmarks=featureIds.filter(valid).map(i=>{const p=flat(i),q=canonicalXY(i);return{q,dx:p[0]-q[0],dy:p[1]-q[1]};});
  const xy=Array.from({length:468},(_,i)=>{if(valid(i))return flat(i);const q=canonicalXY(i);let x=0,y=0,sum=0;
    for(const mark of landmarks){const d=planar(q,mark.q)/span,w=1/(.005+d*d)**1.65;x+=mark.dx*w;y+=mark.dy*w;sum+=w;}
    return [q[0]+x/sum,q[1]+y/sum];});
  const dz=(i,j)=>Number.isFinite(L[i]?.z)&&Number.isFinite(L[j]?.z)?L[i].z-L[j].z:0;
  const measuredW=planar(xy[234],xy[454]);const W=Math.max(span,Math.hypot(measuredW,clamp(dz(234,454),-measuredW*.85,measuredW*.85)));
  if(!Number.isFinite(W)||W<.01)return null;
  const eyeZ=(L[33].z+L[263].z)*.5,rawNose=eyeZ-L[1]?.z,hasDepth=Number.isFinite(rawNose)&&rawNose>W*.035;
  const depthScale=hasDepth?clamp(.292*W/rawNose,.52,1.65):1;
  const sideDepth=hasDepth?clamp(-dz(454,234)*depthScale,-.8*W,.8*W):0;
  const points=xy.map((q,i)=>{const [x,,z]=canonicalPoint(i),prior=(z-canonical[33*3+2])*W/cw+sideDepth*x/cw;
    const measured=hasDepth&&Number.isFinite(L[i]?.z)?(eyeZ-L[i].z)*depthScale:prior;
    return [q[0],q[1],W*.125+mix(prior,clamp(measured,-W,W),hasDepth?.78:0)];});
  return {points,W,cs,sn,origin,sideDepth,realDepth:hasDepth};
}
function directedHole(indices,set){const edges=new Map();for(let i=0;i<indices.length;i+=3){for(let j=0;j<3;j++){const a=indices[i+j],b=indices[i+(j+1)%3];if(!set.has(a)||!set.has(b))continue;const reverse=b*512+a;if(edges.has(reverse))edges.delete(reverse);else edges.set(a*512+b,[a,b]);}}
  const next=new Map([...edges.values()].map(([a,b])=>[b,a]));const first=next.keys().next().value,loop=[];let at=first;do{loop.push(at);at=next.get(at);}while(at!==undefined&&at!==first&&loop.length<=set.size);return loop;}
function bakeHeadMaterial({photo,aspect,W,spokes,chartUV,tex,weights,cs,sn,origin,matte,maskWorks,P,skin,hair,chartRadius}){
  if(!photo||typeof document==='undefined')return null;
  const width=photo.naturalWidth||photo.width,height=photo.naturalHeight||photo.height;if(!width||!height)return null;
  const ratio=Math.min(1,1536/Math.max(width,height)),sw=Math.max(1,Math.round(width*ratio)),sh=Math.max(1,Math.round(height*ratio));
  const size=clamp(Math.ceil(W*width*1.8/32)*32,288,768),left=sw+5,atlas=document.createElement('canvas');atlas.width=left+size+2;atlas.height=Math.max(sh,size)+2;
  const ctx=atlas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;ctx.drawImage(photo,0,0,sw,sh);let source;
  try{source=ctx.getImageData(0,0,sw,sh).data;}catch{return null;}
  const paint=ctx.createImageData(size,size),dst=paint.data;
  const pix=(x,y)=>(clamp(Math.round(y/aspect*(sh-1)),0,sh-1)*sw+clamp(Math.round(x*(sw-1)),0,sw-1))*4;
  const sorted=spokes.map(s=>({...s,angle:(s.theta+tau)%tau})).sort((a,b)=>a.angle-b.angle),angles=[];
  for(let i=0;i<2048;i++){const theta=i/2048*tau;let n=sorted.findIndex(s=>s.angle>=theta);if(n<0)n=0;const a=sorted[(n+sorted.length-1)%sorted.length],b=sorted[n],span=(b.angle-a.angle+tau)%tau;
    const t=span>1e-8?((theta-a.angle+tau)%tau)/span:0;angles.push({x:mix(a.base[0],b.base[0],t),y:mix(a.base[1],b.base[1],t),vy:mix(a.v[1],b.v[1],t),uy:mix(a.uy,b.uy,t),ux:mix(a.ux,b.ux,t),extent:mix(a.extent,b.extent,t),gap:Math.abs(mix(a.silZ-a.base[2],b.silZ-b.base[2],t))/W});}
  const candidates=[],skinPool=[50,101,117,280,330,346,151,9].map(i=>({p:P[i],radius:.023}));
  const lum=c=>.2126*c[0]+.7152*c[1]+.0722*c[2],skinLum=lum(skin);
  function description(stamp){const c=[0,0,0],level=[];for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const n=pix(stamp.p[0]+i*stamp.radius*W*.34,stamp.p[1]+j*stamp.radius*W*.34),rgb=[source[n]/255,source[n+1]/255,source[n+2]/255];for(let k=0;k<3;k++)c[k]+=rgb[k]/25;level.push(lum(rgb));}
    const mean=lum(c),variation=Math.sqrt(level.reduce((sum,n)=>sum+(n-mean)**2,0)/25);return {...stamp,c,mean,variation,score:(skinLum-mean)+variation*.40+Math.max(0,(c[2]-c[0])-(skin[2]-skin[0]))*.23};}
  for(const s of spokes){if(s.uy>-.30||s.extent<.02)continue;for(const t of [.26,.39,.52,.65,.78,.86]){const p=s.ray(s.extent*t),r=Math.min(.055,s.extent*Math.min(t,1-t)*.65);
      if(r<.006||maskWorks&&[[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>matte([p[0]+dx*r*W,p[1]+dy*r*W])<.74))continue;
      candidates.push(description({p,radius:r,extent:s.extent}));}}
  const skinStamps=skinPool.map(description);candidates.sort((a,b)=>b.score-a.score);
  const first=candidates.slice(0,Math.max(4,Math.ceil(candidates.length*.30))),median=(entries,key)=>entries.map(s=>s[key]).sort((a,b)=>a-b)[Math.floor(entries.length*.5)]??0;
  const hasHair=first.length>3&&median(first,'score')>.072;
  const hairColor=hasHair?[0,1,2].map(k=>{const c=first.map(s=>s.c[k]).sort((a,b)=>a-b);return c[Math.floor(c.length*.53)];}):skin;
  let hairPool=hasHair?candidates.filter(s=>colorDistance(s.c,hairColor)<.19&&s.score>.035):[];if(hairPool.length<3)hairPool=hasHair?first:skinStamps;
  const lateral=spokes.filter(s=>Math.abs(s.uy)<.38).map(s=>s.extent).sort((a,b)=>a-b),earVolume=lateral[Math.floor(lateral.length*.5)]??0;
  const closeCut=hasHair&&((median(hairPool,'extent')<.48&&earVolume<.172)||hairPool.length<30),hairRange=closeCut?.075:.16;
  if(closeCut){const y=lum(hairColor);for(let k=0;k<3;k++)hairColor[k]=mix(hairColor[k],y,.48);}
  // Normalize patch illumination to a common diffuse tone. The texture retains curl detail without importing adjacent skin/sky as square tiles.
  const step=Math.max(14,Math.round(size*.071)),cols=Math.ceil(size/step)+2;
  function hash(n){n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
  function patches(pool,seed){return Array.from({length:cols*cols},(_,i)=>{const stamp=pool[Math.floor(hash(i+seed)*pool.length)],angle=(hash(i*3+seed+5)-.5)*1.72,scale=stamp.radius*W/(step*.73);
    return {c:stamp.c,x:stamp.p[0],y:stamp.p[1],cs:Math.cos(angle)*scale,sn:Math.sin(angle)*scale,flip:hash(i*9+seed)>.5?-1:1};});}
  const hp=patches(hairPool,7919),sp=patches(skinStamps,983);const hcol=[0,0,0],scol=[0,0,0];
  function material(grid,x,y,ix,iy,fx,fy,out,base,range){out[0]=0;out[1]=0;out[2]=0;
    for(let j=0;j<2;j++)for(let i=0;i<2;i++){const w=(i?fx:1-fx)*(j?fy:1-fy);if(w<.0001)continue;const p=grid[(iy+j)*cols+ix+i],dx=(x-(ix+i)*step)*p.flip,dy=y-(iy+j)*step,q=pix(p.x+dx*p.cs-dy*p.sn,p.y+dy*p.cs+dx*p.sn);
      for(let k=0;k<3;k++){const detail=clamp(source[q+k]/255-p.c[k],-range,range);out[k]+=w*255*unit(base[k]+detail);}}}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const ox=((x+.5)/size-.5)/.486,oy=((y+.5)/size-.5)/.486,r=Math.hypot(ox,oy),i=(y*size+x)*4;
    const s=angles[Math.floor((Math.atan2(oy,ox)+tau)%tau/tau*2048)],ix=Math.floor(x/step),iy=Math.floor(y/step),fx=ease((x/step-ix-.32)/.36),fy=ease((y/step-iy-.32)/.36);
    const t=unit((1-r)/(1-chartRadius)),fan=unit(r/chartRadius),lat=Math.sqrt(Math.max(0,1-fan*fan)),d=s.extent*Math.sin(t*Math.PI/2);
    const refX=s.x+W*d*(cs*s.ux-sn*s.uy),refY=s.y+W*d*(sn*s.ux+cs*s.uy),z=pix(refX,refY);
    const facing=s.extent/Math.max(.001,Math.hypot(s.extent,s.gap));let observed=1-ease((t-(.09+.36*facing))/(.29+.24*facing));if(closeCut){const grazing=ease((.91-Math.abs(s.uy))/.55),soft=1-ease((t-.035-.11*facing)/(.16+.19*facing));observed=mix(observed,Math.min(observed,soft),grazing);}
    if(r<chartRadius)observed=0;
    const vertical=(s.vy+s.uy*d-.29*Math.max(0,s.uy)**1.42*ease(t))*fan+.052*(1-fan)-.17*lat*fan*Math.max(0,s.uy)**2;
    const hairline=(closeCut?.061:.185)+(closeCut?.44:.355)*lat+.024*Math.sin(s.ux*2.7)+.035*Math.max(0,s.uy)*lat;
    const fuzzy=.012*Math.sin(x*.051+y*.018)+.008*Math.sin(y*.071-x*.035);const scalp=hasHair?ease((hairline+fuzzy-vertical+.038)/.076):0;
    material(hp,x,y,ix,iy,fx,fy,hcol,hairColor,hairRange);material(sp,x,y,ix,iy,fx,fy,scol,skin,.045);
    if(closeCut){const grain=(hash((i>>2)+1961)-.5)*25;for(let k=0;k<3;k++)hcol[k]=mix(hcol[k],hairColor[k]*255+grain,.77);}
    for(let k=0;k<3;k++){const base=mix(scol[k],hcol[k],scalp);dst[i+k]=mix(base,source[z+k],observed);}dst[i+3]=255;
  }
  ctx.putImageData(paint,left,0);
  for(let i=0;i<weights.length;i++){const chart=chartUV.get(i);if(chart){tex[i*2]=(left+.5+chart[0]*(size-1))/atlas.width;tex[i*2+1]=(.5+chart[1]*(size-1))/atlas.height;weights[i]=1;}
    else{tex[i*2]=(.5+tex[i*2]*(sw-1))/atlas.width;tex[i*2+1]=(.5+tex[i*2+1]*(sh-1))/atlas.height;}}
  return atlas;
}

export function buildHead3D(input){
  const {aspect}=input;if(!Number.isFinite(aspect)||aspect<=0)return null;let face=input.face,fit=fitPoints(face,aspect);if(!fit){face=faceFromPose(input.pose,aspect);fit=fitPoints(face,aspect);}if(!fit)return null;
  const {points:P,W,cs,sn,origin,sideDepth}=fit,L=face.landmarks;
  const project=(x,y)=>[origin[0]+W*(cs*x-sn*y),origin[1]+W*(sn*x+cs*y)];
  const local=p=>[((p[0]-origin[0])*cs+(p[1]-origin[1])*sn)/W,((p[1]-origin[1])*cs-(p[0]-origin[0])*sn)/W];
  const sample=(x,y)=>{const s=input.sample?.(unit(x),unit(y/aspect));return s?.length>=3?[unit(s[0]),unit(s[1]),unit(s[2])]:[.55,.41,.35];};
  const colorAt=p=>sample(p[0],p[1]);const pos=[],tex=[],rgb=[],weights=[],idx=[],channels=[],chartUV=new Map();
  function vertex(p,uv=p,col=colorAt(uv),weight=1,channel=null){const id=pos.length/3;pos.push(...p);tex.push(unit(uv[0]),unit(uv[1]/aspect));rgb.push(...col);weights.push(weight);channels.push(channel);return id;}
  function quad(a,b,c,d){idx.push(a,b,c,a,c,d);}
  const skin=average(colorAt(P[50]),colorAt(P[280]));
  const eyeSpecs=[[33,133,159,145,105,468],[362,263,386,374,334,473]].map(([outer,inner,top,bottom,brow,iris])=>{
    const e=average(P[top],P[bottom]),half=Math.max(.015*W,planar(P[outer],P[inner])*.51);const center=local(e),gap=Math.max(.012,planar(P[top],P[bottom])/W);
    return{e,center,half:half/W,gap,brow:local(P[brow]),zSlope:(P[inner][2]-P[outer][2])/Math.max(.001,(local(P[inner])[0]-local(P[outer])[0])*W),iris};});
  const mouth=local(average(P[13],P[14])),lips=[local(P[61]),local(P[291])],mw=Math.max(.065,(lips[1][0]-lips[0][0])*.5);
  function expression(p,eyePatch=-1){const [x,y]=local(p);const out={x,y,eyePatch};
    const lower=ease((y-mouth[1]+.007)/.073);out.jaw=lower*gaussian(x-mouth[0],y-mouth[1]-.20,mw*2.2,.34);
    out.smile= lips.map(c=>gaussian(x-c[0],y-c[1],mw*.68,.097));out.pucker=gaussian(x-mouth[0],y-mouth[1],mw*.98,.082);
    out.eyes=eyeSpecs.map(({center,gap,half,brow})=>{const ex=x-center[0],ey=y-center[1],lateral=ease((1.19-Math.abs(ex/half))/.43),lid=lateral*ease((2.9-Math.abs(ey/gap))/2.05);
      return {lid:clamp(center[1]+.16*gap-y,-.70*gap,.76*gap)*lid,edge:lid,brow:gaussian(x-brow[0],y-brow[1],half*.88,.073)};});return out;}
  P.forEach(p=>{const v=local(p),side=ease((Math.abs(v[0])-.365)/.136)*ease((v[1]+.19)/.18)*ease((.69-v[1])/.17);
    const inner=project(v[0]*.77,v[1]);const col=lerp(colorAt(p),colorAt(inner),.60*side);vertex(p,p,col,1-.84*side,expression(p));});
  for(let i=0;i<topology.length;i+=3){const a=topology[i],b=topology[i+1],c=topology[i+2];if(paths.some(path=>path.has(a)&&path.has(b)&&path.has(c)))continue;
    idx.push(a,c,b); // Source canonical coordinates point up; photo coordinates point down.
  }
  const holes=paths.map(set=>directedHole(idx,set));
  function stitch(inner,outer){for(let j=0;j<inner.length;j++){const k=(j+1)%inner.length;quad(inner[j],inner[k],outer[k],outer[j]);}}
  function closeRing(ring,center){for(let i=0;i<ring.length;i++)idx.push(ring[i],ring[(i+1)%ring.length],center);}
  // Anatomical sockets behind moving lids. The eye globe stays in place as the upper lid crosses it.
  holes.slice(0,2).forEach((loop,side)=>{const E=eyeSpecs[side],p=E.e,deep=loop.map(i=>{const q=lerp(P[i],p,.23);q[2]-=W*.035;return vertex(q,q,lerp(skin,[.18,.075,.074],.65),0);});stitch(loop,deep);closeRing(deep,vertex([p[0],p[1],p[2]-.06*W],p,skin.map(x=>x*.39),0));
    const ir=L[E.iris];const center=ir&&Number.isFinite(ir.x+ir.y)?local([ir.x,ir.y*aspect]):E.center;
    const white=colorAt(project(E.center[0]+E.half*.64,E.center[1]));const R=24;let previous=[];
    for(let j=0;j<=6;j++){const radial=[.021,.19,.39,.57,.74,.93,1.12][j],ring=[];
      for(let k=0;k<R;k++){const a=k*tau/R,dx=Math.cos(a)*E.half*radial,dy=Math.sin(a)*E.half*.57*radial;const xy=project(center[0]+dx,center[1]+dy);
        const z=p[2]+(center[0]+dx-E.center[0])*W*E.zSlope-W*(.012+radial*radial*.053);const q=[...xy,z];
        const aperture=ease((1.42-Math.abs((center[1]+dy-E.center[1])/E.gap))/.64);
        ring.push(vertex(q,q,white,mix(.2,1,aperture),{globe:side,r:radial}));}
      if(previous.length)stitch(ring,previous);else{const q=[...project(center[0],center[1]),p[2]+(center[0]-E.center[0])*W*E.zSlope-W*.012];closeRing(ring,vertex(q,q,colorAt(q),1,{globe:side,r:0}));}previous=ring;}
    closeRing([...previous].reverse(),vertex([p[0],p[1],p[2]-.14*W],p,white,0));
  });
  const sourceGap=planar(P[13],P[14])/W,openWeight=ease((sourceGap-.012)/.047),mouthCenter=average(P[13],P[14]);
  const oral=lerp(colorAt(P[13]),[.078,.023,.041],.8);let last=holes[2];
  for(const fraction of [.28,.60,.85]){const row=holes[2].map(i=>{const q=lerp(P[i],mouthCenter,fraction);q[2]-=W*mix(.026+.092*fraction,.009+.025*fraction,openWeight);const c=expression(q);c.inner=true;
      const original=local(P[i]);c.jaw=mix(original[1]>=mouth[1]?1:0,.5,fraction);return vertex(q,q,oral.map((x,k)=>x*(1-.5*fraction)+(k===0?.014:0)),openWeight*(1-.18*fraction),c);});stitch(last,row);last=row;}
  const deepMouth=[mouthCenter[0],mouthCenter[1],mouthCenter[2]-mix(.14,.037,openWeight)*W],mouthChannel=expression(deepMouth);mouthChannel.jaw=.49;closeRing(last,vertex(deepMouth,mouthCenter,oral.map(x=>x*.6),openWeight*.62,mouthChannel));
  // Follow the mask around the forehead and temples; stop beneath the jaw before the mask reaches clothing.
  const cheekMid=average(P[234],P[454]),headCenter=local(cheekMid);headCenter[1]-=.055;
  const mask=input.mask||input.pose?.mask;
  const matte=(p)=>{if(!mask?.data)return null;const u=p[0],v=p[1]/aspect;if(u<0||u>1||v<0||v>1)return 0;return mask.data[Math.round(v*(mask.height-1))*mask.width+Math.round(u*(mask.width-1))]/255;};
  const maskWorks=(matte(P[1])??0)>.15,within=p=>p[0]>=0&&p[0]<=1&&p[1]>=0&&p[1]<=aspect;
  const subdivision=4,spokes=[];for(let i=0;i<rim.length;i++){const a=P[rim[i]],b=P[rim[(i+1)%rim.length]];
    for(let j=0;j<subdivision;j++){const t=j/subdivision,base=lerp(a,b,t),v=local(base),dx=v[0]-headCenter[0],dy=v[1]-headCenter[1],r=Math.hypot(dx,dy),ux=dx/r,uy=dy/r;
      const top=Math.max(0,-uy),side=1-ease((uy-.08)/.63),limit=.016+.285*side+.64*top;
      const ray=d=>project(v[0]+ux*d,v[1]+uy*d);let extent=0;
      if(maskWorks){let missing=0;for(let k=1;k<=58;k++){const step=limit*k/58,q=ray(step);if(!within(q))break;if(matte(q)<.37){if(++missing>=2)break;}else{missing=0;extent=step;}}}
      else{const fallback=.009+.062*side+.235*top,far=colorAt(ray(limit)),start=colorAt(ray(.011));extent=fallback;
        // If the outer sample is distinct, stop at its first contiguous appearance.
        if(colorDistance(start,far)>.19){for(let k=1;k<38;k++){const d=limit*k/38;if(!within(ray(d))||colorDistance(colorAt(ray(d)),far)<.092){extent=Math.max(.005,d-limit/38);break;}}}}
      spokes.push({base,v,ux,uy,top,side,ray,extent,theta:Math.atan2(uy,ux)});}}
  const N=spokes.length,ext=spokes.map(s=>s.extent);spokes.forEach((s,i)=>{const neighbors=[ext[(i+N-1)%N],ext[i],ext[(i+1)%N]].sort((a,b)=>a-b);s.extent=Math.max(.001,ext[i]*.40+neighbors[1]*.60-(maskWorks?.009:0));
    s.outer=s.ray(s.extent);s.jawRise=.29*Math.max(0,s.uy)**1.42;s.jawNarrow=.16*Math.max(0,s.uy)**1.35*s.ux;
    s.outer[0]+=W*(sn*s.jawRise-cs*s.jawNarrow);s.outer[1]+=W*(-cs*s.jawRise-sn*s.jawNarrow);s.silZ=W*(-.275-.08*s.top+.11*Math.max(0,s.uy))+sideDepth*s.v[0];});
  // The shell uses a separate UV island. Its welded seam follows the actual 36-point face boundary.
  const chartRadius=.69,chart=(s,r)=>[.5+.486*r*s.ux,.5+.486*r*s.uy];
  let previous=rim.map((id,k)=>{const j=vertex(P[id],P[id],colorAt(P[id]),1,channels[id]);chartUV.set(j,chart(spokes[k*subdivision],1));return j;});
  for(const t of [.09,.23,.41,.59,.74,.86,.95,1]){const row=spokes.map(s=>{const d=s.extent*Math.sin(t*Math.PI/2),xy=s.ray(d),f=1-Math.cos(t*Math.PI/2),z=mix(s.base[2],s.silZ,f)+W*.047*Math.sin(Math.PI*t)*(.3+s.top*.7);
    const shape=ease(t);xy[0]+=W*(sn*s.jawRise-cs*s.jawNarrow)*shape;xy[1]+=W*(-cs*s.jawRise-sn*s.jawNarrow)*shape;
    const q=[...xy,z],c=s.uy>.39?expression(q):null;if(c)c.shellJaw=(1-t)*.8;const id=vertex(q,xy,colorAt(xy),within(xy)?1:0,c);chartUV.set(id,chart(s,mix(1,chartRadius,t)));return id;});
    if(previous.length===rim.length){for(let i=0;i<rim.length;i++){const j=(i+1)%rim.length,lo=i*subdivision,hi=j*subdivision;idx.push(previous[i],previous[j],row[hi]);for(let k=subdivision;k>0;k--)idx.push(previous[i],row[(lo+k)%N],row[lo+k-1]);}}
    else stitch(previous,row);previous=row;}
  const crown=spokes.filter(s=>s.uy<-.42&&s.extent>.045).sort((a,b)=>b.extent-a.extent);
  function hairDonor(spoke,phase){let s=spoke;if(!s||s.extent<.035||s.uy>.20)s=crown.length?crown[Math.abs(Math.floor(phase*13))%Math.min(crown.length,13)]:spoke;
    return s.ray(s.extent*(.46+.23*Math.sin(phase*5.38))+.0001);}
  const hairSamples=(crown.length?crown:spokes.filter(s=>s.uy<-.55)).map(s=>colorAt(s.ray(s.extent*.58)));
  const hair=[0,1,2].map(k=>{const arr=hairSamples.map(c=>c[k]).sort((a,b)=>a-b);return arr.length?arr[Math.floor(arr.length*.5)]:skin[k];});
  const hairBody=clamp((crown.reduce((s,x)=>s+x.extent,0)/Math.max(1,crown.length))*.52,0,.23);
  const occXY=project(headCenter[0],headCenter[1]-.024),backZ=-W*(.84+hairBody);
  for(let n=1;n<18;n++){const angle=n/18*Math.PI*.5,lat=Math.sin(angle),fan=Math.cos(angle);
    const row=spokes.map((s,i)=>{const settle=(lat*(.09+.10*s.top)+.95*lat*fan*Math.max(0,s.uy)**2)*W;
      const xy=[mix(occXY[0],s.outer[0],fan)+sn*settle*.22,mix(occXY[1],s.outer[1],fan)-cs*settle*.22];
      const z=mix(s.silZ,backZ,lat),q=[...xy,z];const nape=ease((s.uy-.40)/.55)*ease((fan-.17)/.56),donor=hairDonor(s,i/N+lat*.28),localColor=colorAt(donor);
      const streak=.93+.06*Math.sin(i*1.72+lat*5)+.025*Math.sin(i*.76-lat*8);const hairColor=lerp(hair,localColor,.32).map(x=>unit(x*streak));
      const chinColor=lerp(skin,colorAt(s.ray(s.extent*.35)),.31);const baseColor=lerp(hairColor,chinColor,nape);
      // The far side uses local scalp/skin samples. Fade from the observed silhouette without projecting facial features behind the skull.
      const blend=ease(lat/.31),border=s.ray(s.extent*.96),uv=lat<.31?border:donor;
      const col=lerp(colorAt(border),baseColor,blend),photoAmount=lat<.31?1-blend:(1-nape)*.16*ease((lat-.31)/.12);
      const id=vertex(q,uv,col,photoAmount);chartUV.set(id,chart(s,chartRadius*fan));return id;});stitch(previous,row);previous=row;}
  const occiput=vertex([occXY[0],occXY[1]-.018*W,backZ],hairDonor(spokes[0],.21),hair,.07);chartUV.set(occiput,[.5,.5]);closeRing(previous,occiput);
  // Locate the surface behind each ear by intersecting the head at its actual y and z.
  // This keeps its root embedded even when the photograph shows a wide hairstyle or an oblique face.
  const planes=[];const localMesh=Array.from({length:pos.length/3},(_,i)=>{const p=pos.slice(i*3,i*3+3);return [...local(p),p[2]/W];});
  for(let i=0;i<idx.length;i+=3){const a=localMesh[idx[i]],b=localMesh[idx[i+1]],c=localMesh[idx[i+2]],y1=b[1]-a[1],z1=b[2]-a[2],y2=c[1]-a[1],z2=c[2]-a[2],det=y1*z2-z1*y2;
    if(Math.abs(det)<1e-7)continue;planes.push({a,b,c,y1,y2,z1,z2,det,lo:Math.min(a[1],b[1],c[1]),hi:Math.max(a[1],b[1],c[1])});}
  function shellX(sign,y,z){let exterior=-Infinity;for(const t of planes){if(y<t.lo||y>t.hi)continue;const dy=y-t.a[1],dz=z-t.a[2],u=(dy*t.z2-dz*t.y2)/t.det,v=(dz*t.y1-dy*t.z1)/t.det;
    if(u<0||v<0||u+v>1)continue;exterior=Math.max(exterior,sign*(t.a[0]+u*(t.b[0]-t.a[0])+v*(t.c[0]-t.a[0])));}return exterior;}
  for(const sign of [-1,1]){const temple=local(P[sign<0?234:454]);let matches=0;
    for(let j=-3;j<=4;j++)for(let i=0;i<5;i++){const q=project(temple[0]+sign*i*.012,temple[1]+j*.027);if(within(q)&&(!maskWorks||matte(q)>.48)&&colorDistance(colorAt(q),skin)<.31)matches++;}
    if(matches<4&&crown.length)continue;const ey=temple[1]+.028,ez=-.245+sideDepth*temple[0]/W,baseX=shellX(sign,ey,ez);if(!Number.isFinite(baseX))continue;
    const anatomical=Math.abs(temple[0])+.004,atEar=(y,z)=>{const surface=shellX(sign,y,z);return Math.min(anatomical,Number.isFinite(surface)?surface:baseX)-.010;};
    const S=36;let prev=[];for(let j=0;j<=14;j++){const r=Math.max(.018,j/14),ring=[];for(let i=0;i<S;i++){const a=i*tau/S,v=Math.sin(a)*r,u=Math.cos(a)*r;
      const yy=ey+v*.144+u*.024,zz=ez+u*(.094-.026*v)-v*.033,canal=gaussian(u-.25,v+.08,.22,.22),ridge=Math.exp(-((r-.82)**2)/.012)*(.78-.19*v);
      const fork=Math.exp(-((r-.40-.18*Math.sin(a+.54))**2)/.020)*(.50+.37*Math.max(0,-v)),tragus=gaussian(u-.60,v-.02,.19,.27),lobe=gaussian(u+.02,v-.78,.50,.20);
      const rise=.038*ridge+.024*fork-.020*canal+.020*tragus+.010*lobe-.025*r**5,outer=atEar(yy,zz)+rise;
      const q=[...project(sign*outer,yy),zz*W],donor=project(temple[0]-sign*.011+sign*u*.019,temple[1]+v*.088),tone=clamp(.94+.13*ridge+.10*fork-.41*canal+.04*lobe,.53,1.11);
      const col=lerp(skin,colorAt(donor),.32).map((x,k)=>unit(x*tone+(k===0?.017:0)));ring.push(vertex(q,donor,col,.17));}
      if(prev.length)stitch(sign>0?prev:ring,sign>0?ring:prev);else{const xy=project(sign*(atEar(ey,ez)-.009),ey);closeRing(sign>0?[...ring].reverse():ring,vertex([...xy,ez*W],xy,skin.map(x=>x*.70),0));}prev=ring;}
    const q=project(sign*(atEar(ey,ez)-.072),ey);closeRing(sign>0?prev:[...prev].reverse(),vertex([...q,ez*W],q,skin,0));}
  // Connect the lower skull directly to the measured shoulder bar. Pose-only uploads have no separate face-derived collar.
  const chin=local(P[152]),S=44;let neck=[];const bodyLandmarks=input.pose?.landmarks;
  const bar=bodyLandmarks?.[11]&&bodyLandmarks?.[12]?average([bodyLandmarks[11].x,bodyLandmarks[11].y*aspect],[bodyLandmarks[12].x,bodyLandmarks[12].y*aspect]):null;
  const neckBase=bar?local(bar):[chin[0],chin[1]+.37],neckTopY=Math.min(chin[1]-.30,headCenter[1]+.17),neckBottomY=clamp(neckBase[1]+.13,chin[1]+.18,chin[1]+1.45);
  for(let j=0;j<=12;j++){const t=j/12,ring=[],slide=ease(t),width=.219+.022*t+.092*t**4,depth=.249+.048*t,centerX=mix(chin[0],neckBase[0],slide),level=mix(neckTopY,neckBottomY,t),centerZ=mix(-.31,-.255,slide);
    for(let i=0;i<S;i++){const a=i*tau/S,fx=Math.cos(a),fz=Math.sin(a),x=centerX+fx*width,y=level+.047*fx*fx*t-.028*fz*(1-t),xy=project(x,y),q=[...xy,(centerZ+fz*depth)*W],channel={neck:t};
      const donor=project(x,Math.max(chin[1]+.012,y)),shade=.90+.068*t+.04*Math.abs(fx),col=skin.map(c=>unit(c*shade));
      const weight=ease((fz-.25)/.55)*(within(donor)&&(!maskWorks||matte(donor)>.49)?1:0);ring.push(vertex(q,donor,col,weight,channel));}
    const center=project(centerX,level),center3=[...center,centerZ*W];if(neck.length)stitch(ring,neck);else closeRing(ring,vertex(center3,center,skin,0,{neck:0}));neck=ring;
    if(j===12)closeRing([...neck].reverse(),vertex(center3,center,skin,0,{neck:1}));}
  // Make the inner bottom lip follow the jaw hinge without dragging the upper lip into the aperture.
  const lowerLip=[95,88,178,87,14,317,402,318,324,17,84,314,181,405,91,321];
  for(const id of lowerLip){const ch=channels[id];ch.jaw=Math.max(ch.jaw,.94*ease((1.15-Math.abs((ch.x-mouth[0])/mw))/.57));}
  for(const id of [191,80,81,82,13,312,311,310,415])channels[id].jaw=0;
  const texture=bakeHeadMaterial({photo:input.photo,aspect,W,spokes,chartUV,tex,weights,cs,sn,origin,matte,maskWorks,P,skin,hair,chartRadius});
  const positions=new Float32Array(pos),uv=new Float32Array(tex),colors=new Float32Array(rgb),photoWeight=new Float32Array(weights),indices=new Uint16Array(idx);
  const pivotXY=project(headCenter[0],headCenter[1]+.16),pivotZ=-W*.23;
  const shoulders=input.pose?.landmarks;const length=positions.length/3;
  function pose(frame={},out=new Float32Array(positions.length)){
    const f=frame.pose||{},yaw=(f.yaw||0)*.76,tilt=(f.pitch||0)*.46,roll=(f.roll||0)*.39,depth=(f.depth||0)*W*.23;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt),cr=Math.cos(roll),sr=Math.sin(roll);
    const jaw=(f.jaw||0),smL=f.smileL||0,smR=f.smileR||0,puck=f.pucker||0,bL=f.blinkL||0,bR=f.blinkR||0;
    let torsoC=1,torsoS=0,bodyScale=1,bodyDX=0,bodyDY=0,bodyDZ=0;
    const active=frame.body;if(shoulders?.length>=13&&active?.length>=13){const a=shoulders[11],b=shoulders[12],A=active[11],B=active[12];
      if(a&&b&&A&&B&&(a.visibility??1)>.4&&(b.visibility??1)>.4){const wx=b.x-a.x,wy=(b.y-a.y)*aspect,WX=B.x-A.x,WY=(B.y-A.y)*aspect,dist=Math.hypot(wx,wy);
        if(dist>.025&&Number.isFinite(WX+WY)){bodyDZ=((Number.isFinite(A.dz)?A.dz:0)+(Number.isFinite(B.dz)?B.dz:0))*.5;const angle=clamp(Math.atan2(wx*WY-wy*WX,wx*WX+wy*WY),-.7,.7);torsoC=Math.cos(angle);torsoS=Math.sin(angle);bodyScale=clamp(Math.hypot(WX,WY)/dist,.86,1.16);
          const mx=(a.x+b.x)/2,my=(a.y+b.y)*aspect/2,rx=pivotXY[0]-mx,ry=pivotXY[1]-my;
          bodyDX=(A.x+B.x)/2+(torsoC*rx-torsoS*ry)*bodyScale-pivotXY[0];bodyDY=(A.y+B.y)*aspect/2+(torsoS*rx+torsoC*ry)*bodyScale-pivotXY[1];}}}
    for(let i=0;i<length;i++){const j=i*3,p=channels[i];let x=(positions[j]-pivotXY[0])*cs+(positions[j+1]-pivotXY[1])*sn,y=(positions[j+1]-pivotXY[1])*cs-(positions[j]-pivotXY[0])*sn,z=positions[j+2]-pivotZ;
      if(p?.globe!==undefined){const e=eyeSpecs[p.globe],amount=(1-ease((p.r-.54)/.56));x+=(f.gazeX||0)*e.half*.40*W*amount;y+=(f.gazeY||0)*e.gap*.34*W*amount;}
      else if(p?.eyes){const left=p.eyes[0],right=p.eyes[1],smileA=p.smile[0]*smL,smileB=p.smile[1]*smR,orb=p.pucker*puck;
        x+=W*(.071*(smileB-smileA)-(p.x-mouth[0])*orb*.40);
        y+=W*(left.lid*bL+right.lid*bR-.081*(left.brow*(f.browL||0)+right.brow*(f.browR||0))-.086*(smileA+smileB)+(p.y-mouth[1])*orb*.23);
        z+=W*(.080*orb+.024*(smileA+smileB)+.042*(left.edge*bL+right.edge*bR));
        const open=jaw*p.jaw*(p.shellJaw??1)*.32;
        if(open){const y0=y+W*.055,z0=z+W*.045,c=Math.cos(open),s=Math.sin(open);y=y0*c+z0*s-W*.055;z=z0*c-y0*s-W*.045;}}
      const x1=cy*x+sy*z,z1=cy*z-sy*x,y1=ct*y+st*z1,z2=ct*z1-st*y;
      const neckInfluence=p?.neck===undefined?1:1-ease((p.neck-.12)/.64);
      const rx=mix(x,cr*x1-sr*y1,neckInfluence),ry=mix(y,sr*x1+cr*y1,neckInfluence),ix=cs*rx-sn*ry,iy=sn*rx+cs*ry;
      out[j]=pivotXY[0]+bodyDX+(ix*torsoC-iy*torsoS)*bodyScale;out[j+1]=pivotXY[1]+bodyDY+(iy*torsoC+ix*torsoS)*bodyScale;out[j+2]=pivotZ+mix(z,z2+depth,neckInfluence)+bodyDZ;
    }return out;
  }
  return {positions,uv,colors,photoWeight,indices,pose,texture,estimated:!!face.estimated};
}

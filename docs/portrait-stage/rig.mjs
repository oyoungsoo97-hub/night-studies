// Positions are in photo-width units so rotation and distance preserve pixel proportions.
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const mix=(a,b,t)=>a+(b-a)*t;
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const gauss=(x,y,sx,sy)=>Math.exp(-.5*((x/sx)**2+(y/sy)**2));
const fingers=[[0,1,2,3,4],[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]];
const radians=v=>Math.atan2(Math.sin(v),Math.cos(v));
export function resting(){return {browL:0,browR:0,blinkL:0,blinkR:0,jaw:0,roll:0,yaw:0,pitch:0,hands:0};}
export function faceSignal(face,aspect){
  if(!face?.landmarks?.[454])return null;
  const pts=face.landmarks,s=face.blendshapes||{},p=i=>({x:pts[i].x,y:pts[i].y*aspect});
  const left=p(33),right=p(263),nose=p(1),c=mid(left,right),span=Math.max(.001,hypot(left,right));
  const angle=Math.atan2(right.y-left.y,right.x-left.x),cs=Math.cos(angle),sn=Math.sin(angle);
  const orient=(a,b)=>hypot(p(a),p(b))/span;
  return {browL:((s.browOuterUpRight||0)*.65+(s.browInnerUp||0)*.35)-(s.browDownRight||0)*.6,browR:((s.browOuterUpLeft||0)*.65+(s.browInnerUp||0)*.35)-(s.browDownLeft||0)*.6,
    blinkL:s.eyeBlinkRight??clamp(1-orient(159,145)/.065,0,1),blinkR:s.eyeBlinkLeft??clamp(1-orient(386,374)/.065,0,1),jaw:s.jawOpen??clamp(orient(13,14)*2.8,0,1),roll:angle,yaw:((nose.x-c.x)*cs+(nose.y-c.y)*sn)/span,pitch:((nose.y-c.y)*cs-(nose.x-c.x)*sn)/span};
}
export function relativePose(now,base,gain){
  const a=resting();if(!now||!base)return a;
  for(const k of ['browL','browR'])a[k]=clamp((now[k]-base[k])*gain*2.0,-1,1);
  for(const k of ['blinkL','blinkR','jaw'])a[k]=clamp((now[k]-base[k])*gain/Math.max(.28,1-base[k]),0,1);
  a.jaw=clamp(a.jaw*1.45,0,1);a.roll=clamp(-radians(now.roll-base.roll)*3.1*gain,-1,1);
  a.yaw=clamp(-(now.yaw-base.yaw)*4.5*gain,-1,1);a.pitch=clamp((now.pitch-base.pitch)*4.3*gain,-1,1);
  return a;
}
// Two anchors define a local face coordinate system when the imported portrait has no detected face.
export function manualFace(eye,chin,aspect){
  const chinPoint={x:chin.x,y:chin.y*aspect},center={x:eye.x,y:eye.y*aspect};
  const length=hypot(center,chinPoint);if(length<.035)throw new Error('anchors');
  const down={x:(chinPoint.x-center.x)/length,y:(chinPoint.y-center.y)/length},across={x:down.y,y:-down.x};
  const W=length*1.28,out=[];
  for(const [i,x,y] of [[33,-.32,0],[133,-.09,.003],[159,-.205,-.025],[145,-.205,.025],[263,.32,0],[362,.09,.003],[386,.205,-.025],[374,.205,.025],[105,-.21,-.12],[334,.21,-.12],[234,-.5,.16],[454,.5,.16],[1,0,.25],[13,0,.405],[14,0,.423],[61,-.18,.414],[291,.18,.414],[152,0,1/1.28],[10,0,-.42]])out[i]={x:center.x+W*(across.x*x+down.x*y),y:(center.y+W*(across.y*x+down.y*y))/aspect};
  return {landmarks:out};
}
function circle(a,b,c){
  const ax=b.x-a.x,ay=b.y-a.y,bx=c.x-a.x,by=c.y-a.y,d=2*(ax*by-ay*bx);if(Math.abs(d)<1e-11)return null;
  const aa=ax*ax+ay*ay,bb=bx*bx+by*by,dx=(by*aa-ay*bb)/d,dy=(ax*bb-bx*aa)/d;
  return {x:a.x+dx,y:a.y+dy,r:dx*dx+dy*dy};
}
function triangulate(points,aspect){
  const n=points.length,s=8*Math.max(1,aspect);const pts=[...points,{x:-s,y:-s},{x:s*3,y:-s},{x:-s,y:s*3}];
  let tris=[{ids:[n,n+1,n+2],c:circle(...pts.slice(n))}];
  for(let i=0;i<n;i++){
    const p=pts[i],edges=new Map(),kept=[];
    for(const tri of tris){const c=tri.c;if((p.x-c.x)**2+(p.y-c.y)**2>c.r+1e-10){kept.push(tri);continue;}
      for(let j=0;j<3;j++){const a=tri.ids[j],b=tri.ids[(j+1)%3],key=Math.min(a,b)*4096+Math.max(a,b);if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}
    for(const [a,b] of edges.values()){const c=circle(pts[a],pts[b],p);if(c)kept.push({ids:[a,b,i],c});}tris=kept;
  }
  return new Uint16Array(tris.filter(t=>t.ids.every(i=>i<n)).flatMap(t=>t.ids));
}
export function handPoints(hand,aspect){return hand.landmarks.map(pt=>({x:pt.x,y:pt.y*aspect}));}
export function retargetHand(original,current,base,gain,mirror){
  if(!current||!base)return null;
  const S=original, C=current, B=base;
  const target=[{x:S[0].x+clamp((C[0].x-B[0].x)*gain*(mirror?-1:1),-.13,.13),y:S[0].y+clamp((C[0].y-B[0].y)*gain,-.14,.14)}];
  const sign=(pts)=>Math.sign((pts[5].x-pts[0].x)*(pts[17].y-pts[0].y)-(pts[5].y-pts[0].y)*(pts[17].x-pts[0].x))||1;
  const flip=sign(S)*sign(B);
  for(const chain of fingers){for(let k=1;k<5;k++){const a=chain[k-1],b=chain[k];
    const angle=(arr)=>Math.atan2(arr[b].y-arr[a].y,arr[b].x-arr[a].x);
    const baseLength=hypot(B[a],B[b]);const restLength=hypot(S[a],S[b]);
    const turn=clamp(radians(angle(C)-angle(B))*gain,-1.25,1.25)*flip;
    const length=restLength*clamp(1+(hypot(C[a],C[b])/Math.max(.003,baseLength)-1)*gain,.5,1.3);
    target[b]={x:target[a].x+Math.cos(angle(S)+turn)*length,y:target[a].y+Math.sin(angle(S)+turn)*length};}}
  return target;
}
export function manualHand(original,amount,side){
  if(!amount)return null;const palm=Math.max(.02,hypot(original[0],original[9]));
  const a=amount*.40*(side?1:-1),target=original.map((p,i)=>{
    const x=p.x-original[0].x,y=p.y-original[0].y;
    return {x:original[0].x+x*Math.cos(a)-y*Math.sin(a)+amount*palm*.2*(side?-1:1),y:original[0].y+x*Math.sin(a)+y*Math.cos(a)-amount*palm*.29+((i%4===0&&i>0)?amount*.1*palm:0)};});return target;
}
function buildFaceWeights(p,face,aspect){
  if(!face?.landmarks?.[454])return null;
  const L=face.landmarks,at=i=>({x:L[i].x,y:L[i].y*aspect}),left=at(33),right=at(263),origin=mid(left,right);
  const theta=Math.atan2(right.y-left.y,right.x-left.x),cs=Math.cos(theta),sn=Math.sin(theta),W=Math.max(.025,hypot(at(234),at(454)));
  const local=q=>({x:((q.x-origin.x)*cs+(q.y-origin.y)*sn)/W,y:((q.y-origin.y)*cs-(q.x-origin.x)*sn)/W});
  const n=i=>local(at(i)),v=local(p),nose=n(1),chin=n(152),top=n(10),mouth=mid(n(13),n(14));
  const faceCenter=(top.y+chin.y)*.5,headH=Math.max(.45,(chin.y-top.y)*.52);
  const radial=Math.hypot(v.x/.57,(v.y-faceCenter)/headH);const head=ease((1.5-radial)/.65);
  if(head<.0001)return null;
  function eye(outer,inner,upper,lower,brow){
    const center=mid(n(upper),n(lower)),half=Math.max(.038,Math.abs(n(outer).x-n(inner).x)/2),gap=Math.max(.019,Math.abs(n(lower).y-n(upper).y)),b=n(brow);
    const lid=clamp(center.y-v.y,-gap*.56,gap*.56)*ease((1.30-Math.abs((v.x-center.x)/half))/.62)*ease((3.8-Math.abs((v.y-center.y)/gap))/2.9);
    return {lid,brow:-.068*gauss(v.x-b.x,v.y-b.y,half*.85,.062)};
  }
  const eL=eye(33,133,159,145,105),eR=eye(263,362,386,374,334);
  const leftLip=n(61),rightLip=n(291),mouthWidth=Math.max(.09,hypot(leftLip,rightLip)*.5);
  const lipX=clamp((v.x-mouth.x)/mouthWidth,-1,1),corner=lipX<0?leftLip:rightLip;
  const seam=mouth.y+(corner.y-mouth.y)*Math.abs(lipX)**1.6;
  const opening=.058*ease((v.y-seam+.0015)/.006)*gauss(v.x-mouth.x,v.y-mouth.y-.025,mouthWidth*.62,.12);
  const jaw=opening+.032*ease((v.y-mouth.y+.018)/.17)*gauss(v.x-mouth.x,v.y-mouth.y-.15,mouthWidth*1.8,.25);
  const noseFall=gauss(v.x-nose.x,v.y-nose.y,.31,.38);
  return {cs,sn,W,v,head,eL,eR,jaw,noseFall};
}
export function makeRig(face,hands,aspect){
  const pts=[],seen=new Set();function add(x,y){if(!Number.isFinite(x+y)||x<0||x>1||y<0||y>aspect)return;const key=Math.round(x*8000)+','+Math.round(y*8000);if(!seen.has(key)){seen.add(key);pts.push({x,y});}}
  const nx=25,ny=clamp(Math.ceil(25*aspect),12,49);for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)add(i/nx,j/ny*aspect);
  face?.landmarks?.slice(0,468).forEach(p=>{if(p)add(p.x,p.y*aspect);});
  const palms=hands.map(h=>handPoints(h,aspect));
  palms.forEach(hand=>{const radius=hypot(hand[0],hand[9])*.11;for(const p of hand){add(p.x,p.y);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])add(p.x+radius*dx,p.y+radius*dy);}});
  const indices=triangulate(pts,aspect);
  const weights=pts.map(p=>{
    if(p.x<.00001||p.x>.99999||p.y<.00001||p.y>aspect-.00001)return null;
    const faceData=buildFaceWeights(p,face,aspect);
    const handData=palms.map(hand=>{const span=Math.max(.02,hypot(hand[0],hand[9]));let total=0;
      const near=hand.map((q,i)=>[i,hypot(q,p)]).sort((a,b)=>a[1]-b[1]).slice(0,3);const digitCoverage=ease((span*.84-near[0][1])/(span*.61));
      const wristCoverage=ease((span*1.78-hypot(p,hand[0]))/(span*1.55))*(1-digitCoverage);
      if(!digitCoverage&&!wristCoverage)return null;
      const weights=near.map(([i,d])=>{const w=1/(d*d+(.025*span)**2);total+=w;return [i,w];});return [...weights.map(([i,w])=>[i,w/total*digitCoverage]),[0,wristCoverage]];});
    return {faceData,handData};
  });
  const source=new Float32Array(pts.flatMap(p=>[p.x,p.y/aspect]));const dest=new Float32Array(source.length);
  function deform(pose,targets){
    for(let i=0;i<pts.length;i++){
      const p=pts[i],w=weights[i];let dx=0,dy=0;
      if(w?.faceData){const {cs,sn,W,v,head,eL,eR,jaw,noseFall}=w.faceData;
        const roll=pose.roll*.22,px=v.x,py=v.y-.34;
        const a=((Math.cos(roll)-1)*px-Math.sin(roll)*py)*head+pose.yaw*(.045*head+.08*noseFall);
        const b=(Math.sin(roll)*px+(Math.cos(roll)-1)*py)*head+pose.pitch*(.027*head+.05*noseFall)+pose.blinkL*eL.lid+pose.blinkR*eR.lid+pose.browL*eL.brow+pose.browR*eR.brow+pose.jaw*jaw;
        dx+=(a*cs-b*sn)*W;dy+=(a*sn+b*cs)*W;}
      w?.handData.forEach((weights,j)=>{if(!weights||!targets[j])return;for(const [idx,weight] of weights){dx+=(targets[j][idx].x-palms[j][idx].x)*weight;dy+=(targets[j][idx].y-palms[j][idx].y)*weight;}});
      dest[2*i]=p.x+dx;dest[2*i+1]=(p.y+dy)/aspect;
    }return dest;
  }
  const lipIds=[78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95];
  let lips=null;
  if(face?.landmarks?.[415]){
    const at=i=>({x:face.landmarks[i].x,y:face.landmarks[i].y*aspect});
    const initialGap=hypot(at(13),at(14))/Math.max(.001,hypot(at(234),at(454)));
    if(initialGap<.020)lips=lipIds.map(id=>{const q=at(id);let best=0,dist=Infinity;pts.forEach((p,i)=>{const d=(q.x-p.x)**2+(q.y-p.y)**2;if(d<dist){best=i;dist=d;}});return best;});
  }
  return {source,dest,indices,deform,palms,face,aspect,lips};
}
export function faceGeometry(face,aspect){
  if(!face?.landmarks?.[454])return null;
  const at=i=>({x:face.landmarks[i].x,y:face.landmarks[i].y*aspect});
  const cheeks=[at(234),at(454)],height=[at(10),at(152)],eyes=[mid(at(33),at(133)),mid(at(263),at(362))];
  const W=hypot(...cheeks),H=hypot(...height);if(W<.001||H<.001)return null;
  return {ratio:W/H,eyeRatio:hypot(...eyes)/W,tilt:Math.atan2(eyes[1].y-eyes[0].y,eyes[1].x-eyes[0].x)*180/Math.PI,lines:[cheeks,height,eyes]};
}

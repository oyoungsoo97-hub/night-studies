import {handInfluence} from './anatomy.mjs?v=03e95be4b5';
// Positions are in photo-width units so rotation and distance preserve pixel proportions.
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const mix=(a,b,t)=>a+(b-a)*t;
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const gauss=(x,y,sx,sy)=>Math.exp(-.5*((x/sx)**2+(y/sy)**2));
import {driveHand,curlHand,handPoints} from './hand3d.mjs?v=649a3cd4e5';
export {driveHand as retargetHand,curlHand as manualHand};
const radians=v=>Math.atan2(Math.sin(v),Math.cos(v));
export function resting(){return {browL:0,browR:0,blinkL:0,blinkR:0,jaw:0,roll:0,yaw:0,pitch:0,hands:0,smileL:0,smileR:0,pucker:0,gazeX:0,gazeY:0,depth:0};}
export function faceSignal(face,aspect){
  if(!face?.landmarks?.[454])return null;
  const pts=face.landmarks,s=face.blendshapes||{},p=i=>({x:pts[i].x,y:pts[i].y*aspect});
  const left=p(33),right=p(263),nose=p(1),c=mid(left,right),span=Math.max(.001,hypot(left,right));
  const angle=Math.atan2(right.y-left.y,right.x-left.x),cs=Math.cos(angle),sn=Math.sin(angle);
  const orient=(a,b)=>hypot(p(a),p(b))/span;
  const irisBalance=(center,a,b,up,down)=>{if(!pts[center])return [0,0];const c=p(center),m=mid(p(a),p(b)),width=Math.max(.001,hypot(p(a),p(b))),ey=mid(p(up),p(down));return [((c.x-m.x)*cs+(c.y-m.y)*sn)/width,((c.y-ey.y)*cs-(c.x-ey.x)*sn)/width];};
  const a=irisBalance(468,33,133,159,145),b=irisBalance(473,362,263,386,374);
  // MediaPipe's column-major transform maps the canonical face into camera space.
  // Its rotation is independent of eye foreshortening at three-quarter and profile angles.
  const m=face.matrix,angles={};
  if(m?.length===16 && Array.from(m).every(Number.isFinite) && Math.hypot(m[8],m[9],m[10])>.01){
    angles.turn=Math.atan2(m[8],m[10]);
    angles.nod=-Math.atan2(m[9],Math.hypot(m[8],m[10]));
    angles.lean=Math.atan2(m[1],m[5]);
    if(Math.abs(m[14])>1)angles.distance=1/Math.abs(m[14]);
  }else if([33,263,10,152].every(i=>Number.isFinite(pts[i]?.z))){
    const diff=(a,b)=>[pts[a].x-pts[b].x,(pts[a].y-pts[b].y)*aspect,pts[a].z-pts[b].z];
    const x=diff(263,33),down=diff(152,10),length=Math.hypot(...x);
    const n=[x[1]*down[2]-x[2]*down[1],x[2]*down[0]-x[0]*down[2],x[0]*down[1]-x[1]*down[0]];
    if(length>.001 && Math.hypot(...n)>.00001){
      angles.turn=Math.atan2(-n[0],n[2]);
      angles.nod=Math.atan2(-n[1],Math.hypot(n[0],n[2]));
      angles.lean=-Math.asin(clamp(x[1]/length,-1,1));
      angles.eyeDepth=length;
    }
  }
  return {...angles,depth:span,smileL:s.mouthSmileRight??0,smileR:s.mouthSmileLeft??0,pucker:Math.max(s.mouthPucker||0,(s.mouthFunnel||0)*.78),gazeX:(a[0]+b[0])*.5,gazeY:(a[1]+b[1])*.5,browL:((s.browOuterUpRight||0)*.65+(s.browInnerUp||0)*.35)-(s.browDownRight||0)*.6,browR:((s.browOuterUpLeft||0)*.65+(s.browInnerUp||0)*.35)-(s.browDownLeft||0)*.6,
    blinkL:s.eyeBlinkRight??clamp(1-orient(159,145)/.065,0,1),blinkR:s.eyeBlinkLeft??clamp(1-orient(386,374)/.065,0,1),jaw:s.jawOpen??clamp(orient(13,14)*2.8,0,1),roll:angle,yaw:((nose.x-c.x)*cs+(nose.y-c.y)*sn)/span,pitch:((nose.y-c.y)*cs-(nose.x-c.x)*sn)/span};
}
export function relativePose(now,base,gain){
  const a=resting();if(!now||!base)return a;
  for(const k of ['browL','browR'])a[k]=clamp((now[k]-base[k])*gain*2.0,-1,1);
  for(const k of ['blinkL','blinkR','jaw'])a[k]=clamp((now[k]-base[k])*gain/Math.max(.28,1-base[k]),0,1);
  a.jaw=clamp(a.jaw*1.45,0,1);a.roll=clamp(-radians(now.roll-base.roll)*3.1*gain,-1,1);
  a.yaw=clamp(-(now.yaw-base.yaw)*4.5*gain,-1,1);a.pitch=clamp((now.pitch-base.pitch)*4.3*gain,-1,1);
  for(const k of ['smileL','smileR','pucker'])a[k]=clamp(((now[k]??0)-(base[k]??0))*gain*1.45,0,1);
  a.gazeX=clamp(-((now.gazeX??0)-(base.gazeX??0))*7*gain,-1,1);a.gazeY=clamp(((now.gazeY??0)-(base.gazeY??0))*8*gain,-1,1);
  a.depth=base.depth>0?clamp(Math.log(Math.max(.03,now.depth)/base.depth)*2.8*gain,-1,1):0;
  if(Number.isFinite(now.turn)&&Number.isFinite(base.turn)){
    const visible=1-.85*ease((Math.abs(now.turn)-.66)/.57);
    a.gazeX*=visible;a.gazeY*=visible;
    a.yaw=clamp(-radians(now.turn-base.turn)*gain/1.38,-1,1);
    a.pitch=clamp(radians(now.nod-base.nod)*gain/.72,-1,1);
    a.roll=clamp(radians(now.lean-base.lean)*gain/.60,-1,1);
    if(now.eyeDepth>0 && base.eyeDepth>0)a.depth=clamp(Math.log(now.eyeDepth/base.eyeDepth)*2.8*gain,-1,1);
    if(now.distance>0 && base.distance>0)a.depth=clamp(Math.log(now.distance/base.distance)*2.8*gain,-1,1);
  }
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
      for(let j=0;j<3;j++){const a=tri.ids[j],b=tri.ids[(j+1)%3],key=Math.min(a,b)*(n+3)+Math.max(a,b);if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}
    for(const [a,b] of edges.values()){const c=circle(pts[a],pts[b],p);if(c)kept.push({ids:[a,b,i],c});}tris=kept;
  }
  return new Uint16Array(tris.filter(t=>t.ids.every(i=>i<n)).flatMap(t=>t.ids));
}
export {handPoints} from './hand3d.mjs?v=649a3cd4e5';
function buildFaceWeights(p,face,aspect){
  if(!face?.landmarks?.[454])return null;
  const L=face.landmarks,at=i=>({x:L[i].x,y:L[i].y*aspect}),left=at(33),right=at(263),origin=mid(left,right);
  const theta=Math.atan2(right.y-left.y,right.x-left.x),cs=Math.cos(theta),sn=Math.sin(theta),W=Math.max(.025,hypot(at(234),at(454)));
  const local=q=>({x:((q.x-origin.x)*cs+(q.y-origin.y)*sn)/W,y:((q.y-origin.y)*cs-(q.x-origin.x)*sn)/W});
  const n=i=>local(at(i)),v=local(p),nose=n(1),chin=n(152),top=n(10),mouth=mid(n(13),n(14));
  const faceCenter=(top.y+chin.y)*.5,headH=Math.max(.45,(chin.y-top.y)*.52);
  const radial=Math.hypot(v.x/.57,(v.y-faceCenter)/headH);const head=ease((1.34-radial)/.48);
  if(head<.0001)return null;
  function eye(outer,inner,upper,lower,brow,iris){
    const center=mid(n(upper),n(lower)),half=Math.max(.038,Math.abs(n(outer).x-n(inner).x)/2),gap=Math.max(.019,Math.abs(n(lower).y-n(upper).y)),b=n(brow);
    const lid=clamp(center.y-v.y,-gap*.56,gap*.56)*ease((1.30-Math.abs((v.x-center.x)/half))/.62)*ease((3.8-Math.abs((v.y-center.y)/gap))/2.9);
    const pupil=L[iris]?n(iris):center;
    const sclera=ease((1.02-Math.abs((v.x-center.x)/half))/.44)*ease((1.60-Math.abs((v.y-center.y)/gap))/.98);
    const gaze=sclera*gauss(v.x-pupil.x,v.y-pupil.y,half*.60,gap*.70);
    return {lid,brow:-.082*gauss(v.x-b.x,v.y-b.y,half*.83,.061),gazeX:gaze*half*.34,gazeY:gaze*gap*.29};
  }
  const eL=eye(33,133,159,145,105,468),eR=eye(263,362,386,374,334,473);
  const leftLip=n(61),rightLip=n(291),mouthWidth=Math.max(.09,hypot(leftLip,rightLip)*.5);
  const lipX=clamp((v.x-mouth.x)/mouthWidth,-1,1),corner=lipX<0?leftLip:rightLip;
  const seam=mouth.y+(corner.y-mouth.y)*Math.abs(lipX)**1.6;
  const opening=.058*ease((v.y-seam+.0015)/.006)*gauss(v.x-mouth.x,v.y-mouth.y-.025,mouthWidth*.62,.12);
  const jaw=opening+.032*ease((v.y-mouth.y+.018)/.17)*gauss(v.x-mouth.x,v.y-mouth.y-.15,mouthWidth*1.8,.25);
  const noseFall=gauss(v.x-nose.x,v.y-nose.y,.31,.38);
  const smileL=gauss(v.x-leftLip.x,v.y-leftLip.y,mouthWidth*.65,.093),smileR=gauss(v.x-rightLip.x,v.y-rightLip.y,mouthWidth*.65,.093);
  const pucker=gauss(v.x-mouth.x,v.y-mouth.y,mouthWidth*1.08,.091);
  return {cs,sn,W,v,head,eL,eR,jaw,noseFall,smileL,smileR,pucker,mouth};
}
export function makeRig(face,hands,aspect,mask=null,pose=null){
  const pts=[],seen=new Set();function add(x,y){if(!Number.isFinite(x+y)||x<0||x>1||y<0||y>aspect)return;const key=Math.round(x*8000)+','+Math.round(y*8000);if(!seen.has(key)){seen.add(key);pts.push({x,y});}}
  const nx=25,ny=clamp(Math.ceil(25*aspect),12,49);for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)add(i/nx,j/ny*aspect);
  face?.landmarks?.forEach(p=>{if(p)add(p.x,p.y*aspect);});
  const palms=hands.map(h=>handPoints(h,aspect));
  palms.forEach(hand=>{const radius=hypot(hand[0],hand[9])*.11;for(const p of hand){add(p.x,p.y);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])add(p.x+radius*dx,p.y+radius*dy);}});
  // Place vertices down each visible limb and on either side of the bone.
  // Even a narrow arm in a group photo gets several independently movable triangles.
  if(pose?.landmarks?.length===33){
    const l=pose.landmarks,span=Math.hypot(l[11].x-l[12].x,(l[11].y-l[12].y)*aspect);
    for(const [i,j,width] of [[11,12,.18],[11,13,.11],[13,15,.075],[12,14,.11],[14,16,.075],[11,23,.14],[12,24,.14],[23,24,.15],[23,25,.145],[24,26,.145],[25,27,.1],[26,28,.1],[27,31,.075],[28,32,.075]]){
      const a=l[i],b=l[j];if((a.visibility??1)<.45||(b.visibility??1)<.45)continue;
      const dx=b.x-a.x,dy=(b.y-a.y)*aspect,len=Math.hypot(dx,dy);
      if(len<.002)continue;
      const r=Math.min(len*.29,span*width);
      for(let step=0;step<=4;step++)for(const side of [-1,0,1]){
        add(a.x+dx*step/4-side*r*dy/len,a.y*aspect+dy*step/4+side*r*dx/len);
      }
    }
  }
  if(mask?.data){const coverage=mask.data.reduce((sum,n)=>sum+(n>75?1:0),0)/mask.data.length;
    const nose=face?.landmarks?.[1];const center=nose?mask.data[clamp(Math.round(nose.y*(mask.height-1)),0,mask.height-1)*mask.width+clamp(Math.round(nose.x*(mask.width-1)),0,mask.width-1)]:255;
    if(coverage<.006||coverage>.997||center<16)mask=null;}
  function opacity(x,y){if(!mask?.data)return 1;const ix=clamp(Math.round(x*(mask.width-1)),0,mask.width-1),iy=clamp(Math.round(y/aspect*(mask.height-1)),0,mask.height-1);return mask.data[iy*mask.width+ix]/255;}
  // Extra stationary vertices on either side of the person silhouette preserve surrounding details.
  if(mask?.data){for(let y=1;y<56;y++)for(let x=1;x<56;x++){const px=x/56,py=y/56*aspect,v=opacity(px,py);if(Math.abs(v-opacity((x-1)/56,py))>.53||Math.abs(v-opacity(px,(y-1)/56*aspect))>.53)add(px,py);}}
  const indices=triangulate(pts,aspect);
  const weights=pts.map(p=>{
    if(p.x<.00001||p.x>.99999||p.y<.00001||p.y>aspect-.00001)return null;
    const faceData=buildFaceWeights(p,face,aspect);
    const handData=palms.map((hand,i)=>handInfluence(p,hand,hands[i].active,Math.max(.018,hypot(hand[0],hand[9]))));
    // Thin fingertips can disappear from the coarse silhouette. Preserve their exact anchors.
    const fingerSupport=handData.reduce((best,binding)=>Math.max(best,binding?binding.reduce((sum,pair)=>sum+pair[1],0):0),0);
    const support=Math.max(ease((opacity(p.x,p.y)-.07)/.67),Math.min(1,fingerSupport)**3);
    return {faceData,handData,support};
  });
  const source=new Float32Array(pts.flatMap(p=>[p.x,p.y/aspect]));const dest=new Float32Array(source.length);
  function deform(pose,targets){
    for(let i=0;i<pts.length;i++){
      const p=pts[i],w=weights[i];let dx=0,dy=0;
      if(w?.faceData){const {cs,sn,W,v,head,eL,eR,jaw,noseFall,smileL,smileR,pucker,mouth}=w.faceData;
        const roll=pose.roll*.22,px=v.x,py=v.y-.34;
        const yaw=(pose.yaw||0)*.34,pitch=(pose.pitch||0)*.23,depth=(pose.depth||0)*.125;
        const z=.24*noseFall+.055*head,smL=(pose.smileL||0)*smileL,smR=(pose.smileR||0)*smileR,round=(pose.pucker||0)*pucker;
        const ex=eL.gazeX*(1-pose.blinkL)+eR.gazeX*(1-pose.blinkR),ey=eL.gazeY*(1-pose.blinkL)+eR.gazeY*(1-pose.blinkR);
        const a=((Math.cos(roll)-1)*px-Math.sin(roll)*py+px*(Math.cos(yaw)-1)+px*depth+Math.sin(yaw)*z)*head+(pose.gazeX||0)*ex+(.059*smR-.059*smL)-(v.x-mouth.x)*round*.36;
        const b=(Math.sin(roll)*px+(Math.cos(roll)-1)*py+py*(Math.cos(pitch)-1)+py*depth+Math.sin(pitch)*z)*head+pose.blinkL*eL.lid+pose.blinkR*eR.lid+pose.browL*eL.brow+pose.browR*eR.brow+pose.jaw*jaw+(pose.gazeY||0)*ey-.073*(smL+smR)+(v.y-mouth.y)*round*.28;
        dx+=(a*cs-b*sn)*W;dy+=(a*sn+b*cs)*W;}
      w?.handData.forEach((weights,j)=>{if(!weights||!targets[j])return;for(const [idx,weight] of weights){dx+=(targets[j][idx].x-palms[j][idx].x)*weight;dy+=(targets[j][idx].y-palms[j][idx].y)*weight;}});
      const support=w?.support??1;dest[2*i]=p.x+dx*support;dest[2*i+1]=(p.y+dy*support)/aspect;
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
  const mouth=[at(61),at(291)],jaw=[at(13),at(14)],eyeOpen=[{a:at(159),b:at(145),outer:at(33),inner:at(133)},{a:at(386),b:at(374),outer:at(263),inner:at(362)}];
  return {mouthWidth:hypot(...mouth)/W,jawGap:hypot(...jaw)/Math.max(.001,hypot(...mouth)),eyeOpen:eyeOpen.map(e=>hypot(e.a,e.b)/Math.max(.001,hypot(e.outer,e.inner))),ratio:W/H,eyeRatio:hypot(...eyes)/W,tilt:Math.atan2(eyes[1].y-eyes[0].y,eyes[1].x-eyes[0].x)*180/Math.PI,lines:[cheeks,height,eyes,mouth,...eyeOpen.map(e=>[e.a,e.b])]};
}

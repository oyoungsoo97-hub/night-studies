const clip=(n,min,max)=>Math.max(min,Math.min(max,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const offset=(p,dx,dy)=>({x:p.x+dx,y:p.y+dy});
export function faceBox(face){const pts=face.landmarks.filter(p=>p&&Number.isFinite(p.x+p.y));if(!pts.length)return null;const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);const x=Math.min(...xs),y=Math.min(...ys);return{x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};}
export function closeFace(faces,point){if(!faces?.length)return null;if(!point)return faces[0];return faces.reduce((best,face)=>dist(face.landmarks[1],point)<dist(best.landmarks[1],point)?face:best);}
export function faceRegion(face,others){const r=faceBox(face),p=face.landmarks[1];const next=others.filter(f=>f!==face).map(f=>Math.abs(f.landmarks[1].x-p.x)).sort((a,b)=>a-b)[0]??1;
  const x=Math.max(0,r.x-Math.min(r.width*.95,next*.24)),y=Math.max(0,r.y-r.height*.43);return{x,y,width:Math.min(1-x,r.width+2*Math.min(r.width*.95,next*.24)),height:Math.min(1-y,r.height*3.7)};}
export function refinedFace(marks,aspect,makeBasic){
  if(marks.length===2)return makeBasic(marks[0],marks[1],aspect);
  if(marks.length!==5)throw Error('anchors');
  const [left,right,lipsL,lipsR,chin]=marks,eyeMid=mid(left,right),eyeDist=dist({x:left.x,y:left.y*aspect},{x:right.x,y:right.y*aspect});
  if(eyeDist<.012||dist(lipsL,lipsR)<.009||dist(eyeMid,chin)<.018)throw Error('anchors');
  const result=makeBasic(eyeMid,chin,aspect),L=result.landmarks;
  const axis={x:(right.x-left.x)/eyeDist,y:(right.y-left.y)*aspect/eyeDist};const down={x:-axis.y,y:axis.x};
  const from=(center,x,y)=>offset(center,(x*axis.x+y*down.x)*eyeDist,(x*axis.y+y*down.y)*eyeDist/aspect);
  function eye(center,outer,inner,upper,lower,brow,index,side){L[outer]=from(center,side*.27,0);L[inner]=from(center,-side*.27,0);L[upper]=from(center,0,-.072);L[lower]=from(center,0,.055);L[brow]=from(center,0,-.255);L[index]=center;for(let i=0;i<4;i++)L[index+i+1]=from(center,Math.cos(i*Math.PI/2)*.085,Math.sin(i*Math.PI/2)*.069);}
  eye(left,33,133,159,145,105,468,-1);eye(right,263,362,386,374,334,473,1);
  const mouth=mid(lipsL,lipsR);L[61]=lipsL;L[291]=lipsR;L[13]=from(mouth,0,-.009);L[14]=from(mouth,0,.009);L[1]=mid(eyeMid,mouth);
  return result;
}
export function tracedHand(marks,aspect){
  if(!Array.isArray(marks)||marks.length!==6||!marks[0]||!marks.slice(1).some(Boolean))throw Error('hand');
  const at=p=>({x:p.x,y:p.y*aspect}),wrist=at(marks[0]),tips=marks.slice(1).map(p=>p?at(p):null),seen=tips.filter(Boolean);
  const center=seen.reduce((a,p)=>({x:a.x+p.x/seen.length,y:a.y+p.y/seen.length}),{x:0,y:0});const length=dist(wrist,center);if(length<.017||seen.some(p=>dist(wrist,p)<.010))throw Error('hand');
  const u={x:(center.x-wrist.x)/length,y:(center.y-wrist.y)/length},across={x:-u.y,y:u.x};const direction=tips[0]&&tips[4]?Math.sign((tips[4].x-tips[0].x)*across.x+(tips[4].y-tips[0].y)*across.y)||1:1;
  const weights=[-.43,-.19,0,.17,.34],landmarks=[marks[0]],active=[0];
  for(let f=0;f<5;f++){
    const side=weights[f]*length*direction;const tip=tips[f]||{x:center.x+side*across.x,y:center.y+side*across.y};
    [.45,.66,.84,1].forEach((t,j)=>{const baseBias=(1-t)*.19*side;const p={x:wrist.x+(tip.x-wrist.x)*t+across.x*baseBias,y:(wrist.y+(tip.y-wrist.y)*t+across.y*baseBias)/aspect};landmarks.push(p);if(tips[f])active.push(1+f*4+j);});
  }return {landmarks,active,handedness:'',manual:true};
}
export function rigHands(detected,traces,aspect){
  const out=[...detected];for(const marks of traces){const item=tracedHand(marks,aspect),w=item.landmarks[0],nearest=out.map((h,i)=>({i,d:Math.hypot(w.x-h.landmarks[0].x,(w.y-h.landmarks[0].y)*aspect)})).sort((a,b)=>a.d-b.d)[0];if(nearest&&(nearest.d<.12||out.length===2))out[nearest.i]=item;else out.push(item);}
  return out.slice(0,2).sort((a,b)=>a.landmarks[0].x-b.landmarks[0].x);
}
export function smoothPose(previous,target,dt,missing=false){
  const result={};dt=clip(dt,.001,.25);
  for(const [key,dest] of Object.entries(target)){const current=previous[key]||0,delta=dest-current,blink=key.startsWith('blink');
    // Retain fast closures and intentional large movements; settle sub-percent noise at rest.
    const dead=missing?0:blink?.012:key.startsWith('gaze')?.024:.015;
    const actual=Math.abs(delta)<dead?(Math.abs(dest)<dead?0:current):dest;
    const tau=missing?.24:blink?(dest>current?.024:.052):.115/(1+4*Math.abs(delta));
    result[key]=current+(actual-current)*(1-Math.exp(-dt/tau));
  }return result;
}
export function smoothPoints(prev,next,dt){if(!prev||prev.length!==next.length)return next;return next.map((p,i)=>{const a=prev[i],change=dist(a,p);const t=1-Math.exp(-clip(dt,.001,.18)/(.087/(1+14*change)));return {x:a.x+(p.x-a.x)*t,y:a.y+(p.y-a.y)*t};});}
export function handInfluence(p,hand,active,span){
  // Bind each non-palm point to its nearest finger segment. Adjacent fingers can articulate independently.
  const allowed=active?new Set(active):null;let best=null;
  for(let finger=0;finger<5;finger++){const chain=[0,1+4*finger,2+4*finger,3+4*finger,4+4*finger];
    for(let i=1;i<chain.length;i++){const a=chain[i-1],b=chain[i];if(allowed&&!allowed.has(b))continue;const u=hand[a],v=hand[b],x=v.x-u.x,y=v.y-u.y,len=x*x+y*y;
      const t=clip(((p.x-u.x)*x+(p.y-u.y)*y)/Math.max(.000001,len),0,1),d=Math.hypot(p.x-u.x-x*t,p.y-u.y-y*t);const radius=span*(i===1?.43:i===2?.26:.19);
      if(!best||d/radius<best.score)best={a,b,t,d,radius,score:d/radius};}}
  if(!best)return null;const fade=t=>{const v=clip(t,0,1);return v*v*(3-2*v);};const coverage=fade((1.65-best.score)/.95);
  const wristFade=(1-coverage)*fade((span*1.42-dist(p,hand[0]))/(span*1.15));if(!coverage&&!wristFade)return null;
  return [[best.a,(1-best.t)*coverage],[best.b,best.t*coverage],[0,wristFade]];
}

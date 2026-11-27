// All joint lengths are measured on the uploaded subject. Coordinates use image widths on all axes.
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const norm=a=>Math.hypot(a.x,a.y,a.z);
const unit=(a,fallback)=>norm(a)>1e-7?scale(a,1/norm(a)):fallback;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const turn=a=>Math.atan2(Math.sin(a),Math.cos(a));
const forward={x:0,y:-1,z:0},across={x:1,y:0,z:0};
function palm(p){
  const y=unit(minus(p[9],p[0]),forward),edge=minus(p[17],p[5]);
  let x=unit(minus(edge,scale(y,dot(edge,y))),null);
  if(!x)x=unit(cross(y,{x:0,y:0,z:1}),across);
  return {x,y,z:cross(x,y)};
}
function local(v,b){return {x:dot(v,b.x),y:dot(v,b.y),z:dot(v,b.z)};}
function world(v,b){return add(add(scale(b.x,v.x),scale(b.y,v.y)),scale(b.z,v.z));}
const place=(p,i,b)=>local(minus(p[i],p[0]),b);
function fingerFrame(p,i,b){
  const aim=local(minus(p[i+1],p[i]),b);
  const y=unit({x:aim.x,y:aim.y,z:0},{x:0,y:1,z:0});
  return {y:world(y,b),x:world({x:y.y,y:-y.x,z:0},b),z:b.z};
}
function angles(p,i,b){
  const q=local(minus(p[i+1],p[i]),b);
  return {flex:Math.atan2(q.z,q.y),side:Math.asin(clamp(q.x/Math.max(1e-8,norm(q)),-1,1)),length:norm(q)};
}
function vector(a,s,length,b){
  return world({x:length*Math.sin(s),y:length*Math.cos(s)*Math.cos(a),z:length*Math.cos(s)*Math.sin(a)},b);
}
export function handPoints(hand,aspect){
  return (hand.landmarks||hand).map((pt,i)=>{
    const p={x:pt.x,y:pt.y*aspect,z:pt.z??0},m=hand.worldLandmarks?.[i];
    if(m&&Number.isFinite(m.x+m.y+m.z))Object.assign(p,{mx:m.x,my:m.y,mz:m.z});
    return p;
  });
}
export function photoHand(points){
  if(points.every(p=>Number.isFinite(p.bindDepth)))return points.map(p=>({x:p.x,y:p.y,z:p.bindDepth}));
  const wrist=points[0],extent=Math.max(.005,Math.hypot(points[9].x-wrist.x,points[9].y-wrist.y));
  let scale=0;
  if(points.every(p=>Number.isFinite(p.mx+p.my+p.mz))){
    let projected=0,metric=0;
    for(const i of [1,5,9,13,17]){
      const p=points[i],dx=p.mx-wrist.mx,dy=p.my-wrist.my;
      projected+=dx*(p.x-wrist.x)+dy*(p.y-wrist.y);metric+=dx*dx+dy*dy;
    }
    if(metric>1e-8)scale=clamp(projected/metric,0,12);
  }
  return points.map(p=>({x:p.x,y:p.y,z:scale>0?-(p.mz-wrist.mz)*scale:
    clamp(-.69*((p.z||0)-(wrist.z||0)),-extent*.65,extent*.78)}));
}
// Solve one thumb saddle joint and four hinge chains in palm space. The digit bases belong
// to the rigid palm. PIP and DIP flexion can point through the picture plane.
function solve(source,root,orient,controls){
  const original=palm(source),out=[root];
  for(let f=0;f<5;f++){
    const base=1+4*f,ref=fingerFrame(source,base,original);
    const moved={x:world(local(ref.x,original),orient),y:world(local(ref.y,original),orient),z:orient.z};
    out[base]=add(root,world(place(source,base,original),orient));
    let bend=0,pip=0,spread=0;
    for(let j=0;j<3;j++){
      const a=angles(source,base+j,ref),delta=controls(f,j);
      let joint=clamp(delta.flex,-1.38,1.38);
      if(j===1)pip=joint;
      if(j===2&&f>0)joint=clamp(joint,Math.min(0,pip)*.88-.16,Math.max(0,pip)*.88+.16);
      bend=clamp(bend+joint,-2.7,2.7);
      // Flex at each knuckle. Most finger abduction belongs at the base.
      if(j===0)spread=clamp(delta.side,f===0?-.60:-.11,f===0?.60:.11);
      const lateral=spread+(j?clamp(delta.side-spread,-.028,.028):0);
      out[base+j+1]=add(out[base+j],vector(a.flex+bend,a.side+lateral,a.length,moved));
    }
  }
  return out;
}
function changes(points,basis,f,j,reference){
  const first=1+4*f,fr=reference||fingerFrame(points,first,basis);
  const angle=angles(points,first+j,fr),prior=j?angles(points,first+j-1,fr).flex:0;
  return {flex:turn(angle.flex-prior),side:angle.side};
}
export function fitHandPose(source,target){
  const a=palm(source),b=palm(target);
  return solve(source,target[0],b,(f,j)=>{
    const ref=fingerFrame(source,1+4*f,a),adjusted={x:world(local(ref.x,a),b),y:world(local(ref.y,a),b),z:b.z};
    const old=changes(source,a,f,j,ref),next=changes(target,b,f,j,adjusted);
    return {flex:turn(next.flex-old.flex),side:next.side-old.side};
  });
}
const breadth=p=>Math.max(.0001,norm(minus(p[5],p[17])));
const tipGap=p=>norm(minus(p[4],p[8]))/breadth(p);
function opposeThumb(points,desired){
  const gap=minus(points[8],points[4]),distance=norm(gap),width=breadth(points);
  const close=Math.min(.36*width,distance-desired*width);
  if(close<=0||distance<1e-8)return;
  // Nudge the two tips together while keeping each phalanx at its bind length.
  for(const [root,share] of [[1,.72],[5,-.28]]){
    const anchor=points[root],lengths=[0,1,2].map(i=>norm(minus(points[root+i+1],points[root+i])));
    const goal=add(points[root+3],scale(gap,share*close/distance));
    for(let pass=0;pass<5;pass++){
      points[root+3]=goal;
      for(let i=2;i>=0;i--){const k=root+i;points[k]=add(points[k+1],scale(unit(minus(points[k],points[k+1]),forward),lengths[i]));}
      points[root]=anchor;
      for(let i=0;i<3;i++){const k=root+i;points[k+1]=add(points[k],scale(unit(minus(points[k+1],points[k]),forward),lengths[i]));}
    }
  }
}
export function driveHand(original,current,baseline,gain,mirror){
  if(!current||!baseline)return null;
  const source=photoHand(original),sign=mirror?-1:1;
  const metric=[current,baseline].every(set=>set.every(p=>Number.isFinite(p.mx+p.my+p.mz)));
  const coords=points=>points.map(p=>metric?{x:sign*p.mx,y:p.my,z:-p.mz}:{x:sign*p.x,y:p.y,z:-(p.z||0)});
  const live=coords(current),neutral=coords(baseline),a=palm(neutral),b=palm(live),s=palm(source);
  const gainAxis=v=>unit(add(v,scale(minus(world(local(v,a),b),v),clamp(gain,0,1.25))),v);
  const y=gainAxis(s.y),z=unit(cross(gainAxis(s.x),y),s.z),orient={x:cross(y,z),y,z};
  const reach=Math.max(.023,norm(minus(source[0],source[9]))*.56);
  const delta={x:sign*(current[0].x-baseline[0].x),y:current[0].y-baseline[0].y};
  const root=add(source[0],{x:clamp(delta.x*gain,-reach,reach),y:clamp(delta.y*gain,-reach,reach),z:0});
  const out=solve(source,root,orient,(f,j)=>{
    const first=1+4*f,ref=fingerFrame(neutral,first,a),mov={x:world(local(ref.x,a),b),y:world(local(ref.y,a),b),z:b.z};
    const old=changes(neutral,a,f,j,ref),next=changes(live,b,f,j,mov);
    return {flex:turn(next.flex-old.flex)*gain,side:turn(next.side-old.side)*gain};
  });
  const gap=tipGap(live),startingGap=tipGap(neutral);
  if(gap<.82&&gap<startingGap-.12)opposeThumb(out,Math.max(.065,tipGap(source)+(gap-startingGap)*gain));
  return out.map((p,i)=>({...original[i],x:p.x,y:p.y,dz:p.z-source[i].z}));
}
export function curlJoints(start,amount){
  const b=palm(start),sign=Math.sign(b.z.z)||1;
  return solve(start,start[0],b,(f,j)=>({flex:amount*sign*(f===0?[.32,.48,.27]:[.54,.82,.53])[j],side:f===0?amount*.15:0}));
}
export function curlHand(original,amount){
  if(!amount)return null;
  const source=photoHand(original),start=source.map((p,i)=>({...p,z:p.z+(original[i].dz||0)}));
  const out=curlJoints(start,amount);
  return out.map((p,i)=>({...original[i],x:p.x,y:p.y,dz:p.z-source[i].z}));
}

// Absolute, unmirrored performance capture. The palm keeps its bind shape and
// each phalanx keeps its length while following the recorded 3D bone direction.
export function measuredHand(source,observed){
  const a=palm(source),b=palm(observed),out=[source[0]];
  for(let f=0;f<5;f++){
    const start=1+4*f;
    out[start]=add(out[0],world(place(source,start,a),b));
    for(let j=start;j<start+3;j++){
      const bone=minus(source[j+1],source[j]);
      const axis=unit(minus(observed[j+1],observed[j]),unit(bone,b.y));
      out[j+1]=add(out[j],scale(axis,norm(bone)));
    }
  }
  const gap=tipGap(observed);
  if(gap<.82)opposeThumb(out,Math.max(.065,gap));
  return out.map((p,i)=>({x:p.x,y:p.y,dz:p.z-source[i].z,measured:true}));
}

export function registerRestHand(aim,observed,length){
  const source=observed.map(([x,y,z])=>({x,y,z:-z})),a=palm(source),b=palm(aim);
  const scaleHand=length/Math.max(.001,norm(minus(source[12],source[0])));
  const posed=source.map((p,i)=>add(aim[0],scale(world(place(source,i,a),b),scaleHand)));
  return curlJoints(posed,.19);
}

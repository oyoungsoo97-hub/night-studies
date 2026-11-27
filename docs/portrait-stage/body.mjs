// Bone rotations are measured relative to the performer's own rest pose, then applied to the photograph.
const clip=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const ease=n=>{const x=clip(n,0,1);return x*x*(3-2*x);};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const center=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const at=(points,i,aspect)=>({x:points[i].x,y:points[i].y*aspect});
const visible=p=>p && Number.isFinite(p.x+p.y) && (p.visibility??1)>.45;
const partner=[0,4,5,6,1,2,3,8,7,10,9,12,11,14,13,16,15,18,17,20,19,22,21,24,23,26,25,28,27,30,29,32,31];
const chain=[[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32]];
function skeleton(input){const points=input?.landmarks||input;return points?.length===33 && visible(points[11])&&visible(points[12])?points:null;}
function mirror(points){return partner.map(i=>({...points[i],x:1-points[i].x}));}
function angularDelta(a,b,c,d){const theta=Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(d.y-c.y,d.x-c.x);return Math.atan2(Math.sin(theta),Math.cos(theta));}
function turn(p,r){const cs=Math.cos(r),sn=Math.sin(r);return {x:p.x*cs-p.y*sn,y:p.x*sn+p.y*cs};}
export function bodyMotion(sourcePose,livePose,neutralPose,strength,sourceAspect,videoAspect){
  const S=skeleton(sourcePose),raw=skeleton(livePose),rest=skeleton(neutralPose);
  if(!S||!raw||!rest||!strength)return null;
  const C=mirror(raw),B=mirror(rest),gain=clip(strength,0,1.8);
  const s=S.map((_,i)=>at(S,i,sourceAspect)),c=C.map((_,i)=>at(C,i,videoAspect)),b=B.map((_,i)=>at(B,i,videoAspect));
  const shoulders=center(s[11],s[12]),sc=dist(s[11],s[12])/Math.max(.05,dist(b[11],b[12]));
  const centreDelta=(a,prev)=>clip((a-prev)*sc*gain,-.16,.16);
  const current=center(c[11],c[12]),baseline=center(b[11],b[12]);
  const dx=centreDelta(current.x,baseline.x),dy=centreDelta(current.y,baseline.y);
  const roll=clip(angularDelta(c[11],c[12],b[11],b[12])*gain,-.55,.55);
  const out=s.map(p=>{
    const d=turn({x:p.x-shoulders.x,y:p.y-shoulders.y},roll);
    return {x:shoulders.x+d.x+dx,y:shoulders.y+d.y+dy};
  });
  for(const i of [23,24]){
    if(visible(C[i])&&visible(B[i])&&visible(S[i]))out[i]={x:s[i].x+centreDelta(c[i].x,b[i].x),y:s[i].y+centreDelta(c[i].y,b[i].y)};
  }
  for(const [a,j] of chain){
    if(![a,j].every(i=>visible(C[i])&&visible(B[i])&&visible(S[i])))continue;
    const angle=clip(angularDelta(c[a],c[j],b[a],b[j])*gain,-1.32,1.32);
    const d=turn({x:s[j].x-s[a].x,y:s[j].y-s[a].y},angle);
    const ratio=clip(dist(c[a],c[j])/Math.max(.025,dist(b[a],b[j])),.70,1.18);
    const stretch=1+(ratio-1)*Math.min(gain,1);
    out[j]={x:out[a].x+d.x*stretch,y:out[a].y+d.y*stretch};
  }
  const range=dist(s[11],s[12])*.68;
  return out.map((p,i)=>{
    const delta=visible(C[i])&&visible(B[i])&&Number.isFinite(B[i].z-C[i].z)?(B[i].z-C[i].z)*sc*gain:0;
    return {x:clip(p.x,-4,5),y:clip(p.y/sourceAspect,-4,5),dz:clip(delta,-range,range)};
  });
}
export function makeBodyRig(pose,aspect,source,{hands=[]}={}){
  const l=skeleton(pose);
  if(!l)return {enabled:false,deform:dest=>dest};
  const points=l.map((_,i)=>at(l,i,aspect)),span=dist(points[11],points[12]);
  if(span<.02)return {enabled:false,deform:dest=>dest};
  // The shoulder bar transports the neck and head with the torso; expression offsets stay additive.
  const segments=[[11,12,.77],[11,23,.53],[12,24,.53],[23,24,.42],
    [11,13,.31],[12,14,.31],[13,15,.23],[14,16,.23],
    [23,25,.42],[24,26,.42],[25,27,.27],[26,28,.27],[27,31,.21],[28,32,.21]];
  const bones=segments.filter(([i,j])=>visible(l[i])&&visible(l[j])&&dist(points[i],points[j])>.012)
    .map(([a,b,factor])=>{const p=points[a],q=points[b],x=q.x-p.x,y=q.y-p.y;return {a,b,p,x,y,size:span*factor,length:x*x+y*y};});
  const matte=pose?.mask;
  const mask=matte?.data?.some(value=>value>80)?matte:null;
  const palms=hands.flatMap((hand,id)=>{
    if(hand.landmarks?.length!==21)return [];
    const pts=hand.landmarks.map((_,i)=>at(hand.landmarks,i,aspect));
    const wrist=[15,16].filter(i=>visible(l[i])).sort((a,b)=>dist(pts[0],points[a])-dist(pts[0],points[b]))[0];
    if(wrist===undefined||dist(pts[0],points[wrist])>Math.max(.045,span*.67))return [];
    const size=Math.max(.012,dist(pts[0],pts[9])),segments=[];
    for(let i=1;i<21;i++){
      if(hand.active&&!hand.active.includes(i))continue;
      const a=pts[i%4===1?0:i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y;
      segments.push({a,dx,dy,d2:Math.max(1e-8,dx*dx+dy*dy),radius:size*(i%4===1?.42:.21)});
    }
    return [{id,wrist,p:pts[0],segments}];
  });
  const weights=[],attached=[];
  for(let v=0;v<source.length;v+=2){
    const x=source[v],y=source[v+1]*aspect;
    const border=ease(Math.min(x,1-x,y,aspect-y)/Math.max(.008,span*.09));let cover=border;
    if(mask){const mx=clip(Math.floor(x*mask.width),0,mask.width-1),my=clip(Math.floor(y/aspect*mask.height),0,mask.height-1);
      cover*=ease((mask.data[my*mask.width+mx]/255-.07)/.81);
    }
    let attachment=null;
    for(const palm of palms){
      let proximity=0;
      for(const seg of palm.segments){
        const dx=x-seg.a.x,dy=y-seg.a.y,t=clip((dx*seg.dx+dy*seg.dy)/seg.d2,0,1);
        const d=Math.hypot(dx-t*seg.dx,dy-t*seg.dy)/seg.radius;
        proximity=Math.max(proximity,ease((1.7-d)/1.12));
      }
      if(proximity>(attachment?.proximity??0))attachment={palm,proximity};
    }
    if(attachment&&border>0){
      attached.push({v,palm:attachment.palm,weight:Math.max(cover,border*attachment.proximity**3)*attachment.proximity});
      cover*=1-attachment.proximity;
    }
    if(cover<.001){weights.push(null);continue;}
    const near=[];
    for(let i=0;i<bones.length;i++){
      const b=bones[i],u=x-b.p.x,v=y-b.p.y,t=clip((u*b.x+v*b.y)/b.length,0,1);
      const d=Math.hypot(u-t*b.x,v-t*b.y)/b.size;
      if(d<1.85)near.push({i,d});
    }
    near.sort((a,b)=>a.d-b.d);
    if(!near.length){weights.push(null);continue;}
    const local=near.slice(0,3),sum=local.reduce((r,b)=>r+1/(.065+b.d*b.d),0);
    cover*=ease((1.85-near[0].d)/1.08);
    weights.push(local.map(b=>[b.i,cover/((.065+b.d*b.d)*sum)]));
  }
  function deform(dest,targets,handTargets=[]){
    if(!targets||targets.length!==33)return dest;
    const m=bones.map(b=>{
      const p=at(targets,b.a,aspect),q=at(targets,b.b,aspect);
      const x=q.x-p.x,y=q.y-p.y;
      return {cs:(b.x*x+b.y*y)/b.length,sn:(b.x*y-b.y*x)/b.length,dx:p.x-b.p.x,dy:p.y-b.p.y};
    });
    for(let i=0;i<weights.length;i++){
      const local=weights[i];if(!local)continue;let x=0,y=0;
      for(const [id,weight] of local){const b=bones[id],a=m[id],u=source[2*i]-b.p.x,v=source[2*i+1]*aspect-b.p.y;
        x+=weight*(a.dx+(a.cs-1)*u-a.sn*v);y+=weight*(a.dy+a.sn*u+(a.cs-1)*v);
      }
      dest[2*i]+=x;dest[2*i+1]+=y/aspect;
    }
    // The arm sets the wrist position. Keep the finger bends from the hand solver,
    // subtracting the wrist translation it already applied so both ends stay joined.
    for(const {v,palm,weight} of attached){
      const i=palm.wrist,hand=handTargets[palm.id]?.[0];
      const hx=hand?hand.x-palm.p.x:0,hy=hand?hand.y-palm.p.y:0;
      dest[v]+=(targets[i].x-l[i].x-hx)*weight;
      dest[v+1]+=(targets[i].y-l[i].y-hy/aspect)*weight;
    }
    return dest;
  }
  return {enabled:bones.length>0,deform};
}

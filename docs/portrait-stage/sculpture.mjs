import {buildHead3D} from './head3d.mjs?v=da1a2754c5';
import {buildFigure3D} from './figure3d.mjs?v=d3f4851903';

export function normalsFor(points,triangles,out=new Float32Array(points.length)){
  out.fill(0);
  for(let t=0;t<triangles.length;t+=3){
    const a=triangles[t]*3,b=triangles[t+1]*3,c=triangles[t+2]*3;
    const ux=points[b]-points[a],uy=points[b+1]-points[a+1],uz=points[b+2]-points[a+2];
    const vx=points[c]-points[a],vy=points[c+1]-points[a+1],vz=points[c+2]-points[a+2];
    const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
    out[a]+=x;out[a+1]+=y;out[a+2]+=z;out[b]+=x;out[b+1]+=y;out[b+2]+=z;out[c]+=x;out[c+1]+=y;out[c+2]+=z;
  }
  for(let i=0;i<out.length;i+=3){
    const len=Math.hypot(out[i],out[i+1],out[i+2]);
    if(len>1e-10){out[i]/=len;out[i+1]/=len;out[i+2]/=len;}else out[i+2]=1;
  }
  return out;
}
function sampler(photo){
  const canvas=document.createElement('canvas'),k=Math.min(1,1400/Math.max(photo.naturalWidth,photo.naturalHeight));
  canvas.width=Math.max(1,Math.round(photo.naturalWidth*k));canvas.height=Math.max(1,Math.round(photo.naturalHeight*k));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(photo,0,0,canvas.width,canvas.height);
  const {width:w,height:h,data}=ctx.getImageData(0,0,canvas.width,canvas.height);
  return (x,y)=>{
    const i=4*(Math.max(0,Math.min(h-1,Math.round(y*(h-1))))*w+Math.max(0,Math.min(w-1,Math.round(x*(w-1)))));
    return [data[i]/255,data[i+1]/255,data[i+2]/255];
  };
}
export function buildSculpture(photo,{face,hands,pose,aspect}){
  const sample=sampler(photo),input={photo,aspect,face,hands,pose,mask:pose?.mask,sample};
  let head=buildHead3D({...input,joinNeck:true});
  const figure=buildFigure3D({...input,head});
  if(head&&figure?.neckStart==null)head=buildHead3D(input);
  // Update the head first so a moving jaw and the collar share exactly the same rim.
  const parts=[['Head',head],['Figure',figure]].filter(([,part])=>part);
  let count=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const [name,part] of parts){
    part.name=name;part.current=part.positions.slice();part.normals=normalsFor(part.positions,part.indices);
    count+=part.indices.length/3;
    for(let i=0;i<part.positions.length;i+=3)for(let d=0;d<3;d++){
      min[d]=Math.min(min[d],part.positions[i+d]);max[d]=Math.max(max[d],part.positions[i+d]);
    }
  }
  function smoothNeck(){
    if(figure?.neckStart==null)return;
    for(const [k,hi] of head.neckRing.entries()){
      const h=hi*3,b=(figure.neckStart+k)*3;
      const v=[0,1,2].map(d=>head.normals[h+d]+figure.normals[b+d]),mag=Math.hypot(...v)||1;
      for(let d=0;d<3;d++)head.normals[h+d]=figure.normals[b+d]=v[d]/mag;
    }
  }
  smoothNeck();
  if(!parts.length||![...min,...max].every(Number.isFinite))return null;
  const framing={min:[...min],max:[...max]};
  return {parts:parts.map(row=>row[1]),min,max,framing,count,photo,sample,
    update(frame){
      for(const [,p] of parts){p.pose(frame,p.current);normalsFor(p.current,p.indices,p.normals);}
      smoothNeck();
      // Expand the rest framing when a raised arm reaches beyond it. Replaying a
      // frozen pose must give exactly the same camera and PNG on every paint.
      for(let d=0;d<3;d++){framing.min[d]=min[d];framing.max[d]=max[d];}
      for(const [,part] of parts)for(let i=0;i<part.current.length;i+=3){
        for(let d=0;d<3;d++){
          const v=part.current[i+d];if(v<framing.min[d])framing.min[d]=v;
          else if(v>framing.max[d])framing.max[d]=v;
        }
      }
    }
  };
}

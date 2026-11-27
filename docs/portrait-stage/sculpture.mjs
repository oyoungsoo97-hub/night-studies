import {buildHead3D} from './head3d.mjs?v=609490ac35';
import {buildFigure3D} from './figure3d.mjs?v=2b025693aa';

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
  const parts=[['Figure',buildFigure3D(input)],['Head',buildHead3D(input)]].filter(([,part])=>part);
  let count=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const [name,part] of parts){
    part.name=name;part.current=part.positions.slice();part.normals=normalsFor(part.positions,part.indices);
    count+=part.indices.length/3;
    for(let i=0;i<part.positions.length;i+=3)for(let d=0;d<3;d++){
      min[d]=Math.min(min[d],part.positions[i+d]);max[d]=Math.max(max[d],part.positions[i+d]);
    }
  }
  if(!parts.length||![...min,...max].every(Number.isFinite))return null;
  return {parts:parts.map(row=>row[1]),min,max,count,photo,sample,
    update(frame){
      for(const [,p] of parts){p.pose(frame,p.current);normalsFor(p.current,p.indices,p.normals);}
    }
  };
}

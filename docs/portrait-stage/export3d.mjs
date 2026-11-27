// Bake the posed model to glTF. Only texels used by the fitted character go into the file.
const encoder=new TextEncoder();
const align=n=>(n+3)&~3;
const wait=()=>new Promise(resolve=>setTimeout(resolve,0));
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
function canvas(w,h){const el=document.createElement('canvas');el.width=w;el.height=h;return el;}
async function jpeg(el){const blob=await new Promise(resolve=>el.toBlob(resolve,'image/jpeg',.96));if(!blob)throw Error('texture');return new Uint8Array(await blob.arrayBuffer());}
function vertices(part,ids,model){
  const positions=[],normals=[];
  for(const i of ids){
    const j=i*3,p=part.current,n=part.normals;
    positions.push(p[j]-(model.min[0]+model.max[0])*.5,model.max[1]-p[j+1],p[j+2]);normals.push(n[j],-n[j+1],n[j+2]);
  }
  return {positions,normals};
}
function projectedMap(src,uv,ids){
  const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height,el=canvas(w,h),ctx=el.getContext('2d');
  ctx.fillStyle=ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();
  for(let i=0;i<ids.length;i+=3){
    const a=ids[i]*2,b=ids[i+1]*2,c=ids[i+2]*2;
    const positive=(uv[b]-uv[a])*(uv[c+1]-uv[a+1])>(uv[b+1]-uv[a+1])*(uv[c]-uv[a]);
    const j=positive?b:c,k=positive?c:b;
    ctx.moveTo(uv[a]*w,uv[a+1]*h);ctx.lineTo(uv[j]*w,uv[j+1]*h);ctx.lineTo(uv[k]*w,uv[k+1]*h);ctx.closePath();
  }
  ctx.fill();ctx.stroke();ctx.globalCompositeOperation='source-in';ctx.drawImage(src,0,0);
  ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#777';ctx.fillRect(0,0,w,h);return el;
}
async function blendMap(part,src,ids){
  // Isolate each partially projected triangle on a padded tile. This bakes the
  // same interpolated vertex colour and texture blend used by the live renderer.
  const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height,copy=canvas(w,h),read=copy.getContext('2d',{willReadFrequently:true});
  read.drawImage(src,0,0);const pixels=read.getImageData(0,0,w,h).data;
  const count=ids.length/3,cols=Math.ceil(Math.sqrt(count)),step=Math.max(6,Math.min(48,Math.floor(2048/cols))),rows=Math.ceil(count/cols);
  const W=step*cols,H=step*rows,pad=1.25,span=step-2*pad,el=canvas(W,H),ctx=el.getContext('2d'),im=ctx.createImageData(W,H),out=im.data,uv=[];
  for(let t=0;t<count;t++){
    const a=ids[t*3],b=ids[t*3+1],c=ids[t*3+2],left=(t%cols)*step,top=Math.floor(t/cols)*step;
    uv.push((left+pad)/W,(top+pad)/H,(left+step-pad)/W,(top+pad)/H,(left+pad)/W,(top+step-pad)/H);
    for(let y=0;y<step;y++)for(let x=0;x<step;x++){
      let B=Math.max(0,(x+.5-pad)/span),C=Math.max(0,(y+.5-pad)/span),A=Math.max(0,1-(x+.5-pad)/span-(y+.5-pad)/span);const sum=A+B+C;A/=sum;B/=sum;C/=sum;
      const u=part.uv[a*2]*A+part.uv[b*2]*B+part.uv[c*2]*C,v=part.uv[a*2+1]*A+part.uv[b*2+1]*B+part.uv[c*2+1]*C;
      const px=Math.max(0,Math.min(w-1,Math.round(u*(w-1)))),py=Math.max(0,Math.min(h-1,Math.round(v*(h-1))));
      const mix=part.plateMix?part.plateMix[a]*A+part.plateMix[b]*B+part.plateMix[c]*C:0;
      const offset=Math.round(w*(part.plateOffset||0));
      const first=4*(py*w+Math.min(w-1,px+Math.floor(mix)*offset)),second=4*(py*w+Math.min(w-1,px+Math.ceil(mix)*offset)),fraction=mix-Math.floor(mix);
      const f=Math.max(0,Math.min(1,part.photoWeight[a]*A+part.photoWeight[b]*B+part.photoWeight[c]*C)),dst=((top+y)*W+left+x)*4;
      for(let k=0;k<3;k++)out[dst+k]=(pixels[first+k]+fraction*(pixels[second+k]-pixels[first+k]))*f+255*(1-f)*(part.colors[a*3+k]*A+part.colors[b*3+k]*B+part.colors[c*3+k]*C);
      out[dst+3]=255;
    }
    if(t%512===511)await wait();
  }
  ctx.putImageData(im,0,0);return {el,uv};
}
export async function exportSculpture(model,attribution=null){
  const parts=model.parts.map(p=>({...p,current:p.current.slice(),normals:p.normals.slice()}));
  const gltf={asset:{version:'2.0',generator:'Portrait Loom',...attribution},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[],images:[],textures:[],materials:[],
    samplers:[{magFilter:9729,minFilter:9729,wrapS:33071,wrapT:33071}]};
  const chunks=[];let length=0;
  function view(data,target){
    const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset=align(length),v={buffer:0,byteOffset:offset,byteLength:bytes.byteLength};if(target)v.target=target;
    chunks.push({offset,bytes});length=offset+bytes.byteLength;return gltf.bufferViews.push(v)-1;
  }
  function accessor(array,size,bounds=false){
    const data=new Float32Array(array),a={bufferView:view(data,34962),componentType:5126,count:data.length/size,type:size===2?'VEC2':'VEC3'};
    if(bounds){a.min=Array(size).fill(Infinity);a.max=Array(size).fill(-Infinity);for(let i=0;i<data.length;i++){const k=i%size;a.min[k]=Math.min(a.min[k],data[i]);a.max[k]=Math.max(a.max[k],data[i]);}}
    return gltf.accessors.push(a)-1;
  }
  async function material(name,el){
    const pbr={metallicFactor:0,roughnessFactor:.83};
    if(el){const img=gltf.images.push({bufferView:view(await jpeg(el)),mimeType:'image/jpeg'})-1;pbr.baseColorTexture={index:gltf.textures.push({source:img,sampler:0})-1};}
    return gltf.materials.push({name,doubleSided:true,pbrMetallicRoughness:pbr})-1;
  }
  for(const p of parts){
    const pure=[],mixed=[],solid=[],src=p.texture||model.photo,primitives=[];
    for(let i=0;i<p.indices.length;i+=3){
      const a=p.indices[i],b=p.indices[i+1],c=p.indices[i+2],w=p.photoWeight;
      const hasOverlay=p.plateMix&&Math.max(p.plateMix[a],p.plateMix[b],p.plateMix[c])>.001;
      const group=!hasOverlay&&Math.min(w[a],w[b],w[c])>=.998?pure:Math.max(w[a],w[b],w[c])<.002?solid:mixed;
      group.push(a,c,b);
    }
    for(const ids of [pure,mixed,solid]){
      if(!ids.length)continue;const {positions,normals}=vertices(p,ids,model),attributes={POSITION:accessor(positions,3,true),NORMAL:accessor(normals,3)};let map;
      if(ids===solid){const color=[];for(const i of ids)for(let k=0;k<3;k++)color.push(linear(Math.max(0,Math.min(1,p.colors[3*i+k]))));attributes.COLOR_0=accessor(color,3);}
      else if(ids===pure){map=projectedMap(src,p.uv,ids);const uv=[];for(const i of ids)uv.push(p.uv[2*i],p.uv[2*i+1]);attributes.TEXCOORD_0=accessor(uv,2);}
      else{const baked=await blendMap(p,src,ids);map=baked.el;attributes.TEXCOORD_0=accessor(baked.uv,2);}
      primitives.push({attributes,material:await material(p.name,map)});await wait();
    }
    const mesh=gltf.meshes.push({name:p.name,primitives})-1;gltf.scenes[0].nodes.push(gltf.nodes.push({name:p.name,mesh})-1);
  }
  const binSize=align(length);gltf.buffers[0].byteLength=binSize;const json=encoder.encode(JSON.stringify(gltf)),jsonSize=align(json.length);
  const result=new Uint8Array(28+jsonSize+binSize),dv=new DataView(result.buffer),u32=(p,v)=>dv.setUint32(p,v,true);
  u32(0,0x46546c67);u32(4,2);u32(8,result.length);u32(12,jsonSize);u32(16,0x4e4f534a);result.fill(32,20,20+jsonSize);result.set(json,20);
  const b=20+jsonSize;u32(b,binSize);u32(b+4,0x004e4942);for(const {offset,bytes} of chunks)result.set(bytes,b+8+offset);
  return new Blob([result],{type:'model/gltf-binary'});
}

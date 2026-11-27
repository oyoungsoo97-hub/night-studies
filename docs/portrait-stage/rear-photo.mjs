// Keep the full photograph out of the project file. Save only the chosen crown-to-nape crop.
export function cropRearPhoto(image){
  const byId=id=>document.getElementById(id),dialog=byId('backDialog'),canvas=byId('backCrop'),ctx=canvas.getContext('2d');
  const width=byId('cropWidth'),height=byId('cropHeight'),clip=(n,a,b)=>Math.min(b,Math.max(a,n));
  width.value=65;height.value=75;
  const scale=Math.min(1,720/Math.max(image.width,image.height));
  canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  let x=.5,y=.5;
  function bounds(){
    const w=+width.value/100,h=+height.value/100;
    return [clip(x-w/2,0,1-w),clip(y-h/2,0,1-h),w,h];
  }
  function paint(){
    const [u,v,w,h]=bounds(),W=canvas.width,H=canvas.height;
    ctx.drawImage(image,0,0,W,H);ctx.fillStyle='rgba(15,12,18,.67)';
    ctx.beginPath();ctx.rect(0,0,W,H);ctx.rect(u*W,v*H,w*W,h*H);ctx.fill('evenodd');
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(u*W,v*H,w*W,h*H);
  }
  function center(e){
    const box=canvas.getBoundingClientRect();x=(e.clientX-box.left)/box.width;y=(e.clientY-box.top)/box.height;paint();
  }
  canvas.onpointerdown=center;canvas.onpointermove=e=>{if(e.buttons===1)center(e);};
  width.oninput=height.oninput=paint;paint();
  return new Promise(resolve=>{
    let crop=null;
    dialog.onclose=()=>{dialog.onclose=null;canvas.onpointermove=canvas.onpointerdown=null;resolve(crop);};
    byId('cancelBack').onclick=()=>dialog.close();
    byId('applyBack').onclick=()=>{
      const [u,v,w,h]=bounds(),out=document.createElement('canvas');out.width=448;out.height=512;
      out.getContext('2d').drawImage(image,u*image.width,v*image.height,w*image.width,h*image.height,0,0,448,512);
      crop=out.toDataURL('image/jpeg',.94);dialog.close();
    };
    dialog.showModal();
  });
}

export function projectRearPhoto(photo,registration){
  const canvas=document.createElement('canvas');canvas.width=registration.width;canvas.height=registration.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(registration,0,0);
  const surface=ctx.getImageData(0,0,canvas.width,canvas.height);
  const W=photo.width,H=photo.height,src=document.createElement('canvas');src.width=W;src.height=H;
  const s=src.getContext('2d',{willReadFrequently:true});s.drawImage(photo,0,0);
  const tex=s.getImageData(0,0,W,H).data,out=surface.data;
  for(let i=0;i<out.length;i+=4){
    const x=out[i]/255*(W-1),y=out[i+1]/255*(H-1),u=Math.floor(x),v=Math.floor(y),alpha=out[i+2];
    const a=4*(v*W+u),b=4*(v*W+Math.min(W-1,u+1)),c=4*(Math.min(H-1,v+1)*W+u),d=c+b-a;
    for(let k=0;k<3;k++)out[i+k]=(tex[a+k]*(1-x+u)+tex[b+k]*(x-u))*(1-y+v)+(tex[c+k]*(1-x+u)+tex[d+k]*(x-u))*(y-v);
    out[i+3]=alpha;
  }
  ctx.putImageData(surface,0,0);return canvas;
}

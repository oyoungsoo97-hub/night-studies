import {buildSculpture} from './sculpture.mjs?v=34aebac239';
import {renderer3D} from './renderer3d.mjs?v=7705098ff3';

export function makeSurface(canvas,redraw){
  const ctx=canvas.getContext('2d',{alpha:false}),layer=document.createElement('canvas');
  let engine=null,model=null,photo=null;
  function start(){try{engine=renderer3D(layer);if(engine&&model)engine.set(model);}catch{engine=null;}}
  start();
  layer.addEventListener('webglcontextlost',e=>{e.preventDefault();engine=null;redraw();});
  layer.addEventListener('webglcontextrestored',()=>{start();redraw();});
  function set(image,input){
    photo=image;model=input.face||input.pose||input.hands.length?buildSculpture(photo,input):null;
    if(engine)engine.set(model);
    canvas.dataset.modelTriangles=model?.count||0;
  }
  function photoGuides(frame,w,h){
    ctx.save();if(frame.area){const a=frame.area;ctx.fillStyle='#a7dfe72c';ctx.strokeStyle='#eef9c5';ctx.lineWidth=2;ctx.fillRect(a.x*w,a.y*h,a.width*w,a.height*h);ctx.strokeRect(a.x*w,a.y*h,a.width*w,a.height*h);}
    for(const [index,p] of (frame.anchors||[]).entries()){
      const x=p.x*w,y=p.y*h;ctx.beginPath();ctx.arc(x,y,Math.max(4,w*.007),0,Math.PI*2);ctx.fillStyle='#ffe695';ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#362839';ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='bold '+Math.max(12,w*.018)+'px sans-serif';ctx.strokeText(String(index+1),x+7,y-6);ctx.fillText(String(index+1),x+7,y-6);
    }ctx.restore();
  }
  function draw(frame,w,h){
    if(!photo)return;
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    if(frame.raw||!engine||!model){
      ctx.drawImage(photo,0,0,w,h);photoGuides(frame,w,h);return;
    }
    if(layer.width!==w||layer.height!==h){layer.width=w;layer.height=h;}
    const gradient=ctx.createRadialGradient(w*.44,h*.29,0,w*.55,h*.5,Math.max(w,h)*.84);
    const backdrop=[['#69757a','#404b51','#1d252d'],['#605e6b','#373442','#141923'],['#697679','#34474b','#17272e']][frame.view.light];
    gradient.addColorStop(0,backdrop[0]);gradient.addColorStop(.57,backdrop[1]);gradient.addColorStop(1,backdrop[2]);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    model.update(frame);engine.render(frame.view,frame.markers);ctx.drawImage(layer,0,0,w,h);
  }
  return {set,draw,get sculpture(){return model;},get available(){return !!engine;}
  };
}

import {Arcana} from './arcana.mjs?v=89576b9790';
const TAU=Math.PI*2,W=1600,H=1000;
export const spectra={
  vesper:{high:'#fff1d0',mid:'#efb5f4',low:'#ad77fb',deep:'#8041da'},
  solar:{high:'#fff6cf',mid:'#ffcb75',low:'#f08355',deep:'#d94d32'},
  tide:{high:'#e4ffe9',mid:'#a1f2d5',low:'#59cbe7',deep:'#3c7cd5'}
};
const starField=Array.from({length:95},(_,i)=>({x:n(i+1)*W,y:n(i+87)*H*.85,size:.55+n(i+74)*1.8}));
function n(seed){const x=Math.sin(seed*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
function arc(c,x,y,r,a,b,color,width=1){c.beginPath();c.arc(x,y,r,a,b);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function radial(c,x,y,r,color,alpha){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.22,color+'9c');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore();}
function spark(c,x,y,size,col,angle=0){
  c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=col;c.beginPath();c.moveTo(0,-size);c.quadraticCurveTo(size*.09,-size*.1,size*.63,0);c.quadraticCurveTo(size*.09,size*.1,0,size);c.quadraticCurveTo(-size*.09,size*.1,-size*.63,0);c.quadraticCurveTo(-size*.09,-size*.1,0,-size);c.fill();c.restore();
}
function thread(c,pts,color,width){
  if(!pts.length)return;
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
  c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke();
}
function drawNova(c,mark,t,power){
 const col=spectra[mark.color],r=mark.radius*H,x=mark.x*W,y=mark.y*H,rot=mark.seed*.91+t*.03;
 c.save();c.translate(x,y);c.globalCompositeOperation='screen';radial(c,0,0,r*.94,col.deep,.42*power);
 for(let k=0;k<2;k++){
   const path=[];
   for(let i=0;i<=220;i++){
     const a=i*TAU/220+rot,shape=(.49+.19*Math.cos(8*(a-rot))+.055*Math.cos(16*(a-rot)))*(k?.85:1);
     path.push([Math.cos(a)*r*shape,Math.sin(a)*r*shape]);
   }
   thread(c,path,k?col.high+'9d':col.low+'bb',k?1.2:2);
 }
 for(let j=0;j<12;j++){
   const a=rot+TAU*j/12,d=r*(.48+n(j+mark.seed)*.48);
   thread(c,[[Math.cos(a)*r*.13,Math.sin(a)*r*.13],[Math.cos(a)*d,Math.sin(a)*d]],j%3?col.mid+'88':col.high+'cc',j%3?.9:1.7);
   if(j%3===0)spark(c,Math.cos(a)*d,Math.sin(a)*d,r*.035,col.high);
 }
 radial(c,0,0,r*.27,col.mid,.68);spark(c,0,0,r*.38,col.high,rot);spark(c,0,0,r*.18,col.mid,rot+Math.PI/2);c.restore();
}
function drawInk(c,mark,t){
 const col=spectra[mark.color],points=mark.points.map(([x,y])=>[x*W,y*H]);if(!points.length)return;
 c.save();c.globalCompositeOperation='screen';
 thread(c,points,col.deep+'35',9+mark.power*.045);thread(c,points,col.low+'77',4.9);thread(c,points,col.high+'ee',1.7);
 for(let i=0;i<points.length;i++){
   if(i!==0&&i!==points.length-1&&i%8)continue;
   const [x,y]=points[i],r=i===0||i===points.length-1?9:2+n(i)*4;
   radial(c,x,y,r*1.7,col.low,.57);spark(c,x,y,r*(.83+.18*Math.sin(t+i)),col.high,.19);
 }
 c.restore();
}
export class Sky{
 constructor(canvas,landscape,images){
  this.arcana=new Arcana(images);this.cache=null;
  this.canvas=canvas;this.landscape=landscape;this.background=document.createElement('canvas');this.background.width=W;this.background.height=H;
  const c=this.background.getContext('2d');c.fillStyle='#110c20';c.fillRect(0,0,W,H);
  if(landscape){const z=Math.max(W/landscape.width,H/landscape.height);c.drawImage(landscape,(W-landscape.width*z)/2,(H-landscape.height*z)*.49,landscape.width*z,landscape.height*z);}
  const v=c.createRadialGradient(W*.53,H*.51,H*.18,W*.51,H*.48,W*.70);v.addColorStop(0,'#09061900');v.addColorStop(1,'#0a061b7a');c.fillStyle=v;c.fillRect(0,0,W,H);
 }
 draw(target,scene,time,{video=null,cursors=[],bursts=[],draft=null,wand=null,flights=[],reduced=false,field=null}={}){
  const c=target.getContext('2d');c.save();c.setTransform(target.width/W,0,0,target.height/H,0,0);c.drawImage(this.background,0,0);
  if(video?.readyState>=2&&video.videoWidth){
   c.save();const z=Math.max(W/video.videoWidth,H/video.videoHeight),w=video.videoWidth*z,h=video.videoHeight*z;
   c.translate(W,0);c.scale(-1,1);c.drawImage(video,(W-w)/2,(H-h)/2,w,h);c.restore();
   c.fillStyle='#100d253a';c.fillRect(0,0,W,H);
  }
  const t=time/1000;
  for(let i=0;i<starField.length;i++){
    const s=starField[i],alpha=.28+.26*(1+Math.sin(t*.77+i*3));c.fillStyle='rgba(251,229,245,'+alpha+')';c.fillRect(s.x,s.y,s.size,s.size);
  }
  // Keep the newest effects animated. Older artwork is composited once into a single plate.
  const fixed=Math.max(0,scene.marks.length-6);
  if(fixed){
   const anchor=scene.marks[fixed-1];
   if(!this.cache||this.cache.anchor!==anchor||this.cache.first!==scene.marks[0]){
     // All these marks combine source-over shadow with screen light. At each pixel their
     // composition is offset + transmission * background, independently for R, G and B.
     // Render the two endpoints once so the cached effects work over *any* live video frame.
     const transfer=this.cache||{offset:document.createElement('canvas'),transmission:document.createElement('canvas')};
     for(const [surface,background] of [[transfer.offset,'#000'],[transfer.transmission,'#fff']]){
      if(surface.width!==W||surface.height!==H){surface.width=W;surface.height=H;}
      const ink=surface.getContext('2d');
      ink.fillStyle=background;ink.fillRect(0,0,W,H);
      for(let i=0;i<fixed;i++)this.mark(ink,scene.marks[i],1.7);
     }
     const gain=transfer.transmission.getContext('2d');
     gain.save();gain.globalCompositeOperation='difference';gain.drawImage(transfer.offset,0,0);gain.restore();
     this.cache={...transfer,anchor,first:scene.marks[0]};
   }
   c.save();c.globalCompositeOperation='multiply';c.drawImage(this.cache.transmission,0,0);
   c.globalCompositeOperation='lighter';c.drawImage(this.cache.offset,0,0);c.restore();
  }else this.cache=null;
  for(const mark of scene.marks.slice(fixed)){
   if(mark.type==='bolt'&&flights.some(f=>f.mark===mark))continue;
   this.mark(c,mark,t);
  }
  if(draft&&draft.type!=='bolt')this.mark(c,draft,t,true);
  for(const flight of flights){if(time<flight.start)continue;this.arcana.bolt(c,flight.mark,t,reduced?1:Math.min(1,(time-flight.start)/flight.duration),!reduced);}
  for(const burst of bursts){this.arcana.impact(c,burst,(time-burst.start)/1000);}
  if(field)field.render(c,scene.color,scene.power,{reduced});
  if(wand)this.arcana.wand(c,wand,t);
  for(const pointer of cursors){
    const x=pointer.x*W,y=pointer.y*H,col=spectra[scene.color];
    radial(c,x,y,28,col.low,.42);arc(c,x,y,pointer.pinch?8:17,t,t+5.4,col.high+'aa',1.8);
    spark(c,x,y,pointer.pinch?7:4,col.high);
  }
  c.restore();
 }
 mark(c,m,t,held=false){
  if(m.type==='gate')this.arcana.portal(c,m,t);
  else if(m.type==='shield')this.arcana.shield(c,m,t,held);
  else if(m.type==='bolt')this.arcana.bolt(c,m,t);
  else if(m.type==='nova')drawNova(c,m,t,m.power/85);
  else drawInk(c,m,t);
 }
}

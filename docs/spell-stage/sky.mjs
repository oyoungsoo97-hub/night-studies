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
function orbPoint(a,r,tilt,spin,z=0){
 const x=Math.cos(a)*r,y=Math.sin(a)*r*tilt+z;
 return [x*Math.cos(spin)-y*Math.sin(spin),x*Math.sin(spin)+y*Math.cos(spin)];
}
function drawGate(c,mark,t,power){
 const col=spectra[mark.color],r=mark.radius*H,rot=mark.seed*.38+t*.095,x=mark.x*W,y=mark.y*H;
 c.save();c.translate(x,y);c.globalCompositeOperation='screen';
 radial(c,0,0,r*1.45,col.deep,.27*power);
 // A moving armillary sphere. Each elliptical wire describes a distinct orbital plane.
 for(let k=0;k<5;k++){
   const a=rot*.7+k*.91,tilt=.21+.13*(k%3),span=r*(1.02+.08*Math.sin(k*4));
   const pts=Array.from({length:101},(_,j)=>orbPoint(j*TAU/100,span,tilt,a));
   thread(c,pts,k%2?col.low+'9d':col.mid+'b5',k%2?1.2:2.3);
   const p=orbPoint(t*(.21+.04*k)+k*3.8,span,tilt,a);
   radial(c,p[0],p[1],r*.10,col.low,.49);spark(c,p[0],p[1],r*(k%2?.041:.055),col.high,rot*.2);
 }
 for(let band=0;band<3;band++){
   const rr=r*(.79+band*.081),start=rot*(band%2?-.65:.6)+band;
   for(let j=0;j<9;j++){
    arc(c,0,0,rr,start+j*TAU/9,start+(j+.68)*TAU/9,band===1?col.high+'aa':col.low+'8a',band===1?1.9:1);
   }
 }
 for(let i=0;i<60;i++){
   const a=i*TAU/60+rot*.25,long=i%5===0,outer=r*(long?1.064:1.014),inner=r*(long?.978:.992);
   thread(c,[[Math.cos(a)*inner,Math.sin(a)*inner],[Math.cos(a)*outer,Math.sin(a)*outer]],long?col.high+'bf':col.mid+'a4',long?1.6:1);
 }
 // Fine dust traces the inner and outer crown at different rates.
 for(let i=0;i<126;i++){
   const a=n(i+mark.seed*3)*TAU+t*(.03+n(i)*.075),d=r*(.66+n(i+6)*.56),px=Math.cos(a)*d,py=Math.sin(a)*d;
   c.globalAlpha=.20+n(i+29)*.71;c.fillStyle=i%5?col.mid:col.high;c.fillRect(px,py,1+n(i+42)*2.2,1+n(i+42)*2.2);
 }
 c.globalAlpha=1;radial(c,0,0,r*.32,col.low,.25);spark(c,0,0,r*.125,col.high,rot*.19);spark(c,0,0,r*.07,col.mid,rot*.19+Math.PI/2);
 c.restore();
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
 constructor(canvas,landscape){
  this.canvas=canvas;this.landscape=landscape;this.background=document.createElement('canvas');this.background.width=W;this.background.height=H;
  const c=this.background.getContext('2d');c.fillStyle='#110c20';c.fillRect(0,0,W,H);
  if(landscape){const z=Math.max(W/landscape.width,H/landscape.height);c.drawImage(landscape,(W-landscape.width*z)/2,(H-landscape.height*z)*.49,landscape.width*z,landscape.height*z);}
  const v=c.createRadialGradient(W*.53,H*.51,H*.18,W*.51,H*.48,W*.70);v.addColorStop(0,'#09061900');v.addColorStop(1,'#0a061b7a');c.fillStyle=v;c.fillRect(0,0,W,H);
 }
 draw(target,scene,time,{video=null,cursors=[],bursts=[],draft=null}={}){
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
  const marks=draft?[...scene.marks,draft]:scene.marks;
  for(const mark of marks){
    if(mark.type==='gate')drawGate(c,mark,t,mark.power/85);else if(mark.type==='nova')drawNova(c,mark,t,mark.power/85);else drawInk(c,mark,t);
  }
  for(const burst of bursts)this.burst(c,burst,(time-burst.start)/1000);
  for(const pointer of cursors){
    const x=pointer.x*W,y=pointer.y*H,col=spectra[scene.color];
    radial(c,x,y,28,col.low,.42);arc(c,x,y,pointer.pinch?8:17,t,t+5.4,col.high+'aa',1.8);
    spark(c,x,y,pointer.pinch?7:4,col.high);
  }
  c.restore();
 }
 burst(c,b,age){
  if(age<0||age>=2.6)return;
  const col=spectra[b.color],scale=b.scale*H,fade=Math.max(0,1-age/2.6),travel=1-Math.exp(-age*2.1);
  c.save();c.translate(b.x*W,b.y*H);c.globalCompositeOperation='screen';c.globalAlpha=fade;
  if(b.type!=='ink'){
   radial(c,0,0,scale*(1.3-age*.3),col.low,.48*fade);
   for(let k=0;k<2;k++)arc(c,0,0,scale*(.14+travel*(1.2+.26*k)),0,TAU,col.mid+(k?'66':'aa'),1.5+1.8*fade);
  }
  for(let i=0;i<(b.type==='ink'?16:67);i++){
   const a=n(i+7*b.seed)*TAU,energy=.2+1.35*n(i+43+b.seed),r=scale*travel*energy,dr=scale*.045*fade;
   const px=Math.cos(a)*r,py=Math.sin(a)*r+age*age*(4+n(i)*7);
   thread(c,[[px-dr*Math.cos(a),py-dr*Math.sin(a)],[px,py]],i%4?col.low:col.high,1+n(i+2)*2.2);
   if(!(i%10))spark(c,px,py,5*fade+.5,col.high,a);
  }
  c.restore();
 }
}

'use strict';
window.FoleyFilm = (() => {
  const canvas = document.getElementById('film');
  const ctx = canvas.getContext('2d',{alpha:false});
  const plate = new Image();
  const actor = new Image();
  const W=800,H=450;
  let last=0, geometry;
  const ease=u=>u*u*(3-2*u);
  const clip=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
  const step=(a,b,t)=>ease(clip((t-a)/(b-a)));
  const mix=(a,b,u)=>a+(b-a)*u;
  function newFrame() {
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(rect.width*dpr));
    canvas.height=Math.max(1,Math.round(rect.height*dpr));
    const k=Math.max(canvas.width/W,canvas.height/H);
    geometry={k,ox:(canvas.width-W*k)*.5,oy:(canvas.height-H*k)*.52};
    draw(last);
  }
  function path(commands,fill,stroke,width=1){
    const p=new Path2D(commands);
    if(fill){ctx.fillStyle=fill;ctx.fill(p);}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke(p);}
  }
  function gradient(x0,y0,x1,y1,...stops){
    const g=ctx.createLinearGradient(x0,y0,x1,y1);
    stops.forEach(([n,c])=>g.addColorStop(n,c));return g;
  }
  function door(open) {
    if(open<=.001||!plate.naturalWidth)return;
    const x=343,y=95,w=115,h=248;
    ctx.save();
    ctx.fillStyle=gradient(x,y,x+w,y,[0,'#080e10'],[.65,'#192b2e'],[1,'#3c4e4e']);
    ctx.fillRect(x,y,w,h);
    ctx.fillStyle=gradient(x,y,x,y+h,[0,'#a4b5a429'],[.58,'#b1cdbb08'],[1,'#071014a3']);
    ctx.fillRect(x,y,w,h);
    ctx.fillStyle='#314444';
    ctx.fillRect(x+77,y+34,2,165);
    for(let i=0;i<5;i++){
      const sy=y+167+i*14;
      path('M '+(x+55-i*10)+' '+sy+' L '+(x+w)+' '+(sy-3)+' L '+(x+w)+' '+(sy+1)+' Z','#89a19a30');
    }
    // Reproject vertical strips of the actual door panel about its left hinge.
    const angle=open*1.28, projected=w*Math.cos(angle), depth=Math.sin(angle)*17;
    const strips=48;
    for(let i=0;i<strips;i++){
      const u=i/strips, pix=plate.naturalWidth/W,piy=plate.naturalHeight/H;
      const dx=x+projected*u, top=y+depth*.58*u, bottom=y+h-depth*u;
      ctx.drawImage(plate,(x+w*u)*pix,y*piy,(w/strips+.16)*pix,h*piy,dx,top,projected/strips+.46,bottom-top);
    }
    path('M '+x+' '+y+' L '+(x+projected)+' '+(y+depth*.58)+' L '+(x+projected)+' '+(y+h-depth)+' L '+x+' '+(y+h)+' Z','rgba(3,10,12,'+(open*.4)+')');
    ctx.strokeStyle='rgba(188,178,137,'+(open*.53)+')';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+projected,y+depth*.58);ctx.lineTo(x+projected,y+h-depth);ctx.stroke();
    ctx.globalCompositeOperation='screen';
    const spill=gradient(0,y+h,0,449,[0,'rgba(157,195,193,'+open*.33+')'],[1,'rgba(125,183,196,0)']);
    path('M '+(x+projected)+' '+(y+h)+' L '+(x+w)+' '+(y+h)+' L 507 450 L 301 450 Z',spill);
    ctx.restore();
  }
  function figure(t){
    if(t>=7.64 || !actor.naturalWidth)return;
    // These photographic cutouts share one neutral pose, split into twenty
    // weighted walking phases and nine positions for the reaching sleeve.
    const p=clip(t/4.53),perspective=(1/(1+1.56*p)-1/2.56)/(1-1/2.56);
    const entry=step(5.69,7.49,t),phase=t*6.62;
    const walking=1-step(4.02,4.5,t)+.58*(step(5.74,6.08,t)-step(7.13,7.46,t));
    const reach=step(4.18,5.04,t)*(1-step(5.63,6.08,t));
    const height=mix(224,512,perspective)-37*entry;
    const stride=Math.sin(phase)*walking;
    const x=mix(416,816,perspective)+15*entry+stride*height*.0038;
    const foot=mix(347,532,perspective)-25*entry;
    const frame=walking>.11 ? Math.floor((phase/(2*Math.PI)%1)*20) : 20+Math.round(reach*8);
    const cellWidth=290,cellHeight=656,scale=height/620;
    ctx.save();
    if(entry>.06){
      const open=step(5.03,6.20,t)*(1-step(7.16,7.96,t));
      const revealed=343+115*Math.cos(open*1.28);
      ctx.beginPath();ctx.rect(revealed,95,459-revealed,249);ctx.clip();
    }
    ctx.globalAlpha=1-step(7.14,7.63,t);
    ctx.save();
    ctx.translate(x,foot+1);ctx.scale(1,.16);
    const radius=height*.20;
    const shade=ctx.createRadialGradient(0,0,0,0,0,radius);
    shade.addColorStop(0,'#020503ad');shade.addColorStop(1,'#090b0800');
    ctx.fillStyle=shade;ctx.fillRect(-radius,-radius,2*radius,2*radius);ctx.restore();
    ctx.translate(x,foot-(.5-.5*Math.cos(2*phase))*height*.005*walking);
    ctx.rotate(stride*.008);
    ctx.drawImage(actor,(frame%6)*cellWidth,Math.floor(frame/6)*cellHeight,cellWidth,cellHeight,-cellWidth*scale/2,-634*scale,cellWidth*scale,cellHeight*scale);
    ctx.restore();
  }
  function draw(seconds) {
    last=seconds;
    if(!geometry)return;
    const t=Math.floor(clip(seconds,0,8)*24)/24;
    const {k,ox,oy}=geometry;
    ctx.setTransform(k,0,0,k,ox,oy);
    ctx.fillStyle='#25231b';ctx.fillRect(0,0,W,H);
    if(plate.naturalWidth)ctx.drawImage(plate,0,0,W,H);
    const open=step(5.03,6.20,t)*(1-step(7.16,7.96,t));
    door(open);figure(t);
    const edge=ctx.createRadialGradient(401,203,138,401,203,466);edge.addColorStop(0,'#0e100d00');edge.addColorStop(1,'#07090645');ctx.fillStyle=edge;ctx.fillRect(0,0,W,H);
  }
  new ResizeObserver(newFrame).observe(canvas);
  plate.onload=newFrame;actor.onload=newFrame;plate.src='../assets/hallway.jpg';actor.src='./walker.webp';newFrame();
  return {draw};
})();

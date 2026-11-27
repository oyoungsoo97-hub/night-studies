const W=1600,H=1000,T=Math.PI*2;
const noise=i=>{const n=Math.sin(i*91.13+7.53)*9843.713;return n-Math.floor(n);};
const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
const table={vesper:['#fff5df','#e1abff','#a06bfb','#6237ac'],solar:['#fffaca','#ffd886','#ff954a','#953a26'],tide:['#f2fff7','#acffe4','#4ad3f4','#176f9b']};
const tints={aether:{vesper:'none',solar:'hue-rotate(103deg) saturate(1.4)',tide:'hue-rotate(268deg) saturate(1.15)'},ward:{tide:'none',solar:'hue-rotate(217deg) saturate(1.25)',vesper:'hue-rotate(93deg) saturate(1.20)'}};
function line(c,pts,color,width){
 if(pts.length<2)return;c.beginPath();c.moveTo(...pts[0]);
 for(const p of pts.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke();
}
function glow(c,x,y,r,col,alpha=1){
 if(r<=0)return;c.save();c.globalAlpha*=clamp(alpha);const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(.16,col+'bd');g.addColorStop(.50,col+'39');g.addColorStop(1,col+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
}
function glint(c,x,y,r,col){
 c.save();c.translate(x,y);c.fillStyle=col;c.beginPath();c.moveTo(0,-r);c.quadraticCurveTo(1.1,-1.2,r*.76,0);c.quadraticCurveTo(1,.8,0,r);c.quadraticCurveTo(-1,.7,-r*.76,0);c.quadraticCurveTo(-1,-.9,0,-r);c.fill();c.restore();
}
function plate(c,sprite,x,y,r,turn,aspect,alpha=1){
 if(!sprite||alpha<=0)return;c.save();c.translate(x,y);c.scale(1,aspect);c.rotate(turn);c.globalAlpha*=clamp(alpha);c.drawImage(sprite,-r,-r,2*r,2*r);c.restore();
}
function tinted(img,filter){
 if(!img)return null;const surface=document.createElement('canvas');surface.width=surface.height=640;
 const ctx=surface.getContext('2d');if('filter' in ctx)ctx.filter=filter;
 ctx.drawImage(img,0,0,640,640);return surface;
}
export class Arcana{
 constructor(images){
  this.plates={};
  for(const type of ['aether','ward']){
   this.plates[type]={};for(const color of Object.keys(table))this.plates[type][color]=tinted(images[type],tints[type][color]);
  }
 }
 portal(c,m,t){
  const [core,halo,light,deep]=table[m.color],r=m.radius*H,x=m.x*W,y=m.y*H,k=m.seed*.017;
  c.save();c.translate(x,y);c.rotate(-.16+.085*Math.sin(k));
  // The throat occludes the sky; several counter-moving depths lead to a vanishing point.
  const throat=c.createRadialGradient(r*.09,-r*.05,r*.09,0,0,r*1.01);throat.addColorStop(0,'#040310ed');throat.addColorStop(.56,'#08071ac9');throat.addColorStop(1,'#0d0a2400');
  c.fillStyle=throat;c.beginPath();c.ellipse(0,0,r,r*.93,0,0,T);c.fill();
  c.globalCompositeOperation='screen';glow(c,0,r*.07,r*1.4,deep,.34);const sprite=this.plates.aether[m.color];
  for(let i=0;i<3;i++){
   const z=(t*.115+i/3+k)%1,rad=r*(.09+z*z*.82),fade=.06+.22*Math.sin(z*Math.PI);
   plate(c,sprite,(1-z)*r*.17,(1-z)*-r*.12,rad,k+t*.18+z*1.1,.91,fade);
  }
  for(let i=0;i<41;i++){
   const depth=(noise(i+19+k)*.98+t*.155)%1,a=noise(i+k*4)*T+depth*2.5-t*.24;
   const d=r*(.07+.86*depth*depth),px=Math.cos(a)*d+r*.13*(1-depth),py=Math.sin(a)*d*.91-r*.1*(1-depth);
   c.fillStyle=i%4?light:core;c.globalAlpha=.18+.60*depth;c.fillRect(px,py,1.4+2*depth,1.1+1.8*depth);
  }
  c.globalAlpha=1;const breathe=1+.025*Math.sin(t*1.7+k);
  plate(c,sprite,0,0,r*1.33*breathe,k+t*.19,.93,.94);
  plate(c,sprite,0,0,r*1.21,k*.8-t*.24,.95,.30);
  for(let i=0;i<25;i++){
   const a=noise(i+k)*T+t*(.08+.11*noise(i+12)),d=r*(1+.31*noise(i+40)),px=Math.cos(a)*d,py=Math.sin(a)*d*.93;
   const v=1.3+2.1*noise(i+27);line(c,[[px+Math.sin(a)*v*2,py-Math.cos(a)*v*2],[px,py]],i%3?halo:core,v*.66);
  }
  glint(c,Math.cos(t*.45+k)*r*.94,Math.sin(t*.45+k)*r*.86,r*.065,core);c.restore();
 }
 shield(c,m,t,held=false){
  const [core,halo,light,deep]=table[m.color],r=m.radius*H,x=m.x*W,y=m.y*H,k=m.seed*.008;
  c.save();c.translate(x,y);c.globalCompositeOperation='screen';
  const sprite=this.plates.ward[m.color],wobble=held?.033:.014,breath=1+wobble*Math.sin(2.7*t+k);
  glow(c,0,r*.04,r*1.30,deep,held?.42:.22);
  plate(c,sprite,0,0,r*1.15*breath,.20*Math.sin(t*.65+k)-.18,.98,held?.96:.82);
  c.save();c.scale(-1,1);plate(c,sprite,0,0,r*1.07,-.28*Math.sin(t*.75+k)-.60,.97,held?.35:.18);c.restore();
  for(let i=0;i<16;i++){
   const a=k+T*noise(i+3)+t*.18,px=Math.cos(a)*r*.96,py=Math.sin(a)*r*.95;
   if(i%3===0)glint(c,px,py,r*(.021+.009*Math.sin(t+i)),halo);else{c.fillStyle=core;c.fillRect(px,py,2,2);}
  }
  c.restore();
 }
 bolt(c,m,t,fraction=1,travelling=false){
  const [core,halo,light,deep]=table[m.color],power=m.power/100,seed=m.seed;
  const path=boltCurve(m,travelling?t*.8:0);const count=path.length-1;
  const head=clamp(fraction)*count,tail=travelling?Math.max(0,head-count*(.18+.17*power)):0;
  const sample=i=>{const a=path[Math.floor(i)],b=path[Math.min(count,Math.ceil(i))],f=i%1;return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];};
  const pts=[sample(tail),...path.slice(Math.ceil(tail),Math.floor(head)+1),sample(head)],tip=pts.at(-1);
  c.save();c.globalCompositeOperation='screen';if(!travelling)c.globalAlpha=.59;
  if(travelling){
   for(let i=0;i<pts.length;i+=2){
    const [x,y]=pts[i],u=(i+1)/pts.length;glow(c,x,y,10+30*u,light,.16+.20*u);
   }
   // Two braided filaments unwind into the wake. The trailing end cools into glowing debris.
   for(let j=0;j<2;j++){
    const curl=pts.map(([x,y],i)=>{
     const next=pts[Math.min(i+1,pts.length-1)],prev=pts[Math.max(0,i-1)],vx=next[0]-prev[0],vy=next[1]-prev[1],d=Math.hypot(vx,vy)||1;
     const f=i/Math.max(1,pts.length-1),r=Math.sin(f*13+t*19+j*3.14)*(1-f)*(5.8+j*3);
     return [x-vy/d*r,y+vx/d*r];
    });line(c,curl,j?halo+'ab':light+'a8',j?1.1:1.7);
   }
   for(let i=1;i<pts.length;i++){
    const pair=[pts[i-1],pts[i]],u=i/pts.length;
    line(c,pair,light+'68',1+u*6);line(c,pair,halo+'da',.7+u*3.7);line(c,pair,core,.45+u*1.7);
    if(i%2===0){const [x,y]=pts[i-1],j=noise(seed+i);glint(c,x+(j-.5)*22,y+3+noise(i+4)*19,1.2+2.1*j,halo);}
   }
  }else{
   line(c,pts,deep+'36',9);line(c,pts,light+'67',4);line(c,pts,halo+'dd',1.7);line(c,pts,core,1.0);
  }
  for(let k=0;k<5;k++){
   const i=Math.min(count-1,Math.max(1,Math.floor(count*(.12+.71*noise(k+seed)))));
   if(i<tail||i>head)continue;const [x,y]=path[i],[u,v]=path[Math.min(count,i+4)],dx=u-x,dy=v-y,d=Math.hypot(dx,dy)||1,side=k%2?1:-1;
   const length=(travelling?38:20)*(1+.8*noise(seed+k+9));
   line(c,[[x,y],[x+dx*.5-dy/d*length*.31*side,y+dy*.5+dx/d*length*.31*side],[x+dx*.65-dy/d*length*.64*side,y+dy*.65+dx/d*length*.64*side],[x+dx*.41-dy/d*length*side,y+dy*.41+dx/d*length*side]],halo+'a8',travelling?1.6:.9);
  }
  const s=(travelling?43:19)*(.7+.44*power);glow(c,tip[0],tip[1],s*1.8,light,travelling?.89:.46);glow(c,tip[0],tip[1],s*.69,halo,.80);glint(c,tip[0],tip[1],s*(travelling?.39:.58),core);c.restore();
 }
 wand(c,m,t){
  if(!m)return;const [core,halo,light,deep]=table[m.color],x=m.x*W,y=m.y*H,a=m.angle||-.5,q=clamp(m.charge||0);
  c.save();c.translate(x,y);c.rotate(a);
  // Turned-wood handle, brass binding and a worn tapered nib.
  const shaft=c.createLinearGradient(0,-6,0,7);shaft.addColorStop(0,'#998267');shaft.addColorStop(.20,'#49352a');shaft.addColorStop(.47,'#a07753');shaft.addColorStop(.62,'#4a3328');shaft.addColorStop(1,'#1b1716');
  c.fillStyle=shaft;c.beginPath();c.moveTo(1,0);c.quadraticCurveTo(-37,-1.4,-85,-4.1);c.lineTo(-103,-6.1);c.quadraticCurveTo(-110,-5.6,-116,-3.4);c.lineTo(-119,3.8);c.quadraticCurveTo(-111,7.4,-103,5.8);c.lineTo(-84,4);c.quadraticCurveTo(-33,1.9,1,0);c.fill();
  for(let i=0;i<5;i++){const dx=-108+i*4.6;line(c,[[dx,-4.6],[dx+1.9,4.6]],i%2?'#594338':'#bea574',1.7);}
  line(c,[[-77,-2.1],[-39,-.7],[-5,0]],'#ceaf8e99',.85);c.restore();
  c.save();c.globalCompositeOperation='screen';
  if(m.trail?.length>1){const trail=m.trail.slice(-15).map(p=>[p.x*W,p.y*H]);line(c,trail,light+'65',3+q*3);line(c,trail,core+'b5',1.2);}
  glow(c,x,y,14+q*90,light,.56+q*.37);glow(c,x,y,7+q*31,halo,.67);glint(c,x,y,6+q*19,core);
  for(let i=0;i<Math.round(4+18*q);i++){
   const u=(noise(i+23)+t*(.42+.4*q))%1,theta=noise(i+6)*T+u*3.4,rad=(1-u)*(12+72*q);
   c.fillStyle=i%4?halo:core;c.globalAlpha=.36+.58*u;c.fillRect(x+Math.cos(theta)*rad,y+Math.sin(theta)*rad,1+u*2,1+u*2);
  }c.restore();
 }
 impact(c,b,age){
  if(age<0||age>2.45)return;const [core,halo,light,deep]=table[b.color],x=b.x*W,y=b.y*H,r=b.scale*H,p=clamp(b.power??.7),seed=b.seed;
  c.save();c.translate(x,y);
  if(b.ward&&age<1.35){
   const m=b.ward,dx=(m.x-b.x)*W,dy=(m.y-b.y)*H,rad=m.radius*H;
   c.save();c.beginPath();c.ellipse(dx,dy,rad,rad*.98,0,0,T);c.clip();c.globalCompositeOperation='screen';
   const a=clamp(age/1.35),ripple=rad*(.24+1.85*a);c.lineWidth=1+5*(1-a);c.strokeStyle=halo+'ba';c.globalAlpha=(1-a)*.78;
   c.beginPath();c.arc(0,0,ripple,0,T);c.stroke();
   glow(c,0,0,rad*(.6+a),light,(1-a)*.63);
   plate(c,this.plates.ward[m.color],dx,dy,rad*1.16,a*.24,1,(1-a)*.58);c.restore();
  }
  // Powder curls disperse after the incandescent debris has started falling.
  c.globalCompositeOperation='screen';
  for(let i=0;i<8;i++){
   const a=noise(seed+i)*T,d=(15+age*(12+22*noise(i+23)))*p,px=Math.cos(a)*d+Math.sin(age+i)*age*10,py=Math.sin(a)*d-age*22;
   glow(c,px,py,Math.max(4,r*(.18+.24*age)),deep,.15*Math.min(1,age*3)*(1-age/2.5));
  }
  const shock=1-Math.exp(-age*5),early=Math.max(0,1-age/.67);if(early>0){
   c.strokeStyle=halo+'a6';c.lineWidth=1+4*early;c.globalAlpha=early*.60;c.beginPath();c.ellipse(0,0,r*(.15+shock*1.4),r*(.13+shock*.95),b.seed,0,T);c.stroke();c.globalAlpha=1;
   glow(c,0,0,r*(.84+early*.52),light,early*.92);glint(c,0,0,r*.21*early,core);
  }
  const fade=Math.max(0,1-age/2.2);
  for(let i=0;i<(b.type==='ink'?12:44);i++){
   const a=noise(seed+i*3)*T,v=(.30+1.1*noise(seed+i+73))*r*(.7+p),gravity=r*(.4+.55*noise(i+113)),drag=(1-Math.exp(-age*2.8)),px=Math.cos(a)*v*drag,py=Math.sin(a)*v*drag+gravity*age*age*.24;
   const vx=Math.cos(a)*v*Math.exp(-age*2.8)*2.8,vy=Math.sin(a)*v*Math.exp(-age*2.8)*2.8+gravity*age*.48;
   c.globalAlpha=fade*(.35+.62*noise(i+7));line(c,[[px-vx*.043,py-vy*.043],[px,py]],i%4?halo:core,1+noise(i+15)*2.7);
   if(i%7===0)glint(c,px,py,3.6*fade,core);
  }c.restore();
 }
}
export function boltCurve(m,flow=0){
 const start=[m.x*W,m.y*H],dx=(m.endX-m.x)*W,dy=(m.endY-m.y)*H,len=Math.hypot(dx,dy)||1;
 const bend=(m.bend||0)*Math.min(220,len*.37);
 return Array.from({length:39},(_,i)=>{
  const u=i/38,s=Math.sin(u*Math.PI),w=s*(bend+Math.sin(i*.62+m.seed+flow)*10+Math.sin(i*2.14+m.seed*.23-flow*.36)*4.8);
  return [start[0]+dx*u-dy/len*w,start[1]+dy*u+dx/len*w];
 });
}

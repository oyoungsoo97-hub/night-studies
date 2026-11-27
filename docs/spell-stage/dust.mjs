const W=1600,H=1000,ratio=W/H,TAU=2*Math.PI,capacity=670;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const tint={vesper:['#fff4fc','#e6c7ff','#b698ec'],solar:['#fff5de','#ffe0ac','#e8b579'],tide:['#edfffb','#c2f8ed','#88c6d0']};
const hash=n=>{const f=Math.sin(n*78.232+9.81)*49475.234;return f-Math.floor(f);};
const rounded=n=>Math.round(n*100000)/100000;
const valid=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;
export function validDust(s){
 return s?.version===1&&Number.isSafeInteger(s.seed)&&valid(s.seed,0,1e7)&&valid(s.age,0,1e9)&&
  Array.isArray(s.dots)&&s.dots.length===capacity&&s.dots.every(p=>Array.isArray(p)&&p.length===4&&
   valid(p[0],-.15,1.15)&&valid(p[1],-.15,1.15)&&valid(p[2],-3,3)&&valid(p[3],-3,3));
}
function makeBrush(colour){
 const canv=document.createElement('canvas');canv.width=canv.height=40;
 const c=canv.getContext('2d'),g=c.createRadialGradient(20,20,0,20,20,19);g.addColorStop(0,'#ffffff');g.addColorStop(.09,colour);g.addColorStop(.27,colour+'e6');g.addColorStop(.52,colour+'45');g.addColorStop(1,colour+'00');
 c.fillStyle=g;c.fillRect(0,0,40,40);return canv;
}
export class Dust{
 constructor(){
  this.brushes=Object.fromEntries(Object.entries(tint).map(([key,colors])=>[key,colors.map(makeBrush)]));this.seed=14027;this.reset();
 }
 reset(seed=this.seed){
  this.seed=seed;this.age=0;this.hands=new Map();this.ripples=[];
  this.dots=Array.from({length:capacity},(_,i)=>{
   const q=i+seed,z=hash(q+16),phase=hash(q+37)*TAU,kind=hash(q+92);
   let x=hash(q+116),y=hash(q+171);
   if(kind<.51){
    // A loose stream of flecks crosses the frame like a floating veil.
    const spread=(hash(q+73)+hash(q+4)+hash(q+211)-1.5)*.33;
    y=.57-x*.17+.14*Math.sin(x*6.1-.8)+spread;
   }
   return {x,y,vx:(hash(q+9)-.5)*.007,vy:-(.003+.007*z),z,phase,kind,
    axis:(hash(q+341)+hash(q+744))*.5,cross:(hash(q+311)+hash(q+99)-1),depth:(hash(q+347)+hash(q+117)-1),
    size:.85+Math.pow(z,3)*2.7};
  });
 }
 count(power){return clamp(250+Math.round(power*4.2),250,capacity);}
 snapshot(){return {version:1,age:rounded(this.age),seed:this.seed,dots:this.dots.map(p=>[p.x,p.y,p.vx,p.vy].map(rounded))};}
 restore(s){this.reset(s?.seed??this.seed);if(!s)return;this.age=s.age;s.dots.forEach(([x,y,vx,vy],i)=>Object.assign(this.dots[i],{x,y,vx,vy}));}
 input(id,mode,p,time){
  let h=this.hands.get(id);
  if(!h){h={x:p.x,y:p.y,vx:0,vy:0,mode,time,hold:0};this.hands.set(id,h);}
  const dt=clamp((time-h.time)/1000,.016,.17),dx=(p.x-h.x)*ratio,dy=p.y-h.y;
  h.vx=.52*h.vx+.48*clamp(dx/dt,-2.6,2.6);h.vy=.52*h.vy+.48*clamp(dy/dt,-2.6,2.6);
  if(h.mode==='gather'&&mode==='carry'){
   this.scatter(h);h.cooldown=1.55;
  }
  if(mode!==h.mode)h.hold=0;
  Object.assign(h,{x:p.x,y:p.y,mode,time});
 }
 release(id,scatter){
  const h=this.hands.get(id);if(h&&scatter&&h.mode==='gather')this.scatter(h);
  this.hands.delete(id);
 }
 scatter(h){
  const strength=.70+.90*clamp(h.hold,0,1);
  for(const p of this.dots){
   const dx=(p.x-h.x)*ratio,dy=p.y-h.y,r=Math.hypot(dx,dy);if(r>.36)continue;
   const falloff=(1-r/.36)**2,inv=1/Math.max(.008,r);
   p.vx=clamp(p.vx+falloff*(dx*inv*strength+h.vx*.46+Math.cos(p.phase)*.32),-2.5,2.5);
   p.vy=clamp(p.vy+falloff*(dy*inv*strength+h.vy*.46+Math.sin(p.phase)*.32),-2.5,2.5);
   if(this.reduced){p.x=clamp(p.x+p.vx*.18/ratio,-.04,1.04);p.y=clamp(p.y+p.vy*.18,-.04,1.04);}
  }
  this.ripples.push({x:h.x,y:h.y,age:0});this.ripples=this.ripples.slice(-3);
 }
 stop(){this.hands.clear();this.ripples=[];}
 step(dt,power,reduced=false){
  if(!dt)return;
  const hands=[...this.hands.values()].slice(0,2),controls=hands.filter(h=>!h.cooldown||h.cooldown<=0);if(reduced&&!hands.length)return;
  dt=clamp(dt,0,.055);this.age+=dt;
  for(const h of hands){h.hold+=dt;if(h.cooldown>0)h.cooldown-=dt;}
  for(const w of this.ripples)w.age+=dt;
  this.ripples=this.ripples.filter(w=>w.age<.62);
  const count=this.count(power),force=.75+power*.007,friction=Math.exp(-2.6*dt),travel=reduced?.5:1;
  const a=controls[0],b=controls[1],sx=b&&a?(b.x-a.x)*ratio:0,sy=b&&a?b.y-a.y:0,separation=Math.hypot(sx,sy),span=Math.max(.001,separation);
  for(let i=0;i<count;i++){
   const p=this.dots[i],px=p.x,py=p.y,z=p.z;
   const windX=(.012+.015*Math.cos(py*7.4+this.age*.27+p.phase))*(.5+z);
   const windY=(-.004+.015*Math.sin(px*9.8+this.age*.33+p.phase))*(.5+z);
   let ax=2.6*windX,ay=2.6*windY;
   // The same particles stretch between two palms, ride one palm, then condense at a pinch.
   if(a&&p.kind<.86){
    const turn=p.phase+this.age*(.53+z*.37);
    let targetX,targetY;
    if(b&&separation>.045){
     const u=p.axis,wide=.018+.075*Math.sin(u*Math.PI),cross=(p.cross*Math.cos(turn)+p.depth*Math.sin(turn))*wide;
     targetX=a.x+(sx*u-sy/span*cross)/ratio;
     targetY=a.y+sy*u+sx/span*cross+.014*p.depth*Math.sin(turn);
    }else{
     const radius=a.mode==='gather'?.056:.093;
     const rotation=this.age*.51,pulse=1+.08*Math.sin(turn*.8);
     targetX=a.x+(p.cross*Math.cos(rotation)-p.depth*Math.sin(rotation))*radius*pulse/ratio;
     targetY=a.y+((p.axis-.5)*2.24+.12*Math.sin(turn))*radius*pulse;
    }
    const strength=a.mode==='gather'?12:9;
    ax+=((targetX-px)*ratio*strength-p.vx*2.5)*force;
    ay+=((targetY-py)*strength-p.vy*2.5)*force;
   }else for(const h of controls){
    const dx=(h.x-px)*ratio,dy=h.y-py,r=Math.hypot(dx,dy),range=(h.mode==='gather'?.63:h.mode==='fan'?.31:.33)*force;
    if(r>=range)continue;
    const weight=(1-r/range)**1.45,inv=1/Math.max(.012,r);
    if(h.mode==='gather'){
     const orbit=.024+z*.083+.012*Math.sin(p.phase*2.1+this.age*1.4),radial=clamp((r-orbit)*10,-.48,1.7)*weight*force;
     const turn=(.48+z*.30)*weight,sense=p.kind<.83?1:-1;
     ax+=(dx*radial-dy*turn*sense)*inv+h.vx*weight*2.2;ay+=(dy*radial+dx*turn*sense)*inv+h.vy*weight*2.2;
    }else{
     const fan=h.mode==='fan'?.59:.12,curl=.13*weight*force;
     ax+=-dx*inv*fan*weight+dy*inv*curl+h.vx*weight*3.4;ay+=-dy*inv*fan*weight-dx*inv*curl+h.vy*weight*3.4;
    }
   }
   p.vx=clamp(p.vx*friction+ax*dt,-2.5,2.5);p.vy=clamp(p.vy*friction+ay*dt,-2.5,2.5);
   p.x+=p.vx*dt*travel/ratio;p.y+=p.vy*dt*travel;
   if(p.x<-.04)p.x=1.035;if(p.x>1.04)p.x=-.035;if(p.y<-.045)p.y=1.04;if(p.y>1.045)p.y=-.04;
  }
 }
 render(c,color,power,{reduced=false}={}){
  const colors=tint[color]||tint.vesper,brush=this.brushes[color]||this.brushes.vesper,count=this.count(power);
  const controls=[...this.hands.values()].filter(h=>!h.cooldown||h.cooldown<=0).slice(0,2);
  const cloud=controls.length>0,lobes=cloud?Array.from({length:7},()=>({x:0,y:0,n:0})):null;
  // Accumulate actual particles, so the soft luminous volume arrives with the moving grains.
  if(cloud){
   const first=controls[0],last=controls[1]||first;
   for(let i=0;i<count;i++){
    const p=this.dots[i],u=p.axis,cx=first.x+(last.x-first.x)*u,cy=first.y+(last.y-first.y)*u;
    if(p.kind<.86&&Math.hypot((p.x-cx)*ratio,p.y-cy)<.14){
     const l=lobes[Math.min(6,Math.floor(u*7))];l.x+=p.x;l.y+=p.y;l.n++;
    }
   }
  }
  c.save();c.globalCompositeOperation='source-over';
  // A barely visible cool edge keeps the brightest flecks legible on a sunlit face or wall.
  c.fillStyle='#514561';
  for(let i=0;i<count;i+=3){const p=this.dots[i];if(p.z<.64)continue;c.globalAlpha=.19;c.beginPath();c.arc(p.x*W+.65,p.y*H+.85,p.size*.89,0,TAU);c.fill();}
  c.globalCompositeOperation='screen';c.lineCap='round';
  if(cloud)for(const v of lobes){
   if(v.n<9)continue;const size=(controls.length===1?84:115)+Math.sqrt(v.n)*3,x=v.x/v.n*W,y=v.y/v.n*H;
   c.globalAlpha=Math.min(.31,v.n/275);
   c.drawImage(brush[1],x-size/2,y-size/2,size,size);
  }
  for(let i=0;i<count;i++){
   const p=this.dots[i],x=p.x*W,y=p.y*H,twinkle=reduced?.85:.77+.23*Math.sin(this.age*(1.0+p.z)+p.phase),energy=Math.hypot(p.vx,p.vy);
   c.globalAlpha=clamp((.52+.44*p.z)*twinkle,.30,1);
   if(p.kind>.78||energy>.19){
    const n=p.z>.89?0:i%7===1?2:1,span=p.size*(p.kind>.962?8.8:4.9);c.drawImage(brush[n],x-span/2,y-span/2,span,span);
   }else{c.fillStyle=i%8===1?colors[1]:colors[0];c.fillRect(x,y,p.size,p.size*.92);}
   // Companion grains break up the larger points into irregular, depth-dependent wisps.
   if(p.kind<.73){
    const a=p.phase+this.age*.12,s=3+p.z*8,ox=Math.cos(a)*s,oy=Math.sin(a)*s*.68;
    c.fillStyle=i%5?colors[0]:colors[1];c.globalAlpha=.36*twinkle;c.fillRect(x+ox,y+oy,.8+p.z,1+p.z*.6);
    if(p.kind<.32){c.globalAlpha=.48*twinkle;c.fillRect(x-oy*.7,y+ox*.49,1.1+p.z,.9+p.z*.6);}
   }
   if(cloud&&p.kind<.86){
    const v=lobes[Math.min(6,Math.floor(p.axis*7))];
    if(v.n>12&&Math.hypot(x-v.x/v.n*W,y-v.y/v.n*H)<120){
     const a=p.phase+this.age*(reduced?0:.21),scatter=4+12*p.z,clusters=c.canvas.width<700?3:6;
     for(let j=0;j<clusters;j++){
      const ang=a+j*2.40,rad=scatter*Math.sqrt((j+.5)/clusters);
      c.fillStyle=j%4?colors[0]:colors[1];c.globalAlpha=(.53+.27*p.z)*twinkle;
      const grain=1.1+1.12*p.z;c.fillRect(x+Math.cos(ang)*rad,y+Math.sin(ang)*rad*.83,grain,grain*.91);
     }
    }
   }
   if(energy>.15&&!reduced){
    const tail=Math.min(.042,.012+energy*.025);c.lineWidth=.6+p.z*1.2;c.strokeStyle=i%4?colors[0]:colors[1];c.globalAlpha*=.44;
    c.beginPath();c.moveTo(x,y);c.lineTo(x-p.vx*tail*H,y-p.vy*tail*H);c.stroke();
   }
   if(p.kind>.947){
    const s=p.size*(1.35+twinkle);c.fillStyle=colors[0];c.globalAlpha*=.67;c.beginPath();c.moveTo(x,y-s);c.quadraticCurveTo(x+.4,y-.3,x+s*.76,y);c.quadraticCurveTo(x+.4,y+.3,x,y+s);c.quadraticCurveTo(x-.4,y+.3,x-s*.76,y);c.quadraticCurveTo(x-.4,y-.3,x,y-s);c.fill();
   }
  }
  if(!reduced)for(const release of this.ripples){
   const u=release.age/.62,r=(.09+.29*u)*H;
   c.globalAlpha=.22*(1-u)**3;c.lineWidth=1.7*(1-u)+.4;c.strokeStyle=colors[0];
   c.beginPath();c.ellipse(release.x*W,release.y*H,r*.89,r,.08,0,TAU);c.stroke();
  }
  const held=[...this.hands.values()];
  if(held.length===1&&held[0].mode==='gather'&&held[0].hold>.32){
   const h=held[0],q=clamp((h.hold-.32)/.6,0,1),x=h.x*W,y=h.y*H,r=(.103+.023*q)*H;
   c.globalAlpha=.30+.30*q;c.lineWidth=1.5;c.strokeStyle=colors[0];c.beginPath();c.ellipse(x,y,r*.89,r,.08,0,TAU);c.stroke();
   const halo=c.createRadialGradient(x,y,0,x,y,r*.83);halo.addColorStop(0,colors[1]+'4d');halo.addColorStop(1,colors[1]+'00');c.fillStyle=halo;c.fillRect(x-r,y-r,r*2,r*2);
   const core=c.createRadialGradient(x,y,1,x,y,r*.43);core.addColorStop(0,'#fffffbc9');core.addColorStop(.19,colors[0]+'9e');core.addColorStop(.55,colors[1]+'40');core.addColorStop(1,colors[1]+'00');
   c.globalAlpha=.56+.30*q;c.fillStyle=core;c.fillRect(x-r*.5,y-r*.5,r,r);
  }
  c.restore();
 }
}

const clamp=(n,low=0,high=1)=>Math.max(low,Math.min(high,n));
export function grip(point,now,angle=-.52){
 return {anchor:{...point},point:{...point},angle,start:now,last:now,history:[{...point,time:now}],speed:0,peak:0,vx:Math.cos(angle),vy:Math.sin(angle),travel:0};
}
export function aim(grip,p,now){
 const dx=(p.x-grip.point.x)*1.6,dy=p.y-grip.point.y,dist=Math.hypot(dx,dy);
 if(dist<.001)return;
 grip.history.push({...p,time:now});grip.history=grip.history.filter(item=>now-item.time<=220).slice(-20);
 const old=grip.history.find(item=>now-item.time<=130) || grip.history[0];
 const sx=(p.x-old.x)*1.6,sy=p.y-old.y,span=Math.hypot(sx,sy),dt=Math.max(.025,(now-old.time)/1000);
 const speed=span/dt;grip.speed=speed;grip.peak=Math.max(grip.peak*.85,speed);grip.travel+=dist;
 if(span>.007){grip.vx=sx/span;grip.vy=sy/span;grip.angle=Math.atan2(sy,sx);}
 grip.last=now;grip.point={...p};
}
export const charge=(g,now)=>g?clamp((now-g.start)/820):0;
function intercept(start,end,marks){
 const vx=(end.x-start.x)*1.6,vy=end.y-start.y,a=vx*vx+vy*vy;
 if(a<1e-8)return null;
 let nearest=null;
 for(const mark of marks){
  if(mark.type!=='shield')continue;
  const dx=(start.x-mark.x)*1.6,dy=start.y-mark.y,r=mark.radius*.94;
  if(dx*dx+dy*dy<=r*r)continue;
  const b=2*(vx*dx+vy*dy),c=dx*dx+dy*dy-r*r,disc=b*b-4*a*c;
  if(disc<=0)continue;const t=(-b-Math.sqrt(disc))/(2*a);
  if(t>.02&&t<=1&&(!nearest||t<nearest.t))nearest={t,mark};
 }
 return nearest?{x:start.x+(end.x-start.x)*nearest.t,y:start.y+(end.y-start.y)*nearest.t,seed:nearest.mark.seed}:null;
}
export function launch(g,now,mark,marks){
 const q=charge(g,now),source=g.anchor,moved=Math.hypot((g.point.x-source.x)*1.6,g.point.y-source.y);
 const angle=moved>.027?Math.atan2(g.point.y-source.y,(g.point.x-source.x)*1.6):g.angle;
 const speed=clamp(g.peak/3.3),vx=Math.cos(angle),vy=Math.sin(angle);
 const distance=clamp(Math.max(.23+q*.32+speed*.36,moved+.16+q*.18),.24,1.38);
 let x=source.x+vx*distance/1.6,y=source.y+vy*distance;
 const edge=Math.min(1,vx>0?(.986-source.x)/Math.max(.00001,x-source.x):(.014-source.x)/Math.min(-.00001,x-source.x),vy>0?(.986-source.y)/Math.max(.00001,y-source.y):(.014-source.y)/Math.min(-.00001,y-source.y));
 x=clamp(source.x+(x-source.x)*clamp(edge),.014,.986);y=clamp(source.y+(y-source.y)*clamp(edge),.014,.986);
 const hit=intercept(source,{x,y},marks);
 const first=g.history[0],cross=(g.point.x-first.x)*1.6*vy-(g.point.y-first.y)*vx;
 return {...mark,x:source.x,y:source.y,endX:hit?.x??x,endY:hit?.y??y,
  charge:q,speed,bend:clamp(cross*6+(mark.seed%2?.15:-.15)*(1-speed),-.87,.87),blocked:!!hit};
}

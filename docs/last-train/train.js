'use strict';
(() => {
  const el = id => document.getElementById(id);
  const canvas = el('tearCanvas'), ctx = canvas.getContext('2d', {alpha: false});
  const sheet = document.createElement('canvas'), printed = document.createElement('canvas');
  const station = document.createElement('canvas'), carriage = document.createElement('canvas');
  const sceneStatus = el('sceneStatus'), progress = el('progress'), timeRail = progress.parentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clip = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = t => t * t * (3 - 2 * t);
  const duration = 12;
  let W = 0, H = 0, filmTime = 0, playing = false, previous = 0, animation = 0;
  let openingArea = .01, opened = false, stroke = null, strokes = [], pointer = null, auto = null, saved = null, clockSecond = -1;
  let photo = null, poster = null, trainPhoto = null, visible = true, frameDirty = true;
  const origin = new URL('.', location.href);

  function random(seed) {
    let n = seed >>> 0;
    return () => ((n = (Math.imul(1664525, n) + 1013904223) >>> 0) / 4294967296);
  }
  function cover(c, img, w, h, cx = .5, cy = .5) {
    const z = Math.max(w / img.width, h / img.height);
    c.drawImage(img, (w - img.width*z)*cx, (h-img.height*z)*cy, img.width*z, img.height*z);
  }
  function grain(c, w, h, seed, count, light = .12) {
    const r = random(seed);
    for (let i=0; i<count; i++) {
      const v = r()>.52 ? '255,239,208' : '16,23,22';
      c.fillStyle='rgba('+v+','+(r()*light)+')';
      c.fillRect(r()*w,r()*h,(.3+r()*1.8)*h/650,(.3+r()*1.5)*h/650);
    }
  }
  function line(c,x1,y1,x2,y2,color,width) {
    c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.strokeStyle=color; c.lineWidth=width; c.stroke();
  }
  function fallbackPrint(c) {
    c.fillStyle='#cd4938'; c.fillRect(0,0,W,H);
    const ink='#241f1b', cream='#ead8a9', scale=Math.min(W/1200,H/600);
    c.save(); c.translate(W*.048,H*.11); c.scale(scale,scale);
    c.fillStyle=ink; c.font='bold 17px Helvetica, sans-serif'; c.fillText('NIGHT SERVICE',0,0);
    c.font='900 134px Helvetica,Arial,sans-serif'; c.fillText('LAST',-6,142); c.fillText('TRAIN',-5,254);
    c.fillStyle=cream;c.font='bold 18px Helvetica, sans-serif'; c.fillText('마지막 열차',0,301); c.restore();
    c.save(); c.translate(W*.72,H*.57); c.rotate(-.40);
    for(let i=0;i<7;i++){c.strokeStyle=i%3===0?cream:ink; c.lineWidth=H*.023;c.beginPath();c.ellipse(0,i*H*.023,W*.267,H*.185,0,-Math.PI,Math.PI);c.stroke();}
    c.restore(); line(c,W*.047,H*.87,W*.953,H*.87,ink,H*.004);
  }
  function createPrint() {
    const c=printed.getContext('2d'); c.clearRect(0,0,W,H);
    if(poster){
      // Stretch only the unprinted center strip, retaining a round terminus on wide screens.
      const sw=poster.width,sh=poster.height,s=H/sh;
      const left=Math.min(W*.43,sw*.45*s),right=Math.min(W*.36,sw*.37*s);
      c.drawImage(poster,0,0,sw*.45,sh,0,0,left,H);
      c.drawImage(poster,sw*.45,0,sw*.18,sh,left-.5,0,W-left-right+1,H);
      c.drawImage(poster,sw*.63,0,sw*.37,sh,W-right,0,right,H);
      c.fillStyle='#1c2530';c.textBaseline='alphabetic';c.textAlign='left';
      const margin=W*.041;
      c.font='bold '+Math.round(H*.155)+'px BarlowCondensed, Arial, sans-serif';
      c.fillText('23:59',margin,H*.942);
      c.textAlign='right';
      c.font='bold '+Math.max(11,Math.round(H*.050))+'px BarlowCondensed, Arial, sans-serif';
      c.fillText('NIGHT SERVICE',W-margin,H*.885);
      c.font='600 '+Math.max(9,Math.round(H*.025))+'px "Apple SD Gothic Neo", sans-serif';
      c.fillText('종점행  ·  마지막 열차',W-margin,H*.943);
      c.textAlign='left';
    }else{fallbackPrint(c);}
    const shade=c.createLinearGradient(0,0,0,H);
    shade.addColorStop(0,'#fff8d20b');shade.addColorStop(.53,'#0000');shade.addColorStop(1,'#39231f32');
    c.fillStyle=shade;c.fillRect(0,0,W,H);grain(c,W,H,67,Math.round(W*H/48),.16);
  }
  function createStation() {
    const c=station.getContext('2d');c.clearRect(0,0,W,H);
    if(photo) cover(c,photo,W,H,.5,.54);
    else {
      const grd=c.createLinearGradient(0,0,0,H);grd.addColorStop(0,'#101b22');grd.addColorStop(.55,'#55716c');grd.addColorStop(1,'#172129');c.fillStyle=grd;c.fillRect(0,0,W,H);
      for(let i=0;i<16;i++){let x=i*W/14-W/18;c.fillStyle='#182c30';c.fillRect(x,H*.23,W*.011,H*.43);
        if(i%3===0){c.fillStyle='#dbdec8';c.fillRect(x,H*.26,W*.126,H*.009);}}
      c.fillStyle='#83857a';c.fillRect(0,H*.67,W,H*.025); c.fillStyle='#182528';c.fillRect(0,H*.695,W,H*.21);
      for(const frac of [.77,.88])line(c,0,H*frac,W,H*frac,'#6c7770',Math.max(2,H*.006));
      c.fillStyle='#c3a65d';c.fillRect(0,H*.92,W,H*.015);c.fillStyle='#263b3e';c.fillRect(0,H*.935,W,H*.07);
    }
    const vignette=c.createRadialGradient(W*.53,H*.62,H*.1,W*.5,H*.57,W*.7);
    vignette.addColorStop(0,'#09151900');vignette.addColorStop(1,'#07121858');c.fillStyle=vignette;c.fillRect(0,0,W,H);
  }
  function person(c,x,foot,h,second=false) {
    c.save();c.translate(x,foot);c.scale(h/100,h/100);
    c.fillStyle='#11171755';c.beginPath();c.ellipse(2,0,17,3,0,0,2*Math.PI);c.fill();
    c.strokeStyle=second?'#192125':'#242927';c.lineCap='round';c.lineWidth=6;
    for(const [top,end] of [[-4,-6],[4,6]]){c.beginPath();c.moveTo(top,-34);c.lineTo(end,-2);c.stroke();}
    c.fillStyle=second?'#32312d':'#222f34';c.beginPath();c.moveTo(-6,-78);c.quadraticCurveTo(-15,-67,-13,-44);c.lineTo(-16,-29);c.quadraticCurveTo(-1,-26,13,-31);c.lineTo(10,-69);c.lineTo(6,-77);c.fill();
    c.strokeStyle=second?'#9b8b6f':'#7e8a85';c.lineWidth=1.25;c.beginPath();c.moveTo(-12,-45);c.quadraticCurveTo(-13,-70,-7,-76);c.stroke();
    c.fillStyle='#363e3b';c.beginPath();c.ellipse(0,-85,7.2,10,second?-.14:.1,0,2*Math.PI);c.fill();
    c.fillStyle='#101a1b';c.beginPath();c.ellipse(-1,-88,7.2,6.3,-.12,0,2*Math.PI);c.fill();
    if(second){c.fillStyle='#6c5641';c.fillRect(8,-44,9,15);}c.restore();
  }
  function createCarriage() {
    const c=carriage.getContext('2d');const w=750,h=250;carriage.width=w;carriage.height=h;
    const steel=c.createLinearGradient(0,0,0,h);
    for(const [p,color] of [[0,'#4f6267'],[.045,'#c3c2ae'],[.10,'#a3b2ac'],[.18,'#65777b'],[.58,'#66797b'],[.64,'#d0c5a6'],[.67,'#974b37'],[.72,'#6c3d32'],[.74,'#93988a'],[.94,'#4c5858'],[1,'#26363c']])steel.addColorStop(p,color);
    c.fillStyle='#19282d';c.fillRect(0,h*.18,w,h*.82);
    c.fillStyle=steel;c.beginPath();c.moveTo(2,h*.94);c.lineTo(2,22);c.quadraticCurveTo(3,5,23,4);c.lineTo(w-23,4);c.quadraticCurveTo(w-3,5,w-2,22);c.lineTo(w-2,h*.94);c.closePath();c.fill();
    for(let k=0;k<8;k++) {
      const x=20+k*91,winWidth=64,top=49;
      c.fillStyle='#253336';c.fillRect(x-3,top-3,winWidth+6,74);
      const glow=c.createLinearGradient(0,top,0,top+68);glow.addColorStop(0,'#e9d59f');glow.addColorStop(.20,'#bda77d');glow.addColorStop(.7,'#8e8e7b');glow.addColorStop(1,'#6f756a');c.fillStyle=glow;c.fillRect(x,top,winWidth,68);
      line(c,x,top+7,x+winWidth,top+7,'#ffebaf',3);
      for(let j=0;j<2;j++){const px=x+14+16*j+(k%3)*5; c.fillStyle=j===0?'#454c46':'#727564';
        c.beginPath();c.arc(px,top+45+j*2,5.9,0,7);c.fill(); c.beginPath();c.ellipse(px,top+69,10,17,0,0,7);c.save();c.beginPath();c.rect(x,top,winWidth,68);c.clip();c.beginPath();c.ellipse(px,top+69,10,17,0,0,7);c.fill();c.restore();}
      line(c,x+31,top,x+31,top+68,'#727975',2);
      if(k===1||k===2||k===5||k===6){c.strokeStyle='#384a4d';c.lineWidth=2;c.strokeRect(x-8,29,80,185);}
    }
    for(let i=0;i<5;i++)line(c,8,189+i*5,w-9,189+i*5,i%2?'#a4a394':'#768180',1.4);
    c.fillStyle='#293537';c.fillRect(0,235,w,10);
    for(const x of [55,111,w-100,w-45]){c.fillStyle='#101e23';c.beginPath();c.arc(x,239,13,0,7);c.fill();}
    grain(c,w,h,401,2200,.15);
  }

  function ripPath(points) {
    const path = new Path2D();if(!points.length)return path;
    if(points.length===1){const p=points[0];path.ellipse(p.x*W,p.y*H,p.r*H*1.4,p.r*H,-.25,0,Math.PI*2);return path;}
    const upper=[],lower=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const dx=(b.x-a.x)*W,dy=(b.y-a.y)*H,length=Math.hypot(dx,dy)||1;
      const nx=-dy/length,ny=dx/length;
      const phase=i*.165+points[0].x*15;
      const base=p.r*H;
      const fibres=Math.min(base*.28,H*.0033);
      const left=base*(1+.082*Math.sin(phase)+.04*Math.sin(phase*1.76))+fibres*Math.sin(i*29.24+2.81);
      const right=base*(1+.079*Math.sin(phase*.74+2.2)+.047*Math.cos(phase*1.8))+fibres*Math.sin(i*35.42+1.26);
      upper.push([p.x*W+nx*left,p.y*H+ny*left]);lower.push([p.x*W-nx*right,p.y*H-ny*right]);
    }
    const polygon=upper.concat(lower.reverse());path.moveTo(...polygon[0]);for(const pt of polygon.slice(1))path.lineTo(...pt);path.closePath();return path;
  }
  function buildPaper() {
    const c=sheet.getContext('2d');c.globalCompositeOperation='source-over';c.clearRect(0,0,W,H);c.drawImage(printed,0,0);
    const starter=[];for(let i=0;i<=15;i++){const t=i/15;starter.push({x:.44+t*.17,y:.52-.085*t+.004*Math.sin(9*t),r:.0008+.006*Math.sin(Math.PI*t)});}
    const cuts=[starter,...strokes.map(s=>s.points)];
    const shapes=cuts.map(ripPath);
    // Approximate exposed area from the width and travel of each cut for the ambient sound mix.
    let area=0;
    for(const cut of cuts)for(let i=1;i<cut.length;i++){
      const a=cut[i-1],b=cut[i];
      area+=(a.r+b.r)*Math.hypot(b.x-a.x,(b.y-a.y)*H/W);
    }
    openingArea=clip(area*2.3,.015,1);
    // Render all exposed fibre rims first, then punch the holes together so crossings stay open.
    for(const shape of shapes){
      c.fillStyle='#d9c9a3';c.fill(shape);c.lineWidth=Math.max(2,H*.009);c.strokeStyle='#b1a183';c.stroke(shape);
      c.lineWidth=Math.max(1,H*.005);c.strokeStyle='#e6dfc9';c.stroke(shape);
    }
    c.globalCompositeOperation='destination-out';c.fillStyle='#000';
    for(const shape of shapes)c.fill(shape);
    c.globalCompositeOperation='source-over';
    frameDirty=true;
  }
  function trainPhase(t) {
    const frac=clip((t-1.6)/7.8);
    return frac*.85 + smooth(frac)*.15;
  }
  function drawTrain(t) {
    const phase=trainPhase(t);if(phase<=0||phase>=1)return;
    const sprite=trainPhoto || carriage;
    const carHeight=H*.48,carWidth=carHeight*sprite.width/sprite.height, top=personFoot()-H*.32;
    const cars=carWidth/carHeight>4?3:4,trainWidth=cars*carWidth;
    const x=W-(W+trainWidth)*phase;
    // The final car leaves a warm edge reflection on the track.
    const v=ctx.createLinearGradient(0,top+carHeight,0,top+carHeight*1.19);
    v.addColorStop(0,'#d6ac6450');v.addColorStop(1,'#c2a17200');
    ctx.fillStyle=v;ctx.fillRect(x,top+carHeight*.955,trainWidth,carHeight*.20);
    for(let k=0;k<cars;k++){
      const cx=x+k*carWidth;
      if(cx>W||cx+carWidth<0)continue;
      ctx.drawImage(sprite,cx,top,carWidth,carHeight);
    }
    const head=ctx.createRadialGradient(x+8,top+carHeight*.66,2,x+8,top+carHeight*.66,carHeight*.36);
    head.addColorStop(0,'#fff3caec');head.addColorStop(.15,'#e5b9788f');head.addColorStop(1,'#deb85c00');
    ctx.fillStyle=head;ctx.fillRect(x-carHeight*.36,top+carHeight*.30,carHeight*.72,carHeight*.72);
  }
  function personFoot(){
    if(!photo)return H*.665;
    const scaledHeight=photo.height*Math.max(W/photo.width,H/photo.height);
    return scaledHeight*.693+(H-scaledHeight)*.54;
  }
  function paint(t = filmTime) {
    if(!W||!H)return;
    ctx.drawImage(station,0,0);
    person(ctx,W*.49,personFoot(),H*.178);if(t<6.2)person(ctx,W*.55,personFoot(),H*.17,true);
    drawTrain(t);
    ctx.drawImage(sheet,0,0);
    frameDirty=false;
  }

  const sound = (() => {
    let audio=null,out=null,bed=null,air=null,filter=null,tone=null,rolling=null,noise=null,enabled=false;
    function prepare(){
      if(audio)return;
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      audio=new AC();out=audio.createGain();out.gain.value=0;out.connect(audio.destination);
      const seconds=2;noise=audio.createBuffer(1,audio.sampleRate*seconds,audio.sampleRate);const n=noise.getChannelData(0),r=random(722);
      for(let i=0;i<n.length;i++)n[i]=r()*2-1;
      rolling=audio.createBufferSource();rolling.buffer=noise;rolling.loop=true;
      filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=400;
      air=audio.createGain();air.gain.value=0;rolling.connect(filter).connect(air).connect(out);rolling.start();
      tone=audio.createOscillator();tone.type='triangle';tone.frequency.value=53;bed=audio.createGain();bed.gain.value=0;tone.connect(bed).connect(out);tone.start();
    }
    function toggle(){
      try{prepare();}catch{return false;}if(!audio)return false;
      enabled=!enabled;if(enabled)audio.resume().catch(()=>{});out.gain.setTargetAtTime(enabled?.45:0,audio.currentTime,.09);return enabled;
    }
    function update(t,on){
      if(!audio||!enabled)return;
      const p=trainPhase(t),close=on&&p>0&&p<1?Math.pow(Math.sin(Math.PI*p),.56):0;
      const gap=openingArea, beat=.75+.25*Math.sin(14*t)**6;
      filter.frequency.setTargetAtTime(110+1200*gap+1240*close,audio.currentTime,.07);
      air.gain.setTargetAtTime((on?.018:0)+close*(.16+.30*gap)*beat,audio.currentTime,.09);
      bed.gain.setTargetAtTime((on?.021:0)+close*.065,audio.currentTime,.12);
      tone.frequency.setTargetAtTime(53+close*20,audio.currentTime,.05);
    }
    function rustle(){
      if(!audio||!enabled)return;
      const t=audio.currentTime,src=audio.createBufferSource(),bp=audio.createBiquadFilter(),v=audio.createGain();
      src.buffer=noise;bp.type='bandpass';bp.frequency.value=2300;bp.Q.value=.68;v.gain.setValueAtTime(.017,t);v.gain.linearRampToValueAtTime(.36,t+.014);v.gain.exponentialRampToValueAtTime(.0001,t+.14);
      src.connect(bp).connect(v).connect(out);src.start();src.stop(t+.145);src.onended=()=>{src.disconnect();bp.disconnect();v.disconnect();};
    }
    function quiet(){if(audio){air.gain.setTargetAtTime(0,audio.currentTime,.06);bed.gain.setTargetAtTime(0,audio.currentTime,.06);}}
    return {toggle,update,rustle,quiet};
  })();
  function updateClock(){
    const s=Math.floor(filmTime);if(s!==clockSecond){clockSecond=s;el('playhead').textContent='00:'+String(s).padStart(2,'0');timeRail.setAttribute('aria-valuenow',String(s));}
    progress.style.transform='scaleX('+Math.min(1,filmTime/duration)+')';
  }
  function setSceneText(message){if(sceneStatus.textContent!==message)sceneStatus.textContent=message;}
  function start(){
    if(opened)return;
    opened=true;playing=true;previous=0;el('stageHint').classList.add('gone');el('replay').disabled=false;el('autoTear').querySelector('span:last-child').textContent='크게 열기';
    setSceneText('막차가 들어옵니다. 손을 떼면 그 순간이 포스터에 담겨요.');queue();
  }
  function queue(){if(!animation && visible)animation=requestAnimationFrame(tick);}
  let lastPaint=0, lastSound=0;
  function tick(now){
    animation=0;
    if(playing){
      if(previous)filmTime=Math.min(duration,filmTime+Math.min(150,now-previous)/1000);
      previous=now;if(filmTime>=duration){playing=false;setSceneText('막차가 지나갔어요. 마지막 장면을 눌러 포스터에 담을 수 있어요.');}
    }
    if(auto)animateRip(now);
    if(frameDirty||now-lastPaint>=(reducedMotion?82:28)||!playing){paint();lastPaint=now;}
    updateClock();
    if(now-lastSound>70||!playing){sound.update(filmTime,playing);lastSound=now;}
    if(playing||auto)queue();
  }
  function begin(x,y,isAuto=false){
    if(stroke||(!isAuto&&auto))return;
    start();const s={points:[],distance:0,auto:isAuto};strokes.push(s);stroke=s;
    stroke.points.push({x:clip(x),y:clip(y),r:.006});sound.rustle();buildPaper();paint();
  }
  function drag(x,y){
    if(!stroke)return;
    x=clip(x);y=clip(y);const points=stroke.points,last=points[points.length-1];
    const dist=Math.hypot((x-last.x)*W/H,y-last.y);
    if(dist<.006)return;
    const pieces=Math.ceil(dist/.016);
    for(let i=1;i<=pieces;i++){
      const a=i/pieces;stroke.distance+=dist/pieces;
      const radius=stroke.auto?.013+.279*Math.sin(Math.min(1,stroke.distance/1.05)*Math.PI*.54):.012+Math.min(.217,stroke.distance*.29);
      points.push({x:last.x+(x-last.x)*a,y:last.y+(y-last.y)*a,r:radius});
    }
    buildPaper();paint();
  }
  function snapshot(){
    if(!opened)return;
    paint();const shot=document.createElement('canvas');shot.width=W;shot.height=H;shot.getContext('2d').drawImage(canvas,0,0);
    saved={image:shot,time:filmTime};el('savePoster').disabled=false;
  }
  function end(){
    if(!stroke)return;
    if(stroke.points.length>2){
      const ps=stroke.points;for(let i=0;i<Math.min(5,ps.length-1);i++){const j=ps.length-1-i;ps[j].r*=.24+.145*i;}
    }
    stroke=null;buildPaper();snapshot();
    setSceneText('손을 뗀 장면을 담았어요. 포스터 저장으로 내려받을 수 있어요.');
  }
  let autoIndex=0;
  function autoRip(){
    if(auto||stroke)return;
    const n=autoIndex++;
    auto={start:performance.now(),n};const p=autoPoint(0,n);begin(p.x,p.y,true);queue();
  }
  function autoPoint(t,n){
    const mid=n%3===0?.60:n%3===1?.39:.73,flip=n%2===1;
    return{x:flip?.94-t*.88:.06+t*.88,y:mid-.075*Math.sin(Math.PI*t)+.033*Math.sin(6*t+n*.7)};
  }
  function animateRip(now){
    const t=clip((now-auto.start)/(reducedMotion?260:1150));const p=autoPoint(smooth(t),auto.n);drag(p.x,p.y);
    if(t>=1){auto=null;end();}
  }
  function reset(){
    strokes=[];stroke=null;pointer=null;auto=null;saved=null;autoIndex=0;opened=false;playing=false;filmTime=0;previous=0;clockSecond=-1;
    sound.quiet();el('savePoster').disabled=true;el('replay').disabled=true;el('stageHint').classList.remove('gone');el('autoTear').querySelector('span:last-child').textContent='한 번에 열기';
    setSceneText('찢은 자리와 손을 뗀 순간을 한 장으로 간직할 수 있어요.');buildPaper();paint();updateClock();
  }
  function download(){
    if(!saved)return;
    const moment=saved.time,image=saved.image,frame=document.createElement('canvas'),long=1800,scale=long/image.width,margin=46;
    frame.width=long+2*margin;frame.height=Math.round(image.height*scale)+2*margin+75;
    const g=frame.getContext('2d');g.fillStyle='#eee7d6';g.fillRect(0,0,frame.width,frame.height);g.drawImage(image,margin,margin,long,image.height*scale);
    g.fillStyle='#1f2422';g.font='bold 36px Helvetica, Arial, sans-serif';g.fillText('LAST TRAIN',margin,frame.height-33);
    g.font='23px monospace';g.textAlign='right';g.fillText('NIGHT STUDIES   /   '+moment.toFixed(2)+' s',frame.width-margin,frame.height-34);
    try {frame.toBlob(blob=>{if(!blob){setSceneText('포스터 파일을 만들 수 없어요. 다시 시도해 주세요.');return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='last-train-'+String(Math.round(moment*100)).padStart(4,'0')+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      setSceneText('찢은 포스터를 PNG로 저장했어요.');},'image/png');}
    catch{setSceneText('로컬 웹 서버에서 열면 포스터를 저장할 수 있어요.');}
  }
  function coords(e){const b=canvas.getBoundingClientRect();return{x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height};}
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||pointer!==null||auto||stroke)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);
    const p=coords(e);begin(p.x,p.y);
  });
  canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;const p=coords(e);drag(p.x,p.y);});
  function release(e){if(e.pointerId!==pointer)return;pointer=null;end();}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(e.repeat)return;if(opened&&e.key===' '){snapshot();setSceneText('현재 장면을 포스터에 담았어요.');}else autoRip();}});
  el('autoTear').addEventListener('click',autoRip);el('replay').addEventListener('click',reset);el('savePoster').addEventListener('click',download);
  el('soundToggle').addEventListener('click',()=>{const active=sound.toggle();el('soundToggle').setAttribute('aria-pressed',String(active));el('soundLabel').textContent=active?'소리 끄기':'소리 켜기';el('soundToggle').setAttribute('aria-label',active?'현장음 끄기':'현장음 켜기');el('soundWaves').toggleAttribute('hidden',!active);el('soundSlash').toggleAttribute('hidden',active);sound.update(filmTime,playing);});
  window.trainHands={
    begin(x,y){if(pointer===null&&!auto)begin(x,y);},
    move(x,y){if(pointer===null&&!auto)drag(x,y);},
    end(){if(pointer===null&&!auto)end();}
  };
  document.addEventListener('visibilitychange',()=>{visible=!document.hidden;previous=0;if(!visible){sound.quiet();if(animation)cancelAnimationFrame(animation);animation=0;}else if(playing||auto)queue();});
  function resize(){
    const b=canvas.getBoundingClientRect();
    // Retain print detail when a portrait phone captures a poster.
    const pixel=Math.min(1620/b.width,Math.max(Math.min(2,window.devicePixelRatio||1),1100/b.width));
    const w=Math.max(1,Math.round(b.width*pixel)),h=Math.max(1,Math.round(b.height*pixel));
    if(W===w&&H===h)return;
    W=w;H=h;for(const surface of [canvas,sheet,printed,station]){surface.width=W;surface.height=H;}
    createPrint();createStation();buildPaper();paint();
  }
  function imageAsset(name,accept){
    const image=new Image();
    image.onload=()=>{accept(image);createPrint();createStation();buildPaper();paint();};
    image.src=new URL('../assets/'+name,origin).href;
  }
  createCarriage();resize();new ResizeObserver(resize).observe(canvas);updateClock();
  document.fonts.ready.then(()=>{createPrint();buildPaper();paint();});
  imageAsset('carriage.webp',v=>{trainPhoto=v;});
  imageAsset('poster.jpg',v=>{poster=v;});imageAsset('platform.jpg',v=>{photo=v;});
})();

'use strict';
(() => {
  const el = id => document.getElementById(id);
  const canvas = el('tearCanvas'), ctx = canvas.getContext('2d', {alpha: false});
  const sheet = document.createElement('canvas'), printed = document.createElement('canvas');
  const station = document.createElement('canvas'), carriage = document.createElement('canvas');
  const sceneStatus = el('sceneStatus'), seek = el('seek');
  const {stocks,formats} = window.TrainPrint;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clip = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = t => t * t * (3 - 2 * t);
  const duration = 12;
  let W = 0, H = 0, filmTime = .85, playing = false, previous = 0, animation = 0;
  let openingArea = .01, stroke = null, strokes = [], redo = [], pointer = null, auto = null, autoIndex=0;
  let photo = null, poster = null, trainPhoto = null, gradedTrain = null, visible = true, frameDirty = true;
  let design={stock:'vermilion',format:'print',title:'LAST TRAIN',subtitle:'종점행 · 마지막 열차',width:100};
  const origin = new URL('.', location.href);
  const marks = [.85,2.65,5.80,8.15,11.25];
  const labels = ['승강장','진입','교차','출발','종점'];
  let assetsReady,stockPhoto=null,background=null,photoRevision=0;
  let grainCache=null;
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
  function createPrint() {
    window.TrainPrint.compose(printed.getContext('2d'),W,H,design,poster,(c,w,h,seed,count,light)=>{
      if(grainCache?.width!==w||grainCache?.height!==h||grainCache.light!==light){
        const layer=document.createElement('canvas');layer.width=w;layer.height=h;
        grain(layer.getContext('2d'),w,h,seed,count,light);grainCache={width:w,height:h,light,layer};
      }
      c.drawImage(grainCache.layer,0,0);
    });
  }
  function gradeCarriage() {
    const src=trainPhoto || carriage;
    gradedTrain=document.createElement('canvas');gradedTrain.width=src.width;gradedTrain.height=src.height;
    const c=gradedTrain.getContext('2d');c.filter=stocks[design.stock].filter;c.drawImage(src,0,0);
  }
  function createStation() {
    const c=station.getContext('2d');c.clearRect(0,0,W,H);
    if(photo){c.save();c.filter=stocks[design.stock].filter;cover(c,photo,W,H,(background?.panX??50)/100,(background?.panY??54)/100);c.restore();}
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
    if(points.length===1){const p=points[0];path.ellipse(p.x*W,p.y*H,p.r*H*design.width*.014,p.r*H*design.width*.01,-.25,0,Math.PI*2);return path;}
    const upper=[],lower=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const dx=(b.x-a.x)*W,dy=(b.y-a.y)*H,length=Math.hypot(dx,dy)||1;
      const nx=-dy/length,ny=dx/length;
      const phase=i*.165+points[0].x*15;
      const base=p.r*H*design.width/100;
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
      c.fillStyle=stocks[design.stock].rim;c.fill(shape);c.lineWidth=Math.max(2,H*.009);c.strokeStyle=stocks[design.stock].shadow;c.stroke(shape);
      c.lineWidth=Math.max(1,H*.005);c.strokeStyle=stocks[design.stock].rim;c.stroke(shape);
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
  function drawTrain(t,ctx) {
    const phase=trainPhase(t);if(phase<=0||phase>=1)return;
    const sprite=gradedTrain || trainPhoto || carriage;
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
    if(background||!photo)return H*.665;
    const scaledHeight=photo.height*Math.max(W/photo.width,H/photo.height);
    return scaledHeight*.693+(H-scaledHeight)*.54;
  }
  function paintScene(context,t) {
    context.drawImage(station,0,0);
    if(background&&!background.actors)return;
    person(context,W*.49,personFoot(),H*.178);
    if(t<6.2)person(context,W*.55,personFoot(),H*.17,true);
    drawTrain(t,context);
  }
  function paint(t=filmTime){
    if(!W||!H)return;
    paintScene(ctx,t);ctx.drawImage(sheet,0,0);frameDirty=false;
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
    el('playhead').textContent='00:'+filmTime.toFixed(1).padStart(4,'0');
    seek.value=String(filmTime);
    el('playToggle').classList.toggle('playing',playing);
    el('playLabel').textContent=playing?'정지':'재생';
    el('playToggle').setAttribute('aria-label',playing?'현재 프레임에서 정지':'필름 재생');
    document.querySelectorAll('[data-frame]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(filmTime-Number(b.dataset.frame))<=.03)));
  }
  function setSceneText(message){if(sceneStatus.textContent!==message)sceneStatus.textContent=message;}
  function queue(){if(!animation && visible)animation=requestAnimationFrame(tick);}
  function pause(){
    const wasPlaying=playing;playing=false;previous=0;sound.quiet();updateClock();if(wasPlaying)paint();
  }
  function play(){
    if(filmTime>=duration)filmTime=0;
    playing=true;previous=0;updateClock();queue();
  }
  function seekTo(t){
    if(auto){auto=null;end();}
    pause();filmTime=clip(Number(t),0,duration);updateClock();paint();
  }
  let lastPaint=0,lastSound=0;
  function tick(now){
    animation=0;
    if(playing){
      if(previous)filmTime=Math.min(duration,filmTime+Math.max(0,now-previous)/1000);
      previous=now;
      if(filmTime>=duration){pause();setSceneText('막차가 지나간 뒤의 장면입니다.');}
    }
    if(auto)animateRip(now);
    if(frameDirty||now-lastPaint>=(reducedMotion?82:28)||!playing){paint();lastPaint=now;updateClock();}
    if(now-lastSound>70||!playing){sound.update(filmTime,playing);lastSound=now;}
    if(playing||auto)queue();
  }
  function undoUI(){
    el('undoCut').disabled=!strokes.length||!!stroke;
    el('redoCut').disabled=!redo.length||!!stroke;
  }
  function undoCut(forward){
    if(stroke||auto)return;
    const from=forward?redo:strokes,to=forward?strokes:redo;
    if(!from.length)return;
    pause();to.push(from.pop());buildPaper();paint();undoUI();
    setSceneText(forward?'찢은 자리를 다시 적용했어요.':'마지막 찢기를 취소했어요.');
  }
  function begin(x,y,isAuto=false){
    if(stroke||(!isAuto&&auto))return;
    if(strokes.length>=180){setSceneText('찢은 자리가 180개예요. 일부를 취소한 뒤 편집해 주세요.');return;}
    pause();redo=[];const s={points:[],distance:0,auto:isAuto};strokes.push(s);stroke=s;undoUI();
    stroke.points.push({x:clip(x),y:clip(y),r:.006});sound.rustle();buildPaper();paint();
  }
  function drag(x,y){
    if(!stroke)return;
    x=clip(x);y=clip(y);const points=stroke.points,last=points[points.length-1];
    const dist=Math.hypot((x-last.x)*W/H,y-last.y);
    if(dist<.006||points.length>3000)return;
    const pieces=Math.ceil(dist/.016);
    for(let i=1;i<=pieces;i++){
      const a=i/pieces;stroke.distance+=dist/pieces;
      const radius=stroke.auto?.013+.279*Math.sin(Math.min(1,stroke.distance/1.05)*Math.PI*.54):.012+Math.min(.217,stroke.distance*.29);
      points.push({x:last.x+(x-last.x)*a,y:last.y+(y-last.y)*a,r:radius});
    }
    buildPaper();paint();
  }
  function end(){
    if(!stroke)return;
    if(stroke.points.length>2){
      const ps=stroke.points;
      for(let i=0;i<Math.min(5,ps.length-1);i++){const j=ps.length-1-i;ps[j].r*=.24+.145*i;}
    }
    stroke=null;buildPaper();paint();undoUI();
    setSceneText('찢은 자리를 반영했어요. 타임라인에서 인쇄할 장면을 골라보세요.');
  }
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
  function download(){
    if(auto){auto=null;end();}
    pause();paint();
    const clean=(design.title.trim()||'LAST TRAIN').replace(/[\\/:*?"<>|]/g,'-').slice(0,55);
    const name=clean+'-'+filmTime.toFixed(2)+'s.png';
    try{
      canvas.toBlob(blob=>{
        if(!blob){setSceneText('이미지를 만들 수 없어요. 다시 시도해 주세요.');return;}
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
        setSceneText(name+' 파일을 내보냈어요.');
      },'image/png');
    }catch{setSceneText('웹 서버를 통해 열면 포스터를 내보낼 수 있어요.');}
  }
  function coords(e){const b=canvas.getBoundingClientRect();return{x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height};}
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||pointer!==null||auto||stroke)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);
    const p=coords(e);begin(p.x,p.y);
  });
  canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;const p=coords(e);drag(p.x,p.y);});
  function release(e){if(e.pointerId!==pointer)return;pointer=null;end();}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);

  function layoutCanvas(){
    if(!W||!H)return;
    const board=el('trainStage').getBoundingClientRect();
    const inset=board.width<480?12:24;
    const scale=Math.min((board.width-2*inset)/W,(board.height-2*inset)/H);
    const mount=el('paperMount');
    mount.style.width=Math.max(1,Math.round(W*scale))+'px';
    mount.style.height=Math.max(1,Math.round(H*scale))+'px';
    canvas.style.width='100%';
  }
  function makeFilmstrip(){
    const strip=el('filmstrip');
    marks.forEach((time,index)=>{
      const button=document.createElement('button'),thumb=document.createElement('canvas'),tag=document.createElement('span');
      button.type='button';button.dataset.frame=time;button.setAttribute('aria-label',labels[index]+' 장면, '+time.toFixed(2)+'초');
      thumb.width=240;thumb.height=96;thumb.setAttribute('aria-hidden','true');
      tag.textContent=time.toFixed(1)+'s';button.title=labels[index];
      button.append(thumb,tag);strip.append(button);
      button.addEventListener('click',()=>{seekTo(time);setSceneText(labels[index]+' 장면을 골랐어요.');});
    });
  }
  function renderFilmstrip(){
    el('filmstrip').querySelectorAll('button').forEach((button,index)=>{
      const thumb=button.firstChild,c=thumb.getContext('2d');
      const z=Math.max(thumb.width/W,thumb.height/H);
      c.save();c.translate((thumb.width-W*z)/2,(thumb.height-H*z)*.51);c.scale(z,z);
      paintScene(c,marks[index]);c.restore();
    });
  }
  function syncControls(){
    el('filmTitle').value=design.title;el('subtitle').value=design.subtitle;
    el('cutWidth').value=design.width;el('widthValue').textContent=design.width+'%';
    el('paperName').textContent=stocks[design.stock].name;
    el('backgroundName').textContent=background?.name||'자정의 승강장';el('resetBackground').hidden=!background;
    el('photoFraming').hidden=!background;
    if(background){
      const scale=Math.max(W/photo.width,H/photo.height);
      for(const [id,key,overflow] of [['photoPanX','panX',photo.width*scale-W],['photoPanY','panY',photo.height*scale-H]]){
        el(id).value=background[key];el(id).disabled=overflow<1;
      }
      el('photoActors').checked=background.actors;
    }
    el('printDimensions').textContent=W+' × '+H+' px';
    for(const key of ['stock','format']){
      document.querySelectorAll('[data-'+key+']').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[key]===design[key])));
    }
    undoUI();updateClock();
  }
  function rebuildDesign(){
    const [width,height]=formats[design.format];
    if(width!==W||height!==H){
      W=width;H=height;
      for(const surface of [canvas,sheet,printed,station]){surface.width=W;surface.height=H;}
      layoutCanvas();
    }
    createPrint();createStation();gradeCarriage();buildPaper();paint();renderFilmstrip();syncControls();
  }
  function changeOption(key,value){
    if(design[key]===value)return;
    seekTo(filmTime);design[key]=value;rebuildDesign();
  }
  for(const key of ['stock','format']){
    document.querySelectorAll('[data-'+key+']').forEach(button=>button.addEventListener('click',()=>changeOption(key,button.dataset[key])));
  }
  for(const [id,key] of [['filmTitle','title'],['subtitle','subtitle']]){
    el(id).addEventListener('input',e=>{
      pause();design[key]=e.currentTarget.value;createPrint();buildPaper();paint();
    });
  }
  el('cutWidth').addEventListener('input',e=>{
    pause();design.width=Number(e.currentTarget.value);el('widthValue').textContent=design.width+'%';buildPaper();paint();
  });
  seek.addEventListener('input',()=>seekTo(seek.value));
  el('playToggle').addEventListener('click',()=>playing?pause():play());
  el('replay').addEventListener('click',()=>{seekTo(0);play();});
  el('soundToggle').addEventListener('click',e=>{
    const enabled=sound.toggle();e.currentTarget.setAttribute('aria-pressed',String(enabled));
    e.currentTarget.textContent='현장음 '+(enabled?'켬':'끔');sound.update(filmTime,playing);
  });
  el('savePoster').addEventListener('click',download);
  el('autoTear').addEventListener('click',autoRip);
  el('undoCut').addEventListener('click',()=>undoCut(false));
  el('redoCut').addEventListener('click',()=>undoCut(true));
  canvas.addEventListener('keydown',e=>{
    if(el('ns-library')?.open)return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      e.preventDefault();seekTo(filmTime+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:.05));
    }else if(e.key==='Enter'){
      e.preventDefault();if(!e.repeat)autoRip();
    }else if(e.code==='Space'){
      e.preventDefault();if(!e.repeat){if(playing)pause();else play();}
    }else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){
      e.preventDefault();undoCut(e.shiftKey);
    }
  });
  const canUseHands=()=>W>0&&!el('ns-library')?.open&&pointer===null&&!auto;
  let handDrawing=false;
  window.trainHands={
    begin(x,y){if(canUseHands()&&!stroke&&Number.isFinite(x)&&Number.isFinite(y)){begin(x,y);handDrawing=!!stroke;}},
    move(x,y){if(handDrawing&&canUseHands()&&Number.isFinite(x)&&Number.isFinite(y))drag(x,y);},
    end(){if(handDrawing){handDrawing=false;end();}}
  };
  document.addEventListener('visibilitychange',()=>{
    visible=!document.hidden;previous=0;
    if(!visible){sound.quiet();if(auto){auto=null;end();}}
    else if(playing)queue();
  });
  function editionCut(house=false){
    return Array.from({length:97},(_,i)=>{
      const t=i/96,curve=Math.sin(Math.PI*t),detail=.01*Math.sin(t*12);
      const x=house?.050+.905*t:.073+.859*t;
      const y=house?.671-.342*t+.044*Math.sin(t*6.7)+detail:.606-.12*t+.026*Math.sin(t*8.5)+detail;
      const r=.001+(house?.189:.151)*Math.pow(curve,.68);
      return [x,y,r];
    });
  }
  function selectBackground(record,image){
    background=record;photo=image||stockPhoto;createStation();paint();renderFilmstrip();syncControls();
  }
  function decodePhoto(url){
    return new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('사진을 열 수 없어요. JPG, PNG, WebP 이미지를 골라 주세요.'));img.src=url;
    });
  }
  async function importBackground(file){
    if(!file)return;
    const revision=++photoRevision,status=el('photoStatus');status.textContent='사진을 준비하고 있어요.';
    let url;
    try{
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>32*1024*1024)throw Error('32 MB 이하의 JPG, PNG, WebP 이미지를 골라 주세요.');
      url=URL.createObjectURL(file);const img=await decodePhoto(url),scale=Math.min(1,1600/Math.max(img.width,img.height));
      const scaled=document.createElement('canvas');scaled.width=Math.max(1,Math.round(img.width*scale));scaled.height=Math.max(1,Math.round(img.height*scale));
      const c=scaled.getContext('2d');c.fillStyle='#202727';c.fillRect(0,0,scaled.width,scaled.height);c.drawImage(img,0,0,scaled.width,scaled.height);
      const data=scaled.toDataURL('image/jpeg',.84),result=await decodePhoto(data);
      if(revision!==photoRevision)return;
      const name=file.name.replace(/\.[^.]+$/,'').trim().slice(0,80)||'내 사진';
      seekTo(filmTime);selectBackground({name,data,panX:50,panY:54,actors:true},result);status.textContent='';setSceneText('내 사진을 필름 배경으로 적용했어요.');
    }catch(error){if(revision===photoRevision)status.textContent=error.message;}
    finally{if(url)URL.revokeObjectURL(url);}
  }
  for(const [id,key] of [['photoPanX','panX'],['photoPanY','panY'],['photoActors','actors']]){
    el(id).addEventListener('input',e=>{
      if(!background)return;
      pause();background[key]=key==='actors'?e.target.checked:Number(e.target.value);
      createStation();paint();renderFilmstrip();
    });
  }
  el('pickBackground').addEventListener('click',()=>el('backgroundFile').click());
  el('backgroundFile').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';importBackground(file);});
  el('resetBackground').addEventListener('click',()=>{photoRevision++;el('photoStatus').textContent='';seekTo(filmTime);selectBackground(null,null);setSceneText('자정의 승강장으로 돌아왔어요.');});
  function state(){
    seekTo(filmTime);
    return {version:1,design:{...design},background:background?{...background}:null,time:filmTime,cuts:strokes.map(s=>s.points.map(p=>[p.x,p.y,p.r])),autoIndex};
  }
  function example(){
    return {version:1,design:{stock:'blueprint',format:'print',width:116,title:'마지막 안내방송',subtitle:'23시 59분, 건너편 승강장에서'},time:5.8,cuts:[editionCut(true)],autoIndex:1};
  }
  function readProject(data){
    const fail=()=>{throw Error('이 포스터 프로젝트의 편집 데이터를 읽을 수 없습니다.');};
    const bounded=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
    const d=data?.design;
    if(data?.version!==1||!d||typeof d.stock!=='string'||typeof d.format!=='string'||!Object.hasOwn(stocks,d.stock)||!Object.hasOwn(formats,d.format)||
      typeof d.title!=='string'||d.title.length>40||typeof d.subtitle!=='string'||d.subtitle.length>52||
      !Number.isInteger(d.width)||!bounded(d.width,35,175)||!bounded(data.time,0,12)||
      !Number.isSafeInteger(data.autoIndex)||!bounded(data.autoIndex,0,1e8)||!Array.isArray(data.cuts)||data.cuts.length>180)fail();
    const b=data.background;
    if(b!=null&&(typeof b.name!=='string'||b.name.length>80||typeof b.data!=='string'||b.data.length>4000000||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(b.data)))fail();
    if(b&&((b.panX!==undefined&&!bounded(b.panX,0,100))||(b.panY!==undefined&&!bounded(b.panY,0,100))||(b.actors!==undefined&&typeof b.actors!=='boolean')))fail();
    const cuts=data.cuts.map(points=>{
      if(!Array.isArray(points)||!points.length||points.length>3200)fail();
      return {auto:false,distance:0,points:points.map(p=>{
        if(!Array.isArray(p)||p.length!==3||!bounded(p[0],0,1)||!bounded(p[1],0,1)||!bounded(p[2],0,.35))fail();
        return {x:p[0],y:p[1],r:p[2]};
      })};
    });
    return {background:b?{name:b.name,data:b.data,panX:b.panX??50,panY:b.panY??54,actors:b.actors??true}:null,design:{stock:d.stock,format:d.format,title:d.title,subtitle:d.subtitle,width:d.width},time:data.time,autoIndex:data.autoIndex,strokes:cuts};
  }
  async function restore(data){
    const next=readProject(data);await assetsReady;
    const image=next.background?await decodePhoto(next.background.data):null;
    if(image&&Math.max(image.width,image.height)>1600)throw Error('이 프로젝트의 배경 사진이 너무 큽니다.');
    photoRevision++;background=next.background;photo=image||stockPhoto;el('photoStatus').textContent='';
    auto=null;stroke=null;handDrawing=false;
    if(pointer!==null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
    pointer=null;pause();redo=[];
    design=next.design;filmTime=next.time;autoIndex=next.autoIndex;strokes=next.strokes;
    rebuildDesign();setSceneText('저장된 프레임과 인쇄 설정을 불러왔어요.');
  }
  function getPreview(){
    const preview=document.createElement('canvas'),scale=Math.min(370/W,320/H);
    preview.width=Math.max(1,Math.round(W*scale));preview.height=Math.max(1,Math.round(H*scale));
    try{preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);return preview.toDataURL('image/jpeg',.77);}catch{return '';}
  }
  function imageAsset(file){
    return new Promise(resolve=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=new URL('../assets/'+file,origin);
    });
  }
  makeFilmstrip();createCarriage();
  const fonts=Promise.allSettled([document.fonts.load('650 72px BarlowCondensed'),document.fonts.load('400 72px InstrumentSerif')]);
  assetsReady=Promise.all([imageAsset('platform.jpg'),imageAsset('poster.jpg'),imageAsset('carriage.webp'),fonts]).then(([stationPhoto,printPhoto,carPhoto])=>{
    stockPhoto=stationPhoto;photo=stockPhoto;poster=printPhoto;trainPhoto=carPhoto;
    const initial=readProject({version:1,design,time:filmTime,cuts:[editionCut()],autoIndex:0});
    strokes=initial.strokes;rebuildDesign();document.querySelector('main').inert=false;
    document.documentElement.dataset.trainReady='true';
  });
  document.addEventListener('click',e=>{
    if(W&&e.target.closest('[data-library],[data-save-project]'))seekTo(filmTime);
  },true);
  const observer=new ResizeObserver(layoutCanvas);observer.observe(el('trainStage'));
  assetsReady.then(()=>window.NightLibrary?.register({getState:state,restore,getTitle:()=>design.title.trim()||'LAST TRAIN',getPreview,getExample:example}));
})();

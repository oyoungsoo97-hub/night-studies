import {Dust,validDust} from './dust.mjs?v=e2b454758d';
import {Sky,spectra} from './sky.mjs?v=c628a02749';
import {grip,aim,charge,launch} from './casting.mjs?v=f02a4755e5';
import {makeSpellAudio} from './sound.mjs?v=983a4b9125';
import {readPose} from './gestures.mjs?v=36f5a506df';
import {T,counter,dustCounter} from './words.mjs?v=67bd3975fe';
const $=id=>document.getElementById(id),canvas=$('stage'),video=$('sensor');
const W=1600,H=1000,spells=['dust','bolt','shield','ink','nova','gate'],maxMarks=72;
const clip=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const scene={color:'vesper',power:75,tool:'dust',marks:[]};
const dust=new Dust(),dustUndo=[],dustPointers=new Map();dust.reduced=reduced;
const drift=()=>scene.tool==='dust'?dust:null;
let dustDirty=false;
let sky,draft=null,owner=null,pointer=null,keyboard={x:.5,y:.47},cursor=[],bursts=[];
let motion='dustReady',notice='dustKeys',cameraMode='off',controller=null,session=null,revision=0;
let handState=new Map(),openSince=0,singleLatch=false,calibration=null,calibrationTimer=0,calibrated=0;
let phase=0,lastTick=null,raf=0,lastDraw=-1000,phaseAtSave=0,houseTitle=false;
let gateSeenAt=-Infinity,wardSeenAt=-Infinity;
let pendingClear=null,casting=null,flights=[],handFired=false,lastWardCue=0,hover=null;
const fx=makeSpellAudio();
const recorder=document.querySelector('[data-record-stage]');
if(recorder)recorder.getAudioStream=()=>fx.enabled?fx.getStream():null;
const cue=(kind,x,power=scene.power/100)=>fx.cue(kind,{x:clip(x),power:clip(power)});
function soundUI(){text('sound',T(fx.enabled?'soundOn':'soundOff'));$('sound').setAttribute('aria-pressed',String(fx.enabled));}
$('sound').addEventListener('click',async()=>{
 try{const on=await fx.setEnabled(!fx.enabled);if(on)cue('ink',.5,.45);}catch{say('soundFail');}
 soundUI();document.dispatchEvent(new Event('night-stage-audio'));
});
function hush(){fx.stop();soundUI();document.dispatchEvent(new Event('night-stage-audio'));}

function text(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value;}
function ui(){
 document.querySelectorAll('[data-t]').forEach(n=>{const value=T(n.dataset.t);if(n.textContent!==value)n.textContent=value;});
 soundUI();
 const live=cameraMode==='on';
 canvas.setAttribute('aria-label',T('scope'));$('expand').setAttribute('aria-label',T(document.fullscreenElement?'collapse':'expand'));$('expand').lastElementChild.textContent=T(document.fullscreenElement?'collapse':'expand');
 text('cameraText',T(live?'stop':cameraMode==='starting'?'cancelCamera':'start'));text('modeName',T(live?'live':'practice'));text('notice',T(notice));text('lastMotion',T(motion));text('spellCount',drift()?dustCounter(dust.count(scene.power)):counter(scene.marks.length));text('powerValue',scene.power+'%');
 $('theatre').dataset.camera=cameraMode;$('stage').dataset.spellCount=scene.marks.length;
 $('cameraDesk').hidden=!live;$('power').value=scene.power;
 $('undo').disabled=!scene.marks.length&&!(drift()&&dustUndo.length);$('clear').disabled=!scene.marks.length&&!(drift()&&dustDirty);
 document.querySelector('label[for=power]').textContent=T(drift()?'dustIntensity':'power');
 document.querySelector('#clearDialog p').textContent=T(drift()?'dustClear':'clearAsk');
 document.querySelector('[data-t="guide"]').textContent=T(live?'guideLive':'guide');
 document.querySelectorAll('[data-guide]').forEach(el=>el.textContent=T(el.dataset.guide+(live?'Live':'Practice')));
 document.querySelectorAll('[data-color]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.color===scene.color)));
 document.querySelectorAll('[data-spell]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.spell===scene.tool)));
}
document.addEventListener('night-language',ui);
function say(code){notice=code;text('notice',T(code));}
function newMark(type,x,y,radius=.11){
 return {type,x:clip(x),y:clip(y),radius:clip(radius,.035,.39),color:scene.color,power:scene.power,seed:Math.floor(Math.random()*65535)};
}
function addBurst(m,point){
 bursts=bursts.slice(-8);bursts.push({type:m.type,x:point?.[0]??m.x,y:point?.[1]??m.y,color:m.color,seed:m.seed,scale:m.type==='ink'?.06:m.radius,start:phase,power:m.power/100});
}
function commit(mark){
 if(!mark)return;
 if(scene.marks.length>=maxMarks){say('max');return;}
 scene.marks.push(mark);motion=mark.type+'Cast';
 if(mark.type==='bolt'){
  const duration=reduced?0:900-340*mark.speed-100*mark.charge;
  flights=flights.slice(-5);flights.push({mark,start:phase,duration});cue('bolt',mark.x,.43+.50*mark.charge);
 }else{
  addBurst(mark,mark.points?.at(-1));
  if(mark.type!=='shield')cue(mark.type,mark.points?.at(-1)?.[0]??mark.x,mark.power/100);
 }
 ui();
}
function cancelDraft(){draft=null;owner=null;casting=null;$('castMeter').hidden=true;}
function finish(which,now=performance.now(),fireBolt=true){
 if(owner!==which)return;
 if(draft?.type==='ink'&&draft.points.length===1){
  const [x,y]=draft.points[0];draft.points.push([clip(x+.0008),y]);
 }
 let mark=draft;
 if(draft?.type==='shield'&&casting)draft.radius=.075+charge(casting,now)*(.115+.08*scene.power/100);
 if(draft?.type==='bolt')mark=fireBolt&&casting?launch(casting,now,draft,scene.marks):null;
 cancelDraft();commit(mark);
}
function begin(type,p,source,now=performance.now(),angle=-.5){
 flights=flights.filter(f=>!f.welcome);
 if(draft||scene.marks.length>=maxMarks){if(scene.marks.length>=maxMarks)say('max');return;}
 if(type==='nova'){commit(newMark('nova',p.x,p.y,.056+.10*scene.power/100));return;}
 if(type==='ink')draft={type,points:[[p.x,p.y]],color:scene.color,power:scene.power,seed:Math.floor(Math.random()*65535)};
 else draft=newMark(type,p.x,p.y,type==='shield'?.075:.085+.045*scene.power/100);
 if(type==='bolt'||type==='shield'){
  casting=grip(p,now,angle);cue(type==='bolt'?'charge':'shield',p.x);lastWardCue=now;
  $('castMeter').hidden=false;text('castLabel',T(type==='bolt'?'charging':'shielding'));
 }
 owner=source;
}
function move(p,source,now=performance.now()){
 if(!draft||owner!==source)return;
 if(casting){
  aim(casting,p,now);
  if(draft.type==='shield'){draft.x=p.x;draft.y=p.y;}
 }else if(draft.type==='ink'){
  const points=draft.points,last=points.at(-1);
  if(points.length>=1200||Math.hypot((p.x-last[0])*1.6,p.y-last[1])<.003)return;
  points.push([p.x,p.y]);
 }else{draft.radius=clip(Math.hypot((p.x-draft.x)*1.6,p.y-draft.y),.05,.34);}
}
function animateCasting(now){
 if(!casting||!draft)return;
 const q=charge(casting,now);$('chargeLevel').value=q;
 if(draft.type==='shield'){
  draft.radius=.075+q*(.115+.08*scene.power/100);
  if(now-lastWardCue>1500){cue('shield',draft.x,.40);lastWardCue=now;}
 }
}
function wandAt(now){
 if(casting&&draft?.type==='bolt')return {...casting.point,color:scene.color,angle:casting.angle,charge:charge(casting,now),trail:casting.history};
 if(scene.tool==='bolt'&&cameraMode==='off'&&hover)return {...hover,color:scene.color,angle:hover.angle??-.48,charge:0};
 return null;
}
function resolveFlights(){
 const flying=[];
 for(const shot of flights){
  if(phase-shot.start<shot.duration){flying.push(shot);continue;}
  const m=shot.mark;
  addBurst({...m,x:m.endX,y:m.endY,radius:.11+.12*m.charge+.06*m.speed});
  if(m.blocked){
   const shield=scene.marks.find(s=>s.type==='shield'&&Math.abs(Math.hypot((m.endX-s.x)*1.6,m.endY-s.y)-s.radius*.94)<.009);
   if(shield)bursts.at(-1).ward=shield;
  }
  if(!shot.welcome){cue('impact',m.endX,.48+.45*m.charge);motion=m.blocked?'deflect':'hit';text('lastMotion',T(motion));}
 }
 flights=flying;
}
function dustInput(key,mode,p,now){
 const old=dust.hands.get(key)?.mode;
 if((!old&&!dust.hands.size)||(mode==='gather'&&old&&old!=='gather')){
  dustUndo.push(dust.snapshot());if(dustUndo.length>6)dustUndo.shift();
 }
 if(mode==='gather'&&old!=='gather')cue('ink',p.x,.30);
 dust.input(key,mode,p,now);
 if(mode!==old){
  if(mode==='carry'&&old==='gather')cue('impact',p.x,.28);
  dustDirty=true;motion=mode==='gather'?'dustGather':old==='gather'?'dustFan':'dustCarry';ui();
 }
}
function dustRelease(key,scatter){
 const h=dust.hands.get(key);
 if(h?.mode==='gather'&&scatter){motion='dustFan';cue('impact',h.x,.28);}
 dust.release(key,scatter);ui();
}
function undo(){cancelDraft();if(drift()&&dustUndo.length){dust.restore(dustUndo.pop());motion='dustUndo';ui();return;}if(scene.marks.pop()){bursts=[];flights=[];motion='undone';ui();}}
function rect(){
 const b=canvas.getBoundingClientRect(),z=Math.min(b.width/W,b.height/H);
 return {x:b.left+(b.width-W*z)/2,y:b.top+(b.height-H*z)/2,w:W*z,h:H*z};
}
function point(event){const b=rect();return {x:clip((event.clientX-b.x)/b.w),y:clip((event.clientY-b.y)/b.h)};}
canvas.addEventListener('pointerdown',e=>{
 if(drift()){
  if(e.button!==0||dustPointers.size>=2)return;
  e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
  if(!dustPointers.size)dust.stop();
  const p=point(e),key='pointer-'+e.pointerId;dustPointers.set(e.pointerId,key);keyboard=p;
  if(e.shiftKey&&e.pointerType!=='touch'){dust.input('fixed-point','carry',p,performance.now());}
  dustInput(key,'gather',p,performance.now());
  if(dust.hands.size>1){motion='dustStretch';ui();}
  return;
 }
 if(e.button!==0||pointer!==null||draft)return;
 e.preventDefault();canvas.focus({preventScroll:true});pointer=e.pointerId;canvas.setPointerCapture(pointer);
 const p=point(e);keyboard=p;hover=p;cursor=[p];if(drift())dustInput('pointer','gather',p,performance.now());else begin(scene.tool,p,'pointer');
});
canvas.addEventListener('pointermove',e=>{
 const p=point(e);
 if(drift()&&dustPointers.has(e.pointerId)){dustInput(dustPointers.get(e.pointerId),'gather',p,performance.now());return;}
 if(pointer===null&&e.pointerType==='mouse'){hover=p;return;}
 if(pointer!==e.pointerId)return;keyboard=p;hover=p;cursor=[p];if(drift())dustInput('pointer','gather',p,performance.now());else move(p,'pointer');
});
canvas.addEventListener('pointerleave',()=>{if(pointer===null)hover=null;});
function release(e){
 if(dustPointers.has(e.pointerId)){
  const key=dustPointers.get(e.pointerId);dustPointers.delete(e.pointerId);dust.release('fixed-point',false);
  dustRelease(key,e.type==='pointerup'&&!dustPointers.size);if(dustPointers.size){motion='dustGather';ui();}return;
 }
 if(pointer!==e.pointerId)return;pointer=null;if(drift())dustRelease('pointer',e.type==='pointerup');else finish('pointer',performance.now(),e.type==='pointerup');cursor=[];if(e.pointerType!=='mouse')hover=null;}
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
canvas.addEventListener('keydown',e=>{
 if($('ns-library')?.open||$('clearDialog').open)return;
 if(e.key.startsWith('Arrow')){
  e.preventDefault();const d=e.shiftKey?.08:.025;
  keyboard={x:clip(keyboard.x+({'ArrowLeft':-d,'ArrowRight':d}[e.key]||0)),y:clip(keyboard.y+({'ArrowUp':-d,'ArrowDown':d}[e.key]||0))};
  cursor=[keyboard];hover=keyboard;if(drift()&&dust.hands.has('keyboard'))dustInput('keyboard','gather',keyboard,performance.now());else move(keyboard,'keyboard');
 }else if(e.key==='Enter'||e.code==='Space'){
  e.preventDefault();if(e.repeat)return;
  if(drift()){if(dust.hands.has('keyboard')){dust.release('fixed-key',false);dustRelease('keyboard',true);}else dustInput('keyboard','gather',keyboard,performance.now());}
  else if(owner==='keyboard')finish('keyboard');
  else if(['ink','bolt','shield'].includes(scene.tool)){begin(scene.tool,keyboard,'keyboard');say(scene.tool==='ink'?'inkKey':'castKey');}
  else commit(newMark(scene.tool,keyboard.x,keyboard.y,scene.tool==='nova'?.11:.15));
 }else if(drift()&&e.key.toLowerCase()==='x'){
  e.preventDefault();if(dust.hands.has('fixed-key')){dustRelease('fixed-key',false);}else{
   dustInput('fixed-key','carry',keyboard,performance.now());if(!dust.hands.has('keyboard'))dustInput('keyboard','gather',keyboard,performance.now());motion='dustStretch';ui();
  }
 }else if(e.key==='Escape'){cancelDraft();dust.release('keyboard',false);dust.release('fixed-key',false);cursor=[];}
});
canvas.addEventListener('blur',()=>{dust.release('keyboard',false);dust.release('fixed-key',false);if(owner==='keyboard')finish('keyboard',performance.now(),false);if(cameraMode!=='on')cursor=[];});
for(const b of document.querySelectorAll('[data-spell]'))b.addEventListener('click',()=>{if(owner==='keyboard')finish(owner,performance.now(),false);if(owner?.startsWith('hand'))finish(owner,performance.now(),false);dust.stop();dustPointers.clear();scene.tool=b.dataset.spell;
 motion=drift()?'dustReady':'first';if(cameraMode==='off')say(drift()?'dustKeys':'idleNotice');ui();});
for(const b of document.querySelectorAll('[data-color]'))b.addEventListener('click',()=>{scene.color=b.dataset.color;ui();});
$('power').addEventListener('input',()=>{scene.power=Number($('power').value);ui();});
$('undo').addEventListener('click',undo);$('clear').addEventListener('click',()=>{if(scene.marks.length||(drift()&&dustDirty)){pendingClear=scene.marks;$('clearDialog').showModal();}});
$('clearDialog').addEventListener('close',()=>{
 if($('clearDialog').returnValue==='clear'&&pendingClear===scene.marks){cancelDraft();scene.marks=[];bursts=[];flights=[];dust.reset();dustUndo.length=0;dustDirty=false;motion='cleared';ui();}
 pendingClear=null;$('clearDialog').returnValue='';
});
$('expand').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('theatre').requestFullscreen();}catch{say('expandFail');}});
document.addEventListener('fullscreenchange',ui);
function resetHands(){
 for(const key of handState.keys())dust.release('hand-'+key,false);
 handState.clear();singleLatch=false;handFired=false;openSince=0;cursor=[];
 if(owner?.startsWith('hand'))finish(owner,performance.now(),false);
}
function displayHand(p){
 const vw=video.videoWidth||640,vh=video.videoHeight||480,zoom=Math.max(W/vw,H/vh);
 return {x:clip(.5+(.5-p.x)*vw*zoom/W),y:clip(.5+(p.y-.5)*vh*zoom/H)};
}
function captureHands(frame){
 if(cameraMode!=='on'||$('ns-library')?.open||$('clearDialog').open){resetHands();return;}
 const previous=handState;handState=new Map();
 const ratio=(video.videoWidth||640)/(video.videoHeight||480);
 for(const [i,input] of frame.hands.slice(0,2).entries()){
  let key=input.handedness||String(i);if(handState.has(key))key+='-2';
  const pose=readPose(input,ratio,calibrated,displayHand,previous.get(key));if(pose){pose.key=key;handState.set(key,pose);}
 }
 const hands=[...handState.values()],palms=hands.filter(p=>p.open),now=frame.time,unoccupied=!owner||owner.startsWith('hand');
 if(pointer===null)cursor=hands.map(h=>({...h.point,pinch:h.pinch}));
 if(calibration){
  if(palms.length===1){
    if(!calibration.start)calibration.start=now;calibration.spans.push(palms[0].span);
    if(now-calibration.start>=650&&calibration.spans.length>=6){const values=calibration.spans.sort((a,b)=>a-b);calibrated=values[Math.floor(values.length/2)];calibration=null;clearTimeout(calibrationTimer);say('calibrated');singleLatch=true;}
  }else{calibration.start=0;calibration.spans=[];}
  return;
 }
 if(!unoccupied)return;
 if(drift()){
  if(dustPointers.size||dust.hands.has('keyboard'))return;
  for(const key of previous.keys())if(!handState.has(key))dust.release('hand-'+key,false);
  for(const [key,h] of handState)dustInput('hand-'+key,h.pinch?'gather':'carry',h.point,now);
  if(handState.size>1){if(motion!=='dustStretch'){motion='dustStretch';ui();}}
  else if(previous.size>1&&handState.size===1){motion=hands[0].pinch?'dustGather':'dustCarry';ui();}
  return;
 }
 if(palms.length===2){
  gateSeenAt=now;openSince=0;singleLatch=true;
  const [a,b]=palms.map(h=>h.point),centre={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  if(owner&&owner!=='hand-gate')finish(owner,now,false);
  if(!draft)begin('gate',centre,'hand-gate');
  if(owner==='hand-gate'){draft.x=centre.x;draft.y=centre.y;draft.radius=clip(Math.hypot((a.x-b.x)*1.6,a.y-b.y)*.5,.06,.34);}
  return;
 }
 if(owner==='hand-gate'){if(now-gateSeenAt<205)return;finish('hand-gate');}
 const ward=hands.find(h=>h.shield);
 if(ward){
  wardSeenAt=now;handFired=false;openSince=0;singleLatch=false;
  if(owner&&owner!=='hand-shield')finish(owner,now,false);
  if(!draft)begin('shield',ward.point,'hand-shield',now);else move(ward.point,'hand-shield',now);
  return;
 }
 if(owner==='hand-shield'){if(now-wardSeenAt<155)return;finish(owner,now);}
 const wand=hands.find(h=>h.pointing);
 if(wand){
  openSince=0;singleLatch=false;
  if(owner&&owner!=='hand-bolt')finish(owner,now,false);
  if(handFired)return;
  if(!casting){
   const a=Math.atan2(wand.point.y-wand.wrist.y,(wand.point.x-wand.wrist.x)*1.6);
   begin('bolt',wand.point,'hand-bolt',now,a);
  }else{
   move(wand.point,'hand-bolt',now);
   if(now-casting.start>180&&casting.travel>.066&&casting.speed>.92){finish('hand-bolt',now);handFired=true;}
  }
  return;
 }
 if(owner==='hand-bolt')finish(owner,now,false);
 handFired=false;
 const drawing=hands.find(h=>h.pinch);
 if(drawing){
  const key='hand-ink-'+drawing.key;
  if(owner&&owner!==key)finish(owner);
  if(!draft)begin('ink',drawing.point,key);else move(drawing.point,key);
  openSince=0;singleLatch=false;return;
 }
 if(owner?.startsWith('hand-ink'))finish(owner);
 if(!palms.length){openSince=0;singleLatch=false;return;}
 if(!openSince)openSince=now;
 if(!singleLatch&&now-openSince>260){begin('nova',palms[0].point,'hand-open');singleLatch=true;}
}
function stopCamera(code='ended'){
 revision++;const current=controller,active=session;
 controller=null;session=null;cameraMode='off';current?.abort();active?.stop();
 clearTimeout(calibrationTimer);calibration=null;calibrated=0;
 resetHands();$('mirrorFeed').checked=false;say(code);ui();
}
async function toggleCamera(){
 if(cameraMode!=='off'){stopCamera();return;}
 const id=++revision;cameraMode='starting';controller=new AbortController();say('permission');ui();
 try{
  const {startTracking}=await import('../tracking.mjs?v=188cd72e71');
  if(id!==revision)return;
  const active=await startTracking({video,hands:true,face:false,signal:controller.signal,
   onFrame:f=>{if(id===revision)captureHands(f);},
   onStatus:s=>{
    if(id!==revision)return;
    if(s==='ready'){if(cameraMode!=='on')$('mirrorFeed').checked=true;cameraMode='on';say($('mirrorFeed').checked?'readyBackdrop':'ready');ui();}
    else if(s==='ended'){stopCamera();}else if(s==='error'){if(cameraMode==='on')stopCamera('error');else say('error');}
    else if(['permission','loading','lost'].includes(s)){if(s==='lost')resetHands();say(s);}
   }});
  if(id!==revision){active.stop();return;}session=active;
 }catch(err){if(id===revision)stopCamera(err?.name==='NotAllowedError'?'denied':'error');}
}
$('camera').addEventListener('click',toggleCamera);
$('mirrorFeed').addEventListener('input',()=>say($('mirrorFeed').checked?'backdropOn':'ready'));
$('calibrate').addEventListener('click',()=>{
 resetHands();calibration={start:0,spans:[]};say('calibrating');clearTimeout(calibrationTimer);
 calibrationTimer=setTimeout(()=>{if(calibration){calibration=null;say('calibrationFailed');}},9000);
});
function draw(now){
 raf=0;if(document.hidden||!sky)return;
 if(lastTick!==null)phase+=Math.min(now-lastTick,100);lastTick=now;
 if(now-lastDraw>=(reduced?80:(canvas.clientWidth<680?42:30))){
  if(drift())dust.step(Math.min(.055,Math.max(0,(now-lastDraw)/1000)),scene.power,reduced);
  lastDraw=now;animateCasting(now);resolveFlights();bursts=bursts.filter(b=>phase-b.start<2450);
  sky.draw(canvas,scene,reduced?0:phase,{video:cameraMode==='on'&&$('mirrorFeed').checked?video:null,
   field:drift(),cursors:casting?.point||drift()?[]:cursor,bursts:reduced?[]:bursts,draft,wand:wandAt(now),flights,reduced});
 }
 raf=requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){dust.stop();dustPointers.clear();hush();cancelAnimationFrame(raf);raf=0;lastTick=null;if(cameraMode!=='off')stopCamera();}
 else if(!raf&&sky)raf=requestAnimationFrame(draw);
});window.addEventListener('pagehide',()=>{hush();if(cameraMode!=='off')stopCamera();});
$('capture').addEventListener('click',()=>{
 if(!sky)return;say('saving');
 const still=document.createElement('canvas');still.width=W;still.height=H;
 sky.draw(still,scene,reduced?0:phase,{video:cameraMode==='on'&&$('mirrorFeed').checked?video:null,bursts:reduced?[]:bursts,draft,wand:wandAt(performance.now()),flights,reduced,field:drift()});
 still.toBlob(b=>{if(!b){say('saveFail');return;}const a=document.createElement('a'),url=URL.createObjectURL(b);a.href=url;a.download='Astral-Atelier-'+new Date().toISOString().replace(/[:]/g,'-').slice(0,19)+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);say('saved');},'image/png');
});
const clone=object=>JSON.parse(JSON.stringify(object));
function getState(){
 phaseAtSave=phase;
 const marks=scene.marks.slice();if(draft&&draft.type!=='bolt'&&marks.length<maxMarks)marks.push(draft);
 return {version:1,color:scene.color,power:scene.power,tool:scene.tool,phase:phaseAtSave,marks:clone(marks),dust:drift()||dustDirty?dust.snapshot():null,house:houseTitle};
}
function example(){
 const marks=[
  {type:'gate',x:.669,y:.41,radius:.235,color:'vesper',power:88,seed:384},
  {type:'shield',x:.259,y:.357,radius:.12,color:'tide',power:78,seed:95},
  {type:'nova',x:.84,y:.653,radius:.079,color:'solar',power:81,seed:763},
  {type:'ink',points:[[.706,.59],[.757,.68],[.84,.653],[.89,.71]],color:'solar',power:59,seed:541},
  {type:'bolt',x:.145,y:.74,endX:.616,endY:.456,radius:.12,bend:-.48,blocked:false,charge:.92,speed:.80,color:'solar',power:91,seed:862}
 ];
 return {version:1,color:'solar',power:86,tool:'bolt',phase:3700,marks,house:true};
}
const bounded=(x,low,high)=>typeof x==='number'&&Number.isFinite(x)&&x>=low&&x<=high;
const colorOk=s=>typeof s==='string'&&Object.hasOwn(spectra,s);
function check(data){
 const fail=()=>{throw Error(T('bad'));};
 if(!data||data.version!==1||!colorOk(data.color)||!bounded(data.power,35,100)||!spells.includes(data.tool)||!bounded(data.phase,0,1e12)||!Array.isArray(data.marks)||data.marks.length>maxMarks)fail();
 if(data.dust!=null&&!validDust(data.dust))fail();
 const marks=data.marks.map(m=>{
  if(!m||m.type==='dust'||!spells.includes(m.type)||!colorOk(m.color)||!bounded(m.power,35,100)||!bounded(m.seed,0,65535))fail();
  const base={type:m.type,color:m.color,power:m.power,seed:m.seed};
  if(m.type==='ink'){
   if(!Array.isArray(m.points)||!m.points.length||m.points.length>1200||m.points.some(p=>!Array.isArray(p)||p.length!==2||!bounded(p[0],0,1)||!bounded(p[1],0,1)))fail();
   return {...base,points:m.points.map(p=>[p[0],p[1]])};
  }
  if(!bounded(m.x,0,1)||!bounded(m.y,0,1)||!bounded(m.radius,.035,.39))fail();
  const orb={...base,x:m.x,y:m.y,radius:m.radius};
  if(m.type!=='bolt')return orb;
  if(!bounded(m.endX,0,1)||!bounded(m.endY,0,1)||!bounded(m.charge,0,1)||!bounded(m.speed,0,1)||!bounded(m.bend,-1,1)||typeof m.blocked!=='boolean')fail();
  return {...orb,endX:m.endX,endY:m.endY,charge:m.charge,speed:m.speed,bend:m.bend,blocked:m.blocked};
 });
 return {color:data.color,power:data.power,tool:data.tool,phase:data.phase,marks,dust:data.dust??null,house:data.house===true};
}
async function restore(data){
 const next=check(data);await ready;cancelDraft();scene.color=next.color;scene.power=next.power;scene.tool=next.tool;scene.marks=next.marks;dust.restore(next.dust);dustDirty=!!next.dust;dustUndo.length=0;phase=next.phase;lastTick=null;bursts=[];flights=[];houseTitle=next.house;
 motion='restored';if(cameraMode==='off')say(drift()?'dustKeys':'idleNotice');ui();sky.draw(canvas,scene,phase,{field:drift(),reduced});
}
function getPreview(){
 if(!sky)return '';const mini=document.createElement('canvas');mini.width=320;mini.height=200;
 // Project shelf artwork never contains the camera feed.
 sky.draw(mini,scene,reduced?0:phaseAtSave,{draft,field:drift(),reduced});return mini.toDataURL('image/jpeg',.78);
}
ui();
function imageAsset(file){return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=file;});}
const ready=Promise.all(['vesper.webp','aether.webp','ward.webp'].map(imageAsset)).then(([landscape,aether,ward])=>{
 sky=new Sky(canvas,landscape,{aether,ward});
 sky.draw(canvas,scene,phase,{field:drift(),reduced});document.documentElement.dataset.spellReady='true';
 if(!document.hidden)raf=requestAnimationFrame(draw);
});
ready.then(()=>window.NightLibrary?.register({getState,restore,getTitle:()=>T(houseTitle?'example':drift()?'dustProject':'project'),getPreview,getExample:example}));

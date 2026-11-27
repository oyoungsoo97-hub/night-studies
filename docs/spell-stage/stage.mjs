import {Sky,spectra} from './sky.mjs';
import {readPose} from './gestures.mjs';
import {T,counter} from './words.mjs';
const $=id=>document.getElementById(id),canvas=$('stage'),video=$('sensor');
const W=1600,H=1000,spells=['ink','nova','gate'],maxMarks=72;
const clip=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const scene={color:'vesper',power:75,tool:'ink',marks:[{type:'gate',x:.52,y:.467,radius:.159,color:'vesper',power:64,seed:3}]};
let sky,draft=null,owner=null,pointer=null,keyboard={x:.5,y:.47},cursor=[],bursts=[];
let motion='first',notice='idleNotice',cameraMode='off',controller=null,session=null,revision=0;
let handState=new Map(),openSince=0,singleLatch=false,calibration=null,calibrationTimer=0,calibrated=0;
let phase=0,lastTick=null,raf=0,lastDraw=-1000,phaseAtSave=0,houseTitle=false;
let pendingClear=null;
function text(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value;}
function ui(){
 document.querySelectorAll('[data-t]').forEach(n=>{const value=T(n.dataset.t);if(n.textContent!==value)n.textContent=value;});
 const live=cameraMode==='on';
 canvas.setAttribute('aria-label',T('scope'));$('expand').setAttribute('aria-label',T(document.fullscreenElement?'collapse':'expand'));$('expand').lastElementChild.textContent=T(document.fullscreenElement?'collapse':'expand');
 text('cameraText',T(live?'stop':cameraMode==='starting'?'cancelCamera':'start'));text('modeName',T(live?'live':'practice'));text('notice',T(notice));text('lastMotion',T(motion));text('spellCount',counter(scene.marks.length));text('powerValue',scene.power+'%');
 $('theatre').dataset.camera=cameraMode;$('stage').dataset.spellCount=scene.marks.length;
 $('cameraDesk').hidden=!live;$('power').value=scene.power;
 $('undo').disabled=!scene.marks.length;$('clear').disabled=!scene.marks.length;
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
 bursts=bursts.slice(-25);bursts.push({type:m.type,x:point?.[0]??m.x,y:point?.[1]??m.y,color:m.color,seed:m.seed,scale:m.type==='ink'?.06:m.radius,start:phase});
}
function commit(mark){
 if(!mark)return;
 if(scene.marks.length>=maxMarks){say('max');return;}
 scene.marks.push(mark);motion=mark.type+'Cast';addBurst(mark,mark.points?.at(-1));ui();
}
function cancelDraft(){draft=null;owner=null;}
function finish(which){
 if(owner!==which)return;
 if(draft?.type==='ink'&&draft.points.length===1){
   // A fingertip touch leaves a star even without a drag.
   const [x,y]=draft.points[0];draft.points.push([clip(x+.0008),y]);
 }
 const mark=draft;cancelDraft();commit(mark);
}
function begin(type,p,source){
 if(draft||scene.marks.length>=maxMarks){if(scene.marks.length>=maxMarks)say('max');return;}
 if(type==='nova'){commit(newMark('nova',p.x,p.y,.056+.10*scene.power/100));return;}
 if(type==='ink')draft={type:'ink',points:[[p.x,p.y]],color:scene.color,power:scene.power,seed:Math.floor(Math.random()*65535)};
 else draft=newMark('gate',p.x,p.y,.085+.045*scene.power/100);
 owner=source;
}
function move(p,source){
 if(!draft||owner!==source)return;
 if(draft.type==='ink'){
  const points=draft.points,last=points.at(-1);
  if(points.length>=1200||Math.hypot((p.x-last[0])*1.6,p.y-last[1])<.003)return;
  points.push([p.x,p.y]);
 }else{draft.radius=clip(Math.hypot((p.x-draft.x)*1.6,p.y-draft.y),.05,.34);}
}
function undo(){cancelDraft();if(scene.marks.pop()){bursts=[];motion='undone';ui();}}
function rect(){
 const b=canvas.getBoundingClientRect(),z=Math.min(b.width/W,b.height/H);
 return {x:b.left+(b.width-W*z)/2,y:b.top+(b.height-H*z)/2,w:W*z,h:H*z};
}
function point(event){const b=rect();return {x:clip((event.clientX-b.x)/b.w),y:clip((event.clientY-b.y)/b.h)};}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||pointer!==null||draft)return;
 e.preventDefault();canvas.focus({preventScroll:true});pointer=e.pointerId;canvas.setPointerCapture(pointer);
 const p=point(e);keyboard=p;cursor=[p];begin(scene.tool,p,'pointer');
});
canvas.addEventListener('pointermove',e=>{
 if(pointer!==e.pointerId)return;
 const p=point(e);keyboard=p;cursor=[p];move(p,'pointer');
});
function release(e){if(pointer!==e.pointerId)return;pointer=null;finish('pointer');cursor=[];}
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
canvas.addEventListener('keydown',e=>{
 if($('ns-library')?.open||$('clearDialog').open)return;
 if(e.key.startsWith('Arrow')){
  e.preventDefault();const d=e.shiftKey?.08:.025;
  keyboard={x:clip(keyboard.x+({'ArrowLeft':-d,'ArrowRight':d}[e.key]||0)),y:clip(keyboard.y+({'ArrowUp':-d,'ArrowDown':d}[e.key]||0))};
  cursor=[keyboard];move(keyboard,'keyboard');
 }else if(e.key==='Enter'||e.code==='Space'){
  e.preventDefault();if(e.repeat)return;
  if(owner==='keyboard')finish('keyboard');
  else if(scene.tool==='ink'){begin('ink',keyboard,'keyboard');say('inkKey');}
  else commit(newMark(scene.tool,keyboard.x,keyboard.y,scene.tool==='nova'?.11:.15));
 }else if(e.key==='Escape'){cancelDraft();cursor=[];}
});
canvas.addEventListener('blur',()=>{if(owner==='keyboard')finish('keyboard');if(cameraMode!=='on')cursor=[];});
for(const b of document.querySelectorAll('[data-spell]'))b.addEventListener('click',()=>{if(owner==='keyboard')finish(owner);scene.tool=b.dataset.spell;ui();});
for(const b of document.querySelectorAll('[data-color]'))b.addEventListener('click',()=>{scene.color=b.dataset.color;ui();});
$('power').addEventListener('input',()=>{scene.power=Number($('power').value);text('powerValue',scene.power+'%');});
$('undo').addEventListener('click',undo);$('clear').addEventListener('click',()=>{if(scene.marks.length){pendingClear=scene.marks;$('clearDialog').showModal();}});
$('clearDialog').addEventListener('close',()=>{
 if($('clearDialog').returnValue==='clear'&&pendingClear===scene.marks){cancelDraft();scene.marks=[];bursts=[];motion='cleared';ui();}
 pendingClear=null;$('clearDialog').returnValue='';
});
$('expand').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('theatre').requestFullscreen();}catch{say('expandFail');}});
document.addEventListener('fullscreenchange',ui);
function resetHands(){
 handState.clear();singleLatch=false;openSince=0;cursor=[];
 if(owner?.startsWith('hand'))finish(owner);
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
 if(palms.length===2){
  openSince=0;singleLatch=true;
  const [a,b]=palms.map(h=>h.point),centre={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  if(owner&&owner!=='hand-gate')finish(owner);
  if(!draft)begin('gate',centre,'hand-gate');
  if(owner==='hand-gate'){draft.x=centre.x;draft.y=centre.y;draft.radius=clip(Math.hypot((a.x-b.x)*1.6,a.y-b.y)*.5,.06,.34);}
  return;
 }
 if(owner==='hand-gate')finish('hand-gate');
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
  const {startTracking}=await import('../tracking.mjs');
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
 if(now-lastDraw>=(reduced?80:30)){lastDraw=now;bursts=bursts.filter(b=>phase-b.start<2600);sky.draw(canvas,scene,reduced?0:phase,{video:cameraMode==='on'&&$('mirrorFeed').checked?video:null,cursors:cursor,bursts:reduced?[]:bursts,draft});}
 raf=requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){cancelAnimationFrame(raf);raf=0;lastTick=null;if(cameraMode!=='off')stopCamera();}
 else if(!raf&&sky)raf=requestAnimationFrame(draw);
});window.addEventListener('pagehide',()=>{if(cameraMode!=='off')stopCamera();});
$('capture').addEventListener('click',()=>{
 if(!sky)return;say('saving');
 const still=document.createElement('canvas');still.width=W;still.height=H;
 sky.draw(still,scene,reduced?0:phase,{video:cameraMode==='on'&&$('mirrorFeed').checked?video:null,bursts:reduced?[]:bursts,draft});
 still.toBlob(b=>{if(!b){say('saveFail');return;}const a=document.createElement('a'),url=URL.createObjectURL(b);a.href=url;a.download='Astral-Atelier-'+new Date().toISOString().replace(/[:]/g,'-').slice(0,19)+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);say('saved');},'image/png');
});
const clone=object=>JSON.parse(JSON.stringify(object));
function getState(){
 phaseAtSave=phase;
 const marks=scene.marks.slice();if(draft&&marks.length<maxMarks)marks.push(draft);
 return {version:1,color:scene.color,power:scene.power,tool:scene.tool,phase:phaseAtSave,marks:clone(marks),house:houseTitle};
}
function example(){
 const marks=[
 {type:'gate',x:.535,y:.455,radius:.219,color:'vesper',power:86,seed:384},
 {type:'nova',x:.29,y:.491,radius:.115,color:'solar',power:88,seed:763},
 {type:'nova',x:.764,y:.29,radius:.069,color:'tide',power:64,seed:921},
 ];
 const lines=[[[.178,.667],[.29,.491],[.349,.573],[.445,.504]],[[.639,.421],[.698,.40],[.764,.29],[.837,.319]]];
 for(const [i,points] of lines.entries())marks.push({type:'ink',points,color:i?'tide':'solar',power:63,seed:221+i});
 return {version:1,color:'vesper',power:86,tool:'ink',phase:3700,marks,house:true};
}
const bounded=(x,low,high)=>typeof x==='number'&&Number.isFinite(x)&&x>=low&&x<=high;
const colorOk=s=>typeof s==='string'&&Object.hasOwn(spectra,s);
function check(data){
 const fail=()=>{throw Error(T('bad'));};
 if(!data||data.version!==1||!colorOk(data.color)||!bounded(data.power,35,100)||!spells.includes(data.tool)||!bounded(data.phase,0,1e12)||!Array.isArray(data.marks)||data.marks.length>maxMarks)fail();
 const marks=data.marks.map(m=>{
  if(!m||!spells.includes(m.type)||!colorOk(m.color)||!bounded(m.power,35,100)||!bounded(m.seed,0,65535))fail();
  const base={type:m.type,color:m.color,power:m.power,seed:m.seed};
  if(m.type==='ink'){
   if(!Array.isArray(m.points)||!m.points.length||m.points.length>1200||m.points.some(p=>!Array.isArray(p)||p.length!==2||!bounded(p[0],0,1)||!bounded(p[1],0,1)))fail();
   return {...base,points:m.points.map(p=>[p[0],p[1]])};
  }
  if(!bounded(m.x,0,1)||!bounded(m.y,0,1)||!bounded(m.radius,.035,.39))fail();
  return {...base,x:m.x,y:m.y,radius:m.radius};
 });
 return {color:data.color,power:data.power,tool:data.tool,phase:data.phase,marks,house:data.house===true};
}
async function restore(data){
 const next=check(data);await ready;cancelDraft();scene.color=next.color;scene.power=next.power;scene.tool=next.tool;scene.marks=next.marks;phase=next.phase;lastTick=null;bursts=[];houseTitle=next.house;
 motion='restored';ui();sky.draw(canvas,scene,phase);
}
function getPreview(){
 if(!sky)return '';const mini=document.createElement('canvas');mini.width=320;mini.height=200;
 // Project shelf artwork never contains the camera feed.
 sky.draw(mini,scene,reduced?0:phaseAtSave,{draft});return mini.toDataURL('image/jpeg',.78);
}
ui();
const ready=new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='vesper.webp';}).then(img=>{
 sky=new Sky(canvas,img);sky.draw(canvas,scene,phase);document.documentElement.dataset.spellReady='true';
 if(!document.hidden)raf=requestAnimationFrame(draw);
});
ready.then(()=>window.NightLibrary?.register({getState,restore,getTitle:()=>T(houseTitle?'example':'project'),getPreview,getExample:example}));

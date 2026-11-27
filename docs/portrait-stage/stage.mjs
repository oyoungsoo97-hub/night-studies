import {detectPortrait,startTracking} from '../tracking.mjs';
import {clamp,resting,faceSignal,relativePose,manualFace,handPoints,retargetHand,manualHand,makeRig,faceGeometry} from './rig.mjs';
import {makeSurface,paperHand} from './surface.mjs';
import {tr} from './strings.mjs';
import {dimensions,fits} from './photo.mjs';
const $=id=>document.getElementById(id),canvas=$('portrait'),stage=$('dropzone'),video=$('video'),surface=makeSurface(canvas);
const sampleURL='../assets/portrait-model.webp',controlRanges={brow:[-100,100],blink:[0,100],jaw:[0,100],roll:[-100,100],yaw:[-100,100],hands:[0,100]};
let source={type:'sample'},photo,aspect=1,rig,detected={face:null,hands:[]},anchors=[],pick=null,cursor,sourceStatus='',trackStatus='',generation=0,fileGeneration=0,analysis,loading=true;
let cameraSession=null,samples=[],sampleStarted=0,baseline=null,live=resting(),neutralHands=new Map(),lastHands=new Map(),activeHands=[],presence={face:false,hands:0},lastFaceTime=0;
let geometry=null;
let hold=null,raw=false,mesh=false,scheduled=0,notification='',notifyTimer,ready;
const controls={};
for(const button of document.querySelectorAll('[data-module]'))button.onclick=()=>{document.querySelector('.console').dataset.active=button.dataset.module;for(const peer of document.querySelectorAll('[data-module]'))peer.setAttribute('aria-pressed',String(button===peer));};
for(const [key,[lo,hi]] of Object.entries(controlRanges)){
  const label=document.createElement('label');label.className='slider';const span=document.createElement('span');span.dataset.msg=key;
  const control=document.createElement('input');control.type='range';control.id=key;control.min=lo;control.max=hi;control.value=0;control.step=1;
  const output=document.createElement('output');output.htmlFor=key;output.value='0%';label.append(span,control,output);$('sliders').append(label);controls[key]=control;
  control.addEventListener('input',()=>{output.value=control.value+'%';raw=false;hold=null;sync();paintSoon();});
}
const allControls=()=>Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,Number(v.value)]));
function applyControls(values){for(const [k,input] of Object.entries(controls)){input.value=values[k]??0;input.nextElementSibling.value=input.value+'%';}}
function flash(key){notification=key;$('notice').textContent=tr(key);clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>{notification='';$('notice').textContent='';},3300);}
function sync(){
  const handCount=detected.hands.length,readyFace=anchors.length===2||!!detected.face;
  $('rigInfo').textContent=loading?tr('processing'):[tr(anchors.length===2?'manualFace':'face')+' '+(readyFace?'1':'0'),tr('hand')+' '+handCount].join('  /  ');
  $('photoName').textContent=source.type==='sample'?tr('sampleName'):source.name;
  $('photoMeta').textContent=photo?photo.naturalWidth+' × '+photo.naturalHeight+' px':'';
  $('sourceState').textContent=sourceStatus?tr(sourceStatus):'';
  if(pick)$('sourceState').textContent=tr(pick.length?'chinPick':'eyePick')+' '+tr('anchorKeyboard');
  $('trackingState').textContent=trackStatus?tr(trackStatus):'';
  $('geometry').hidden=!geometry;
  if(geometry){const lang=window.NightI18n?.lang||'en';
    const number=(v,n)=>v.toLocaleString(lang,{minimumFractionDigits:n,maximumFractionDigits:n});
    $('ratioMetric').textContent=number(geometry.ratio,2)+' ∶ 1';$('eyeMetric').textContent=number(geometry.eyeRatio*100,1)+'%';$('tiltMetric').textContent=(geometry.tilt>0?'+':'')+number(geometry.tilt,1)+'°';$('geometryMode').textContent=tr(anchors.length?'approx':'measured');}

  $('freeze').textContent=tr(hold?'resume':'freeze');$('freeze').setAttribute('aria-pressed',String(!!hold));$('freeze').disabled=!cameraSession&&!hold;
  $('camera').textContent=tr(cameraSession?'stop':'start');document.querySelector('.monitor').hidden=!cameraSession;document.querySelector('.cam-options').hidden=!cameraSession;
  $('channels').textContent=tr('face')+' '+(presence.face?'1':'0')+'  /  '+tr('hand')+' '+presence.hands;
  $('moving').setAttribute('aria-pressed',String(!raw));$('original').setAttribute('aria-pressed',String(raw));$('mesh').setAttribute('aria-pressed',String(mesh));
  $('portrait').setAttribute('aria-label',tr(raw?'originalStage':'animatedStage'));$('thumbnail').alt=tr('photoAlt');$('anchorBtn').disabled=loading||!!pick;$('cancelAnchor').hidden=!pick;$('useExample').hidden=source.type==='sample';$('download').disabled=!photo||loading;
  canvas.style.cursor=pick?'crosshair':'';if(notification)$('notice').textContent=tr(notification);
}
function localize(){document.querySelectorAll('[data-msg]').forEach(el=>el.textContent=tr(el.dataset.msg));document.querySelector('meta[name=description]').content=tr('intro');sync();}
document.addEventListener('night-language',localize);localize();
function poseForFrame(){
  if(hold)return hold;
  const vals=allControls(),pose={...live};
  for(const [key,value] of [['browL',vals.brow],['browR',vals.brow],['blinkL',vals.blink],['blinkR',vals.blink],['jaw',vals.jaw],['roll',vals.roll],['yaw',vals.yaw]])pose[key]=clamp(pose[key]+value/100,key.startsWith('blink')||key==='jaw'?0:-1,1);
  const targets=rig.palms.map((hand,i)=>{
    const match=activeHands.find(h=>h.source===i);const handPose=match?retargetHand(hand,match.points,neutralHands.get(match.key),Number($('gain').value)/100,true):null;
    if(!vals.hands)return handPose;
    return manualHand(handPose||hand,vals.hands/100,i);
  });
  const puppets=[null,null],occupied=new Set(rig.palms.map(h=>h[0].x<.5?0:1));
  for(const h of activeHands.filter(h=>h.source===-1)){
    let side=h.points[0].x>.5?0:1;if(occupied.has(side))side=1-side;if(occupied.has(side))continue;occupied.add(side);
    const ratio=Math.min(1/Math.max(.01,h.videoAspect),aspect/h.videoAspect,1.1);
    puppets[side]=h.points.map(p=>({x:clamp(1-p.x,.02,.98),y:aspect*.50+(p.y-h.videoAspect*.50)*ratio}));
  }
  if(vals.hands)for(let side=0;side<2;side++)if(!occupied.has(side))puppets[side]=paperHand(side,vals.hands/100,aspect);
  return {pose,targets,puppets};
}
function fit(){if(!photo)return;const rect=stage.getBoundingClientRect(),s=getComputedStyle(stage),availW=rect.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),availH=rect.height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);
  const width=Math.max(1,Math.min(availW,availH/aspect)),height=width*aspect;
  const frame=canvas.parentElement;frame.style.width=width+'px';frame.style.height=height+'px';paintSoon();}
function paint(exporting=false){if(!photo||!rig)return;const bounds=canvas.getBoundingClientRect(),factor=Math.min(1,1800/Math.max(photo.naturalWidth,photo.naturalHeight));
  const scale=exporting?photo.naturalWidth*factor:Math.min(1280,Math.max(2,bounds.width)*Math.min(devicePixelRatio||1,1.7));
  surface.draw({...(pick?{pose:resting(),targets:[],puppets:[]}:poseForFrame()),raw:pick?false:raw,markers:!exporting&&mesh&&!raw,rulers:!exporting&&mesh&&geometry?geometry.lines:[],anchors:!exporting&&pick?[...pick,cursor].filter(Boolean):[]},Math.max(1,Math.round(scale)),Math.max(1,Math.round(scale*aspect)));}
function paintSoon(){if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;paint();});}
new ResizeObserver(fit).observe(stage);
function applyRig(){const face=anchors.length===2?manualFace(anchors[0],anchors[1],aspect):detected.face;geometry=faceGeometry(face,aspect);rig=makeRig(face,detected.hands,aspect);surface.set(photo,rig);hold=null;fit();sync();}
function decode(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error(tr('badImage')));img.src=url;});}
function checkPhoto(img){if(!fits(img.naturalWidth,img.naturalHeight))throw Error(tr('dimensions'));}
function compressed(img){const c=document.createElement('canvas'),k=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));const ctx=c.getContext('2d');ctx.fillStyle='#ede8e0';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9);}
async function sourceFromFile(f){if(!f||!f.size||f.size>18*1024*1024)throw Error(tr('invalidFile'));
  const size=dimensions(new Uint8Array(await f.arrayBuffer()));if(!size)throw Error(tr('invalidFile'));if(!fits(...size))throw Error(tr('dimensions'));
  const url=URL.createObjectURL(f);try{const im=await decode(url);checkPhoto(im);return {type:'custom',name:f.name.replace(/\.[^.]+$/,'').slice(0,80)||tr('noTitle'),data:compressed(im)};}finally{URL.revokeObjectURL(url);}}
async function openSource(src,marks=[],savedControls={},savedGain=100,held=null){
  const token=++generation;analysis?.abort();analysis=new AbortController();const signal=analysis.signal;
  loading=true;sourceStatus='analyzing';pick=null;sync();
  try{const img=await decode(src.type==='sample'?sampleURL:src.data);checkPhoto(img);if(token!==generation)return;
    source=src;savedBaseline=null;photo=img;aspect=img.naturalHeight/img.naturalWidth;anchors=marks;detected={face:null,hands:[]};raw=false;hold=null;mesh=false;$('thumbnail').src=img.src;
    applyControls(savedControls);$('gain').value=savedGain;$('gain').nextElementSibling.value=savedGain+'%';applyRig();paint();
    let modelError=false,result;try{result=await detectPortrait(img,{signal});}catch(err){if(signal.aborted)return;modelError=true;}
    if(token!==generation)return;detected=result||{face:null,hands:[]};detected.hands=detected.hands.filter(h=>h.landmarks?.length===21).slice(0,2).sort((a,b)=>a.landmarks[0].x-b.landmarks[0].x);
    loading=false;sourceStatus=marks.length?'anchored':detected.face?'':modelError?'modelError':'noFace';applyRig();if(held)hold=held;clearCalibration();sync();paintSoon();
  }catch(err){if(token===generation){loading=false;sourceStatus='badImage';sync();}throw err;}
}
async function handleFile(file){if(!file)return;const id=++fileGeneration;try{const src=await sourceFromFile(file);if(id===fileGeneration)await openSource(src);}catch(err){if(id===fileGeneration){sourceStatus=['invalidFile','badImage','dimensions'].find(key=>tr(key)===err.message)||'badImage';sync();}}}
$('upload').onclick=()=>$('photoFile').click();$('photoFile').onchange=()=>{const file=$('photoFile').files[0];$('photoFile').value='';handleFile(file);};$('useExample').onclick=()=>openSource({type:'sample'}).catch(()=>{});
stage.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();stage.classList.add('drag');}});stage.addEventListener('dragleave',e=>{if(!stage.contains(e.relatedTarget))stage.classList.remove('drag');});stage.addEventListener('drop',e=>{e.preventDefault();stage.classList.remove('drag');handleFile(e.dataTransfer.files[0]);});
$('moving').onclick=()=>{raw=false;sync();paintSoon();};$('original').onclick=()=>{raw=true;sync();paintSoon();};$('mesh').onclick=()=>{mesh=!mesh;raw=false;sync();paintSoon();};
$('anchorBtn').onclick=()=>{pick=[];cursor={x:.5,y:.4};raw=false;canvas.focus({preventScroll:true});canvas.scrollIntoView({block:'nearest'});sync();paintSoon();};$('cancelAnchor').onclick=()=>{pick=null;cursor=null;sync();paintSoon();};
function mark(point){if(!pick)return;if(pick.length===0){pick.push(point);cursor={x:point.x,y:clamp(point.y+.2,0,1)};}else{try{manualFace(pick[0],point,aspect);}catch{flash('badAnchor');return;}anchors=[pick[0],point];pick=null;cursor=null;sourceStatus='anchored';applyRig();}sync();paintSoon();}
canvas.addEventListener('click',e=>{if(!pick)return;const b=canvas.getBoundingClientRect();mark({x:clamp((e.clientX-b.left)/b.width,0,1),y:clamp((e.clientY-b.top)/b.height,0,1)});});canvas.addEventListener('keydown',e=>{if(!pick||document.querySelector('dialog[open]'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();mark({...cursor});return;}if(e.key==='Escape'){$('cancelAnchor').click();return;}const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(d){e.preventDefault();const step=e.shiftKey?.04:.008;cursor={x:clamp(cursor.x+d[0]*step,0,1),y:clamp(cursor.y+d[1]*step,0,1)};paintSoon();}});
function clearCalibration(){samples=[];sampleStarted=0;baseline=null;neutralHands.clear();lastHands.clear();activeHands=[];live=resting();lastFaceTime=0;if(cameraSession)trackStatus='neutral';}
function bindHands(input,videoAspect,time){
  const sorted=input.map(h=>({h,points:handPoints(h,videoAspect)})).sort((a,b)=>a.points[0].x-b.points[0].x),claimed=new Set(),results=[],keyCounts=new Map();
  for(const item of sorted){const tag=item.h.handedness||'hand';const idx=keyCounts.get(tag)||0;keyCounts.set(tag,idx+1);const key=tag+idx;
    let sourceIdx=detected.hands.findIndex((h,i)=>!claimed.has(i)&&h.handedness&&h.handedness===item.h.handedness);
    if(sourceIdx<0&&rig?.palms.length){let dist=Infinity;rig.palms.forEach((h,i)=>{const d=Math.abs(h[0].x-(1-item.points[0].x));if(!claimed.has(i)&&d<dist){dist=d;sourceIdx=i;}});}
    if(sourceIdx!==-1)claimed.add(sourceIdx);
    if(!neutralHands.has(key)||time-(lastHands.get(key)||0)>900)neutralHands.set(key,item.points);
    lastHands.set(key,time);results.push({key,source:sourceIdx,points:item.points,videoAspect});}
  return results;
}
function onFrame(frame){if(!cameraSession)return;const ratio=video.videoHeight/Math.max(1,video.videoWidth)||.75,time=frame.time??performance.now(),signal=faceSignal(frame.face,ratio);
  const prevFace=presence.face,prevHands=presence.hands,prevState=trackStatus;presence={face:!!signal,hands:frame.hands.length};activeHands=bindHands(frame.hands,ratio,time);
  if(signal){lastFaceTime=time;if(!baseline){if(!sampleStarted)sampleStarted=time;samples.push(signal);
      if(time-sampleStarted>720&&samples.length>=4){baseline=Object.fromEntries(Object.keys(signal).map(k=>[k,samples.map(x=>x[k]).sort((a,b)=>a-b)[Math.floor(samples.length/2)]]));samples=[];savedBaseline=baseline;}}
    if(baseline){const pose=relativePose(signal,baseline,Number($('gain').value)/100);for(const k of Object.keys(live))live[k]+=(pose[k]-live[k])*(k.startsWith('blink')?.84:.57);trackStatus='performing';}else trackStatus='neutral';
  }else{if(!baseline){samples=[];sampleStarted=0;}if(time-lastFaceTime>250){for(const k of Object.keys(live))live[k]*=.74;if(time-lastFaceTime>650)trackStatus='lost';}}
  if(prevFace!==presence.face||prevHands!==presence.hands||prevState!==trackStatus)sync();if(!hold)paintSoon();
}
function endSession(code='ended'){cameraSession=null;activeHands=[];live=resting();presence={face:false,hands:0};trackStatus=code;sync();paintSoon();}
$('camera').onclick=async()=>{
  if(cameraSession){const old=cameraSession;cameraSession=null;old.abort();endSession();return;}
  const controller=new AbortController();cameraSession=controller;hold=null;clearCalibration();baseline=savedBaseline;raw=false;trackStatus='permission';sync();
  try{await startTracking({video,face:true,hands:true,signal:controller.signal,onFrame,onStatus:status=>{
    if(cameraSession!==controller)return;if(status==='ended'||status==='error'){endSession(status);return;}
    trackStatus=status==='ready'?baseline?'performing':'neutral':status;sync();}});}catch{if(cameraSession===controller)endSession('error');}
};
$('calibrate').onclick=()=>{hold=null;savedBaseline=null;clearCalibration();sync();paintSoon();};$('gain').oninput=()=>{$('gain').nextElementSibling.value=$('gain').value+'%';};
$('freeze').onclick=()=>{if(hold)hold=null;else if(cameraSession&&rig){hold=structuredClone(poseForFrame());flash('held');}sync();paintSoon();};
$('reset').onclick=()=>{applyControls({});hold=null;raw=false;sync();paintSoon();flash('resetDone');};
$('download').onclick=()=>{
  if(!rig||loading)return;paint(true);canvas.toBlob(blob=>{if(!blob){flash('exportError');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=(source.type==='sample'?tr('sampleName'):source.name).replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,70)+' — Portrait Loom.png';a.href=url;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);flash('exported');},'image/png');paintSoon();};
function preview(){if(!rig)return '';const c=document.createElement('canvas');c.width=216;c.height=162;const ctx=c.getContext('2d');ctx.fillStyle='#332434';ctx.fillRect(0,0,c.width,c.height);const k=Math.min(c.width/canvas.width,c.height/canvas.height);ctx.drawImage(canvas,(c.width-canvas.width*k)/2,(c.height-canvas.height*k)/2,canvas.width*k,canvas.height*k);return c.toDataURL('image/jpeg',.65);}
function validPoint(p,bound=1){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=bound;}
function parseHeld(value){if(value==null)return null;const err=()=>{throw Error(tr('badProject'));};if(!value.pose||!Array.isArray(value.targets)||value.targets.length>2||!Array.isArray(value.puppets)||value.puppets.length>2)err();const pose={};for(const k of Object.keys(resting())){const n=value.pose[k];if(!Number.isFinite(n)||Math.abs(n)>1.05)err();pose[k]=n;}
  const hand=row=>row==null?null:Array.isArray(row)&&row.length===21&&row.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&Math.abs(p.x)<5&&Math.abs(p.y)<12)?row.map(({x,y})=>({x,y})):err();return {pose,targets:value.targets.map(hand),puppets:value.puppets.map(hand)};}
const signalKeys=['browL','browR','blinkL','blinkR','jaw','roll','yaw','pitch'];
function parsedBaseline(value){if(!value)return null;const b={};for(const key of signalKeys){if(!Number.isFinite(value[key])||Math.abs(value[key])>7)throw Error(tr('badProject'));b[key]=value[key];}return b;}
let savedBaseline=null;
async function restore(saved){await ready;const fail=()=>{throw Error(tr('badProject'));};if(!saved||saved.version!==1||!saved.source||typeof saved.manual!=='object'||!saved.manual)fail();const src=saved.source;
  if(src.type!=='sample'&&(src.type!=='custom'||typeof src.name!=='string'||!src.name.trim()||src.name.length>80||typeof src.data!=='string'||src.data.length>9000000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/u.test(src.data)))fail();
  if(src.type==='custom'){let size;try{size=dimensions(Uint8Array.from(atob(src.data.slice(23)),c=>c.charCodeAt(0)));}catch{fail();}if(!size||!fits(size[0],size[1],1800))fail();}
  for(const [k,[min,max]] of Object.entries(controlRanges)){const n=saved.manual[k];if(!Number.isFinite(n)||n<min||n>max)fail();}
  const marks=saved.anchors,level=saved.gain;if(!Array.isArray(marks)||![0,2].includes(marks.length)||!marks.every(p=>validPoint(p))||!Number.isFinite(level)||level<40||level>170)fail();
  if([saved.raw,saved.mesh].some(v=>v!==undefined&&typeof v!=='boolean'))fail();
  const freeze=parseHeld(saved.held),neutral=parsedBaseline(saved.neutral);const candidate=await decode(src.type==='sample'?sampleURL:src.data);checkPhoto(candidate);if(marks.length){try{manualFace(marks[0],marks[1],candidate.naturalHeight/candidate.naturalWidth);}catch{fail();}}
  if(cameraSession){const old=cameraSession;cameraSession=null;old.abort();endSession();}await openSource(src.type==='sample'?{type:'sample'}:{type:'custom',name:src.name,data:src.data},marks,saved.manual,level,freeze);savedBaseline=neutral;mesh=!!saved.mesh;raw=!!saved.raw;sync();paintSoon();
}
ready=openSource({type:'sample'}).catch(()=>{});
window.NightLibrary?.register({getState:async()=>{await ready;if(loading||!photo)throw Error(tr('busy'));return {version:1,source:{...source},anchors,manual:allControls(),gain:Number($('gain').value),raw,mesh,held:hold?structuredClone(hold):null,neutral:baseline||savedBaseline};},restore,getTitle:()=>source.type==='sample'?tr('sampleName'):source.name,getPreview:preview});

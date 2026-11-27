import {detectPortrait,startTracking} from '../tracking.mjs?v=94cb3e1524';
import {clamp,resting,faceSignal,relativePose,manualFace,handPoints,retargetHand,manualHand,faceGeometry} from './rig.mjs?v=312b69303f';
import {makeSurface} from './surface.mjs?v=8758120c1e';
import {tr} from './strings.mjs?v=e407d86f73';
import {bodyMotion} from './body.mjs?v=42762d866d';
import {closeFace,faceRegion,faceBox,refinedFace,tracedHand,rigHands,smoothPose,smoothPoints} from './anatomy.mjs?v=03e95be4b5';
import {gifHeader,bmpSize,heifHeader} from './containers.mjs?v=28916c7123';
import {cropRearPhoto,projectRearPhoto} from './rear-photo.mjs?v=fb07844c46';
import {dimensions,fits} from './photo.mjs?v=a7fc521aa8';
import {installComparison} from './footage.mjs?v=48c8f09590';
const $=id=>document.getElementById(id),canvas=$('portrait'),stage=$('dropzone'),video=$('video'),surface=makeSurface(canvas,()=>{sync();paintSoon();});
const winter={type:'sample',id:'winter-wave'};
const sampleImages={'winter-wave':'../assets/winter-wave.webp','atelier-1':'../assets/portrait-model.webp'};
const winterCredit='Winter (aespa) · Images by 티비텐 (TV10) · CC BY 3.0';
const photoPage='https://commons.wikimedia.org/?curid=162907797';
const photoLicense='https://creativecommons.org/licenses/by/3.0/';
const isWinter=src=>src.type==='sample'&&src.id===winter.id;
const sourceURL=src=>src.type==='sample'?sampleImages[src.id]:src.data;
const sourceTitle=src=>src.type==='sample'?tr(isWinter(src)?'sampleName':'atelierName'):src.name;
const controlRanges={brow:[-100,100],blink:[0,100],jaw:[0,100],roll:[-100,100],yaw:[-100,100],hands:[0,100],smile:[0,100],pucker:[0,100],gazeX:[-100,100],gazeY:[-100,100],pitch:[-100,100],depth:[-100,100],leftBrow:[-100,100],rightBrow:[-100,100],leftLid:[0,100],rightLid:[0,100],leftSmile:[-100,100],rightSmile:[-100,100]};
let references=null,rearData=null,backGeneration=0;
let source=winter,photo,aspect=1,rig,detected={face:null,hands:[]},anchors=[],pick=null,cursor,sourceStatus='',trackStatus='',generation=0,fileGeneration=0,analysis,loading=true;
let cameraSession=null,samples=[],sampleStarted=0,baseline=null,live=resting(),neutralHands=new Map(),activeHands=[],presence={face:false,hands:0},lastFaceTime=0;
let geometry=null,subjectRegion=null,subjectPoint=null,allFaces=[],handMarks=[],sourceHands=[],pickMode='',areaPointer=null;
let recentFrame=0,liveBody=null,neutralBody=null,bodyTargets=null,lastBodyTime=0,trackedHands=new Map();
const defaultView=()=>({yaw:0,pitch:0,zoom:1,light:0});
let view=defaultView(),orbitPointer=null,exportPending=false;
const pickPrompts={basic:['eyePick','chinPick'],face:['pickLeftEye','pickRightEye','pickLeftLip','pickRightLip','chinPick'],hand:['wrist','thumbTip','indexTip','middleTip','ringTip','littleTip'],area:['areaStart','areaEnd']};
const firstControls=new Set(['brow','blink','jaw','roll','yaw','hands','smile']);
let hold=null,raw=false,mesh=false,scheduled=0,notification='',notifyTimer,ready;
const controls={};
for(const button of document.querySelectorAll('[data-module]'))button.onclick=()=>{document.querySelector('.console').dataset.active=button.dataset.module;for(const peer of document.querySelectorAll('[data-module]'))peer.setAttribute('aria-pressed',String(button===peer));};
for(const [key,[lo,hi]] of Object.entries(controlRanges)){
  const label=document.createElement('label');label.className='slider';const span=document.createElement('span');span.dataset.msg=key;
  const control=document.createElement('input');control.type='range';control.id=key;control.min=lo;control.max=hi;control.value=0;control.step=1;
  const output=document.createElement('output');output.htmlFor=key;output.value='0%';label.append(span,control,output);$(firstControls.has(key)?'sliders':'fineSliders').append(label);controls[key]=control;
  control.addEventListener('input',()=>{output.value=control.value+'%';raw=false;hold=null;sync();paintSoon();});
}
const allControls=()=>Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,Number(v.value)]));
function applyControls(values){for(const [k,input] of Object.entries(controls)){input.value=values[k]??0;input.nextElementSibling.value=input.value+'%';}}
function flash(key){notification=key;$('notice').textContent=tr(key);clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>{notification='';$('notice').textContent='';},3300);}
function sync(){
  const handCount=sourceHands.length,readyFace=!!anchors.length||!!detected.face;
  $('rigInfo').textContent=loading?tr('processing'):[tr(anchors.length?'manualFace':'face')+' '+(readyFace?'1':'0'),tr('hand')+' '+handCount,...(rig?.body?.enabled?[tr('body')+' 1']:[])].join('  /  ');
  $('photoName').textContent=sourceTitle(source);$('sampleCredit').hidden=!isWinter(source);$('referenceCoverage').hidden=!references||anchors.length>0||!!subjectRegion||!detected.face;
  $('referenceCoverage').textContent=tr(rearData?'backApplied':'referenceCoverage');
  $('backTools').hidden=$('referenceCoverage').hidden||loading; $('clearBack').hidden=!rearData;
  $('photoMeta').textContent=photo?photo.naturalWidth+' × '+photo.naturalHeight+' px':'';
  $('sourceState').textContent=sourceStatus?tr(sourceStatus):'';
  if(pick)$('sourceState').textContent=tr(pickPrompts[pickMode][pick.length])+' '+tr('anchorKeyboard');
  $('pickHUD').hidden=!pick;if(pick)$('pickPrompt').textContent=(pick.length+1)+' / '+pickPrompts[pickMode].length+' · '+tr(pickPrompts[pickMode][pick.length]);
  $('skipTip').hidden=!pick||pickMode!=='hand'||pick.length===0;$('backMark').disabled=!pick?.length;$('clearArea').hidden=!subjectRegion;$('clearMarks').hidden=!anchors.length&&!handMarks.length;
  for(const key of ['areaBtn','detailFace','traceHand','clearArea','clearMarks'])$(key).disabled=loading||!!pick;
  $('traceHand').disabled=loading||!!pick||handMarks.length>=2;
  document.querySelector('.body-option').hidden=!cameraSession||!rig?.body?.enabled;

  $('trackingState').textContent=trackStatus?tr(trackStatus):'';
  $('geometry').hidden=!geometry;
  if(geometry){const lang=window.NightI18n?.lang||'en';
    const number=(v,n)=>v.toLocaleString(lang,{minimumFractionDigits:n,maximumFractionDigits:n});
    $('ratioMetric').textContent=number(geometry.ratio,2)+' ∶ 1';$('eyeMetric').textContent=number(geometry.eyeRatio*100,1)+'%';$('tiltMetric').textContent=(geometry.tilt>0?'+':'')+number(geometry.tilt,1)+'°';$('geometryMode').textContent=tr(anchors.length?'approx':'measured');$('openingMetric').textContent=geometry.eyeOpen.map(n=>number(n*100,1)+'%').join(' / ');$('mouthMetric').textContent=number(geometry.mouthWidth*100,1)+'%';$('gapMetric').textContent=number(geometry.jawGap*100,1)+'%';}

  $('freeze').textContent=tr(hold?'resume':'freeze');$('freeze').setAttribute('aria-pressed',String(!!hold));$('freeze').disabled=!cameraSession&&!hold;
  $('camera').textContent=tr(cameraSession?'stop':'start');document.querySelector('.monitor').hidden=!cameraSession;document.querySelector('.cam-options').hidden=!cameraSession;
  $('channels').textContent=tr('face')+' '+(presence.face?'1':'0')+'  /  '+tr('hand')+' '+presence.hands+(rig?.body?.enabled?'  /  '+tr('body')+' '+(presence.body?'1':'0'):'');
  $('moving').setAttribute('aria-pressed',String(!raw));$('original').setAttribute('aria-pressed',String(raw));$('mesh').setAttribute('aria-pressed',String(mesh));
  $('portrait').setAttribute('aria-label',tr(raw?'originalStage':'animatedStage'));$('thumbnail').alt=tr('photoAlt');$('anchorBtn').disabled=loading||!!pick;$('cancelAnchor').hidden=!pick;$('useExample').hidden=isWinter(source);$('download').disabled=!photo||loading||!!pick;canvas.toggleAttribute('data-picking',!!pick);
  const model=surface.sculpture,modelVisible=!!model&&surface.available&&!pick&&!raw;
  const wrists=model?.parts.find(part=>part.name==='Figure')?.wristBindings;
  $('compareTools').hidden=!isWinter(source)||!modelVisible||!detected.face||!wrists?.[15]||!wrists?.[16]||!references||anchors.length>0||!!subjectRegion||loading;
  $('renderDesk').hidden=!modelVisible;$('glb').disabled=!model||loading||exportPending;$('glb').textContent=tr(exportPending?'baking':'glb');
  document.querySelectorAll('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(((view.yaw-Number(b.dataset.angle)+540)%360)-180)<.5)));
  $('orbit').value=view.yaw;$('orbitValue').value=Math.round(view.yaw)+'°';
  $('zoom').value=Math.round(view.zoom*100);$('zoomValue').value=$('zoom').value+'%';$('light').value=String(view.light);
  $('mesh').disabled=!model||!surface.available;$('moving').disabled=!!photo&&(!model||!surface.available);
  $('modelStatus').textContent=!loading&&model&&!surface.available?tr('gpuUnavailable'):model&&!loading?model.count.toLocaleString(window.NightI18n?.lang||'en')+' '+tr('triangles'):'';
  canvas.style.cursor=pick?'crosshair':modelVisible?'grab':'';if(notification)$('notice').textContent=tr(notification);
}
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>updateView({yaw:Number(b.dataset.angle),pitch:0}));
function localize(){document.querySelectorAll('[data-msg]').forEach(el=>el.textContent=tr(el.dataset.msg));document.querySelector('meta[name=description]').content=tr('intro');renderPeople();sync();}
document.addEventListener('night-language',localize);localize();
function poseForFrame(){
  if(hold)return hold;
  const vals=allControls(),pose={...live};
  const offsets={browL:vals.brow+vals.leftBrow,browR:vals.brow+vals.rightBrow,blinkL:vals.blink+vals.leftLid,blinkR:vals.blink+vals.rightLid,smileL:vals.smile+vals.leftSmile,smileR:vals.smile+vals.rightSmile};
  for(const key of ['jaw','roll','yaw','pitch','gazeX','gazeY','pucker','depth'])offsets[key]=vals[key];
  for(const [key,value] of Object.entries(offsets))pose[key]=clamp(pose[key]+value/100,/^(blink|smile|pucker|jaw)/.test(key)?0:-1,1);
  const targets=rig.palms.map((hand,i)=>{
    const match=activeHands.find(h=>h.source===i);const handPose=match?retargetHand(hand,match.points,neutralHands.get(match.key),Number($('gain').value)/100,true):null;
    if(!vals.hands)return handPose;
    return manualHand(handPose||hand,vals.hands/100,i);
  });
  const puppets=[null,null],occupied=new Set(rig.palms.map(h=>h[0].x<.5?0:1));
  for(const h of activeHands.filter(h=>h.source===-1)){
    let side=h.points[0].x>.5?0:1;if(occupied.has(side))side=1-side;if(occupied.has(side))continue;occupied.add(side);
    const rest=surface.sculpture?.inferredPalms?.[side];
    if(rest){
      puppets[side]=retargetHand(rest,h.points,neutralHands.get(h.key),Number($('gain').value)/100,true);
      if(vals.hands)puppets[side]=manualHand(puppets[side]||rest,vals.hands/100,side);
      continue;
    }
    const ratio=Math.min(1/Math.max(.01,h.videoAspect),aspect/h.videoAspect,1.1);
    puppets[side]=h.points.map(p=>({x:clamp(1-p.x,.02,.98),y:aspect*.50+(p.y-h.videoAspect*.50)*ratio}));
  }
  pose.hands=vals.hands/100;
  return {pose,targets,puppets,body:bodyTargets};
}
function fit(){if(!photo)return;const rect=stage.getBoundingClientRect(),s=getComputedStyle(stage),availW=rect.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),availH=rect.height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);
  const width=Math.max(1,Math.min(availW,availH/aspect)),height=width*aspect;
  const frame=canvas.parentElement;frame.style.width=width+'px';frame.style.height=height+'px';paintSoon();}
function paint(exporting=false){if(!photo||!rig)return;const bounds=canvas.getBoundingClientRect(),factor=Math.min(1,1800/Math.max(photo.naturalWidth,photo.naturalHeight));
  const scale=exporting?photo.naturalWidth*factor:Math.min(1280,Math.max(2,bounds.width)*Math.min(devicePixelRatio||1,1.7));
  surface.draw({...(pick?{pose:resting(),targets:[],puppets:[]}:poseForFrame()),view,raw:!!pick||raw,markers:!exporting&&mesh&&!raw,rulers:!exporting&&mesh&&geometry?geometry.lines:[],area:!exporting&&pickMode==='area'&&pick?.length&&cursor?normalizedRect(pick[0],cursor):null,anchors:!exporting&&pick?[...pick,cursor].filter(Boolean):[]},Math.max(1,Math.round(scale)),Math.max(1,Math.round(scale*aspect)));}
function paintSoon(){if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;paint();});}
new ResizeObserver(fit).observe(stage);
function applyRig(){
  const face=anchors.length?refinedFace(anchors,aspect,manualFace):detected.face;sourceHands=rigHands(detected.hands,handMarks,aspect);
  geometry=faceGeometry(face,aspect);
  rig={palms:sourceHands.map(h=>handPoints(h,aspect)),body:{enabled:!!detected.pose?.landmarks?.length}};
  surface.set(photo,{aspect,face,hands:sourceHands,pose:detected.pose,references:face&&!anchors.length&&!subjectRegion?references:null});hold=null;bodyTargets=null;fit();sync();
}
function renderPeople(){const bin=$('people');bin.replaceChildren();bin.hidden=allFaces.length<2;if(bin.hidden||!photo)return;
  allFaces.forEach((face,i)=>{const box=faceBox(face),button=document.createElement('button'),thumb=document.createElement('canvas');thumb.width=thumb.height=60;
    const g=thumb.getContext('2d'),w=photo.naturalWidth,h=photo.naturalHeight,size=Math.max(box.width*w,box.height*h)*1.2;g.drawImage(photo,(box.x+box.width*.5)*w-size/2,(box.y+box.height*.5)*h-size/2,size,size,0,0,60,60);
    button.type='button';button.disabled=loading||!!pick;const nearest=closeFace(allFaces,detected.face?.landmarks[1]);button.setAttribute('aria-pressed',String(nearest===face));button.append(thumb,document.createTextNode(tr('person')+' '+(i+1)));button.onclick=()=>scan(faceRegion(face,allFaces),face.landmarks[1]);bin.append(button);});
}
function normalizedRect(a,b){return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};}
async function analyze(img,signal,region,point){const result=await detectPortrait(img,{signal,...(region?{region}:{}),...(point?{point}:{})});const faces=result.faces?.length?result.faces:result.face?[result.face]:[];
  if(!region||!allFaces.length)allFaces=[...faces].sort((a,b)=>a.landmarks[1].x-b.landmarks[1].x);
  const face=point?closeFace(faces,point):result.face;return {...result,face,hands:(result.hands||[]).filter(h=>h.landmarks?.length===21).slice(0,2)};
}
async function scan(region,point=null){if(!photo||loading)return;const token=++generation;analysis?.abort();analysis=new AbortController();const signal=analysis.signal;loading=true;pick=null;sourceStatus='analyzing';sync();renderPeople();
  try{const result=await analyze(photo,signal,region,point);if(token!==generation)return;subjectRegion=region;subjectPoint=point||result.face?.landmarks[1]||null;detected=result;anchors=[];handMarks=[];sourceStatus=result.face?'':result.pose?'poseHead':'noFace';loading=false;applyRig();clearCalibration();}
  catch{if(signal.aborted||token!==generation)return;loading=false;sourceStatus='modelError';}sync();renderPeople();paintSoon();}
function decode(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error(tr('badImage')));img.src=url;});}
function checkPhoto(img){if(!fits(img.naturalWidth,img.naturalHeight))throw Error(tr('dimensions'));}
function compressed(img){const c=document.createElement('canvas'),k=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));const ctx=c.getContext('2d');ctx.fillStyle='#ede8e0';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9);}
async function sourceFromFile(f){if(!f||!f.size||f.size>18*1024*1024)throw Error(tr('invalidFile'));
  const bytes=new Uint8Array(await f.arrayBuffer()),gif=gifHeader(bytes),bmp=bmpSize(bytes),hi=heifHeader(bytes,fits),size=gif?.size||bmp||hi?.size||dimensions(bytes);
  if(!size)throw Error(tr('invalidFile'));if(!fits(...size))throw Error(tr('dimensions'));
  const blob=gif?new Blob([bytes.subarray(0,gif.end),new Uint8Array([0x3b])],{type:'image/gif'}):hi?new Blob([bytes],{type:hi.mime}):bmp?new Blob([bytes],{type:'image/bmp'}):f;
  const url=URL.createObjectURL(blob);try{const im=await decode(url);checkPhoto(im);return {type:'custom',name:f.name.replace(/\.[^.]+$/,'').slice(0,80)||tr('noTitle'),data:compressed(im)};}finally{URL.revokeObjectURL(url);}}
async function openSource(src,marks=[],savedControls={},savedGain=100,held=null,targeting={},savedRear=null){
  const token=++generation;analysis?.abort();analysis=new AbortController();const signal=analysis.signal;
  loading=true;sourceStatus='analyzing';pick=null;sync();
  try{const img=await decode(sourceURL(src));checkPhoto(img);if(token!==generation)return;
    backGeneration++;references=null;rearData=null;source=src;view=defaultView();savedBaseline=null;photo=img;aspect=img.naturalHeight/img.naturalWidth;anchors=marks;allFaces=[];subjectRegion=targeting.region||null;subjectPoint=targeting.point||null;handMarks=targeting.hands||[];detected={face:null,hands:[]};raw=false;hold=null;mesh=false;$('thumbnail').src=img.src;
    applyControls(savedControls);$('gain').value=savedGain;$('gain').nextElementSibling.value=savedGain+'%';applyRig();paint();
    const referenceLoad=isWinter(src)?import('./winter-views.mjs?v=cdb9faa014').then(m=>m.loadWinterViews(decode)).catch(()=>null):Promise.resolve(null);
    let modelError=false,result;try{result=await analyze(img,signal,subjectRegion,subjectPoint);}catch(err){if(signal.aborted)return;modelError=true;}
    let fitted=await referenceLoad;
    if(fitted&&savedRear)fitted={...fitted,rearLayer:await makeRearLayer(savedRear)};
    if(token!==generation)return;references=fitted;rearData=fitted?savedRear:null;detected=result||{face:null,hands:[]};detected.hands=detected.hands.filter(h=>h.landmarks?.length===21).slice(0,2).sort((a,b)=>a.landmarks[0].x-b.landmarks[0].x);
    loading=false;sourceStatus=marks.length?'anchored':detected.face?'':detected.pose?'poseHead':modelError?'modelError':'noFace';applyRig();if(held)hold=held;clearCalibration();sync();renderPeople();paintSoon();
  }catch(err){if(token===generation){loading=false;sourceStatus='badImage';sync();}throw err;}
}
async function makeRearLayer(data){
  const [image,map]=await Promise.all([decode(data),decode(new URL('../assets/winter-rear-registration.png',import.meta.url).href)]);
  return projectRearPhoto(image,map);
}
$('addBack').onclick=()=>$('backFile').click();
$('backFile').onchange=async()=>{
  const file=$('backFile').files[0],attempt=++backGeneration;$('backFile').value='';
  if(!file||!references)return;
  try{
    const src=await sourceFromFile(file),image=await decode(src.data);
    if(attempt!==backGeneration)return;
    const data=await cropRearPhoto(image);if(!data||attempt!==backGeneration)return;
    const layer=await makeRearLayer(data);if(attempt!==backGeneration)return;
    references={...references,rearLayer:layer};rearData=data;applyRig();
    view.yaw=180;raw=false;sync();paintSoon();
  }catch{if(attempt===backGeneration)flash('badImage');}
};
$('clearBack').onclick=()=>{
  ++backGeneration;if(!references)return;
  references={...references,rearLayer:null};rearData=null;applyRig();sync();paintSoon();
};
async function handleFile(file){if(!file)return;const id=++fileGeneration;try{const src=await sourceFromFile(file);if(id===fileGeneration)await openSource(src);}catch(err){if(id===fileGeneration){sourceStatus=['invalidFile','badImage','dimensions'].find(key=>tr(key)===err.message)||'badImage';sync();}}}
$('upload').onclick=()=>$('photoFile').click();$('photoFile').onchange=()=>{const file=$('photoFile').files[0];$('photoFile').value='';handleFile(file);};$('useExample').onclick=()=>openSource(winter).catch(()=>{});
stage.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();stage.classList.add('drag');}});stage.addEventListener('dragleave',e=>{if(!stage.contains(e.relatedTarget))stage.classList.remove('drag');});stage.addEventListener('drop',e=>{e.preventDefault();stage.classList.remove('drag');handleFile(e.dataTransfer.files[0]);});
$('moving').onclick=()=>{raw=false;sync();paintSoon();};$('original').onclick=()=>{raw=true;sync();paintSoon();};$('mesh').onclick=()=>{mesh=!mesh;raw=false;sync();paintSoon();};
function updateView(changes){Object.assign(view,changes);sync();paintSoon();}
$('orbit').oninput=e=>updateView({yaw:Number(e.target.value)});
$('zoom').oninput=e=>updateView({zoom:Number(e.target.value)/100});
$('light').onchange=e=>updateView({light:Number(e.target.value)});
$('homeView').onclick=()=>updateView(defaultView());
const wrapDegrees=v=>((v+180)%360+360)%360-180;
canvas.addEventListener('pointerdown',e=>{
  if(pick||raw||!surface.sculpture||!surface.available||e.button!==0)return;
  orbitPointer={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:view.yaw,pitch:view.pitch};
  e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
});
canvas.addEventListener('pointermove',e=>{
  if(!orbitPointer||orbitPointer.id!==e.pointerId)return;
  const speed=155/Math.max(180,canvas.getBoundingClientRect().width);
  updateView({yaw:wrapDegrees(orbitPointer.yaw+(e.clientX-orbitPointer.x)*speed),pitch:clamp(orbitPointer.pitch+(e.clientY-orbitPointer.y)*speed,-65,65)});canvas.style.cursor='grabbing';
});
for(const evt of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(evt,e=>{if(orbitPointer?.id===e.pointerId){orbitPointer=null;canvas.style.cursor='grab';}});
canvas.addEventListener('keydown',e=>{
  if(pick||raw||!surface.sculpture)return;
  const dir={ArrowRight:[8,0],ArrowLeft:[-8,0],ArrowDown:[0,6],ArrowUp:[0,-6]}[e.key];
  if(dir){e.preventDefault();updateView({yaw:wrapDegrees(view.yaw+dir[0]),pitch:clamp(view.pitch+dir[1],-65,65)});}
  else if(e.key==='Home'){e.preventDefault();updateView(defaultView());}
});
$('glb').onclick=async()=>{
  if(loading||!rig||!surface.sculpture||exportPending)return;
  exportPending=true;sync();const instance=surface.sculpture;const frame=structuredClone(poseForFrame());
  const name=sourceTitle(source);
  const attribution=isWinter(source)?{copyright:winterCredit,extras:{source:photoPage,license:photoLicense,...(references&&!anchors.length&&!subjectRegion?{references:references.sources,posterior:rearData?'Locally supplied rear head photograph':'Modeled with a direct rear-view visual reference at 02:54; hair and fabric materials reconstructed from TV10 footage',rearReference:'https://www.youtube.com/watch?v=HnmIyCYLmJc&t=174s'}:{}),modifications:'Cropped photograph, reconstructed geometry and texture, posed in Portrait Loom.'}}:null;
  try{const {exportSculpture}=await import('./export3d.mjs?v=1ee4240916');instance.update(frame);
    const blob=await exportSculpture(instance,attribution),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name.slice(0,70)+' — Portrait Loom.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);flash('glbDone');
  }catch{flash('glbError');}finally{exportPending=false;sync();paintSoon();}
};
function startPicking(mode){pickMode=mode;pick=[];cursor={x:.5,y:.4};areaPointer=null;raw=false;canvas.focus({preventScroll:true});canvas.scrollIntoView({block:'nearest'});sync();renderPeople();paintSoon();}
function cancelPicking(){pick=null;pickMode='';cursor=null;areaPointer=null;sync();renderPeople();paintSoon();}
$('areaBtn').onclick=()=>startPicking('area');$('clearArea').onclick=()=>scan(null);$('anchorBtn').onclick=()=>startPicking('basic');$('detailFace').onclick=()=>startPicking('face');$('traceHand').onclick=()=>startPicking('hand');$('cancelAnchor').onclick=cancelPicking;$('hudCancel').onclick=cancelPicking;
$('clearMarks').onclick=()=>{anchors=[];handMarks=[];sourceStatus=detected.face?'':'noFace';applyRig();};$('backMark').onclick=()=>{if(pick?.length)pick.pop();sync();paintSoon();};$('skipTip').onclick=()=>mark(null);
function mark(point){if(!pick)return;const points=[...pick,point],last=points.length===pickPrompts[pickMode].length;
  if(!last){pick.push(point);if(point)cursor={x:point.x,y:clamp(point.y+.13,0,1)};sync();paintSoon();return;}
  if(pickMode==='area'){const area=normalizedRect(points[0],point);if(area.width<.035||area.height<.035){flash('smallArea');return;}cancelPicking();scan(area);return;}
  try{if(pickMode==='hand'){tracedHand(points,aspect);handMarks.push(points);sourceStatus='handLinked';}else{refinedFace(points,aspect,manualFace);anchors=points;sourceStatus='anchored';}}
  catch{flash(pickMode==='hand'?'needFinger':'landmarkError');return;}cancelPicking();applyRig();}
function pointerPoint(e){const b=canvas.getBoundingClientRect();return{x:clamp((e.clientX-b.left)/b.width,0,1),y:clamp((e.clientY-b.top)/b.height,0,1)};}
canvas.addEventListener('pointerdown',e=>{if(!pick||e.button!==0)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);areaPointer={id:e.pointerId,start:pointerPoint(e),newBox:pickMode==='area'&&!pick.length};});
canvas.addEventListener('pointermove',e=>{if(!pick||areaPointer?.id!==e.pointerId)return;cursor=pointerPoint(e);if(areaPointer.newBox&&!pick.length&&Math.hypot(cursor.x-areaPointer.start.x,cursor.y-areaPointer.start.y)>.012)pick.push(areaPointer.start);paintSoon();});
canvas.addEventListener('pointerup',e=>{if(!pick||areaPointer?.id!==e.pointerId)return;const p=pointerPoint(e);areaPointer=null;mark(p);});canvas.addEventListener('pointercancel',()=>{areaPointer=null;});
canvas.addEventListener('keydown',e=>{if(!pick||document.querySelector('dialog[open]'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();mark({...cursor});return;}if(e.key==='Escape'){cancelPicking();return;}const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(d){e.preventDefault();const step=e.shiftKey?.04:.008;cursor={x:clamp(cursor.x+d[0]*step,0,1),y:clamp(cursor.y+d[1]*step,0,1)};paintSoon();}});
function clearCalibration(){samples=[];sampleStarted=0;baseline=null;neutralHands.clear();trackedHands.clear();activeHands=[];live=resting();recentFrame=0;neutralBody=null;liveBody=null;lastBodyTime=0;bodyTargets=null;lastFaceTime=0;if(cameraSession)trackStatus='neutral';}
function bindHands(input,videoAspect,time){
  const results=[],used=new Set(),claimed=new Set();
  const hands=input.slice(0,2).map(h=>({h,raw:handPoints(h,videoAspect)}));
  const previous=[...trackedHands.values()].filter(track=>time-track.seen<400);
  if(hands.length===2&&previous.length<2){
    const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y),[a,b]=hands.map(hand=>hand.raw);
    const width=Math.max(distance(a[5],a[17]),distance(b[5],b[17]));
    const overlap=[0,5,9,13,17].reduce((sum,k)=>sum+distance(a[k],b[k]),0)/5;
    if(distance(a[0],b[0])<width*.60&&overlap<width*.90){
      const keep=previous.length?hands.findIndex(hand=>hand.h.handedness===previous[0].key):0;
      hands.splice(keep===1?0:1,1);
    }
  }
  const keys=['Left','Right'];
  function matchCost({h,raw},key){
    const last=trackedHands.get(key),age=last?time-last.seen:Infinity;
    const wrist=raw[0],mismatch=h.handedness&&h.handedness!==key;
    const penalty=mismatch?(age<220?.013:.32):0;
    if(age>650)return penalty+(previous.length ? .13 : 0)+Math.abs(wrist.x-(key==='Left'?.7:.3))*.035;
    const x=last.points[0].x+last.vx*Math.min(100,age),y=last.points[0].y+last.vy*Math.min(100,age);
    const shape=[5,9,17].reduce((sum,i)=>sum+Math.hypot(raw[i].x-wrist.x-last.points[i].x+last.points[0].x,raw[i].y-wrist.y-last.points[i].y+last.points[0].y),0)/3;
    return penalty+shape*.85+Math.hypot(wrist.x-x,wrist.y-y);
  }
  // Assign the two observations together so detection order cannot steal a wrist.
  const score=(a,b)=>hands.reduce((sum,h,i)=>sum+matchCost(h,i?b:a),0);
  if(score(keys[1],keys[0])<score(keys[0],keys[1]))keys.reverse();
  for(const [i,{h,raw}] of hands.entries()){
    const key=keys[i],w=raw[0],prev=trackedHands.get(key),age=prev?time-prev.seen:Infinity;
    used.add(key);
    if(!neutralHands.has(key))neutralHands.set(key,raw);
    const returning=age>350,origin=neutralHands.get(key);
    const points=returning?smoothPoints(origin,raw,.035):smoothPoints(prev.points,raw,age/1000);
    let idx=prev?.source>=0&&!claimed.has(prev.source)?prev.source:sourceHands.findIndex((s,j)=>!claimed.has(j)&&s.handedness===key);
    const inferred=surface.sculpture?.inferredPalms?.some(Boolean)&&sourceHands.length===1&&['Left','Right'].includes(sourceHands[0].handedness)&&sourceHands[0].handedness!==key;
    if(inferred)idx=-1;
    if(idx<0&&!inferred){let best=Infinity;rig.palms.forEach((p,i)=>{const d=Math.abs(p[0].x-(1-w.x));if(!claimed.has(i)&&d<best){idx=i;best=d;}});}
    if(idx>=0)claimed.add(idx);const vx=returning?0:clamp((points[0].x-prev.points[0].x)/Math.max(1,age),-.003,.003);
    const vy=returning?0:clamp((points[0].y-prev.points[0].y)/Math.max(1,age),-.003,.003);
    const entry={key,source:idx,points,vx,vy,seen:time,videoAspect};trackedHands.set(key,entry);results.push(entry);
  }
  for(const [key,last] of trackedHands){if(used.has(key))continue;const age=time-last.seen;
    if(age>650||claimed.has(last.source)||results.length>=2)continue;
    const alpha=Math.exp(-Math.max(0,age-125)/160),origin=neutralHands.get(key);if(!origin)continue;
    const points=last.points.map((p,i)=>{
      const q={};for(const channel of ['x','y','z','mx','my','mz']){
        if(Number.isFinite(p[channel])&&Number.isFinite(origin[i][channel]))q[channel]=origin[i][channel]+(p[channel]-origin[i][channel])*alpha;
      }
      if(last.source<0&&!surface.sculpture?.inferredPalms?.some(Boolean))q.y+=(1-alpha)*videoAspect;
      return q;
    });
    results.push({...last,points});}
  return results;
}
function onFrame(frame){if(!cameraSession||!rig)return;
  const videoAspect=video.videoHeight/Math.max(1,video.videoWidth)||.75,time=frame.time??performance.now();
  const signal=faceSignal(frame.face,videoAspect),dt=recentFrame?clamp((time-recentFrame)/1000,.001,.25):.05,gain=Number($('gain').value)/100;recentFrame=time;
  const prevFace=presence.face,prevHands=presence.hands,prevBody=presence.body,prevState=trackStatus;presence={face:!!signal,hands:frame.hands.length,body:!!frame.pose};activeHands=bindHands(frame.hands,videoAspect,time);
  if(!neutralBody&&frame.pose?.landmarks?.length===33&&signal)neutralBody=frame.pose.landmarks.map(p=>({...p}));
  if(signal){lastFaceTime=time;
    if(!baseline){if(!sampleStarted)sampleStarted=time;if(signal.blinkL<.8||signal.blinkR<.8)samples.push(signal);
      if(time-sampleStarted>720&&samples.length>=4){baseline=Object.fromEntries(Object.keys(signal).map(k=>[k,samples.map(x=>x[k]).sort((a,b)=>a-b)[Math.floor(samples.length/2)]]));samples=[];savedBaseline=baseline;}}
    if(baseline){for(const k of Object.keys(signal))if(baseline[k]===undefined)baseline[k]=signal[k];live=smoothPose(live,relativePose(signal,baseline,gain),dt);trackStatus='performing';}else trackStatus='neutral';
  }else{if(!baseline){samples=[];sampleStarted=0;}if(time-lastFaceTime>440){const target=resting(),p=frame.pose?.landmarks;
    if(p&&neutralBody&&Math.abs(live.yaw)>.31&&[0,7,8,11,12].every(i=>(p[i]?.visibility??0)>.55)){
      const side=l=>(l[0].x-(l[7].x+l[8].x)*.5)/Math.max(.035,.30*Math.abs(l[11].x-l[12].x),Math.abs(l[7].x-l[8].x));
      const offset=side(p)-side(neutralBody);
      if(Math.abs(offset)>.34&&offset*live.yaw<0)target.yaw=clamp(-offset*gain*1.1,-.98,.98);
    }
    live=smoothPose(live,target,dt,true);if(time-lastFaceTime>650)trackStatus=target.yaw?'profileTracking':'lost';}}
  if(rig.body?.enabled){
    if(frame.pose?.landmarks?.length===33){lastBodyTime=time;liveBody=frame.pose.landmarks;if(!neutralBody)neutralBody=liveBody.map(p=>({...p}));
      const next=bodyMotion(detected.pose,liveBody,neutralBody,gain*Number($('bodyGain').value)/100,aspect,videoAspect);bodyTargets=next?smoothPoints(bodyTargets,next,dt):null;}
    else if(bodyTargets&&time-lastBodyTime>220){bodyTargets=smoothPoints(bodyTargets,detected.pose.landmarks.map(p=>({x:p.x,y:p.y,dz:0})),dt*.28);if(time-lastBodyTime>850)bodyTargets=null;}}
  if(prevFace!==presence.face||prevHands!==presence.hands||prevBody!==presence.body||prevState!==trackStatus)sync();if(!hold)paintSoon();
}
function endSession(code='ended'){cameraSession=null;activeHands=[];bodyTargets=null;live=resting();presence={face:false,hands:0};trackStatus=code;sync();paintSoon();}
$('camera').onclick=async()=>{
  if(cameraSession){const old=cameraSession;cameraSession=null;old.abort();endSession();return;}
  const controller=new AbortController();cameraSession=controller;hold=null;clearCalibration();baseline=savedBaseline;raw=false;trackStatus='permission';sync();
  try{await startTracking({video,face:true,hands:true,pose:true,signal:controller.signal,onFrame,onStatus:status=>{
    if(cameraSession!==controller)return;if(status==='ended'||status==='error'){endSession(status);return;}
    trackStatus=status==='ready'?baseline?'performing':'neutral':status;sync();}});}catch{if(cameraSession===controller)endSession('error');}
};
$('bodyGain').oninput=()=>{$('bodyGain').nextElementSibling.value=$('bodyGain').value+'%';if(+$('bodyGain').value===0)bodyTargets=null;paintSoon();};
$('calibrate').onclick=()=>{hold=null;savedBaseline=null;clearCalibration();sync();paintSoon();};$('gain').oninput=()=>{$('gain').nextElementSibling.value=$('gain').value+'%';};
$('freeze').onclick=()=>{if(hold)hold=null;else if(cameraSession&&rig){hold=structuredClone(poseForFrame());flash('held');}sync();paintSoon();};
$('reset').onclick=()=>{applyControls({});hold=null;raw=false;sync();paintSoon();flash('resetDone');};
function creditExport(ctx,w,h){
  if(!isWinter(source))return;
  const font=Math.max(9,Math.min(18,w*.021)),pad=font*.7,band=font*3.25;
  ctx.save();ctx.fillStyle='rgba(20,25,29,.88)';ctx.fillRect(0,h-band,w,band);
  ctx.fillStyle='#fff';ctx.font=font+'px system-ui, sans-serif';ctx.textBaseline='middle';
  ctx.fillText(winterCredit+' · '+(raw?tr('originalStage'):tr('winterStudy')),pad,h-band+font*.93,w-pad*2);
  ctx.fillText('youtu.be/4j6nJVVj1hk · creativecommons.org/licenses/by/3.0/',pad,h-font*.89,w-pad*2);
  ctx.restore();
}
canvas.addEventListener('night-record-frame',e=>{const ctx=e.detail;creditExport(ctx,ctx.canvas.width,ctx.canvas.height);});
$('download').onclick=()=>{
  if(!rig||loading)return;paint(true);let output=canvas;
  if(isWinter(source)){output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
    const ctx=output.getContext('2d');ctx.drawImage(canvas,0,0);creditExport(ctx,output.width,output.height);}
  output.toBlob(blob=>{if(!blob){flash('exportError');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=(sourceTitle(source)).replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,70)+' — Portrait Loom.png';a.href=url;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);flash('exported');},'image/png');paintSoon();};
function preview(){if(!rig)return '';const c=document.createElement('canvas');c.width=216;c.height=162;const ctx=c.getContext('2d');ctx.fillStyle='#332434';ctx.fillRect(0,0,c.width,c.height);const k=Math.min(c.width/canvas.width,c.height/canvas.height);ctx.drawImage(canvas,(c.width-canvas.width*k)/2,(c.height-canvas.height*k)/2,canvas.width*k,canvas.height*k);return c.toDataURL('image/jpeg',.65);}
function validPoint(p,bound=1){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=bound;}
function parseHeld(value){if(value==null)return null;const err=()=>{throw Error(tr('badProject'));};if(!value.pose||!Array.isArray(value.targets)||value.targets.length>2||!Array.isArray(value.puppets)||value.puppets.length>2)err();const pose={};for(const k of Object.keys(resting())){const n=value.pose[k]??0;if(!Number.isFinite(n)||Math.abs(n)>1.05)err();pose[k]=n;}
  const hand=row=>row==null?null:Array.isArray(row)&&row.length===21&&row.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&Math.abs(p.x)<5&&Math.abs(p.y)<12)?row.map(({x,y,dz})=>({x,y,dz:Number.isFinite(dz)?clamp(dz,-2,2):0})):err();const body=value.body??null;if(body&&(!Array.isArray(body)||body.length!==33||!body.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-4&&p.x<=5&&p.y>=-4&&p.y<=5&&(p.dz===undefined||Number.isFinite(p.dz)&&Math.abs(p.dz)<=2))))err();return {pose,targets:value.targets.map(hand),puppets:value.puppets.map(hand),body};}
const signalKeys=['browL','browR','blinkL','blinkR','jaw','roll','yaw','pitch'];
function parsedBaseline(value){if(!value)return null;const b={};for(const key of [...signalKeys,'gazeX','gazeY','smileL','smileR','pucker','depth','turn','nod','lean','distance','eyeDepth']){if(value[key]===undefined&&!signalKeys.includes(key))continue;if(!Number.isFinite(value[key])||Math.abs(value[key])>7)throw Error(tr('badProject'));b[key]=value[key];}return b;}
let savedBaseline=null;
async function restore(saved){await ready;const fail=()=>{throw Error(tr('badProject'));};if(!saved||![1,2,3,4].includes(saved.version)||!saved.source||typeof saved.manual!=='object'||!saved.manual)fail();let src=saved.source;
  if(src.type==='sample'){
    const id=src.id===undefined?'atelier-1':src.id;
    if(typeof id!=='string'||!Object.hasOwn(sampleImages,id))fail();
    src={type:'sample',id};
  }
  if(src.type!=='sample'&&(src.type!=='custom'||typeof src.name!=='string'||!src.name.trim()||src.name.length>80||typeof src.data!=='string'||src.data.length>9000000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/u.test(src.data)))fail();
  if(src.type==='custom'){let size;try{size=dimensions(Uint8Array.from(atob(src.data.slice(23)),c=>c.charCodeAt(0)));}catch{fail();}if(!size||!fits(size[0],size[1],1800))fail();}
  for(const [k,[min,max]] of Object.entries(controlRanges)){const n=saved.manual[k]??0;if(!Number.isFinite(n)||n<min||n>max)fail();}
  const marks=saved.anchors,level=saved.gain;if(!Array.isArray(marks)||![0,2,5].includes(marks.length)||!marks.every(p=>validPoint(p))||!Number.isFinite(level)||level<40||level>170)fail();
  const savedRear=saved.rearPhoto??null;
  if(savedRear!==null){
    if(!isWinter(src)||typeof savedRear!=='string'||savedRear.length>900000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/u.test(savedRear))fail();
    let size;try{size=dimensions(Uint8Array.from(atob(savedRear.slice(23)),c=>c.charCodeAt(0)));}catch{fail();}
    if(size?.[0]!==448||size?.[1]!==512)fail();
  }
  const target=saved.targeting??{},region=target.region,person=target.point,traces=target.hands??[];
  if(region&&(!validPoint(region)||!Number.isFinite(region.width)||!Number.isFinite(region.height)||region.width<.025||region.height<.025||region.x+region.width>1.00001||region.y+region.height>1.00001))fail();
  if(person&&!validPoint(person))fail();if(!Array.isArray(traces)||traces.length>2||!traces.every(row=>Array.isArray(row)&&row.length===6&&row[0]&&row.slice(1).some(Boolean)&&row.every(p=>p===null||validPoint(p))))fail();
  const bodyGain=saved.bodyGain??80;if(!Number.isFinite(bodyGain)||bodyGain<0||bodyGain>125)fail();
  if([saved.raw,saved.mesh].some(v=>v!==undefined&&typeof v!=='boolean'))fail();
  const restoredView=saved.view||defaultView();
  for(const [key,low,high] of [['yaw',-180,180],['pitch',-65,65],['zoom',.65,1.65],['light',0,2]])if(!Number.isFinite(restoredView[key])||restoredView[key]<low||restoredView[key]>high)fail();
  if(!Number.isInteger(restoredView.light))fail();
  const freeze=parseHeld(saved.held),neutral=parsedBaseline(saved.neutral),manual={...saved.manual};
  if(saved.version<4){
    for(const [key,conversion] of [['yaw',.76/1.38],['pitch',.46/.72],['roll',.39/.60]]){
      if(freeze)freeze.pose[key]*=conversion;
      if(manual[key]!==undefined)manual[key]=Math.round(manual[key]*conversion);
    }
  }
  const candidate=await decode(sourceURL(src));checkPhoto(candidate);if(marks.length){try{refinedFace(marks,candidate.naturalHeight/candidate.naturalWidth,manualFace);}catch{fail();}}
  try{for(const trace of traces)tracedHand(trace,candidate.naturalHeight/candidate.naturalWidth);}catch{fail();}
  if(cameraSession){const old=cameraSession;cameraSession=null;old.abort();endSession();}await openSource(src.type==='sample'?src:{type:'custom',name:src.name,data:src.data},marks,manual,level,freeze,target,savedRear);$('bodyGain').value=bodyGain;$('bodyGain').nextElementSibling.value=bodyGain+'%';savedBaseline=neutral;view={...restoredView};mesh=!!saved.mesh;raw=!!saved.raw;sync();paintSoon();
}
ready=openSource(winter).catch(()=>{});
window.NightLibrary?.register({getState:async()=>{await ready;if(loading||!photo)throw Error(tr('busy'));return {version:4,...(rearData?{rearPhoto:rearData}:{}),view:{...view},source:{...source},anchors,targeting:{region:subjectRegion,point:subjectPoint?{x:subjectPoint.x,y:subjectPoint.y}:null,hands:handMarks},bodyGain:Number($('bodyGain').value),manual:allControls(),gain:Number($('gain').value),raw,mesh,held:hold?structuredClone(hold):null,neutral:baseline||savedBaseline};},restore,getTitle:()=>sourceTitle(source),getPreview:preview});

installComparison({surface,refresh:paintSoon,context:()=>({aspect,palms:rig.palms,inferred:surface.sculpture.inferredPalms,landmarks:detected.pose.landmarks,model:surface.sculpture})});

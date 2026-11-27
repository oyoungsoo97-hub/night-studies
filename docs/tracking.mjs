// Both studios share one loader. Media stays on the device, including still-image analysis.
const assets = new URL('./assets/hands/', import.meta.url);
const models = {
  hands: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1',
  face: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
};
const bytes = new Map();
let runtime, creation = Promise.resolve();
function check(signal) {
  if (signal?.aborted) throw new DOMException('Cancelled','AbortError');
}
async function model(name) {
  if (!bytes.has(name)) {
    bytes.set(name,(async () => {
      const response = await fetch(new URL(name+'.task',assets));
      if (!response.ok) throw Error('MODEL_LOAD');
      const buffer = await response.arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));
      if (Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('') !== models[name]) throw Error('MODEL_INTEGRITY');
      return new Uint8Array(buffer);
    })().catch(error => {bytes.delete(name);throw error;}));
  }
  return bytes.get(name);
}
function loadRuntime() {
  if (!runtime) runtime=(async()=>{
    const lib=await import(new URL('vision_bundle.mjs',assets).href);
    const files=await lib.FilesetResolver.forVisionTasks(new URL('wasm',assets).href);
    return {lib,files};
  })().catch(error=>{runtime=null;throw error;});
  return runtime;
}
async function createTask(kind, mode, signal) {
  const [{lib,files}, weights] = await Promise.all([loadRuntime(),model(kind)]);
  // MediaPipe initializes its WASM factory on the global object. Sequence independent tasks.
  const build = async () => {
    check(signal);
    const isFace=kind==='face';
    const Task=isFace ? lib.FaceLandmarker : lib.HandLandmarker;
    const settings=isFace?{numFaces:1,outputFaceBlendshapes:true,minFaceDetectionConfidence:.42,minFacePresenceConfidence:.42}
                         :{numHands:2,minHandDetectionConfidence:.42,minHandPresenceConfidence:.42};
    let task;
    for(const delegate of ['GPU','CPU']){
      try {task=await Task.createFromOptions(files,{runningMode:mode,...settings,baseOptions:{delegate,modelAssetBuffer:weights}});break;}
      catch(error){if(delegate==='CPU')throw error;check(signal);}
    }
    if(signal?.aborted){task.close();check(signal);}
    return task;
  };
  const result=creation.then(build); creation=result.catch(()=>{});
  return result;
}
function readHands(result) {
  return (result?.landmarks || []).map((landmarks,i)=>({landmarks,handedness:result.handedness?.[i]?.[0]?.categoryName || ''}));
}
function readFace(result) {
  if (!result?.faceLandmarks?.length) return null;
  return {landmarks:result.faceLandmarks[0],blendshapes:Object.fromEntries((result.faceBlendshapes?.[0]?.categories||[]).map(c=>[c.categoryName,c.score]))};
}
export async function detectPortrait(image,{signal}={}) {
  check(signal);
  let faceTask,handTask;
  try{
    faceTask=await createTask('face','IMAGE',signal);
    const face=readFace(faceTask.detect(image));
    faceTask.close();faceTask=null;check(signal);
    handTask=await createTask('hands','IMAGE',signal);
    return {face,hands:readHands(handTask.detect(image))};
  }finally{faceTask?.close();handTask?.close();}
}
export async function startTracking({video,hands=true,face=false,onFrame=()=>{},onStatus=()=>{},signal}){
  check(signal);
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)throw new DOMException('Camera unavailable','NotSupportedError');
  if (!hands && !face) throw Error('NO_TRACKER');
  const controller=new AbortController();
  let stream,handTask,faceTask,raf=0,stopped=false,prevVideo=-1,lastRun=-Infinity,missingSince=0,lost=false;
  const hidden=()=>{if(document.hidden)stop();};
  function stop(code='ended') {
    if(stopped)return;
    stopped=true;controller.abort();cancelAnimationFrame(raf);
    window.removeEventListener('pagehide',stopExternal);document.removeEventListener('visibilitychange',hidden);
    signal?.removeEventListener('abort',stopExternal);
    stream?.getTracks().forEach(track=>track.stop());
    if(stream && video.srcObject===stream){video.pause();video.srcObject=null;}
    handTask?.close();faceTask?.close();handTask=faceTask=null;
    onStatus(code);
  }
  function stopExternal(){stop();}
  function frame(now) {
    if(stopped)return;
    raf=requestAnimationFrame(frame);
    if(video.readyState<2 || video.currentTime===prevVideo || now-lastRun<48)return;
    prevVideo=video.currentTime;lastRun=now;
    try {
      const data={time:now,hands:readHands(handTask?.detectForVideo(video,now)),face:readFace(faceTask?.detectForVideo(video,now))};
      if(data.face||data.hands.length){if(lost)onStatus('ready');lost=false;missingSince=0;}
      else if(!missingSince)missingSince=now;
      else if(!lost && now-missingSince>650){lost=true;onStatus('lost');}
      onFrame(data);
    }catch(error){stop('error');}
  }
  signal?.addEventListener('abort',stopExternal,{once:true});
  window.addEventListener('pagehide',stopExternal);document.addEventListener('visibilitychange',hidden);
  try{
    onStatus('permission');
    const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}});
    if(stopped){acquired.getTracks().forEach(t=>t.stop());check(controller.signal);}
    stream=acquired;
    stream.getVideoTracks()[0].addEventListener('ended',stopExternal,{once:true});
    video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();check(controller.signal);
    onStatus('loading');
    if(hands)handTask=await createTask('hands','VIDEO',controller.signal);check(controller.signal);
    if(face)faceTask=await createTask('face','VIDEO',controller.signal);check(controller.signal);
    onStatus('ready');raf=requestAnimationFrame(frame);
    return {stop:stopExternal};
  }catch(error){stop(error?.name==='AbortError'?'ended':'error');throw error;}
}

// Two nearby palms choose the tear's origin. Moving them apart draws the tear.
(() => {
  const button = document.getElementById('cameraTear');
  if (!button) return;
  const status = document.getElementById('handStatus');
  const assets = new URL('assets/hands/', document.currentScript.src);
  const modelURL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  const modelHash = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('aria-label', '손 인식용 거울 화면');
  video.style.cssText = 'position:absolute;left:14px;top:14px;width:clamp(72px,14%,140px);aspect-ratio:4/3;object-fit:cover;transform:scaleX(-1);border:1px solid #f8f1d6aa;border-radius:5px;z-index:3;pointer-events:none';
  video.hidden = true;
  document.getElementById('trainStage').append(video);
  let session = 0, running = false, camera, tracker, frame, previousStamp = -1, lastRead = 0;
  let readyAt = 0, missingSince = 0, gesture = null, needsReset = false;
  const clamp = n => Math.max(0, Math.min(1, n));
  const say = s => { if (status.textContent !== s) status.textContent = s; };

  let modelRequest;
  async function readModel(signal) {
    const name = 'night-studies-hand-model-v1';
    let cache;
    try { cache = await caches.open(name); } catch { /* Private browsing may disable Cache Storage. */ }
    const cached = cache && await cache.match(modelURL);
    for (const reuse of cached ? [true, false] : [false]) {
      const response = reuse ? cached : await fetch(modelURL, { credentials: 'omit', signal });
      if (!response.ok) throw Error('Model unavailable');
      const bytes = await response.arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      if (Array.from(digest, b => b.toString(16).padStart(2,'0')).join('') !== modelHash) {
        if (cache) await cache.delete(modelURL);
        if (reuse) continue;
        throw Error('Model integrity');
      }
      if (cache && !reuse) { try { await cache.put(modelURL, new Response(bytes)); } catch { /* Optional offline copy. */ } }
      return new Uint8Array(bytes);
    }
  }
  function endGesture() {
    if (gesture) window.trainHands?.end();
    gesture = null;
    readyAt = 0;
  }
  function stop(message = '카메라를 껐습니다.') {
    session++;
    running = false;
    modelRequest?.abort();
    modelRequest = undefined;
    cancelAnimationFrame(frame);
    endGesture();
    camera?.getTracks().forEach(track => track.stop());
    camera = undefined;
    video.pause();
    video.srcObject = null;
    video.hidden = true;
    tracker?.close();
    tracker = undefined;
    previousStamp = -1;
    lastRead = 0;
    missingSince = 0;
    needsReset = false;
    button.textContent = '손으로 찢기';
    button.setAttribute('aria-pressed','false');
    say(message);
  }
  function read(now) {
    if (!running || !tracker) return;
    frame = requestAnimationFrame(read);
    if (video.readyState < 2 || now-lastRead < 66 || previousStamp === video.currentTime) return;
    lastRead = now;
    previousStamp = video.currentTime;
    let hands;
    try { hands = tracker.detectForVideo(video, now).landmarks; }
    catch { stop('손 인식을 멈췄습니다. 포스터를 드래그하거나 카메라를 다시 켜세요.'); return; }
    if (hands.length !== 2) {
      if (!missingSince) missingSince=now;
      if (now-missingSince > 300) {
        endGesture();
        needsReset=false;
        say('양손을 화면에 보여주고 가까이 모아주세요.');
      }
      return;
    }
    missingSince=0;
    const palms=hands.map(h=>({x:1-(h[0].x+h[9].x)/2,y:(h[0].y+h[9].y)/2})).sort((a,b)=>a.x-b.x);
    const [left,right]=palms;
    const distance=Math.hypot(right.x-left.x,(right.y-left.y)*video.videoHeight/video.videoWidth);
    if (needsReset) {
      if (distance>=.25) return;
      needsReset=false;
    }
    if (!gesture) {
      if (distance>.30) { readyAt=0;say('두 손을 가까이 모은 뒤 좌우로 벌려주세요.');return; }
      if (!readyAt) readyAt=now;
      if (now-readyAt<200) return;
      const x=clamp((left.x+right.x)/2-.12), y=clamp((left.y+right.y)/2);
      gesture={x,y,span:distance,startY:right.y,max:0,begun:false};
      say('손을 벌려 종이를 찢으세요.');
    }
    const spread=distance-gesture.span;
    if (!gesture.begun && spread>.045) {
      gesture.begun=true;
      window.trainHands?.begin(gesture.x,gesture.y);
    }
    if (gesture.begun) {
      gesture.max=Math.max(gesture.max,spread);
      window.trainHands?.move(clamp(gesture.x+Math.max(0,spread)*1.8),clamp(gesture.y+(right.y-gesture.startY)*1.25));
      if (spread>.44 || gesture.max-spread>.08) {
        endGesture();needsReset=true;say('다시 찢으려면 두 손을 모아주세요.');
      }
    }
  }
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {say('손 인식은 HTTPS 또는 localhost에서 사용할 수 있습니다. 드래그로도 찢을 수 있어요.');return;}
    running=true;
    const id=++session;
    button.textContent='카메라 끄기';button.setAttribute('aria-pressed','true');
    say('카메라 접근을 허용해 주세요. 영상은 이 브라우저에서 처리합니다.');
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
      if(id!==session){stream.getTracks().forEach(t=>t.stop());return;}
      camera=stream;video.srcObject=camera;video.hidden=false;
      camera.getVideoTracks()[0].addEventListener('ended',()=>{if(id===session)stop('카메라 연결이 종료됐습니다.');},{once:true});
      await video.play();
      if(id!==session)return;
      say('손 인식 모델을 준비합니다. 첫 사용 시 약 8MB를 내려받습니다.');
      modelRequest=new AbortController();
      const [{HandLandmarker,FilesetResolver},model]=await Promise.all([import(new URL('vision_bundle.mjs',assets).href),readModel(modelRequest.signal)]);
      if(id!==session)return;
      const wasm=await FilesetResolver.forVisionTasks(new URL('wasm',assets).href);
      if(id!==session)return;
      const options={baseOptions:{modelAssetBuffer:model,delegate:'GPU'},runningMode:'VIDEO',numHands:2};
      let detector;
      try{detector=await HandLandmarker.createFromOptions(wasm,options);}
      catch{if(id!==session)return;options.baseOptions.delegate='CPU';detector=await HandLandmarker.createFromOptions(wasm,options);}
      if(id!==session){detector.close();return;}
      tracker=detector;
      say('양손을 화면에 보여주고 가까이 모아주세요.');
      frame=requestAnimationFrame(read);
    } catch(error) {
      if(id!==session)return;
      const msg=error.name==='NotAllowedError'?'카메라 권한이 꺼져 있습니다. 드래그로도 찢을 수 있어요.':error.name==='NotFoundError'?'연결된 카메라가 없습니다. 드래그로도 찢을 수 있어요.':'손 인식을 시작할 수 없습니다. 인터넷 연결을 확인하거나 드래그로 찢어주세요.';
      stop(msg);
    }
  }
  button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>running?stop():start());
  window.addEventListener('pagehide',()=>{if(running)stop();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)stop('다른 화면으로 이동해 카메라를 껐습니다.');});
})();

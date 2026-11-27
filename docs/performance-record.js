// Record only the painted stage. Camera and microphone permissions are not needed by this control.
(() => {
  const host=document.querySelector('[data-record-stage]');
  if(!host)return;
  const source=document.getElementById(host.dataset.recordStage);
  const choose=NightI18n.t, idle=()=>choose('공연 녹화','Record performance','Auftritt aufnehmen');
  const button=document.createElement('button'),save=document.createElement('a'),info=document.createElement('span');
  button.type='button';save.hidden=true;info.setAttribute('role','status');info.className='ns-record-info';
  host.append(button,save,info);
  const maxSeconds=12;
  const codec=window.MediaRecorder && ['video/mp4;codecs=avc1.42001E','video/mp4','video/webm;codecs=vp8','video/webm'].find(c=>MediaRecorder.isTypeSupported(c));
  let recorder,stream,clock,paint,started,objectURL,problem=false,unloading=false;
  function labels(){
    const active=recorder?.state==='recording';
    button.textContent=active?choose('녹화 마치기','Finish recording','Aufnahme beenden'):idle();
    button.setAttribute('aria-pressed',String(!!active));
    button.disabled=!codec||!HTMLCanvasElement.prototype.captureStream;
    save.textContent=choose('공연 영상 저장','Download video','Video speichern');
    if(button.disabled)info.textContent=choose('이 브라우저에서는 PNG로 저장할 수 있어요.','This browser supports PNG export only.','Dieser Browser unterstützt nur den PNG-Export.');
    else if(active)info.textContent=Math.min(maxSeconds,Math.floor((performance.now()-started)/1000))+' / '+maxSeconds+' s';
    else if(problem)info.textContent=choose('영상을 만들 수 없습니다. 다시 시도해 주세요.','Could not record the stage. Please try again.','Die Aufnahme ist fehlgeschlagen. Bitte erneut versuchen.');
    else info.textContent=choose('무대 화면만 · 최대 12초','Stage only · up to 12 s','Nur die Bühne · bis zu 12 s');
  }
  function cleanup(){clearInterval(clock);cancelAnimationFrame(paint);stream?.getTracks().forEach(t=>t.stop());stream=null;}
  function finish(){if(recorder?.state==='recording')recorder.stop();}
  button.addEventListener('click',()=>{
    if(recorder){finish();return;}
    try{
      const canvas=document.createElement('canvas'), scale=Math.min(1,1280/Math.max(source.width,source.height));
      canvas.width=Math.max(2,2*Math.round(source.width*scale/2));canvas.height=Math.max(2,2*Math.round(source.height*scale/2));
      const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(source,0,0,canvas.width,canvas.height);
      stream=canvas.captureStream(24);recorder=new MediaRecorder(stream,{mimeType:codec,videoBitsPerSecond:3500000});
      const chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>{problem=true;finish();cleanup();labels();};
      recorder.onstop=()=>{
        cleanup();
        if(chunks.length && !problem && !unloading){
          if(objectURL)URL.revokeObjectURL(objectURL);
          objectURL=URL.createObjectURL(new Blob(chunks,{type:codec}));save.href=objectURL;
          save.download=host.dataset.filename+'-'+new Date().toISOString().replace(/[:.]/g,'-')+(codec.includes('mp4')?'.mp4':'.webm');
          save.hidden=false;
        }else if(!unloading)problem=true;
        recorder=null;labels();
      };
      let last=0;started=performance.now();problem=false;
      function tick(now){if(!recorder||recorder.state!=='recording')return;if(now-last>=1000/25){ctx.drawImage(source,0,0,canvas.width,canvas.height);last=now;}paint=requestAnimationFrame(tick);}
      recorder.start(250);paint=requestAnimationFrame(tick);labels();
      clock=setInterval(()=>{if(performance.now()-started>=maxSeconds*1000)finish();else labels();},200);
    }catch{cleanup();recorder=null;problem=true;labels();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
  window.addEventListener('pagehide',()=>{unloading=true;finish();cleanup();if(objectURL)URL.revokeObjectURL(objectURL);});
  window.addEventListener('pageshow',()=>{if(unloading){unloading=false;objectURL=null;save.hidden=true;labels();}});
  document.addEventListener('night-language',labels);labels();
})();

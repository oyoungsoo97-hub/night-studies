'use strict';
window.FoleyMedia=(()=>{
  const maxBytes=12*1024*1024, maxSeconds=60, types=['video/mp4','video/webm'];
  const fail=text=>new Error(NightStudio.text(text));
  function read(file){
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(fail('영상 파일을 읽을 수 없습니다.'));reader.readAsDataURL(file);});
  }
  function metadata(video,url) {
    return new Promise((resolve,reject)=>{
      const finish=fn=>{clearTimeout(timer);video.onloadedmetadata=video.onerror=video.ondurationchange=video.ontimeupdate=null;fn();};
      const check=()=>{
        if(Number.isFinite(video.duration)&&video.duration>0){
          const duration=video.duration;
          finish(()=>duration<=maxSeconds+.001?resolve(duration):reject(fail('60초 이하의 영상을 선택하세요.')));
        }
      };
      const timer=setTimeout(()=>finish(()=>reject(fail('영상 길이를 읽을 수 없습니다. MP4 또는 WebM으로 내보낸 파일을 선택하세요.'))),12000);
      video.onloadedmetadata=()=>{if(!Number.isFinite(video.duration))video.currentTime=1e8;else check();};
      video.ondurationchange=video.ontimeupdate=check;
      video.onerror=()=>finish(()=>reject(fail('이 브라우저에서 재생 가능한 MP4 또는 WebM 영상을 선택하세요.')));
      video.src=url;
    });
  }
  async function prepare(input) {
    let name,type,data,blob;
    if(input instanceof File){
      name=input.name;type=input.type||(/\.webm$/i.test(name)?'video/webm':/\.mp4$/i.test(name)?'video/mp4':'');
      if(!types.includes(type))throw fail('MP4 또는 WebM 영상을 선택하세요.');
      if(!input.size||input.size>maxBytes)throw fail('12 MB 이하의 영상을 선택하세요.');
      blob=input.slice(0,input.size,type);
    }else{
      if(!input||!types.includes(input.type)||typeof input.name!=='string'||typeof input.data!=='string')throw fail('저장한 영상의 형식을 읽을 수 없습니다.');
      ({name,type,data}=input);
      const prefix='data:'+type+';base64,';
      if(data.length>Math.ceil(maxBytes/3)*4+prefix.length||!data.startsWith(prefix))throw fail('영상 파일의 형식 또는 용량을 확인하세요.');
      const body=data.slice(prefix.length);
      if(!body.length||body.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(body))throw fail('영상 데이터가 손상되었습니다.');
      const raw=atob(body),bytes=new Uint8Array(raw.length);
      if(!raw.length||raw.length>maxBytes)throw fail('영상 파일의 용량을 확인하세요.');
      for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      blob=new Blob([bytes],{type});
    }
    const video=document.createElement('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.setAttribute('aria-label','가져온 영상');
    const url=URL.createObjectURL(blob);
    try{
      const duration=await metadata(video,url);
      if(!video.videoWidth||!video.videoHeight)throw fail('영상 트랙을 찾을 수 없습니다.');
      video.currentTime=0;
      return {video,url,duration,asset:{name:name.trim().slice(0,160)||NightStudio.text('내 영상'),type,data:data||await read(blob)}};
    }catch(e){dispose({video,url});throw e;}
  }
  function dispose(media){if(!media)return;media.video.pause();media.video.removeAttribute('src');media.video.load();URL.revokeObjectURL(media.url);}
  function bank(slot,value){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('night-studies-foley-clips',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('film');
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{
        const db=req.result,write=value!==undefined,tx=db.transaction('film',write?'readwrite':'readonly'),store=tx.objectStore('film');
        const action=write?(value?store.put(value,slot):store.delete(slot)):store.get(slot);
        tx.oncomplete=()=>{db.close();resolve(action.result);};
        tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||fail('영상 임시 저장에 실패했습니다.'));};
      };
    });
  }
  return {prepare,dispose,bank};
})();

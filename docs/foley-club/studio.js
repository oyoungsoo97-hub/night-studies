'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const sound = window.FoleySound, film = window.FoleyFilm;
  let duration=8,clip=null,personalClip=null,clipKey='',loading=false;
  const LIMIT = 512, names = ['자갈 발소리', '열쇠 꾸러미', '문 경첩'];
  const params = new URLSearchParams(location.search);
  const baseKey = 'night-studies.foley.takes.v1';
  const slot = params.has('project') ? baseKey+'.project.'+params.get('project').slice(0,80) :
    params.get('edition')==='house' ? baseKey+'.house' : baseKey;
  const buttons = Array.from(document.querySelectorAll('[data-take]'));
  const pads = Array.from(document.querySelectorAll('[data-sound]'));
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
  const seconds=(n,length=duration)=>Math.min(Math.max(0,Math.floor(length*1000)-1),Math.round(clamp(n,0,length)*1000))/1000;
  const message = text => { $('#status').textContent=text; };
  const empty = () => ({A:[],B:[]});
  const stack=[], forward=[], timers=new Set();
  let personal=empty(), takes=personal, shared=false, selected='A', cue=null;
  let defaults={s:0,v:0,db:0,pan:0}, position=0, mode='idle', track=null, sequence=[], draft=[], index=0;
  let started=0,raf=0,frame=-1,muted=false,busy=false,variantCounter=0,drag=null;
  const mutedColor=['#efb46b','#9fc8be','#d8cd90'];
  function validate(data,length=8) {
    if(!data || ![1,2].includes(data.version))throw Error('지원하지 않는 폴리 프로젝트 형식입니다.');
    const clean=empty();
    for(const name of ['A','B']){
      if(!Array.isArray(data[name])||data[name].length>LIMIT)throw Error('테이크의 큐 개수가 올바르지 않습니다.');
      clean[name]=data[name].map(e=>{
        if(!e||!Number.isFinite(e.t)||e.t<0||e.t>=length||![0,1,2].includes(e.s)||![0,1,2].includes(e.v))throw Error('큐 데이터가 올바르지 않습니다.');
        const db=e.db??0,pan=e.pan??0;
        if(!Number.isInteger(db)||db < -24||db>6||!Number.isInteger(pan)||pan < -100||pan>100)throw Error('큐의 믹스 범위를 확인하세요.');
        return {t:seconds(e.t,length),s:e.s,v:e.v,db,pan};
      }).sort((a,b)=>a.t-b.t);
    }
    return clean;
  }
  const state=(withAsset=true)=>({version:2,A:clone(takes.A),B:clone(takes.B),selected,position:seconds(position),...(clip?(withAsset?{film:clip.asset}:{clipKey}):{})});
  async function restoreDraft(){
    try{
      const d=JSON.parse(localStorage.getItem(slot));if(!d)return;
      if(typeof d.clipKey==='string'){
        const asset=await FoleyMedia.bank(d.clipKey);if(!asset)throw Error();
        personalClip=await FoleyMedia.prepare(asset);clipKey=d.clipKey;
      }
      personal=validate(d,personalClip?.duration||8);takes=personal;
      selected=d.selected==='B'?'B':'A';position=Number.isFinite(d.position)?seconds(d.position,personalClip?.duration||8):0;
    }catch{FoleyMedia.dispose(personalClip);personalClip=null;clipKey='';message('지난 임시 작업을 읽지 못했습니다. 저장한 프로젝트는 작업 보관함에서 열 수 있습니다.');}
  }
  function persist(){
    if(shared)return true;
    personal=takes;
    if(clip&&!clipKey)return false;
    try{localStorage.setItem(slot,JSON.stringify(state(false)));return true;}catch{return false;}
  }
  function mount(media){
    clip=media;duration=media?.duration||8;frame=-1;
    const stage=$('#mediaStage');stage.replaceChildren(...(media?[media.video]:[]));stage.hidden=!media;
    $('#film').hidden=Boolean(media);$('#film-title').textContent=media?media.asset.name:'복도 끝의 문';
    $('#seek').max=duration;$('#cueTime').max=seconds(duration);
    const ruler=document.querySelectorAll('.timeline-ruler span');
    ruler.forEach((el,i)=>el.textContent=(i*duration/4).toFixed(1)+(i===4?' s':''));
    $('#arrangement').setAttribute('aria-label',duration.toFixed(2)+'초 효과음 타임라인');
  }
  async function remember(media){
    const oldKey=clipKey;clipKey='';
    if(media){
      const key=slot+'.'+crypto.randomUUID();
      try{await FoleyMedia.bank(key,media.asset);clipKey=key;}catch{}
    }
    if(persist()&&oldKey)FoleyMedia.bank(oldKey,null).catch(()=>{});
  }
  function switchMovie(media){
    const old=personalClip;personalClip=media;mount(media);if(old!==media)FoleyMedia.dispose(old);
    cue=null;stack.length=forward.length=0;$('#shareFallback').hidden=true;
  }
  function clearOfEnd(length){
    return ['A','B'].every(k=>takes[k].every(e=>e.t<length));
  }
  async function loadFilm(file){
    if(loading||mode!=='idle'||shared)return;
    loading=true;render();let next=null;
    try{
      next=file?await FoleyMedia.prepare(file):null;
      if(!clearOfEnd(next?.duration||8))throw Error('새 영상보다 늦은 큐가 있습니다. 현재 프로젝트를 저장한 뒤 해당 큐를 옮기거나 삭제하세요.');
      switchMovie(next);seek(0);await remember(next);
      changed(next?'영상을 열었습니다. 원본 소리는 음소거되며 WAV에는 편집한 효과음이 담깁니다.':'기본 장면을 열었습니다.');
    }catch(e){if(next&&next!==personalClip)FoleyMedia.dispose(next);message(e.message);}
    finally{loading=false;render();}
  }
  function checkpoint(){stack.push({takes:clone(takes),selected,position});if(stack.length>36)stack.shift();forward.length=0;}
  function changed(note){const ok=persist();render();if(note||!ok)message((note||'변경했습니다.')+(ok?'':' 이 세션에만 보관됩니다.'));}
  function historyMove(from,to){
    if(mode!=='idle'||shared||!from.length)return;
    to.push({takes:clone(takes),selected,position});
    const h=from.pop();takes=h.takes;selected=h.selected;cue=null;seek(h.position);changed('편집 기록을 적용했습니다.');
  }
  function flash(id,delay=0){
    const timer=setTimeout(()=>{timers.delete(timer);pads[id].classList.add('flash');
      const end=setTimeout(()=>{timers.delete(end);pads[id].classList.remove('flash');},112);timers.add(end);
    },delay*1000);timers.add(timer);
  }
  function quiet(){sound.stop();for(const t of timers)clearTimeout(t);timers.clear();pads.forEach(p=>p.classList.remove('flash'));}
  function revealTime(time){
    const scroll=$('#scoreScroll'),mat=scroll.firstElementChild;
    if(scroll.scrollWidth<=scroll.clientWidth)return;
    const left=mat.querySelector('[data-track]:not([hidden]) .instrument')?.offsetWidth||0;
    const at=left+(mat.offsetWidth-left)*time/duration;
    if(at<scroll.scrollLeft+left||at>scroll.scrollLeft+scroll.clientWidth-8){
      scroll.scrollLeft=Math.max(0,at-left-16);
    }
  }
  function seek(t) {
    position=clamp(t,0,duration);const f=Math.floor(position*24+.00001);
    if(clip&&mode==='idle'&&Math.abs(clip.video.currentTime-position)>.001)clip.video.currentTime=position;
    if(f!==frame){frame=f;if(!clip)film.draw(position);$('#timecode').textContent=String(Math.floor(f/1440)).padStart(2,'0')+':'+String(Math.floor(f/24)%60).padStart(2,'0')+':'+String(f%24).padStart(2,'0');}
    $('#seek').value=position;$('#seek').setAttribute('aria-valuetext',position.toFixed(2)+'초');
    if(mode!=='idle')revealTime(position);
    $('#arrangement').style.setProperty('--cursor',(position/duration*100)+'%');
    if(!cue&&document.activeElement!==$('#cueTime'))$('#cueTime').value=seconds(position).toFixed(3);
  }
  function makeLanes() {
    for(const name of ['A','B']){
      const pane=$('[data-track="'+name+'"]');
      names.forEach((s,id)=>{
        const row=document.createElement('div');row.className='cue-row';
        const label=document.createElement('button');label.type='button';label.className='instrument';label.textContent=s;label.style.setProperty('--track-color',mutedColor[id]);
        label.title=s+' 새 큐 설정';
        label.onclick=()=>{if(mode!=='idle'||shared)return;cue=null;defaults.s=id;render();};
        const lane=document.createElement('div');lane.className='cue-lane';lane.dataset.instrument=id;lane.dataset.ofTake=name;
        const marks=document.createElement('div');marks.className='marks';
        const cursor=document.createElement('div');cursor.className='edit-cursor';cursor.setAttribute('aria-hidden','true');
        lane.append(marks,cursor);row.append(label,lane);pane.append(row);
      });
    }
  }
  function paintCues(which) {
    const pane=$('[data-track="'+which+'"]');
    const events=mode==='record'&&track===which?draft:takes[which];
    const fragments=names.map(()=>document.createDocumentFragment());
    events.forEach((e,i)=>{
      const mark=document.createElement('button');mark.type='button';mark.className='cue mark s'+e.s;
      mark.dataset.index=i;mark.setAttribute('aria-pressed',String(e===cue));
      mark.setAttribute('aria-label',names[e.s]+' '+e.t.toFixed(3)+'초');mark.title=names[e.s]+' · '+e.t.toFixed(3)+'초';
      mark.disabled=mode!=='idle';mark.style.left=e.t/duration*100+'%';
      mark.style.width=Math.min(duration-e.t,sound.durations[e.s])/duration*100+'%';
      mark.style.setProperty('--track-color',mutedColor[e.s]);mark.style.setProperty('--amp',(.48+.52*((e.db??0)+24)/30));
      const grip=document.createElement('span');grip.className='grip';mark.append(grip);
      // Clip waveforms at the film's end, even when a cue starts on the last frame.
      const wave=document.createElement('canvas');wave.width=96;wave.height=28;wave.setAttribute('aria-hidden','true');sound.waveform(wave,e.s,e.v);mark.append(wave);
      fragments[e.s].append(mark);
    });
    pane.querySelectorAll('.marks').forEach((m,i)=>m.replaceChildren(fragments[i]));
    document.querySelector('[data-take="'+which+'"] .tab-count').textContent=events.length;
  }
  function readFields(){
    return {s:Number($('#cueSound').value),v:Number($('#cueVariant').value),db:Number($('#cueGain').value),pan:Number($('#cuePan').value)};
  }
  function values(db,pan){$('#gainValue').textContent=(db>0?'+':'')+db+' dB';$('#panValue').textContent=pan===0?'중앙':(pan<0?'L ':'R ')+Math.abs(pan);}
  function inspector(){
    const e=cue||defaults;
    $('#inspectTitle').textContent=cue?'선택한 큐':'새 큐';
    $('#cuePosition').textContent=cue?selected+' · '+names[e.s]:'재생 위치에 배치';
    $('#cueSound').value=e.s;$('#cueVariant').value=e.v;$('#cueTime').value=seconds(cue?cue.t:position).toFixed(3);
    $('#cueGain').value=e.db??0;$('#cuePan').value=e.pan??0;values(e.db??0,e.pan??0);
    const picker=$('#cuePicker');
    const current=takes[selected];
    picker.replaceChildren(new Option('새 큐',''),...current.map((ev,i)=>new Option(String(i+1).padStart(2,'0')+' · '+ev.t.toFixed(3)+'s · '+names[ev.s],i)));
    picker.value=cue?String(current.indexOf(cue)):'';
    picker.disabled=loading||mode!=='idle'||!current.length;
    const blocked=loading||shared||mode!=='idle';
    for(const id of ['cueSound','cueVariant','cueTime','cueGain','cuePan','addCue'])$('#'+id).disabled=blocked;
    $('#addCue').disabled=blocked||takes[selected].length>=LIMIT;
    $('#listenCue').disabled=mode!=='idle';
    for(const id of ['removeCue','nudgeBack','nudgeForward'])$('#'+id).disabled=blocked||!cue;
  }
  function render() {
    const active=loading||mode!=='idle',rec=mode==='record';
    $('#openFilm').disabled=active||shared;$('#stockFilm').hidden=!clip;$('#stockFilm').disabled=active||shared;
    $('#recordText').textContent=shared?'공유 테이크':rec?'녹음 마치기':selected+(takes[selected].length?' 다시 녹음':' 녹음');
    $('#record').disabled=shared||(active&&!rec);$('#record').classList.toggle('is-recording',rec);
    $('#playText').textContent=takes[selected].length?selected+' 듣기':'미리 보기';
    $('#play').disabled=active;$('#rewind').disabled=active;$('#seek').disabled=active;
    $('#stop').disabled=!active;$('#screenPlay').hidden=active;
    $('#screenPlay').setAttribute('aria-label',takes[selected].length?selected+' 테이크 듣기':'장면 미리 보기');
    $('#filmMode').textContent=rec?'REC / TAKE '+track:mode==='compare'||mode==='play'?'PLAY / TAKE '+track:'PREVIEW';
    $('#filmMode').style.color=rec?'#ffd38d':'';
    for(const b of buttons){
      b.disabled=active;b.setAttribute('aria-pressed',String(b.dataset.take===(mode==='compare'?track:selected)));
      const pane=$('[data-track="'+b.dataset.take+'"]');pane.hidden=b.dataset.take!==(mode==='compare'?track:selected);
      for(const label of pane.querySelectorAll('.instrument'))label.disabled=active||shared;
    }
    $('#copyTake').textContent=selected+'를 '+(selected==='A'?'B':'A')+'로 복사';
    $('#copyTake').disabled=active||shared||!takes[selected].length;
    $('#undo').disabled=active||shared||!stack.length;$('#redo').disabled=active||shared||!forward.length;
    $('#exportWave').disabled=busy||active||!takes[selected].length;
    $('#exportWave').textContent=busy?'렌더링 중…':selected+' WAV 저장';
    $('#compare').disabled=active||!takes.A.length||!takes.B.length;
    $('#share').disabled=active||(!clip&&$('#compare').disabled);
    $('#share').textContent=clip?'프로젝트 공유':'비교 링크';
    $('#compare').textContent=mode==='compare'?track+' 재생 중':'A · B 이어 듣기';$('#returnMine').hidden=!shared;
    pads.forEach(p=>p.disabled=active&&!rec);paintCues('A');paintCues('B');inspector();
  }
  function playCue(e,delay=0,offset=0){sound.hit(e.s,e.v,delay,e.db??0,e.pan??0,offset);flash(e.s,delay);}
  function schedule(t){
    if(!track||mode==='record')return;
    const events=takes[track];
    while(index<events.length&&events[index].t<t+.075){const e=events[index++];if(t-e.t<sound.durations[e.s])playCue(e,Math.max(0,e.t-t),Math.max(0,t-e.t));}
  }
  function stop(ended=false){
    if(mode==='idle')return;
    const was=mode,which=track;cancelAnimationFrame(raf);clip?.video.pause();quiet();mode='idle';track=null;sequence=[];
    if(was==='record'&&draft.length){checkpoint();takes[which]=draft.slice();cue=null;seek(0);changed(which+' 녹음을 마쳤습니다. 큐를 눌러 믹스를 편집하세요.');}
    else{
      if(ended)seek(duration);render();
      message(was==='record'?'새로 녹음한 소리가 없어 기존 테이크를 유지했습니다.':ended?(was==='compare'?'A와 B 비교를 마쳤습니다.':'재생을 마쳤습니다.'):'정지했습니다.');
    }
    draft=[];
  }
  function tick(now){
    if(mode==='idle')return;
    const t=clip?(clip.video.ended?duration:clip.video.currentTime):(now-started)/1000;
    if(t>=duration){
      if(mode==='compare'&&sequence.length){quiet();track=sequence.shift();index=0;started+=duration*1000;if(clip)startVideo(0);render();seek(0);schedule(0);message('같은 장면으로 B 테이크를 이어 듣습니다.');}
      else{stop(true);return;}
    }else{seek(t);schedule(t);}
    raf=requestAnimationFrame(tick);
  }
  function startVideo(t){
    const video=clip.video;video.currentTime=t;
    video.play().catch(()=>{if(mode!=='idle'&&clip?.video===video){stop();message('영상을 재생할 수 없습니다. 브라우저에서 지원하는 코덱을 확인하세요.');}});
  }
  function run(next){
    if(loading||mode!=='idle'||(next==='record'&&shared))return;
    if(!sound.unlock()){message('이 브라우저에서 오디오를 시작할 수 없습니다.');return;}
    quiet();mode=next;sequence=next==='compare'?['B']:[];
    track=next==='compare'?'A':next==='preview'?null:selected;
    const t=next==='record'||next==='compare'||position>=duration-.001?0:position;
    index=0;draft=[];started=performance.now()-t*1000;frame=-1;
    if(track&&next!=='record')while(index<takes[track].length&&takes[track][index].t+sound.durations[takes[track][index].s]<=t)index++;
    if(clip)startVideo(t);render();seek(t);schedule(t);
    message(next==='record'?track+' 녹음 중. 장면에 맞춰 패드를 누르세요.':next==='compare'?'A를 듣고 같은 장면의 B를 이어 듣습니다.':next==='preview'?'무성 장면을 재생합니다.':track+' 테이크를 재생합니다.');
    raf=requestAnimationFrame(tick);
  }
  function pad(id){
    if(mode!=='idle'&&mode!=='record')return;
    if(!sound.unlock()){message('오디오를 시작할 수 없습니다.');return;}
    const e={s:id,v:variantCounter++%3,db:0,pan:0};
    if(mode==='record'){
      const t=clip?clip.video.currentTime:(performance.now()-started)/1000;if(t>=duration){stop(true);return;}if(draft.length>=LIMIT)return;
      draft.push({...e,t:seconds(t)});paintCues(track);
    }else{if(!shared){cue=null;defaults={...e};render();}message(names[id]+' 미리 듣기');}
    playCue(e);
  }
  function choose(e){cue=e;if(e){defaults={s:e.s,v:e.v,db:e.db??0,pan:e.pan??0};seek(e.t);revealTime(e.t);}render();}
  function alter(changes){
    if(mode!=='idle'||shared)return;
    if(!cue){Object.assign(defaults,changes);if(changes.t!==undefined)seek(changes.t);inspector();return;}
    if(Object.entries(changes).every(([key,value])=>(cue[key]??0)===value))return;
    checkpoint();Object.assign(cue,changes);takes[selected].sort((a,b)=>a.t-b.t);seek(cue.t);changed();
  }
  function remove(){if(!cue||shared||mode!=='idle')return;checkpoint();takes[selected].splice(takes[selected].indexOf(cue),1);cue=null;changed('큐를 삭제했습니다.');}
  function add(){
    if(shared||mode!=='idle'||takes[selected].length>=LIMIT)return;
    checkpoint();const e={...readFields(),t:seconds(position)};takes[selected].push(e);takes[selected].sort((a,b)=>a.t-b.t);cue=e;changed(names[e.s]+' 큐를 '+e.t.toFixed(3)+'초에 추가했습니다.');
  }
  function listen(){if(mode!=='idle'||!sound.unlock())return;playCue(cue||defaults);}
  function laneTime(lane,x){const box=lane.getBoundingClientRect();return seconds((x-box.left)/Math.max(1,box.width)*duration);}
  function bindLane(lane){
    lane.addEventListener('pointerdown',event=>{
      if(mode!=='idle'||event.button!==0||drag)return;
      const mark=event.target.closest('.cue');
      if(!mark)return;
      event.preventDefault();
      const e=takes[selected][Number(mark.dataset.index)];if(!e)return;
      choose(e);
      const current=lane.querySelector('.cue[aria-pressed="true"]');current?.focus({preventScroll:true});
      if(shared)return;
      const offset=e.t-laneTime(lane,event.clientX);
      drag={lane,e,old:e.t,x:event.clientX,offset,moved:false,pointer:event.pointerId};
      lane.setPointerCapture(event.pointerId);
    });
    lane.addEventListener('pointermove',event=>{
      if(!drag||drag.lane!==lane||event.pointerId!==drag.pointer)return;
      if(!drag.moved&&Math.abs(event.clientX-drag.x)<3)return;
      if(!drag.moved){checkpoint();drag.moved=true;}
      drag.e.t=seconds(laneTime(lane,event.clientX)+drag.offset);seek(drag.e.t);
      const m=lane.querySelector('.cue[aria-pressed="true"]');
      if(m)m.style.left=drag.e.t/duration*100+'%';$('#cueTime').value=drag.e.t.toFixed(3);
    });
    function release(event){
      if(!drag||drag.lane!==lane||event.pointerId!==drag.pointer)return;
      const moved=drag.moved;drag=null;
      if(moved){takes[selected].sort((a,b)=>a.t-b.t);changed('선택한 큐를 '+cue.t.toFixed(3)+'초로 옮겼습니다.');}
    }
    lane.addEventListener('pointerup',release);lane.addEventListener('pointercancel',release);lane.addEventListener('lostpointercapture',release);
    lane.addEventListener('click',e=>{
      if(mode!=='idle')return;
      const b=e.target.closest('.cue');
      if(b&&e.detail===0){choose(takes[selected][Number(b.dataset.index)]);lane.querySelector('[aria-pressed="true"]')?.focus();}
      else if(!b&&e.detail>0&&e.target!==lane){cue=null;defaults.s=Number(lane.dataset.instrument);seek(laneTime(lane,e.clientX));render();}
    });
  }
  function house(){
    const make=rows=>rows.map(([t,s,v,db,pan])=>({t,s,v,db,pan}));
    return {version:2,selected:'A',position:0,
      A:make([[.35,0,2,-13,53],[.84,0,0,-11,41],[1.27,0,1,-8,32],[1.64,0,0,-7,22],[2.01,0,2,-7,15],[2.42,0,1,-6,7],[2.81,0,0,-5,2],[3.19,0,1,-5,-6],[3.73,0,2,-5,-10],[4.10,1,1,-5,16],[4.35,1,2,-3,22],[4.63,1,0,-7,18],[5.07,2,2,-2,9],[5.87,0,1,-9,5],[6.31,0,0,-13,1],[7.17,2,0,-10,-5]]),
      B:make([[.72,0,0,-12,45],[1.52,0,1,-11,29],[2.33,0,2,-10,18],[3.13,0,1,-10,10],[3.91,0,0,-9,2],[4.72,1,0,-14,11],[5.35,2,0,-12,-3],[6.43,0,2,-13,-9],[7.04,0,1,-18,-16],[7.54,2,1,-19,2]])};
  }
  async function restore(d) {
    if(loading)throw Error('영상을 여는 중입니다.');
    let media=null;loading=true;render();
    try{
      if(d?.film)media=await FoleyMedia.prepare(d.film);
      const next=validate(d,media?.duration||8);
      if(mode!=='idle')stop();
      if(location.hash.startsWith('#takes=')){const u=new URL(location.href);u.hash='';history.replaceState(null,'',u);}
      shared=false;takes=next;selected=d.selected==='B'?'B':'A';switchMovie(media);
      seek(Number.isFinite(d.position)?seconds(d.position):0);await remember(media);changed('프로젝트를 열었습니다.');
    }catch(e){if(media&&media!==personalClip)FoleyMedia.dispose(media);throw e;}
    finally{loading=false;render();}
  }
  let beforeShare=null;
  function route(){
    if(mode!=='idle')stop();const incoming=FoleyShare.decode(location.hash);
    if(incoming&&!shared)beforeShare={selected,position};
    shared=Boolean(incoming);takes=incoming?validate({...incoming,version:2}):personal;
    mount(incoming?null:personalClip);cue=null;$('#shareFallback').hidden=true;
    if(incoming){selected='A';seek(0);message('공유받은 테이크입니다. 재생하거나 WAV를 저장할 수 있습니다.');}
    else{
      if(beforeShare){selected=beforeShare.selected;seek(beforeShare.position);beforeShare=null;}
      if(location.hash.startsWith('#takes='))message('이 비교 링크를 읽을 수 없어 내 작업을 열었습니다.');
    }
    render();seek(position);
  }
  $('#returnMine').onclick=()=>{const u=new URL(location.href);u.hash='';try{history.replaceState(null,'',u);route();}catch{location.hash='';}};
  window.addEventListener('hashchange',route);
  $('#share').onclick=async()=>{
    if(clip){document.querySelector('[data-save-project]').click();message('‘파일로 내보내기’를 누르면 원본 영상과 두 테이크를 함께 공유할 수 있습니다.');return;}
    const fragment=FoleyShare.encode(takes);if(!fragment)return;
    const u=new URL(location.href);u.search='';u.hash=fragment;const local=u.protocol==='file:',value=local?fragment:u.href;
    try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(value);$('#shareFallback').hidden=true;message(local?'테이크 코드를 복사했습니다. 작품 웹 주소 뒤에 붙여넣으세요.':'두 믹스가 담긴 비교 링크를 복사했습니다.');}
    catch{$('#shareFallback').hidden=false;$('#shareField').value=value;$('#shareField').focus();$('#shareField').select();message('선택된 비교 링크를 복사하세요.');}
  };
  $('#exportWave').onclick=async()=>{
    if(busy||mode!=='idle'||!takes[selected].length)return;
    const which=selected,events=clone(takes[which]);busy=true;render();
    try{
      const blob=await sound.exportWav(events,duration),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='Foley-Club-Take-'+which+'.wav';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      message(which+' 테이크를 48 kHz 스테레오 WAV로 내보냈습니다.');
    }catch(e){message(e.message||'이 브라우저에서 WAV를 만들 수 없습니다.');}
    finally{busy=false;render();}
  };
  $('#record').onclick=()=>mode==='record'?stop():run('record');
  $('#play').onclick=$('#screenPlay').onclick=()=>run(takes[selected].length?'play':'preview');
  $('#stop').onclick=()=>stop();$('#compare').onclick=()=>run('compare');
  $('#rewind').onclick=()=>{cue=null;seek(0);render();};
  $('#timelineZoom').onchange=e=>{$('.score-mat').style.width=(Number(e.target.value)*100)+'%';revealTime(position);};
  $('#openFilm').onclick=()=>$('#filmFile').click();
  $('#filmFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)loadFilm(f);};
  $('#stockFilm').onclick=()=>loadFilm(null);
  $('#cuePicker').onchange=e=>choose(e.target.value===''?null:takes[selected][Number(e.target.value)]);
  $('#seek').oninput=e=>{const value=Number(e.target.value);const hadCue=Boolean(cue);cue=null;seek(value);if(hadCue){paintCues(selected);inspector();}};
  $('#seek').onchange=()=>{if(!shared)persist();};
  $('#mute').onclick=()=>{muted=!muted;sound.setMute(muted);$('#mute').setAttribute('aria-pressed',String(muted));$('#muteText').textContent=muted?'소리 꺼짐':'소리 켜짐';};
  buttons.forEach(b=>b.onclick=()=>{selected=b.dataset.take;cue=null;if(!shared)persist();render();message(selected+' 테이크를 선택했습니다.');});
  pads.forEach((p,id)=>{
    sound.waveform(p.querySelector('canvas'),id);
    p.onpointerdown=e=>{if(e.button===0&&!p.disabled){e.preventDefault();p.focus({preventScroll:true});pad(id);}};
    p.onclick=e=>{if(e.detail===0)pad(id);};
  });
  $('#addCue').onclick=add;$('#listenCue').onclick=listen;$('#removeCue').onclick=remove;
  $('#nudgeBack').onclick=()=>{if(cue)alter({t:seconds(cue.t-1/24)});};
  $('#nudgeForward').onclick=()=>{if(cue)alter({t:seconds(cue.t+1/24)});};
  $('#cueTime').onchange=e=>{
    const t=e.target.valueAsNumber;if(!Number.isFinite(t)){inspector();return;}
    if(cue)alter({t:seconds(t)});else{seek(seconds(t));inspector();}
  };
  $('#cueSound').onchange=e=>alter({s:Number(e.target.value)});$('#cueVariant').onchange=e=>alter({v:Number(e.target.value)});
  for(const [selector,key] of [['#cueGain','db'],['#cuePan','pan']]){
    $(selector).oninput=()=>values(Number($('#cueGain').value),Number($('#cuePan').value));
    $(selector).onchange=e=>alter({[key]:Number(e.target.value)});
  }
  $('#undo').onclick=()=>historyMove(stack,forward);$('#redo').onclick=()=>historyMove(forward,stack);
  $('#copyTake').onclick=()=>{
    if(!takes[selected].length||mode!=='idle'||shared)return;
    const dest=selected==='A'?'B':'A';checkpoint();takes[dest]=clone(takes[selected]);selected=dest;cue=null;seek(0);changed(dest+'에 복사했습니다. 실행 취소로 복사 전 상태를 복원할 수 있습니다.');
  };
  document.addEventListener('keydown',e=>{
    if(e.isComposing||document.querySelector('dialog[open], #ns-library:not([hidden])[aria-modal="true"]')||e.target.closest('input,textarea,select,[contenteditable=true]'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();historyMove(e.shiftKey?forward:stack,e.shiftKey?stack:forward);return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(!e.repeat&&['1','2','3'].includes(e.key)){e.preventDefault();pad(Number(e.key)-1);}
    else if(e.key==='Escape'&&mode!=='idle'){e.preventDefault();stop();}
    else if(mode==='idle'&&!shared&&cue&&e.target.closest('#arrangement')&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();remove();}
    else if(mode==='idle'&&!shared&&cue&&e.target.closest('#arrangement')&&['ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();alter({t:seconds(cue.t+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:1)/24)});
      $('[data-track="'+selected+'"] .cue[aria-pressed="true"]')?.focus();
    }
    else if(e.code==='Space'&&!e.repeat&&!e.target.closest('button,a')){e.preventDefault();if(mode==='idle')run(takes[selected].length?'play':'preview');else stop();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode!=='idle')stop();});
  window.addEventListener('pagehide',()=>{if(mode!=='idle')stop();quiet();});
  async function init(){
    makeLanes();document.querySelectorAll('.cue-lane').forEach(bindLane);
    loading=true;render();await restoreDraft();loading=false;route();
  window.NightLibrary?.register({
    getState:()=>{if(mode==='record')stop();return state();},restore:async(data)=>restore(data),getExample:house,
    getTitle:()=> clip?clip.asset.name.replace(/\.[^.]+$/,''):'복도 끝의 문',
    getPreview:()=>{try{const c=document.createElement('canvas');c.width=256;c.height=132;c.getContext('2d').drawImage(clip?clip.video:$('#film'),0,0,256,132);return c.toDataURL('image/jpeg',.62);}catch{return '';}}
  });
  }
  init();
})();

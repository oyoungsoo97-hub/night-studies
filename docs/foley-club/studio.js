'use strict';
(() => {
  const duration=8, slotKey='night-studies.foley.takes.v1';
  const names=['자갈 발소리','열쇠 꾸러미','문 경첩'];
  const $=selector=>document.querySelector(selector);
  const pads=[...document.querySelectorAll('[data-sound]')];
  const takeButtons=[...document.querySelectorAll('[data-take]')];
  const sound=window.FoleySound,film=window.FoleyFilm;
  let takes={A:[],B:[]}, selected='A', mode='idle', track=null, sequence=[], draft=[], nextEvent=0;
  let start=0, position=0, raf=0, lastFrame=-1, muted=false, variantCounter=0;
  const timeouts=new Set();
  const clean=list=>Array.isArray(list)?list.filter(e=>e&&Number.isFinite(e.t)&&e.t>=0&&e.t<duration&&Number.isInteger(e.s)&&e.s>=0&&e.s<3&&Number.isInteger(e.v)&&e.v>=0&&e.v<3).slice(0,512).sort((a,b)=>a.t-b.t):[];
  try{
    const data=JSON.parse(localStorage.getItem(slotKey));
    if(data&&data.version===1) takes={A:clean(data.A),B:clean(data.B)};
  }catch{}
  const ownTakes=takes;
  let shared=false;
  const message=text=>{$('#status').textContent=text;};
  function store(){
    try{localStorage.setItem(slotKey,JSON.stringify({version:1,A:takes.A,B:takes.B}));return true;}catch{return false;}
  }
  function flash(id,delay=0){
    const timer=setTimeout(()=>{
      timeouts.delete(timer);const pad=pads[id];pad.classList.add('flash');
      const end=setTimeout(()=>{timeouts.delete(end);pad.classList.remove('flash');},115);timeouts.add(end);
    },Math.max(0,delay)*1000);
    timeouts.add(timer);
  }
  function clearAudio(){
    sound.stop();
    for(const id of timeouts)clearTimeout(id);
    timeouts.clear();pads.forEach(pad=>pad.classList.remove('flash'));
  }
  function drawMarks(which){
    const row=$('[data-track="'+which+'"]');
    const events=mode==='record'&&track===which?draft:takes[which];
    const frag=document.createDocumentFragment();
    events.forEach(e=>{
      const mark=document.createElement('i');mark.className='mark s'+e.s;mark.style.left=Math.min(99.65,e.t/duration*100)+'%';frag.append(mark);
    });
    row.querySelector('.marks').replaceChildren(frag);
    row.querySelector('.empty-label').hidden=events.length>0;
    row.querySelector('.take-count').textContent=events.length;
    row.querySelector('.take-count').setAttribute('aria-label',which+' 테이크 효과음 '+events.length+'개');
  }
  function controls(){
    const active=mode!=='idle', recording=mode==='record';
    $('#recordText').textContent=recording?'녹음 마치기':selected+(takes[selected].length?' 다시 녹음':' 녹음');
    $('#record').classList.toggle('is-recording',recording);
    $('#record').disabled=shared||(active&&!recording);
    if(shared) $('#recordText').textContent='공유 테이크';
    $('#returnMine').hidden=!shared;
    $('#playText').textContent=takes[selected].length?selected+' 듣기':'미리 보기';
    $('#play').disabled=active;
    $('#stop').disabled=!active;
    $('#screenPlay').hidden=active;
    $('#screenPlay').setAttribute('aria-label',takes[selected].length?selected+' 테이크 재생':'장면 미리 보기');
    $('#compare').disabled=active||!takes.A.length||!takes.B.length;
    $('#share').disabled=active || !takes.A.length || !takes.B.length;
    $('#compare').textContent=mode==='compare'?track+' 재생 중':'A · B 이어 듣기';
    $('#filmMode').textContent=recording?'REC / TAKE '+track:mode==='compare'||mode==='play'?'PLAY / TAKE '+track:'PREVIEW';
    $('#filmMode').style.color=recording?'#ffd38d':'';
    pads.forEach(p=>{p.disabled=active&&!recording;});
    takeButtons.forEach(b=>{
      b.disabled=active;b.setAttribute('aria-pressed',b.dataset.take===selected?'true':'false');
      const row=b.closest('.track');row.classList.toggle('active-lane',active&&track===b.dataset.take);
    });
    drawMarks('A');drawMarks('B');
  }
  function timeAt(t){
    position=Math.max(0,Math.min(duration,t));
    const f=Math.floor(position*24+.00001);
    if(f!==lastFrame){
      lastFrame=f;film.draw(position);
      $('#timecode').textContent='00:'+String(Math.floor(f/24)).padStart(2,'0')+':'+String(f%24).padStart(2,'0');
    }
    if(track){const cur=$('[data-track="'+track+'"] .cursor');cur.style.left=Math.min(99.8,position/duration*100)+'%';}
  }
  function played(t){
    if(!track||mode==='record')return;
    const events=takes[track];
    while(nextEvent<events.length && events[nextEvent].t<t+.065){
      const e=events[nextEvent++];const delay=Math.max(0,e.t-t);
      sound.hit(e.s,e.v,delay);flash(e.s,delay);
    }
  }
  function finish(automatic=false){
    if(mode==='idle')return;
    const previous=mode, which=track;
    cancelAnimationFrame(raf);clearAudio();
    if(automatic)timeAt(duration);
    if(previous==='record'){
      if(draft.length){takes[which]=draft.slice();const saved=store();
        message(which+' 테이크에 효과음 '+draft.length+'개를 담았습니다.'+(saved?'':' 이 브라우저에서는 이번 세션 동안만 보관됩니다.'));
      }else message('녹음한 소리가 없습니다.'+(takes[which].length?' 기존 테이크를 유지했습니다.':' 패드를 누르면 소리가 담깁니다.'));
    }else if(automatic)message(previous==='compare'?'두 테이크를 모두 들었습니다.':'재생을 마쳤습니다.');
    else message('정지했습니다.');
    mode='idle';draft=[];track=null;sequence=[];controls();
  }
  function frame(now){
    if(mode==='idle')return;
    const t=(now-start)/1000;
    if(t>=duration){
      if(mode==='compare'&&sequence.length){
        clearAudio();track=sequence.shift();nextEvent=0;start+=duration*1000;
        controls();message('같은 장면으로 '+track+' 테이크를 이어 듣습니다.');timeAt(0);played(0);
      }else{finish(true);return;}
    }else{timeAt(t);played(t);}
    raf=requestAnimationFrame(frame);
  }
  function run(nextMode){
    if(mode!=='idle'||(shared&&nextMode==='record'))return;
    if(!sound.unlock()){message('이 브라우저에서 오디오를 시작할 수 없습니다.');return;}
    clearAudio();
    mode=nextMode;sequence=nextMode==='compare'?['B']:[];
    track=nextMode==='compare'?'A':nextMode==='preview'?null:selected;
    nextEvent=0;draft=[];start=performance.now();lastFrame=-1;
    if(mode==='record')message(track+' 녹음 중. 장면에 맞춰 효과음 패드를 누르세요.');
    else if(mode==='compare')message('A 테이크, 이어서 B 테이크를 재생합니다.');
    else message(mode==='preview'?'소리 없이 장면을 미리 봅니다.':track+' 테이크를 재생합니다.');
    controls();timeAt(0);played(0);raf=requestAnimationFrame(frame);
  }
  function trigger(id){
    if(mode!=='idle'&&mode!=='record')return;
    if(!sound.unlock()){message('이 브라우저에서 오디오를 시작할 수 없습니다.');return;}
    const v=variantCounter++%3;
    if(mode==='record'){
      const t=Math.max(0,(performance.now()-start)/1000);
      if(t>=duration){finish(true);return;}
      if(draft.length>=512)return;
      draft.push({t:Math.min(7.999,Math.round(t*1000)/1000),s:id,v});drawMarks(track);
    }else message(names[id]+' 미리 듣기');
    sound.hit(id,v);flash(id);
  }
  pads.forEach((pad,id)=>{
    sound.waveform(pad.querySelector('canvas'),id);
    pad.addEventListener('pointerdown',e=>{if(e.button===0&&!pad.disabled){e.preventDefault();pad.focus({preventScroll:true});trigger(id);}});
    pad.addEventListener('click',e=>{if(e.detail===0)trigger(id);});
  });
  takeButtons.forEach(b=>b.onclick=()=>{
    selected=b.dataset.take;controls();
    message(selected+' 테이크를 선택했습니다.'+(takes[selected].length?' 녹음한 효과음 '+takes[selected].length+'개가 있습니다.':' 녹음할 준비가 됐습니다.'));
  });
  function openFragment(){
    if(mode!=='idle')finish();
    const incoming=window.FoleyShare.decode(location.hash);
    shared=Boolean(incoming);takes=incoming||ownTakes;selected='A';
    $('#shareFallback').hidden=true;
    controls();timeAt(0);
    if(shared)message('공유받은 A·B 테이크입니다. 이어 듣기를 눌러 비교하세요.');
    else if(location.hash.startsWith('#takes='))message('이 비교 링크를 읽을 수 없어 내 테이크를 열었습니다.');
    else if(takes.A.length||takes.B.length)message('이 브라우저에 저장된 내 테이크를 불러왔습니다.');
    else message('A 녹음을 누르면 장면이 처음부터 재생됩니다.');
  }
  $('#returnMine').onclick=()=>{
    try{const u=new URL(location.href);u.hash='';history.replaceState(null,'',u);openFragment();}
    catch{location.hash='';}
  };
  window.addEventListener('hashchange',openFragment);
  $('#share').onclick=async()=>{
    const fragment=window.FoleyShare.encode(takes);
    if(!fragment)return;
    const u=new URL(location.href);u.search='';u.hash=fragment;
    const local=u.protocol==='file:', value=local?fragment:u.href;
    try{
      if(!navigator.clipboard?.writeText)throw Error('Manual copy');
      await navigator.clipboard.writeText(value);$('#shareFallback').hidden=true;
      message(local?'테이크 코드를 복사했습니다. FOLEY CLUB 웹 주소 뒤에 붙여넣어 공유하세요.':'두 테이크의 비교 링크를 복사했습니다.');
    }catch{
      $('#shareFallback').hidden=false;
      const input=$('#shareField'); input.value=value;input.focus();input.select();
      message(local?'선택된 코드를 복사해 FOLEY CLUB 웹 주소 뒤에 붙여넣으세요.':'선택된 비교 링크를 복사하세요.');
    }
  };
  $('#record').onclick=()=>mode==='record'?finish():run('record');
  $('#play').onclick=$('#screenPlay').onclick=()=>run(takes[selected].length?'play':'preview');
  $('#stop').onclick=()=>finish();
  $('#compare').onclick=()=>run('compare');
  $('#mute').onclick=()=>{
    muted=!muted;sound.setMute(muted);
    $('#mute').setAttribute('aria-pressed',String(muted));
    $('#muteText').textContent=muted?'소리 꺼짐':'소리 켜짐';
  };
  document.addEventListener('keydown',e=>{
    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.isComposing)return;
    if(e.target.closest('input,textarea,select,[contenteditable=true]'))return;
    if(['1','2','3'].includes(e.key)){e.preventDefault();trigger(Number(e.key)-1);}
    else if(e.key==='Escape'&&mode!=='idle'){e.preventDefault();finish();}
    else if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();if(mode==='idle')run(takes[selected].length?'play':'preview');else finish();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode!=='idle')finish();});
  window.addEventListener('pagehide',()=>{if(mode!=='idle')finish();clearAudio();});
  openFragment();
})();

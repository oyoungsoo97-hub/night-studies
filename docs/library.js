/* Shared project shelf. The catalog stays small even when projects contain photographs. */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  const studios = {
    'last-train': {name:'막차', medium:'포스터', cover:'platform-cover.webp'},
    'foley-club': {name:'폴리 클럽', medium:'사운드', cover:'hallway-cover.webp'},
    'light-table': {name:'라이트 테이블', medium:'사진', cover:'diner-cover.webp'}
  };
  const studio = Object.keys(studios).find(key => location.pathname.startsWith(new URL(key+'/', base).pathname));
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('library.css', base);
  document.head.append(stylesheet);
  const bytesLimit = 24 * 1024 * 1024;
  let connection, adapter, opening = false, current = null, busy = false, view = '', filter = '', invoker, listVersion = 0;
  let tabChannel;
  try { tabChannel = new BroadcastChannel('night-studies-project-shelf-v1'); } catch {}
  const $ = selector => document.querySelector(selector);
  const clipTitle = value => typeof value === 'string' ? value.trim().slice(0,80) : '';
  const safePreview = value => typeof value === 'string' && value.length < 800000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
  const projectURL = row => {
    const url = new URL(row.studio+'/',base);
    url.searchParams.set('project',row.id);
    return url;
  };
  function database() {
    if (!connection) {
      connection = new Promise((resolve,reject) => {
        const request = indexedDB.open('night-studies-project-library',1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('catalog',{keyPath:'id'});
          db.createObjectStore('states');
        };
        request.onblocked = () => reject(new Error('다른 탭의 Night Studies를 닫고 다시 시도해 주세요.'));
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); connection = null; };
          resolve(db);
        };
      }).catch(error => { connection = null; throw error; });
    }
    return connection;
  }
  async function read(store, key) {
    const db = await database();
    return new Promise((resolve,reject) => {
      const items = db.transaction(store).objectStore(store);
      const request = key === undefined ? items.getAll() : items.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function fetchProject(id) {
    const db = await database();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(['catalog','states']);
      const info = tx.objectStore('catalog').get(id);
      const data = tx.objectStore('states').get(id);
      tx.oncomplete = () => resolve(info.result && data.result ? {row:info.result, state:data.result} : null);
      tx.onabort = () => reject(tx.error);
    });
  }
  // Compare the revision inside the write transaction to avoid losing another tab's changes.
  async function mutate(row, state, expectedRevision, remove = false) {
    const db = await database();
    await new Promise((resolve,reject) => {
      const tx = db.transaction(['catalog','states'], 'readwrite');
      const catalog = tx.objectStore('catalog'), states = tx.objectStore('states');
      const request = catalog.get(row.id);
      let conflict = false;
      request.onsuccess = () => {
        if ((request.result?.revision || 0) !== expectedRevision) {
          conflict = true; tx.abort(); return;
        }
        if (remove) {catalog.delete(row.id);states.delete(row.id);}
        else {catalog.put(row); states.put(state,row.id);}
      };
      tx.oncomplete = resolve;
      tx.onabort = () => reject(conflict ? new Error('다른 탭에서 이 프로젝트가 변경됐습니다. 사본으로 저장하거나 보관함에서 다시 열어 주세요.') : tx.error);
    });
    announceChange();
  }
  function announceChange() {
    window.dispatchEvent(new Event('night-library-change'));
    tabChannel?.postMessage('updated');
  }
  if (tabChannel) tabChannel.onmessage = () => {
    window.dispatchEvent(new Event('night-library-change'));
    if (view === 'list' && dialog?.open) renderList();
  };
  const list = async () => (await read('catalog')).sort((a,b)=>b.updated-a.updated);
  const date = ts => new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(ts);
  const el = (name, className, content) => {
    const node = document.createElement(name);
    if (className) node.className=className;
    if (content !== undefined) node.textContent=content;
    return node;
  };
  function action(label, onClick, className) {
    const button = el('button',className,label); button.type='button';
    button.addEventListener('click',onClick);
    return button;
  }
  let dialog, heading, body, notice, fileInput, toast, timer;
  function ensureDialog() {
    if (dialog) return;
    dialog=el('dialog','ns-sheet');dialog.id='ns-library';dialog.setAttribute('aria-labelledby','ns-heading');
    const top=el('div','ns-top');top.append(el('span','ns-brand','Night Studies'),action('닫기',()=>{if(!busy)dialog.close();},'ns-quiet'));
    heading=el('h2');heading.id='ns-heading';
    notice=el('p','ns-message');notice.setAttribute('role','status');
    body=el('div','ns-body');
    fileInput=el('input');fileInput.type='file';fileInput.accept='.nightstudy,.json,application/json';fileInput.hidden=true;
    fileInput.addEventListener('change',()=>{const file=fileInput.files[0];fileInput.value='';if(file) importFile(file);});
    dialog.append(top,heading,notice,body,fileInput);
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{view='';invoker?.focus?.({preventScroll:true});});
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    dialog.addEventListener('click',event=>{if(event.target===dialog && !busy) {
      const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
    }});
    toast=el('div','ns-toast');toast.setAttribute('role','status');document.body.append(toast);
  }
  function flash(message) {
    ensureDialog();
    toast.textContent=message;toast.classList.add('ns-visible');
    clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('ns-visible'),3800);
  }
  function humanError(error) {
    if (error?.name==='QuotaExceededError') return '브라우저 저장 공간이 부족합니다. 보관함에서 프로젝트 파일을 내려받아 백업하고 공간을 확보해 주세요.';
    if (['SecurityError','InvalidStateError','UnknownError'].includes(error?.name)) return '이 브라우저에서는 보관함에 접근할 수 없습니다. 브라우저의 사이트 데이터 설정을 확인해 주세요.';
    return error?.message || '처리하지 못했습니다. 다시 시도해 주세요.';
  }
  function showError(error) {notice.textContent=humanError(error);notice.classList.add('ns-error');}
  function show(title, mode) {
    ensureDialog();
    if(!dialog.open) {invoker=document.activeElement;dialog.showModal();}
    view=mode; heading.textContent=title;body.replaceChildren();notice.textContent='';notice.classList.remove('ns-error');
    ++listVersion;
  }
  function newRow(kind,name,preview) {
    const time=Date.now();
    return {id:crypto.randomUUID(),studio:kind,name:clipTitle(name)||studios[kind].name,preview:safePreview(preview),created:time,updated:time,revision:1};
  }
  function setCurrent(row) {
    current=row;
    const url=new URL(location.href);url.searchParams.delete('edition');url.searchParams.set('project',row.id);url.hash='';
    history.replaceState(history.state,'',url);
  }
  function pack(row,state) {
    const blob=new Blob([JSON.stringify({format:'night-studies/project',version:1,studio:row.studio,name:row.name,preview:row.preview,state})],{type:'application/json'});
    if (blob.size>bytesLimit) throw new Error('프로젝트 파일은 24 MB까지 저장할 수 있습니다.');
    return blob;
  }
  function download(row, data) {
    const a=el('a'), url=URL.createObjectURL(pack(row,data));
    a.href=url;a.download=(row.name.replace(/[^\p{L}\p{N} _.-]/gu,'').trim()||'Night Studies')+'.nightstudy';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function importFile(file) {
    if (busy) return; busy=true;
    try {
      if (file.size>bytesLimit) throw new Error('24 MB 이하의 프로젝트 파일을 선택해 주세요.');
      let item;
      try {item=JSON.parse(await file.text());} catch {throw new Error('프로젝트 파일을 읽지 못했습니다. Night Studies에서 내보낸 파일을 선택해 주세요.');}
      if(item?.format!=='night-studies/project'||item.version!==1||!Object.hasOwn(studios,item.studio)||!item.state||typeof item.state!=='object'||Array.isArray(item.state)||!clipTitle(item.name)) throw new Error('지원하지 않는 프로젝트 파일입니다.');
      const row=newRow(item.studio,item.name,item.preview);
      await mutate(row,item.state,0);filter='';await renderList();notice.textContent='프로젝트를 가져왔습니다. 제목을 누르면 편집실에서 열립니다.';
    } catch(error) {showError(error);} finally {busy=false;}
  }
  function saveForm() {
    if(busy) return;
    if(!adapter || opening){flash('편집실을 여는 중입니다. 잠시 후 저장해 주세요.');return;}
    show('프로젝트 저장','save');
    const form=el('form','ns-form');
    const label=el('label','','프로젝트 이름'),input=el('input');input.id='ns-project-name';input.required=true;input.maxLength=80;input.autocomplete='off';
    label.htmlFor=input.id; input.value=current?.name||clipTitle(adapter.getTitle?.())||studios[studio].name;
    const note=el('p','ns-note','이 브라우저의 작업 보관함에 저장됩니다. 프로젝트 파일을 내려받으면 다른 기기에서도 이어서 편집할 수 있습니다.');
    const buttons=el('div','ns-actions');const submit=el('button','ns-primary',current?'변경사항 저장':'보관함에 저장');submit.type='submit';buttons.append(submit);
    if(current)buttons.append(action('사본으로 저장',()=>save(true),'ns-button'));
    const backup=action('파일로 내보내기',()=>save(false,true),'ns-button');buttons.append(backup);
    form.append(label,input,note,buttons);body.append(form);input.focus();input.select();
    form.addEventListener('submit',event=>{event.preventDefault();save(false);});
    async function save(copy,fileOnly=false) {
      if (busy) return;
      const name=clipTitle(input.value);if(!name){input.focus();showError(new Error('프로젝트 이름을 입력해 주세요.'));return;}
      busy=true;for(const b of buttons.children)b.disabled=true;
      try {
        const state=await adapter.getState();
        if (!state || typeof state!=='object') throw new Error('편집실이 준비된 후 다시 저장해 주세요.');
        const preview=safePreview(await adapter.getPreview?.());
        const row=(!current||copy) ? newRow(studio,name,preview) : {...current,name,preview,updated:Date.now(),revision:current.revision+1};
        if(fileOnly){download(row,state);dialog.close();flash('프로젝트 파일을 내보냈습니다.');return;}
        pack(row,state);
        await mutate(row,state,row.revision-1);
        setCurrent(row);dialog.close();flash('작업 보관함에 저장했습니다.');
      } catch(error){showError(error);} finally{busy=false;for(const b of buttons.children)b.disabled=false;}
    }
  }
  function renderRow(row) {
    const article=el('article','ns-row'),line=el('div','ns-row-main');
    const anchor=el('a','ns-project');anchor.href=projectURL(row);anchor.dataset.projectLink=row.id;
    const img=el('img','ns-thumb');img.alt='';img.width=88;img.height=66;img.src=safePreview(row.preview)||new URL('assets/'+studios[row.studio].cover,base);
    const info=el('span','ns-project-info');
    info.append(el('small','ns-type',studios[row.studio].name),el('strong','',row.name),el('small','ns-date',date(row.updated)));
    anchor.append(img,info);line.append(anchor);
    const more=action('관리',()=>{manage.hidden=!manage.hidden;more.setAttribute('aria-expanded',String(!manage.hidden));},'ns-quiet');
    more.setAttribute('aria-label',row.name+' 관리');more.setAttribute('aria-expanded','false');
    const manage=el('div','ns-manage');manage.hidden=true;
    const backup=action('파일 내보내기',async()=>{try{const record=await fetchProject(row.id);if(!record)throw new Error('이 프로젝트가 삭제되었습니다.');download(record.row,record.state);}catch(error){showError(error);}},'ns-button');
    const del=action('삭제',()=>{
      const ask=el('div','ns-confirm');ask.append(el('p','','이 브라우저의 보관함에서 삭제할까요?'));
      ask.append(action('취소',()=>{ask.remove();del.disabled=false;},'ns-button'),action('삭제하기',async()=>{
        if (busy) return; busy=true;
        try{await mutate(row,null,row.revision,true);if(current?.id===row.id){current=null;const url=new URL(location.href);url.searchParams.delete('project');history.replaceState(history.state,'',url);}await renderList();notice.textContent='프로젝트를 삭제했습니다.';}catch(error){showError(error);}finally{busy=false;}
      },'ns-danger'));del.disabled=true;manage.append(ask);ask.querySelector('button').focus();
    },'ns-quiet');
    manage.append(backup,del);line.append(more);article.append(line,manage);return article;
  }
  async function renderList() {
    show('작업 보관함','list');
    const turn=listVersion;
    const bar=el('div','ns-tools');
    const select=el('select');select.setAttribute('aria-label','편집실 필터');
    for(const [key,name] of [['','모든 편집실'],...Object.entries(studios).map(([k,v])=>[k,v.name])]) {const o=el('option','',name);o.value=key;select.append(o);}
    select.value=filter;select.onchange=async()=>{filter=select.value;await renderList();if(dialog.open && view==='list')body.querySelector('select')?.focus();};
    bar.append(select,action('파일 가져오기',()=>fileInput.click(),'ns-button'));body.append(bar);
    try {
      const all=await list();
      if(turn!==listVersion||!dialog.open)return;
      const rows=filter?all.filter(r=>r.studio===filter):all;
      if(!rows.length)body.append(el('p','ns-empty',all.length?'이 편집실에 저장한 프로젝트가 없습니다.':'아직 저장한 작업이 없습니다. 편집실에서 프로젝트를 저장하거나 기존 프로젝트 파일을 가져오세요.'));
      else {const stack=el('div','ns-stack');for(const row of rows)stack.append(renderRow(row));body.append(stack);}
      body.append(el('p','ns-foot','이 브라우저에 저장됩니다. 다른 기기로 옮길 때는 파일로 내보내세요.'));
    }catch(error){if(turn===listVersion)showError(error);}
  }
  async function register(next) {
    adapter=next; opening=true;
    const params=new URLSearchParams(location.search), id=params.get('project');
    try {
      if (id) {
        const record=await fetchProject(id);
        if (!record || record.row.studio!==studio) throw new Error('이 브라우저에서 해당 프로젝트를 찾을 수 없습니다. 다른 기기에 저장했다면 프로젝트 파일을 가져와 주세요.');
        await adapter.restore(record.state);current=record.row;
      } else if(params.get('edition')==='house' && adapter.getExample) {
        await adapter.restore(await adapter.getExample());
      }
      opening=false;window.dispatchEvent(new Event('night-studio-ready'));
    } catch(error) {opening=false;await renderList();showError(error);window.dispatchEvent(new Event('night-studio-error'));}
  }
  document.addEventListener('click', event=>{
    if(event.target.closest('[data-library]')){filter='';renderList();}
    else if(event.target.closest('[data-save-project]'))saveForm();
  });
  document.addEventListener('keydown',event=>{
    if(adapter && (event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='s'){event.preventDefault();if(!dialog?.open)saveForm();}
  });
  window.NightLibrary={register,list,projectURL,date,studios,open:renderList};
})();

"use strict";
(() => {
  const $ = id => document.getElementById(id);
  let image = $("sourcePhoto");
  const stage = $("stage");
  const overlay = $("overlay");
  const detail = $("detail");
  const frames = $("frames");
  const proof = $("proofDialog");
  const storeKey = "night-studies/light-table/v1";
  const frameRatio = 4 / 3;
  const houseId = "diner";
  const houseTitle = "비 오는 밤의 식당";
  const defaultFocus = (source = houseId) => ({source, x: source === houseId ? .435 : .5, y: source === houseId ? .665 : .5, zoom: source === houseId ? 3 : 1.5, caption:""});
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const papers = {
    ivory: {background:"#f2f0e8", ink:"#242520", muted:"#626458", accent:"#bf4a26"},
    white: {background:"#ffffff", ink:"#172327", muted:"#46595a", accent:"#285c68"},
    carbon: {background:"#202224", ink:"#f6f0df", muted:"#c2c4ba", accent:"#ff8b50"}
  };
  const layouts = {strip:[2400,1060],column:[1200,3200],cover:[1500,2020]};
  let sources = new Map();
  let activeId = houseId;
  let focus = defaultFocus();
  let selection = [];
  let editIndex = null;
  let loaded = false;
  let pointer = null;
  let pendingDraw = 0;
  let standaloneDraft = true;
  let writePending = false;
  let sourceBusy = false;
  let housePhoto;
  let draftDb;

  function validFocus(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) &&
      Number.isFinite(value.zoom) && value.zoom >= 1 && value.zoom <= 7 &&
      value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1;
  }

  function trimField(value, max) {
    return typeof value === "string" ? value.slice(0,max) : "";
  }

  function state() {
    return {
      version:2, title:$("storyTitle").value, layout:$("layout").value, paper:$("paper").value, format:$("format").value,
      active:activeId, editIndex, focus:{...focus,caption:$("caption").value}, cuts:selection.map(cut=>({...cut})),
      sources:[...sources.values()].filter(src=>src.id!==houseId).map(({id,name,data})=>({id,name,data}))
    };
  }

  function database() {
    if (!draftDb) draftDb = new Promise((resolve,reject)=>{
      const request = indexedDB.open("night-studies-light-table",1);
      request.onupgradeneeded=()=>request.result.createObjectStore("workspace");
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    return draftDb;
  }

  async function readDraft() {
    try {
      const db=await database();
      const draft=await new Promise((resolve,reject)=>{
        const req=db.transaction("workspace").objectStore("workspace").get("draft");
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      if(draft) return draft;
    } catch { /* The original local-storage draft can still be restored. */ }
    try {return JSON.parse(localStorage.getItem(storeKey));} catch {return null;}
  }

  function persist() {
    if (!standaloneDraft || new URLSearchParams(location.search).has("project") || !loaded || writePending) return;
    writePending=true;
    queueMicrotask(async()=>{
      writePending=false;
      if (!standaloneDraft) return;
      const snapshot=state();
      if(!snapshot.sources.length){
        try {localStorage.setItem(storeKey,JSON.stringify({cuts:snapshot.cuts,title:snapshot.title}));} catch {}
      }
      try {
        const db=await database();
        const tx=db.transaction("workspace","readwrite");
        tx.objectStore("workspace").put(snapshot,"draft");
        tx.onabort=()=>setSourceStatus("자동 저장 공간이 부족합니다. 보관함에서 작업 파일을 내보내세요.");
      } catch {setSourceStatus("기기 자동 저장을 사용할 수 없습니다. 보관함에서 작업 파일을 내보내세요.");}
    });
  }

  function setSourceStatus(text){$("sourceStatus").textContent=text;}
  function photoFor(cut){return sources.get(cut.source || houseId).img;}

  function cropRect(cut) {
    const photo=photoFor(cut), iw=photo.naturalWidth, ih=photo.naturalHeight;
    const w = Math.min(iw, ih * frameRatio) / cut.zoom, h = w / frameRatio;
    return { x: clamp(cut.x * iw - w / 2, 0, iw - w), y: clamp(cut.y * ih - h / 2, 0, ih - h), w, h };
  }

  function constrainFocus() {
    const r=cropRect(focus),photo=photoFor(focus);
    focus.x=(r.x+r.w/2)/photo.naturalWidth;focus.y=(r.y+r.h/2)/photo.naturalHeight;
  }

  function renderCrop(ctx, cut, x, y, w, h) {
    const r=cropRect(cut);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(photoFor(cut),r.x,r.y,r.w,r.h,x,y,w,h);
  }

  function prepareCanvas(canvas) {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(width / Math.max(1, bounds.width), 0, 0, height / Math.max(1, bounds.height), 0, 0);
    return {ctx, width: bounds.width, height: bounds.height};
  }

  function drawCorner(ctx, x, y, dx, dy, length) {
    ctx.beginPath();
    ctx.moveTo(x + dx * length, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * length);
    ctx.stroke();
  }

  function drawLens(ctx, centerX, centerY, width, height) {
    const radius = clamp(width * 0.081, 34, 76);
    const offset = centerX < width / 2 ? 1 : -1;
    const lx = clamp(centerX + offset * (radius + 16), radius + 3, width - radius - 3);
    const ly = clamp(centerY - radius * 0.48, radius + 3, height - radius - 3);
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx, ly, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#161713";
    ctx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2);
    const opticalZoom = 2.25;
    ctx.drawImage(image, lx - centerX * opticalZoom, ly - centerY * opticalZoom, width * opticalZoom, height * opticalZoom);
    ctx.strokeStyle = "rgba(255,255,240,.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx - 7, ly); ctx.lineTo(lx + 7, ly);
    ctx.moveTo(lx, ly - 7); ctx.lineTo(lx, ly + 7);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI * 2);
    ctx.lineWidth = 5; ctx.strokeStyle = "#252724"; ctx.stroke();
    ctx.beginPath(); ctx.arc(lx, ly, radius + 3, 0, Math.PI * 2);
    ctx.lineWidth = 1; ctx.strokeStyle = "#e8e6d9"; ctx.stroke();
  }

  function draw() {
    pendingDraw = 0;
    if (!loaded) return;
    const {ctx, width, height} = prepareCanvas(overlay);
    if (width <= 0 || height <= 0) return;
    ctx.clearRect(0, 0, width, height);
    const rect = cropRect(focus);
    const x = rect.x / image.naturalWidth * width, y = rect.y / image.naturalHeight * height;
    const w = rect.w / image.naturalWidth * width, h = rect.h / image.naturalHeight * height;
    ctx.fillStyle = "rgba(16,18,14,.22)";
    ctx.fillRect(0, 0, width, height);
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,239,205,.8)";
    ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 3; ctx.strokeStyle = "#ff7848";
    const tick = Math.min(12, w / 5, h / 5);
    drawCorner(ctx, x, y, 1, 1, tick);
    drawCorner(ctx, x + w, y, -1, 1, tick);
    drawCorner(ctx, x, y + h, 1, -1, tick);
    drawCorner(ctx, x + w, y + h, -1, -1, tick);
    const cx = x + w / 2, cy = y + h / 2;
    ctx.beginPath(); ctx.lineWidth = 1;ctx.strokeStyle = "#fff3df";
    ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);ctx.moveTo(cx, cy - 5);ctx.lineTo(cx, cy + 5);ctx.stroke();
    if (pointer !== null) drawLens(ctx, cx, cy, width, height);
    const preview = prepareCanvas(detail);
    renderCrop(preview.ctx, focus, 0, 0, preview.width, preview.height);
  }

  function scheduleDraw() {
    if (!pendingDraw) pendingDraw = requestAnimationFrame(draw);
  }

  function updatePreview() {
    $("zoom").value = String(focus.zoom);
    $("zoomValue").value = focus.zoom.toFixed(1) + "×";
    $("zoom").setAttribute("aria-valuetext", focus.zoom.toFixed(1) + "배");
    scheduleDraw();
  }

  function renderFrames() {
    frames.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const item = selection[i];
      const card = document.createElement("button");
      card.type = "button";card.className = "frame" + (item ? "" : " empty");
      card.dataset.index = String(i);
      card.disabled = !item || !loaded;
      card.setAttribute("aria-label", item ? (i + 1) + "번째 컷 위치와 순서 편집" : (i + 1) + "번째 컷 비어 있음");
      card.setAttribute("aria-pressed", String(editIndex === i));
      if (item && loaded) {
        const thumb = document.createElement("canvas");
        thumb.width = 320; thumb.height = 240;thumb.setAttribute("aria-hidden", "true");
        renderCrop(thumb.getContext("2d"), item, 0, 0, thumb.width, thumb.height);
        card.append(thumb);
        card.addEventListener("click", () => selectFrame(i));
      } else {
        const blank = document.createElement("span");blank.className = "blank";blank.setAttribute("aria-hidden", "true");blank.textContent = "+";
        card.append(blank);
      }
      const meta = document.createElement("span");meta.className = "meta";
      const index = document.createElement("b");index.textContent = String(i + 1).padStart(2, "0");
      const note = document.createElement("span");note.textContent = item ? (item.caption || sources.get(item.source).name) : "빈 컷";
      meta.append(index, note);card.append(meta); frames.append(card);
    }
    $("count").textContent = selection.length + " / 3";
    $("proof").disabled = !loaded || selection.length !== 3;
    $("capture").disabled = !loaded;
    $("zoom").disabled = !loaded;
    $("capture").textContent = editIndex !== null ? "이 컷 교체" : ["첫 컷 담기", "두 번째 컷 담기", "마지막 컷 담기", "세 컷 인화하기"][selection.length];
    $("cancelEdit").hidden = editIndex === null;
    $("frameTools").hidden = editIndex === null;
    if (editIndex !== null) {
      $("selectedLabel").textContent = (editIndex + 1) + "번째 컷";
      $("earlier").disabled = editIndex === 0;
      $("later").disabled = editIndex === selection.length - 1;
    }
  }

  function announce(message) { $("notice").textContent = message; }

  function selectFrame(index) {
    editIndex = index;
    showSource(selection[index].source);
    focus = {...selection[index]};
    $("caption").value = focus.caption;
    updatePreview();renderFrames();persist();
    announce("사진 위에서 위치를 바꾼 뒤 이 컷을 교체하거나, 아래에서 순서를 조정하세요.");
    $("stage").focus({preventScroll: true});
  }

  function reorder(offset) {
    if (editIndex === null) return;
    const target = editIndex + offset;
    if (target < 0 || target >= selection.length) return;
    [selection[editIndex], selection[target]] = [selection[target], selection[editIndex]];
    editIndex = target;
    persist();renderFrames();
    announce("선택한 컷이 " + (target + 1) + "번째로 이동했습니다.");
    const nextButton = $(offset === -1 ? "earlier" : "later");
    if (nextButton.disabled) {
      frames.querySelector('[data-index="' + target + '"]').focus({preventScroll:true});
    }
  }

  function capture() {
    if (!loaded) return;
    if (editIndex === null && selection.length === 3) {openProof();return;}
    const proposed = cropRect(focus);
    const duplicate = selection.some((cut, i) => {
      if (i === editIndex || cut.source !== activeId) return false;
      const r = cropRect(cut);
      return Math.abs(r.x - proposed.x) < proposed.w * .012 &&
        Math.abs(r.y - proposed.y) < proposed.h * .012 && Math.abs(r.w - proposed.w) < proposed.w * .012;
    });
    if (duplicate) {announce("이미 담은 장면이에요. 위치나 배율을 바꿔 다른 컷을 골라주세요.");return;}
    focus.caption = $("caption").value.trim().slice(0,40);
    const replacing = editIndex !== null;
    if (replacing) selection[editIndex] = {...focus};else selection.push({...focus});
    editIndex = null;$("caption").value="";focus.caption="";persist();renderFrames();
    announce(replacing ? "컷을 교체했습니다." : selection.length === 3 ?
      "세 컷을 모두 골랐습니다. 인화지에서 이야기를 확인하세요." : "컷을 담았습니다. 다음 장면을 찾아보세요.");
  }

  function setFromPointer(event) {
    const b = stage.getBoundingClientRect();
    focus.x = (event.clientX - b.left) / b.width;focus.y = (event.clientY - b.top) / b.height;
    constrainFocus();announce("");scheduleDraw();
  }

  stage.addEventListener("pointerdown", event => {
    if (!loaded || pointer !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointer = event.pointerId;
    stage.focus({preventScroll: true});
    stage.setPointerCapture(pointer);
    setFromPointer(event);
  });
  stage.addEventListener("pointermove", event => { if (event.pointerId === pointer) setFromPointer(event); });
  const finishPointer = event => {
    if (event.pointerId !== pointer) return;
    pointer = null;scheduleDraw();persist();
  };
  stage.addEventListener("pointerup", finishPointer);stage.addEventListener("pointercancel", finishPointer);
  stage.addEventListener("lostpointercapture", finishPointer);
  stage.addEventListener("keydown", e => {
    if (!loaded || document.querySelector("dialog[open]")) return;
    if (e.key === "Enter" || e.key === " ") {e.preventDefault();if(!e.repeat)capture();return;}
    const direction = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if (!direction) return;
    e.preventDefault(); const step = e.shiftKey ? .04 : .008;
    focus.x += step * direction[0];focus.y += step * direction[1];
    constrainFocus();announce("");scheduleDraw();persist();
  });
  $("zoom").addEventListener("input", e => {
    if (!loaded) return; focus.zoom = Number(e.target.value);constrainFocus();announce("");updatePreview();persist();
  });
  $("capture").addEventListener("click",capture);
  $("cancelEdit").addEventListener("click", () => {
    editIndex = null;$("caption").value="";focus.caption="";renderFrames();persist();announce("원래 컷을 유지했습니다.");$("capture").focus({preventScroll:true});
  });
  $("earlier").addEventListener("click",()=>reorder(-1));$("later").addEventListener("click",()=>reorder(1));
  $("remove").addEventListener("click",()=>{
    if (editIndex === null) return;
    selection.splice(editIndex,1);editIndex=null;persist();renderFrames();
    announce("컷을 뺐습니다. 다른 장면을 담을 수 있습니다.");$("capture").focus({preventScroll:true});
  });

  function fitText(ctx,text,maxWidth,start,min,weight,font) {
    let size=start;
    do {
      ctx.font=weight+" "+size+"px "+font;
      if(ctx.measureText(text).width<=maxWidth)break;
      size-=2;
    } while(size>=min);
  }

  function printFrames(layout) {
    if(layout==="cover") return [[76,162,1348],[76,1270,662],[762,1270,662]];
    if(layout==="column") return [[96,210,1008],[96,1170,1008],[96,2130,1008]];
    return [[88,170,724],[838,170,724],[1588,170,724]];
  }

  function renderPrint() {
    if (!loaded || selection.length!==3) return;
    const canvas=$("proofCanvas"),layout=$("layout").value,paper=papers[$("paper").value];
    const [w,h]=layouts[layout];
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const ctx=canvas.getContext("2d"),boxes=printFrames(layout),edge=boxes[0][0],compact=layout!=="strip";
    const mono='"SFMono-Regular","Courier New",monospace';
    const sans='"Helvetica Neue",Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    ctx.fillStyle=paper.background;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=paper.ink;ctx.font='500 '+(compact?24:30)+'px '+mono;
    ctx.textAlign="left";ctx.fillText("NIGHT STUDIES  /  LIGHT TABLE",edge,compact?80:92);
    ctx.textAlign="right";ctx.fillText("CONTACT PRINT  /  3",w-edge,compact?80:92);
    ctx.fillRect(edge,compact?108:121,w-edge*2,3);
    selection.forEach((cut,i)=>{
      const [x,y,width]=boxes[i],height=width/frameRatio;
      renderCrop(ctx,cut,x,y,width,height);
      ctx.fillStyle=paper.muted;ctx.font="500 23px "+mono;ctx.textAlign="left";
      const baseline=y+height+43;
      ctx.fillText(String(i+1).padStart(2,"0"),x,baseline);
      const label=cut.caption || sources.get(cut.source).name;
      ctx.fillStyle=paper.ink;
      fitText(ctx,label,width-150,27,17,"500",sans);
      ctx.fillText(label,x+48,baseline,width-145);
      ctx.textAlign="right";ctx.font="500 22px "+mono;ctx.fillStyle=paper.muted;
      ctx.fillText(cut.zoom.toFixed(1)+"×",x+width,baseline);
    });
    const title=$("storyTitle").value.trim()||"무제";
    ctx.textAlign="left";ctx.fillStyle=paper.ink;
    fitText(ctx,title,w-edge*2,layout==="strip"?88:80,26,"600",sans);
    ctx.fillText(title,edge,h-78,w-edge*2);
    ctx.fillStyle=paper.accent;ctx.fillRect(edge,h-45,92,5);
    $("dimensions").textContent=w+" × "+h+" px";
    $("download").textContent=($("format").value==="jpeg"?"JPEG":"PNG")+" 인화 저장";
  }

  function openProof() {
    if (!loaded || selection.length!==3 || proof.open) return;
    renderPrint();$("printStatus").textContent="";proof.showModal();
  }
  $("proof").addEventListener("click",openProof);
  $("closeProof").addEventListener("click",()=>proof.close());
  proof.addEventListener("click",e=>{
    if(e.target!==proof)return;
    const r=proof.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) proof.close();
  });
  for(const id of ["storyTitle","layout","paper","format"]) {
    $(id).addEventListener(id==="storyTitle"?"input":"change",()=>{persist();renderPrint();$("printStatus").textContent="";});
  }
  $("caption").addEventListener("input",persist);
  $("download").addEventListener("click",()=>{
    const button=$("download"),canvas=$("proofCanvas");
    const format=$("format").value;
    button.disabled=true;
    const fail=()=>{$("printStatus").textContent="저장할 수 없습니다. 로컬 HTTP 서버 또는 HTTPS 링크에서 다시 열어주세요.";button.disabled=false;};
    try {
      canvas.toBlob(blob=>{
        if(!blob){fail();return;}
        const link=document.createElement("a"),url=URL.createObjectURL(blob);
        const title=$("storyTitle").value.trim().replace(/[^\p{L}\p{N}_ -]/gu,"").slice(0,45).trim();
        link.download=(title || "Light Table")+" — Light Table."+(format==="jpeg"?"jpg":"png");link.href=url;
        document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        button.disabled=false;$("printStatus").textContent=canvas.width+" × "+canvas.height+" "+format.toUpperCase()+" 파일을 만들었습니다.";
      },"image/"+format,.94);
    } catch {fail();}
  });

  function showSource(id) {
    const asset=sources.get(id);
    if(!asset)throw Error("사진 원판을 찾을 수 없습니다.");
    activeId=id;
    if(image!==asset.img){image.replaceWith(asset.img);image.removeAttribute("id");image=asset.img;}
    image.id="sourcePhoto";image.alt=asset.name;image.draggable=false;
    loaded=true;pointer=null;
    const ratio=image.naturalWidth/image.naturalHeight;
    stage.style.aspectRatio=String(ratio);
    stage.style.setProperty("--stage-max",Math.round(ratio*720)+"px");
    stage.style.setProperty("--stage-vh",(ratio*66).toFixed(2)+"vh");
    $("sourceName").textContent=asset.name;$("loadError").hidden=true;
    $("resolution").textContent=image.naturalWidth+" × "+image.naturalHeight;
    renderSources();
  }

  function chooseSource(id) {
    const caption=editIndex===null?"":$("caption").value;
    showSource(id);focus={...defaultFocus(id),caption};$("caption").value=caption;
    constrainFocus();updatePreview();renderFrames();persist();
    announce(editIndex===null?"":"새 원판에서 구도를 고른 뒤 이 컷을 교체하세요.");
  }

  function renderSources() {
    const bin=$("sources");bin.replaceChildren();
    for(const asset of sources.values()){
      const button=document.createElement("button");button.type="button";button.className="source-chip";button.dataset.id=asset.id;
      button.setAttribute("aria-pressed",String(activeId===asset.id));button.setAttribute("aria-label",asset.name+" 원판 선택");button.title=asset.name;
      const thumb=document.createElement("img");thumb.src=asset.img.src;thumb.alt="";thumb.draggable=false;
      const title=document.createElement("span");title.textContent=asset.name;
      button.append(thumb,title);button.addEventListener("click",()=>chooseSource(asset.id));bin.append(button);
    }
    $("sourceCount").textContent=sources.size+" / 6";
    $("discardSource").hidden=activeId===houseId;
  }

  function readDimensions(bytes) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(bytes.length<24)throw Error("사진 파일을 읽을 수 없습니다.");
    if(bytes[0]===137 && view.getUint32(1)===0x504e470d){
      return [view.getUint32(16),view.getUint32(20)];
    }
    if(bytes[0]===0xff && bytes[1]===0xd8) {
      let pos=2;
      while(pos+9<=bytes.length) {
        if(bytes[pos++]!==0xff)break;
        while(bytes[pos]===0xff)pos++;
        const code=bytes[pos++];
        if(code===0xd9||code===0xda)break;
        const length=view.getUint16(pos);
        if(length<2||pos+length>bytes.length)break;
        if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(code)){
          return [view.getUint16(pos+5),view.getUint16(pos+3)];
        }
        pos+=length;
      }
    }
    if(bytes.length>=30 && view.getUint32(0)===0x52494646 && view.getUint32(8)===0x57454250) {
      const tag=view.getUint32(12);
      if(tag===0x56503858) {const n=i=>1+bytes[i]+256*bytes[i+1]+65536*bytes[i+2];return[n(24),n(27)];}
      if(tag===0x56503820) return[view.getUint16(26,true)&16383,view.getUint16(28,true)&16383];
      if(tag===0x5650384c) {const n=view.getUint32(21,true);return[(n&16383)+1,((n>>>14)&16383)+1];}
    }
    throw Error("JPG, PNG, WebP 사진을 선택하세요.");
  }

  function checkPixels(bytes,maxEdge) {
    const [width,height]=readDimensions(bytes);
    if(!width||!height||width*height>60000000||width>maxEdge||height>maxEdge)throw Error("사진 크기가 너무 큽니다. 작은 사본을 선택하세요.");
  }

  async function decode(url) {
    const img=new Image();img.src=url;
    try {await img.decode();} catch {throw Error("사진을 해석할 수 없습니다. JPG, PNG, WebP 파일을 확인하세요.");}
    return img;
  }

  async function importAsset(file) {
    if(!file.size||file.size>20*1024*1024)throw Error("파일 한 장은 20 MB 이내여야 합니다.");
    const bytes=new Uint8Array(await file.arrayBuffer());
    checkPixels(bytes,65535);
    const url=URL.createObjectURL(file);
    let data;
    try {
      // Native image decoding applies EXIF orientation before the canvas copy.
      const photo=await decode(url),scale=Math.min(1,2560/Math.max(photo.naturalWidth,photo.naturalHeight));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));
      const ctx=canvas.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.imageSmoothingQuality="high";ctx.drawImage(photo,0,0,canvas.width,canvas.height);
      data=canvas.toDataURL("image/jpeg",.91);
      if(data.length>2100000)data=canvas.toDataURL("image/jpeg",.76);
      if(data.length>2200000){
        const shrink=document.createElement("canvas"),factor=Math.min(.85,Math.sqrt(1600000/data.length));
        shrink.width=Math.max(1,Math.round(canvas.width*factor));shrink.height=Math.max(1,Math.round(canvas.height*factor));
        shrink.getContext("2d").drawImage(canvas,0,0,shrink.width,shrink.height);data=shrink.toDataURL("image/jpeg",.74);
      }
      if(data.length>2400000||!data.startsWith("data:image/jpeg;base64,"))throw Error("사진을 작업용 크기로 변환하지 못했습니다.");
    } finally {URL.revokeObjectURL(url);}
    return {id:crypto.randomUUID(),name:trimField(file.name.replace(/\.[^.]+$/u,""),80)||"사진",data,img:await decode(data)};
  }

  async function addFiles(fileList) {
    await ready;
    if(sourceBusy)return;
    const files=[...fileList],capacity=6-sources.size;
    if(!files.length)return;
    if(capacity<=0){setSourceStatus("보관대가 가득 찼습니다. 사용하지 않는 원판을 빼고 다시 추가하세요.");return;}
    sourceBusy=true;$("importPhoto").disabled=true;
    const added=[],errors=[];
    try {
      for(const file of files.slice(0,capacity)){
        setSourceStatus(file.name+" 불러오는 중…");
        try {added.push(await importAsset(file));} catch(e){errors.push(file.name+" · "+e.message);}
      }
      if(added.length){
        added.forEach(asset=>sources.set(asset.id,asset));
        if(!selection.length && $("storyTitle").value===houseTitle)$("storyTitle").value=added[0].name.slice(0,45);
        chooseSource(added[0].id);
      }
      if(files.length>capacity)errors.push("보관대에는 기본 사진과 내 사진 다섯 장을 담을 수 있습니다.");
      setSourceStatus([added.length ? "사진 "+added.length+"장을 추가했습니다." : "",...errors].filter(Boolean).join(" "));
    } finally { sourceBusy=false;$("importPhoto").disabled=false; }
  }

  $("importPhoto").addEventListener("click",()=>$("photoFile").click());
  $("photoFile").addEventListener("change",()=>{const files=[...$("photoFile").files];$("photoFile").value="";addFiles(files);});
  for(const area of [$("sourcePanel"),document.querySelector(".film-bed")]){
    area.addEventListener("dragover",e=>{if(e.dataTransfer.types.includes("Files")){e.preventDefault();e.dataTransfer.dropEffect="copy";area.classList.add("drag-over");}});
    area.addEventListener("dragleave",e=>{if(!area.contains(e.relatedTarget))area.classList.remove("drag-over");});
    area.addEventListener("drop",e=>{e.preventDefault();area.classList.remove("drag-over");addFiles(e.dataTransfer.files);});
  }
  $("discardSource").addEventListener("click",()=>{
    if(activeId===houseId||sourceBusy)return;
    const used=selection.filter(c=>c.source===activeId).length;
    if(used&&!confirm("이 원판과 이 원판에서 고른 "+used+"개 컷을 뺄까요?"))return;
    selection=selection.filter(cut=>cut.source!==activeId);editIndex=null;
    sources.delete(activeId);chooseSource(houseId);setSourceStatus("원판을 보관대에서 뺐습니다.");
  });

  async function restoreAsset(value) {
    if(!value||typeof value.id!=="string"||!/^[-a-zA-Z0-9_]{1,64}$/.test(value.id)||value.id===houseId||
      typeof value.name!=="string"||!value.name.trim()||typeof value.data!=="string"||value.data.length>2400000||
      !/^data:image\/jpeg;base64,[a-zA-Z0-9+/]+=*$/u.test(value.data))throw Error("프로젝트의 사진 형식이 올바르지 않습니다.");
    const body=value.data.slice(23);
    let bytes;
    try {bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));} catch {throw Error("저장된 사진을 읽을 수 없습니다.");}
    checkPixels(bytes,2560);
    return {id:value.id,name:trimField(value.name,80),data:value.data,img:await decode(value.data)};
  }

  async function applyState(saved,asDraft=false) {
    if(!saved||!Array.isArray(saved.cuts)||saved.cuts.length>3||!saved.cuts.every(validFocus)||
      (saved.version!==undefined&&saved.version!==2))throw Error("지원하지 않는 Light Table 프로젝트입니다.");
    const personal=saved.sources===undefined?[]:saved.sources;
    if(!Array.isArray(personal)||personal.length>5)throw Error("원판 개수를 확인하세요.");
    const nextSources=new Map([[houseId,housePhoto]]);
    for(const item of personal){
      const asset=await restoreAsset(item);
      if(nextSources.has(asset.id))throw Error("중복된 원판입니다.");
      nextSources.set(asset.id,asset);
    }
    function validated(cut){
      const id=cut.source||houseId;
      if(!validFocus(cut)||!nextSources.has(id))throw Error("컷이 참조하는 사진이나 구도가 올바르지 않습니다.");
      return {source:id,x:cut.x,y:cut.y,zoom:cut.zoom,caption:trimField(cut.caption,40)};
    }
    const nextCuts=saved.cuts.map(validated);
    const nextId=saved.active||houseId;
    if(!nextSources.has(nextId))throw Error("선택한 원판이 없습니다.");
    const nextFocus=validated(saved.focus||defaultFocus(nextId));
    if(nextFocus.source!==nextId)throw Error("원판과 확대경 데이터가 일치하지 않습니다.");
    const nextEdit=saved.editIndex ?? null;
    if(nextEdit!==null&&(!Number.isInteger(nextEdit)||nextEdit<0||nextEdit>=nextCuts.length))throw Error("선택한 컷을 찾을 수 없습니다.");
    const layout=saved.layout||"strip",paper=saved.paper||"ivory",format=saved.format||"png";
    if(!Object.hasOwn(layouts,layout)||!Object.hasOwn(papers,paper)||!["jpeg","png"].includes(format))throw Error("인화 설정이 올바르지 않습니다.");
    // Replace the workspace only after every image and crop has validated.
    sources=nextSources;selection=nextCuts;editIndex=nextEdit;focus=nextFocus;standaloneDraft=asDraft;
    $("storyTitle").value=trimField(saved.title,45)||houseTitle;
    $("caption").value=focus.caption;$("layout").value=layout;$("paper").value=paper;$("format").value=format;
    showSource(nextId);constrainFocus();updatePreview();renderFrames();announce("");
    if(proof.open)proof.close();
    if(!asDraft)setSourceStatus("프로젝트를 열었습니다. 변경 내용은 프로젝트 저장으로 보관하세요.");
  }

  function example() {
    return {version:2,title:"비가 그친 뒤",layout:"cover",paper:"ivory",format:"png",sources:[],active:houseId,focus:defaultFocus(),cuts:[
      {source:houseId,x:.115,y:.44,zoom:2.9,caption:"유리 너머의 사람"},
      {source:houseId,x:.43,y:.69,zoom:3.1,caption:"두 사람이 있었던 자리"},
      {source:houseId,x:.915,y:.47,zoom:3.9,caption:"마지막 불빛"}
    ]};
  }

  function getPreview() {
    if(!loaded)return "";
    const c=document.createElement("canvas");c.width=216;c.height=162;
    renderCrop(c.getContext("2d"),selection[0]||focus,0,0,c.width,c.height);
    try{return c.toDataURL("image/jpeg",.64);}catch{return "";}
  }

  async function initialize() {
    try {
      housePhoto={id:houseId,name:houseTitle,img:await decode("../assets/diner.jpg")};
      sources.set(houseId,housePhoto);showSource(houseId);constrainFocus();updatePreview();renderFrames();
      const draft=await readDraft();
      if(draft) {
        try {await applyState(draft,true);}
        catch {setSourceStatus("이전 작업을 복원할 수 없어 기본 원판을 열었습니다.");}
      }
    } catch {
      $("loadError").hidden=false;$("resolution").textContent="사진 읽기 오류";renderFrames();
    }
  }
  const ready=initialize();
  $("retry").addEventListener("click",()=>location.reload());
  if(window.NightLibrary)window.NightLibrary.register({
    getState:async()=>{await ready;if(!loaded||sourceBusy)throw Error("사진이 열린 뒤 저장하세요.");return state();},
    restore:async data=>{await ready;if(!housePhoto||sourceBusy)throw Error("원판을 연 뒤 다시 시도하세요.");sourceBusy=true;try{await applyState(data);}finally{sourceBusy=false;}},
    getTitle:()=>$("storyTitle").value.trim()||"무제",
    getPreview,getExample:example
  });
  if("ResizeObserver" in window){
    const observer=new ResizeObserver(scheduleDraw);observer.observe(stage);observer.observe(detail);
  }else window.addEventListener("resize",scheduleDraw);
})();

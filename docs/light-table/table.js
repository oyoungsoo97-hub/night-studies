"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const image = $("sourcePhoto");
  const stage = $("stage");
  const overlay = $("overlay");
  const detail = $("detail");
  const frames = $("frames");
  const proof = $("proofDialog");
  const storeKey = "night-studies/light-table/v1";
  const frameRatio = 4 / 3;
  const defaultFocus = () => ({ x: 0.435, y: 0.665, zoom: 3 });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let focus = defaultFocus();
  let selection = [];
  let editIndex = null;
  let loaded = false;
  let pointer = null;
  let pendingDraw = 0;

  function validFocus(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) &&
      Number.isFinite(value.zoom) && value.zoom >= 1.5 && value.zoom <= 7 &&
      value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1;
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey));
      if (!saved || !Array.isArray(saved.cuts) || saved.cuts.length > 3 ||
          !saved.cuts.every(validFocus)) return;
      selection = saved.cuts.map(cut => ({ x: cut.x, y: cut.y, zoom: cut.zoom }));
      if (typeof saved.title === "string") $("storyTitle").value = saved.title.slice(0, 45);
    } catch { /* Storage may be unavailable in private or file previews. */ }
  }

  function persist() {
    try {
      localStorage.setItem(storeKey, JSON.stringify({cuts: selection, title: $("storyTitle").value}));
    } catch { /* The editor also works in memory. */ }
  }

  function cropRect(cut) {
    const iw = image.naturalWidth, ih = image.naturalHeight;
    const w = Math.min(iw, ih * frameRatio) / cut.zoom, h = w / frameRatio;
    return { x: clamp(cut.x * iw - w / 2, 0, iw - w), y: clamp(cut.y * ih - h / 2, 0, ih - h), w, h };
  }

  function constrainFocus() {
    const r = cropRect(focus);
    focus.x = (r.x + r.w / 2) / image.naturalWidth;
    focus.y = (r.y + r.h / 2) / image.naturalHeight;
  }

  function renderCrop(ctx, cut, x, y, w, h) {
    const r = cropRect(cut);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, r.x, r.y, r.w, r.h, x, y, w, h);
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
      const note = document.createElement("span");note.textContent = item ? item.zoom.toFixed(1) + "×" : "빈 컷";
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
    focus = {...selection[index]};
    updatePreview();renderFrames();
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
      if (i === editIndex) return false;
      const r = cropRect(cut);
      return Math.abs(r.x - proposed.x) < proposed.w * .012 &&
        Math.abs(r.y - proposed.y) < proposed.h * .012 && Math.abs(r.w - proposed.w) < proposed.w * .012;
    });
    if (duplicate) {announce("이미 담은 장면이에요. 위치나 배율을 바꿔 다른 컷을 골라주세요.");return;}
    const replacing = editIndex !== null;
    if (replacing) selection[editIndex] = {...focus};else selection.push({...focus});
    editIndex = null;persist();renderFrames();
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
    pointer = null;scheduleDraw();
  };
  stage.addEventListener("pointerup", finishPointer);stage.addEventListener("pointercancel", finishPointer);
  stage.addEventListener("lostpointercapture", finishPointer);
  stage.addEventListener("keydown", e => {
    if (!loaded) return;
    if (e.key === "Enter" || e.key === " ") {e.preventDefault();if(!e.repeat)capture();return;}
    const direction = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if (!direction) return;
    e.preventDefault(); const step = e.shiftKey ? .04 : .008;
    focus.x += step * direction[0];focus.y += step * direction[1];
    constrainFocus();announce("");scheduleDraw();
  });
  $("zoom").addEventListener("input", e => {
    if (!loaded) return; focus.zoom = Number(e.target.value);constrainFocus();announce("");updatePreview();
  });
  $("capture").addEventListener("click",capture);
  $("cancelEdit").addEventListener("click", () => {
    editIndex = null;renderFrames();announce("원래 컷을 유지했습니다.");$("capture").focus({preventScroll:true});
  });
  $("earlier").addEventListener("click",()=>reorder(-1));$("later").addEventListener("click",()=>reorder(1));
  $("remove").addEventListener("click",()=>{
    if (editIndex === null) return;
    selection.splice(editIndex,1);editIndex=null;persist();renderFrames();
    announce("컷을 뺐습니다. 다른 장면을 담을 수 있습니다.");$("capture").focus({preventScroll:true});
  });

  function fitTitle(ctx, title, maxWidth) {
    let size = 88;
    while (size >= 28) {
      ctx.font = "600 " + size + 'px "Helvetica Neue", Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      if (ctx.measureText(title).width <= maxWidth) break;
      size -= 2;
    }
  }

  function renderPrint() {
    if (!loaded || selection.length !== 3) return;
    const canvas = $("proofCanvas"), ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const edge = 88, gap = 25, pictureWidth = (w - 2 * edge - 2 * gap) / 3, pictureHeight = pictureWidth / frameRatio;
    ctx.fillStyle = "#f2f0e8";ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "#22241f";ctx.font = '500 30px "Courier New", monospace';
    ctx.textAlign = "left";ctx.fillText("NIGHT STUDIES  /  LIGHT TABLE",edge,92);
    ctx.textAlign = "right";ctx.fillText("CONTACT PRINT   3 FRAMES",w-edge,92);
    ctx.fillStyle = "#252622";ctx.fillRect(edge,121,w-2*edge,3);
    const top = 170;
    selection.forEach((cut,i)=>{
      const x = edge + i * (pictureWidth + gap);
      renderCrop(ctx,cut,x,top,pictureWidth,pictureHeight);
      ctx.textAlign = "left";ctx.fillStyle = "#292b24";ctx.font='500 26px "Courier New", monospace';
      ctx.fillText(String(i+1).padStart(2,"0"),x,top+pictureHeight+45);
      ctx.textAlign="right";ctx.fillStyle="#626458";ctx.fillText(cut.zoom.toFixed(1)+"×",x+pictureWidth,top+pictureHeight+45);
    });
    const title = $("storyTitle").value.trim() || "비 오는 밤의 식당";
    ctx.textAlign="left";ctx.fillStyle="#242520";fitTitle(ctx,title,w-edge*2);
    ctx.fillText(title,edge,h-80,w-edge*2);
    ctx.fillStyle="#c84b24";ctx.fillRect(edge,h-46,92,5);
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
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)proof.close();
  });
  $("storyTitle").addEventListener("input",()=>{persist();renderPrint();});
  $("download").addEventListener("click",()=>{
    const button=$("download");button.disabled=true;
    const fail=()=>{$("printStatus").textContent="저장할 수 없습니다. 로컬 HTTP 서버 또는 HTTPS 링크에서 다시 열어주세요.";button.disabled=false;};
    try {
      $("proofCanvas").toBlob(blob=>{
        if(!blob){fail();return;}
        const link=document.createElement("a"),url=URL.createObjectURL(blob);
        const title=$("storyTitle").value.trim().replace(/[^\p{L}\p{N}_ -]/gu,"").slice(0,45).trim();
        link.download=(title || "Light Table")+" — Light Table.png";link.href=url;
        document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        button.disabled=false;$("printStatus").textContent="2400 × 1060 PNG 파일을 만들었습니다.";
      },"image/png");
    } catch {fail();}
  });

  function loadImage() {
    if (!image.naturalWidth || !image.naturalHeight) return;
    loaded=true;$("loadError").hidden=true;stage.style.aspectRatio=image.naturalWidth+" / "+image.naturalHeight;
    $("resolution").textContent=image.naturalWidth+" × "+image.naturalHeight;
    constrainFocus();updatePreview();renderFrames();
  }
  function loadFailed() {
    loaded=false;$("loadError").hidden=false;$("resolution").textContent="사진 읽기 오류";renderFrames();
  }
  $("retry").addEventListener("click",()=>{image.src="../assets/diner.jpg?v="+Date.now();});
  image.addEventListener("load",loadImage);image.addEventListener("error",loadFailed);
  restore();renderFrames();if(image.complete){if(image.naturalWidth)loadImage();else loadFailed();}
  if ("ResizeObserver" in window) {
    const observer=new ResizeObserver(scheduleDraw);observer.observe(stage);observer.observe(detail);
  } else window.addEventListener("resize",scheduleDraw);
})();

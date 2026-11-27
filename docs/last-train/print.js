'use strict';
window.TrainPrint = (() => {
  const families = {
    display: 'BarlowCondensed, "Arial Narrow", "Apple SD Gothic Neo", sans-serif',
    serif: 'InstrumentSerif, "Times New Roman", "AppleMyungjo", serif',
    mono: 'ui-monospace, Menlo, Consolas, monospace',
    text: '"Apple SD Gothic Neo", "Helvetica Neue", Arial, sans-serif'
  };
  const stocks = {
    vermilion: {name:'야간선', rim:'#dbc9ac', shadow:'#9a8466', filter:'none'},
    blueprint: {name:'청사진', rim:'#c3d5df', shadow:'#7993a2', filter:'grayscale(1) sepia(.52) saturate(2.3) hue-rotate(151deg) brightness(.90)'},
    letterpress: {name:'활판', rim:'#e9ddc5', shadow:'#998666', filter:'grayscale(1) contrast(1.21) sepia(.43)'}
  };
  const formats = {print:[1800,1200], cinema:[1920,1080], portrait:[1440,1800]};
  function text(c, str, x, y, size, width, ink, family, weight=600, align='left') {
    const scale = Math.max(8, size);
    c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle=ink;
    c.font=weight+' '+scale+'px '+families[family];
    const measure=c.measureText(str).width;
    if(measure>width)c.font=weight+' '+Math.max(8,scale*width/measure)+'px '+families[family];
    c.fillText(str,x,y);
  }
  function path(c, points, ink, thick, closed=false) {
    c.beginPath();points.forEach(([x,y], i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(closed)c.closePath();
    c.strokeStyle=ink;c.lineWidth=thick;c.stroke();
  }
  function tramPrint(c,w,h,source) {
    if(source){
      const sw=source.width,sh=source.height,s=h/sh;
      const left=Math.min(w*.43,sw*.45*s),right=Math.min(w*.36,sw*.37*s);
      c.drawImage(source,0,0,sw*.45,sh,0,0,left,h);
      c.drawImage(source,sw*.45,0,sw*.18,sh,left-.5,0,w-left-right+1,h);
      c.drawImage(source,sw*.63,0,sw*.37,sh,w-right,0,right,h);
    } else {
      c.fillStyle='#c54a30';c.fillRect(0,0,w,h);
      c.fillStyle='#d8bd8e';c.fillRect(0,h*.75,w,h*.25);
      c.fillStyle='#202d32';c.beginPath();c.arc(w*.82,h*.56,h*.14,0,Math.PI*2);c.fill();
      for(let i=0;i<4;i++)path(c,[[w*(-.2+i*.07),0],[w*.44,h*(.5+i*.026)],[w*.84,h*(.55+i*.022)]],'#d5be88',h*.012);
    }
  }
  function blueprint(c,w,h) {
    c.fillStyle='#123c58';c.fillRect(0,0,w,h);
    const g=c.createLinearGradient(0,0,w,h*.7);g.addColorStop(0,'#123955');g.addColorStop(.55,'#215271');g.addColorStop(1,'#0c263f');c.fillStyle=g;c.fillRect(0,0,w,h);
    const gap=h*.044;
    for(let x=0;x<w;x+=gap)path(c,[[x,0],[x,h]],'#91c0c326',h*.001);
    for(let y=0;y<h;y+=gap)path(c,[[0,y],[w,y]],'#91c0c326',h*.001);
    // A station plan printed as an elevation, with the route crossing the grid.
    const track=[[0,h*.64],[w*.23,h*.64],[w*.42,h*.43],[w*.73,h*.43],[w*.87,h*.27],[w,h*.27]];
    const rail=(dy,color,thick)=>path(c,track.map(([x,y])=>[x,y+dy]),color,thick);
    rail(0,'#e2ce90',h*.012);rail(h*.025,'#c2d7d7',h*.004);
    for(const [x,y] of track.slice(1,-1)){
      c.fillStyle='#123c58';c.strokeStyle='#dfd3aa';c.lineWidth=h*.004;c.beginPath();c.arc(x,y,h*.014,0,Math.PI*2);c.fill();c.stroke();
    }
    const right=w*.95,base=h*.72;
    for(let i=0;i<16;i++){const x=w*.59+i*w*.023;path(c,[[x,base],[x,base-h*(i%4===0?.052:.019)]],'#a5c6c3ab',h*.0018);}
    path(c,[[w*.59,base],[right,base]],'#c4d4c6aa',h*.0018);
    path(c,[[w*.045,h*.80],[w*.955,h*.80]],'#e7dba8',h*.003);
  }
  function letterpress(c,w,h) {
    c.fillStyle='#e8d9b4';c.fillRect(0,0,w,h);
    const x=w*.83,y=h*.35,rad=Math.min(w*.42,h*.48);
    c.save();c.beginPath();c.rect(w*.08,h*.09,w*.92,h*.59);c.clip();
    for(let i=0;i<14;i++){const r=rad-i*rad*.063;c.strokeStyle=i%3===0?'#383c34':'#a74d32';c.lineWidth=rad*.045;c.beginPath();c.arc(x,y,Math.max(2,r),0,Math.PI*2);c.stroke();}
    c.restore();
    c.fillStyle='#222a26';c.fillRect(w*.048,h*.705,w*.904,h*.014);
    c.fillStyle='#a74a30';c.fillRect(w*.050,h*.739,w*.045,h*.194);
    path(c,[[w*.12,h*.935],[w*.95,h*.935]],'#625944',h*.002);
  }
  function compose(c,w,h,design,poster,grain) {
    c.save();c.clearRect(0,0,w,h);
    if(design.stock==='blueprint')blueprint(c,w,h);
    else if(design.stock==='letterpress')letterpress(c,w,h);
    else tramPrint(c,w,h,poster);
    const stock=design.stock, title=design.title.trim() || 'LAST TRAIN', sub=design.subtitle.trim();
    const m=w*.05;
    if(stock==='vermilion'){
      text(c,'23:59',w-m,h*.167,h*.128,w*.31,'#f4ddb0','display',650,'right');
      text(c,title,m,h*.904,h*.147,w-2*m,'#1c2730','display',700);
      text(c,sub,m,h*.958,h*.034,w*.60,'#293029','text',600);
      text(c,'NIGHT SERVICE',w-m,h*.958,h*.032,w*.25,'#293029','mono',650,'right');
    } else if(stock==='blueprint'){
      text(c,'NIGHT LINE',m,h*.103,h*.047,w*.5,'#c3d4c5','mono',500);
      text(c,'23:59',w-m,h*.10,h*.053,w*.3,'#e9d594','mono',650,'right');
      text(c,title,m,h*.943,h*.141,w-2*m,'#f4e3ac','display',650);
      text(c,sub,w-m,h*.77,h*.038,w*.69,'#dde7df','text',550,'right');
    } else {
      text(c,'막차  /  夜行',m,h*.114,h*.047,w*.45,'#262c27','text',700);
      text(c,'23:59',m,h*.64,h*.20,w*.5,'#a8452d','serif',400);
      text(c,title,w*.119,h*.863,h*.133,w*.83,'#262c27','serif',550);
      text(c,sub,w*.123,h*.919,h*.035,w*.80,'#473d2f','text',600);
    }
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#fff8d204');g.addColorStop(1,'#47321d10');c.fillStyle=g;c.fillRect(0,0,w,h);
    grain(c,w,h,67,Math.round(w*h/42), stock==='letterpress'?.28:.16);
    c.restore();
  }
  return {stocks,formats,compose};
})();

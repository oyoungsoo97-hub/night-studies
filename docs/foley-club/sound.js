'use strict';
/* Original short, mono Foley cues synthesized from grains, resonant metal and friction. */
window.FoleySound = (() => {
  const rate = 32000;
  const durations = [.54, .78, 1.12];
  const seeds = [12752, 51819, 73801];
  let context, master, muted = false;
  const samples = new Map();
  const buffers = new WeakMap();
  const active = new Set();
  function rng(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function synth(id, variant = 0) {
    const key = id + '-' + variant;
    if (samples.has(key)) return samples.get(key);
    const rand = rng(seeds[id] + variant * 1303);
    const out = new Float32Array(Math.ceil(rate * durations[id]));
    function grain(start, length, fn) {
      const first = Math.max(0, Math.round(start * rate));
      const end = Math.min(out.length - first, Math.ceil(length * rate));
      for (let i = 0; i < end; i++) out[first+i] += fn(i/rate);
    }
    if (id === 0) {
      // Two weighted contacts and a small avalanche of pebbles.
      for (const [when, vol] of [[.003, .94],[.1 + rand()*.025, .57]]) {
        let brown = 0;
        grain(when, .23, t => {
          brown = brown*.84 + (rand()*2-1)*.16;
          return vol * (Math.sin(2*Math.PI*(58*t + .8*(1-Math.exp(-t*37))))*.5 + brown*2.4)
            * (1-Math.exp(-t*175))*Math.exp(-t*21);
        });
        for (let i=0; i<64; i++) {
          const start = when + Math.pow(rand(),1.45)*.25;
          const hz = 420 + rand()*2400, decay = 150 + rand()*450;
          const amp = (.11 + rand()*.19)*vol;
          grain(start,.034,t=>amp * Math.exp(-t*decay) * (Math.sin(t*hz*2*Math.PI)*.72 + (rand()*2-1)*.28));
        }
      }
    } else if (id === 1) {
      const notes = [1490,1860,2180,2540,3040];
      for (const [start, volume] of [[.001, .85],[.034,.53],[.113,1],[.141,.65],[.233,.74],[.302,.46],[.388,.33]]) {
        const f=notes[Math.floor(rand()*notes.length)]*(.98+rand()*.04);
        for (const [ratio,amp,decay] of [[.56,.3,37],[1,.45,16],[1.38,.36,19],[1.92,.18,29],[2.62,.13,37]]) {
          grain(start,.35,t=>volume*amp*(1-Math.exp(-t*720))*Math.exp(-t*decay)*Math.sin(2*Math.PI*f*ratio*t));
        }
        grain(start,.014,t=>volume*(rand()*2-1)*.8*Math.exp(-t*250));
      }
    } else {
      let phase = 0, noise = 0;
      grain(.017, .82, t=>{
        const u=t/.82;
        noise=noise*.88+(rand()*2-1)*.12;
        const envelope=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.7);
        const frequency=(365+170*Math.sin(u*Math.PI*1.46)+21*Math.sin(t*22)+8*Math.sin(t*98))*(1+variant*.023);
        phase+=2*Math.PI*frequency/rate;
        const stick=.74+.26*Math.sin(2*Math.PI*(18*t+13*t*t));
        return (Math.sin(phase)*.38+Math.sin(phase*2)*.2+Math.sin(phase*3)*.12+Math.sin(phase*5)*.05+noise*.55)*stick*envelope;
      });
      grain(.80,.19,t=>Math.exp(-t*36)*(1-Math.exp(-t*280))*(.96*Math.sin(t*2*Math.PI*95)+(rand()*2-1)*.57));
      grain(.835,.11,t=>Math.exp(-t*58)*(rand()*2-1)*.33);
    }
    // A quiet pair of wall reflections helps each object belong to the hallway.
    for (let i=out.length-1; i>=0; i--) {
      out[i]+=(out[i-1221]||0)*.13+(out[i-2640]||0)*.067;
    }
    const peak=out.reduce((m,x)=>Math.max(m,Math.abs(x)),.001);
    const headroom=[.81,.65,.64][id]/peak;
    for(let i=0;i<out.length;i++) out[i] *= headroom * Math.min(1,(out.length-i)/150);
    samples.set(key,out);
    return out;
  }
  function createMix(ctx,volume=.82) {
    const bus=ctx.createGain();
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-12;limiter.ratio.value=4;limiter.attack.value=.003;limiter.release.value=.17;
    bus.gain.value=volume;
    bus.connect(limiter);limiter.connect(ctx.destination);
    return bus;
  }
  function unlock() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      try {context=new Audio();master=createMix(context,muted?0:.82);}
      catch{return false;}
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
    return true;
  }
  function buffer(ctx,id,variant) {
    if(!buffers.has(ctx))buffers.set(ctx,new Map());
    const cache=buffers.get(ctx),key=id+'-'+variant;
    if(!cache.has(key)){
      const data=synth(id,variant),b=ctx.createBuffer(1,data.length,rate);
      b.getChannelData(0).set(data);cache.set(key,b);
    }
    return cache.get(key);
  }
  function schedule(ctx,bus,cue,when,offset=0,collect=false) {
    const source=ctx.createBufferSource();
    const fader=ctx.createGain(),panner=ctx.createStereoPanner();
    source.buffer=buffer(ctx,cue.s,cue.v);
    if(offset>=source.buffer.duration)return;
    fader.gain.value=10**((cue.db??0)/20);panner.pan.value=(cue.pan??0)/100;
    source.connect(fader);fader.connect(panner);panner.connect(bus);
    if(collect)active.add(source);
    source.onended=()=>{source.disconnect();fader.disconnect();panner.disconnect();active.delete(source);};
    source.start(when,offset);
  }
  function hit(id,variant,delay=0,db=0,pan=0,offset=0) {
    if(!context||context.state==='closed')return;
    schedule(context,master,{s:id,v:variant,db,pan},context.currentTime+Math.max(0,delay),offset,true);
  }
  async function exportWav(events,seconds=8) {
    const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    if(!Offline)throw new Error(NightStudio.text('이 브라우저는 WAV 렌더링을 지원하지 않습니다.'));
    const sampleRate=48000,frameCount=Math.round(seconds*sampleRate);
    const ctx=new Offline(2,frameCount,sampleRate),bus=createMix(ctx);
    events.forEach(e=>schedule(ctx,bus,e,e.t));
    const rendered=await ctx.startRendering();
    const dataBytes=frameCount*4,out=new ArrayBuffer(44+dataBytes);
    const view=new DataView(out),u8=new Uint8Array(out);
    const tag=(at,str)=>{for(let i=0;i<str.length;i++)u8[at+i]=str.charCodeAt(i);};
    tag(0,'RIFF');view.setUint32(4,36+dataBytes,true);tag(8,'WAVE');tag(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);
    view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);
    view.setUint16(32,4,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,dataBytes,true);
    const l=rendered.getChannelData(0),r=rendered.getChannelData(1);
    const pcm=v=>Math.round(Math.max(-1,Math.min(1,v))*(v<0?32768:32767));
    for(let i=0;i<frameCount;i++){view.setInt16(44+i*4,pcm(l[i]),true);view.setInt16(46+i*4,pcm(r[i]),true);}
    return new Blob([out],{type:'audio/wav'});
  }
  function stop() {
    for(const source of active){try{source.stop();}catch{}}
  }
  function setMute(value) {
    muted=value;
    if(master){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(muted?0:.82,context.currentTime,.008);}
  }
  const peaks=new Map();
  function waveform(canvas,id,variant=0) {
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,count=35,key=id+'-'+variant;
    if(!peaks.has(key)){
      const data=synth(id,variant),columns=[];
      for(let j=0;j<count;j++){
        const start=Math.floor(j*data.length/count),end=Math.floor((j+1)*data.length/count);
        let energy=0;for(let i=start;i<end;i+=3)energy+=data[i]**2;
        columns.push(Math.sqrt(energy/((end-start)/3))*3);
      }
      peaks.set(key,columns);
    }
    ctx.clearRect(0,0,w,h);ctx.fillStyle=['#e2b876','#a6c4af','#dfc28d'][id];
    peaks.get(key).forEach((level,j)=>{
      const amp=Math.max(1.3,Math.min(h-2,level*h));
      ctx.fillRect(j*w/count,h/2-amp/2,Math.max(1,w/count-1.4),amp);
    });
  }
  return {unlock, hit, stop, setMute, waveform, exportWav, durations:durations.slice()};
})();

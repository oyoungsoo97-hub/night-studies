'use strict';
/* Original short, mono Foley cues synthesized from grains, resonant metal and friction. */
window.FoleySound = (() => {
  const rate = 32000;
  const durations = [.54, .78, 1.12];
  const seeds = [12752, 51819, 73801];
  let context, master, muted = false;
  const samples = new Map();
  const buffers = new Map();
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
  function unlock() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      try {
        context = new Audio();
        master=context.createGain();
        const limiter=context.createDynamicsCompressor();
        limiter.threshold.value=-12; limiter.ratio.value=4; limiter.attack.value=.003; limiter.release.value=.17;
        master.gain.value=muted?0:.82;
        master.connect(limiter);limiter.connect(context.destination);
      } catch {return false;}
    }
    if (context.state==='suspended') context.resume().catch(()=>{});
    return true;
  }
  function buffer(id, variant) {
    const key=id+'-'+variant;
    if(!buffers.has(key)) {
      const data=synth(id,variant);
      const b=context.createBuffer(1,data.length,rate);
      b.getChannelData(0).set(data);
      buffers.set(key,b);
    }
    return buffers.get(key);
  }
  function hit(id,variant,delay=0) {
    if(!context || context.state==='closed') return;
    const source=context.createBufferSource();
    source.buffer=buffer(id,variant);source.connect(master);
    source.onended=()=>{source.disconnect();active.delete(source);};
    active.add(source);source.start(context.currentTime+Math.max(0,delay));
  }
  function stop() {
    for(const source of active){try{source.stop();}catch{}}
  }
  function setMute(value) {
    muted=value;
    if(master){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(muted?0:.82,context.currentTime,.008);}
  }
  function waveform(canvas,id) {
    const ctx=canvas.getContext('2d'), w=canvas.width,h=canvas.height,data=synth(id),count=35;
    ctx.clearRect(0,0,w,h);ctx.fillStyle=['#e2b876','#a6c4af','#dfc28d'][id];
    for(let j=0;j<count;j++) {
      const start=Math.floor(j*data.length/count),end=Math.floor((j+1)*data.length/count);
      let energy=0;for(let i=start;i<end;i+=3)energy+=data[i]**2;
      const amp=Math.max(1.3,Math.min(h-2,Math.sqrt(energy/((end-start)/3))*h*3));
      ctx.fillRect(j*w/count,h/2-amp/2,Math.max(1,w/count-1.4),amp);
    }
  }
  return {unlock, hit, stop, setMute, waveform};
})();

// Astral's instruments are made from oscillators, filtered air and a synthetic chamber.
const voiceLimit = 8;
const repeatDelay = {charge:.22, travel:.085, impact:.10, gate:.36, shield:.48, nova:.26, ink:.11};
const bound = (n, fallback) => Number.isFinite(n) ? Math.max(0, Math.min(1,n)) : fallback;
function random(seed) {
  return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
function makeNoise(ctx) {
  const noise=ctx.createBuffer(1,32000,24000),out=noise.getChannelData(0),rand=random(137209);
  for(let i=0;i<out.length;i++)out[i]=rand()*2-1;
  return noise;
}
function makeRoom(ctx) {
  const rate=ctx.sampleRate,ir=ctx.createBuffer(2,Math.floor(rate*1.34),rate);
  for(let side=0;side<2;side++){
    const out=ir.getChannelData(side),rand=random(8197+82*side);
    let dark=0;
    for(let i=0;i<out.length;i++){
      const t=i/rate;
      dark=dark*.56+(rand()*2-1)*.44;
      out[i]=t<.024?0:dark*.055*Math.min(1,(t-.024)*18)*Math.exp(-t*4.9);
    }
    for(const [t,gain] of [[.029,.30],[.047,-.22],[.073,.17],[.109,.12],[.153,-.075]]){
      out[Math.round((t+side*(t*.13))*rate)]+=gain;
    }
  }
  return ir;
}
function build(ctx) {
  const input=ctx.createGain(),comp=ctx.createDynamicsCompressor(),soft=ctx.createWaveShaper(),master=ctx.createGain();
  comp.threshold.value=-15;comp.knee.value=13;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.17;
  const curve=new Float32Array(1025);
  for(let i=0;i<curve.length;i++)curve[i]=Math.tanh((i/512-1)*1.08);
  soft.curve=curve;master.gain.value=0;
  input.connect(comp);comp.connect(soft);soft.connect(master);master.connect(ctx.destination);
  let recorder=null;
  if(ctx.createMediaStreamDestination){recorder=ctx.createMediaStreamDestination();master.connect(recorder);}
  const impulse=makeRoom(ctx),wet=ctx.createGain();wet.gain.value=.23;wet.connect(input);
  const reeds=ctx.createPeriodicWave(new Float32Array(8),Float32Array.of(0,1,.48,.23,.13,.07,.036,.02));
  const glass=ctx.createPeriodicWave(new Float32Array(7),Float32Array.of(0,.92,.08,.20,.03,.10,.02));
  const g={ctx,input,master,recorder,wet,room:null,impulse,reeds,glass,noise:makeNoise(ctx),voices:new Set(),recent:new Map(),serial:0};
  return g;
}
function freshRoom(g){
  if(g.room)g.room.disconnect();
  // The send is separate from the dry mix, so the chamber has no feedback path.
  g.room=g.ctx.createConvolver();g.room.buffer=g.impulse;g.room.connect(g.wet);
}
function smoothGain(param,target,time){
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);
  else {const current=param.value;param.cancelScheduledValues(time);param.setValueAtTime(current,time);}
  param.linearRampToValueAtTime(target,time+.022);
}
function voice(g,x,power,wetness){
  const ctx=g.ctx, now=ctx.currentTime+.007;
  const gain=ctx.createGain(),pan=ctx.createStereoPanner(),send=ctx.createGain();
  const panAt=(x-.5)*1.56, strength=.5+.48*power;
  gain.gain.value=strength;pan.pan.value=panAt;send.gain.value=wetness;
  gain.connect(pan);pan.connect(g.input);pan.connect(send);send.connect(g.room);
  const sources=new Set(),nodes=[gain,pan,send],rand=random(4439+ ++g.serial*197);
  let released=false;
  function disconnect(){
    for(const node of nodes)node.disconnect();
    g.voices.delete(v);
  }
  function end(){
    if(released)return;
    released=true;const t=ctx.currentTime;
    smoothGain(gain.gain,0,t);
    for(const src of sources){try{src.stop(t+.024);}catch{}}
    g.voices.delete(v);
  }
  function start(src,t,endTime,offset){
    sources.add(src);
    src.onended=()=>{src.disconnect();sources.delete(src);if(!sources.size)disconnect();};
    if(offset===undefined)src.start(t);else src.start(t,offset);
    src.stop(endTime+.003);
  }
  function envelope(length,attack,peak,hold=0){
    const env=ctx.createGain(),level=env.gain;
    nodes.push(env);
    return {env,apply:t=>{
      level.setValueAtTime(.00001,t);level.exponentialRampToValueAtTime(peak,t+attack);
      if(hold>0)level.exponentialRampToValueAtTime(peak*.82,t+attack+hold);
      level.exponentialRampToValueAtTime(.00003,t+length);
      env.connect(gain);
    }};
  }
  function tone(shape,from,to,delay,length,level,attack=.012,hold=0){
    const t=now+delay,osc=ctx.createOscillator(),amp=envelope(length,attack,level,hold);
    if(typeof shape==='string')osc.type=shape;else osc.setPeriodicWave(shape);
    osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+length);
    amp.apply(t);osc.connect(amp.env);start(osc,t,t+length);
  }
  function air(from,to,delay,length,level,attack=.02,q=.8,hold=0){
    const t=now+delay,buf=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),amp=envelope(length,attack,level,hold);
    buf.buffer=g.noise;buf.loop=true;
    filter.type='bandpass';filter.Q.value=q;
    filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(to,t+length);
    buf.connect(filter);filter.connect(amp.env);nodes.push(filter);amp.apply(t);
    start(buf,t,t+length,rand()*.8);
  }
  function bell(freq,delay,life,level){
    // Slightly inharmonic modes behave like struck glass instead of a keyboard chord.
    tone(g.glass,freq*1.007,freq,delay,life,level,.006);
    tone('sine',freq*2.716,freq*2.68,delay+.004,life*.56,level*.39,.004);
    tone('sine',freq*4.16,freq*4.11,delay+.007,life*.31,level*.16,.003);
  }
  function rotate(rate,amount,length){
    const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.setValueAtTime(rate,now);
    lfo.frequency.exponentialRampToValueAtTime(rate*.62,now+length);
    depth.gain.value=amount;lfo.connect(depth);depth.connect(pan.pan);nodes.push(depth);start(lfo,now,now+length);
  }
  const v={tone,air,bell,rotate,pan:pan.pan,now,panAt,rand,end};
  g.voices.add(v);return v;
}
function perform(g,kind,x,power){
  while(g.voices.size>=voiceLimit)g.voices.values().next().value.end();
  const v=voice(g,x,power,kind==='ink'?.24:kind==='gate'?.82:.58);
  const {tone,air,bell,rotate}=v;
  const body=105*(.94+.11*power+v.rand()*.035);
  switch(kind){
    case 'charge':
      air(310,4350,0,1.22,.54,.80,1.05);
      tone(g.reeds,body*.79,body*2.27,0,1.26,.22,.67,.09);
      tone('sine',body*1.52,body*4.45,.15,1.02,.12,.51,.10);
      bell(body*6.02,.82,.72,.105);
      break;
    case 'travel': {
      const side=x>=.5?1:-1;
      v.pan.setValueAtTime(-side*.35,v.now);
      v.pan.linearRampToValueAtTime(side*(.55+Math.abs(x-.5)*.75),v.now+.40);
      air(1050,6450,0,.15,.88,.05,.82);
      air(5400,460,.085,.51,.77,.08,.7);
      tone(g.reeds,body*6.6,body*.97,.015,.46,.16,.019);
      tone('sine',body*10.8,body*2.65,.016,.27,.085,.025);
      break;
    }
    case 'impact':
      air(3700,420,0,.37,1.05,.005,.66);
      tone(g.reeds,body*2.17,46,0,.55,.52,.005);
      bell(body*4.13,.007,1.26,.235);
      bell(body*5.89,.034,.98,.115);
      break;
    case 'gate':
      rotate(1.56,.27,1.91);
      air(660,1920,0,1.60,.27,.27,1.45,.41);
      tone(g.glass,body*1.46,body*1.50,0,1.89,.25,.18,.55);
      tone('sine',body*2.24,body*2.30,.04,1.67,.14,.23,.51);
      bell(body*4.56,.02,1.15,.12);
      bell(body*6.82,.27,1.18,.094);
      bell(body*5.45,.58,1.08,.077);
      break;
    case 'shield':
      air(380,1390,0,1.47,.40,.15,.8,.43);
      tone(g.reeds,body*.81,body*.86,0,1.69,.30,.12,.72);
      tone(g.glass,body*1.23,body*1.28,.025,1.69,.16,.19,.64);
      tone('sine',body*2.42,body*2.53,.07,1.56,.095,.25,.53);
      bell(body*4.95,.018,.74,.10);
      break;
    case 'nova':
      air(390,5100,0,.24,.64,.18,1.1);
      air(6100,320,.14,.87,.96,.009,.7);
      tone(g.reeds,body*1.9,42,.14,.90,.43,.009);
      bell(body*3.06,.14,1.87,.235);
      bell(body*4.68,.185,1.61,.18);
      bell(body*7.14,.255,1.44,.11);
      break;
    case 'ink':
      air(780+power*340,2040,0,.31,.55,.055,1.45);
      tone(g.glass,body*3.91,body*3.39,0,.34,.115,.024);
      tone('sine',body*6.24,body*5.81,.075,.34,.077,.010);
      break;
  }
}
export function makeSpellAudio(){
  let graph=null,enabled=false,desired=false,revision=0;
  async function setEnabled(next){
    const token=++revision;desired=Boolean(next);
    if(!desired){
      enabled=false;
      if(graph){smoothGain(graph.master.gain,0,graph.ctx.currentTime);for(const v of [...graph.voices])v.end();graph.recent.clear();}
      return false;
    }
    try{
      if(!graph){
        const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
        if(!Audio)return false;
        const ctx=new Audio({latencyHint:'interactive'});
        try{graph=build(ctx);}catch(error){ctx.close().catch(()=>{});throw error;}
      }
      const g=graph;
      if(g.ctx.state!=='running')await g.ctx.resume();
      if(token!==revision||graph!==g||!desired)return enabled;
      if(!enabled)freshRoom(g);
      smoothGain(g.master.gain,.80,g.ctx.currentTime);enabled=g.ctx.state==='running';return enabled;
    }catch{if(token===revision)stop();return false;}
  }
  function cue(kind,{x=.5,power=.65}={}){
    if(kind==='bolt')kind='travel';
    if(!enabled||!graph||graph.ctx.state!=='running'||!Object.hasOwn(repeatDelay,kind))return false;
    const now=graph.ctx.currentTime;
    if(now-(graph.recent.get(kind)??-Infinity)<repeatDelay[kind])return false;
    graph.recent.set(kind,now);perform(graph,kind,bound(x,.5),bound(power,.65));return true;
  }
  function stop(){
    ++revision;desired=false;enabled=false;
    const old=graph;graph=null;
    if(!old)return;
    for(const v of [...old.voices])v.end();
    old.master.disconnect();old.recorder?.stream.getTracks().forEach(track=>track.stop());
    if(old.ctx.state!=='closed')old.ctx.close().catch(()=>{});
  }
  return {get enabled(){return enabled;},setEnabled,cue,stop,getStream:()=>graph?.recorder?.stream??null};
}

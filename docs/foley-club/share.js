'use strict';
// Each cue is a millisecond offset and a sample/variant index, without audio or identity data.
window.FoleyShare=(()=>{
  const maxEvents=512;
  const prefix='#takes=';
  function encode(takes){
    const a=takes.A.length,b=takes.B.length;
    if(!a||!b||a>maxEvents||b>maxEvents)return null;
    const bytes=new Uint8Array(5+(a+b)*3);
    const view=new DataView(bytes.buffer);
    bytes[0]=1;view.setUint16(1,a);view.setUint16(3,b);
    let k=5;
    for(const track of [takes.A,takes.B]){
      for(const e of track){
        view.setUint16(k,Math.min(7999,Math.round(e.t*1000)));bytes[k+2]=e.s*3+e.v;k+=3;
      }
    }
    const base64=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    return prefix+base64;
  }
  function decode(hash){
    if(!hash.startsWith(prefix))return null;
    const text=hash.slice(prefix.length);
    if(text.length<14||text.length>4103||!/^[\w-]+$/.test(text))return null;
    try{
      const bytes=Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
      const view=new DataView(bytes.buffer);
      const a=view.getUint16(1),b=view.getUint16(3);
      if(bytes[0]!==1 || !a || !b || a>maxEvents || b>maxEvents || bytes.length!==5+(a+b)*3)return null;
      const result={A:[],B:[]};let k=5;
      for(const [name,length] of [['A',a],['B',b]]){
        let last=-1;
        for(let i=0;i<length;i++){
          const ms=view.getUint16(k),sample=bytes[k+2];
          if(ms>=8000||ms<last||sample>8)return null;
          result[name].push({t:ms/1000,s:Math.floor(sample/3),v:sample%3});
          last=ms;k+=3;
        }
      }
      return result;
    }catch{return null;}
  }
  return {encode, decode};
})();

// Extract dimensions without allocating a decoded bitmap. Animated GIFs become a single-image GIF.
const tag=(bytes,i)=>String.fromCharCode(...bytes.subarray(i,i+4));
export function gifHeader(bytes){
  if(bytes.length<14||!['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.subarray(0,6))))return null;
  const u16=i=>bytes[i]+256*bytes[i+1],width=u16(6),height=u16(8);
  let pos=13+((bytes[10]&128)?3*(1<<((bytes[10]&7)+1)):0);
  function subblocks(){while(pos<bytes.length){const n=bytes[pos++];if(n===0)return true;pos+=n;}return false;}
  while(pos<bytes.length){const type=bytes[pos++];if(type===0x21){pos++;if(!subblocks())return null;continue;}
    if(type!==0x2c||pos+10>bytes.length)return null;const x=u16(pos),y=u16(pos+2),w=u16(pos+4),h=u16(pos+6),flags=bytes[pos+8];
    if(!w||!h||x+w>width||y+h>height)return null;pos+=9+((flags&128)?3*(1<<((flags&7)+1)):0)+1;
    if(!subblocks())return null;return {size:[width,height],end:pos};}return null;
}
export function bmpSize(b){
  if(b.length<26||b[0]!==66||b[1]!==77)return null;const v=new DataView(b.buffer,b.byteOffset,b.byteLength),dib=v.getUint32(14,true);
  if(dib===12&&v.getUint16(22,true)===1)return [v.getUint16(18,true),v.getUint16(20,true)];
  if(![40,52,56,64,108,124].includes(dib)||b.length<14+dib||v.getUint16(26,true)!==1)return null;
  return [v.getInt32(18,true),Math.abs(v.getInt32(22,true))];
}
export function heifHeader(b,allowed){
  if(b.length<32||tag(b,4)!=='ftyp')return null;
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength),u16=i=>v.getUint16(i),u32=i=>v.getUint32(i);let budget=7000;
  function boxes(start,end){const result=[];for(let p=start;p<end;){if(--budget<0||p+8>end)throw Error();let n=u32(p),off=p+8;if(n===1){if(off+8>end||u32(off)!==0)throw Error();n=u32(off+4);off+=8;}if(n===0)n=end-p;if(n<off-p||p+n>end)throw Error();result.push({type:tag(b,p+4),p:off,end:p+n});p+=n;}return result;}
  const get=(items,type)=>{const box=items.find(x=>x.type===type);if(!box)throw Error();return box;};
  try{
    const top=boxes(0,b.length),ftyp=get(top,'ftyp');if(top.some(box=>box.type==='moov'))return null;
    const brands=[];for(let p=ftyp.p;p+4<=ftyp.end;p+=4)if(p!==ftyp.p+4)brands.push(tag(b,p));
    const avif=brands.includes('avif'),heic=brands.some(b=>['heic','heix','hevc','hevx'].includes(b));if(!avif&&!heic)return null;
    const m=get(top,'meta'),meta=boxes(m.p+4,m.end),primary=get(meta,'pitm'),id=b[primary.p]===0?u16(primary.p+4):u32(primary.p+4),infs=get(meta,'iinf');
    const info=boxes(infs.p+(b[infs.p]===0?6:8),infs.end).find(box=>box.type==='infe'&&(b[box.p]===2?u16(box.p+4):b[box.p]===3?u32(box.p+4):-1)===id);
    if(!info)return null;const kind=tag(b,info.p+(b[info.p]===2?8:10));if(!['av01','hvc1','hev1','grid'].includes(kind))return null;
    const p=get(meta,'iprp'),group=boxes(p.p,p.end),ipco=get(group,'ipco'),props=boxes(ipco.p,ipco.end);
    function ispe(prop){if(prop.p+12>prop.end)throw Error();const size=[u32(prop.p+4),u32(prop.p+8)];if(!allowed(...size))throw Error();return size;}
    for(const prop of props)if(prop.type==='ispe')ispe(prop);
    let size;for(const associations of group.filter(x=>x.type==='ipma')){
      const {p,end}=associations,large=b[p+3]&1,v1=b[p]>=1,count=u32(p+4);let i=p+8;if(count>4096)throw Error();
      for(let k=0;k<count;k++){const item=v1?u32(i):u16(i);i+=v1?4:2;const n=b[i++];
        for(let j=0;j<n;j++){const idx=large?(u16(i)&32767):(b[i]&127);i+=large?2:1;if(i>end)throw Error();const prop=props[idx-1];if(item===id&&prop?.type==='ispe')size=ispe(prop);}}}
    if(!size)return null;
    if(kind==='grid'){
      // Validate the assembled image dimensions as well as the tile declarations.
      const loc=get(meta,'iloc'),ver=b[loc.p],os=b[loc.p+4]>>4,ls=b[loc.p+4]&15,bs=b[loc.p+5]>>4,ins=ver?b[loc.p+5]&15:0;if(ver>2||[os,ls,bs,ins].some(x=>![0,2,4,8].includes(x)))return null;
      let i=loc.p+6;const read=n=>{if(i+n>loc.end)throw Error();let num=0;for(let j=0;j<n;j++)num=num*256+b[i++];if(!Number.isSafeInteger(num))throw Error();return num;};
      const count=read(ver===2?4:2);if(count>4096)return null;let verified=false;
      for(let k=0;k<count;k++){const item=read(ver===2?4:2),method=ver?read(2)&15:0,ref=read(2),base=read(bs),n=read(2);if(n>4096)throw Error();
        for(let e=0;e<n;e++){read(ins);const offset=read(os),length=read(ls);if(item!==id)continue;if(n!==1||ref!==0||(method!==0&&method!==1)||length<8)throw Error();
          const container=method===1?get(meta,'idat'):{p:0,end:b.length},j=container.p+base+offset;if(j+length>container.end||b[j]!==0)throw Error();const wide=b[j+1]&1;if(wide&&length<12)throw Error();
          if((b[j+2]+1)*(b[j+3]+1)>4096)throw Error();const w=wide?u32(j+4):u16(j+4),h=wide?u32(j+8):u16(j+6);if(w!==size[0]||h!==size[1])throw Error();verified=true;}}
      if(!verified)return null;
    }
    return {size,mime:avif?'image/avif':'image/heic'};
  }catch{return null;}
}

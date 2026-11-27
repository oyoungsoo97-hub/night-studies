// Read the container dimensions before full image decode to bound local memory use.
export function dimensions(bytes){
  if(bytes.length<30)return null;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0)===0x89504e47&&view.getUint32(4)===0x0d0a1a0a&&view.getUint32(12)===0x49484452)return [view.getUint32(16),view.getUint32(20)];
  if(view.getUint16(0)===0xffd8){let i=2;
    while(i+8<bytes.length&&bytes[i++]===255){while(i<bytes.length&&bytes[i]===255)i++;if(i+2>=bytes.length)break;const marker=bytes[i++],size=view.getUint16(i);
      if(marker===0xda||marker===0xd9||size<2||i+size>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&size>=7)return [view.getUint16(i+5),view.getUint16(i+3)];i+=size;}}
  if(view.getUint32(0)===0x52494646&&view.getUint32(8)===0x57454250){const tag=view.getUint32(12);if(tag===0x56503858){const u24=i=>1+bytes[i]+256*bytes[i+1]+65536*bytes[i+2];return [u24(24),u24(27)];}if(tag===0x56503820)return [view.getUint16(26,true)&16383,view.getUint16(28,true)&16383];if(tag===0x5650384c){const n=view.getUint32(21,true);return [(n&16383)+1,((n>>>14)&16383)+1];}}
  return null;
}
export function fits(w,h,maxEdge=65535){return w>=1&&h>=1&&w<=maxEdge&&h<=maxEdge&&w*h<=55000000&&w/h<=8&&h/w<=8;}

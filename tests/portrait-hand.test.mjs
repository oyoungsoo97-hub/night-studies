import assert from 'node:assert/strict';
import test from 'node:test';
import {curlHand, driveHand, fitHandPose, photoHand} from '../docs/portrait-stage/hand3d.mjs';
import {buildFigure3D} from '../docs/portrait-stage/figure3d.mjs';

function openPalm(){
  const points=[{x:.44,y:.69,z:0}];
  for(const [x,y,dx,dy] of [[.414,.652,-.018,-.012],[.412,.609,-.004,-.026],[.435,.60,0,-.030],[.457,.607,.003,-.026],[.476,.620,.007,-.021]]){
    for(let j=0;j<4;j++)points.push({x:x+dx*j,y:y+dy*j,z:-.003*j});
  }
  return points;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function assertBoneLengths(original,posed){
  for(let f=0;f<5;f++)for(let j=0;j<3;j++){
    const i=1+4*f+j;
    assert.ok(Math.abs(distance(posed[i],posed[i+1])/distance(original[i],original[i+1])-1)<1e-8);
  }
}
test('a moving or manually curled hand retains all fifteen measured bone lengths',()=>{
  const original=openPalm(),rest=photoHand(original);
  const live=original.map((p,i)=>({...p,x:p.x+(i===7?.038:i===8?.060:0),z:p.z-(i%4)*.019}));
  for(const frame of [curlHand(original,.98),driveHand(original,live,original,1,true)]){
    const target=frame.map((p,i)=>({...p,z:rest[i].z+p.dz}));
    assertBoneLengths(rest,target);assertBoneLengths(rest,fitHandPose(rest,target));
  }
});
test('the palm and its five fingers share a closed, consistently wound surface',()=>{
  const mesh=buildFigure3D({aspect:1,hands:[{landmarks:openPalm()}]});
  const edges=new Map(),neighbors=new Map();
  for(let f=0;f<mesh.indices.length;f+=3)for(let k=0;k<3;k++){
    const a=mesh.indices[f+k],b=mesh.indices[f+(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join('/');
    const edge=edges.get(key)||{count:0,direction:0};
    edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);
    if(!neighbors.has(a))neighbors.set(a,[]);neighbors.get(a).push(b);
  }
  for(const e of edges.values()){assert.equal(e.count,2);assert.equal(e.direction,0);}
  const reached=new Set(),queue=[neighbors.keys().next().value];
  while(queue.length){const p=queue.pop();if(reached.has(p))continue;reached.add(p);queue.push(...neighbors.get(p));}
  assert.equal(reached.size,neighbors.size);
});

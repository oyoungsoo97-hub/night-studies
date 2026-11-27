import test from 'node:test';
import assert from 'node:assert/strict';
import {faceSignal,relativePose} from '../docs/portrait-stage/rig.mjs';

test('turning at a fixed camera distance rotates the head without a false nod or retreat',()=>{
  const landmarks=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
  landmarks[33]={x:.4,y:.4,z:0};landmarks[263]={x:.6,y:.4,z:0};
  function signal(degrees,distance){
    const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const matrix=[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,-distance,1];
    return faceSignal({landmarks,matrix},1);
  }
  const neutral=signal(0,50);
  for(const angle of [-70,-35,35,70]){
    const pose=relativePose(signal(angle,50),neutral,1);
    assert.ok(Math.abs(pose.yaw*1.38+angle*Math.PI/180)<1e-6);
    assert.equal(pose.pitch,0);assert.equal(pose.depth,0);
  }
  assert.ok(relativePose(signal(0,40),neutral,1).depth>0);
});

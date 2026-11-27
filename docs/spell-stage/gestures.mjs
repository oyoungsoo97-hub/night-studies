const distance=(a,b,ratio)=>Math.hypot((a.x-b.x)*ratio,a.y-b.y);
export function readPose(hand,ratio,calibrated,map,previous){
 const l=hand.landmarks;if(!Array.isArray(l)||l.length<21)return null;
 const span=distance(l[5],l[17],ratio);if(span<.015)return null;
 const scale=calibrated?Math.max(span*.77,Math.min(span*1.19,span*.70+calibrated*.30)):span;
 const pinch=distance(l[4],l[8],ratio)/scale<(previous?.pinch?.41:.29);
 // Wrist-relative distances work with rotated hands as well as upright palms.
 const fingers=[[8,6],[12,10],[16,14],[20,18]].map(([tip,joint])=>
   distance(l[tip],l[0],ratio)>distance(l[joint],l[0],ratio)+span*.17);
 const extended=fingers.filter(Boolean).length;
 const open=extended>=3&&!pinch&&distance(l[4],l[8],ratio)>scale*.50;
 const pointing=!pinch&&fingers[0]&&!fingers[1]&&!fingers[2]&&!fingers[3];
 const shield=!pinch&&fingers[0]&&fingers[1]&&!fingers[2]&&!fingers[3];
 const p=pointing?l[8]:pinch?{x:(l[4].x+l[8].x)/2,y:(l[4].y+l[8].y)/2}:l[9];
 const point=map(p),blend=previous?.point?.x!=null?.68:1;
 return {key:hand.handedness,span,pinch,open,pointing,shield,wrist:map(l[0]),point:previous?{x:previous.point.x+(point.x-previous.point.x)*blend,y:previous.point.y+(point.y-previous.point.y)*blend}:point};
}

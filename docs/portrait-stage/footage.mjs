// Each sample comes from the corresponding decoded TV10 frame, before mirroring.
// XY observations use the film crop. Depth and finger orientations use per-frame world landmarks.
import {photoHand,measuredHand} from './hand3d.mjs?v=649a3cd4e5';
const magnitude=(x,y)=>Math.hypot(x,y);
const limit=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const filmAspect=432/640;
const neutral={yaw:-.167859,pitch:.291342,roll:-.306484};
const bodyIds=[11,12,13,14,15,16];

function frameFor(sample,clip,{aspect,palms,inferred,landmarks,model}){
  const [yaw,pitch,roll,span,blinkL,blinkR,jaw,smileL,smileR,pucker,eyeX,eyeY]=sample.head;
  const body=landmarks.map(p=>({...p,dz:0})),[left,right]=sample.body;
  const length=magnitude(landmarks[11].x-landmarks[12].x,(landmarks[11].y-landmarks[12].y)*aspect);
  const mid={x:(landmarks[11].x+landmarks[12].x)*.5,y:(landmarks[11].y+landmarks[12].y)*aspect*.5};
  const center=[(left[0]+right[0])*.5,(left[1]+right[1])*.5];
  const scale=limit(length/Math.max(.08,magnitude(left[0]-right[0],(left[1]-right[1])*filmAspect)),.55,2);
  const screen=q=>({x:mid.x+(q[0]-center[0])*scale,y:mid.y+(q[1]-center[1])*filmAspect*scale});
  const shoulderDepth=(sample.depth[0]+sample.depth[1])*.5;
  const sourceDepth=(landmarks[11].z+landmarks[12].z)*.5;
  const active=clip==='head-turn'?15:16;
  const worldScale=length/.34;
  for(let k=0;k<bodyIds.length;k++){
    const id=bodyIds[k],src=landmarks[id],xy=screen(id===active&&sample.wrist?sample.wrist:sample.body[k]);
    const restZ=limit((sourceDepth-src.z)*.39,-length*.34,length*.52);
    body[id]={x:xy.x,y:xy.y/aspect,dz:limit((shoulderDepth-sample.depth[k])*worldScale,-length*.7,length*1.1)-restZ};
  }
  // Anchor the visible wrist to the face in the same screen units as the footage.
  // Pose landmarks alone frequently place a hand over the cheek below the frame.
  const shoulderRoll=Math.atan2((body[11].y-body[12].y)*aspect,body[11].x-body[12].x)-
    Math.atan2((landmarks[11].y-landmarks[12].y)*aspect,landmarks[11].x-landmarks[12].x);
  const pose={yaw:(yaw-neutral.yaw)/1.38,pitch:(pitch-neutral.pitch)/.72,roll:(neutral.roll-roll-shoulderRoll)/.60,blinkL,blinkR,jaw,smileL,smileR,pucker};
  const targets=palms.map(()=>null),puppets=[null,null];
  if(sample.hand){
    const bindWrist=landmarks[active],nearest=palms.findIndex(p=>magnitude(p[0].x-bindWrist.x,p[0].y-bindWrist.y*aspect)<length*.30);
    const slot=active===15?1:0,rest=nearest>=0?palms[nearest]:inferred?.[slot];
    if(rest){
      const q=measuredHand(photoHand(rest),sample.hand.map(([x,y,z])=>({x,y,z:-z})));
      if(nearest>=0)targets[nearest]=q;else puppets[slot]=q;
    }
    const head=model.parts.find(part=>part.name==='Head'),figure=model.parts.find(part=>part.name==='Figure');
    const points=head.pose({pose,body}),eye=[0,1,2].map(k=>(points[33*3+k]+points[263*3+k])*.5);
    const eyeWidth=magnitude(points[33*3]-points[263*3],points[33*3+1]-points[263*3+1]);
    const bind=figure.wristBindings[active],wrist=body[active];
    const distance=Math.max(.1,(model.max[1]-model.min[1])*4);
    const ratio=eyeWidth/Math.max(.05,span)*(1-(bind.z+wrist.dz-eye[2])/distance);
    wrist.x=eye[0]+(sample.wrist[0]-eyeX)*ratio-(bind.x-landmarks[active].x);
    wrist.y=(eye[1]+(sample.wrist[1]-eyeY)*filmAspect*ratio-bind.y)/aspect+landmarks[active].y;
    // The wrist can sit almost directly over the shoulder in the image. Solve
    // on the 3D elbow circle, using the filmed lower elbow as its bend pole.
    const elbow=active-2,shoulder=active-4,bones=figure.armBindings;
    const minus=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>Math.hypot(...a),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
    const current=id=>[body[id].x,body[id].y*aspect,bones[id][2]+body[id].dz];
    const S=current(shoulder),E=current(elbow),W=current(active),direction=minus(W,S);
    const distanceSW=norm(direction),upper=norm(minus(bones[elbow],bones[shoulder])),fore=norm(minus(bones[active],bones[elbow]));
    if(distanceSW>.002){
      const axis=direction.map(v=>v/distanceSW),d=limit(distanceSW,Math.abs(upper-fore)+.001,upper+fore-.001);
      const along=(upper*upper-fore*fore+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
      const pole=minus(E,S),onto=dot(pole,axis),radial=pole.map((v,i)=>v-axis[i]*onto),radius=Math.max(.001,norm(radial));
      const joint=S.map((v,i)=>v+along*axis[i]+height*radial[i]/radius);
      body[elbow]={x:joint[0],y:joint[1]/aspect,dz:joint[2]-bones[elbow][2]};
    }
  }
  return {t:sample.t,pose,body,targets,puppets,reference:{x:eyeX,y:eyeY,span}};
}
function mixObject(a,b,t){
  const p={...a};for(const k in a)if(typeof a[k]==='number'&&typeof b[k]==='number')p[k]=lerp(a[k],b[k],t);return p;
}
function betweenFrames(a,b,t){
  const hands=(key)=>a[key].map((p,i)=>p&&b[key][i]?p.map((q,j)=>mixObject(q,b[key][i][j],t)):p||b[key][i]);
  return {pose:mixObject(a.pose,b.pose,t),reference:mixObject(a.reference,b.reference,t),body:a.body.map((p,i)=>mixObject(p,b.body[i],t)),targets:hands('targets'),puppets:hands('puppets')};
}

export function installComparison({context,surface,refresh}){
  const by=id=>document.getElementById(id),dialog=by('filmDialog'),video=by('filmSource'),screen=by('filmModel'),angle=by('filmOrbit');
  let frames=[],token=0,frameId=0,rendered=-1;
  const cached=new Map();let objectURL=null;
  function paint(mediaTime=video.currentTime){
    if(!dialog.open||!frames.length)return;
    const i=Math.min(frames.length-2,Math.max(0,Math.floor(mediaTime*15000/1001))),a=frames[i],b=frames[i+1];
    const frame=betweenFrames(a,b,limit((mediaTime-a.t)/(b.t-a.t),0,1));
    const view={yaw:Number(angle.value),pitch:0,zoom:1,light:0,reference:frame.reference};
    surface.draw({...frame,view},640,432,screen);rendered=mediaTime;
    screen.dataset.mediaTime=mediaTime.toFixed(3);
  }
  function cancel(){if(frameId){if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);else cancelAnimationFrame(frameId);frameId=0;}}
  function schedule(){
    cancel();if(!dialog.open||video.paused||video.ended)return;
    if(video.requestVideoFrameCallback)frameId=video.requestVideoFrameCallback((_,meta)=>{frameId=0;paint(meta.mediaTime);schedule();});
    else frameId=requestAnimationFrame(()=>{frameId=0;if(rendered!==video.currentTime)paint();schedule();});
  }
  async function load(){
    const generation=++token,id=by('filmClip').value;
    video.pause();cancel();frames=[];screen.style.visibility='hidden';by('filmError').hidden=true;
    const path='../assets/winter-'+id;
    video.poster=path+'.jpg';
    try{
      let asset=cached.get(id);
      if(!asset){
        const [track,film]=await Promise.all([fetch(path+'.json'),fetch(path+'.mp4')]);
        if(!track.ok||!film.ok)throw Error('film');
        asset={samples:await track.json(),video:await film.blob()};cached.set(id,asset);
      }
      if(generation!==token||!dialog.open)return;
      if(objectURL)URL.revokeObjectURL(objectURL);
      objectURL=URL.createObjectURL(asset.video);video.src=objectURL;video.load();
      video.dataset.clip=id;video.playbackRate=Number(by('filmSpeed').value);
      const samples=asset.samples;
      const bind=context();frames=samples.map(row=>frameFor(row,id,bind));screen.style.visibility='visible';paint(0);schedule();
    }catch{if(generation===token)by('filmError').hidden=false;}
  }
  by('compareFilm').onclick=()=>{dialog.showModal();load();};
  by('filmClose').onclick=()=>dialog.close();dialog.onclose=()=>{token++;cancel();video.pause();video.removeAttribute('src');video.load();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;frames=[];refresh();};
  by('filmClip').onchange=load;by('filmSpeed').onchange=()=>{video.playbackRate=Number(by('filmSpeed').value);};
  angle.oninput=()=>{by('filmAngle').value=angle.value+'°';paint();};
  video.addEventListener('play',schedule);video.addEventListener('pause',()=>{cancel();paint();});
  video.addEventListener('seeked',()=>{paint();schedule();});video.addEventListener('loadeddata',()=>paint());
  video.addEventListener('error',()=>{if(dialog.open)by('filmError').hidden=false;});
  video.addEventListener('timeupdate',()=>{if(video.paused)paint();});
  const requested=new URL(location.href).searchParams.get('compare');
  if(['head-turn','finger-heart'].includes(requested)){
    const tools=by('compareTools'),openRequested=()=>{
      if(tools.hidden)return;
      observer.disconnect();by('filmClip').value=requested;by('compareFilm').click();
    };
    const observer=new MutationObserver(openRequested);
    observer.observe(tools,{attributes:true,attributeFilter:['hidden']});openRequested();
  }

}

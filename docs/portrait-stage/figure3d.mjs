import {fitHandPose,curlJoints} from './hand3d.mjs?v=b57fe028e9';
// Photo-space x and y are measured in image widths. The camera looks down -z.
const limit=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const point=(x,y,z=0)=>({x,y,z});
const between=(a,b,t)=>point(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(a.z,b.z,t));
const length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const smooth=(a,b,x)=>{const t=limit((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const mixColor=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const neutralCloth=[.32,.30,.29];
const neutralSkin=[.64,.47,.37];
const channelSum=rgb=>Math.max(.08,rgb[0]+rgb[1]+rgb[2]);

function profile(stops,t){
  let i=1;while(i<stops.length-1&&t>stops[i][0])i++;
  const [a,x]=stops[i-1],[b,y]=stops[i];return lerp(x,y,smooth(a,b,t));
}
function frameAt(a,b,fallback) {
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,h=Math.hypot(dx,dy),d=Math.hypot(h,dz);
  if(h<.00005||d<.00005)return fallback||{x:1,y:0,fx:0,fy:0,fz:1};
  return {x:dy/h,y:-dx/h,fx:-dx/h*dz/d,fy:-dy/h*dz/d,fz:h/d};
}
function inPhoto(p,aspect,extra=0){return p.x>=-extra&&p.x<=1+extra&&p.y>=-extra&&p.y<=aspect+extra;}
// Clip the path, not the final vertex coordinates. A cropped elbow or hem ends in a real cap.
function interval(a,b,aspect){
  let lo=0,hi=1;
  for(const [v,delta,max] of [[a.x,b.x-a.x,1],[a.y,b.y-a.y,aspect]]){
    if(Math.abs(delta)<1e-8){if(v<0||v>max)return null;continue;}
    const c=-v/delta,d=(max-v)/delta;lo=Math.max(lo,Math.min(c,d));hi=Math.min(hi,Math.max(c,d));
  }
  return hi-lo>.0001?[lo,hi]:null;
}
function coverage(mask,aspect,x,y) {
  if(!mask?.data)return 1;
  if(x<0||x>1||y<0||y>aspect)return 0;
  const fx=x*(mask.width-1),fy=y/aspect*(mask.height-1),ix=Math.floor(fx),iy=Math.floor(fy),dx=fx-ix,dy=fy-iy;
  const row=iy*mask.width,below=Math.min(mask.height-1,iy+1)*mask.width,j=Math.min(mask.width-1,ix+1),data=mask.data;
  return lerp(lerp(data[row+ix],data[row+j],dx),lerp(data[below+ix],data[below+j],dx),dy)/255;
}
function estimateBound(x,y,axis,sign,guess,mask,aspect,fit){
  if(!fit||!mask||coverage(mask,aspect,x,y)<.42)return guess;
  // Stop on the first silhouette crossing. A neighbouring sleeve must not inflate the rib cage.
  const max=guess*1.36,steps=16;
  for(let i=1;i<=steps;i++){
    const r=max*i/steps,px=x+axis.x*r*sign,py=y+axis.y*r*sign;
    if(coverage(mask,aspect,px,py)<.43){
      const found=Math.max(guess*.24,r-max/steps*.48);
      return lerp(guess,found,fit);
    }
  }
  return lerp(guess,guess*1.15,fit);
}
function palette(sample,mask,aspect,center,axis,width,fallback){
  if(!sample)return fallback;
  const colors=[];
  for(const s of [-.38,-.19,0,.19,.38]){
    const x=center.x+axis.x*width*s,y=center.y+axis.y*width*s;
    if(!inPhoto({x,y},aspect)||coverage(mask,aspect,x,y)<.42)continue;
    const rgb=sample(x,y/aspect);if(rgb?.length===3&&Number.isFinite(rgb[0]+rgb[1]+rgb[2]))colors.push(rgb);
  }
  if(!colors.length)return fallback;
  return fallback.map((_,i)=>{const c=colors.map(v=>v[i]).sort((a,b)=>a-b);return c[c.length>>1];});
}
const torsoWidth=[[0,.255],[.028,.345],[.068,.69],[.115,.96],[.185,1.035],[.29,.98],[.46,.90],[.62,.82],[.78,.84],[.915,.90],[1,.86]];
const torsoDepth=[[0,.12],[.07,.24],[.22,.38],[.4,.415],[.64,.35],[.84,.375],[1,.33]];
const armWidth=[[0,.14],[.045,.68],[.12,1.02],[.24,1],[.41,.82],[.515,.68],[.57,.71],[.64,.76],[.79,.64],[.94,.44],[1,.43]];
const legWidth=[[0,.84],[.06,1.0],[.19,1],[.36,.85],[.5,.64],[.57,.67],[.68,.71],[.83,.53],[.98,.34],[1,.32]];
const fingerWidth=[[0,.90],[.12,1],[.34,.94],[.46,.97],[.57,.83],[.72,.86],[.87,.81],[.92,.79]];
function fingertip(t){
  if(t<=.92)return profile(fingerWidth,t);
  return .79*Math.sqrt(Math.max(.001,1-((t-.92)/.08)**2));
}
function padSilhouette(ctx,pw,ph,mask){
  if(!mask?.data||mask.width<5||mask.height<5)return;
  const mw=mask.width,mh=mask.height,n=mw*mh,rgba=ctx.getImageData(0,0,pw,ph),src=rgba.data.slice();
  const representative=new Int32Array(n);
  for(let y=0;y<mh;y++)for(let x=0;x<mw;x++)representative[y*mw+x]=4*(Math.min(ph-1,Math.floor((y+.5)*ph/mh))*pw+Math.min(pw-1,Math.floor((x+.5)*pw/mw)));
  function nearest(interior){
    const map=new Int32Array(n).fill(-1),queue=new Int32Array(n);let start=0,end=0;
    for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){
      const i=y*mw+x;let safe=true;
      for(const [dx,dy] of [[0,0],[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,1]]){
        const v=mask.data[limit(y+dy,0,mh-1)*mw+limit(x+dx,0,mw-1)];if(interior?v<222:v>29){safe=false;break;}
      }
      if(safe){map[i]=i;queue[end++]=i;}
    }
    while(start<end){
      const i=queue[start++],x=i%mw;
      for(const j of [x?i-1:-1,x+1<mw?i+1:-1,i-mw,i+mw]){
        if(j<0||j>=n||map[j]!==-1)continue;map[j]=map[i];queue[end++]=j;
      }
    }
    return map;
  }
  const fg=nearest(true),bg=nearest(false);if(fg[0]<0||bg[0]<0)return;
  for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){
    const mx=Math.min(mw-1,Math.floor(x*mw/pw)),my=Math.min(mh-1,Math.floor(y*mh/ph)),i=my*mw+mx;
    if(fg[i]===i)continue;
    const f=representative[fg[i]],b=representative[bg[i]],j=4*(y*pw+x),maskWeight=mask.data[i]/255;
    const foreground=Math.hypot(src[j]-src[f],src[j+1]-src[f+1],src[j+2]-src[f+2]);
    const background=Math.hypot(src[j]-src[b],src[j+1]-src[b+1],src[j+2]-src[b+2]);
    const containsBackground=smooth(14,72,foreground-background)*(1-smooth(48,112,background));
    const keep=smooth(.24,.84,maskWeight)*(1-containsBackground);
    for(let k=0;k<3;k++)rgba.data[j+k]=lerp(src[f+k],src[j+k],keep);
  }
  ctx.putImageData(rgba,0,0);
}
function sampleAtlas(photo,aspect,patches,sample,mask,crossed,body,span,hands,backCloth){
  if(!photo||!sample||typeof document==='undefined')return null;
  const w=photo.naturalWidth||photo.width,h=photo.naturalHeight||photo.height;
  if(!w||!h)return null;
  const scale=Math.min(1,1280/Math.max(w,h)),pw=Math.max(2,Math.round(w*scale)),ph=Math.max(2,Math.round(h*scale));
  const size=256,clothOffset=pw,swatchX=pw+(backCloth?3:2)*clothOffset+3;
  const canvas=document.createElement('canvas');canvas.width=swatchX+size+1;canvas.height=Math.max(2*size+4,ph);
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return null;ctx.drawImage(photo,0,0,pw,ph);padSilhouette(ctx,pw,ph,mask);
  if(hands.length){
    const picture=ctx.getImageData(0,0,pw,ph),pixels=picture.data;
    const index=(x,y)=>4*(limit(y,0,ph-1)*pw+limit(x,0,pw-1));
    for(const hand of hands){
      if(hand?.length!==21)continue;
      const palm=between(point(hand[0].x,hand[0].y*aspect),point(hand[9].x,hand[9].y*aspect),.66);
      const skin=sample(palm.x,palm.y/aspect),lum=channelSum(skin),tone=skin.map(c=>c/lum);
      const skinError=k=>{
        const sum=Math.max(22,pixels[k]+pixels[k+1]+pixels[k+2]);
        return Math.hypot(...tone.map((c,i)=>c-pixels[k+i]/sum));
      };
      const width=Math.hypot((hand[5].x-hand[17].x)*pw,(hand[5].y-hand[17].y)*ph);
      for(let finger=0;finger<5;finger++)for(let joint=0;joint<3;joint++){
        const base=1+4*finger+joint,a=hand[base],b=hand[base+1],x1=a.x*pw,y1=a.y*ph,dx=b.x*pw-x1,dy=b.y*ph-y1,den=dx*dx+dy*dy||1;
        const radius=Math.max(2,width*(finger===4?.16:.20));
        for(let y=limit(Math.floor(Math.min(y1,y1+dy)-radius),0,ph-1);y<=Math.min(ph-1,Math.max(y1,y1+dy)+radius);y++){
          for(let x=limit(Math.floor(Math.min(x1,x1+dx)-radius),0,pw-1);x<=Math.min(pw-1,Math.max(x1,x1+dx)+radius);x++){
            const t=limit(((x-x1)*dx+(y-y1)*dy)/den,0,1);
            if(Math.hypot(x-x1-t*dx,y-y1-t*dy)>radius)continue;
            const k=index(x,y),error=skinError(k),alpha=smooth(.078,.15,error);
            if(alpha<.002)continue;
            let donor=index(Math.round(palm.x*pw+(x%11)-5),Math.round(palm.y*pw+(y%11)-5));
            for(const f of [.75,.5,.25,0]){
              const q=index(Math.round(lerp(x1+t*dx,x,f)),Math.round(lerp(y1+t*dy,y,f)));
              if(skinError(q)<.065){donor=q;break;}
            }
            for(let c=0;c<3;c++)pixels[k+c]=lerp(pixels[k+c],pixels[donor+c],alpha);
          }
        }
      }
    }
    ctx.putImageData(picture,0,0);
  }
  {
    // A second projection reconstructs the sleeve behind crossed fingers. Keep the true hand photograph on the first plate.
    const cloth=ctx.getImageData(0,0,pw,ph),original=cloth.data.slice();
    for(const {hand,seed,width} of crossed){
      const points=hand.map(q=>({x:q.x*pw,y:q.y*ph}));
      const mark=document.createElement('canvas');mark.width=pw;mark.height=ph;
      const m=mark.getContext('2d'),radius=Math.max(2,width*pw*.17);
      m.strokeStyle=m.fillStyle='#fff';m.lineCap=m.lineJoin='round';
      m.beginPath();
      for(const [n,id] of [0,1,2,5,9,13,17].entries())m[n?'lineTo':'moveTo'](points[id].x,points[id].y);
      m.closePath();m.fill();m.lineWidth=2*radius;m.stroke();
      for(let f=0;f<5;f++){
        m.lineWidth=radius*[1.85,1.85,1.85,1.65,1.50][f];m.beginPath();
        for(let j=0;j<4;j++){const p=points[1+4*f+j];m[j?'lineTo':'moveTo'](p.x,p.y);}
        m.stroke();
      }
      const minX=limit(Math.floor(Math.min(...points.map(q=>q.x))-radius*2),0,pw-1),maxX=limit(Math.ceil(Math.max(...points.map(q=>q.x))+radius*2),0,pw-1);
      const minY=limit(Math.floor(Math.min(...points.map(q=>q.y))-radius*2),0,ph-1),maxY=limit(Math.ceil(Math.max(...points.map(q=>q.y))+radius*2),0,ph-1);
      const regionWidth=maxX-minX+1,regionHeight=maxY-minY+1,opacity=m.getImageData(minX,minY,regionWidth,regionHeight).data;
      const grainWidth=Math.max(3,width*pw*.54);
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const alpha=opacity[4*((y-minY)*regionWidth+x-minX)+3]/255;if(!alpha)continue;
        const sx=limit(Math.round(seed.x*pw+grainWidth*((x-minX)/regionWidth-.5)),0,pw-1),sy=limit(Math.round(seed.y/aspect*ph+grainWidth*((y-minY)/regionHeight-.5)),0,ph-1);
        const from=4*(sy*pw+sx),to=4*(y*pw+x);for(let k=0;k<3;k++)cloth.data[to+k]=lerp(cloth.data[to+k],original[from+k],alpha);
      }
    }
    // A raised forearm can hide its own sleeve in the source image. Grow nearby
    // visible shirt texels into that zone on the shirt plate only.
    for(const [shoulder,elbow,wrist] of [[11,13,15],[12,14,16]]){
      const a=body[shoulder],b=body[elbow],c=body[wrist];if(!a||!b||!c)continue;
      const distance=(x,y,p,q)=>{
        const dx=q.x-p.x,dy=q.y-p.y,t=limit(((x-p.x)*dx+(y-p.y)*dy)/Math.max(1e-8,dx*dx+dy*dy),0,1);
        return Math.hypot(x-p.x-t*dx,y-p.y-t*dy);
      };
      const mid=between(a,b,.5),loX=limit(Math.floor((Math.min(a.x,b.x)-span*.47)*pw),0,pw-1),hiX=limit(Math.ceil((Math.max(a.x,b.x)+span*.47)*pw),0,pw-1);
      const loY=limit(Math.floor((Math.min(a.y,b.y)-span*.27)*pw),0,ph-1),hiY=limit(Math.ceil((Math.max(a.y,b.y)+span*.28)*pw),0,ph-1);
      const w=hiX-loX+1,h=hiY-loY+1,n=w*h,nearest=new Int32Array(n).fill(-1),queue=new Int32Array(n),fill=new Uint8Array(n);let end=0;
      const foreRadius=span*.14;
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        const x=(i+loX+.5)/pw,y=(j+loY+.5)/pw,k=j*w+i,fore=distance(x,y,b,c),arm=distance(x,y,a,b);
        const overlap=1-smooth(foreRadius*.76,foreRadius*1.19,fore);
        const near=1-smooth(span*.165,span*.27,arm);
        const matte=coverage(mask,aspect,x,y);
        const behind=smooth(span*.12,span*.36,Math.hypot(x-b.x,y-b.y));
        fill[k]=Math.round(255*near*Math.max(overlap*behind,1-smooth(.18,.80,matte)));
        if(fore>foreRadius*1.15&&arm<span*.245&&matte>.88&&Math.hypot(x-mid.x,y-mid.y)<span*.71){nearest[k]=k;queue[end++]=k;}
      }
      for(let start=0;start<end;start++){
        const k=queue[start],x=k%w;
        for(const j of [x?k-1:-1,x<w-1?k+1:-1,k-w,k+w]){
          if(j<0||j>=n||nearest[j]>=0)continue;nearest[j]=nearest[k];queue[end++]=j;
        }
      }
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        const k=j*w+i,from=nearest[k];if(!fill[k]||from<0)continue;
        const dx=i-from%w,dy=j-Math.floor(from/w);
        // Reflect the hidden texel across the visible border to preserve the knit or skin grain.
        const fx=limit(Math.round(from%w-dx*.68),0,w-1),fy=limit(Math.round(Math.floor(from/w)-dy*.68),0,h-1);
        const donor=nearest[fy*w+fx],u=donor%w,v=Math.floor(donor/w);
        const src=4*((v+loY)*pw+u+loX),dst=4*((j+loY)*pw+i+loX);
        for(let d=0;d<3;d++)cloth.data[dst+d]=lerp(cloth.data[dst+d],original[src+d],fill[k]/255);
      }
    }
    const torso=ctx.createImageData(pw,ph);torso.data.set(cloth.data);
    if(body[11]&&body[12]){
      const source=cloth.data,top=between(body[11],body[12],.5);
      const hip=body[23]&&body[24]?between(body[23],body[24],.5):point(top.x,top.y+span*1.3);
      for(let y=0;y<ph;y++){
        const level=(y+.5)/pw,below=(level-top.y)/span;
        if(below<.10)continue;
        const center=lerp(top.x,hip.x,limit((level-top.y)/Math.max(span*.6,hip.y-top.y),0,1));
        for(const sign of [-1,1]){
          const edge=span*lerp(.397,.33,smooth(.05,1.15,below)),border=span*.063;
          for(let x=Math.max(0,Math.floor((center+(sign<0?-span*.95:edge-border))*pw));x<Math.min(pw,(center+(sign<0?-edge+border:span*.95))*pw);x++){
            const d=sign*((x+.5)/pw-center),blend=smooth(edge-border,edge+border,d)*smooth(.10,.27,below);
            if(blend<.001)continue;
            const inward=edge-border-Math.abs(d-edge)*.43;
            const donor=limit(Math.round((center+sign*Math.max(edge*.32,inward))*pw),0,pw-1);
            const k=4*(y*pw+x),q=4*(y*pw+donor);
            for(let c=0;c<3;c++)torso.data[k+c]=lerp(source[k+c],source[q+c],blend);
          }
        }
      }
    }
    ctx.putImageData(torso,2*clothOffset,0);
    ctx.putImageData(cloth,clothOffset,0);
  }
  patches.forEach(({p,r,tint},i)=>{
    // Extract the small-scale fabric grain, leaving directional shadows and the original front print behind.
    const source=document.createElement('canvas');source.width=source.height=64;
    const sc=source.getContext('2d',{willReadFrequently:true});
    const extent=Math.max(4,Math.min(Math.min(w,h)*.19,w*r));
    sc.drawImage(photo,limit(p.x*w-extent/2,0,Math.max(0,w-extent)),limit(p.y*w-extent/2,0,Math.max(0,h-extent)),extent,extent,0,0,64,64);
    const data=sc.getImageData(0,0,64,64).data,lum=new Float32Array(4096);
    for(let j=0;j<lum.length;j++)lum[j]=(data[j*4]*.22+data[j*4+1]*.69+data[j*4+2]*.09)/255;
    const grain=new Float32Array(4096);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      let mean=0,n=0;for(let yy=Math.max(0,y-4);yy<=Math.min(63,y+4);yy+=2)for(let xx=Math.max(0,x-4);xx<=Math.min(63,x+4);xx+=2){mean+=lum[yy*64+xx];n++;}
      grain[y*64+x]=limit((lum[y*64+x]-mean/n)/Math.max(.10,mean/n),-.30,.30);
    }
    const patch=ctx.createImageData(size,size),mirror=n=>n%128<64?n%128:127-n%128;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const idx=(y*size+x)*4,detail=grain[mirror(y)*64+mirror(x)],fine=grain[mirror(2*y+17)*64+mirror(2*x+37)];
      for(let j=0;j<3;j++)patch.data[idx+j]=Math.round(255*limit(tint[j]*(1+(detail*.60+fine*.18)*smooth(8,34,extent)),0,1));patch.data[idx+3]=255;
    }
    ctx.putImageData(patch,swatchX,i*(size+2));
  });
  let backConfidence=null;
  if(backCloth){
    const layer=document.createElement('canvas');layer.width=pw;layer.height=ph;
    const rear=layer.getContext('2d',{willReadFrequently:true});rear.drawImage(backCloth,0,0,pw,ph);
    const alpha=rear.getImageData(0,0,pw,ph).data;
    backConfidence=(x,y)=>alpha[4*(Math.round(limit(y/aspect,0,1)*(ph-1))*pw+Math.round(limit(x,0,1)*(pw-1)))+3]/255;
    ctx.fillStyle='rgb('+patches[0].tint.map(c=>Math.round(c*255)).join(',')+')';ctx.fillRect(pw*3,0,pw,ph);
    ctx.drawImage(layer,pw*3,0);
  }
  return {canvas,backConfidence,plateOffset:clothOffset/canvas.width,front:(x,y,cloth=false)=>[(limit(x,.5/pw,1-.5/pw)*pw+(cloth?clothOffset:0))/canvas.width,limit(y/aspect,.5/ph,1-.5/ph)*ph/canvas.height],
    rear:(k,u,v)=>[(swatchX+1+limit(u,0,1)*(size-3))/canvas.width,(k*(size+2)+1+limit(v,0,1)*(size-3))/canvas.height]};
}

export function buildFigure3D({photo,aspect,face,hands=[],pose,mask=pose?.mask,sample,head,references}={}){
  if(!(aspect>0&&Number.isFinite(aspect)))return null;
  const facePoints=face?.landmarks||[],joints=pose?.landmarks||[],rawHands=hands.map(h=>h?.landmarks||h||[]);
  const faceAt=i=>valid(facePoints[i])?point(facePoints[i].x,facePoints[i].y*aspect):null;
  let chin=faceAt(152);const leftCheek=faceAt(234),rightCheek=faceAt(454);
  const faceWidth=leftCheek&&rightCheek?length(leftCheek,rightCheek):0;
  const sideConfidence=(id,threshold=.33)=>valid(joints[id])&&(joints[id].visibility??1)>threshold;
  const shoulders=sideConfidence(11)&&sideConfidence(12);
  const insideHand=rawHands.some(h=>h.length===21&&h.every(valid));
  if(!shoulders&&(!chin||!faceWidth)&&!insideHand)return null;
  const body=joints.map(p=>valid(p)?point(p.x,p.y*aspect):null);
  const span=shoulders?limit(Math.max(length(body[11],body[12]),faceWidth*1.64),.018,1.32):limit(faceWidth*2.18,.045,1.26);
  if(!chin&&shoulders&&sideConfidence(7,.32)&&sideConfidence(8,.32)){
    const ears=between(body[7],body[8],.5),s=between(body[11],body[12],.5);
    chin=between(ears,s,.27);
  }
  const shoulderZ=shoulders?((joints[11].z||0)+(joints[12].z||0))*.5:0;
  for(let i=0;i<body.length;i++)if(body[i])body[i].z=-span*.155+limit((shoulderZ-(joints[i].z||0))*.39,-span*.34,span*.52);
  const rest=[],now=[],drivers=[],sweeps=[],positions=[],uv=[],colors=[],weights=[],plates=[],indices=[];
  const add=(p,fn)=>{const id=rest.length;rest.push(p);now.push({...p});drivers.push(fn);return id;};
  const fixed=p=>add(p,null);
  const bodyIndex=body.map((p,i)=>p?add(p,(frame,out)=>{
    const q=frame.body?.[i];if(valid(q)){out.x+=q.x-joints[i].x;out.y+=(q.y-joints[i].y)*aspect;if(Number.isFinite(q.dz))out.z+=limit(q.dz,-2*span,2*span);}
  }):-1);
  // References are evaluated in creation order; compound anchors inherit the joints' actual motion.
  function blendIndex(a,b,t){
    return add(between(rest[a],rest[b],t),(_,out)=>{const p=now[a],q=now[b];out.x=lerp(p.x,q.x,t);out.y=lerp(p.y,q.y,t);out.z=lerp(p.z,q.z,t);});
  }
  function attach(p,a,b){
    const start=rest[a],axis=frameAt(start,rest[b]),side=(p.x-start.x)*axis.x+(p.y-start.y)*axis.y;
    const along=(p.x-start.x)*(-axis.y)+(p.y-start.y)*axis.x,dz=p.z-start.z;
    return add(p,(_,out)=>{const aa=now[a],ab=frameAt(aa,now[b],axis);out.x=aa.x+ab.x*side-ab.y*along;out.y=aa.y+ab.y*side+ab.x*along;out.z=aa.z+dz;});
  }
  let atlas=null,neckAttachment=null;
  const shouldersToJoin=new Map(),bridges=[],clavicles=[];
  function roundedJoints(ids,radius){
    if(ids.length<3)return ids;
    const path=[ids[0]];
    for(let i=1;i<ids.length-1;i++){
      const a=ids[i-1],b=ids[i],c=ids[i+1],ab=length(rest[a],rest[b]),bc=length(rest[b],rest[c]);
      if(ab<.001||bc<.001){path.push(b);continue;}
      const left=blendIndex(b,a,Math.min(.36,radius/ab)),right=blendIndex(b,c,Math.min(.36,radius/bc));
      path.push(left);
      for(const t of [.25,.5,.75])path.push(blendIndex(blendIndex(left,b,t),blendIndex(b,right,t),t));
      path.push(right);
    }
    path.push(ids.at(-1));return path;
  }
  function addVertex(p,c,w,tex=atlas?.front(p.x,p.y),plate=0){
    const id=positions.length/3;
    positions.push(p.x,p.y,p.z);uv.push(...(tex||[limit(p.x,0,1),limit(p.y/aspect,0,1)]));colors.push(...c);weights.push(w);plates.push(plate);
    return id;
  }
  const handsInFront=[];
  for(const raw of rawHands){
    if(raw?.length!==21||!raw.every(valid))continue;
    const p=raw.map(v=>point(v.x,v.y*aspect)),width=length(p[5],p[17]);
    if(width<.003)continue;
    function segment(a,b,r){
      const dx=b.x-a.x,dy=b.y-a.y;handsInFront.push({a,dx,dy,d:Math.max(.000001,dx*dx+dy*dy),r});
    }
    const middle=between(p[5],p[17],.5);
    segment(between(p[0],middle,.26),between(p[0],middle,.87),width*.46);
    for(let f=0;f<5;f++)for(let j=0;j<3;j++){const i=1+4*f+j;segment(p[i],p[i+1],width*[.142,.127,.125,.112,.09][f]);}
  }
  function visibleFabric(p){
    let keep=1;
    for(const h of handsInFront){
      const k=limit(((p.x-h.a.x)*h.dx+(p.y-h.a.y)*h.dy)/h.d,0,1),d=Math.hypot(p.x-h.a.x-h.dx*k,p.y-h.a.y-h.dy*k);
      keep=Math.min(keep,smooth(h.r*.73,h.r*1.18,d));if(!keep)return 0;
    }
    return keep;
  }
  // Sweep centreline samples around anatomical cross-sections. Each mesh is independently closed.
  // Rigid cross-sections turn with their live tangent, including finger knuckles, instead of stretching a sheet.
  function tube(ids,shape,{segments=20,sides=24,fit=.65,color=neutralCloth,texture=1,material=1,interior=null,surface="limb",tilt=null,armSide=null,torsoSockets=null,neckLength=0,neckJoin=null,openStart=null,openEnd=null,thumbSocket=null,extendBelow=false}={}){
    if(ids.length<2)return;
    const lengths=[0];for(let i=1;i<ids.length;i++)lengths.push(lengths.at(-1)+length(rest[ids[i-1]],rest[ids[i]]));
    const total=lengths.at(-1);if(total<.0015)return;
    const pieces=[];let rings=null;
    for(let i=1;i<ids.length;i++){
      const a=ids[i-1],b=ids[i],bounds=interval(rest[a],rest[b],extendBelow?aspect+span*.73:aspect);
      if(!bounds){rings=null;continue;}
      const [lo,hi]=bounds;
      if(!rings||lo>.001){rings=[];pieces.push(rings);}
      const n=Math.max(2,Math.ceil(segments*(lengths[i]-lengths[i-1])/total*(hi-lo)));
      for(let j=rings.length?1:0;j<=n;j++){
        const f=lerp(lo,hi,j/n),t=lerp(lengths[i-1],lengths[i],f)/total;
        rings.push({a,b,f,t,c:between(rest[a],rest[b],f),live:point(0,0),...shape(t)});
      }
      if(hi<.999)rings=null;
    }
    for(const rows of pieces){
      if(rows.length<2)continue;
      for(let j=0;j<rows.length;j++){
        const r=rows[j];r.axis=frameAt(rows[Math.max(0,j-1)].c,rows[Math.min(rows.length-1,j+1)].c);
        r.left=estimateBound(r.c.x,r.c.y,r.axis,-1,r.rx,mask,aspect,fit);
        r.right=estimateBound(r.c.x,r.c.y,r.axis,1,r.rx,mask,aspect,fit);
        r.tint=palette(sample,mask,aspect,r.c,r.axis,r.rx,color);
        r.slope=tilt?tilt(r):0;
        r.fabric=surface==="cloth"||surface==="arm";r.clear=!r.fabric||visibleFabric(r.c)>.92;
      }
      for(const row of rows){
        if(!row.fabric)continue;
        const nearest=rows.filter(r=>r.clear).sort((a,b)=>Math.abs(a.t-row.t)-Math.abs(b.t-row.t))[0];
        row.under=nearest?mixColor(color,nearest.tint,.79):color;
      }
      // Filter mask sampling noise longitudinally without flattening joints or hems.
      const measured=rows.map(r=>[r.left,r.right]);
      const dyed=rows.map((r,i)=>{
        const rgb=[0,0,0];let sum=0;
        for(let j=0;j<rows.length;j++){const distance=Math.abs(r.t-rows[j].t);if(distance>.19)continue;
          const k=Math.exp(-((distance/.095)**2));for(let c=0;c<3;c++)rgb[c]+=rows[j].tint[c]*k;sum+=k;}
        return rgb.map(v=>v/sum);
      });
      rows.forEach((r,i)=>{
        r.rear=surface==='cloth'?mixColor(color,dyed[i],.06):(surface==='skin'||surface==='palm')?mixColor(color,dyed[i],.13):mixColor(dyed[i],r.tint,.08);
      });
      rows.forEach((r,i)=>{if(i===0||i===rows.length-1)return;
        for(const [k,j] of [['left',0],['right',1]])r[k]=.22*measured[i-1][j]+.56*measured[i][j]+.22*measured[i+1][j];
      });
      function emit(r,scale){
        const start=positions.length/3,offset=[];
        for(let k=0;k<sides;k++){
          const theta=Math.PI*2*k/sides,co=Math.cos(theta),sn=Math.sin(theta);
          const lateral=(co<0?r.left:r.right)*co*scale;
          let deep=r.rz*sn*scale;
          if(surface==='palm'&&sn<0){
            const ridge=(.5+.5*Math.cos((co+.12)*Math.PI*4))**2;
            deep*=1+.19*ridge*smooth(.12,.51,r.t)*(1-smooth(.9,1,r.t));
          }
          if(surface==='cloth'&&sn<0){
            const blades=Math.exp(-(((Math.abs(co)-.49)/.32)**2)-(((r.t-.29)/.17)**2));
            const groove=Math.exp(-((co/.15)**2))*(1-smooth(.65,.95,r.t));
            deep*=1+.11*blades-.056*groove;
          }
          const skew=lateral*r.slope;
          const p=point(r.c.x+r.axis.x*lateral+r.axis.fx*deep,r.c.y+r.axis.y*lateral+r.axis.fy*deep,r.c.z+r.axis.fz*deep+skew);
          const cov=coverage(mask,aspect,p.x,p.y);
          let w=inPhoto(p,aspect)?smooth(.05,.60,sn)*smooth(.25,.80,cov)*texture*(interior?interior(p,r):1):0;
          if(scale!==1)w=0;
          if(w>.001&&Math.abs(co)>.71&&sample){
            const rgb=sample(limit(p.x,0,1),limit(p.y/aspect,0,1));
            const distance=Math.hypot(rgb[0]-r.tint[0],rgb[1]-r.tint[1],rgb[2]-r.tint[2]);
            w*=1-smooth(.30,.64,distance)*smooth(.71,.92,Math.abs(co));
          }
          const cleaned=surface==='cloth'||surface==='arm'&&r.t<.51;
          let plate=surface==='cloth'?2:surface==='arm'?1-smooth(.43,.56,r.t):0;
          const clear=r.fabric&&sn>.01&&!cleaned?visibleFabric(p):1;w*=clear;
          let sx=p.x,sy=p.y;
          if(surface==='skin'){
            sx=lerp(r.c.x,p.x,.68);sy=lerp(r.c.y,p.y,.68);
            if(sample){
              const rgb=sample(limit(sx,0,1),limit(sy/aspect,0,1)),l=rgb.reduce((a,b)=>a+b,0),l2=channelSum(color);
              const d=Math.hypot(...rgb.map((c,i)=>c/Math.max(.08,l)-color[i]/l2));
              const retract=smooth(.07,.18,d);sx=lerp(sx,r.c.x,retract);sy=lerp(sy,r.c.y,retract);
            }
          }
          let tex=atlas?.front(sx,sy);
          // A zero-weight meridian on both sides separates the source projection from the rear swatch.
          // Its width is one complete polygon, so a triangle never interpolates UVs across atlas regions.
          if(atlas&&sn<-.001&&!cleaned&&surface!=="skin"&&surface!=="palm"&&surface!=="arm"){
            const border=Math.sin(2*Math.PI/sides)+.004;
            const skinDist=Math.hypot(...r.rear.map((v,i)=>v-tintSkin[i])),clothDist=Math.hypot(...r.rear.map((v,i)=>v-tintCloth[i]));
            const skin=surface==='skin'||surface==='palm'||surface!=='cloth'&&skinDist<clothDist,matched=skin?skinDist:clothDist;
            w=scale===1?smooth(border,Math.min(.97,border+.31),-sn)*limit(1-matched*3.0,0,.87):0;
            tex=atlas.rear(skin?1:0,(theta-Math.PI)/Math.PI,r.t);
          }
          let tint=mixColor(r.rear,mixColor(color,r.tint,material),smooth(.1,.7,sn));
          if(cleaned){
            // All vertices around the armholes use the same projected atlas. Atlas islands
            // on opposite sides of a shared triangle produce visible rectangular stripes.
            const u=surface==='cloth'&&neckLength?limit(r.t*total/neckLength,0,1):1;
            const skin=surface==='cloth'?1-smooth(.62,1.0,u):0;
            tint=mixColor(tintCloth,tintSkin,skin);
            w=scale===1?smooth(-.19,.31,sn)*texture*(interior?interior(p,r):1):0;
          }
          if(surface==="skin"||surface==="palm"){
            w=smooth(-.02,.45,sn)*texture;
            tint=mixColor(color,r.tint,.24);
          }
          if(surface==="arm"){
            const chroma=c=>c.map(v=>v/channelSum(c));
            const error=(c,k)=>Math.hypot(...chroma(c).map((v,i)=>v-chroma(k)[i]));
            const skin=1-smooth(-.035,.035,error(r.tint,tintSkin)-error(r.tint,tintCloth));
            const base=mixColor(tintCloth,tintSkin,skin);
            tint=mixColor(base,r.tint,.26*(1-smooth(.065,.16,error(r.tint,base))));
            if(sample){
              const rgb=sample(limit(sx,0,1),limit(sy/aspect,0,1));
              const foreign=smooth(.074,.17,error(rgb,base))*(1-smooth(.35,.68,sn));
              w*=1-foreign;
            }
          }
          if((surface==='cloth'||surface==='arm'&&r.t<.39)&&scale===1&&sn<0&&atlas?.backConfidence){
            const confidence=atlas.backConfidence(sx,sy)*smooth(.03,.48,-sn);
            if(confidence>0){plate=3;w=Math.max(w,confidence);}
          }
          if(clear<1)tint=mixColor(r.under,tint,clear);
          if(r.nail&&sn<0){
            const nail= r.nail*smooth(.35,.90,-sn);tint=mixColor(tint,mixColor(color,[.945,.74,.70],.34),nail*.75);w*=1-nail*.78;
          }
          if(surface==='skin'&&scale!==1){w=0;tint=color;}
          if((surface==='skin'||surface==='palm'||surface==='arm')&&extendBelow&&!inPhoto(p,aspect)){
            const warm=.96+.033*sn+.018*Math.cos(theta*3);
            tint=tintSkin.map((v,d)=>limit(v*warm+(d===0?.009:0),0,1));
            if(r.nail&&sn<0)tint=mixColor(tint,[.92,.79,.80],r.nail*smooth(.25,.8,-sn)*.72);
            w=0;
          }
          addVertex(p,tint,w,tex,plate);offset.push(lateral,deep,skew);
        }
        if(!r.bands)r.bands=[];r.bands.push({start,offset});return start;
      }
      function zip(a,b,reverse=false){
        for(let k=0;k<sides;k++){const n=(k+1)%sides;if(reverse)indices.push(a+k,a+n,b+k,a+n,b+n,b+k);
          else indices.push(a+k,b+k,a+n,a+n,b+k,b+n);}
      }
      const shell=rows.map(r=>emit(r,1));
      if(torsoSockets){
        for(const [id,center] of torsoSockets){
          const side=Math.sign(center.x-rest[shoulder].x),moved=[];
          for(let j=0;j<rows.length;j++)for(let k=0;k<sides;k++){
            const v=shell[j]+k,x=side*(positions[3*v]-rest[shoulder].x)/span,y=(positions[3*v+1]-center.y)/span;
            const w=smooth(.13,.53,x)*(1-smooth(.035,.39,Math.abs(y+.04)));
            if(w>.002)moved.push([v,w]);
          }
          clavicles.push({id,moved});
        }
      }
      const holes=[];
      const firstOpen=openStart&&rows[0].t<.0001,lastOpen=openEnd&&rows.at(-1).t>.9999;
      if(firstOpen)openStart.loop=Array.from({length:sides},(_,k)=>shell[0]+k);
      if(lastOpen)openEnd.loop=Array.from({length:sides},(_,k)=>shell.at(-1)+k);
      if(thumbSocket){
        const j0=rows.findIndex(r=>r.t>.32),j1=rows.findIndex(r=>r.t>.78);
        if(j0>0&&j1>j0+1){
          const half=4,mid=rows[j0],finger=thumbSocket.position;
          const far=(finger.x-mid.c.x)*mid.axis.x+(finger.y-mid.c.y)*mid.axis.y>0?0:sides/2;
          const at=(j,k)=>shell[j]+(k+sides)%sides,loop=[];
          for(let k=-half;k<half;k++)loop.push(at(j0,far+k));
          for(let j=j0;j<j1;j++)loop.push(at(j,far+half));
          for(let k=half;k>-half;k--)loop.push(at(j1,far+k));
          for(let j=j1;j>j0;j--)loop.push(at(j,far-half));
          holes.push({j0,j1,far,half});thumbSocket.loop=loop;
        }
      }
      if(torsoSockets){
        const rowAt=y=>rows.reduce((best,r,i)=>Math.abs(r.c.y-y)<Math.abs(rows[best].c.y-y)?i:best,0);
        for(const [id,center] of torsoSockets){
          const j0=Math.max(1,rowAt(center.y-span*.095)),j1=Math.min(rows.length-2,rowAt(center.y+span*.23));
          if(j1<=j0+1)continue;
          const half=6,far=(center.x-rows[j0].c.x)*rows[j0].axis.x>=0?0:sides/2;
          const vertex=(j,k)=>shell[j]+(k+sides)%sides,loop=[],outside=[];
          function boundary(j,k,dj,dk){loop.push(vertex(j,k));outside.push(vertex(j+dj,k+dk));}
          for(let k=-half;k<half;k++)boundary(j0,far+k,-1,0);
          for(let j=j0;j<j1;j++)boundary(j,far+half,0,1);
          for(let k=half;k>-half;k--)boundary(j1,far+k,1,0);
          for(let j=j1;j>j0;j--)boundary(j,far-half,0,-1);
          const hole={j0,j1,far,half,loop,outside};holes.push(hole);shouldersToJoin.set(id,hole);
        }
      }
      for(let j=1;j<shell.length;j++){
        if(!holes.some(h=>j>h.j0&&j<=h.j1)){zip(shell[j-1],shell[j]);continue;}
        for(let k=0;k<sides;k++){
          if(holes.some(h=>j>h.j0&&j<=h.j1&&(k-h.far+h.half+sides)%sides<2*h.half))continue;
          const a=shell[j-1],b=shell[j],n=(k+1)%sides;indices.push(a+k,b+k,a+n,a+n,b+k,b+n);
        }
      }
      const socket=shouldersToJoin.get(armSide);
      if(socket&&rows[0].t<.0001)sewShoulder(socket,shell[0],shell[1],sides);
      if(neckJoin&&rows[0].t<.0001){
        // Match the skull seam in position and winding. Both parts keep their own material.
        neckAttachment={source:head,ring:neckJoin,body:shell[0],rows:[]};
        for(let j=0;j<rows.length;j++){
          const influence=1-smooth(0,neckLength,rows[j].t*total);
          if(!influence)break;
          neckAttachment.rows.push({start:shell[j],influence});
        }
      }
      for(const first of [true,false]){
        if((first&&firstOpen)||(!first&&lastOpen)||first&&((socket&&rows[0].t<.0001)||(neckJoin&&neckAttachment)))continue;
        const r=first?rows[0]:rows.at(-1);let outer=first?shell[0]:shell.at(-1);
        for(const scale of [.65,.30]){const next=emit(r,scale);zip(outer,next,first);outer=next;}
        const center=addVertex(r.c,surface==='skin'?color:r.tint,0);r.cap=center;
        for(let k=0;k<sides;k++){const next=(k+1)%sides;if(first)indices.push(outer+k,outer+next,center);else indices.push(outer+k,center,outer+next);}
      }
      sweeps.push(rows);
    }
  }
  function sewShoulder(socket,start,next,count){
    const {loop,outside}=socket;
    const xyz=(i,d)=>positions[3*i+d];
    let shift=0,minimum=Infinity;
    for(let s=0;s<count;s++){
      let cost=0;
      for(let k=0;k<count;k++)for(let d=0;d<3;d++)cost+=(xyz(loop[k],d)-xyz(start+(k+s)%count,d))**2;
      if(cost<minimum){minimum=cost;shift=s;}
    }
    let prev=loop;
    for(let j=1;j<=7;j++){
      const t=j/7,row=[];
      for(let k=0;k<count;k++){
        const a=loop[k],ao=outside[k],b=start+(k+shift)%count,bo=next+(k+shift)%count;
        if(j===7){row.push(b);continue;}
        const control=(src,dst)=>Math.hypot(...[0,1,2].map(d=>xyz(src,d)-xyz(dst,d)));
        const chord=control(a,b),ka=Math.min(9,.48*chord/Math.max(.0002,control(a,ao))),kb=Math.min(14,.33*chord/Math.max(.0002,control(b,bo)));
        const A=(1-t)**2*(1+2*t),B=t*t*(3-2*t),aa=3*(1-t)**2*t*ka,bb=3*(1-t)*t*t*kb;
        const ids=[a,ao,b,bo],coeff=[A+aa,-aa,B+bb,-bb];
        const co=[0,1,2].map(d=>ids.reduce((r,id,n)=>r+coeff[n]*xyz(id,d),0));
        const p=point(...co),tint=colors.slice(3*a,3*a+3).map((c,d)=>lerp(c,colors[3*b+d],t));
        // Keep rear-swatch UVs out of triangles carrying the camera projection.
        const w=lerp(weights[a],weights[b],t);
        const id=addVertex(p,tint,w,atlas?.front(p.x,p.y),1);
        row.push(id);bridges.push({id,ids,coeff});
      }
      for(let k=0;k<count;k++){const n=(k+1)%count;indices.push(prev[k],row[k],prev[n],prev[n],row[k],row[n]);}
      prev=row;
    }
  }
  let shoulder=null,hips=null,headAxis=null,shoulderPair=null,hipPair=null;
  if(shoulders){
    shoulderPair=[bodyIndex[11],bodyIndex[12]];shoulder=blendIndex(...shoulderPair,.5);
  }else if(chin&&faceWidth&&chin.y<aspect+.025){
    const forehead=faceAt(10)||point(chin.x,chin.y-faceWidth),h=Math.max(.01,length(forehead,chin));
    const down=point((chin.x-forehead.x)/h,(chin.y-forehead.y)/h),c=point(chin.x+down.x*faceWidth*.57,chin.y+down.y*faceWidth*.57,-span*.16);
    const right=point(down.y,-down.x);
    shoulderPair=[fixed(point(c.x+right.x*span*.5,c.y+right.y*span*.5,c.z)),fixed(point(c.x-right.x*span*.5,c.y-right.y*span*.5,c.z))];
    shoulder=blendIndex(...shoulderPair,.5);
    headAxis=down;
  }
  const maskAt=(p)=>coverage(mask,aspect,p.x,p.y);
  const observedPalm=rawHands.find(h=>h?.length===21&&valid(h[0])&&valid(h[9]));
  const skinPatch=observedPalm?between(point(observedPalm[0].x,observedPalm[0].y*aspect),point(observedPalm[9].x,observedPalm[9].y*aspect),.67):null;
  const cheek=faceAt(205)||faceAt(1)||skinPatch||(sideConfidence(15,.7)&&inPhoto(body[15],aspect)?body[15]:null);
  const skinSource=references&&skinPatch?skinPatch:cheek;
  const tintSkin=skinSource?palette(sample,null,aspect,skinSource,{x:1,y:0},Math.max(.008,faceWidth*.115),neutralSkin):neutralSkin;
  const tintCloth=shoulder!=null?palette(sample,mask,aspect,point(rest[shoulder].x,rest[shoulder].y+span*.38),{x:1,y:0},span*.4,neutralCloth):neutralCloth;
  const handSlots=new Map(),usedHands=new Set();
  // Match each detected palm to a shoulder chain, by wrist position rather than a handedness label.
  const candidates=[];
  for(let h=0;h<rawHands.length;h++){
    const hand=rawHands[h];if(hand.length!==21||!hand.every(valid))continue;
    for(const i of [15,16])if(body[i])candidates.push({h,i,d:length(body[i],point(hand[0].x,hand[0].y*aspect))});
  }
  candidates.sort((a,b)=>a.d-b.d);
  for(const {h,i,d} of candidates)if(d<Math.max(.045,span*.68)&&!handSlots.has(i)&&!usedHands.has(h)){handSlots.set(i,h);usedHands.add(h);}

  // Fold a crossed hand onto the opposite upper sleeve when the photographed palm covers it.
  const crossed=new Map();
  for(const [wrist,h] of handSlots){
    const other=wrist===15?12:11,end=other+2;
    if(!sideConfidence(other)||!sideConfidence(end))continue;
    const raw=rawHands[h],mid=between(point(raw[5].x,raw[5].y*aspect),point(raw[17].x,raw[17].y*aspect),.5);
    const a=body[other],b=body[end],dx=b.x-a.x,dy=b.y-a.y,t=limit(((mid.x-a.x)*dx+(mid.y-a.y)*dy)/Math.max(.00001,dx*dx+dy*dy),0,1);
    if(length(mid,between(a,b,t))<span*.26){
      // On folded arms the Pose elbow can land on the cuff of the covering arm. Seat it below the wrists
      // if both upper arms hang down and the other wrist is visibly crossed toward the opposite shoulder.
      const otherWrist=31-wrist,ownElbow=wrist-2,ownShoulder=wrist-4;
      if(sideConfidence(otherWrist,.45)&&sideConfidence(ownElbow,.45)&&sideConfidence(ownShoulder,.65)&&
        (body[otherWrist].x-a.x)*(body[ownShoulder].x-a.x)>span*span*.30&&
        body[ownElbow].y-body[ownShoulder].y>span*.41&&b.y-a.y>span*.41){
        const targetY=(raw[0].y*aspect+body[otherWrist].y)*.5+span*.19;
        for(const e of [end,ownElbow])body[e].y+=limit(targetY-body[e].y,0,span*.21);
      }
      const sleeveDepth=p=>{
        const vx=b.x-a.x,vy=b.y-a.y,t=limit(((p.x-a.x)*vx+(p.y-a.y)*vy)/Math.max(.00001,vx*vx+vy*vy),0,1);
        const center=between(a,b,t),radius=span*.145;
        return center.z+span*.022+radius*.89*Math.sqrt(Math.max(.04,1-(length(p,center)/radius)**2));
      };
      const root=point(raw[0].x,raw[0].y*aspect);
      body[wrist].z=sleeveDepth(root);
      crossed.set(h,{sleeveDepth,hand:raw,seed:between(a,b,.31),width:length(point(raw[5].x,raw[5].y*aspect),point(raw[17].x,raw[17].y*aspect))});
    }
  }
  if(shoulder!=null||cheek){
    const chest=shoulder!=null?point(rest[shoulder].x,Math.min(aspect*.95,rest[shoulder].y+span*.38)):point(.5,aspect*.68);
    let swatch=chest,score=Infinity;
    if(sample)for(const dx of [.27,-.27,.19,-.19]){
      const p=point(chest.x+dx*span,chest.y);if(!inPhoto(p,aspect)||maskAt(p)<.75||visibleFabric(p)<.9)continue;
      const center=sample(p.x,p.y/aspect);
      let difference=Math.hypot(...center.map((v,i)=>v-tintCloth[i]));
      for(const d of [-.05,.05]){const edge=sample(limit(p.x+d*span,0,1),p.y/aspect);difference+=.5*Math.hypot(...edge.map((v,i)=>v-center[i]));}
      if(difference<score){score=difference;swatch=p;}
    }
    atlas=sampleAtlas(photo,aspect,[{p:swatch,r:span*.14,tint:tintCloth},{p:cheek||chest,r:Math.max(.003,(faceWidth||span*.24)*.14),tint:tintSkin}],sample,mask,[...crossed.values()],body,span,rawHands,references?.backCloth);
  }
  function bindHand(points,h,wrist,elbow,inferred=false){
    const p=points[0],refW=body[wrist],axis=refW&&body[elbow]?frameAt(body[elbow],refW):null;
    const bindZ=refW?.z??span*.02;
    const palmLength=Math.max(.005,length(points[0],points[9]));
    let fitted=null;
    const template=points.map(q=>({...q,z:bindZ+q.z}));
    return template.map((base,i)=>add(base,(frame,out)=>{
      const input=(!inferred?frame.targets?.[h]:null) || (inferred?frame.puppets?.[p.x<.5?0:1]:null);
      if(i===0){
        fitted=null;
        if(input?.length===21&&input.every(valid)){
          const ratio=inferred?limit(palmLength/Math.max(.008,length(input[0],input[9])),.15,4):1;
          const target=input.map((v,k)=>point(input[0].x+(v.x-input[0].x)*ratio,input[0].y+(v.y-input[0].y)*ratio,
            template[k].z+limit(v.dz||0,-palmLength*1.6,palmLength*1.6)));
          fitted=fitHandPose(template,target);
        }else if(inferred&&frame.pose?.hands){
          fitted=curlJoints(template,limit(frame.pose.hands,-1,1));
        }
      }
      const hand=fitted;
      const bodyDriven=valid(frame.body?.[wrist])&&refW;
      const dx=bodyDriven?now[bodyIndex[wrist]].x-refW.x:0,dy=bodyDriven?now[bodyIndex[wrist]].y-refW.y:0;
      const wristDepth=bodyDriven?now[bodyIndex[wrist]].z-refW.z:0;out.z+=wristDepth;
      if(valid(hand?.[i])&&valid(hand[0])){
        const liveRoot=hand[0];
        const rootX=bodyDriven||inferred?p.x+dx:liveRoot.x,rootY=bodyDriven||inferred?p.y+dy:liveRoot.y;
        out.x=rootX+hand[i].x-liveRoot.x;out.y=rootY+hand[i].y-liveRoot.y;out.z=hand[i].z+wristDepth;
      }else if(bodyDriven){
        const arm=axis&&now[bodyIndex[elbow]]?frameAt(now[bodyIndex[elbow]],now[bodyIndex[wrist]],axis):null;
        if(arm){
          const cs=arm.x*axis.x+arm.y*axis.y,sn=arm.y*axis.x-arm.x*axis.y,sx=base.x-p.x,sy=base.y-p.y;
          out.x=p.x+dx+cs*sx-sn*sy;out.y=p.y+dy+sn*sx+cs*sy;
        }else{out.x+=dx;out.y+=dy;}
      }

    }));
  }
  function linkRings(a,b){
    // Match cyclic phase geometrically. Arc-length zippering also supports unlike tessellations.
    const distance=(i,j)=>Math.hypot(positions[3*i]-positions[3*j],positions[3*i+1]-positions[3*j+1],positions[3*i+2]-positions[3*j+2]);
    function perimeter(loop){
      const arc=[0];for(let i=0;i<loop.length;i++)arc.push(arc.at(-1)+distance(loop[i],loop[(i+1)%loop.length]));
      const total=Math.max(.00001,arc.at(-1));return arc.map(n=>n/total);
    }
    const A=perimeter(a);let shift=0,best=Infinity;
    for(let s=0;s<b.length;s++){
      let cost=0;
      for(let i=0;i<a.length;i+=2)cost+=distance(a[i],b[(s+Math.round(A[i]*b.length))%b.length])**2;
      if(cost<best){best=cost;shift=s;}
    }
    const edge=b.slice(shift).concat(b.slice(0,shift)),B=perimeter(edge);
    let i=0,j=0;
    while(i<a.length||j<edge.length){
      const u=a[i%a.length],v=edge[j%edge.length];
      if(j===edge.length||i<a.length&&A[i+1]<B[j+1]){indices.push(u,v,a[(i+1)%a.length]);i++;}
      else {indices.push(u,v,edge[(j+1)%edge.length]);j++;}
    }
  }
  function fingerWeb(rings){
    // Two facing arcs share the interdigital web. The remaining edges make one palm opening.
    const next=new Map();
    for(const ring of rings)ring.forEach((id,i)=>next.set(id,ring[(i+1)%ring.length]));
    const middle=(ring,near)=>{let best=Infinity,index=0;
      for(let k=0;k<ring.length;k++){const id=3*ring[k],d=(positions[id]-near.x)**2+(positions[id+1]-near.y)**2+(positions[id+2]-near.z)**2;
        if(d<best){index=k;best=d;}}
      return index;
    };
    const center=ring=>{const p=point(0,0);for(const id of ring){p.x+=positions[3*id]/ring.length;p.y+=positions[3*id+1]/ring.length;p.z+=positions[3*id+2]/ring.length;}return p;};
    // Occluded knuckles may project onto the same side of a ring. Its two webs
    // must always occupy opposite semicircles to form one continuous boundary.
    const centers=rings.map(center),towardNext=[],towardPrev=[];
    for(let f=0;f<4;f++){
      const ring=rings[f],half=ring.length/2;
      if(f===0){towardNext[f]=middle(ring,centers[1]);continue;}
      if(f===3){towardPrev[f]=middle(ring,centers[2]);continue;}
      let best=Infinity;
      for(let k=0;k<ring.length;k++){
        const a=ring[k]*3,b=ring[(k+half)%ring.length]*3;
        const r=centers[f+1],l=centers[f-1];
        const cost=(positions[a]-r.x)**2+(positions[a+1]-r.y)**2+(positions[a+2]-r.z)**2+
          (positions[b]-l.x)**2+(positions[b+1]-l.y)**2+(positions[b+2]-l.z)**2;
        if(cost<best){best=cost;towardNext[f]=k;towardPrev[f]=(k+half)%ring.length;}
      }
    }
    for(let f=0;f<3;f++){
      const a=rings[f],b=rings[f+1],ai=towardNext[f],bi=towardPrev[f+1];
      const at=(r,k)=>r[(k+r.length)%r.length];
      for(let k=-2;k<2;k++){
        const a0=at(a,ai+k),a1=at(a,ai+k+1),b0=at(b,bi-k),b1=at(b,bi-k-1);
        indices.push(a0,a1,b0,a1,b1,b0);next.delete(a0);next.delete(b1);
      }
      next.set(at(a,ai-2),at(b,bi+2));next.set(at(b,bi-2),at(a,ai+2));
    }
    const loop=[],start=next.keys().next().value;let v=start;
    do{loop.push(v);v=next.get(v);}while(v!==start&&v!=null&&loop.length<=next.size);
    return loop;
  }
  const inferredPalms=[null,null];
  const handRoots=new Map(),palmCenters=new Map(),wristLoops=new Map();
  function handMesh(source,h,wrist,elbow,inferred=false){
    const extended=inferred&&references&&inPhoto(source[0],aspect,span*.23);
    if(source.length!==21||!source.every(valid)||!extended&&!inPhoto(source[0],aspect,span*.08))return;
    if(inferred)inferredPalms[source[0].x<.5?0:1]=source;
    const ids=bindHand(source,h,wrist,elbow,inferred),w=ids[0],knuckles=blendIndex(ids[5],ids[17],.5),size=length(rest[w],rest[knuckles]);
    if(size<.002)return;
    if(wrist!=null){handRoots.set(wrist,w);palmCenters.set(wrist,knuckles);}
    const spread=limit(length(source[5],source[17]),size*.33,size*1.4);
    const handTint=inferred?tintSkin:palette(sample,mask,aspect,between(source[0],source[9],.55),{x:1,y:0},spread*.27,tintSkin);
    const complete=(!hands[h]?.active||hands[h].active.length===21)&&[0,1,2,5,9,13,17].every(i=>extended||inPhoto(source[i],aspect));
    const armAttached=wrist!=null&&shoulders&&sideConfidence(elbow,.22)&&length(body[wrist-4],body[elbow])<span*1.62&&(extended||inPhoto(rest[w],aspect));
    const wristLoop=armAttached?{}:null,knuckleLoop=complete?{}:null,thumbHole=complete?{position:source[2]}:null;
    if(wristLoop)wristLoops.set(wrist,wristLoop);
    const palmEnd=blendIndex(knuckles,w,complete?.31:-.115),palmStart=armAttached?w:(bodyIndex[elbow]>=0?blendIndex(w,bodyIndex[elbow],.035):blendIndex(w,knuckles,-.08));
    const fingerLoops=[];
    const baseWidth=spread*.64,active=inferred?null:hands[h]?.active;
    tube(complete?(armAttached?[w,palmEnd]:[palmStart,palmEnd]):[palmStart,w,knuckles,palmEnd],t=>({
      rx:baseWidth*profile(complete?[[0,.58],[.25,.77],[.65,.97],[1,1.03]]:[[0,.34],[.13,.64],[.34,.83],[.58,1],[.78,1.02],[.94,.91],[1,.72]],t),
      rz:Math.max(spread*.18,size*.15)*profile(complete?[[0,.81],[.55,1],[1,.97]]:[[0,.69],[.26,.94],[.58,1],[.91,.69],[1,.46]],t)
    }),{segments:17,sides:36,fit:inferred?.35:.22,color:handTint,texture:inferred?.38:.98,material:inferred?.24:.85,surface:"palm",extendBelow:!!extended,openStart:wristLoop,openEnd:knuckleLoop,thumbSocket:thumbHole});
    for(let f=0;f<5;f++){
      const first=1+4*f;if(active&&!active.includes(first+3))continue;
      const radius=spread*[.159,.143,.144,.131,.108][f],path=ids.slice(first,first+4);
      const dip=path[2],tip=path[3];path.splice(3,0,...[.64,.78,.89,.96].map(t=>blendIndex(dip,tip,t)));
      const socket=complete?{}:null;
      if(complete){
        if(f===0)path.shift();
        else path[0]=blendIndex(path[0],path[1],.055);
      }else path.unshift(f===0?blendIndex(w,knuckles,.40):blendIndex(path[0],path[1],-.24));
      tube(path,t=>{const r=radius*fingertip(t);return {rx:r,rz:r*.89,nail:smooth(.73,.84,t)*(1-smooth(.94,.992,t))};},
        {segments:20,sides:16,fit:mask?.width>150?.11:0,color:handTint,material:inferred?.18:.69,texture:inferred?.26:.98,surface:"skin",extendBelow:!!extended,openStart:socket});
      if(socket?.loop){
        if(f===0&&thumbHole?.loop)linkRings(thumbHole.loop,socket.loop);
        else if(f>0)fingerLoops.push(socket.loop);
      }
    }
    if(knuckleLoop?.loop&&fingerLoops.length===4)linkRings(knuckleLoop.loop,fingerWeb(fingerLoops));
  }
  for(let h=0;h<rawHands.length;h++){
    const raw=rawHands[h];if(raw?.length!==21||!raw.every(valid))continue;
    const wrist=[...handSlots].find(([,id])=>id===h)?.[0],len=length(point(raw[0].x,raw[0].y*aspect),point(raw[9].x,raw[9].y*aspect));
    const contact=crossed.get(h),points=raw.map(q=>{const p=point(q.x,q.y*aspect);
      const local=limit(-((q.z||0)-(raw[0].z||0))*.69,-len*.65,len*.78);
      p.z=contact?lerp(local,contact.sleeveDepth(p)-body[wrist].z,.86):local;return p;
    });
    handMesh(points,h,wrist,wrist!=null?wrist-2:null);
  }
  function inferredHand(wrist,elbow,handSide){
    if(handRoots.has(wrist)||!sideConfidence(wrist,.73)||!sideConfidence(elbow,.44)||!inPhoto(body[wrist],aspect,references?span*.23:0))return;
    const p=body[wrist],q=body[elbow],pinky=body[wrist+2],index=body[wrist+4];
    const forearm=length(q,p);if(forearm<span*.15||forearm>span*1.45)return;
    const tip=pinky&&index?between(pinky,index,.5):null;
    if(tip&&(!sideConfidence(wrist+2,.67)||!sideConfidence(wrist+4,.67)))return;
    const useTip=tip&&length(p,tip)>span*.052&&length(p,tip)<span*.60;
    const aim=useTip?tip:point(p.x+(p.x-q.x)*.34,p.y+(p.y-q.y)*.34);
    const l=length(p,aim);if(l<.001)return;
    const len=references&&observedPalm?limit(length(point(observedPalm[0].x,observedPalm[0].y*aspect),point(observedPalm[12].x,observedPalm[12].y*aspect)),forearm*.65,forearm*1.08):limit(l*1.05,forearm*.37,forearm*.80);
    const ux=(aim.x-p.x)/l,uy=(aim.y-p.y)/l,vx=-uy,vy=ux;
    const cross=useTip?(pinky.x-index.x)*vx+(pinky.y-index.y)*vy:0;
    const sign=Math.abs(cross)>span*.015?Math.sign(cross):handSide;
    const turn=references ? .48 : 0;
    const at=(along,across,z=0)=>point(p.x+(ux*along+vx*across*sign*Math.cos(turn))*len,p.y+(uy*along+vy*across*sign*Math.cos(turn))*len,(z+across*Math.sin(turn))*len);
    const offFrame=references&&!inPhoto(at(.35,0),aspect)&&inPhoto(p,aspect,span*.23);
    if(!offFrame&&(!inPhoto(at(.40,0),aspect)||maskAt(at(.35,0))<.38))return;
    const points=[point(p.x,p.y,0)];
    const bases=[[-.23,.23],[-.175,.50],[-.045,.54],[.09,.50],[.205,.43]],ends=[[-.38,.58],[-.21,.94],[-.03,1],[.115,.91],[.24,.76]];
    for(let f=0;f<5;f++)for(const u of [0,.45,.74,1]){
      points.push(at(lerp(bases[f][1],ends[f][1],u),lerp(bases[f][0],ends[f][0],u),.018*Math.sin(Math.PI*u)+.026*u+(references ? .12*u*u : 0)));
    }
    handMesh(points,-1,wrist,elbow,true);
  }
  if(shoulders){inferredHand(15,13,1);inferredHand(16,14,-1);}
  if(shoulder!=null){
    const center=rest[shoulder];
    let hipUsable=sideConfidence(23,.23)&&sideConfidence(24,.23);
    if(hipUsable){const hip=between(body[23],body[24],.5),d=length(center,hip);hipUsable=d>span*.40&&d<span*2.45;}
    if(hipUsable){hipPair=[bodyIndex[23],bodyIndex[24]];hips=blendIndex(...hipPair,.5);}
    else{
      const direction=headAxis||(chin&&length(chin,center)>span*.035?{x:(center.x-chin.x)/length(chin,center),y:(center.y-chin.y)/length(chin,center)}:point(0,1));
      const down=direction.y<.2?point(0,1):direction;
      hips=attach(point(center.x+down.x*span*1.28,center.y+down.y*span*1.28,center.z-span*.054),...shoulderPair);
    }
    const hip=rest[hips],torsoLength=Math.max(.01,length(center,hip)),top=blendIndex(shoulder,hips,-span*.20/torsoLength),bottom=blendIndex(shoulder,hips,1+span*.12/torsoLength);
    // Front-facing forearms can cross the shirt. Preserve the sleeve on its own volume,
    // using neighbouring fabric for the patch behind it to avoid a second printed arm.
    const occluders=[];
    for(const [a,b] of [[13,15],[14,16]]){
      if(!sideConfidence(a,.4)||!sideConfidence(b,.4))continue;
      const p=body[a],q=body[b],dx=q.x-p.x,dy=q.y-p.y;
      if(length(p,q)>.01)occluders.push({p,dx,dy,r:span*.074,d:dx*dx+dy*dy});
    }
    const photoVisibility=p=>{
      let keep=1;
      for(const o of occluders){const t=limit(((p.x-o.p.x)*o.dx+(p.y-o.p.y)*o.dy)/o.d,0,1);
        const d=Math.hypot(p.x-o.p.x-o.dx*t,p.y-o.p.y-o.dy*t);keep=Math.min(keep,smooth(o.r*.62,o.r*1.18,d));
      }
      return keep;
    };
    const slope=(pair,r)=>{
      if(!pair)return 0;const a=rest[pair[0]],b=rest[pair[1]];
      const width=(b.x-a.x)*r.axis.x+(b.y-a.y)*r.axis.y;
      return Math.abs(width)>span*.18?limit((b.z-a.z)/width,-.72,.72):0;
    };
    const arms=new Map();
    for(const [s,e] of [[11,13],[12,14]]){
      if(shoulders&&sideConfidence(e,.22)&&inPhoto(body[s],aspect)&&length(body[s],body[e])<span*1.62){
        const cut=between(body[s],body[e],.35);
        if(inPhoto(cut,aspect))arms.set(s,body[s]);
      }
    }
    const seam=head?.neckRing,upper=seam?head.neckCenter:null;
    const connected=upper&&inPhoto(upper,aspect)&&upper.y<center.y-span*.05;
    const neckTop=connected?attach(upper,shoulder,hips):top;
    const neckSpan=length(rest[neckTop],center),mainLength=length(center,hip)+length(hip,rest[bottom]),total=neckSpan+mainLength;
    const collarbone=connected?limit((center.y-upper.y)/span,.08,.75):0;
    function chestShape(t){
      const along=t*total-neckSpan,oldT=(along+span*.20)/(mainLength+span*.20);
      if(!connected||along>=0)return {rx:span*.51*profile(torsoWidth,limit(oldT,0,1)),rz:span*.51*profile(torsoDepth,limit(oldT,0,1))};
      const u=limit((along/span+collarbone)/collarbone,0,1);
      const neckWidth=head.neckWidth/span,neckDepth=head.neckDepth/span;
      const shoulderWidth=.51*profile(torsoWidth,.20*span/(mainLength+.20*span));
      const shoulderDepth=.51*profile(torsoDepth,.20*span/(mainLength+.20*span));
      return {rx:span*profile([[0,neckWidth],[.30,neckWidth*1.08],[.51,neckWidth*1.27],[.73,shoulderWidth*.67],[1,shoulderWidth]],u),
        rz:span*lerp(neckDepth,shoulderDepth,smooth(.12,1,u))};
    }
    tube([neckTop,shoulder,hips,bottom],chestShape,
      {segments:56,sides:48,fit:.87,color:tintCloth,material:.88,interior:photoVisibility,surface:"cloth",tilt:r=>lerp(slope(shoulderPair,r),slope(hipPair,r),smooth(.20,.88,r.t)),torsoSockets:arms,neckJoin:connected?seam:null,neckLength:neckSpan*.78});
    for(const [s,e,w,knee,ankle,heel,toe] of [[11,13,15,25,27,29,31],[12,14,16,26,28,30,32]]){
      let armPath=null;
      const socket=shouldersToJoin.get(s);
      if(shoulders&&sideConfidence(e,.22)&&length(body[s],body[e])<span*1.62){
        armPath=socket?[blendIndex(bodyIndex[s],bodyIndex[e],.35),bodyIndex[e]]:[bodyIndex[s],bodyIndex[e]];
        if(handRoots.has(w)){const end=handRoots.get(w);armPath.push(wristLoops.get(w)?.loop?blendIndex(end,bodyIndex[e],.075):end);}
        else if(sideConfidence(w,.22)&&length(body[e],body[w])<span*1.49)armPath.push(bodyIndex[w]);
      }
      if(armPath){
        const radius=span*.143;
        const short=armPath.length===2;
        const cuff=wristLoops.get(w)?.loop?{}:null;
        tube(roundedJoints(armPath,span*.10),t=>{const r=radius*profile(armWidth,lerp(socket ? .24 : .15,short ? .52 : 1,t));return {rx:r,rz:r*.89};},
          {segments:28,sides:socket?socket.loop.length:28,fit:.87,color:tintCloth,material:.94,surface:"arm",armSide:s,extendBelow:!!references&&!!cuff,openEnd:cuff});
        if(cuff?.loop)linkRings(cuff.loop,wristLoops.get(w).loop);
      }
      const h=knee-2;
      if(!hipPair||!sideConfidence(knee,.32)||!sideConfidence(h,.30)||length(body[h],body[knee])>span*1.95)continue;
      const leg=[blendIndex(bodyIndex[h],hips,.30),bodyIndex[h],bodyIndex[knee]];
      if(sideConfidence(ankle,.33)&&length(body[knee],body[ankle])<span*1.88)leg.push(bodyIndex[ankle]);
      tube(roundedJoints(leg,span*.14),t=>{const r=span*.232*profile(legWidth,leg.length===3?t*.51:t);return {rx:r,rz:r*1.03};},
        {segments:30,sides:26,fit:.89,color:tintCloth});
      if(leg.length===4&&sideConfidence(toe,.4)&&inPhoto(body[ankle],aspect)&&length(body[ankle],body[toe])<span*.88){
        const back=sideConfidence(heel,.37)?bodyIndex[heel]:bodyIndex[ankle];
        tube([bodyIndex[ankle],blendIndex(back,bodyIndex[toe],.15),bodyIndex[toe]],t=>{const r=span*.105*profile([[0,.66],[.16,.88],[.45,1.02],[.77,.91],[.94,.72],[1,.31]],t);return {rx:r,rz:r*.69};},
          {segments:13,sides:18,fit:.60,color:tintCloth});
      }
    }
  }
  if(!indices.length)return null;
  const base=new Float32Array(positions);
  function alignNeck(out,src){
    if(!neckAttachment)return;
    const {ring,body,rows}=neckAttachment;
    for(let k=0;k<ring.length;k++)for(let d=0;d<3;d++){
      const delta=src[3*ring[k]+d]-out[3*(body+k)+d];
      for(const row of rows)out[3*(row.start+k)+d]+=delta*row.influence;
    }
  }
  alignNeck(base,head?.positions);
  if(neckAttachment&&atlas){
    for(const {start,influence} of neckAttachment.rows)for(let k=0;k<neckAttachment.ring.length;k++){
      const v=start+k,angle=2*Math.PI*k/neckAttachment.ring.length;
      const tex=atlas.front(base[3*v],base[3*v+1]);
      uv[2*v]=tex[0];uv[2*v+1]=tex[1];plates[v]=2;
      weights[v]=lerp(weights[v],smooth(-.02,.46,Math.sin(angle)),influence);
      const donor=head.colors.subarray(3*neckAttachment.ring[k],3*neckAttachment.ring[k]+3);
      for(let d=0;d<3;d++)colors[3*v+d]=lerp(colors[3*v+d],donor[d],influence);
    }
  }
  function poseFrame(frame={},out){
    if(!out)out=new Float32Array(base.length);
    if(!frame.body&&!frame.targets?.some(Boolean)&&!frame.puppets?.some(Boolean)&&!frame.pose?.hands){
      out.set(base);alignNeck(out,head?.current||head?.positions);return out;
    }
    for(let i=0;i<rest.length;i++){const p=now[i],r=rest[i];p.x=r.x;p.y=r.y;p.z=r.z;drivers[i]?.(frame,p);}
    for(const rows of sweeps){
      for(const r of rows){const a=now[r.a],b=now[r.b];r.live.x=lerp(a.x,b.x,r.f);r.live.y=lerp(a.y,b.y,r.f);r.live.z=lerp(a.z,b.z,r.f);}
      for(let j=0;j<rows.length;j++){
        const r=rows[j],c=r.live,axis=frameAt(rows[Math.max(0,j-1)].live,rows[Math.min(rows.length-1,j+1)].live,r.axis);
        for(const {start,offset} of r.bands)for(let k=0;k<offset.length;k+=3){
          const v=start*3+k,side=offset[k],deep=offset[k+1];
          out[v]=c.x+axis.x*side+axis.fx*deep;out[v+1]=c.y+axis.y*side+axis.fy*deep;out[v+2]=c.z+axis.fz*deep+offset[k+2];
        }
        if(r.cap!==undefined){const i=r.cap*3;out[i]=c.x;out[i+1]=c.y;out[i+2]=c.z;}
      }
    }
    for(const {id,moved} of clavicles){
      const s=bodyIndex[id],e=bodyIndex[id+2];
      const drop=(a,b)=>(b.y-a.y)/Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z));
      const elevation=limit(drop(rest[s],rest[e])-drop(now[s],now[e]),-.28,1.4)*span;
      for(const [v,w] of moved){out[3*v+1]-=elevation*.10*w;out[3*v+2]+=elevation*.035*w;}
    }
    alignNeck(out,head?.current||head?.positions);
    for(const {id,ids,coeff} of bridges)for(let d=0;d<3;d++){
      out[3*id+d]=coeff[0]*out[3*ids[0]+d]+coeff[1]*out[3*ids[1]+d]+coeff[2]*out[3*ids[2]+d]+coeff[3]*out[3*ids[3]+d];
    }
    return out;
  }
  return {inferredPalms,neckStart:neckAttachment?.body,plateOffset:atlas?.plateOffset||0,plateMix:new Float32Array(plates),texture:atlas?.canvas,positions:base,uv:new Float32Array(uv),colors:new Float32Array(colors),photoWeight:new Float32Array(weights),
    indices:positions.length/3>65535?new Uint32Array(indices):new Uint16Array(indices),pose:poseFrame};
}

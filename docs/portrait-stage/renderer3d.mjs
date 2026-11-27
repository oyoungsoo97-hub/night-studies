const vertex=`
  attribute vec3 position, normal, color;
  attribute vec2 uv;
  attribute float photoWeight;
  uniform vec3 pivot;
  uniform vec2 orbit, scale;
  uniform float distanceToCamera;
  uniform mat3 lightSpace;
  uniform float inverseExtent, shadowPass;
  varying vec3 shadowPoint;
  varying vec2 tex;
  varying vec3 albedo, viewNormal, viewPosition;
  varying float coverage;
  vec3 rotateModel(vec3 p){
    float cy=cos(orbit.x),sy=sin(orbit.x),cp=cos(orbit.y),sp=sin(orbit.y);
    vec3 q=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);
    return vec3(q.x,cp*q.y-sp*q.z,sp*q.y+cp*q.z);
  }
  void main(){
    vec3 p=rotateModel(position-pivot);
    float w=max(.35,1.0-p.z/distanceToCamera);
    gl_Position=vec4(p.x*scale.x,-p.y*scale.y,-p.z/distanceToCamera,w);
    vec3 lightView=(lightSpace*p)*inverseExtent;
    vec3 shadowClip=vec3(lightView.xy,-lightView.z);
    shadowPoint=shadowClip*.5+.5;
    if(shadowPass>.5)gl_Position=vec4(shadowClip,1.);
    tex=uv;albedo=color;coverage=photoWeight;viewNormal=rotateModel(normal);viewPosition=p;
  }`;
const fragment=`
  precision highp float;
  uniform sampler2D photograph,depthMap;
  uniform float shadowPass,shadowTexel;
  varying vec3 shadowPoint;
  uniform vec3 keyLight;
  uniform float lightMode, wire, distanceToCamera;
  varying vec2 tex;
  varying vec3 albedo, viewNormal, viewPosition;
  varying float coverage;
  void main(){
    if(shadowPass>.5){
      vec3 pack=fract(gl_FragCoord.z*vec3(1.,255.,65025.));
      pack-=pack.yzz*vec3(1./255.,1./255.,0.);
      gl_FragColor=vec4(pack,1.);return;
    }
    if(wire>.5){gl_FragColor=vec4(.66,.92,.82,.53);return;}
    vec3 base=mix(albedo,texture2D(photograph,clamp(tex,0.,1.)).rgb,clamp(coverage,0.,1.));
    vec3 n=normalize(viewNormal);
    vec3 v=normalize(vec3(0.,0.,distanceToCamera)-viewPosition);
    if(dot(n,v)<0.)n=-n;
    vec3 key=normalize(keyLight),halfway=normalize(key+v);
    float ndl=dot(n,key),sky=max(0.,-n.y);
    float wrap=clamp((ndl+.45)/1.45,0.,1.);
    float grazing=pow(1.-max(0.,dot(n,v)),3.);
    vec3 linear=pow(max(base,vec3(.001)),vec3(2.2));
    vec3 warm=vec3(1.05,1.00,.95),cool=vec3(.79,.91,1.);
    float sidelight=step(.5,lightMode);
    vec3 ambient=mix(vec3(.65,.67,.70),vec3(.38,.42,.49),sidelight);
    float shade=1.;
    if(shadowTexel>0. && all(greaterThan(shadowPoint,vec3(0.))) && all(lessThan(shadowPoint,vec3(1.)))){
      float occluded=0.;
      float bias=.0019+.0028*(1.-abs(ndl));
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
        vec3 packedDepth=texture2D(depthMap,shadowPoint.xy+vec2(float(x),float(y))*shadowTexel*1.6).rgb;
        float depth=dot(packedDepth,vec3(1.,1./255.,1./65025.));
        occluded+=step(depth+bias,shadowPoint.z);
      }
      shade-=occluded/9.*mix(.42,.68,sidelight);
    }
    vec3 light=ambient+warm*wrap*shade*mix(.42,.65,sidelight)+sky*.05;
    float rough=mix(25.,44.,clamp(coverage,0.,1.));
    float highlight=pow(max(0.,dot(n,halfway)),rough)*max(0.,ndl);
    vec3 rim=cool*grazing*max(0.,dot(n,normalize(vec3(.70,-.25,-.28))))*mix(.022,.115,sidelight);
    vec3 lit=linear*light+warm*highlight*shade*.012+rim;
    gl_FragColor=vec4(pow(max(lit,vec3(0.)),vec3(1./2.2)),1.);
  }`;
function compile(gl,type,source){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(reason);}
  return shader;
}
export function renderer3D(canvas){
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false});
  if(!gl)return null;
  const program=gl.createProgram();
  for(const [type,src] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=compile(gl,type,src);gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  function albedoTexture(image){
    const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    for(const wrap of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,wrap,gl.CLAMP_TO_EDGE);
    const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,limit=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if(Math.max(w,h)>limit){
      const scale=limit/Math.max(w,h),copy=document.createElement('canvas');copy.width=Math.max(1,Math.floor(w*scale));copy.height=Math.max(1,Math.floor(h*scale));
      copy.getContext('2d').drawImage(image,0,0,copy.width,copy.height);image=copy;
    }
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
    return texture;
  }
  const shadowSize=1024,shadow=gl.createTexture(),fbo=gl.createFramebuffer(),depth=gl.createRenderbuffer();
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shadow);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  for(const filter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,filter,gl.NEAREST);
  for(const wrap of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,wrap,gl.CLAMP_TO_EDGE);
  gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadow,0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  const shadows=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE0);
  const attrib={},uniform={};
  for(const key of ['position','normal','uv','color','photoWeight'])attrib[key]=gl.getAttribLocation(program,key);
  for(const key of ['orbit','pivot','scale','distanceToCamera','keyLight','lightMode','wire','shadowPass','shadowTexel','lightSpace','inverseExtent'])uniform[key]=gl.getUniformLocation(program,key);
  gl.uniform1i(gl.getUniformLocation(program,'photograph'),0);gl.uniform1i(gl.getUniformLocation(program,'depthMap'),1);
  gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
  function buffer(target,data,dynamic=false){
    const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);return b;
  }
  let model,groups=[];
  function set(value){
    for(const g of groups){gl.deleteTexture(g.texture);for(const b of g.buffers)gl.deleteBuffer(b);}
    groups=[];model=value;if(!model)return;
    for(const p of model.parts){
      const A=gl.ARRAY_BUFFER,E=gl.ELEMENT_ARRAY_BUFFER;
      const Id=p.positions.length/3<65536?Uint16Array:Uint32Array;
      if(Id===Uint32Array&&!gl.getExtension('OES_element_index_uint'))throw Error('Index format unavailable');
      const faces=Id.from(p.indices),lines=new Id(faces.length*2);
      for(let i=0;i<faces.length;i+=3){const a=faces[i],b=faces[i+1],c=faces[i+2];lines.set([a,b,b,c,c,a],i*2);}
      const buffers=[buffer(A,p.current,true),buffer(A,p.normals,true),buffer(A,p.uv),buffer(A,p.colors),buffer(A,p.photoWeight),buffer(E,faces),buffer(E,lines)];
      groups.push({p,buffers,texture:albedoTexture(p.texture||model.photo),fmt:Id===Uint16Array?gl.UNSIGNED_SHORT:gl.UNSIGNED_INT});
    }
  }
  function render(view,wire){
    const w=canvas.width,h=canvas.height;
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!model)return;
    const {min,max}=model,extent=max.map((n,i)=>Math.max(.015,n-min[i]));
    const width=Math.max(extent[0],extent[2]*.94),height=extent[1],radius=Math.max(width,height)*.54;
    const scale=Math.min(1.77/width,1.81*h/(w*height))*view.zoom;
    gl.uniform3f(uniform.pivot,(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2);
    gl.uniform2f(uniform.orbit,view.yaw*Math.PI/180,view.pitch*Math.PI/180);gl.uniform2f(uniform.scale,scale,scale*w/h);
    gl.uniform1f(uniform.distanceToCamera,Math.max(.09,radius*6));
    const lights=[[-.44,-.64,.90],[-.94,-.32,.35],[.78,-.55,.45]];
    gl.uniform3fv(uniform.keyLight,lights[view.light]||lights[0]);gl.uniform1f(uniform.lightMode,view.light);
    const normalized=a=>{const d=Math.hypot(...a);return a.map(x=>x/d);};
    const key=normalized(lights[view.light]||lights[0]),right=normalized([key[2],0,-key[0]]);
    const up=[key[1]*right[2],key[2]*right[0]-key[0]*right[2],-key[1]*right[0]];
    gl.uniformMatrix3fv(uniform.lightSpace,false,[right[0],up[0],key[0],right[1],up[1],key[1],right[2],up[2],key[2]]);
    gl.uniform1f(uniform.inverseExtent,1/(Math.hypot(...extent)*.58));
    gl.uniform1f(uniform.shadowTexel,shadows?1/shadowSize:0);
    gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    function drawGroup(g,line,upload=false){
      const {buffers,p,fmt}=g;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,g.texture);
      for(const [i,[key,size]] of [['position',3],['normal',3],['uv',2],['color',3],['photoWeight',1]].entries()){
        gl.bindBuffer(gl.ARRAY_BUFFER,buffers[i]);
        if(upload&&i<2)gl.bufferSubData(gl.ARRAY_BUFFER,0,i===0?p.current:p.normals);
        gl.enableVertexAttribArray(attrib[key]);gl.vertexAttribPointer(attrib[key],size,gl.FLOAT,false,0,0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffers[line?6:5]);gl.drawElements(line?gl.LINES:gl.TRIANGLES,p.indices.length*(line?2:1),fmt,0);
    }
    gl.uniform1f(uniform.wire,0);
    if(shadows){
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null); // Never sample the active framebuffer attachment.
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,shadowSize,shadowSize);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(uniform.shadowPass,1);for(const g of groups)drawGroup(g,false,true);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shadow);
    }
    gl.uniform1f(uniform.shadowPass,0);for(const g of groups)drawGroup(g,false,!shadows);gl.disable(gl.POLYGON_OFFSET_FILL);
    if(wire){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1f(uniform.wire,1);gl.depthMask(false);for(const g of groups)drawGroup(g,true);gl.depthMask(true);gl.disable(gl.BLEND);}
  }
  return {set,render};
}

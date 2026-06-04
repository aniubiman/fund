/**
 * fluid-bg.js — WebGL 动态背景（主题感知双风格双色调）
 *
 * 风格：fluid（流动水银） / velvet（丝绒波动）
 * 色调随外观主题自动切换：
 *   亮色 → fluid:珍珠白/日落暖  velvet:月光银/暮光紫
 *   暗色 → fluid:暗夜蓝/紫金    velvet:极光绿/赤霞
 */

(function () {
  var container = null;
  var renderer = null, scene = null, camera = null, material = null, uniforms = null;
  var animationId = null, resizeHandler = null;
  var STORAGE_KEY = 'fluid-bg-settings';

  function loadSettings() {
    try { var r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch (e) {}
    return { enabled: true, style: 'fluid', palette: 0 };
  }
  function saveSettings(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {} }
  var settings = loadSettings();

  function isDarkTheme() {
    return document.body.getAttribute('data-theme') === 'dark';
  }

  // ===================== 着色器 =====================
  var vertexShader = 'void main(){gl_Position=vec4(position,1.0);}';

  // ---- 流动水银 ----
  var fluidFrag = [
    'precision highp float;',
    'uniform vec2 u_resolution; uniform float u_time; uniform vec2 u_mouse;',
    'uniform float u_palette; uniform float u_isDark;',
    'vec3 m289(vec3 x){return x-floor(x/289.0)*289.0;}',
    'vec2 m289(vec2 x){return x-floor(x/289.0)*289.0;}',
    'vec3 pm(vec3 x){return m289(((x*34.0)+1.0)*x);}',
    'float sn(vec2 v){',
    '  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);',
    '  vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx);',
    '  vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);',
    '  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=m289(i);',
    '  vec3 p=pm(pm(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));',
    '  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);',
    '  m=m*m; m=m*m; vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-0.5,ox=floor(x+0.5),a0=x-ox;',
    '  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);',
    '  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;',
    '  return 130.*dot(m,g);',
    '}',
    'void main(){',
    '  vec2 st=gl_FragCoord.xy/u_resolution.xy;',
    '  vec2 md=(u_mouse-gl_FragCoord.xy)/u_resolution.xy;',
    '  float dist=length(md); vec2 disp=normalize(md)*exp(-dist*10.)*.25;',
    '  vec2 pos=st*1.5+disp*.1,pos2=st*3.-disp*.15,pos3=st*6.+disp*.05;',
    '  float n=sn(pos+u_time*.20),n2=sn(pos2-u_time*.30),n3=sn(pos3+u_time*.10);',
    '  float f=n*.5+n2*.3+n3*.2; f=f*.5+.5;',
    '  vec3 base,c1,c2,c3;',
    '  if(u_isDark>.5){',
    '    if(u_palette>.5){',
    '      base=vec3(.06,.04,.08); c1=vec3(.55,.40,.75); c2=vec3(.68,.55,.85); c3=vec3(.42,.30,.62);', // 烟紫
    '    }else{',
    '      base=vec3(.06,.07,.10); c1=vec3(.35,.50,.78); c2=vec3(.50,.62,.88); c3=vec3(.25,.42,.68);', // 石墨蓝
    '    }',
    '    f=pow(f,1.2);',
    '  }else{',
    '    if(u_palette>.5){',
    '      base=vec3(1.); c1=vec3(1.,.82,.65); c2=vec3(.60,.75,1.); c3=vec3(.94,.88,1.);', // 日落暖
    '    }else{',
    '      base=vec3(1.); c1=vec3(.82,.93,1.); c2=vec3(.90,.85,1.); c3=vec3(.82,1.,.90);', // 珍珠白
    '    }',
    '  }',
    '  vec3 color=mix(base,c1,smoothstep(.2,.8,f));',
    '  color=mix(color,c2,smoothstep(.4,.9,n2*.5+.5));',
    '  color=mix(color,c3,smoothstep(.6,1.,n3*.5+.5));',
    '  color+=vec3(.08)*pow(f,3.);',
    '  float alpha=u_isDark>.5?.50:.40;',
    '  gl_FragColor=vec4(color,alpha);',
    '}'
  ].join('\n');

  // ---- 丝绒波动 ----
  var velvetFrag = [
    'precision highp float;',
    'uniform vec2 u_resolution; uniform float u_time; uniform vec2 u_mouse;',
    'uniform float u_palette; uniform float u_isDark;',
    'vec3 m289(vec3 x){return x-floor(x/289.0)*289.0;}',
    'vec2 m289(vec2 x){return x-floor(x/289.0)*289.0;}',
    'vec3 pm(vec3 x){return m289(((x*34.0)+1.0)*x);}',
    'float sn(vec2 v){',
    '  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);',
    '  vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx);',
    '  vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);',
    '  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=m289(i);',
    '  vec3 p=pm(pm(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));',
    '  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);',
    '  m=m*m; m=m*m; vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-0.5,ox=floor(x+0.5),a0=x-ox;',
    '  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);',
    '  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;',
    '  return 130.*dot(m,g);',
    '}',
    'void main(){',
    '  vec2 st=gl_FragCoord.xy/u_resolution.xy; st.x*=u_resolution.x/u_resolution.y;',
    '  vec2 pos=st*2.;',
    '  pos.y+=sin(pos.x*2.5+u_time*.6)*.5; pos.x+=cos(pos.y*1.5+u_time*.4)*.3;',
    '  float n=sn(pos+u_time*.2); n+=.6*sn(pos*2.5-u_time*.15); n=n*.5+.5;',
    '  vec3 light,dark;',
    '  if(u_isDark>.5){',
    '    if(u_palette>.5){',
    '      light=vec3(.85,.25,.35); dark=vec3(.04,.02,.06);', // 赤霞
    '    }else{',
    '      light=vec3(.10,.72,.60); dark=vec3(.02,.08,.12);', // 极光绿
    '    }',
    '  }else{',
    '    if(u_palette>.5){',
    '      light=vec3(.95,.88,.95); dark=vec3(.62,.55,.70);', // 暮光紫
    '    }else{',
    '      light=vec3(1.); dark=vec3(.75,.78,.84);', // 月光银
    '    }',
    '  }',
    '  float t=smoothstep(.1,.75,n); vec3 color=mix(dark,light,t);',
    '  vec2 md=(u_mouse-gl_FragCoord.xy)/u_resolution.xy;',
    '  color+=exp(-length(md)*5.)*.06;',
    '  float alpha=u_isDark>.5?.48:.42;',
    '  gl_FragColor=vec4(color,alpha);',
    '}'
  ].join('\n');

  function getActiveFrag() { return settings.style==='velvet'?velvetFrag:fluidFrag; }

  // ===================== 构建/重建 =====================
  function buildMaterial() {
    if (material) { material.dispose(); material=null; }
    uniforms = {
      u_time:       { type:'f', value:0 },
      u_resolution: { type:'v2',value:new THREE.Vector2() },
      u_mouse:      { type:'v2',value:new THREE.Vector2(.5,.5) },
      u_palette:    { type:'f', value:settings.palette||0 },
      u_isDark:     { type:'f', value:isDarkTheme()?1:0 }
    };
    material = new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader:getActiveFrag(), transparent:true, depthWrite:false
    });
    if (scene) { while(scene.children.length)scene.remove(scene.children[0]); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material)); }
  }

  function rebuildMaterial() {
    if (!material||!scene) return;
    material.dispose();
    material = new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader:getActiveFrag(), transparent:true, depthWrite:false
    });
    while(scene.children.length)scene.remove(scene.children[0]);
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  }

  // ===================== 动画 =====================
  var startTime = performance.now();
  function loop() {
    function a(){animationId=requestAnimationFrame(a);if(uniforms&&renderer){uniforms.u_time.value=(performance.now()-startTime)*.001;renderer.render(scene,camera);}}
    a();
  }

  // ===================== 公开 API =====================
  function setEnabled(on) {
    settings.enabled=on; saveSettings(settings);
    if(on){if(renderer&&container)renderer.domElement.style.display='block';else init(document.getElementById('fluid-bg-container'));}
    else{if(renderer&&renderer.domElement)renderer.domElement.style.display='none';}
  }

  function setStyle(name) {
    if(name!=='fluid'&&name!=='velvet')return;
    if(settings.style===name)return;
    settings.style=name; saveSettings(settings);
    if(material)rebuildMaterial();
    if(typeof updateFluidUI==='function')updateFluidUI();
  }

  function setPaletteIdx(idx) {
    idx=idx?1:0; settings.palette=idx; saveSettings(settings);
    if(uniforms&&uniforms.u_palette)uniforms.u_palette.value=idx;
    if(typeof updateFluidUI==='function')updateFluidUI();
  }

  function onThemeChange() {
    if(uniforms&&uniforms.u_isDark)uniforms.u_isDark.value=isDarkTheme()?1:0;
    if(typeof updateFluidUI==='function')updateFluidUI();
  }

  var _retries=0, _initialized=false;
  function init(containerEl) {
    if(!containerEl||!settings.enabled){if(containerEl)container=containerEl;return;}
    if(_initialized)return;  // 已初始化，跳过
    if(!window.THREE){if(++_retries>10)return;setTimeout(function(){init(containerEl);},200);return;}
    _initialized=true;
    container=containerEl;
    camera=new THREE.Camera(); camera.position.z=1;
    scene=new THREE.Scene(); buildMaterial();
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0,0); container.appendChild(renderer.domElement);
    if(!settings.enabled)renderer.domElement.style.display='none';
    resizeHandler=function(){
      var w=container.clientWidth,h=container.clientHeight;
      if(!w||!h)return;
      renderer.setSize(w,h,false);
      if(uniforms&&uniforms.u_resolution){uniforms.u_resolution.value.x=renderer.domElement.width;uniforms.u_resolution.value.y=renderer.domElement.height;}
    };
    resizeHandler(); window.addEventListener('resize',resizeHandler,false);
    document.addEventListener('mousemove',function(e){if(uniforms&&uniforms.u_mouse){uniforms.u_mouse.value.x=e.clientX/window.innerWidth;uniforms.u_mouse.value.y=1-e.clientY/window.innerHeight;}},{passive:true});
    var observer = new MutationObserver(function(){onThemeChange();});
    observer.observe(document.body,{attributes:true,attributeFilter:['data-theme']});
    loop();
  }

  function destroy() {
    _initialized=false;
    if(animationId){cancelAnimationFrame(animationId);animationId=null;}
    if(resizeHandler){window.removeEventListener('resize',resizeHandler);resizeHandler=null;}
    if(renderer){if(container&&renderer.domElement&&renderer.domElement.parentNode===container)container.removeChild(renderer.domElement);renderer.dispose();renderer=null;}
    if(material){material.dispose();material=null;}
    uniforms=null; scene=null; camera=null; container=null;
  }

  window.FluidBG={init,setEnabled,setStyle,setPaletteIdx,onThemeChange,destroy};
})();

// ===================== 侧边栏 UI 更新 =====================
function updateFluidUI(){
  var s={};
  try{var r=localStorage.getItem('fluid-bg-settings');if(r)s=JSON.parse(r);}catch(e){}
  var isDark=(document.body.getAttribute('data-theme')||'light')==='dark';
  var style=s.style||'fluid';
  var idx=s.palette||0;

  // 流光开关
  var ft=document.getElementById('fluid-enable-toggle');
  if(ft){ft.classList.toggle('on',s.enabled!==false);}

  // 风格分段按钮
  var sc=document.getElementById('fluid-style-ctrl');
  if(sc)sc.querySelectorAll('.segment-btn').forEach(function(b){
    b.classList.toggle('active',b.textContent.trim()===(style==='velvet'?'丝绒波动':'流动水银'));
  });

  // 色调分段按钮
  var pc=document.getElementById('fluid-palette-ctrl');
  if(pc){
    var btns=pc.querySelectorAll('.segment-btn');
    var names=isDark
      ?(style==='velvet'?['极光绿','赤霞']:['石墨蓝','烟紫'])
      :(style==='velvet'?['月光银','暮光紫']:['珍珠白','日落暖']);
    btns.forEach(function(b,i){
      b.textContent=names[i];
      b.classList.toggle('active',i===idx);
    });
  }
}

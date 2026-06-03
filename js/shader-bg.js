/**
 * shader-bg.js — Three.js WebGL 着色器动画背景
 *
 * 将 React shader-animation.tsx 组件转换为原生 JS 实现。
 * 在登录页面背后渲染动态同心圆环着色器效果。
 * 依赖：Three.js（CDN 引入，全局 THREE）
 */

(function () {
  var container = null;
  var renderer = null;
  var scene = null;
  var camera = null;
  var geometry = null;
  var material = null;
  var uniforms = null;
  var animationId = null;
  var resizeHandler = null;

  /** 初始化着色器背景 */
  function initShader(containerEl) {
    if (!containerEl || !window.THREE) return;
    container = containerEl;

    // --- 着色器代码 ---
    var vertexShader = [
      'void main() {',
      '  gl_Position = vec4(position, 1.0);',
      '}'
    ].join('\n');

    var fragmentShader = [
      '#define TWO_PI 6.2831853072',
      '#define PI 3.14159265359',
      '',
      'precision highp float;',
      'uniform vec2 resolution;',
      'uniform float time;',
      '',
      'void main(void) {',
      '  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);',
      '  float t = time * 0.05;',
      '  float lineWidth = 0.002;',
      '',
      '  vec3 color = vec3(0.0);',
      '  for (int j = 0; j < 3; j++) {',
      '    for (int i = 0; i < 5; i++) {',
      '      color[j] += lineWidth * float(i * i) / abs(',
      '        fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0',
      '        - length(uv)',
      '        + mod(uv.x + uv.y, 0.2)',
      '      );',
      '    }',
      '  }',
      '',
      '  gl_FragColor = vec4(color[0], color[1], color[2], 1.0);',
      '}'
    ].join('\n');

    // --- Three.js 场景初始化 ---
    camera = new THREE.Camera();
    camera.position.z = 1;

    scene = new THREE.Scene();
    geometry = new THREE.PlaneGeometry(2, 2);

    uniforms = {
      time: { type: 'f', value: 1.0 },
      resolution: { type: 'v2', value: new THREE.Vector2() }
    };

    material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    var mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比以保证性能

    container.appendChild(renderer.domElement);

    // --- 窗口大小调整 ---
    resizeHandler = function () {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      uniforms.resolution.value.x = renderer.domElement.width;
      uniforms.resolution.value.y = renderer.domElement.height;
    };

    resizeHandler();
    window.addEventListener('resize', resizeHandler, false);

    // --- 动画循环 ---
    function animate() {
      animationId = requestAnimationFrame(animate);
      uniforms.time.value += 0.05;
      renderer.render(scene, camera);
    }

    animate();
  }

  /** 销毁着色器并释放资源 */
  function destroyShader() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }

    if (renderer) {
      if (container && renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      renderer = null;
    }

    if (geometry) {
      geometry.dispose();
      geometry = null;
    }

    if (material) {
      material.dispose();
      material = null;
    }

    scene = null;
    camera = null;
    uniforms = null;
    container = null;
  }

  // 暴露到全局
  window.ShaderBG = {
    init: initShader,
    destroy: destroyShader
  };
})();

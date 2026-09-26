// 渲染器、相機、操作控制與後製
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { scene, DPR, PI } from './context.js';

export const canvas = document.getElementById('stage');

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// ---- 相機：從右前方斜上方看整個底座 ----
export const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 400);
camera.layers.enable(1);   // 圖層 1：描邊、店內小物、雨（不進地面反射）
const TARGET = new THREE.Vector3(0.5, 1.4, 0.5);
function framingDistance() {
  const vt = Math.tan(THREE.MathUtils.degToRad(15));
  const a = innerWidth / innerHeight;
  return Math.min(190, Math.max(33 / (2 * vt), 43 / (2 * vt * a)));
}
{
  const d = framingDistance(), az = THREE.MathUtils.degToRad(36), el = THREE.MathUtils.degToRad(27);
  camera.position.set(TARGET.x + d * Math.cos(el) * Math.sin(az), TARGET.y + d * Math.sin(el), TARGET.z + d * Math.cos(el) * Math.cos(az));
}

export const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 10;
controls.maxDistance = 200;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = PI * 0.47;
controls.screenSpacePanning = true;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.update();

// ---- 後製：HDR 緩衝 → 清除 NaN → 泛光 → 色調映射 → FXAA ----
// 不用 MSAA 緩衝：Windows 的 D3D11 下 MSAA HalfFloat + 泛光會整片變黑
const composerRT = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, composerRT);
composer.setPixelRatio(DPR);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = clamp(c, 0.0, 64.0);
    }`,
}));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.92));
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
composer.addPass(fxaa);
const setFxaaSize = () => fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * DPR), 1 / (innerHeight * DPR));
setFxaaSize();

// ---- 視窗大小改變 ----
const resizeHooks = [];
export const onResize = f => resizeHooks.push(f);
export function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer.setSize(w, h);
  setFxaaSize();
  for (const f of resizeHooks) f(w, h);
}

export function render() {
  const tg = controls.target;   // 平移不超出底座
  tg.set(THREE.MathUtils.clamp(tg.x, -13, 13), THREE.MathUtils.clamp(tg.y, 0, 8), THREE.MathUtils.clamp(tg.z, -13, 13));
  controls.update();
  composer.render();
}

// 渲染器、相機、操作控制與後製；由各場景呼叫 setupRenderer() 設定
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
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

// 圖層 1：描邊、店內小物、雨等不需要進入反射或 AO 的物件
export const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 400);
camera.layers.enable(1);
export const controls = new OrbitControls(camera, canvas);

let composer = null, fxaa = null, ao = null;
export let bloomPass = null;   // 天色（src/engine/sky.js）依時間調整強度與門檻
export let baseDistance = 0;   // 寬螢幕上剛好框住場景的相機距離；直式螢幕或拉遠時，霧依這個距離往後推
let clampBox = null;
const resizeHooks = [];
export const onResize = f => resizeHooks.push(f);

const NaNGuardShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = clamp(c, 0.0, 64.0);
    }`,
};

// 暗角：畫面四周輕輕壓暗，把視線收回中央
const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.3 } },
  vertexShader: NaNGuardShader.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float r = length((vUv - 0.5) * vec2(1.0, 0.82)) * 1.45;
      c.rgb *= 1.0 - amount * smoothstep(0.35, 1.0, r);
      gl_FragColor = c;
    }`,
};

/**
 * o.view:  { fov, target:[x,y,z], azimuth, elevation(度), frame:[需要的垂直寬度, 需要的水平寬度], min, max, maxPolar }
 * o.toneMapping / o.exposure
 * o.bloom: { strength, radius, threshold }
 * o.ao:    null 或 { radius, minDistance, maxDistance, samples } → SSAO（環境光遮蔽）
 * o.clamp: 平移範圍 { x:[a,b], y:[a,b], z:[a,b] }
 * o.vignette: 暗角強度（0 ~ 1，省略則不加）
 */
export function setupRenderer(o) {
  renderer.toneMapping = o.toneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 1.0;

  // ---- 相機：依視窗比例算出能完整框住場景的距離 ----
  const v = o.view;
  camera.fov = v.fov ?? 30;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const target = new THREE.Vector3(...v.target);
  const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.min(v.max ?? 200, Math.max(v.frame[0] / (2 * vt), v.frame[1] / (2 * vt * camera.aspect)));
  baseDistance = v.frame[0] / (2 * vt);
  const az = THREE.MathUtils.degToRad(v.azimuth), el = THREE.MathUtils.degToRad(v.elevation);
  camera.position.set(target.x + d * Math.cos(el) * Math.sin(az), target.y + d * Math.sin(el), target.z + d * Math.cos(el) * Math.cos(az));
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = v.min ?? 10;
  controls.maxDistance = v.max ?? 200;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = v.maxPolar ?? PI * 0.47;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.update();
  clampBox = o.clamp ?? null;

  // ---- 後製：HDR 緩衝 →（AO）→ 清除 NaN → 泛光 → 色調映射 → FXAA ----
  // 不用 MSAA 緩衝：Windows 的 D3D11 下 MSAA HalfFloat + 泛光會整片變黑
  const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(DPR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  if (o.ao) {
    // 用 SSAOPass：GTAOPass 在 Windows 的 D3D11 下畫面中央會出現一塊黑色方塊
    // minDistance / maxDistance 是以 (far - near) 正規化的深度差
    ao = new SSAOPass(scene, camera, innerWidth, innerHeight, o.ao.samples ?? 24);
    ao.kernelRadius = o.ao.radius ?? 0.5;
    ao.minDistance = o.ao.minDistance ?? 0.00004;
    ao.maxDistance = o.ao.maxDistance ?? 0.004;
    ao.normalMaterial.side = THREE.DoubleSide;   // 雙面的葉片背面也要進法線階段
    // 原版只在法線階段隱藏 Points / Line；蒸氣、水面等透明物件也要排除，否則周圍會出現 AO 暈影
    const hideBase = ao.overrideVisibility.bind(ao);
    ao.overrideVisibility = () => {
      hideBase();
      scene.traverse(obj => {
        if (obj.isSprite || obj.userData.noAO || (obj.material && !Array.isArray(obj.material) && obj.material.transparent)) obj.visible = false;
      });
    };
    composer.addPass(ao);
  }
  composer.addPass(new ShaderPass(NaNGuardShader));
  const b = o.bloom ?? { strength: 0.5, radius: 0.55, threshold: 0.92 };
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), b.strength, b.radius, b.threshold);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  if (o.vignette) {
    const v = new ShaderPass(VignetteShader);
    v.uniforms.amount.value = o.vignette;
    composer.addPass(v);
  }
  fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);
  setFxaaSize();
}

function setFxaaSize() {
  fxaa?.material.uniforms.resolution.value.set(1 / (innerWidth * DPR), 1 / (innerHeight * DPR));
}

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
  if (clampBox) {   // 平移不超出底座
    const tg = controls.target, C = THREE.MathUtils.clamp;
    tg.set(C(tg.x, ...clampBox.x), C(tg.y, ...clampBox.y), C(tg.z, ...clampBox.z));
  }
  controls.update();
  composer.render();
}

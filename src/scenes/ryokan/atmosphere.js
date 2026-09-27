// 氛圍：月亮、閃爍的星星、低處飄移的薄霧、浮島下方流動的雲海、庭園裡稀疏的螢火光點、燈火搖曳
// 透明與發光的東西全放在圖層 1（不進 AO 的法線階段）
import * as THREE from 'three';
import { scene, U, DPR, PI, reduceMotion, onTick } from '../../engine/context.js';
import { camera } from '../../engine/renderer.js';
import { rng, rand, pick } from '../../engine/random.js';
import { noise3, fbm3 } from '../../engine/noise.js';
import { canvasTex } from '../../engine/canvas.js';
import { flames } from './garden.js';
import { W } from './wind.js';
import { heightAt } from './terrain.js';
import { HX, HZ, LV, POND, FALL } from './layout.js';

export function buildAtmosphere() {
  moon();
  stars();
  mist();
  cloudSea();
  fireflies();
  flicker();
}

// ---- 月亮：掛在畫面右上方（跟著相機，構圖固定），圓盤加一圈淡淡的光暈 ----
function moon() {
  scene.add(camera);
  const disc = canvasTex(256, 256, (g, w) => {
    const r = w / 2;
    const gr = g.createRadialGradient(r * 0.9, r * 0.85, 0, r, r, r * 0.62);
    gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.8, '#f6ecd8'); gr.addColorStop(1, '#e9dcc4');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r * 0.62, 0, PI * 2); g.fill();
    g.globalAlpha = 0.07; g.fillStyle = '#7a6a8a';                            // 淡淡的月海
    for (const [x, y, s] of [[0.42, 0.4, 0.14], [0.58, 0.47, 0.1], [0.47, 0.6, 0.12], [0.62, 0.62, 0.06]]) { g.beginPath(); g.arc(x * w, y * w, s * w, 0, PI * 2); g.fill(); }
  });
  const halo = canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,240,225,0.55)'); gr.addColorStop(0.18, 'rgba(220,200,240,0.22)'); gr.addColorStop(0.5, 'rgba(160,140,210,0.07)'); gr.addColorStop(1, 'rgba(120,100,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const mk = (map, color, size, additive) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, fog: false, depthWrite: false, transparent: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.scale.setScalar(size);
    s.layers.set(1);
    s.renderOrder = -10;
    camera.add(s);
    return s;
  };
  const place = () => {             // 依畫面比例放在右上角（距相機 300）
    const d = 300, h = Math.tan(camera.fov * PI / 360) * d, w = h * camera.aspect;
    for (const s of [haloS, discS]) s.position.set(w * 0.62, h * 0.62, -d);
  };
  const haloS = mk(halo, 0xffffff, 110, true), discS = mk(disc, new THREE.Color(1.25, 1.2, 1.12), 26, false);
  place();
  addEventListener('resize', place);
}

// ---- 星星：上半球與遠方的點，各自以不同節奏閃爍 ----
function stars() {
  const N = 900, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = rand(0, PI * 2), y = rand(-0.35, 1);
    const r = Math.sqrt(1 - y * y), R = 260;
    pos.set([Math.cos(a) * r * R, y * R, Math.sin(a) * r * R], i * 3);
    seed[i] = rng();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: U.time, pr: { value: DPR } },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float time; uniform float pr; varying float vA;
      void main() {
        vA = (0.3 + 0.7 * aSeed) * (0.72 + 0.28 * sin(time * (0.5 + aSeed * 1.6) + aSeed * 40.0));
        gl_PointSize = (0.9 + aSeed * 1.6) * pr;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(1.0, 0.96, 1.0) * vA, vA * (1.0 - smoothstep(0.2, 0.5, d)));
      }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.layers.set(1);
  scene.add(pts);
}

// ---- 柔邊雲霧貼圖（fbm，邊緣淡出）----
function cloudTex(size, soft, seed) {
  return canvasTex(size, size, (g, w) => {
    const img = g.createImageData(w, w), c = w / 2;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      const n = fbm3(x / w * 4 + seed, y / w * 4, seed, 4) * 0.5 + 0.5;
      const r = Math.hypot(x - c, y - c) / c;
      const a = Math.max(0, n - 0.35) / 0.65 * Math.max(0, 1 - Math.pow(r, soft));
      const o = (y * w + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.min(255, a * 255 * 1.6);
    }
    g.putImageData(img, 0, 0);
  });
}

// ---- 薄霧：池面、參道、石垣腳的低處，緩慢飄移、呼吸般濃淡 ----
function mist() {
  const tex = cloudTex(128, 1.6, 3.1);
  const patches = [];
  const add = (x, y, z, w, d, op) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, color: 0xb4a8d4, transparent: true, opacity: op, depthWrite: false, fog: false }));
    m.rotation.x = -PI / 2; m.rotation.z = rand(0, PI);
    m.position.set(x, y, z);
    m.layers.set(1);
    m.renderOrder = 2;
    scene.add(m);
    patches.push({ m, x, z, op, ph: rand(0, 10), sp: rand(0.06, 0.14) });
  };
  for (const [cx, cz, rx, rz] of POND.lobes) { add(cx, LV.water + 0.35, cz, rx * 3.2, rz * 3.2, 0.1); add(cx + 0.5, LV.water + 0.7, cz - 0.3, rx * 2.6, rz * 2.4, 0.07); }
  add(FALL.x, LV.water + 0.9, -0.8, 3.2, 2.4, 0.12);
  for (let x = -12; x <= 12; x += 6) add(x + rand(-1, 1), LV.low + rand(0.25, 0.45), 14.8 + rand(-0.8, 0.8), rand(6, 8), rand(3.5, 4.5), 0.16);
  for (let x = -8; x <= 12; x += 6.5) add(x + rand(-1, 1), rand(0.3, 0.5), 0.4 + rand(-0.4, 0.4), rand(5, 7), 2.6, 0.1);
  if (reduceMotion) return;
  onTick(t => {
    const g = W.gust.value, d = W.dir.value;
    for (const p of patches) {
      p.m.position.x = p.x + Math.sin(t * p.sp + p.ph) * 0.8 + d.x * g * 0.6;
      p.m.position.z = p.z + Math.cos(t * p.sp * 0.8 + p.ph) * 0.5 + d.y * g * 0.6;
      p.m.material.opacity = p.op * (0.75 + 0.25 * Math.sin(t * 0.3 + p.ph)) * (1 - g * 0.4);
    }
  });
}

// ---- 雲海：浮島下方幾層緩慢流動的雲，底部的岩錐穿出雲層 ----
function cloudSea() {
  const layers = [];
  for (const [y, size, op, col, seed] of [[-6.5, 150, 0.55, 0x7a6a9e, 1.3], [-9.5, 190, 0.5, 0x5d4f84, 7.7], [-13, 240, 0.45, 0x44396a, 4.2]]) {
    const tex = cloudTex(256, 2.2, seed);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -PI / 2;
    m.position.y = y;
    m.layers.set(1);
    scene.add(m);
    layers.push({ m, sp: rand(0.004, 0.008) * (y < -10 ? -1 : 1) });
  }
  if (reduceMotion) return;
  onTick(t => { for (const l of layers) l.m.rotation.z = t * l.sp; });
}

// ---- 螢火光點：稀疏、緩慢、偏暗，只在庭園低處 ----
function fireflies() {
  const N = 24, pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const x = rand(-14, 14), z = rand(-1, 15);
    pos.set([x, heightAt(x, z) + rand(0.4, 2.0), z], i * 3);
    seed.set([rng(), rng(), rng()], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: U.time, pr: { value: DPR }, speed: { value: reduceMotion ? 0.2 : 0.6 } },
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float time, pr, speed; varying float vA;
      void main() {
        float t = time * speed;
        vec3 p = position + vec3(
          sin(t * (0.21 + aSeed.x * 0.2) + aSeed.y * 30.0) * 0.9,
          sin(t * (0.37 + aSeed.z * 0.3) + aSeed.x * 20.0) * 0.35,
          cos(t * (0.19 + aSeed.y * 0.2) + aSeed.z * 25.0) * 0.9);
        vA = pow(0.5 + 0.5 * sin(t * (0.9 + aSeed.x) + aSeed.z * 50.0), 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (12.0 + aSeed.y * 8.0) * pr * 10.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = exp(-d * d * 60.0), halo = exp(-d * d * 12.0) * 0.3;
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.45) * (core * 1.4 + halo) * vA, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.layers.set(1);
  scene.add(pts);
}

// ---- 燈火搖曳：點光源強度與火袋亮度用雜訊輕微起伏 ----
function flicker() {
  if (reduceMotion) return;
  flames.forEach((f, i) => { f.ph = i * 17.3; });
  onTick(t => {
    for (const f of flames) {
      const n = 0.9 + 0.1 * noise3(t * 4.0, f.ph, 0) + 0.04 * noise3(t * 11.0, f.ph, 3);
      if (f.light) f.light.intensity = f.base * n;
      if (f.mat) f.mat.color.set(f.color).multiplyScalar(f.k * n);
    }
  });
}

// 氛圍：低處飄移的薄霧、浮島下方流動的雲海、庭園裡稀疏的螢火光點、燈火搖曳
// 月亮、太陽與星星在 src/engine/sky.js；薄霧與雲海的顏色跟著天色（SKY.now）變化，螢火只在晴朗的夜裡出現
// 透明與發光的東西全放在圖層 1（不進 AO 的法線階段）
import * as THREE from 'three';
import { scene, U, DPR, PI, reduceMotion, onTick } from '../../engine/context.js';
import { rng, rand } from '../../engine/random.js';
import { noise3, fbm3 } from '../../engine/noise.js';
import { canvasTex } from '../../engine/canvas.js';
import { ENV, lampK } from '../../engine/env.js';
import { SKY } from '../../engine/sky.js';
import { flames } from './garden.js';
import { W } from './wind.js';
import { heightAt } from './terrain.js';
import { LV, POND, FALL } from './layout.js';

export function buildAtmosphere() {
  mist();
  cloudSea();
  fireflies();
  flicker();
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
  onTick(t => {
    const g = W.gust.value, d = W.dir.value, k = SKY.now.mistK * (1 + 0.6 * ENV.rain + 0.3 * ENV.snow);   // 雨雪天水氣重
    for (const p of patches) {
      p.m.material.color.copy(SKY.now.mist);
      if (reduceMotion) { p.m.material.opacity = p.op * k; continue; }
      p.m.position.x = p.x + Math.sin(t * p.sp + p.ph) * 0.8 + d.x * g * 0.6;
      p.m.position.z = p.z + Math.cos(t * p.sp * 0.8 + p.ph) * 0.5 + d.y * g * 0.6;
      p.m.material.opacity = p.op * k * (0.75 + 0.25 * Math.sin(t * 0.3 + p.ph)) * (1 - g * 0.4);
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
  onTick(t => layers.forEach((l, i) => {
    l.m.material.color.copy(SKY.now.clouds[i]);
    if (!reduceMotion) l.m.rotation.z = t * l.sp;
  }));
}

// ---- 螢火光點：稀疏、緩慢、偏暗，只在庭園低處；天亮或下雨下雪就不見 ----
function fireflies() {
  const vis = { value: 1 };
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
    uniforms: { time: U.time, pr: { value: DPR }, speed: { value: reduceMotion ? 0.2 : 0.6 }, vis },
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float time, pr, speed, vis; varying float vA;
      void main() {
        float t = time * speed;
        vec3 p = position + vec3(
          sin(t * (0.21 + aSeed.x * 0.2) + aSeed.y * 30.0) * 0.9,
          sin(t * (0.37 + aSeed.z * 0.3) + aSeed.x * 20.0) * 0.35,
          cos(t * (0.19 + aSeed.y * 0.2) + aSeed.z * 25.0) * 0.9);
        vA = pow(0.5 + 0.5 * sin(t * (0.9 + aSeed.x) + aSeed.z * 50.0), 2.0) * vis;
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
  onTick(() => {
    vis.value = (1 - ENV.day) * (1 - Math.max(ENV.rain, ENV.snow));
    pts.visible = vis.value > 0.01;
  });
}

// ---- 燈火搖曳：點光源強度與火袋亮度用雜訊輕微起伏；天亮熄燈，白天的火袋只剩紙的顏色 ----
function flicker() {
  flames.forEach((f, i) => { f.ph = i * 17.3; });
  onTick(t => {
    const lit = ENV.lamps, paper = lampK(0.35);
    for (const f of flames) {
      const n = reduceMotion ? 1 : 0.9 + 0.1 * noise3(t * 4.0, f.ph, 0) + 0.04 * noise3(t * 11.0, f.ph, 3);
      if (f.light) f.light.intensity = f.base * n * lit;
      if (f.mat) f.mat.color.set(f.color).multiplyScalar(f.k * n * paper);
    }
  });
}

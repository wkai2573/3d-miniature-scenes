// 底座、地面彩繪貼圖、濕地反射、路緣石
// 座標：1 單位 = 1 公尺；底座範圍 x、z 皆為 -14 ~ 14；+z 朝大馬路（相機所在側）
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { scene, U, DPR, PI, onTick } from '../../engine/context.js';
import { onResize } from '../../engine/renderer.js';
import { rng, rand, pick } from '../../engine/random.js';
import { canvasTex, txt } from '../../engine/canvas.js';
import { toon } from '../../engine/materials.js';
import { box } from '../../engine/geometry.js';
import { WetShader } from './shaders/wetGround.js';
import { ENV, EU } from '../../engine/env.js';

export const HALF = 14;

// 水窪位置 [x, z, 半徑x, 半徑z]
const PUDDLES = [
  [2.6, 4.3, 1.7, 0.9], [-1.6, 4.9, 0.9, 0.5], [-3.8, 8.6, 1.5, 0.6], [5.0, 10.9, 1.2, 0.7],
  [-9.8, 11.4, 1.9, 0.8], [0.8, 12.2, 1.3, 0.5], [9.1, -1.6, 0.9, 1.7], [11.3, -9.2, 0.8, 1.3],
  [-7.4, -2.6, 0.7, 1.5], [5.4, -2.2, 0.8, 0.6], [7.0, 6.95, 0.7, 0.4], [10.6, 9.8, 1.1, 0.6],
];

// ---- 地面彩繪：世界座標 → 2048px 畫布 ----
const GS = 2048, PXM = GS / 28;
const P = v => (v + HALF) * PXM;
const fillR = (g, x0, z0, x1, z1) => g.fillRect(P(x0), P(z0), (x1 - x0) * PXM, (z1 - z0) * PXM);

function speckle(g, x0, z0, x1, z1, n, cols) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = pick(cols);
    const s = rand(1, 2.6);
    g.fillRect(P(rand(x0, x1)), P(rand(z0, z1)), s, s);
  }
}
function tiles(g, x0, z0, x1, z1, base, line, step = 0.5) {
  g.fillStyle = base; fillR(g, x0, z0, x1, z1);
  for (let x = x0; x < x1 - 1e-6; x += step) for (let z = z0; z < z1 - 1e-6; z += step) {
    if (rng() < 0.3) { g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.03)'; fillR(g, x, z, Math.min(x + step, x1), Math.min(z + step, z1)); }
  }
  g.strokeStyle = line; g.lineWidth = 1.5; g.beginPath();
  for (let x = x0; x <= x1 + 1e-6; x += step) { g.moveTo(P(x), P(z0)); g.lineTo(P(x), P(z1)); }
  for (let z = z0; z <= z1 + 1e-6; z += step) { g.moveTo(P(x0), P(z)); g.lineTo(P(x1), P(z)); }
  g.stroke();
}
function manhole(g, x, z, r) {
  g.fillStyle = '#3a404d'; g.beginPath(); g.arc(P(x), P(z), r * PXM, 0, PI * 2); g.fill();
  g.strokeStyle = '#262b37'; g.lineWidth = 2;
  for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(P(x), P(z), r * PXM * k / 3.3, 0, PI * 2); g.stroke(); }
  g.save(); g.beginPath(); g.arc(P(x), P(z), r * PXM * 0.9, 0, PI * 2); g.clip();
  for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(P(x) + i * 5 - 40, P(z) - 40); g.lineTo(P(x) + i * 5 + 40, P(z) + 40); g.stroke(); }
  g.restore();
}
function grate(g, x0, z0, x1, z1, alongX) {
  g.fillStyle = '#5a5f6a'; fillR(g, x0, z0, x1, z1);
  g.fillStyle = '#151922';
  const n = 9;
  for (let i = 0; i < n; i++) {
    if (alongX) fillR(g, x0 + 0.03, z0 + (z1 - z0) * (i + 0.2) / n, x1 - 0.03, z0 + (z1 - z0) * (i + 0.75) / n);
    else fillR(g, x0 + (x1 - x0) * (i + 0.2) / n, z0 + 0.03, x0 + (x1 - x0) * (i + 0.75) / n, z1 - 0.03);
  }
}

function paintGround(g) {
  const R = (c, x0, z0, x1, z1) => { g.fillStyle = c; fillR(g, x0, z0, x1, z1); };
  R('#3e4452', -14, -14, 14, 14);
  // 公寓地坪與民宅庭院
  R('#464b57', -14, -14, -8.6, 6.2); speckle(g, -14, -14, -8.6, 6.2, 2500, ['#3d424e', '#3a3f4a', '#4b505c']);
  R('#33413c', -6.2, -14, 6.3, -7.8); speckle(g, -6.2, -14, 6.3, -7.8, 1600, ['#2b3833', '#3c4a44']);
  // 便利商店停車場（混凝土）
  R('#4f5666', -6.2, -7.8, 6.3, 6.2);
  g.strokeStyle = 'rgba(20,24,34,0.35)'; g.lineWidth = 2; g.beginPath();
  for (let x = -6.2; x <= 6.3; x += 2.5) { g.moveTo(P(x), P(-7.8)); g.lineTo(P(x), P(6.2)); }
  for (let z = -7.8; z <= 6.2; z += 2.5) { g.moveTo(P(-6.2), P(z)); g.lineTo(P(6.3), P(z)); }
  g.stroke();
  speckle(g, -6.2, -7.8, 6.3, 6.2, 3000, ['#475061', '#5a6272']);
  // 小巷（舊柏油）
  R('#353b4a', -8.6, -14, -6.2, 6.2); speckle(g, -8.6, -14, -6.2, 6.2, 1800, ['#2e3441', '#3d4353']);
  R('#303644', -8.4, -6.5, -6.6, -4.2); R('#3a4050', -8.1, 1.0, -6.9, 2.6);
  // 馬路與車轍
  R('#2b3141', -14, 7.6, 14, 13.2); R('#2b3141', 7.8, -14, 12.4, 7.6);
  speckle(g, -14, 7.6, 14, 13.2, 9000, ['#353b4b', '#232838', '#3a4050']);
  speckle(g, 7.8, -14, 12.4, 7.6, 7000, ['#353b4b', '#232838', '#3a4050']);
  g.fillStyle = 'rgba(12,15,24,0.2)';
  fillR(g, -14, 8.6, 14, 9.3); fillR(g, -14, 11.5, 14, 12.2); fillR(g, 8.9, -14, 9.5, 3.4); fillR(g, 10.8, -14, 11.4, 3.4);
  // 人行道
  tiles(g, -14, 6.2, 7.8, 7.6, '#5a6070', '#4a505f');
  tiles(g, 6.3, -14, 7.8, 6.2, '#5a6070', '#4a505f');
  tiles(g, -14, 13.2, 14, 14, '#555b6a', '#474d5b');
  tiles(g, 12.4, -14, 14, 7.6, '#555b6a', '#474d5b');
  // 點字磚
  const tactile = (x0, z0, x1, z1) => {
    R('#c9a43e', x0, z0, x1, z1);
    g.fillStyle = 'rgba(255,232,150,0.6)';
    for (let x = x0 + 0.07; x < x1; x += 0.14) for (let z = z0 + 0.07; z < z1; z += 0.14) { g.beginPath(); g.arc(P(x), P(z), 2.3, 0, PI * 2); g.fill(); }
  };
  tactile(3.4, 6.3, 6.4, 6.6); tactile(6.45, 4.2, 6.75, 6.8); tactile(3.4, 13.3, 6.4, 13.6);
  R('#c29f3c', -14, 6.72, 3.4, 6.95);
  g.fillStyle = 'rgba(255,232,150,0.5)';
  for (let x = -14; x < 3.4; x += 0.3) { fillR(g, x + 0.02, 6.76, x + 0.26, 6.8); fillR(g, x + 0.02, 6.87, x + 0.26, 6.91); }
  // 標線
  const W = '#dde2ea';
  for (let x = -14; x < 14; x += 5) R(W, x, 10.34, x + 3, 10.46);
  R(W, -14, 7.86, 7.8, 7.98); R(W, 12.4, 7.86, 14, 7.98); R(W, -14, 12.82, 14, 12.94);
  R(W, 8.02, -14, 8.14, 3.4); R(W, 12.06, -14, 12.18, 3.4);
  for (let z = 8.1; z + 0.45 <= 12.95; z += 0.9) R(W, 3.4, z, 6.4, z + 0.45);
  for (let x = 8.15; x + 0.45 <= 12.25; x += 0.9) R(W, x, 4.2, x + 0.45, 6.8);
  R(W, 8.1, 3.4, 12.1, 3.85);
  // 「止まれ」路面字：給往 +z 行駛的駕駛看，所以對相機來說是倒著的
  g.save(); g.translate(P(10.1), P(1.5)); g.rotate(PI); g.scale(1, 2.3);
  txt(g, '止まれ', 0, 0, 0.95 * PXM, W, 900); g.restore();
  // 停車格與油漬
  for (const x of [-6.0, -3.6, -1.2, 1.2]) R(W, x - 0.06, 2.6, x + 0.06, 6.0);
  R(W, -6.0, 5.94, 1.2, 6.0);
  g.fillStyle = 'rgba(10,12,20,0.22)';
  for (const cx of [-4.8, -2.4, 0.0]) { g.beginPath(); g.ellipse(P(cx + 0.1), P(4.4), 0.45 * PXM, 0.8 * PXM, 0, 0, PI * 2); g.fill(); }
  // 人孔蓋、集水格柵
  manhole(g, 1.5, 10.2, 0.35); manhole(g, 10.1, -6.4, 0.35); manhole(g, -7.4, -9.5, 0.3); manhole(g, -10.5, 9.4, 0.3);
  for (const z of [-12, -8, -4, 0.3]) grate(g, 7.84, z, 8.0, z + 0.6, false);
  for (const x of [-12, -7, -1.5]) grate(g, x, 7.63, x + 0.6, 7.82, true);
  // 屋簷下的乾燥帶
  R('rgba(255,240,220,0.05)', -6.2, 1.0, 5.1, 2.35);
  // 水窪處的地面也壓暗
  for (const [x, z, rx, rz] of PUDDLES) {
    g.save(); g.translate(P(x), P(z)); g.scale(rx, rz);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, PXM);
    gr.addColorStop(0, 'rgba(10,14,26,0.55)'); gr.addColorStop(0.7, 'rgba(10,14,26,0.4)'); gr.addColorStop(1, 'rgba(10,14,26,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, PXM, 0, PI * 2); g.fill(); g.restore();
  }
  // 小巷裂縫
  g.strokeStyle = 'rgba(18,20,28,0.6)'; g.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    let x = rand(-8.4, -6.4), z = rand(-13, 5);
    g.beginPath(); g.moveTo(P(x), P(z));
    for (let k = 0; k < 5; k++) { x += rand(-0.25, 0.25); z += rand(0.1, 0.4); g.lineTo(P(x), P(z)); }
    g.stroke();
  }
}

// ---- 濕度遮罩（R 通道：0 乾 ~ 1 水窪）----
function makeWetMask() {
  const MS = 512, MPX = MS / 28, MP = v => (v + HALF) * MPX;
  const c = document.createElement('canvas'); c.width = c.height = MS;
  const g = c.getContext('2d');
  const R = (v, x0, z0, x1, z1) => { g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(MP(x0), MP(z0), (x1 - x0) * MPX, (z1 - z0) * MPX); };
  R(95, -14, -14, 14, 14);
  R(125, -14, 7.6, 14, 13.2); R(125, 7.8, -14, 12.4, 7.6);
  R(110, -8.6, -14, -6.2, 6.2);
  R(105, -6.2, 1, 6.3, 6.2);
  R(40, -6.2, -14, 6.3, -7.8);
  R(18, -6.4, 0.9, 5.15, 2.4); R(18, 3.9, -3.0, 5.15, 1.0);   // 雨棚下
  for (let z = 8.1; z + 0.45 <= 12.95; z += 0.9) R(165, 3.4, z, 6.4, z + 0.45);
  for (let x = 8.15; x + 0.45 <= 12.25; x += 0.9) R(165, x, 4.2, x + 0.45, 6.8);
  for (const [x, z, rx, rz] of PUDDLES) {
    for (let k = 0; k < 5; k++) {
      const ox = rand(-0.35, 0.35) * rx, oz = rand(-0.35, 0.35) * rz, s = rand(0.6, 1.0);
      g.save(); g.translate(MP(x + ox), MP(z + oz)); g.scale(rx * s, rz * s);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, MPX);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.92)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, MPX, 0, PI * 2); g.fill(); g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function buildBase() {
  // 底座
  box(28, 0.448, 28, '#3b3530', 0, -0.45, 0, { t: 0.035 });            // 土層斷面
  box(29.0, 0.95, 29.0, '#2f221c', 0, -1.4, 0, { t: 0.04 });            // 胡桃木台座
  box(29.04, 0.05, 29.04, '#7a6148', 0, -0.5, 0, { outline: false });   // 銅色飾條
  box(29.5, 0.14, 29.5, '#3e2d24', 0, -1.54, 0, { t: 0.03 });

  // 地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), toon('#ffffff', { map: canvasTex(GS, GS, paintGround, { aniso: 16 }) }));
  ground.rotation.x = -PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 濕地反射（圖層 0 的物件才會被反射）；濕度跟著天氣變化
  const REFL_SCALE = 0.5;
  const wet = new Reflector(new THREE.PlaneGeometry(28, 28), {
    textureWidth: Math.round(innerWidth * DPR * REFL_SCALE),
    textureHeight: Math.round(innerHeight * DPR * REFL_SCALE),
    clipBias: 0.003, color: 0x94a0bd, multisample: 0, shader: WetShader,
  });
  wet.rotation.x = -PI / 2;
  wet.position.y = 0.012;
  wet.material.transparent = true;
  wet.material.depthWrite = false;
  wet.material.uniforms.tMask.value = makeWetMask();
  wet.material.uniforms.time = U.time;
  wet.material.uniforms.wet = EU.wet;
  wet.material.uniforms.rain = EU.rain;
  wet.userData.dynamic = true;
  scene.add(wet);
  onTick(() => { wet.visible = ENV.wet > 0.004; });   // 路面乾了就不必再算反射
  onResize((w, h) => wet.getRenderTarget().setSize(Math.round(w * DPR * REFL_SCALE), Math.round(h * DPR * REFL_SCALE)));

  // 路緣石、輪擋
  const curb = (x0, z0, x1, z1) => box(+(x1 - x0).toFixed(3), 0.1, +(z1 - z0).toFixed(3), '#8d93a3', (x0 + x1) / 2, 0, (z0 + z1) / 2, { t: 0.012 });
  curb(-14, 7.48, 3.4, 7.62); curb(6.4, 7.48, 7.8, 7.62);
  curb(7.68, -14, 7.82, 4.2); curb(7.68, 6.8, 7.82, 7.48);
  curb(-14, 13.18, 3.4, 13.3); curb(6.4, 13.18, 14, 13.3);
  curb(12.38, -14, 12.5, 4.2); curb(12.38, 6.8, 12.5, 7.6);
  for (const cx of [-4.8, -2.4, 0.0]) box(1.3, 0.12, 0.16, '#b9bcc4', cx, 0, 2.95, { t: 0.012 });
}

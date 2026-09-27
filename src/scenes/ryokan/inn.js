// 溫泉旅館「紅葉屋」：二層主屋、入母屋屋頂、障子、緣側、玄關（暖簾、看板、行燈）、渡り廊下、湯屋
import * as THREE from 'three';
import { PI } from '../../engine/context.js';
import { pLight } from '../../engine/lights.js';
import { canvasTex, txt } from '../../engine/canvas.js';
import { soft, glow } from '../../engine/materials.js';
import { box, plane, rod, hipRoof, irimoyaRoof } from '../../engine/geometry.js';
import { lightPool, roofMats, plankMat } from './shapes.js';
import { C } from './palette.js';
import { INN, ANNEX } from './layout.js';

// ---- 貼圖 ----
function makeTextures() {
  const shoji = (bright) => canvasTex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, bright ? '#fff3d6' : '#ffe6b8'); gr.addColorStop(1, bright ? '#ffd79a' : '#f5c27e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6446'; g.lineWidth = 3;
    for (let x = w / 4; x < w; x += w / 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h * 0.82); g.stroke(); }
    for (let y = h / 7; y < h * 0.82; y += h / 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#6b4a36'; g.fillRect(0, h * 0.82, w, h * 0.18);            // 腰板
    g.strokeStyle = '#4a3326'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  });
  const genkan = canvasTex(160, 160, (g, w, h) => {          // 玄關格子拉門
    g.fillStyle = '#ffd08a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4a3326'; g.lineWidth = 5;
    for (let x = 0; x <= w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 12; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  });
  const noren = (bg, fg) => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, w, 14);
    txt(g, 'ゆ', w / 2, h / 2 + 8, 84, fg, 900);
    g.globalCompositeOperation = 'destination-out';          // 三片之間的開縫
    g.fillRect(w / 3 - 3, 22, 6, h); g.fillRect(2 * w / 3 - 3, 22, 6, h);
  });
  const sign = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#3a2618'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6446'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    txt(g, '紅葉屋', w / 2, h / 2 + 3, 56, '#f3e2c0', 900);
  });
  return { shoji: shoji(true), shojiDim: shoji(false), genkan, noren, sign };
}

export function buildInn() {
  const T = makeTextures();
  const shojiMat = glow('#ffffff', 1.05, { map: T.shoji });
  const shojiDim = glow('#ffffff', 0.85, { map: T.shojiDim });
  const roofs = roofMats(C);
  const planks = plankMat(C);
  const cx = (INN.x0 + INN.x1) / 2, cz = (INN.z0 + INN.z1) / 2;
  const W = INN.x1 - INN.x0, D = INN.z1 - INN.z0, B = INN.base;

  // ---- 地基與一樓 ----
  box(W + 0.4, B, D + 0.4, C.stone, cx, 0, cz, { cast: true });
  box(W, 2.7, D, C.plaster, cx, B, cz, { cast: true });
  const zf = INN.z1 + 0.03;
  for (let i = 0; i <= 8; i++) box(0.18, 2.7, 0.18, C.woodDark, INN.x0 + i * 1.25, B, zf);
  box(W + 0.1, 0.2, 0.16, C.wood, cx, 2.6, zf + 0.02);
  box(W + 0.1, 0.14, 0.16, C.wood, cx, B, zf + 0.02);
  for (let i = 0; i < 8; i++) {
    if (i === 3 || i === 4) continue;                         // 玄關
    const bx = INN.x0 + 0.625 + i * 1.25;
    plane(1.07, 2.0, i % 3 === 1 ? shojiDim : shojiMat, bx, B + 1.08, INN.z1 + 0.015);
    box(1.07, 0.06, 0.08, C.woodDark, bx, 2.52, zf + 0.02);   // 欄間
  }
  // 右側面（x = INN.x1）
  const xr = INN.x1 + 0.03;
  for (let i = 0; i <= 4; i++) box(0.18, 2.7, 0.18, C.woodDark, xr, B, INN.z0 + i * 1.25);
  box(0.16, 0.2, D + 0.1, C.wood, xr + 0.02, 2.6, cz);
  for (const i of [0, 3]) plane(1.07, 2.0, shojiMat, INN.x1 + 0.015, B + 1.08, INN.z0 + 0.625 + i * 1.25, { ry: PI / 2 });
  plane(2.3, 2.05, glow('#ffffff', 0.9, { map: T.genkan }), INN.x1 + 0.015, B + 1.05, -6.0, { ry: PI / 2 });   // 通往連廊

  // ---- 緣側 ----
  box(W + 0.4, 0.12, 1.1, planks, cx, B - 0.12, INN.z1 + 0.55, { cast: true });
  for (let i = 0; i <= 8; i++) box(0.12, B - 0.12, 0.12, C.woodDark, INN.x0 - 0.1 + i * 1.3, 0, INN.z1 + 1.0);
  box(W + 0.4, 0.1, 0.1, C.woodDark, cx, B - 0.22, INN.z1 + 1.05);

  // ---- 一樓屋簷（下屋）與二樓 ----
  hipRoof(W + 1.6, D + 2.6, 1.2, roofs.roof, cx, 3.1, cz);
  const w2 = 8.4, d2 = 3.9, cz2 = cz - 0.1, z2 = cz2 + d2 / 2;
  box(w2, 2.5, d2, C.plaster, cx, 3.15, cz2, { cast: true });
  for (let i = 0; i <= 7; i++) box(0.16, 2.5, 0.16, C.woodDark, cx - w2 / 2 + i * 1.2, 3.15, z2 + 0.02);
  box(w2 + 0.1, 0.16, 0.14, C.wood, cx, 5.38, z2 + 0.03);
  for (let i = 0; i < 7; i++) plane(1.02, 1.35, i === 2 || i === 5 ? shojiDim : shojiMat, cx - w2 / 2 + 0.6 + i * 1.2, 4.62, z2 + 0.012);
  // 二樓欄杆
  box(w2, 0.06, 0.06, C.woodDark, cx, 4.3, z2 + 0.28);
  for (let i = 0; i <= 14; i++) box(0.04, 0.4, 0.04, C.woodDark, cx - w2 / 2 + i * 0.6, 3.92, z2 + 0.28);
  // 二樓右側
  for (let i = 0; i <= 3; i++) box(0.16, 2.5, 0.16, C.woodDark, cx + w2 / 2 + 0.02, 3.15, cz2 - d2 / 2 + i * 1.3);
  plane(1.1, 1.35, shojiMat, cx + w2 / 2 + 0.012, 4.62, cz2 - 0.65, { ry: PI / 2 });
  plane(1.1, 1.35, shojiDim, cx + w2 / 2 + 0.012, 4.62, cz2 + 0.65, { ry: PI / 2 });
  irimoyaRoof(w2 + 2.0, d2 + 2.5, 2.3, roofs, cx, 5.65, cz2, { hip: 0.42, thick: 0.18 });

  // ---- 玄關 ----
  const gx = -2.5, gz = INN.z1;
  plane(2.3, 2.05, glow('#ffffff', 1.15, { map: T.genkan }), gx, B + 1.04, gz + 0.013);
  for (const x of [gx - 1.2, gx + 1.2]) box(0.2, 2.75, 0.2, C.woodDark, x, 0, gz + 1.25, { cast: true });
  box(2.8, 0.22, 0.24, C.wood, gx, 2.6, gz + 1.25);
  irimoyaRoof(2.9, 3.3, 1.15, roofs, gx, 2.82, gz + 1.0, { ry: PI / 2, hip: 0.35, thick: 0.14 });
  const noren = soft('#ffffff', { map: T.noren(C.noren, '#f4efe4'), side: THREE.DoubleSide, alphaTest: 0.5, emissive: '#1a1f38', ei: 0.6, noCache: true });
  plane(1.9, 0.85, noren, gx, 2.15, gz + 0.2);
  rod([gx - 1.0, 2.58, gz + 0.2], [gx + 1.0, 2.58, gz + 0.2], 0.025, C.woodDark);
  // 扁額掛在玄關屋頂正面的山牆三角上（屋頂內側從斜上方看不到）
  plane(0.9, 0.34, soft('#ffffff', { map: T.sign, emissive: '#2a1a10', ei: 0.5 }), gx, 3.4, gz + 1.9);
  box(1.4, 0.2, 0.7, C.stoneWarm, gx, 0, gz + 1.45, { cast: true });    // 沓脫石
  // 行燈
  const andon = glow(C.shoji, 1.7);
  for (const x of [gx - 1.85, gx + 1.85]) {
    box(0.4, 0.08, 0.4, C.woodDark, x, 0, gz + 1.6);
    box(0.3, 0.62, 0.3, andon, x, 0.08, gz + 1.6, { cast: false });
    for (const [dx, dz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) box(0.04, 0.75, 0.04, C.woodDark, x + dx, 0.05, gz + 1.6 + dz);
    box(0.4, 0.05, 0.4, C.woodDark, x, 0.78, gz + 1.6);
  }
  // 軒燈
  const eaveLamp = glow(C.lamp, 2.0);
  for (const x of [INN.x0 - 0.3, INN.x1 + 0.3]) {
    rod([x, 3.05, gz + 1.0], [x, 2.75, gz + 1.0], 0.012, C.woodDark, { outline: false });
    box(0.2, 0.28, 0.2, eaveLamp, x, 2.47, gz + 1.0);
  }

  // 燈光：障子透出的光、玄關、二樓
  pLight(C.shoji, 12, -5.6, 1.7, INN.z1 + 0.5, 8);
  pLight(C.shoji, 12, 0.7, 1.7, INN.z1 + 0.5, 8);
  pLight(C.lamp, 14, gx, 1.9, gz + 1.8, 8);
  pLight(C.shoji, 10, cx, 4.6, z2 + 0.6, 8);
  lightPool(-5.0, INN.z1 + 1.8, 2.2, 0.35);
  lightPool(0.4, INN.z1 + 1.8, 2.2, 0.35);
  lightPool(gx, gz + 2.1, 1.8, 0.45);

  buildCorridor(roofs, planks);
  buildAnnex(roofs, shojiMat, T);
}

// ---- 渡り廊下（主屋 → 湯屋）----
function buildCorridor(roofs, planks) {
  const x0 = INN.x1, x1 = ANNEX.x0, cx = (x0 + x1) / 2, z = -6.0;
  box(x1 - x0 + 0.1, 0.12, 1.5, planks, cx, INN.base - 0.12, z, { cast: true });
  for (const x of [x0 + 0.15, x1 - 0.15]) for (const dz of [-0.68, 0.68]) box(0.14, 2.45, 0.14, C.woodDark, x, 0, z + dz, { cast: true });
  for (const dz of [-0.68, 0.68]) {
    box(x1 - x0, 0.07, 0.06, C.woodDark, cx, 1.05, z + dz);
    box(x1 - x0, 0.1, 0.1, C.wood, cx, 2.4, z + dz);
  }
  irimoyaRoof(x1 - x0 + 0.9, 2.2, 0.75, roofs, cx, 2.52, z, { hip: 0.3, thick: 0.12 });
}

// ---- 湯屋（脫衣所），正面朝向露天風呂 ----
function buildAnnex(roofs, shojiMat, T) {
  const { x0, x1, z0, z1 } = ANNEX, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  box(W + 0.3, 0.35, D + 0.3, C.stone, cx, 0, cz, { cast: true });
  box(W, 2.45, D, C.plaster, cx, 0.35, cz, { cast: true });
  box(W + 0.04, 0.95, D + 0.04, C.wood, cx, 0.35, cz);                  // 腰壁
  for (let i = 0; i <= 4; i++) box(0.16, 2.45, 0.16, C.woodDark, x0 + i * W / 4, 0.35, z1 + 0.02);
  box(W + 0.1, 0.16, 0.14, C.wood, cx, 2.62, z1 + 0.03);
  // 入口：紅色「ゆ」暖簾
  plane(1.0, 2.0, glow('#ffffff', 1.1, { map: T.genkan }), cx, 1.35, z1 + 0.013);
  const redNoren = soft('#ffffff', { map: T.noren('#a8322a', '#fff4e6'), side: THREE.DoubleSide, alphaTest: 0.5, emissive: '#301010', ei: 0.6, noCache: true });
  plane(1.1, 0.7, redNoren, cx, 2.2, z1 + 0.14);
  for (const x of [x0 + W / 8, x1 - W / 8]) plane(0.85, 0.9, shojiMat, x, 1.75, z1 + 0.013);
  plane(1.4, 0.8, glow('#ffffff', 0.9, { map: T.genkan }), x1 + 0.013, 1.8, cz, { ry: PI / 2 });
  irimoyaRoof(W + 1.2, D + 1.3, 1.9, roofs, cx, 2.78, cz, { hip: 0.45, thick: 0.16 });
  pLight(C.shoji, 10, cx, 1.6, z1 + 0.6, 7);
}

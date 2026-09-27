// 周邊建築：公寓「月見荘」、後方民宅、側街對面的圍牆與植栽
import * as THREE from 'three';
import { PI } from '../../engine/context.js';
import { rand, pick } from '../../engine/random.js';
import { canvasTex, txt } from '../../engine/canvas.js';
import { toon, glow } from '../../engine/materials.js';
import { G, add, box, cyl, plane, grp, hipRoof } from '../../engine/geometry.js';
import { acUnit, bicycle } from './props.js';

export function buildBuildings() {
  const win = makeWindowMaterials();
  buildApartment(win);
  buildHouse(win);
  buildFarWall();
}

function makeWindowMaterials() {
  const curtain = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ffe2ae'); gr.addColorStop(1, '#f2b872');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,90,40,0.25)'; g.lineWidth = 3;
    for (let x = 6; x < w; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 2, h); g.stroke(); }
    g.fillStyle = '#6b5a4a'; g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(0, h / 2 - 3, w, 6);
    g.strokeStyle = '#6b5a4a'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  });
  const curtain2 = canvasTex(128, 128, (g, w, h) => {   // 窗邊有盆栽剪影
    g.fillStyle = '#fff0d0'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,80,50,0.35)'; g.fillRect(14, 70, 30, 40); g.beginPath(); g.arc(29, 60, 18, 0, PI * 2); g.fill();
    g.fillStyle = '#6b5a4a'; g.fillRect(w / 2 - 3, 0, 6, h);
    g.strokeStyle = '#6b5a4a'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  });
  const dark = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#243049'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(160,190,240,0.18)'; g.beginPath(); g.moveTo(20, 0); g.lineTo(50, 0); g.lineTo(10, h); g.lineTo(-20, h); g.fill();
    g.fillStyle = '#5d6470'; g.fillRect(w / 2 - 3, 0, 6, h);
    g.strokeStyle = '#5d6470'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  });
  const shutter = canvasTex(128, 128, (g, w, h) => {   // 雨戶
    g.fillStyle = '#8f949c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a8088'; for (let y = 0; y < h; y += 10) g.fillRect(0, y, w, 3);
    g.strokeStyle = '#5d6470'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  });
  return {
    lit: glow('#ffffff', 1.05, { map: curtain }),
    lit2: glow('#ffffff', 0.95, { map: curtain2 }),
    dark: toon('#ffffff', { map: dark, emissive: '#0a1020', ei: 0.4 }),
    shutter: toon('#ffffff', { map: shutter }),
  };
}

function tree(x, z, s = 1) {
  cyl(0.09 * s, 0.13 * s, 2.2 * s, '#5a4636', x, 0, z, { seg: 8, cast: true });
  const leaf = ['#2e4b3c', '#35584a', '#3d6450'];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(G('leaf', () => new THREE.IcosahedronGeometry(1, 1)), toon(pick(leaf)));
    m.scale.setScalar(rand(0.55, 0.85) * s);
    m.position.set(x + rand(-0.5, 0.5) * s, (2.3 + rand(0, 1.0)) * s, z + rand(-0.5, 0.5) * s);
    add(m, { cast: true, t: 0.03 });
  }
}

// ---- 三層公寓：外走廊朝向小巷（+x），樓梯間在前端 ----
function buildApartment(win) {
  const AX = -11.8, AZ = -5.9;
  box(3.6, 8.4, 15, '#bdb6a8', AX, 0, AZ, { cast: true, t: 0.04 });
  for (const y of [2.8, 5.6]) box(3.66, 0.14, 15.06, '#a39c8e', AX, y, AZ, { t: 0.015 });
  box(3.72, 0.3, 15.12, '#a8a192', AX, 8.4, AZ, { t: 0.02 });
  cyl(0.6, 0.6, 1.1, '#cfd3d6', -12.4, 8.75, -10.5, { cast: true });   // 屋頂水塔
  for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(0.06, 0.06, 0.06, '#8a8f98', -12.4 + dx, 8.7, -10.5 + dz, { outline: false });

  // 外走廊
  for (const y of [2.7, 5.5, 8.25]) box(1.2, 0.18, 15, '#c9c3b6', -9.4, y, AZ, { cast: true, t: 0.02 });
  for (const y of [2.7, 5.5]) box(0.08, 1.0, 15, '#d9d4c9', -8.84, y + 0.18, AZ, { t: 0.015 });
  for (const z of [-13.3, AZ, 1.5]) box(0.2, 8.25, 0.2, '#c9c3b6', -8.9, 0, z, { t: 0.02 });
  const corrLight = glow('#e8f4ff', 1.9);
  const units = [-11.5, -7.7, -3.9, -0.1];
  const litPlan = [[1, 0, 1, 0], [0, 1, 0, 0], [0, 0, 1, 1]];   // 哪幾戶還亮著燈
  for (let f = 0; f < 3; f++) {
    const yb = f * 2.8;
    units.forEach((c, u) => {
      box(0.06, 1.95, 0.85, '#3f5f6b', -9.98, yb + 0.05, c - 0.8, { t: 0.01 });
      box(0.02, 0.06, 0.12, '#d6dce2', -9.94, yb + 1.0, c - 0.5, { outline: false });
      plane(0.9, 0.6, litPlan[f][u] ? (u % 2 ? win.lit2 : win.lit) : win.dark, -9.985, yb + 1.55, c + 0.6, { ry: PI / 2 });
      box(0.05, 0.3, 0.25, '#b9bcc0', -9.97, yb + 1.5, c - 0.05, { t: 0.008 });
      box(0.28, 0.05, 0.1, corrLight, -9.6, yb + 2.63, c, { outline: false });
    });
  }
  // 倚在門邊的透明傘
  const umb = grp(-9.85, 2.9, -7.1); umb.rotation.z = -0.18;
  cyl(0.045, 0.012, 0.72, toon('#dfe8ef', { opacity: 0.7 }), 0, 0, 0, { parent: umb, seg: 8 });

  // 樓梯間（夜燈從縫窗透出）
  box(1.4, 8.6, 1.8, '#b3ac9e', -9.5, 0, 2.5, { cast: true, t: 0.035 });
  const stairGlow = glow('#dff0ff', 1.4);
  for (const y of [1.4, 4.2, 7.0]) {
    plane(0.22, 1.7, stairGlow, -8.795, y, 2.5, { ry: PI / 2 });
    plane(0.9, 0.22, stairGlow, -9.5, y + 0.9, 3.405);
  }

  // 面向大馬路的窗戶與室外機
  const frontPlan = [[win.dark, win.lit], [win.lit2, win.dark], [win.dark, win.dark]];
  for (let f = 0; f < 3; f++) {
    const yb = f * 2.8;
    [-12.8, -11.0].forEach((x, i) => {
      plane(0.95, 1.05, frontPlan[f][i], x, yb + 1.6, 1.605);
      box(1.05, 0.05, 0.12, '#8a8f98', x, yb + 1.05, 1.66, { t: 0.008 });
      box(1.05, 0.06, 0.1, '#8a8f98', x, yb + 2.15, 1.65, { t: 0.008 });
    });
    if (f > 0) { acUnit(-12.0, yb + 0.25, 1.78); box(0.7, 0.04, 0.3, '#6d7078', -12.0, yb + 0.2, 1.78, { t: 0.008 }); }
  }
  acUnit(-12.0, 0, 1.78);

  // 樓梯間正面：名牌與集合信箱
  const nameTex = canvasTex(192, 64, (g, w, h) => {
    g.fillStyle = '#6f5a44'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4a3a2e'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    txt(g, '月見荘', w / 2, h / 2 + 2, 38, '#f4ead8', 900);
  });
  plane(0.75, 0.25, toon('#ffffff', { map: nameTex, emissive: '#2a1a10', ei: 0.4 }), -9.5, 1.75, 3.41);
  const postTex = canvasTex(128, 96, g => {
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, 128, 96);
    g.strokeStyle = '#8a8f98'; g.lineWidth = 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g.strokeRect(4 + c * 30, 4 + r * 30, 28, 28); g.fillStyle = '#50565f'; g.fillRect(10 + c * 30, 12 + r * 30, 16, 3); }
  });
  box(0.8, 0.6, 0.3, '#c9ccd0', -9.5, 0.75, 3.56, { t: 0.01 });
  plane(0.78, 0.58, toon('#ffffff', { map: postTex }), -9.5, 1.05, 3.712);

  // 駐輪棚
  for (const [x, z] of [[-13.8, 2.3], [-11.2, 2.3], [-13.8, 4.9], [-11.2, 4.9]]) cyl(0.04, 0.04, 2.1, '#8a8f98', x, 0, z, { seg: 8, t: 0.01 });
  box(2.9, 0.06, 2.9, toon('#9fb6c8', { opacity: 0.8 }), -12.5, 2.1, 3.6);
  box(2.9, 0.1, 0.06, '#8a8f98', -12.5, 2.05, 2.15, { t: 0.01 });
  box(2.9, 0.1, 0.06, '#8a8f98', -12.5, 2.05, 5.05, { t: 0.01 });
  bicycle(-13.2, 3.6, PI / 2, '#c85a5a');
  bicycle(-12.4, 3.6, PI / 2, '#e5e0d5');
  bicycle(-11.65, 3.7, PI / 2, '#5a7d9a');
}

// ---- 便利商店後方的兩層民宅 ----
function buildHouse(win) {
  box(9.8, 2.9, 4.4, '#d9d0bf', -0.2, 0, -11.4, { cast: true, t: 0.035 });
  hipRoof(10.5, 5.1, 0.7, '#3c4252', -0.2, 2.85, -11.4);
  box(8.0, 2.5, 3.8, '#cfc5b2', -0.8, 2.9, -11.6, { cast: true, t: 0.035 });
  hipRoof(8.9, 4.7, 1.5, '#3a4050', -0.8, 5.35, -11.6);
  plane(1.4, 1.1, win.lit, -2.6, 4.25, -9.695);
  plane(1.4, 1.1, win.shutter, 1.2, 4.25, -9.695);
  plane(1.8, 1.1, win.lit2, -2.5, 1.4, -9.195);

  // 玄關（格子拉門透出暖光）
  const genkanTex = canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = '#f7dfb0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a4636'; g.lineWidth = 5;
    for (let x = 0; x <= w; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 10; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  });
  plane(1.5, 1.95, glow('#ffffff', 0.8, { map: genkanTex }), 2.8, 1.0, -9.195);
  box(1.8, 0.08, 0.7, '#3c4252', 2.8, 2.25, -8.9, { t: 0.015 });
  box(0.14, 0.2, 0.08, glow('#ffd49a', 2.2), 3.75, 1.9, -9.15, { outline: false });
  box(1.6, 0.18, 0.6, '#9a958c', 2.8, 0, -8.9, { t: 0.01 });
  acUnit(4.95, 0, -11.0, PI / 2);

  // ブロック塀與大門
  for (const [x0, x1] of [[-6.2, 1.65], [3.15, 6.3]]) {
    const len = +(x1 - x0).toFixed(2), cx = (x0 + x1) / 2;
    box(len, 1.5, 0.15, '#a3a29a', cx, 0, -7.8, { cast: true, t: 0.02 });
    box(len + 0.04, 0.06, 0.24, '#8a8a84', cx, 1.5, -7.8, { t: 0.01 });
  }
  box(0.3, 1.65, 0.3, '#8a8a84', 1.8, 0, -7.8, { t: 0.015 });
  box(0.3, 1.65, 0.3, '#8a8a84', 3.0, 0, -7.8, { t: 0.015 });
  box(0.9, 1.15, 0.04, '#3a3f48', 2.4, 0.05, -7.85, { t: 0.01 });
  const nameplate = canvasTex(48, 96, (g, w, h) => { g.fillStyle = '#e8dfcc'; g.fillRect(0, 0, w, h); txt(g, '星', w / 2, 28, 34, '#2b2b2b', 700); txt(g, '野', w / 2, 70, 34, '#2b2b2b', 700); });
  plane(0.14, 0.28, toon('#ffffff', { map: nameplate }), 1.8, 1.25, -7.645);
  box(0.3, 0.34, 0.16, '#b8452f', 3.0, 1.1, -7.6, { t: 0.01 });   // 信箱
  tree(-4.3, -8.5, 1.1);
  for (const x of [3.6, 4.1]) {
    cyl(0.16, 0.12, 0.3, '#a0583a', x, 0, -7.45, { seg: 10, t: 0.01 });
    const m = new THREE.Mesh(G('leaf', () => new THREE.IcosahedronGeometry(1, 1)), toon('#3d6450'));
    m.scale.setScalar(0.22); m.position.set(x, 0.45, -7.45);
    add(m, { t: 0.015 });
  }
}

// ---- 側街對面：圍牆與牆頭植栽 ----
function buildFarWall() {
  box(0.15, 1.4, 20, '#a3a29a', 13.75, 0, -3.8, { cast: true, t: 0.02 });
  box(0.25, 0.06, 20.04, '#8a8a84', 13.75, 1.4, -3.8, { t: 0.01 });
  for (let z = -13.4; z < 6.0; z += 0.75) {
    const m = new THREE.Mesh(G('leaf', () => new THREE.IcosahedronGeometry(1, 1)), toon(pick(['#2e4b3c', '#35584a'])));
    m.scale.set(0.2, rand(0.3, 0.45), 0.42); m.position.set(13.78, 1.55, z);
    add(m, { t: 0.02 });
  }
}

// 便利商店內部：冷藏櫃、便當飯糰區、貨架、收銀台、關東煮、咖啡機、菸架、雜誌架、冰櫃、後場
// 店內物件都放在圖層 1（不進地面反射，省一次渲染）；發光的天花板燈與冷藏櫃背板留在圖層 0
import * as THREE from 'three';
import { scene, PI, onTick } from '../core/context.js';
import { pLight } from '../core/lighting.js';
import { rand, pick } from '../lib/random.js';
import { canvasTex, rr, txt, drawBird } from '../lib/canvas.js';
import { toon, glow, gradientMap } from '../lib/materials.js';
import { box, cyl, plane, rod, grp, inst } from '../lib/geometry.js';
import { FRAME, CORAL, MUSTARD, TEAL } from '../palette.js';

const FL = 0.12;   // 店內地板高度
const SNACK = ['#e94f37', '#f6ae2d', '#2e86ab', '#7dc95e', '#f25f5c', '#ffe066', '#9b5de5', '#f15bb5', '#00bbf9', '#ff9f1c', '#e4572e', '#4ecdc4', '#fdfcdc'];

export function buildStoreInterior() {
  const IN = new THREE.Group();
  scene.add(IN);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const productMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, emissive: 0x2a2016 });
  const productLit = new THREE.MeshBasicMaterial({ color: 0xd6d6d6 });
  const items = (geo, mat, list) => inst(geo, mat, list, IN);

  pLight('#ffd7a3', 30, -3.4, 2.8, -3.0, 8);
  pLight('#ffd7a3', 30, 0.6, 2.8, -3.0, 8);
  pLight('#ffe2b8', 22, -1.6, 2.7, -0.2, 7);

  // ---- 天花板與燈 ----
  box(9.6, 0.05, 6.6, '#f3eee4', -1, 2.98, -2.5, { outline: false });
  const ceilLight = glow('#fff4e0', 2.0);
  for (const z of [-4.6, -3.3, -2.0, -0.7]) for (const x of [-4.6, -2.6, -0.6, 1.4, 3.1]) box(1.2, 0.04, 0.2, ceilLight, x, 2.94, z, { outline: false });

  // ---- 後牆飲料冷藏櫃（7 門）----
  const COOL_X0 = -5.715, COOL_W = 0.93, COOL_N = 7, coolCx = COOL_X0 + COOL_W * COOL_N / 2;
  const COOL_SHELVES = [0.4, 0.73, 1.06, 1.39, 1.72];
  box(6.55, 0.25, 0.75, '#3a3f48', coolCx, FL, -5.42, { outline: false });
  box(6.55, 0.32, 0.75, '#e8e4dc', coolCx, 2.05, -5.42, { t: 0.015 });
  plane(6.5, 1.72, glow('#dfefff', 1.05), coolCx, 1.23, -5.77);
  const coolSign = canvasTex(1024, 48, (g, w, h) => {
    g.fillStyle = TEAL; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      txt(g, 'つめたいお飲み物', w / 6 + i * w / 3, h / 2 + 1, 26, '#fbf7ee', 700);
      g.fillStyle = '#9fd3e8'; g.beginPath(); g.arc(w / 6 + i * w / 3 - 128, h / 2, 7, 0, PI * 2); g.fill();
    }
  });
  plane(6.5, 0.26, glow('#ffffff', 1.1, { map: coolSign }), coolCx, 2.21, -5.043);
  for (let i = 0; i <= COOL_N; i++) box(0.05, 1.72, 0.08, '#6a707a', COOL_X0 + i * COOL_W, 0.37, -5.08, { outline: false });
  for (const y of COOL_SHELVES) box(6.5, 0.025, 0.66, '#c8ccd2', coolCx, y, -5.42, { outline: false });
  plane(6.5, 1.72, glow('#cfe3ff', 1, { opacity: 0.1 }), coolCx, 1.23, -5.04);
  for (let i = 0; i < COOL_N; i++) box(0.02, 0.5, 0.03, '#d8dde3', COOL_X0 + i * COOL_W + 0.82, 0.95, -5.02, { outline: false });
  {
    // 每一門一種品類：水、綠茶、麥茶、汽水、咖啡罐、果汁、乳飲
    const cats = [
      ['#bfe3f5', '#8fd0ee'], ['#b5d77a', '#6ea84a', '#d9e8a0'], ['#d9a860', '#a0622a', '#e8c890'],
      ['#e8f06a', '#d84a3a', '#f07a2a', '#7ad0f0'], ['#6b4a36', '#2b3f66', '#d8c8a8', '#3a5a3a'],
      ['#f5a623', '#b04a8a', '#f3d64a', '#e0604a'], ['#f5f5ee', '#f0b7c8', '#f2e2b0'],
    ];
    const LABELS = ['#ffffff', '#1f6f78', '#e8795c', '#2b5fa8', '#f0bd45', '#2f3b66'];
    const bodies = [], labels = [];
    for (let i = 0; i < COOL_N; i++) for (const y of COOL_SHELVES) for (let k = 0; k < 8; k++) {
      const can = i === 4, h = can ? 0.13 : (i === 6 ? 0.16 : 0.21);
      const x = COOL_X0 + i * COOL_W + 0.1 + k * 0.105, z = -5.3;
      bodies.push({ x, y: y + 0.0125 + h / 2, z, h, c: pick(cats[i]) });
      labels.push({ x, y: y + 0.0125 + h * 0.45, z, w: 1.06, h: can ? 0.07 : 0.06, d: 1.06, c: pick(LABELS) });
    }
    const bottle = new THREE.CylinderGeometry(0.034, 0.034, 1, 8);
    items(bottle, productLit, bodies);
    items(bottle, productLit, labels);
  }

  // ---- 左牆開放式冷藏櫃（便當、三明治、飯糰）----
  const CASE_SHELVES = [0.42, 0.78, 1.14, 1.5];
  box(0.75, 0.3, 5.2, '#3a3f48', -5.42, FL, -2.3, { outline: false });
  plane(5.2, 1.5, glow('#fff2dc', 1.0), -5.78, 1.17, -2.3, { ry: PI / 2 });
  box(0.8, 0.25, 5.2, '#ece8e0', -5.4, 1.92, -2.3, { t: 0.015 });
  const caseSign = canvasTex(1024, 40, (g, w, h) => {
    g.fillStyle = CORAL; g.fillRect(0, 0, w, h);
    txt(g, 'おにぎり・お弁当', w / 4, h / 2 + 1, 24, '#fff7ec', 700);
    txt(g, 'おにぎり・お弁当', w * 3 / 4, h / 2 + 1, 24, '#fff7ec', 700);
  });
  plane(5.1, 0.2, glow('#ffffff', 1.1, { map: caseSign }), -4.998, 2.045, -2.3, { ry: PI / 2 });
  for (const y of CASE_SHELVES) box(0.62, 0.025, 5.2, '#cdd1d6', -5.45, y, -2.3, { outline: false });
  box(0.75, 1.85, 0.06, '#e2ded6', -5.42, FL, 0.33, { t: 0.012 });
  box(0.75, 1.85, 0.06, '#e2ded6', -5.42, FL, -4.93, { t: 0.012 });
  {
    const LID = ['#f2c14e', '#c8553d', '#8fbf6a', '#e9dcc9', '#7a4a2e', '#e07a5f', '#f5efe0'];
    const bento = [];
    for (const [lv, bw, bh] of [[0, 0.24, 0.06], [1, 0.2, 0.07]]) {
      const y0 = CASE_SHELVES[lv] + 0.0125;
      for (let z = -4.72; z < 0.1; z += bw + 0.03) for (let s = 0; s < 2; s++) bento.push({ x: -5.28, y: y0 + bh / 2 + s * (bh + 0.004), z, w: 0.18, h: bh, d: bw, c: pick(LID) });
    }
    items(unitBox, productMat, bento);
    // 三角柱：頂點朝上、面朝 +x（店內走道）
    const tri = new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-PI / 2).rotateY(PI / 2);
    const rice = [], nori = [], sand = [];
    for (let z = -4.75; z < 0.15; z += 0.12) {
      rice.push({ x: -5.24, y: CASE_SHELVES[3] + 0.0125 + 0.03, z, w: 0.04, h: 0.06, d: 0.06, c: '#f7f4ec' });
      nori.push({ x: -5.238, y: CASE_SHELVES[3] + 0.0125 + 0.022, z, w: 0.044, h: 0.044, d: 0.045, c: pick(['#1d2a24', '#1d2a24', '#3a2a20']) });
      sand.push({ x: -5.24, y: CASE_SHELVES[2] + 0.0125 + 0.035, z, w: 0.05, h: 0.07, d: 0.07, rz: 0.15, c: pick(['#efe0bc', '#f2d9a0', '#efe0bc']) });
    }
    items(tri, productMat, rice);
    items(unitBox, productMat, nori);
    items(tri, productMat, sand);
  }

  // ---- 冰櫃 ----
  box(1.4, 0.75, 0.8, '#eef0f2', -4.2, FL, -0.35, { parent: IN, t: 0.015 });
  const iceTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#dff1ff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = pick(['#f15bb5', '#ffe066', '#00bbf9', '#fdfcdc', '#9b5de5', '#7dc95e', '#e94f37']); rr(g, rand(4, w - 40), rand(4, h - 30), rand(20, 36), rand(14, 26), 4); g.fill(); }
  });
  plane(1.3, 0.7, glow('#ffffff', 0.95, { map: iceTex }), -4.2, FL + 0.755, -0.35, { rx: -PI / 2, parent: IN });
  const iceSign = canvasTex(160, 48, (g, w, h) => { g.fillStyle = '#2b8fd6'; g.fillRect(0, 0, w, h); txt(g, 'アイス', w / 2, h / 2 + 1, 30, '#ffffff', 900); });
  plane(0.5, 0.15, glow('#ffffff', 1.0, { map: iceSign }), -4.2, FL + 0.55, 0.052, { parent: IN });

  buildGondolas(IN, unitBox, productMat);
  buildMagazineRack(IN, unitBox, productMat);
  buildCounter(IN, productMat);
  buildCoffeeAndAtm(IN);
  buildBackroom(IN);
  buildFloorAndPosters(IN);

  IN.traverse(o => o.layers.set(1));
}

// ---- 中島貨架（零食、泡麵、日用品）與吊牌 ----
function buildGondolas(IN, unitBox, productMat) {
  const GX = [-3.55, -1.65, 0.25], GZ0 = -4.3, GZ1 = -1.3, GL = GZ1 - GZ0, GZC = (GZ0 + GZ1) / 2;
  const G_SHELVES = [0.3, 0.62, 0.94, 1.26];
  const snacks = [], cups = [];
  GX.forEach((gx, gi) => {
    box(0.9, 0.1, GL, '#50565f', gx, FL, GZC, { parent: IN, outline: false });
    box(0.06, 1.35, GL, '#d8d4cc', gx, FL, GZC, { parent: IN, t: 0.012 });
    box(0.9, 0.12, GL + 0.02, [CORAL, TEAL, MUSTARD][gi], gx, FL + 1.35, GZC, { parent: IN, t: 0.012 });
    box(0.9, 1.4, 0.3, '#d8d4cc', gx, FL, GZ1 + 0.15, { parent: IN, t: 0.012 });
    for (const s of [-1, 1]) for (const y of G_SHELVES) {
      box(0.4, 0.02, GL, '#e4e0d8', gx + s * 0.23, FL + y - 0.02, GZC, { parent: IN, outline: false });
      let z = GZ0 + 0.06;
      while (true) {
        const cup = gi === 1 && y > 0.8;
        const w = cup ? 0.12 : rand(0.09, 0.2), h = cup ? 0.11 : rand(0.1, 0.24), d = rand(0.2, 0.3);
        if (z + w > GZ1 - 0.05) break;
        if (cup) cups.push({ x: gx + s * 0.2, y: FL + y + 0.055, z: z + w / 2, c: pick(['#fdfcdc', '#f6ae2d', '#e94f37', '#fdfcdc']) });
        else snacks.push({ x: gx + s * (0.06 + d / 2), y: FL + y + h / 2, z: z + w / 2, w: d, h, d: w, c: pick(SNACK) });
        z += w + 0.012;
      }
    }
    // 端架
    for (const y of [0.35, 0.75, 1.15]) {
      box(0.86, 0.02, 0.18, '#e4e0d8', gx, FL + y - 0.02, GZ1 + 0.39, { parent: IN, outline: false });
      for (let x = gx - 0.36; x < gx + 0.36; x += 0.15) snacks.push({ x: x + 0.06, y: FL + y + 0.09, z: GZ1 + 0.39, w: 0.12, h: 0.18, d: 0.14, c: pick(SNACK) });
    }
  });
  inst(unitBox, productMat, snacks, IN);
  inst(new THREE.CylinderGeometry(0.062, 0.05, 0.11, 10), productMat, cups, IN);

  const labels = ['お菓子', 'カップ麺', '日用品'];
  GX.forEach((gx, i) => {
    const t = canvasTex(256, 80, (g, w, h) => {
      g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h);
      g.fillStyle = [CORAL, TEAL, MUSTARD][i]; g.fillRect(0, 0, 16, h); g.fillRect(w - 16, 0, 16, h);
      txt(g, labels[i], w / 2, h / 2 + 2, 40, '#2b3140', 900);
    });
    plane(0.8, 0.25, toon('#ffffff', { map: t, emissive: '#6a5a40', ei: 0.5, side: THREE.DoubleSide }), gx, 2.45, GZ1 - 0.2, { parent: IN });
    for (const dx of [-0.3, 0.3]) rod([gx + dx, 2.575, GZ1 - 0.2], [gx + dx, 2.96, GZ1 - 0.2], 0.006, '#8a8f98', { parent: IN, outline: false, seg: 4 });
  });
  const popTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#e94f37'; rr(g, 2, 2, w - 4, h - 4, 12); g.fill(); txt(g, 'おすすめ', w / 2, h / 2 + 1, 26, '#fff', 900); });
  const newTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#f0bd45'; rr(g, 2, 2, w - 4, h - 4, 12); g.fill(); txt(g, 'NEW', w / 2, h / 2 + 2, 34, '#2b3140', 900); });
  GX.forEach((gx, i) => plane(0.34, 0.17, toon('#ffffff', { map: i % 2 ? newTex : popTex, emissive: '#402010', ei: 0.4 }), gx + 0.1, FL + 1.52, GZ1 + 0.31, { parent: IN }));
}

// ---- 窗邊雜誌架 ----
function buildMagazineRack(IN, unitBox, productMat) {
  box(6.4, 0.9, 0.42, '#d9d5cd', -2.35, FL, 0.62, { parent: IN, t: 0.015 });
  box(6.4, 0.22, 0.2, '#d9d5cd', -2.35, FL + 0.9, 0.73, { parent: IN, t: 0.012 });
  const mags = [];
  for (let x = -5.42; x < 0.75; x += 0.235) {
    mags.push({ x, y: FL + 0.55, z: 0.39, w: 0.21, h: 0.28, d: 0.012, rx: 0.18, c: pick(SNACK) });
    mags.push({ x: x + 0.1, y: FL + 1.25, z: 0.6, w: 0.21, h: 0.28, d: 0.012, rx: 0.2, c: pick(SNACK) });
  }
  inst(unitBox, productMat, mags, IN);
}

// ---- 收銀台：收銀機、關東煮（冒蒸氣）、熱食櫃、菸架、菜單燈箱（微微呼吸）----
function buildCounter(IN, productMat) {
  box(2.5, 0.95, 0.65, '#d7cdbd', 2.55, FL, -2.1, { parent: IN, t: 0.015 });
  box(2.6, 0.05, 0.75, '#f2efe9', 2.55, FL + 0.95, -2.1, { parent: IN, t: 0.012 });
  box(2.5, 0.08, 0.02, CORAL, 2.55, FL + 0.72, -1.765, { parent: IN, outline: false });
  for (const x of [2.95, 3.5]) {
    box(0.34, 0.12, 0.3, '#2b2f38', x, 1.12, -2.18, { parent: IN, t: 0.01 });
    box(0.3, 0.22, 0.04, '#2b2f38', x, 1.24, -2.14, { parent: IN, rx: -0.35, t: 0.008 });
    plane(0.26, 0.18, glow('#8fd3ff', 1.2), x, 1.355, -2.105, { parent: IN, rx: -0.35 });
  }

  // 關東煮鍋
  box(0.62, 0.2, 0.42, '#b8bec6', 1.75, 1.12, -2.08, { parent: IN, t: 0.012 });
  plane(0.58, 0.38, toon('#c9923c', { emissive: '#6a4010', ei: 0.7 }), 1.75, 1.322, -2.08, { parent: IN, rx: -PI / 2 });
  box(0.58, 0.03, 0.012, '#dfe3e8', 1.75, 1.32, -2.08, { parent: IN, outline: false });
  for (const x of [1.56, 1.75, 1.94]) box(0.012, 0.03, 0.38, '#dfe3e8', x, 1.32, -2.08, { parent: IN, outline: false });
  const oden = [];
  for (let i = 0; i < 14; i++) {
    const x = rand(1.5, 2.0), z = rand(-2.25, -1.92), kind = i % 4;
    if (kind === 0) oden.push({ x, y: 1.335, z, w: 0.05, h: 0.04, d: 0.05, c: '#f2e6c6' });             // 蛋
    else if (kind === 1) oden.push({ x, y: 1.33, z, w: 0.07, h: 0.03, d: 0.07, c: '#e8d8a8' });         // 蘿蔔
    else if (kind === 2) oden.push({ x, y: 1.33, z, w: 0.06, h: 0.025, d: 0.05, ry: rand(0, 3), c: '#8a8580' });   // 蒟蒻
    else oden.push({ x, y: 1.335, z, w: 0.1, h: 0.03, d: 0.03, ry: rand(0, 3), c: '#b07a3a' });          // 竹輪
  }
  inst(new THREE.SphereGeometry(0.5, 10, 8), productMat, oden, IN);

  // 熱食櫃
  box(0.5, 0.36, 0.36, toon('#dfe7ef', { opacity: 0.35 }), 2.35, 1.12, -2.1, { parent: IN, t: 0.008 });
  plane(0.46, 0.3, glow('#ffb870', 1.1), 2.35, 1.3, -2.265, { parent: IN });
  const fry = [];
  for (let i = 0; i < 10; i++) fry.push({ x: 2.17 + (i % 5) * 0.09, y: i < 5 ? 1.17 : 1.33, z: -2.1, w: 0.07, h: 0.05, d: 0.06, c: pick(['#c88a3a', '#e0b060', '#b8702a']) });
  inst(new THREE.SphereGeometry(0.5, 8, 6), productMat, fry, IN);
  box(0.46, 0.01, 0.3, '#c9ccd2', 2.35, 1.27, -2.1, { parent: IN, outline: false });

  // 菸架
  const tobacco = canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#20242c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, w, 40);
    txt(g, 'ことりマート', w / 2, 22, 24, TEAL, 900);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 16; c++) {
      g.fillStyle = pick(['#f4f1ea', '#2b5fa8', '#c93a3a', '#f0bd45', '#1f6f78', '#e8795c', '#8a8f98', '#3b9a63']);
      g.fillRect(8 + c * 31.5, 52 + r * 46, 26, 36);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(8 + c * 31.5, 52 + r * 46, 26, 6);
    }
  });
  box(2.5, 1.9, 0.3, '#3b3f48', 2.55, FL, -3.1, { parent: IN, t: 0.015 });
  plane(2.44, 1.8, glow('#ffffff', 0.85, { map: tobacco }), 2.55, FL + 0.97, -2.948, { parent: IN });

  // 菜單燈箱
  const menuTex = canvasTex(768, 192, (g, w, h) => {
    g.fillStyle = '#fff6e4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b3432f'; g.fillRect(0, 0, w, 36);
    txt(g, 'ことりのホットスナック', w / 2, 19, 24, '#fff6e4', 700);
    [['からあげ', '#c88a3a', '180円'], ['肉まん', '#f4efe4', '150円'], ['コロッケ', '#d9a04a', '100円'], ['焼きいも', '#8e3b5a', '200円']].forEach(([n, c, p], i) => {
      const cx = w / 8 + i * w / 4;
      g.fillStyle = c; g.beginPath(); g.ellipse(cx, 94, 44, 32, 0, 0, PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 3; g.stroke();
      txt(g, n, cx, 146, 26, '#3a2a22', 900);
      txt(g, p, cx, 174, 22, '#b3432f', 700);
    });
  });
  const menuMat = glow('#ffffff', 1.15, { map: menuTex });
  box(2.26, 0.6, 0.05, '#2b2f38', 2.55, 2.15, -1.93, { parent: IN, t: 0.01 });
  plane(2.2, 0.55, menuMat, 2.55, 2.45, -1.902, { parent: IN });
  for (const x of [1.7, 3.4]) rod([x, 2.75, -1.93], [x, 2.96, -1.93], 0.008, '#8a8f98', { parent: IN, outline: false, seg: 4 });
  onTick(t => menuMat.color.setScalar(1.15 + 0.07 * Math.sin(t * 0.9)));

  // 關東煮的蒸氣
  const steamTex = canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const steams = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: 0xfff1e0, transparent: true, depthWrite: false, opacity: 0 }));
    IN.add(s);
    steams.push({ s, ph: i / 6 });
  }
  onTick(t => steams.forEach(o => {
    const f = (t * 0.32 + o.ph) % 1;
    o.s.position.set(1.75 + Math.sin(f * 6 + o.ph * 20) * 0.05, 1.36 + f * 0.7, -2.08 + Math.cos(f * 5 + o.ph * 9) * 0.04);
    o.s.scale.setScalar(0.1 + f * 0.32);
    o.s.material.opacity = Math.sin(f * PI) * 0.32;
  }));
}

// ---- 咖啡機、ATM、購物籃 ----
function buildCoffeeAndAtm(IN) {
  box(0.55, 0.95, 1.2, '#d7cdbd', 3.52, FL, -0.5, { parent: IN, t: 0.015 });
  box(0.6, 0.05, 1.25, '#f2efe9', 3.52, FL + 0.95, -0.5, { parent: IN, t: 0.01 });
  box(0.42, 0.62, 0.45, '#1f2228', 3.56, 1.12, -0.75, { parent: IN, t: 0.012 });
  const coffee = canvasTex(160, 112, (g, w) => {
    g.fillStyle = '#2b1d16'; g.fillRect(0, 0, w, 112);
    txt(g, 'COFFEE', w / 2, 30, 26, '#f0bd45', 900);
    txt(g, 'ことりカフェ', w / 2, 62, 18, '#fbf7ee', 700);
    g.fillStyle = '#e8795c'; g.fillRect(20, 84, 50, 16); g.fillStyle = '#7fc6ff'; g.fillRect(90, 84, 50, 16);
  });
  plane(0.34, 0.24, glow('#ffffff', 1.05, { map: coffee }), 3.347, 1.55, -0.75, { parent: IN, ry: -PI / 2 });
  box(0.2, 0.02, 0.2, '#6a6f78', 3.45, 1.14, -0.75, { parent: IN, outline: false });
  cyl(0.045, 0.035, 0.32, '#f5f2ea', 3.55, 1.12, -0.28, { parent: IN, t: 0.008, seg: 10 });
  cyl(0.055, 0.042, 0.26, '#f5f2ea', 3.55, 1.12, -0.12, { parent: IN, t: 0.008, seg: 10 });
  cyl(0.05, 0.05, 0.14, '#3a2a22', 3.55, 1.12, 0.02, { parent: IN, t: 0.008, seg: 10 });

  box(0.45, 1.45, 0.5, '#9aa3ad', 3.575, FL, 0.47, { parent: IN, t: 0.015 });
  plane(0.3, 0.24, glow('#7fc6ff', 1.1), 3.348, 1.2, 0.47, { parent: IN, ry: -PI / 2 });
  box(0.08, 0.2, 0.4, '#2b2f38', 3.33, 0.85, 0.47, { parent: IN, outline: false });

  for (const [z, c] of [[0.55, '#d94b4b'], [0.1, '#2f6fb3']]) {
    box(0.46, 0.08, 0.34, '#555b66', 1.02, FL, z, { parent: IN, outline: false });
    for (let k = 0; k < 4; k++) box(0.44, 0.1, 0.32, c, 1.02, FL + 0.08 + k * 0.07, z, { parent: IN, t: 0.008 });
  }
}

// ---- 後場：儲物櫃、半開的員工出入口 ----
function buildBackroom(IN) {
  const lockTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#8e9aa6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5d6873'; g.lineWidth = 3;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
      g.strokeRect(6 + c * 58, 6 + r * 61, 54, 56);
      g.fillStyle = '#d6dce2'; g.fillRect(48 + c * 58, 26 + r * 61, 5, 14);
      g.fillStyle = '#c9d1d8'; g.fillRect(14 + c * 58, 12 + r * 61, 18, 6);
    }
  });
  box(0.9, 1.8, 0.4, toon('#ffffff', { map: lockTex }), 1.45, FL, -5.58, { parent: IN, t: 0.012 });
  const backTex = canvasTex(160, 320, (g, w, h) => {
    g.fillStyle = '#d8e2e0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b8c4c2'; g.fillRect(0, h * 0.72, w, h * 0.28);
    g.fillStyle = '#7d8a8a'; for (const y of [60, 130, 200]) g.fillRect(10, y, w - 20, 6);
    for (let i = 0; i < 14; i++) { g.fillStyle = pick(['#c9a26a', '#b8894e', '#d8b98a']); g.fillRect(rand(12, w - 50), [22, 92, 162][i % 3] + rand(0, 8), rand(26, 40), rand(26, 36)); }
  });
  plane(1.0, 2.1, glow('#ffffff', 0.75, { map: backTex }), 2.8, FL + 1.05, -5.795, { parent: IN });
  box(1.12, 0.06, 0.06, FRAME, 2.8, FL + 2.1, -5.77, { parent: IN, t: 0.008 });
  box(0.06, 2.1, 0.06, FRAME, 2.27, FL, -5.77, { parent: IN, t: 0.008 });
  box(0.06, 2.1, 0.06, FRAME, 3.33, FL, -5.77, { parent: IN, t: 0.008 });
  const hinge = grp(3.3, FL, -5.78, 0.9, IN);
  box(0.95, 2.05, 0.04, '#9aa3ad', -0.475, 0, 0, { parent: hinge, t: 0.01 });
  box(0.3, 0.4, 0.045, '#dfe9ee', -0.475, 1.3, 0, { parent: hinge, outline: false });
  const staff = canvasTex(128, 32, (g, w, h) => { g.fillStyle = '#2b2f38'; g.fillRect(0, 0, w, h); txt(g, 'STAFF ONLY', w / 2, h / 2 + 1, 16, '#f0bd45', 700); });
  plane(0.36, 0.09, toon('#ffffff', { map: staff }), -0.475, 1.0, 0.024, { parent: hinge });
}

// ---- 地面排隊貼紙、玻璃內側海報 ----
function buildFloorAndPosters(IN) {
  const floorGuide = canvasTex(256, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2b8fd6'; g.lineWidth = 8; g.setLineDash([18, 12]);
    g.beginPath(); g.moveTo(w * 0.5, h - 6); g.lineTo(w * 0.5, 70); g.stroke(); g.setLineDash([]);
    for (const y of [120, 210, 300]) {
      g.fillStyle = '#2b8fd6';
      g.beginPath(); g.ellipse(w * 0.36, y, 13, 22, 0, 0, PI * 2); g.fill();
      g.beginPath(); g.ellipse(w * 0.64, y, 13, 22, 0, 0, PI * 2); g.fill();
    }
    g.fillStyle = '#f0bd45'; g.beginPath(); g.moveTo(w * 0.5, 14); g.lineTo(w * 0.5 + 34, 60); g.lineTo(w * 0.5 - 34, 60); g.fill();
  });
  plane(1.2, 1.8, toon('#ffffff', { map: floorGuide, alphaTest: 0.5, polyOffset: true }), 2.2, FL + 0.004, -0.72, { parent: IN, rx: -PI / 2 });

  const p1 = canvasTex(200, 140, (g, w, h) => {
    g.fillStyle = '#fff3dc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b3432f'; g.fillRect(0, 0, w, 44);
    txt(g, 'おでん', w / 2, 24, 30, '#fff3dc', 900);
    txt(g, '全品 70円', w / 2, 84, 32, '#b3432f', 900);
    txt(g, '10/31まで', w / 2, 120, 18, '#6a4a3a', 700);
  });
  const p2 = canvasTex(200, 140, (g, w, h) => {
    g.fillStyle = TEAL; g.fillRect(0, 0, w, h);
    drawBird(g, 42, 70, 30);
    txt(g, 'からあげ', 130, 52, 28, '#fbf7ee', 900);
    txt(g, '増量中', 130, 94, 30, MUSTARD, 900);
  });
  plane(0.7, 0.49, toon('#ffffff', { map: p1, emissive: '#3a2410', ei: 0.5 }), -4.9, 2.25, 0.92, { parent: IN });
  plane(0.6, 0.42, toon('#ffffff', { map: p2, emissive: '#10302e', ei: 0.5 }), -0.3, 2.28, 0.92, { parent: IN });
}

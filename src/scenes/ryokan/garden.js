// 庭園：石燈籠（春日、雪見、織部）、枯山水石組、飛石、池塘、蹲踞與鹿威し、入口門、木柵與竹垣
import * as THREE from 'three';
import { scene, PI, reduceMotion, onTick } from '../../engine/context.js';
import { pLight } from '../../engine/lights.js';
import { rand, pick } from '../../engine/random.js';
import { soft, glow } from '../../engine/materials.js';
import { box, cyl, rod, grp, irimoyaRoof, G, add } from '../../engine/geometry.js';
import { rock, blob, lightPool, roofMats } from './shapes.js';
import { waterMesh } from './water.js';
import { C } from './palette.js';
import { ZEN, ZEN_ROCKS, PATH, POND, TSUKUBAI, GATE, FENCE_Z, FENCE_GAP, LANTERNS } from './layout.js';

// 燈火：給 atmosphere 做搖曳 { light?, base?, mat?, k?, color? }
export const flames = [];

export function buildGarden() {
  for (const [x, z, type, withLight] of LANTERNS) stoneLantern(x, z, type, withLight);
  buildZen();
  buildPath();
  buildPond();
  buildTsukubai();
  buildGate();
  buildFences();
}

// ---- 石燈籠 ----
const stoneFlat = () => soft(C.stone, { flat: true });
function flameMat() { const m = glow(C.lamp, 2.2); flames.push({ mat: m, k: 2.2, color: C.lamp }); return m; }

function stoneLantern(x, z, type, withLight) {
  const g0 = grp(x, 0, z, rand(0, PI));
  const S = stoneFlat(), P = { parent: g0, cast: true };
  let fireY;
  if (type === 'yukimi') {                                   // 雪見：三足、寬笠
    for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; rod([Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32], [Math.cos(a) * 0.16, 0.5, Math.sin(a) * 0.16], 0.055, S, { ...P, seg: 6 }); }
    cyl(0.3, 0.3, 0.1, S, 0, 0.48, 0, { ...P, seg: 6 });
    fireY = 0.72;
    cyl(0.13, 0.13, 0.26, flameMat(), 0, 0.58, 0, { parent: g0, seg: 6 });
    for (let i = 0; i < 6; i++) { const a = i * PI / 3; box(0.05, 0.28, 0.05, S, Math.cos(a) * 0.2, 0.58, Math.sin(a) * 0.2, P); }
    cyl(0.62, 0.62, 0.06, S, 0, 0.86, 0, { ...P, seg: 6 });
    const roof = new THREE.Mesh(G('yukiKasa', () => new THREE.ConeGeometry(0.62, 0.28, 6)), S); roof.position.y = 1.06; add(roof, P);
    cyl(0.05, 0.08, 0.12, S, 0, 1.2, 0, { ...P, seg: 6 });
  } else if (type === 'oribe') {                             // 織部：方柱、四角笠
    box(0.2, 0.9, 0.2, S, 0, 0, 0, P);
    box(0.34, 0.08, 0.34, S, 0, 0.9, 0, P);
    fireY = 1.1;
    box(0.2, 0.24, 0.2, flameMat(), 0, 0.98, 0, { parent: g0 });
    for (const [dx, dz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) box(0.05, 0.26, 0.05, S, dx, 0.98, dz, P);
    const roof = new THREE.Mesh(G('oribeKasa', () => new THREE.ConeGeometry(0.34, 0.22, 4).rotateY(PI / 4)), S); roof.position.y = 1.35; add(roof, P);
    cyl(0.04, 0.06, 0.08, S, 0, 1.46, 0, { ...P, seg: 6 });
  } else {                                                   // 春日：六角
    cyl(0.28, 0.32, 0.14, S, 0, 0, 0, { ...P, seg: 6 });
    cyl(0.09, 0.11, 0.62, S, 0, 0.14, 0, { ...P, seg: 8 });
    cyl(0.25, 0.2, 0.1, S, 0, 0.76, 0, { ...P, seg: 6 });
    fireY = 1.0;
    cyl(0.13, 0.13, 0.26, flameMat(), 0, 0.86, 0, { parent: g0, seg: 6 });
    for (let i = 0; i < 6; i++) { const a = i * PI / 3 + PI / 6; box(0.05, 0.28, 0.05, S, Math.cos(a) * 0.19, 0.86, Math.sin(a) * 0.19, P); }
    const roof = new THREE.Mesh(G('kasugaKasa', () => new THREE.ConeGeometry(0.4, 0.26, 6)), S); roof.position.y = 1.27; add(roof, P);
    cyl(0.07, 0.1, 0.1, S, 0, 1.4, 0, { ...P, seg: 6 });
    const hoju = new THREE.Mesh(G('hoju', () => new THREE.SphereGeometry(0.07, 8, 6)), S); hoju.position.y = 1.55; add(hoju, P);
  }
  lightPool(x, z, 1.6, 0.5);
  if (withLight) {
    const l = pLight(C.lamp, 4.5, x, fireY, z, 6);
    flames.push({ light: l, base: 4.5 });
  }
}

// ---- 枯山水：石組（主石＋苔環）與砂地邊緣的石條 ----
function buildZen() {
  for (const [x, z, r] of ZEN_ROCKS) {
    blob(x, 0, z, r * 1.35, 0.1, r * 1.2, soft(C.moss2), { detail: 2, cast: false });
    rock(x, 0, z, r, r * 1.05, r * 0.85, pick([C.stone, C.stoneWarm]), { sink: 0.45, rough: 0.28 });
    rock(x + r * 0.9, 0, z + r * 0.4, r * 0.45, r * 0.4, r * 0.4, C.stoneDark, { sink: 0.4 });
  }
  const { x0, x1, z0, z1 } = ZEN, e = 0.16, M = soft(C.stoneDark, { flat: true });
  box(x1 - x0 + e * 2, 0.1, e, M, (x0 + x1) / 2, 0, z0 - e / 2);
  box(x1 - x0 + e * 2, 0.1, e, M, (x0 + x1) / 2, 0, z1 + e / 2);
  box(e, 0.1, z1 - z0, M, x0 - e / 2, 0, (z0 + z1) / 2);
  box(e, 0.1, z1 - z0, M, x1 + e / 2, 0, (z0 + z1) / 2);
}

// ---- 飛石 ----
function buildPath() {
  const M = soft(C.stoneWarm, { flat: true });
  for (const [x, z] of PATH) {
    const r = rand(0.3, 0.42);
    const m = cyl(r, r * 1.05, 0.12, M, x + rand(-0.08, 0.08), -0.02, z + rand(-0.08, 0.08), { seg: 7, cast: false });
    m.scale.z = rand(0.75, 0.95);
    m.rotation.y = rand(0, PI);
  }
}

// ---- 池塘：深青水面、池邊石、睡蓮葉 ----
function buildPond() {
  const { cx, cz, rx, rz } = POND;
  const lamp = LANTERNS[1];
  scene.add(waterMesh({ cx, cz, rx, rz, y: 0.05, shallow: '#3f7c86', deep: '#1c3f4d', lamp: [lamp[0], lamp[1]], lampColor: '#ff9a4a', rippleScale: 3.0 }));
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * PI * 2 + rand(-0.08, 0.08), r = rand(0.18, 0.36);
    rock(cx + Math.cos(a) * (rx + 0.08), 0, cz + Math.sin(a) * (rz + 0.08), r * 1.2, r * 0.7, r, pick([C.stone, C.stoneDark, '#7a7680']), { sink: 0.35 });
  }
  rock(cx - rx * 0.4, 0, cz - rz - 0.3, 0.7, 0.8, 0.6, C.stoneDark, { sink: 0.3 });   // 池邊景石
  const pad = soft('#4f7a45');
  for (let i = 0; i < 9; i++) {
    const a = rand(0, PI * 2), d = Math.sqrt(rand(0.1, 0.75));
    const m = cyl(0.17, 0.17, 0.02, pad, cx + Math.cos(a) * rx * d, 0.06, cz + Math.sin(a) * rz * d, { seg: 10, cast: false });
    m.scale.setScalar(rand(0.7, 1.2));
  }
}

// ---- 蹲踞與鹿威し ----
function buildTsukubai() {
  const { x, z } = TSUKUBAI;
  cyl(0.3, 0.36, 0.36, soft(C.stone, { flat: true }), x, 0, z, { seg: 9, cast: true });
  cyl(0.22, 0.22, 0.01, glow('#2c5560', 1), x, 0.355, z, { seg: 16 });
  rock(x - 0.55, 0, z + 0.2, 0.3, 0.22, 0.26, C.stoneDark);
  rock(x + 0.4, 0, z + 0.45, 0.25, 0.18, 0.22, C.stoneWarm);
  // 筧（竹水管）從柱子流進鹿威し
  const sx = x + 0.95, sz = z - 0.35;
  cyl(0.045, 0.045, 0.8, C.bambooDark, sx + 0.55, 0, sz - 0.05, { seg: 8, cast: true });
  rod([sx + 0.55, 0.72, sz - 0.05], [sx + 0.3, 0.58, sz - 0.02], 0.03, C.bamboo, { seg: 8 });
  // 支架與可轉動的竹筒（群組不合併，才能動）
  for (const dz of [-0.09, 0.09]) cyl(0.025, 0.025, 0.36, C.bambooDark, sx, 0, sz + dz, { seg: 6, cast: true });
  rock(sx - 0.34, 0, sz, 0.15, 0.12, 0.15, C.stoneDark);   // 被敲擊的石
  const pivot = grp(sx, 0.3, sz);
  pivot.userData.dynamic = true;
  const tube = rod([-0.34, 0, 0], [0.36, 0, 0], 0.045, C.bamboo, { parent: pivot, seg: 8 });
  tube.castShadow = true;
  cyl(0.047, 0.047, 0.02, C.bambooDark, 0.1, -0.01, 0, { parent: pivot, rz: PI / 2, seg: 8 });   // 竹節
  // 週期：開口端（+x）朝上慢慢注水 → 變重後快速傾倒倒水 → 回彈，尾端敲在石頭上
  const REST = 0.32, TIP = -0.5, CYCLE = 7.5;
  onTick(t => {
    if (reduceMotion) { pivot.rotation.z = REST; return; }
    const u = t % CYCLE;
    let a;
    if (u < 5.6) a = REST - (u / 5.6) * 0.1;
    else if (u < 5.85) a = REST - 0.1 + (TIP - REST + 0.1) * ((u - 5.6) / 0.25);
    else if (u < 6.15) a = TIP;
    else { const k = u - 6.15; a = REST + (TIP - REST) * Math.exp(-k * 4) * Math.cos(k * 14); }
    pivot.rotation.z = a;
  });
}

// ---- 入口門（有瓦屋頂的小門）與掛燈 ----
function buildGate() {
  const { x, z } = GATE, R = roofMats(C);
  for (const dx of [-1.15, 1.15]) box(0.22, 2.5, 0.22, C.woodDark, x + dx, 0, z, { cast: true });
  box(2.8, 0.2, 0.26, C.wood, x, 2.3, z, { cast: true });
  box(2.6, 0.12, 0.18, C.wood, x, 2.0, z);
  irimoyaRoof(3.5, 1.9, 0.85, R, x, 2.52, z, { hip: 0.35, thick: 0.12 });
  // 敞開的門扇
  for (const s of [-1, 1]) {
    const hinge = grp(x + s * 1.04, 0.05, z - 0.05, 0);
    hinge.rotation.y = s * 1.2;
    box(0.95, 1.8, 0.05, C.wood, -s * 0.48, 0, 0, { parent: hinge, cast: true });
    for (let i = 1; i < 4; i++) box(0.03, 1.7, 0.07, C.woodDark, -s * 0.48 + (i - 2) * 0.24, 0.05, 0, { parent: hinge });
  }
  // 提燈
  const lanternMat = glow('#ffcf8a', 1.9);
  flames.push({ mat: lanternMat, k: 1.9, color: '#ffcf8a' });
  for (const dx of [-1.38, 1.38]) {
    rod([x + dx * 0.84, 2.1, z + 0.12], [x + dx, 2.1, z + 0.12], 0.015, C.woodDark, { outline: false });
    cyl(0.13, 0.13, 0.34, lanternMat, x + dx, 1.62, z + 0.12, { seg: 12 });
    cyl(0.09, 0.09, 0.05, C.woodDark, x + dx, 1.96, z + 0.12, { seg: 10 });
    cyl(0.09, 0.09, 0.04, C.woodDark, x + dx, 1.58, z + 0.12, { seg: 10 });
    lightPool(x + dx, z + 0.3, 1.3, 0.4);
  }
}

// ---- 中段木柵、前緣四つ目垣 ----
function buildFences() {
  const W = soft(C.wood);
  const woodFence = (x0, x1, z) => {
    const n = Math.max(1, Math.round((x1 - x0) / 1.1));
    for (let i = 0; i <= n; i++) box(0.12, 0.95, 0.12, W, x0 + (x1 - x0) * i / n, 0, z, { cast: true });
    for (const y of [0.35, 0.75]) box(x1 - x0, 0.07, 0.05, W, (x0 + x1) / 2, y, z + 0.07);
  };
  woodFence(-9.6, FENCE_GAP[0], FENCE_Z);
  woodFence(FENCE_GAP[1], 4.8, FENCE_Z);
  const bamboo = soft(C.bamboo), bambooDark = soft(C.bambooDark);
  const yotsume = (x0, x1, z) => {
    for (let x = x0; x <= x1 + 1e-6; x += 1.2) cyl(0.04, 0.04, 0.95, bambooDark, x, 0, z, { seg: 6, cast: true });
    for (let x = x0 + 0.3; x < x1; x += 0.3) rod([x, 0.05, z + 0.03], [x, 0.85, z + 0.03], 0.018, bamboo, { seg: 5 });
    for (const y of [0.3, 0.6, 0.85]) rod([x0, y, z + 0.06], [x1, y, z + 0.06], 0.022, bambooDark, { seg: 5 });
  };
  yotsume(-11.5, GATE.x - 1.3, GATE.z);
  yotsume(GATE.x + 1.5, ZEN.x0 - 0.2, GATE.z);
}

// 庭園：石燈籠（春日、雪見、織部）、枯山水石組、飛石、瓢簞池（八橋、瀑布、台地小溪）、蹲踞與鹿威し、入口門、四つ目垣
import * as THREE from 'three';
import { scene, PI, reduceMotion, onTick } from '../../engine/context.js';
import { pLight } from '../../engine/lights.js';
import { rand, pick } from '../../engine/random.js';
import { soft, glow } from '../../engine/materials.js';
import { canvasTex } from '../../engine/canvas.js';
import { box, cyl, rod, grp, irimoyaRoof, G, add } from '../../engine/geometry.js';
import { rock, blob, lightPool, roofMats, onLevel } from './shapes.js';
import { waterMesh } from './water.js';
import { C } from './palette.js';
import { HX, LV, ZEN, ZEN_ROCKS, PATH, PATH_B, PATH_UP, POND, BRIDGE, FALL, SPRING, TSUKUBAI, GATE, LANTERNS, INN } from './layout.js';
import { heightAt, pondE, wallUpZ } from './terrain.js';
import { cue } from '../../engine/audio.js';

// 燈火：給 atmosphere 做搖曳 { light?, base?, mat?, k?, color? }
export const flames = [];
// 池塘倒影要用的燈（世界座標）
const lampWorld = [];

export function buildGarden() {
  for (const [x, z, type, withLight] of LANTERNS) stoneLantern(x, z, type, withLight);
  buildZen();
  buildPath();
  buildFall();
  buildStream();
  buildPond();
  buildBridge();
  onLevel(heightAt(TSUKUBAI.x, TSUKUBAI.z), buildTsukubai);
  onLevel(heightAt(GATE.x, GATE.z), buildGate);
  buildFences();
  buildTeaBench(-8.2, 14.7);
}

// ---- 參道旁的緣台與野點傘：緋毛氈、茶盆、朱紅的傘，旁邊一盞行燈，是前景的一點暖色 ----
function buildTeaBench(x, z) {
  onLevel(heightAt(x, z), () => {
    const g = grp(x, 0, z, 0.35), P = { parent: g, cast: true };
    box(1.9, 0.08, 0.7, C.woodLight, 0, 0.42, 0, P);                                   // 座板
    for (const [dx, dz] of [[-0.85, -0.28], [0.85, -0.28], [-0.85, 0.28], [0.85, 0.28]]) box(0.07, 0.42, 0.07, C.woodDark, dx, 0, dz, P);
    box(1.94, 0.025, 0.74, '#b3302a', 0, 0.5, 0, P);                                  // 緋毛氈
    box(0.34, 0.03, 0.24, C.woodDark, 0.45, 0.525, 0, { parent: g });                 // 茶盆與茶碗
    for (const dx of [0.37, 0.53]) cyl(0.045, 0.035, 0.07, '#e8dfcf', dx, 0.555, 0.02, { parent: g, seg: 10 });
    rod([-0.62, 0, -0.5], [-0.5, 2.3, -0.42], 0.025, C.woodDark, P);                  // 野點傘
    const umbrella = soft('#b8352b', { side: THREE.DoubleSide });
    const canopy = new THREE.Mesh(G('nodategasa', () => new THREE.ConeGeometry(1.35, 0.5, 24, 1, true)), umbrella);
    canopy.position.set(-0.5, 2.36, -0.42);
    canopy.rotation.z = 0.06;
    add(canopy, P);
    for (let i = 0; i < 12; i++) {                                                      // 傘骨
      const a = i / 12 * PI * 2;
      rod([-0.5, 2.1, -0.42], [-0.5 + Math.cos(a) * 1.2, 2.18, -0.42 + Math.sin(a) * 1.2], 0.008, '#6a2a22', { parent: g, seg: 4 });
    }
    // 行燈
    const andon = glow(C.shoji, 1.6);
    flames.push({ mat: andon, k: 1.6, color: C.shoji });
    box(0.26, 0.5, 0.26, andon, 1.35, 0.06, 0.25, { parent: g, cast: false });
    for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) box(0.03, 0.62, 0.03, C.woodDark, 1.35 + dx, 0, 0.25 + dz, { parent: g });
    box(0.32, 0.04, 0.32, C.woodDark, 1.35, 0.6, 0.25, { parent: g });
  });
  lightPool(x + 1.35, z - 0.23, 1.9, 0.45);          // 群組轉了 0.35 弧度，行燈在世界座標的位置
}

// ---- 石燈籠 ----
const stoneFlat = () => soft(C.stone, { flat: true });
function flameMat() { const m = glow(C.lamp, 2.2); flames.push({ mat: m, k: 2.2, color: C.lamp }); return m; }

function stoneLantern(x, z, type, withLight) {
  const y0 = heightAt(x, z);
  let fireY;
  onLevel(y0, () => {
    const g0 = grp(x, 0, z, rand(0, PI));
    const S = stoneFlat(), P = { parent: g0, cast: true };
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
    if (withLight) {
      const l = pLight(C.lamp, 4.5, x, fireY, z, 6);
      flames.push({ light: l, base: 4.5 });
    }
  });
  lampWorld.push([x, y0 + fireY, z]);
  lightPool(x, z, withLight ? 1.6 : 1.2, withLight ? 0.5 : 0.35);
}

// ---- 枯山水：石組（主石＋苔環）與砂地邊緣的石條 ----
function buildZen() {
  const y = LV.zen;
  for (const [x, z, r] of ZEN_ROCKS) {
    blob(x, y, z, r * 1.35, 0.1, r * 1.2, soft(C.moss2), { detail: 2, cast: false });
    rock(x, y, z, r, r * 1.05, r * 0.85, pick([C.stone, C.stoneWarm]), { sink: 0.45, rough: 0.28, moss: 0.35 });
    rock(x + r * 0.9, y, z + r * 0.4, r * 0.45, r * 0.4, r * 0.4, C.stoneDark, { sink: 0.4, moss: 0.5 });
  }
  const { x0, x1, z0, z1 } = ZEN, e = 0.16, M = soft(C.stoneDark, { flat: true });
  box(x1 - x0 + e * 2, 0.45, e, M, (x0 + x1) / 2, -0.15, z0 - e / 2);
  box(x1 - x0 + e * 2, 0.45, e, M, (x0 + x1) / 2, -0.15, z1 + e / 2);
  box(e, 0.45, z1 - z0, M, x0 - e / 2, -0.15, (z0 + z1) / 2);
  box(e, 0.45, z1 - z0, M, x1 + e / 2, -0.15, (z0 + z1) / 2);
}

// ---- 飛石 ----
function buildPath() {
  const M = soft(C.stoneWarm, { flat: true }), M2 = soft('#9a948e', { flat: true });
  for (const line of [PATH, PATH_B, PATH_UP]) for (const [x, z] of line) {
    const r = rand(0.3, 0.42), px = x + rand(-0.08, 0.08), pz = z + rand(-0.08, 0.08);
    const m = cyl(r, r * 1.05, 0.14, rand(0, 1) < 0.7 ? M : M2, px, heightAt(px, pz) - 0.04, pz, { seg: 7, cast: false });
    m.scale.z = rand(0.75, 0.95);
    m.rotation.y = rand(0, PI);
  }
}

// ---- 瓢簞池：水面、池岸石、睡蓮葉、景石 ----
function buildPond() {
  const [A, B] = POND.lobes;
  const x0 = Math.min(A[0] - A[2], B[0] - B[2]) - 0.5, x1 = Math.max(A[0] + A[2], B[0] + B[2]) + 0.5;
  const z0 = Math.min(A[1] - A[3], B[1] - B[3]) - 0.5, z1 = Math.max(A[1] + A[3], B[1] + B[3]) + 0.5;
  const fallZ = wallUpZ(FALL.x) + 0.62;
  const genkan = [INN.x0 + (INN.x1 - INN.x0) * 0.5, LV.up + 1.6, INN.z1 + 0.3];
  scene.add(waterMesh({
    grid: { x0, z0, x1, z1, depth: (x, z) => LV.water - heightAt(x, z) },
    y: LV.water, shallow: '#3a6c76', deep: '#132c38', shore: '#6d8a88', sky: ['#5b4b80', '#1c1733'],
    lamps: [lampWorld[1], lampWorld[5], genkan], lampColor: '#ff9a4a',
    emitters: [[FALL.x, fallZ, 1.5, 1.0]],
  }));

  // 池岸石：從各池心往外找水岸（pondE = 1）
  const stones = [C.stone, C.stoneDark, '#7a7680', C.stoneWarm];
  for (const [cx, cz, rx, rz] of POND.lobes) {
    const N = Math.round((rx + rz) * 5.5);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * PI * 2 + rand(-0.06, 0.06), ca = Math.cos(a), sa = Math.sin(a);
      let lo = 0.3, hi = 2.0;
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; pondE(cx + ca * rx * m, cz + sa * rz * m) < 1 ? lo = m : hi = m; }
      const px = cx + ca * rx * lo * 1.02, pz = cz + sa * rz * lo * 1.02;
      if (BRIDGE.some(([bx, bz]) => Math.hypot(px - bx, pz - bz) < 0.7)) continue;
      if (Math.abs(px - FALL.x) < 0.7 && pz < fallZ + 0.3) continue;
      const r = rand(0.17, 0.36);
      rock(px, heightAt(px, pz) - 0.05, pz, r * 1.25, r * 0.7, r, pick(stones), { sink: 0.4, moss: 0.75 });
      if (i % 4 === 0) rock(px + ca * 0.45, heightAt(px + ca * 0.45, pz + sa * 0.45), pz + sa * 0.45, r * 0.8, r * 0.55, r * 0.8, pick(stones), { sink: 0.35, moss: 0.8 });
    }
  }
  rock(-12.9, heightAt(-12.9, 2.6), 2.6, 0.75, 0.9, 0.62, C.stoneDark, { sink: 0.3, moss: 0.7 });   // 景石
  rock(-7.0, heightAt(-7.0, 2.3), 2.3, 0.45, 0.5, 0.4, C.stoneWarm, { sink: 0.3, moss: 0.6 });

  // 睡蓮葉：只放在夠深的地方
  const pad = soft('#4f7a45'), pad2 = soft('#5d8a4c');
  for (let i = 0, n = 0; i < 80 && n < 14; i++) {
    const [cx, cz, rx, rz] = pick(POND.lobes), a = rand(0, PI * 2), d = Math.sqrt(rand(0.1, 0.8));
    const x = cx + Math.cos(a) * rx * d, z = cz + Math.sin(a) * rz * d;
    if (LV.water - heightAt(x, z) < 0.25 || Math.hypot(x - FALL.x, z - fallZ) < 1.2) continue;
    const m = cyl(0.17, 0.17, 0.02, n % 3 ? pad : pad2, x, LV.water + 0.004, z, { seg: 10, cast: false });
    m.scale.setScalar(rand(0.7, 1.25));
    n++;
  }
}

// ---- 小瀑布：從台地的滝口落進池裡 ----
function buildFall() {
  const x = FALL.x, zt = wallUpZ(x), top = LV.up - 0.06, bottom = LV.water;
  // 滝口：兩側立石、突出的石板
  rock(x - 0.62, LV.up - 0.25, zt + 0.05, 0.36, 0.5, 0.32, C.stoneDark, { sink: 0.5, moss: 0.7, rough: 0.25 });
  rock(x + 0.6, LV.up - 0.25, zt + 0.1, 0.32, 0.42, 0.3, C.stone, { sink: 0.5, moss: 0.7, rough: 0.25 });
  box(0.72, 0.1, 0.6, soft(C.stone, { flat: true }), x, top - 0.1, zt + 0.1, { cast: true });
  rock(x + 0.35, bottom - 0.1, zt + 0.75, 0.3, 0.28, 0.26, C.stoneDark, { sink: 0.5, moss: 0.6 });   // 落點的石
  rock(x - 0.45, bottom - 0.1, zt + 0.7, 0.26, 0.22, 0.24, C.stone, { sink: 0.5, moss: 0.6 });

  // 水簾：往外微彎的細分平面，貼圖往下捲動
  const tex = canvasTex(32, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${pick(['235,245,255', '200,225,240', '255,255,255'])},${rand(0.35, 0.9)})`;
      g.fillRect(rand(0, w), rand(0, h), rand(2, 5), rand(18, 60));
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const H = top - bottom, geo = new THREE.PlaneGeometry(0.5, H, 1, 10);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = (H / 2 - p.getY(i)) / H;                        // 0 頂、1 底
    p.setZ(i, 0.36 + 0.3 * f * f);
    p.setX(i, p.getX(i) * (1 + f * 0.35));
  }
  const sheet = new THREE.Mesh(geo, glow('#dcecff', 0.95, { map: tex, opacity: 0.85, side: THREE.DoubleSide }));
  sheet.position.set(x, bottom + H / 2, zt);
  sheet.userData.dynamic = true;
  scene.add(sheet);
  // 落點的白沫
  const foam = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(G('foam', () => new THREE.SphereGeometry(1, 10, 6)), glow('#e8f2ff', 0.8, { opacity: 0.45 }));
    m.position.set(x + rand(-0.2, 0.2), bottom + 0.02, zt + 0.62 + rand(-0.12, 0.12));
    m.userData.dynamic = true;
    scene.add(m);
    foam.push({ m, ph: rand(0, PI * 2) });
  }
  onTick(t => {
    tex.offset.y = t * 1.4;
    for (const f of foam) { const s = 0.13 + 0.05 * Math.sin(t * 5 + f.ph); f.m.scale.set(s * 1.6, s * 0.35, s * 1.6); }
  });
}

// ---- 台地上的小溪：泉源的石組 → 淺淺的水道 → 滝口 ----
function buildStream() {
  const pts = [];
  for (let i = 0; i < SPRING.length - 1; i++) {
    const [ax, az] = SPRING[i], [bx, bz] = SPRING[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.15);
    for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  pts.push(SPRING[SPRING.length - 1]);
  const pos = [], uv = [], idx = [];
  let len = 0;
  pts.forEach(([x, z], i) => {
    const [nx, nz] = pts[Math.min(i + 1, pts.length - 1)], [px, pz] = pts[Math.max(i - 1, 0)];
    let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    if (i) len += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const w = 0.17, y = Math.max(heightAt(x, z) + 0.09, LV.up - 0.12);
    pos.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w);
    uv.push(0, len / 0.8, 1, len / 0.8);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const tex = canvasTex(32, 64, (g, w, h) => {
    g.fillStyle = '#3f6c78'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(210,235,245,${rand(0.2, 0.6)})`; g.fillRect(rand(0, w), rand(0, h), rand(3, 9), rand(2, 4)); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const m = new THREE.Mesh(geo, glow('#b8d4dc', 0.75, { map: tex, side: THREE.DoubleSide }));
  m.userData.dynamic = true;
  scene.add(m);
  onTick(t => { tex.offset.y = -t * 0.9; });
  // 兩岸的小石與泉源的石組
  for (let i = 2; i < pts.length - 2; i += 3) {
    const [x, z] = pts[i], s = i % 2 ? 1 : -1, [nx, nz] = pts[i + 1];
    const dx = nx - x, dz = nz - z, l = Math.hypot(dx, dz) || 1;
    const px = x - dz / l * 0.3 * s, pz = z + dx / l * 0.3 * s, r = rand(0.1, 0.2);
    rock(px, heightAt(px, pz), pz, r * 1.2, r * 0.8, r, pick([C.stone, C.stoneDark]), { sink: 0.4, moss: 0.8 });
  }
  const [sx, sz] = SPRING[0];
  rock(sx - 0.4, heightAt(sx, sz), sz - 0.3, 0.6, 0.55, 0.5, C.stoneDark, { sink: 0.35, moss: 0.8 });
  rock(sx + 0.45, heightAt(sx, sz), sz - 0.15, 0.4, 0.35, 0.38, C.stone, { sink: 0.35, moss: 0.8 });
}

// ---- 八橋：折線排列的石板，接點下方墊石 ----
function buildBridge() {
  const slab = soft('#9c968f', { flat: true }), y = LV.water + 0.3;
  for (let i = 0; i < BRIDGE.length - 1; i++) {
    const [ax, az] = BRIDGE[i], [bx, bz] = BRIDGE[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const b = box(len + 0.5, 0.14, 0.52, slab, (ax + bx) / 2, y, (az + bz) / 2, { cast: true });
    b.rotation.y = -Math.atan2(bz - az, bx - ax);
  }
  for (const [x, z] of BRIDGE.slice(1, -1)) rock(x, LV.bed + 0.1, z, 0.3, (y - LV.bed) / 2, 0.3, C.stoneDark, { sink: 1, rough: 0.15, moss: 0.4 });
}

// ---- 蹲踞與鹿威し（在 onLevel 裡建造，座標以地面為 0）----
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
  const REST = 0.32, TIP = -0.5, CYCLE = 9;
  const KNOCK = 7.65 + PI / 28;                                  // 回彈第一次回到原位：尾端敲到石頭的瞬間
  const wy = heightAt(x, z) + 0.3;                               // 聲音用世界座標
  let pu = 0;
  onTick(t => {
    if (reduceMotion) { pivot.rotation.z = REST; return; }
    const u = t % CYCLE;
    if (pu < 7.3 && u >= 7.3) cue('pour', sx + 0.36, wy - 0.1, sz);
    if (pu < KNOCK && u >= KNOCK) cue('knock', sx - 0.34, wy - 0.15, sz);
    pu = u;
    let a;
    if (u < 7.1) a = REST - (u / 7.1) * 0.1;
    else if (u < 7.35) a = REST - 0.1 + (TIP - REST + 0.1) * ((u - 7.1) / 0.25);
    else if (u < 7.65) a = TIP;
    else { const k = u - 7.65; a = REST + (TIP - REST) * Math.exp(-k * 4) * Math.cos(k * 14); }
    pivot.rotation.z = a;
  });
}

// ---- 入口門（有瓦屋頂的小門）與掛燈（在 onLevel 裡建造）----
function buildGate() {
  const { x, z } = GATE, R = roofMats(C);
  for (const dx of [-1.15, 1.15]) box(0.22, 2.5, 0.22, C.woodDark, x + dx, 0, z, { cast: true });
  box(2.8, 0.2, 0.26, C.wood, x, 2.3, z, { cast: true });
  box(2.6, 0.12, 0.18, C.wood, x, 2.0, z);
  irimoyaRoof(3.5, 1.9, 0.85, R, x, 2.52, z, { hip: 0.35, thick: 0.12 });
  for (const s of [-1, 1]) {                                   // 敞開的門扇
    const hinge = grp(x + s * 1.04, 0.05, z - 0.05, 0);
    hinge.rotation.y = s * 1.2;
    box(0.95, 1.8, 0.05, C.wood, -s * 0.48, 0, 0, { parent: hinge, cast: true });
    for (let i = 1; i < 4; i++) box(0.03, 1.7, 0.07, C.woodDark, -s * 0.48 + (i - 2) * 0.24, 0.05, 0, { parent: hinge });
  }
  const lanternMat = glow('#ffcf8a', 1.9);                     // 提燈
  flames.push({ mat: lanternMat, k: 1.9, color: '#ffcf8a' });
  for (const dx of [-1.38, 1.38]) {
    rod([x + dx * 0.84, 2.1, z + 0.12], [x + dx, 2.1, z + 0.12], 0.015, C.woodDark, { outline: false });
    cyl(0.13, 0.13, 0.34, lanternMat, x + dx, 1.62, z + 0.12, { seg: 12 });
    cyl(0.09, 0.09, 0.05, C.woodDark, x + dx, 1.96, z + 0.12, { seg: 10 });
    cyl(0.09, 0.09, 0.04, C.woodDark, x + dx, 1.58, z + 0.12, { seg: 10 });
    lightPool(x + dx, z + 0.3, 1.3, 0.4);
  }
}

// ---- 四つ目垣：沿入口門兩側，每一格依地面高度立柱、架橫竹 ----
function buildFences() {
  const bamboo = soft(C.bamboo), bambooDark = soft(C.bambooDark);
  const yotsume = (x0, x1, z) => {
    const n = Math.max(1, Math.round((x1 - x0) / 1.2)), sp = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * sp, xb = xa + sp, ya = heightAt(xa, z), yb = heightAt(xb, z);
      cyl(0.04, 0.04, 1.0, bambooDark, xa, ya - 0.05, z, { seg: 6, cast: true });
      for (let k = 1; k < 4; k++) { const xv = xa + sp * k / 4, yv = heightAt(xv, z); rod([xv, yv - 0.05, z + 0.03], [xv, yv + 0.85, z + 0.03], 0.018, bamboo, { seg: 5 }); }
      for (const y of [0.3, 0.6, 0.85]) rod([xa, ya + y, z + 0.06], [xb, yb + y, z + 0.06], 0.022, bambooDark, { seg: 5 });
    }
    cyl(0.04, 0.04, 1.0, bambooDark, x1, heightAt(x1, z) - 0.05, z, { seg: 6, cast: true });
  };
  yotsume(-HX + 0.4, GATE.x - 1.3, GATE.z);
  yotsume(GATE.x + 1.5, HX - 0.4, GATE.z);
}

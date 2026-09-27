// 地被：修剪的灌木與綠籬（小葉葉團）、草叢、芒草、蕨類、低矮的苔丘、地上的楓葉（樹下、牆腳、柵欄腳、石上、階角）
import * as THREE from 'three';
import { PI } from '../../engine/context.js';
import { rng, rand, pick } from '../../engine/random.js';
import { soft } from '../../engine/materials.js';
import { windy } from './wind.js';
import { bakeLeaves, leafCloud, coreBlob, randDir } from './foliage.js';
import { smallLeafGeo, grassTuftGeo, susukiGeo, plumeGeo, fernGeo, mapleLeafGeo } from './leaves.js';
import { blob } from './shapes.js';
import { heightAt, isWater, pondE, wallUpZ, wallLowZ, WALL_RUN, upness, distToPolyline } from './terrain.js';
import { C } from './palette.js';
import { HX, HZ, LV, MAPLES, LANTERNS, PATH, PATH_B, PATH_UP, ZEN, GATE, STAIRS_UP, STAIRS_LOW, INN, ANNEX, DECK, ONSEN, TSUKUBAI, MOUND, SPRING, FALL } from './layout.js';

const UP = new THREE.Vector3(0, 1, 0);
const mats = {
  shrub: () => windy('#ffffff', { vc: true, leaf: true, amp: 0.02, flutter: 0.006 }),
  core: () => windy('#ffffff', { vc: true, amp: 0.02 }),
  grass: () => windy('#ffffff', { vc: true, leaf: true, amp: 0.16, flutter: 0.008 }),
  plume: () => windy('#ffffff', { vc: true, leaf: true, amp: 0.13, flutter: 0.025 }),
  fern: () => windy('#ffffff', { vc: true, leaf: true, amp: 0.08, flutter: 0.01 }),
  ground: () => soft('#ffffff', { vc: true, side: THREE.DoubleSide }),
};

// ---- 可以長東西的地面：不在水裡、枯山水、飛石、石段、建物上 ----
const inRect = (x, z, x0, z0, x1, z1, p = 0) => x > x0 - p && x < x1 + p && z > z0 - p && z < z1 + p;
const onPath = (x, z, d) => [PATH, PATH_B, PATH_UP].some(l => distToPolyline(l, x, z) < d);
const onStairs = (x, z) => [[STAIRS_UP, wallUpZ], [STAIRS_LOW, wallLowZ]].some(([s, zf]) => Math.abs(x - s.x) < s.w / 2 + 0.45 && z > zf(s.x) - 0.3 && z < zf(s.x) + s.n * s.run + 0.2);
function free(x, z, o = {}) {
  if (Math.abs(x) > HX - 0.2 || Math.abs(z) > HZ - 0.2) return false;
  if (isWater(x, z) || pondE(x, z) < 1.02) return false;
  if (!o.zen && inRect(x, z, ZEN.x0, ZEN.z0, ZEN.x1, ZEN.z1, 0.2)) return false;
  if (inRect(x, z, INN.x0, INN.z0, INN.x1, INN.z1 + 2.4, 0.3) || inRect(x, z, ANNEX.x0, ANNEX.z0, DECK.x1, DECK.z1, 0.3)) return false;
  if (Math.hypot((x - ONSEN.cx) / (ONSEN.rx + 0.9), (z - ONSEN.cz) / (ONSEN.rz + 0.9)) < 1) return false;
  if (!o.path && onPath(x, z, 0.45)) return false;
  if (onStairs(x, z)) return false;
  if (Math.abs(x - GATE.x) < 1.5 && Math.abs(z - GATE.z) < 0.9) return false;
  if (distToPolyline(SPRING, x, z) < 0.3) return false;
  return true;
}

export function buildGroundcover() {
  shrubs();
  grass();
  susuki();
  ferns();
  mossMounds();
  groundLeaves();
}

// ---- 灌木與綠籬：三個小葉團組成一叢；杜鵑入秋轉紅 ----
const SHRUB_PAL = [['#1c3628', '#4c7648'], ['#4e211d', '#c24a30'], ['#2a3a24', '#7a8a3e']];
function shrub(x, z, s, kind, clusters, hedge = false) {
  const y0 = heightAt(x, z), pal = SHRUB_PAL[kind];
  for (let i = 0; i < (hedge ? 2 : 3); i++) {
    const r = (hedge ? 0.5 : rand(0.34, 0.52)) * s;
    const c = [x + rand(-0.32, 0.32) * s, y0 + r * (hedge ? 0.72 : 0.6), z + rand(-0.28, 0.28) * s];
    const rr = hedge ? [r * 1.05, r * 0.78, r * 0.85] : [r, r * 0.82, r];
    clusters.push({ c, r: rr, n: Math.round(300 * rr[0] * rr[2] + 16), base: y0, pal });
    coreBlob(c, rr.map(v => v * 0.8), new THREE.Color(pal[0]).multiplyScalar(0.9), y0, mats.core());
  }
}
function shrubs() {
  const cl = [];
  for (const [x, z, s, k] of [
    [-9.2, -6.4, 1.0, 0], [-8.8, -4.3, 0.85, 1], [3.2, -5.4, 0.8, 0], [3.6, -9.9, 0.9, 2], [-9.6, -10.2, 0.9, 0],
    [12.6, -6.0, 0.85, 0], [12.9, -4.0, 0.8, 1], [14.8, -6.8, 0.8, 2],
    [-5.4, 0.3, 0.8, 0], [0.4, 0.8, 0.75, 1], [-7.8, 7.6, 0.9, 1], [-14.4, 8.6, 0.95, 0], [-1.8, 10.5, 0.8, 1], [2.3, 10.4, 0.8, 0],
    [4.6, 1.4, 0.8, 2], [14.8, 1.2, 0.85, 1], [15.0, 6.0, 0.8, 0], [-9.4, 10.4, 0.8, 0], [-3.6, 3.0, 0.65, 1],
    [-5.4, 13.4, 0.85, 1], [6.9, 13.2, 0.9, 0], [-14.8, 16.0, 0.8, 0], [11.4, 16.2, 0.8, 1], [-2.6, 14.6, 0.65, 2],
  ]) shrub(x, z, s, k, cl);
  // 綠籬：枯山水前緣、台地前緣（石段兩側）
  for (let x = ZEN.x0 + 0.4; x <= ZEN.x1 - 0.2; x += 0.95) shrub(x, 10.85, 0.8, rng() < 0.2 ? 1 : 0, cl, true);
  for (let x = -9.4; x <= -4.5; x += 0.95) shrub(x, wallUpZ(x) - 0.55, 0.75, rng() < 0.25 ? 1 : 0, cl, true);
  for (let x = -0.4; x <= 3.4; x += 0.95) shrub(x, wallUpZ(x) - 0.55, 0.75, rng() < 0.25 ? 1 : 0, cl, true);
  leafCloud(cl, { geo: smallLeafGeo(), mat: mats.shrub(), size: [0.1, 0.14], inner: 0.15, nb: 0.78, upBias: 0.5, droop: 0.2 });
}

// ---- 草叢：沿池岸、牆腳、小徑邊、燈籠腳，以及苔地與參道上零星散布 ----
const GRASS_COLS = ['#3f5e3a', '#4d6e3f', '#5a7a44', '#44663c', '#8a8a44', '#9a8448'].map(c => new THREE.Color(c));
function grass() {
  const list = [];
  const add = (x, z, s = rand(0.26, 0.42)) => {
    if (!free(x, z)) return;
    const n = UP.clone().add(randDir(new THREE.Vector3()).multiplyScalar(0.15));
    const col = (rng() < 0.22 ? pick(GRASS_COLS.slice(4)) : pick(GRASS_COLS.slice(0, 4))).clone().multiplyScalar(rand(0.85, 1.1));
    list.push({ p: new THREE.Vector3(x, heightAt(x, z) - 0.02, z), n, t: new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)), s, col, sn: UP, nb: 0.55, sway: 0 });
  };
  // 池岸
  for (const [cx, cz, rx, rz] of [[-10.8, 0.4, 2.6, 2.3], [-8.3, 3.5, 1.8, 1.4]]) for (let a = 0; a < PI * 2; a += 0.3) {
    const k = rand(1.12, 1.3);
    add(cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k);
  }
  // 石垣腳與參道牆腳
  for (let x = -15.5; x < 15.5; x += rand(0.4, 0.9)) add(x + rand(-0.1, 0.1), wallUpZ(x) + WALL_RUN + rand(0.1, 0.35));
  for (let x = -15.5; x < 15.5; x += rand(0.6, 1.2)) add(x, wallLowZ(x) + WALL_RUN + rand(0.1, 0.3));
  for (let x = -15.5; x < 15.5; x += rand(0.5, 1.1)) add(x, GATE.z + rand(-0.35, 0.35));
  // 小徑邊、燈籠腳
  for (const line of [PATH, PATH_B]) for (const [x, z] of line) if (rng() < 0.6) { const a = rand(0, PI * 2); add(x + Math.cos(a) * 0.62, z + Math.sin(a) * 0.62); }
  for (const [x, z] of LANTERNS) for (let i = 0; i < 3; i++) { const a = rand(0, PI * 2); add(x + Math.cos(a) * rand(0.4, 0.6), z + Math.sin(a) * rand(0.4, 0.6)); }
  // 零星
  for (let i = 0; i < 260; i++) add(rand(-HX, HX), rand(-12, HZ));
  for (let i = 0; i < 60; i++) { const a = rand(0, PI * 2), d = rand(0, MOUND.r); add(MOUND.x + Math.cos(a) * d, MOUND.z + Math.sin(a) * d); }
  bakeLeaves(list, grassTuftGeo(), mats.grass(), { cast: false });
}

// ---- 芒草：參道兩側、築山腳、台地右緣；細長的葉叢加上垂彎的銀白穗 ----
function susuki() {
  const blades = [], plumes = [];
  const bladeCols = ['#8a8a55', '#9a9058', '#7a8450', '#a8985a'].map(c => new THREE.Color(c));
  const plumeCols = ['#bba88c', '#c9b79c', '#ad9a80', '#d2c2a8'].map(c => new THREE.Color(c));
  for (const [x, z, s] of [[-6.8, 14.2, 1.2], [-9.8, 15.6, 1.4], [-13.8, 13.2, 1.1], [4.2, 15.8, 1.2], [9.6, 14.6, 1.3], [12.8, 15.9, 1.1],
    [15.0, 13.0, 1.2], [-15.0, 3.2, 1.1], [15.0, -3.4, 1.2], [13.2, -2.8, 0.9], [-14.9, 12.1, 0.9]]) {
    if (!free(x, z)) continue;
    const y0 = heightAt(x, z);
    blades.push({ p: new THREE.Vector3(x, y0 - 0.03, z), n: UP, t: new THREE.Vector3(1, 0, 0), s: [s, s * 1.15, s], col: pick(bladeCols), sn: UP, nb: 0.5, sway: 0 });
    for (let i = 0, n = 5 + Math.floor(rand(0, 4)); i < n; i++) {
      const a = rand(0, PI * 2), r = rand(0.05, 0.22) * s, h = rand(0.78, 1.05) * s;
      const t = new THREE.Vector3(Math.cos(a), rand(0.4, 1.2), Math.sin(a));
      plumes.push({ p: new THREE.Vector3(x + Math.cos(a) * r, y0 + h, z + Math.sin(a) * r), n: new THREE.Vector3(-Math.sin(a), 0.3, Math.cos(a)), t, s: rand(0.3, 0.42) * s, col: pick(plumeCols), sn: UP, nb: 0.6, sway: h });
    }
  }
  bakeLeaves(blades, susukiGeo(), mats.grass(), { cast: true });
  bakeLeaves(plumes, plumeGeo(), mats.plume(), { cast: false });
}

// ---- 蕨類：瀑布邊、石垣腳的陰處、竹林下、泉源旁 ----
function ferns() {
  const list = [], cols = ['#3f6a3a', '#4f7a42', '#46703d', '#7a6a3a'].map(c => new THREE.Color(c));
  const clump = (x, z, s = 1) => {
    if (!free(x, z)) return;
    const y0 = heightAt(x, z), a0 = rand(0, PI * 2), col = rng() < 0.15 ? cols[3] : pick(cols.slice(0, 3));
    for (let i = 0, n = 5 + Math.floor(rand(0, 3)); i < n; i++) {
      const a = a0 + i / n * PI * 2 + rand(-0.25, 0.25);
      list.push({ p: new THREE.Vector3(x, y0, z), n: UP, t: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), s: rand(0.45, 0.7) * s, col: col.clone().multiplyScalar(rand(0.85, 1.1)), sn: UP, nb: 0.5, sway: 0 });
    }
  };
  for (const [x, z] of [[FALL.x - 1.2, wallUpZ(FALL.x) + 0.6], [FALL.x + 1.3, wallUpZ(FALL.x) + 0.5], [-13.8, -5.9], [-12.9, -3.2], [-14.6, -2.4], [TSUKUBAI.x - 0.7, TSUKUBAI.z + 0.6],
    [-6.6, -1.0], [-15.2, 1.6], [-12.4, 6.9], [-4.9, 7.3]]) clump(x, z);
  for (let i = 0; i < 12; i++) clump(rand(-15.6, -11.2), rand(-16, -3.2), rand(0.8, 1.1));
  bakeLeaves(list, fernGeo(), mats.fern(), { cast: true });
}

// ---- 苔丘：低矮、扁平，散在苔庭 ----
function mossMounds() {
  const ms = [soft(C.moss), soft(C.moss2), soft('#48684c')];
  for (let tries = 0, placed = 0; tries < 400 && placed < 16; tries++) {
    const x = rand(-15, 3), z = rand(0, 11), r = rand(0.5, 1.1);
    if (!free(x, z) || upness(x, z) > 0.2 || onPath(x, z, 0.9 + r * 0.5)) continue;
    if (LANTERNS.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 1.0) || MAPLES.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 0.6)) continue;
    if (Math.hypot(x - TSUKUBAI.x, z - TSUKUBAI.z) < 1.8 || pondE(x, z) < 1.25) continue;
    blob(x, heightAt(x, z) - 0.02, z, r, rand(0.12, 0.22), r * rand(0.7, 1.0), pick(ms), { detail: 2, cast: false });
    placed++;
  }
}

// ---- 地上的楓葉：樹下最密，其餘堆在牆腳、柵欄腳、燈籠腳、飛石上、階角，枯山水上零星幾片 ----
const LEAF_COLS = ['#c9352b', '#e8622c', '#f28a2e', '#f5b73a', '#a83a28', '#8a4a2c', '#b8742e', '#6e4a2c'].map(c => new THREE.Color(c));
function groundLeaves() {
  const list = [];
  const leaf = (x, z, y = null, o = {}) => {
    if (y === null) { if (!free(x, z, o)) return; y = heightAt(x, z); }
    const n = UP.clone().add(randDir(new THREE.Vector3()).multiplyScalar(0.28));
    const col = pick(LEAF_COLS).clone().multiplyScalar(rand(0.75, 1.05));
    list.push({ p: new THREE.Vector3(x, y + 0.014, z), n, t: new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)), s: rand(0.1, 0.16), col });
  };
  for (const [x, z, s] of MAPLES) for (let i = 0; i < 130 * s; i++) {
    const a = rand(0, PI * 2), d = Math.pow(rand(0, 1), 0.7) * 2.9 * s;
    leaf(x + Math.cos(a) * d, z + Math.sin(a) * d);
  }
  for (let x = -15.5; x < 15.5; x += rand(0.06, 0.2)) if (rng() < 0.55) leaf(x, wallUpZ(x) + WALL_RUN + rand(0.02, 0.3));
  for (let x = -15.5; x < 15.5; x += rand(0.1, 0.3)) if (rng() < 0.5) leaf(x, wallLowZ(x) + WALL_RUN + rand(0.02, 0.25));
  for (let x = -15.5; x < 15.5; x += rand(0.08, 0.25)) if (rng() < 0.5) leaf(x, GATE.z + rand(-0.3, 0.3) * rand(0.2, 1));
  for (const [x, z] of LANTERNS) for (let i = 0; i < 10; i++) { const a = rand(0, PI * 2), d = rand(0.3, 0.7); leaf(x + Math.cos(a) * d, z + Math.sin(a) * d); }
  // 飛石上
  for (const line of [PATH, PATH_B, PATH_UP]) for (const [x, z] of line) if (rng() < 0.55) {
    for (let i = 0; i < 1 + Math.floor(rand(0, 3)); i++) leaf(x + rand(-0.22, 0.22), z + rand(-0.18, 0.18), heightAt(x, z) + 0.1);
  }
  // 石段的階角
  for (const [st, zf, hi, lo] of [[STAIRS_UP, wallUpZ, LV.up, LV.mid], [STAIRS_LOW, wallLowZ, LV.mid, LV.low]]) {
    const rise = (hi - lo) / (st.n + 1), zt = zf(st.x);
    for (let i = 0; i < st.n; i++) for (const sd of [-1, 1]) for (let k = 0; k < 2 + Math.floor(rand(0, 3)); k++)
      leaf(st.x + sd * (st.w / 2 - rand(0.05, 0.3)), zt + (i + rand(0.15, 0.85)) * st.run, hi - (i + 1) * rise + 0.002);
  }
  // 枯山水上零星幾片
  for (let i = 0; i < 14; i++) { const x = rand(ZEN.x0 + 0.2, ZEN.x1 - 0.2), z = rand(ZEN.z0 + 0.2, ZEN.z1 - 0.2); leaf(x, z, LV.zen + 0.004); }
  // 其餘散落
  for (let i = 0; i < 500; i++) leaf(rand(-HX, HX), rand(-12, HZ));
  bakeLeaves(list, mapleLeafGeo(), mats.ground(), { cast: false });
}

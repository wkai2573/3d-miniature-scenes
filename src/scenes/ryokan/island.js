// 浮島：高度場地面（彩繪苔庭、枯山水、碎石、參道、楓葉）、石垣與石段、沿地形輪廓的崖壁地層、往下收尖的底部
import * as THREE from 'three';
import { scene, PI } from '../../engine/context.js';
import { rand, pick } from '../../engine/random.js';
import { fbm3, noise3 } from '../../engine/noise.js';
import { canvasTex } from '../../engine/canvas.js';
import { soft } from '../../engine/materials.js';
import { box } from '../../engine/geometry.js';
import { rock, block } from './shapes.js';
import { C } from './palette.js';
import { HX, HZ, LV, WALL_UP, WALL_LOW, STAIRS_UP, STAIRS_LOW, ZEN, ZEN_ROCKS, PATH, PATH_B, PATH_UP, MAPLES, BAMBOO, INN, ANNEX, ONSEN } from './layout.js';
import { heightAt, upness, wallUpZ, wallLowZ, WALL_RUN, pondE, ss } from './terrain.js';

const CLIFF = 4.4;   // 崖壁底部的深度（y = -CLIFF）

// ---- 地面彩繪：世界座標 → 畫布 ----
const GW = 2048, GH = Math.round(GW * HZ / HX), PXM = GW / (HX * 2);
const Px = x => (x + HX) * PXM, Pz = z => (z + HZ) * PXM;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const K = {
  moss: hex(C.moss), moss2: hex('#37573f'), mossDry: hex('#3d4f3a'),
  earth: hex('#57515c'), terraceMoss: hex('#34503e'),
  forest: hex('#2c382f'), needles: hex('#3e3a2d'), bambooFloor: hex('#3d3c2d'),
  gravel: hex('#5b5662'), wet: hex('#243330'), soil: hex('#4c4046'),
};
const nearBuildings = (x, z) => {
  const d = (x0, z0, x1, z1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  return Math.min(d(INN.x0, INN.z0, INN.x1, INN.z1 + 2.4), d(ANNEX.x0, ANNEX.z0, ONSEN.cx + ONSEN.rx, ONSEN.cz + ONSEN.rz));
};

// 依地形分區決定底色（台地、後山、竹林、庭園苔地、參道碎石、池岸、陡坡）
function baseColor(x, z, grad) {
  const n = fbm3(x * 0.45, z * 0.45, 9), n2 = noise3(x * 2.3, z * 2.3, 4);
  let c;
  if (z > wallLowZ(x) + WALL_RUN * 0.5) c = mix(K.gravel, K.soil, 0.25 + 0.2 * n);
  else if (upness(x, z) > 0.5) {
    c = mix(K.earth, K.terraceMoss, ss(0.6, 2.4, nearBuildings(x, z) + n * 0.8));
    c = mix(c, mix(K.forest, K.needles, 0.5 + 0.5 * n), ss(-11.6, -13.2, z));
    c = mix(c, K.bambooFloor, ss(-10.6, -12.0, x) * ss(-2.2, -3.6, z));
  } else c = mix(mix(K.moss, K.moss2, 0.5 + 0.5 * n), K.mossDry, ss(0.3, 0.8, n2) * 0.4);
  c = mix(c, K.wet, ss(1.2, 0.95, pondE(x, z)));
  c = mix(c, K.soil, ss(0.7, 1.8, grad));
  const k = 0.93 + 0.08 * n2;
  return [c[0] * k, c[1] * k, c[2] * k];
}

// 楓葉印章：五裂掌狀，帶一小段葉柄
export function leafStamp(g, x, y, s, a, col) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i <= 30; i++) {
    const t = i / 30 * PI * 2, r = s * (0.42 + 0.58 * Math.pow(Math.abs(Math.cos(t * 2.5)), 0.8));
    const px = Math.sin(t) * r, py = -Math.cos(t) * r;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.fill();
  g.strokeStyle = col; g.lineWidth = Math.max(1, s * 0.15);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, s * 1.2); g.stroke();
  g.restore();
}
const LEAF_COLS = ['#c9352b', '#e8622c', '#f28a2e', '#f5b73a', '#a83a28', '#8a4a2c', '#b8742e'];

// 枯山水：平行耙紋，主石周圍改成同心圓
function rakeSand(g) {
  const { x0, x1, z0, z1 } = ZEN, step = 0.2;
  const groove = draw => {
    g.strokeStyle = '#8a837a'; g.lineWidth = 3; draw(1.5);
    g.strokeStyle = '#c6c0b6'; g.lineWidth = 2; draw(-1);
  };
  g.save();
  g.beginPath(); g.rect(Px(x0), Pz(z0), (x1 - x0) * PXM, (z1 - z0) * PXM); g.clip();
  g.fillStyle = C.sand; g.fillRect(Px(x0), Pz(z0), (x1 - x0) * PXM, (z1 - z0) * PXM);
  for (let z = z0 + 0.1; z < z1; z += step) groove(o => { g.beginPath(); g.moveTo(Px(x0), Pz(z) + o); g.lineTo(Px(x1), Pz(z) + o); g.stroke(); });
  for (const [rx, rz, r] of ZEN_ROCKS) {
    const R = r + 1.3;
    g.fillStyle = C.sand; g.beginPath(); g.arc(Px(rx), Pz(rz), R * PXM, 0, PI * 2); g.fill();
    for (let rr = r + 0.12; rr <= R; rr += step) groove(o => { g.beginPath(); g.arc(Px(rx), Pz(rz) + o, rr * PXM, 0, PI * 2); g.stroke(); });
  }
  g.restore();
}

function paintGround(g) {
  // 1) 低解析度底色，放大到整張畫布，分區交界自然柔和
  const LW = 384, LH = Math.round(LW * HZ / HX), cell = HX * 2 / LW;
  const Hs = new Float32Array(LW * LH);
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) Hs[j * LW + i] = heightAt(-HX + (i + 0.5) * cell, -HZ + (j + 0.5) * cell);
  const small = document.createElement('canvas');
  small.width = LW; small.height = LH;
  const sg = small.getContext('2d'), img = sg.createImageData(LW, LH);
  for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) {
    const hx = Hs[j * LW + Math.min(LW - 1, i + 1)] - Hs[j * LW + Math.max(0, i - 1)];
    const hz = Hs[Math.min(LH - 1, j + 1) * LW + i] - Hs[Math.max(0, j - 1) * LW + i];
    const c = baseColor(-HX + (i + 0.5) * cell, -HZ + (j + 0.5) * cell, Math.hypot(hx, hz) / (2 * cell));
    const o = (j * LW + i) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, GW, GH);

  const dots = (x0, z0, x1, z1, n, cols, size = [1, 3], test = null) => {
    for (let i = 0; i < n; i++) {
      const x = rand(x0, x1), z = rand(z0, z1);
      if (test && !test(x, z)) continue;
      g.fillStyle = pick(cols);
      const s = rand(size[0], size[1]);
      g.fillRect(Px(x), Pz(z), s, s);
    }
  };
  const strokes = (x0, z0, x1, z1, n, cols, len, test = null) => {
    g.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      const x = rand(x0, x1), z = rand(z0, z1);
      if (test && !test(x, z)) continue;
      const a = rand(0, PI), l = rand(len[0], len[1]);
      g.strokeStyle = pick(cols);
      g.beginPath(); g.moveTo(Px(x), Pz(z)); g.lineTo(Px(x) + Math.cos(a) * l, Pz(z) + Math.sin(a) * l); g.stroke();
    }
  };
  const garden = (x, z) => upness(x, z) < 0.5 && z < wallLowZ(x) && pondE(x, z) > 1.05;

  // 2) 各區細節
  dots(-HX, -HZ, HX, HZ, 26000, ['#3a3540', '#514a55', '#2d3a32'], [1, 2]);
  dots(INN.x0 - 2, INN.z0 - 1, ONSEN.cx + 3, -1.8, 9000, ['#4e4854', '#696270', '#625b69'], [1, 3], (x, z) => nearBuildings(x, z) < 1.5);
  strokes(-HX, -HZ, HX, -11.8, 7000, ['#5a4a33', '#4a3f2c', '#2f3a2f', '#6a5a3a'], [3, 7]);                   // 杉的落針
  strokes(BAMBOO.x0, BAMBOO.z0, BAMBOO.x1 + 0.5, BAMBOO.z1, 5000, ['#8a8452', '#6f6a40', '#a09a60'], [4, 9]); // 竹的落葉
  g.fillStyle = '#294336';
  for (let i = 0; i < 90; i++) {                                                                              // 苔地的深淺斑
    const x = rand(-HX, HX), z = rand(-2, 12);
    if (!garden(x, z)) continue;
    g.globalAlpha = 0.5;
    g.fillStyle = pick(['#294336', '#3b5c43', '#2c4a38']);
    g.beginPath(); g.ellipse(Px(x), Pz(z), rand(0.3, 1.2) * PXM, rand(0.2, 0.8) * PXM, rand(0, PI), 0, PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  dots(-HX, -2, HX, 12.4, 14000, ['#4c6e4a', '#26402f', '#557a4d'], [1, 2], garden);

  // 碎石小徑（飛石底下）
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [line, w] of [[PATH, 1.1], [PATH_B, 0.9], [PATH_UP, 1.2]]) {
    g.strokeStyle = '#5f5a67'; g.lineWidth = w * PXM;
    g.beginPath(); line.forEach(([x, z], i) => i ? g.lineTo(Px(x), Pz(z)) : g.moveTo(Px(x), Pz(z))); g.stroke();
    for (const [x, z] of line) dots(x - 0.6, z - 0.5, x + 0.6, z + 0.5, 110, ['#77727d', '#58535e', '#8a8590']);
  }
  // 參道的延段（大小石板拼成的步道）
  for (let z = wallLowZ(STAIRS_LOW.x) + STAIRS_LOW.n * STAIRS_LOW.run + 0.1; z < HZ - 0.1; z += 0.34) {
    for (let x = STAIRS_LOW.x - 0.8; x < STAIRS_LOW.x + 0.8;) {
      const w = rand(0.25, 0.5);
      g.fillStyle = pick(['#7d7883', '#8a8590', '#6d6874', '#918b85']);
      g.beginPath();
      g.moveTo(Px(x + 0.02), Pz(z + rand(0, 0.04))); g.lineTo(Px(x + w - 0.03), Pz(z + rand(0, 0.04)));
      g.lineTo(Px(x + w - 0.02), Pz(z + 0.3 - rand(0, 0.04))); g.lineTo(Px(x + 0.03), Pz(z + 0.3 - rand(0, 0.04)));
      g.fill();
      x += w;
    }
  }
  dots(-HX, 12.4, HX, HZ, 9000, ['#6e6874', '#4c4752', '#817b86'], [1, 3]);

  rakeSand(g);

  // 楓葉：樹下密、往外稀；庭園裡零星散落
  for (const [x, z, s] of MAPLES) {
    for (let i = 0; i < 240 * s; i++) {
      const a = rand(0, PI * 2), d = Math.pow(rand(0, 1), 0.65) * 2.6 * s;
      const lx = x + Math.cos(a) * d, lz = z + Math.sin(a) * d;
      if (pondE(lx, lz) < 1.0) continue;
      leafStamp(g, Px(lx), Pz(lz), rand(3, 5.5), rand(0, PI * 2), pick(LEAF_COLS));
    }
  }
  for (let i = 0; i < 700; i++) {
    const x = rand(-HX, HX), z = rand(-HZ, HZ);
    if (pondE(x, z) < 1.0 || (x > ZEN.x0 && x < ZEN.x1 && z > ZEN.z0 && z < ZEN.z1)) continue;
    leafStamp(g, Px(x), Pz(z), rand(3, 5), rand(0, PI * 2), pick(LEAF_COLS));
  }
}

function groundMesh() {
  const NX = 192, NZ = Math.round(NX * HZ / HX);
  const geo = new THREE.PlaneGeometry(HX * 2, HZ * 2, NX, NZ);
  geo.rotateX(-PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, soft('#ffffff', { map: canvasTex(GW, GH, paintGround, { aniso: 16 }), rough: 1 }));
  m.receiveShadow = true;
  m.castShadow = true;
  scene.add(m);
}

// ---- 崖壁：頂緣沿著島緣的地形高度，往外做雜訊位移，頂點色畫出地層 ----
const STRATA = [[0.35, '#2f4a3a'], [1.4, '#5a4034'], [2.6, '#4a3530'], [99, '#46404e']].map(([d, c]) => [d, new THREE.Color(c)]);
function cliffWall(side) {
  const L = side % 2 ? HZ * 2 : HX * 2, NC = side % 2 ? 76 : 72, NR = 11;
  const edge = a => [[a, HZ], [HX, -a], [-a, -HZ], [-HX, a]][side];
  const out = [[0, 1], [1, 0], [0, -1], [-1, 0]][side];
  const V = [], col = [];
  for (let i = 0; i <= NC; i++) {
    const t = i / NC, a = -L / 2 + L * t, [ex, ez] = edge(a), top = heightAt(ex, ez);
    const row = [];
    for (let j = 0; j <= NR; j++) {
      const fy = j / NR, y = top + (-CLIFF - top) * fy;
      const amp = Math.max(0, Math.sin(PI * t)) ** 0.3 * Math.max(0, Math.sin(PI * fy)) ** 0.5;   // 四邊固定；避免負數開根號得到 NaN
      const d = fbm3(a * 0.35 + side * 10, y * 0.6, side) * 0.9 * amp + 0.15 * amp;
      const depth = top - y + noise3(a * 0.8, side * 3, 1) * 0.25;
      const c = STRATA.find(([dd]) => depth < dd)[1].clone().multiplyScalar(0.9 + noise3(a * 2.3, y * 2.3, side) * 0.12);
      row.push({ p: new THREE.Vector3(ex + out[0] * d, y, ez + out[1] * d), c });
    }
    V.push(row);
  }
  const pos = [], e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const tri = (A, B, D) => {
    e1.subVectors(B.p, A.p); e2.subVectors(D.p, A.p); n.crossVectors(e1, e2);
    const T = n.x * out[0] + n.z * out[1] < 0 ? [A, D, B] : [A, B, D];
    for (const v of T) { pos.push(v.p.x, v.p.y, v.p.z); col.push(v.c.r, v.c.g, v.c.b); }
  };
  for (let i = 0; i < NC; i++) for (let j = 0; j < NR; j++) {
    const a = V[i][j], b = V[i + 1][j], c = V[i + 1][j + 1], d = V[i][j + 1];
    tri(a, b, c); tri(a, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, soft('#ffffff', { flat: true, vc: true }));
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
}

// ---- 底部：以矩形周長為第一圈，逐圈縮小、往下收尖 ----
function underside() {
  const PER = 56, RINGS = 6, DEPTH = 7.5, y0 = -CLIFF;
  const P4 = 4 * (HX + HZ);
  const perim = t => {
    let s = t * P4;
    if (s < 2 * HX) return [-HX + s, HZ];
    s -= 2 * HX; if (s < 2 * HZ) return [HX, HZ - s];
    s -= 2 * HZ; if (s < 2 * HX) return [HX - s, -HZ];
    s -= 2 * HX; return [-HX, -HZ + s];
  };
  const rings = [];
  for (let r = 0; r <= RINGS; r++) {
    const k = r / RINGS, s = 1 - 0.88 * Math.pow(k, 0.75), y = y0 - DEPTH * k, j = r === 0 ? 0 : 1;
    const ring = [];
    for (let i = 0; i < PER; i++) {
      const [px, pz] = perim(i / PER);
      ring.push(new THREE.Vector3(
        px * s + fbm3(px * 0.2, y * 0.3, 1) * 1.8 * j,
        y + noise3(px * 0.3, pz * 0.3, r) * 0.7 * j,
        pz * s + fbm3(pz * 0.2, y * 0.3, 2) * 1.8 * j,
      ));
    }
    rings.push(ring);
  }
  const tip = new THREE.Vector3(0.6, y0 - DEPTH - 1.6, -0.4);
  const tris = [];
  for (let r = 0; r < RINGS; r++) for (let i = 0; i < PER; i++) {
    const a = rings[r][i], b = rings[r][(i + 1) % PER], c = rings[r + 1][(i + 1) % PER], d = rings[r + 1][i];
    tris.push([a, b, c], [a, c, d]);
  }
  for (let i = 0; i < PER; i++) tris.push([rings[RINGS][i], rings[RINGS][(i + 1) % PER], tip]);
  const pos = [], col = [], c = new THREE.Color(), dark = new THREE.Color('#231d2c'), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), mid = new THREE.Vector3();
  for (let t of tris) {
    e1.subVectors(t[1], t[0]); e2.subVectors(t[2], t[0]);
    const nrm = e1.clone().cross(e2);
    mid.copy(t[0]).add(t[1]).add(t[2]).divideScalar(3);
    if (nrm.x * mid.x + nrm.z * mid.z + nrm.y * (mid.y - (y0 - DEPTH * 0.5)) * 0.2 < 0) t = [t[0], t[2], t[1]];   // 法線朝外
    for (const v of t) {
      pos.push(v.x, v.y, v.z);
      c.set('#4a4150').lerp(dark, (y0 - v.y) / (DEPTH + 1.6)).multiplyScalar(0.9 + noise3(v.x, v.y, v.z) * 0.12);
      col.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, soft('#ffffff', { flat: true, vc: true, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  scene.add(m);
}

// ---- 石垣：沿折線一列列往上砌，頂緣往內退；溫泉岩棚那段改用粗獷的大岩 ----
const WALL_COLS = [C.stone, C.stoneDark, C.stoneWarm, '#7a7680', '#86808a'];
function stoneWall(line, zAt, skip, rugged = () => false) {
  const xa = line[0][0] + 0.35, xb = line[line.length - 1][0] - 0.35;
  for (let x = xa; x < xb;) {
    const big = rugged(x), step = big ? rand(0.8, 1.2) : rand(0.5, 0.66);
    const xc = x + step / 2;
    x += step;
    if (skip(xc)) continue;
    const zt = zAt(xc), slope = (zAt(xc + 0.1) - zAt(xc - 0.1)) / 0.2, ry = -Math.atan(slope);
    const top = heightAt(xc, zt - 0.1), bot = heightAt(xc, zt + WALL_RUN + 0.15), H = top - bot;
    if (H < 0.15) continue;
    const rows = Math.max(1, Math.round(H / (big ? 0.75 : 0.4))), rh = H / rows;
    for (let r = 0; r < rows; r++) {
      const f = (r + 0.5) / rows, sx = xc + (r % 2 ? step * 0.25 : -step * 0.1);
      const zc = zAt(sx) + WALL_RUN * (1 - f), yc = bot + (r + 0.5) * rh;
      if (big) rock(sx, yc, zc + 0.1, step * 0.6 * rand(0.85, 1.15), rh * rand(0.55, 0.75), rand(0.4, 0.6), pick(WALL_COLS), { detail: 0, sink: 0, rough: 0.35, ry: ry + rand(-0.4, 0.4), rx: rand(-0.2, 0.2), moss: 0.3 + 0.5 * f, cast: false });
      else block(sx, yc, zc - 0.12 + rand(-0.03, 0.04), step * 0.47 * rand(0.94, 1.04), rh * 0.46 * rand(0.92, 1.0), 0.24, pick(WALL_COLS), { ry: ry + rand(-0.05, 0.05), moss: 0.15 + 0.55 * f * f });
    }
  }
}

// ---- 石段：每階由二到三塊石板拼成，兩側的袖石由下往上疊 ----
function stoneSteps(st, zAt, hiY, loY) {
  const { x, w, n, run } = st, zt = zAt(x), rise = (hiY - loY) / (n + 1);
  const mats = [soft(C.stoneWarm, { flat: true }), soft('#8f8a86', { flat: true }), soft(C.stone, { flat: true })];
  for (let i = 0; i < n; i++) {
    const top = hiY - (i + 1) * rise, zc = zt + (i + 0.5) * run, parts = 2 + (i % 2);
    for (let k = 0; k < parts; k++) {
      const pw = w / parts, h = top - loY + 0.2;
      const b = box(pw - 0.05, h, run + 0.05, pick(mats), x - w / 2 + pw * (k + 0.5) + rand(-0.02, 0.02), loY - 0.2, zc + rand(-0.015, 0.015), { cast: true });
      b.rotation.y = rand(-0.035, 0.035);
    }
  }
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const top = hiY - i * rise, zc = zt + (i + 0.5) * run, sy = (top - loY) / 2 + 0.1;
    rock(x + s * (w / 2 + 0.24), loY - 0.1, zc, 0.28, sy, run * 0.62, pick(WALL_COLS), { sink: 1, rough: 0.12, ry: 0, moss: 0.5, cast: true });
  }
}

export function buildIsland() {
  groundMesh();
  for (let s = 0; s < 4; s++) cliffWall(s);
  underside();
  const nearStairs = st => x => Math.abs(x - st.x) < st.w / 2 + 0.05;
  stoneWall(WALL_UP, wallUpZ, nearStairs(STAIRS_UP), x => x > 5.2 && x < 11.8);
  stoneWall(WALL_LOW, wallLowZ, nearStairs(STAIRS_LOW));
  stoneSteps(STAIRS_UP, wallUpZ, LV.up, LV.mid);
  stoneSteps(STAIRS_LOW, wallLowZ, LV.mid, LV.low);
}

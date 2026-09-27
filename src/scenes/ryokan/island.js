// 浮島：彩繪地面（苔庭、枯山水耙紋、碎石小徑、池底）、崖壁地層、往下收尖的岩石底部
import * as THREE from 'three';
import { scene, PI } from '../../engine/context.js';
import { rand, pick } from '../../engine/random.js';
import { fbm3, noise3 } from '../../engine/noise.js';
import { canvasTex } from '../../engine/canvas.js';
import { soft } from '../../engine/materials.js';
import { box } from '../../engine/geometry.js';
import { C } from './palette.js';
import { HALF, INN, ONSEN, POND, ZEN, ZEN_ROCKS, PATH, FENCE_Z, BAMBOO, MAPLES } from './layout.js';

const CLIFF = 3.2;   // 崖壁高度

// ---- 地面彩繪：世界座標 → 2048px 畫布 ----
const GS = 2048, PXM = GS / (HALF * 2);
const P = v => (v + HALF) * PXM;
const fillR = (g, x0, z0, x1, z1) => g.fillRect(P(x0), P(z0), (x1 - x0) * PXM, (z1 - z0) * PXM);
function speckle(g, x0, z0, x1, z1, n, cols, size = [1, 3]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = pick(cols);
    const s = rand(size[0], size[1]);
    g.fillRect(P(rand(x0, x1)), P(rand(z0, z1)), s, s);
  }
}
function blotches(g, x0, z0, x1, z1, n, col, r) {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) {
    g.beginPath(); g.ellipse(P(rand(x0, x1)), P(rand(z0, z1)), rand(r[0], r[1]) * PXM, rand(r[0], r[1]) * PXM * 0.7, rand(0, PI), 0, PI * 2); g.fill();
  }
}

// 枯山水：平行耙紋，主石周圍改成同心圓
function rakeSand(g) {
  const { x0, x1, z0, z1 } = ZEN, step = 0.2;
  const groove = (draw) => {
    g.strokeStyle = '#8a837a'; g.lineWidth = 3; draw(1.5);
    g.strokeStyle = '#c6c0b6'; g.lineWidth = 2; draw(-1);
  };
  g.save();
  g.beginPath(); g.rect(P(x0), P(z0), (x1 - x0) * PXM, (z1 - z0) * PXM); g.clip();
  g.fillStyle = C.sand; fillR(g, x0, z0, x1, z1);
  for (let z = z0 + 0.1; z < z1; z += step) groove(o => { g.beginPath(); g.moveTo(P(x0), P(z) + o); g.lineTo(P(x1), P(z) + o); g.stroke(); });
  for (const [rx, rz, r] of ZEN_ROCKS) {
    const R = r + 1.35;
    g.fillStyle = C.sand; g.beginPath(); g.arc(P(rx), P(rz), R * PXM, 0, PI * 2); g.fill();
    for (let rr = r + 0.12; rr <= R; rr += step) groove(o => { g.beginPath(); g.arc(P(rx), P(rz) + o, rr * PXM, 0, PI * 2); g.stroke(); });
  }
  g.restore();
}

function paintGround(g) {
  const R = (c, x0, z0, x1, z1) => { g.fillStyle = c; fillR(g, x0, z0, x1, z1); };
  R(C.soil, -HALF, -HALF, HALF, HALF);
  speckle(g, -HALF, -HALF, HALF, HALF, 9000, ['#443a40', '#56494e', '#3e353b']);
  // 旅館前庭（壓實的土與碎石）
  R('#5a5360', -9.8, -9.6, 11.6, FENCE_Z);
  speckle(g, -9.8, -9.6, 11.6, FENCE_Z, 9000, ['#4e4854', '#696270', '#625b69']);
  // 後方杉林下、竹林下的落葉土
  R('#2e3d34', -HALF, -HALF, HALF, -9.6);
  R('#3a3a31', BAMBOO.x0 - 0.3, BAMBOO.z0 - 0.4, BAMBOO.x1 + 0.3, BAMBOO.z1 + 0.4);
  speckle(g, BAMBOO.x0 - 0.3, BAMBOO.z0, BAMBOO.x1 + 0.3, BAMBOO.z1, 2500, ['#6a6a3e', '#4d4a33', '#7a7446'], [2, 4]);
  // 前方苔庭
  R(C.moss, -HALF, FENCE_Z, ZEN.x0, HALF);
  blotches(g, -HALF, FENCE_Z, ZEN.x0, HALF, 60, '#37553f', [0.3, 1.1]);
  blotches(g, -HALF, FENCE_Z, ZEN.x0, HALF, 40, '#294336', [0.2, 0.8]);
  R('#2c4234', ZEN.x1, FENCE_Z, HALF, HALF);
  R('#2c4234', ZEN.x0, ZEN.z1, ZEN.x1, HALF);
  R('#2c4234', ZEN.x0, FENCE_Z, ZEN.x1, ZEN.z0);
  // 碎石小徑
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#66616c'; g.lineWidth = 1.3 * PXM;
  g.beginPath(); PATH.forEach(([x, z], i) => i ? g.lineTo(P(x), P(z)) : g.moveTo(P(x), P(z))); g.lineTo(P(0.2), P(HALF)); g.stroke();
  for (const [x, z] of PATH) speckle(g, x - 0.6, z - 0.5, x + 0.6, z + 0.5, 120, ['#77727d', '#58535e', '#8a8590']);
  // 枯山水
  rakeSand(g);
  // 池底與溫泉底
  const ellipse = (cx, cz, rx, rz, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(P(cx), P(cz), rx * PXM, rz * PXM, 0, 0, PI * 2); g.fill(); };
  ellipse(POND.cx, POND.cz, POND.rx + 0.25, POND.rz + 0.25, '#2a3a36');
  ellipse(ONSEN.cx, ONSEN.cz, ONSEN.rx + 0.2, ONSEN.rz + 0.2, '#3a3a40');
  // 旅館地基周圍的排水石
  R('#4a4650', INN.x0 - 0.5, INN.z1, INN.x1 + 0.5, INN.z1 + 1.4);
  speckle(g, INN.x0 - 0.5, INN.z1, INN.x1 + 0.5, INN.z1 + 1.4, 1500, ['#5c5864', '#3e3a44']);
  // 楓樹下的落葉
  const leafCols = ['#c9352b', '#e8622c', '#f28a2e', '#f5b73a', '#9e3a2a'];
  for (const [x, z, s] of MAPLES) {
    for (let i = 0; i < 260 * s; i++) {
      const a = rand(0, PI * 2), d = Math.pow(rand(0, 1), 0.6) * 2.4 * s;
      g.fillStyle = pick(leafCols);
      g.save(); g.translate(P(x + Math.cos(a) * d), P(z + Math.sin(a) * d)); g.rotate(rand(0, PI));
      g.fillRect(-3, -2, 6, 4); g.restore();
    }
  }
}

// ---- 崖壁：四面細分平面，往外做雜訊位移，頂點色畫出地層 ----
const STRATA = [[0.3, '#2f4a3a'], [1.25, '#5a4034'], [2.2, '#4a3530'], [99, '#46404e']];
function cliffWall(side) {
  const L = HALF * 2, geo = new THREE.PlaneGeometry(L, CLIFF, 48, 8);
  const pos = geo.attributes.position, col = [], c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const fx = (x + L / 2) / L, fy = (CLIFF / 2 - y) / CLIFF;                 // fy：0 頂、1 底
    // 四邊固定，避免和頂面、底部、鄰牆脫開；sin 在邊界可能因浮點誤差變成極小負數，負數開根號會得到 NaN
    const amp = Math.max(0, Math.sin(PI * fx)) ** 0.3 * Math.max(0, Math.sin(PI * fy)) ** 0.5;
    pos.setZ(i, fbm3(x * 0.35 + side * 10, y * 0.6, side) * 0.9 * amp + 0.15 * amp);
    const depth = fy * CLIFF + noise3(x * 0.8, side * 3, 1) * 0.2;
    c.set(STRATA.find(([d]) => depth < d)[1]).multiplyScalar(0.9 + noise3(x * 2.3, y * 2.3, side) * 0.12);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, soft('#ffffff', { flat: true, vc: true }));
  m.position.y = -CLIFF / 2;
  const n = [[0, HALF, 0], [HALF, 0, PI / 2], [0, -HALF, PI], [-HALF, 0, -PI / 2]][side];
  m.position.x = n[0]; m.position.z = n[1]; m.rotation.y = n[2];
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
}

// ---- 底部：以正方形周長為第一圈，逐圈縮小、往下收尖 ----
function underside() {
  const PER = 48, RINGS = 6, DEPTH = 6.5, y0 = -CLIFF;
  const perim = t => {
    const s = t * 4, side = Math.floor(s) % 4, a = -HALF + 2 * HALF * (s - Math.floor(s));
    return [[a, HALF], [HALF, -a], [-a, -HALF], [-HALF, a]][side];
  };
  const rings = [];
  for (let r = 0; r <= RINGS; r++) {
    const k = r / RINGS, s = 1 - 0.88 * Math.pow(k, 0.75), y = y0 - DEPTH * k;
    const ring = [];
    for (let i = 0; i < PER; i++) {
      const [px, pz] = perim(i / PER);
      const j = r === 0 ? 0 : 1;
      ring.push(new THREE.Vector3(
        px * s + fbm3(px * 0.2, y * 0.3, 1) * 1.6 * j,
        y + noise3(px * 0.3, pz * 0.3, r) * 0.6 * j,
        pz * s + fbm3(pz * 0.2, y * 0.3, 2) * 1.6 * j,
      ));
    }
    rings.push(ring);
  }
  const tip = new THREE.Vector3(0.6, y0 - DEPTH - 1.4, -0.4);
  const tris = [];
  for (let r = 0; r < RINGS; r++) for (let i = 0; i < PER; i++) {
    const a = rings[r][i], b = rings[r][(i + 1) % PER], c = rings[r + 1][(i + 1) % PER], d = rings[r + 1][i];
    tris.push([a, b, c], [a, c, d]);
  }
  for (let i = 0; i < PER; i++) tris.push([rings[RINGS][i], rings[RINGS][(i + 1) % PER], tip]);
  const pos = [], col = [], c = new THREE.Color(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), mid = new THREE.Vector3();
  for (let t of tris) {
    e1.subVectors(t[1], t[0]); e2.subVectors(t[2], t[0]);
    const nrm = e1.clone().cross(e2);
    mid.copy(t[0]).add(t[1]).add(t[2]).divideScalar(3);
    if (nrm.x * mid.x + nrm.z * mid.z + nrm.y * (mid.y - (y0 - DEPTH * 0.5)) * 0.2 < 0) t = [t[0], t[2], t[1]];   // 法線朝外
    for (const v of t) {
      pos.push(v.x, v.y, v.z);
      const k = (y0 - v.y) / (DEPTH + 1.4);
      c.set('#4a4150').lerp(new THREE.Color('#231d2c'), k).multiplyScalar(0.9 + noise3(v.x, v.y, v.z) * 0.12);
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

export function buildIsland() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2, HALF * 2),
    soft('#ffffff', { map: canvasTex(GS, GS, paintGround, { aniso: 16 }), rough: 1 }),
  );
  ground.rotation.x = -PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  box(HALF * 2 + 0.25, 0.22, HALF * 2 + 0.25, '#2f4a3a', 0, -0.225, 0);   // 崖頂的草緣
  for (let s = 0; s < 4; s++) cliffWall(s);
  underside();
}

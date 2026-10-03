// 樹木：楓（五裂葉的葉團）、杉（鋸齒層錐，沿後山成群錯落）、黑松（雲形修剪的松針團）、竹林（叢生、彎梢、下垂的竹葉）
import * as THREE from 'three';
import { scene, PI } from '../../engine/context.js';
import { rng, rand, pick, withSeed } from '../../engine/random.js';
import { soft } from '../../engine/materials.js';
import { rod, cyl, add, G } from '../../engine/geometry.js';
import { windy } from './wind.js';
import { bakeLeaves, leafCloud, coreBlob, randDir } from './foliage.js';
import { mapleLeafGeo, lanceLeafGeo, needleTuftGeo } from './leaves.js';
import { heightAt, distToPolyline } from './terrain.js';
import { HX, MAPLES, MOUND, BAMBOO, SPRING, INN, ANNEX } from './layout.js';

// 楓樹樹冠的葉團（落葉模擬從這裡生成葉子）
export const CANOPY = [];

// 各楓樹的配色：[內側（背光、內層）, 外側（向陽）]
const MAPLE_PAL = [
  ['#e39a3a', '#c22e27'],     // 紅
  ['#e8b04a', '#e45a2a'],     // 橙
  ['#8f9c46', '#f0b03a'],     // 由綠轉黃
  ['#e8622c', '#9a2326'],     // 深紅
];

const mats = {
  leaf: () => windy('#ffffff', { vc: true, leaf: true, amp: 0.016, flutter: 0.014 }),
  core: () => windy('#ffffff', { vc: true, amp: 0.016 }),
  needle: () => windy('#ffffff', { vc: true, leaf: true, amp: 0.01, flutter: 0.006 }),
  cedar: () => windy('#ffffff', { vc: true, flat: true, amp: 0.007 }),
  pineMass: () => windy('#ffffff', { vc: true, flat: true, amp: 0.01 }),
  culm: () => windy('#ffffff', { vc: true, amp: 0.013 }),
  bambooLeaf: () => windy('#ffffff', { vc: true, leaf: true, amp: 0.013, flutter: 0.02 }),
};

export function buildFlora() {
  for (const [x, z, s, ci] of MAPLES) maple(x, z, s, ci);
  cedars();
  blackPine(MOUND.x + 0.3, MOUND.z - 0.2, 1.05, [0.47, -0.88], 5101);
  blackPine(-12.4, 14.9, 0.8, [0.8, -0.3], 5102);
  bamboo();
}

// ---- 楓：樹幹微彎、分出五枝，枝端長出扁圓的葉團（日本楓的傘形層次）----
function maple(x, z, s, ci) {
  const y0 = heightAt(x, z), pal = MAPLE_PAL[ci], bark = soft('#4a3530');
  const lx = rand(-0.3, 0.3) * s, lz = rand(-0.3, 0.3) * s;
  const knee = [x + lx * 0.4, y0 + 0.7 * s, z + lz * 0.4], fork = [x + lx, y0 + 1.25 * s, z + lz];
  rod([x, y0 - 0.15, z], knee, 0.16 * s, bark, { seg: 7, cast: true });
  rod(knee, fork, 0.13 * s, bark, { seg: 7, cast: true });
  const clusters = [], a0 = rand(0, PI * 2);
  for (let i = 0; i < 5; i++) {
    const a = a0 + i * PI * 2 / 5 + rand(-0.35, 0.35), reach = rand(1.15, 1.7) * s, up = rand(0.65, 1.35) * s;
    const mid = [fork[0] + Math.cos(a) * reach * 0.5, fork[1] + up * 0.62, fork[2] + Math.sin(a) * reach * 0.5];
    const end = [fork[0] + Math.cos(a) * reach, fork[1] + up, fork[2] + Math.sin(a) * reach];
    rod(fork, mid, 0.075 * s, bark, { seg: 6, cast: true });
    rod(mid, end, 0.05 * s, bark, { seg: 5 });
    clusters.push({ c: [end[0], end[1] + 0.12 * s, end[2]], r: [rand(0.78, 1.0) * s, rand(0.46, 0.6) * s, rand(0.78, 1.0) * s] });
    if (rng() < 0.7) {                                          // 次枝
      const a2 = a + rand(-0.9, 0.9), e2 = [mid[0] + Math.cos(a2) * 0.8 * s, mid[1] + rand(0.45, 0.85) * s, mid[2] + Math.sin(a2) * 0.8 * s];
      rod(mid, e2, 0.038 * s, bark, { seg: 5 });
      clusters.push({ c: e2, r: [rand(0.6, 0.75) * s, rand(0.4, 0.5) * s, rand(0.6, 0.75) * s] });
    }
  }
  clusters.push({ c: [fork[0] + rand(-0.2, 0.2) * s, fork[1] + 1.85 * s, fork[2] + rand(-0.2, 0.2) * s], r: [0.95 * s, 0.6 * s, 0.95 * s] });
  const dark = new THREE.Color(pal[1]).lerp(new THREE.Color(pal[0]), 0.3).multiplyScalar(0.2);
  for (const cl of clusters) {
    cl.n = Math.round(265 * cl.r[0] * cl.r[2] + 50);
    cl.base = y0;
    cl.pal = pal;
    coreBlob(cl.c, cl.r.map(v => v * 0.55), dark, y0, mats.core());
    CANOPY.push({ c: cl.c, r: cl.r, pal });
  }
  leafCloud(clusters, { geo: mapleLeafGeo(), mat: mats.leaf(), size: [0.18, 0.26], inner: 0.3, nb: 0.72, upBias: 0.55, droop: 0.45 });
}

// ---- 杉：一層層鋸齒狀的錐（尖端下垂），層數、偏移、傾斜各不相同 ----
function cedarTier(P, C, cx, cy, cz, r, h, rot, tilt, base) {
  const n = 14, apex = [cx + tilt[0] * h, cy + h, cz + tilt[1] * h], under = [cx, cy + h * 0.14, cz];
  const cTip = new THREE.Color('#35604c'), cIn = new THREE.Color('#27483e'), cApex = new THREE.Color('#1e3a33'), cUnder = new THREE.Color('#12211e');
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * PI * 2, outer = i % 2 === 0, rr = r * (outer ? rand(0.9, 1.12) : rand(0.58, 0.7));
    ring.push({ p: [cx + Math.cos(a) * rr, cy - (outer ? rand(0.14, 0.24) : 0.04) * h, cz + Math.sin(a) * rr], c: (outer ? cTip : cIn).clone().multiplyScalar(rand(0.88, 1.1)) });
  }
  const push = (p, c) => { P.push(p[0], p[1], p[2]); C.push(c.r, c.g, c.b, p[1] - base); };
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    push(apex, cApex); push(b.p, b.c); push(a.p, a.c);
    push(under, cUnder); push(a.p, a.c); push(b.p, b.c);
  }
}
function cedars() {
  // 後山沿坡成群：幾個群落中心，各自散出幾棵；另外零星的單株與小樹
  const trees = [];
  const ok = (x, z, d) => Math.abs(x) < HX - 0.5 && z > -16.6 && trees.every(t => Math.hypot(t.x - x, t.z - z) > d)
    && !(x > INN.x0 - 0.8 && x < INN.x1 + 0.8 && z > INN.z0 - 0.9) && !(x > ANNEX.x0 - 0.8 && x < ANNEX.x1 + 0.8 && z > ANNEX.z0 - 0.7)
    && !(x < BAMBOO.x1 + 0.6 && z > BAMBOO.z0);
  for (const [gx, gz, n] of [[-8.4, -14.6, 5], [-3.2, -15.4, 4], [1.8, -14.2, 5], [6.8, -15.0, 4], [11.6, -13.8, 5], [14.2, -9.0, 4], [12.2, -6.4, 2]]) {
    for (let i = 0, k = 0; i < 40 && k < n; i++) {
      const x = gx + rand(-1.8, 1.8), z = gz + rand(-1.6, 1.6), s = rand(0.75, 1.45);
      if (ok(x, z, 1.0 + s * 0.5)) { trees.push({ x, z, s }); k++; }
    }
  }
  for (let i = 0, k = 0; i < 200 && k < 9; i++) {                 // 小樹
    const x = rand(-10, 15.4), z = rand(-16.4, -12.6), s = rand(0.4, 0.62);
    if (ok(x, z, 1.1)) { trees.push({ x, z, s }); k++; }
  }
  const P = [], Cs = [], bark = soft('#3e2c24');
  for (const { x, z, s } of trees) {
    const y0 = heightAt(x, z), la = rand(0, PI * 2), lean = rand(0, 0.1), tilt = [Math.cos(la) * lean, Math.sin(la) * lean];
    const H = rand(5.0, 6.4) * s;
    rod([x, y0 - 0.2, z], [x + tilt[0] * H, y0 + H * 0.9, z + tilt[1] * H], 0.13 * s + 0.04, bark, { seg: 6, cast: true });
    const nT = 4 + Math.floor(rand(0, 3)), skip = rng() < 0.3 ? 1 + Math.floor(rand(0, nT - 2)) : -1;
    for (let k = 0; k < nT; k++) {
      if (k === skip) continue;                                  // 偶爾少一層，輪廓不規則
      const f = k / (nT - 1), ty = y0 + H * (0.22 + 0.62 * f) + rand(-0.12, 0.12) * s;
      const r = (1.5 - 1.05 * f) * s * rand(0.82, 1.15), h = (1.5 - 0.6 * f) * s * rand(0.9, 1.1);
      const cx = x + tilt[0] * (ty - y0) + rand(-0.15, 0.15) * s, cz = z + tilt[1] * (ty - y0) + rand(-0.15, 0.15) * s;
      cedarTier(P, Cs, cx, ty, cz, r, h, rand(0, PI), [tilt[0] + rand(-0.05, 0.05), tilt[1] + rand(-0.05, 0.05)], y0);
    }
  }
  const n = P.length / 3, col = new Float32Array(n * 3), sway = new Float32Array(n);
  for (let i = 0; i < n; i++) { col.set(Cs.slice(i * 4, i * 4 + 3), i * 3); sway[i] = Math.max(0, Cs[i * 4 + 3]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mats.cedar());
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
}

// ---- 黑松：S 形扭曲的樹幹往池面探出；水平伸出的枝先微微下垂、枝端再上揚，托著一層層雲形修剪的松針團 ----
// 每個松針團由中央一團與外圍一圈小圓團組成，輪廓像雲；圓團是帶尖角的多面體量體（pineMass），表面再刷上一層短松針
// 用自己的一條亂數（withSeed），調整松樹不會打亂竹林與地被的擺放
function blackPine(x, z, s, lean, seed) {
  withSeed(seed, () => {
    const y0 = heightAt(x, z), V = a => new THREE.Vector3(...a);
    const [lx, lz] = lean, side = [-lz, lx];
    const P = [[x, y0 - 0.2, z]];
    const steps = [[0.9, 0.3, 0.15], [0.8, 0.65, -0.25], [0.6, 0.55, 0.3], [0.5, 0.25, -0.1]];
    for (const [u, l, sd] of steps) { const q = P[P.length - 1]; P.push([q[0] + (lx * l + side[0] * sd) * s, q[1] + u * s, q[2] + (lz * l + side[1] * sd) * s]); }
    limb(P.map(V), 0.21 * s, 0.07 * s, { seg: 28, radial: 9, flare: 0.8 });

    const pads = [];
    const addPad = (q, a, len, r) => {
      const dx = Math.cos(a) * len * s, dz = Math.sin(a) * len * s, rise = rand(-0.1, 0.15) * s;
      const at = (f, dy) => V([q[0] + dx * f, q[1] + rise * f + dy * s, q[2] + dz * f]);
      const end = at(1, 0);
      limb([V(q), at(0.4, -0.07), at(0.75, -0.06), end], 0.075 * s, 0.03 * s, { seg: 12, radial: 6 });
      pads.push({ end, c: [end.x, end.y + 0.1 * s, end.z], R: r * s, m: r >= 0.8 ? 6 : 5 });
    };
    const la = Math.atan2(lz, lx);
    addPad(P[1], la + 1.4, 1.2, 0.8); addPad(P[2], la - 1.2, 1.3, 0.85); addPad(P[2], la + 0.3, 1.5, 0.9);
    addPad(P[3], la + 1.9, 1.0, 0.7); addPad(P[3], la - 0.5, 1.1, 0.75);
    pads.push({ end: V(P[4]), c: [P[4][0], P[4][1] + 0.2 * s, P[4][2]], R: 0.72 * s, m: 5 });

    const clumps = [];
    for (const { end, c: [cx, cy, cz], R, m } of pads) {
      const ex = rand(0.95, 1.1), ez = rand(0.8, 0.95), a0 = rand(0, PI * 2);
      clumps.push({ c: [cx, cy + 0.07 * s, cz], r: [0.5 * R * ex, 0.3 * R, 0.5 * R * ez] });
      for (let i = 0; i < m; i++) {
        const a = a0 + i / m * PI * 2 + rand(-0.25, 0.25), d = R * rand(0.48, 0.6), rr = R * rand(0.36, 0.44);
        const c = [cx + Math.cos(a) * d * ex, cy + rand(-0.04, 0.03) * s, cz + Math.sin(a) * d * ez];
        clumps.push({ c, r: [rr, rr * rand(0.62, 0.72), rr] });
        limb([end, V([c[0], c[1] - rr * 0.35, c[2]])], 0.026 * s, 0.012 * s, { seg: 2, radial: 5 });   // 撐著小圓團的細枝
      }
    }
    for (const cl of clumps) { cl.n = Math.round(160 * cl.r[0] * cl.r[2]) + 8; cl.base = y0; cl.pal = ['#15291d', '#365e3b']; }
    pineMass(clumps, y0);
    leafCloud(clumps, { geo: needleTuftGeo(), mat: mats.needle(), size: [0.15, 0.22], inner: 0, nb: 0.8, upBias: 0.6, droop: 0 });
  });
}

// 松針團的量體：壓扁、底部削平的多面體，部分頂點往外推出尖角（和杉的鋸齒層同一種低多邊形風格），平面著色、上亮下暗
function pineMass(clumps, base) {
  const src = G('pineIco', () => new THREE.IcosahedronGeometry(1, 2)).attributes.position;
  const pos = [], col = [], sway = [], d = new THREE.Vector3(), cc = new THREE.Color();
  const lo = new THREE.Color('#0b1711'), mid = new THREE.Color('#172f22'), hi = new THREE.Color('#2c5236');
  for (const { c, r } of clumps) {
    const seed = rand(0, 100);
    for (let i = 0; i < src.count; i++) {
      d.fromBufferAttribute(src, i);
      const h = hash2(Math.round(d.x * 997) + seed, Math.round(d.y * 991) * 7 + Math.round(d.z * 983));   // 相鄰三角形共用的頂點算出同一個值
      const k = 1 + 0.45 * h * h * h, t = 0.5 + 0.5 * d.y;
      const y = (d.y < 0 ? d.y * 0.45 : d.y) * k;                  // 底部削平
      const p = [c[0] + d.x * k * r[0], c[1] + y * r[1], c[2] + d.z * k * r[2]];
      pos.push(...p);
      (t < 0.5 ? cc.lerpColors(lo, mid, t * 2) : cc.lerpColors(mid, hi, t * 2 - 1)).multiplyScalar(0.85 + 0.35 * h);   // 尖角受光較亮
      col.push(cc.r, cc.g, cc.b);
      sway.push(Math.max(0, p[1] - base));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mats.pineMass());
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
}

// 沿著控制點的平滑枝幹：由粗漸細（flare 讓根部張開），頂點色畫出一塊塊深淺不同的龜甲狀樹皮
const BARK = [new THREE.Color('#1f1a17'), new THREE.Color('#6a5b50')];
const hash2 = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function limb(pts, r0, r1, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts), n = o.seg ?? 12, rs = o.radial ?? 6;
  const g = new THREE.TubeGeometry(curve, n, 1, rs, false);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const c = new THREE.Vector3(), v = new THREE.Vector3(), cc = new THREE.Color(), len = curve.getLength(), seed = rand(0, 100);
  for (let i = 0; i <= n; i++) {
    const t = i / n, r = (r0 + (r1 - r0) * t) * (1 + (o.flare ?? 0) * Math.pow(1 - t, 6));
    curve.getPointAt(t, c);                                     // TubeGeometry 的每一圈就是以這個點為圓心
    for (let j = 0; j <= rs; j++) {
      const k = i * (rs + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
      const plate = hash2(Math.floor(t * len / 0.16) + seed, j % rs);   // 沿長度每 16 公分、繞一圈分成幾塊
      cc.lerpColors(BARK[0], BARK[1], (0.15 + 0.85 * plate * plate) * (0.8 + 0.2 * t));
      col.set([cc.r, cc.g, cc.b], k * 3);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return add(new THREE.Mesh(g, soft('#ffffff', { vc: true })), { cast: true, t: 0.01 });
}

// ---- 竹林：幾個叢生群落；竹稈分三段、越往上傾斜越多（竹梢彎垂），竹節、成束下垂的細長竹葉、竹筍、倒竹 ----
function bamboo() {
  const culms = [];
  const clumps = [[-14.6, -14.8, 20, 1.2], [-12.4, -12.4, 15, 1.0], [-15.0, -10.2, 17, 1.1], [-13.0, -7.8, 14, 1.0], [-14.8, -5.4, 12, 0.9], [-12.2, -4.8, 8, 0.75], [-9.6, -15.4, 7, 0.9], [-11.2, -9.8, 6, 0.7]];
  for (const [cx, cz, n, sp] of clumps) {
    for (let i = 0, k = 0; i < n * 6 && k < n; i++) {
      const d = Math.abs(rand(-1, 1) + rand(-1, 1)) * sp, a = rand(0, PI * 2), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.abs(x) > HX - 0.25 || z < -16.75 || distToPolyline(SPRING, x, z) < 0.4) continue;
      if (culms.some(c => Math.hypot(c.x - x, c.z - z) < 0.2)) continue;
      const outward = Math.atan2(z - cz, x - cx) + rand(-0.6, 0.6);
      culms.push({ x, z, h: rand(4.2, 8.6) * (1 - 0.25 * d / sp), r: rand(0.045, 0.07), la: outward, lean: rand(0.02, 0.09) + 0.07 * d / sp });
      k++;
    }
  }
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true).translate(0, 0.5, 0);
  const nodeGeo = new THREE.CylinderGeometry(1, 1, 1, 7).translate(0, 0.5, 0);
  const segs = [], nodes = [], leaves = [], up = new THREE.Vector3(0, 1, 0), rv = new THREE.Vector3();
  const culmCols = ['#7fa05a', '#6f9150', '#8aac62', '#5d7d44'].map(c => new THREE.Color(c));
  const leafCols = ['#4f7a3f', '#5a8544', '#43693a', '#6a9450', '#7c9a4e', '#98964a'].map(c => new THREE.Color(c));
  for (const cu of culms) {
    const y0 = heightAt(cu.x, cu.z), col = pick(culmCols);
    let p = new THREE.Vector3(cu.x, y0 - 0.1, cu.z), along = 0;
    const L = cu.h / 3;
    for (let k = 0; k < 3; k++) {
      const tilt = cu.lean + k * rand(0.06, 0.12);
      const dir = new THREE.Vector3(Math.cos(cu.la) * Math.sin(tilt), Math.cos(tilt), Math.sin(cu.la) * Math.sin(tilt));
      const r = cu.r * (1 - k * 0.18);
      segs.push({ p: p.clone(), n: dir, t: new THREE.Vector3(1, 0, 0), s: [r, L, r], col, sway: along });
      for (let y = 0.45; y < L; y += 0.5) nodes.push({ p: p.clone().addScaledVector(dir, y), n: dir, t: new THREE.Vector3(1, 0, 0), s: [r * 1.22, 0.035, r * 1.22], col: col.clone().multiplyScalar(0.72), sway: along + y });
      if (k > 0) {                                                // 上兩段長出成束的竹葉
        for (let y = 0.2; y < L; y += rand(0.38, 0.55)) {
          const q = p.clone().addScaledVector(dir, y), fanA = rand(0, PI * 2), m = 4 + Math.floor(rand(0, 3));
          for (let j = 0; j < m; j++) {
            const a = fanA + j / m * PI * 2 + rand(-0.3, 0.3);
            const t = new THREE.Vector3(Math.cos(a), rand(-0.9, -0.2), Math.sin(a));
            const n = up.clone().add(randDir(rv).multiplyScalar(0.4));
            const sn = new THREE.Vector3(Math.cos(a), 0.6, Math.sin(a)).normalize();
            leaves.push({ p: q.clone().addScaledVector(t, 0.04), n, t, s: rand(0.3, 0.44), col: pick(leafCols).clone().multiplyScalar(rand(0.85, 1.1)), sn, nb: 0.45, sway: along + y });
          }
        }
      }
      p = p.addScaledVector(dir, L);
      along += L;
    }
  }
  bakeLeaves(segs, cylGeo, mats.culm(), { cast: true });
  bakeLeaves(nodes, nodeGeo, mats.culm(), { cast: false });
  bakeLeaves(leaves, lanceLeafGeo(), mats.bambooLeaf(), { cast: true });
  // 竹筍與倒竹
  const shoot = soft('#6a5a3a', { flat: true });
  for (let i = 0; i < 9; i++) {
    const c = pick(culms), x = c.x + rand(-0.5, 0.5), z = c.z + rand(-0.5, 0.5), h = rand(0.25, 0.5);
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.07, h, 6), shoot);
    m.position.set(x, heightAt(x, z) + h / 2 - 0.03, z);
    m.rotation.set(rand(-0.15, 0.15), rand(0, PI), rand(-0.15, 0.15));
    m.castShadow = true;
    scene.add(m);
  }
  const fa = [-14.4, -7.0], fb = [-12.2, -9.3];
  rod([fa[0], heightAt(...fa) + 0.06, fa[1]], [fb[0], heightAt(...fb) + 0.06, fb[1]], 0.05, '#a39a62', { seg: 7, cast: true });
}

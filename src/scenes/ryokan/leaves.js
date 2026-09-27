// 葉片幾何：五裂楓葉、小橢圓葉、細長竹葉、松針束、草叢、芒草穗、蕨葉
// 慣例：葉柄在原點、葉尖朝 +z、葉面朝 +y、長度約 1（放置時再縮放）；草叢與松針束以 +y 為軸
import * as THREE from 'three';
import { G } from '../../engine/geometry.js';

const PI = Math.PI;

// 2D 輪廓（u 橫向、v 沿葉尖）→ 平躺在 XZ 平面的幾何，再用 bend(u, v) 給一點立體彎曲
function flatLeaf(outline, bend) {
  const shape = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ShapeGeometry(shape, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i);
    p.setXYZ(i, u, bend(u, v), v);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

// 五裂楓葉：從掌心放射出五個尖裂片（中裂最長、基部兩裂最短），裂片之間是深凹的缺刻
export const mapleLeafGeo = () => G('leafMaple', () => {
  const O = [0, 0.3], pts = [];
  const lobes = [[-112, 0.36], [-56, 0.6], [0, 0.72], [56, 0.6], [112, 0.36]];
  pts.push([0, 0.2]);                                            // 葉柄處的凹口
  lobes.forEach(([deg, L], k) => {
    const a = deg * PI / 180, at = (d, r) => [O[0] + Math.sin(a + d) * r, O[1] + Math.cos(a + d) * r];
    const prev = k ? (lobes[k - 1][0] * PI / 180 + a) / 2 : a - 0.75;
    pts.push([O[0] + Math.sin(prev) * 0.2, O[1] + Math.cos(prev) * 0.2]);   // 缺刻
    if (L > 0.5) pts.push(at(-0.2, L * 0.55), at(0, L), at(0.2, L * 0.55)); // 肩、尖、肩（基部小裂片只有尖）
    else pts.push(at(0, L));
  });
  const last = lobes[4][0] * PI / 180 + 0.75;
  pts.push([O[0] + Math.sin(last) * 0.2, O[1] + Math.cos(last) * 0.2]);
  return flatLeaf(pts, (u, v) => -0.22 * u * u + 0.06 * v);    // 微微捲起的葉緣
});

// 小橢圓葉（灌木、杜鵑）：沿中肋對折一點
export const smallLeafGeo = () => G('leafSmall', () => {
  const pts = [];
  for (let i = 0; i < 8; i++) { const t = i / 8 * PI * 2; pts.push([Math.sin(t) * 0.24, 0.5 - Math.cos(t) * 0.5 * (t > PI * 0.5 && t < PI * 1.5 ? 1 : 0.95)]); }
  return flatLeaf(pts, u => Math.abs(u) * 0.35);
});

// 細長竹葉：往下垂
export const lanceLeafGeo = () => G('leafLance', () =>
  flatLeaf([[0, 0], [0.06, 0.18], [0.075, 0.45], [0.04, 0.78], [0, 1], [-0.04, 0.78], [-0.075, 0.45], [-0.06, 0.18]], (u, v) => -0.32 * v * v + Math.abs(u) * 0.3));

// 放射狀的細葉束：n 片、每片 seg 段，傾斜 tilt、往外彎 curve；軸為 +y，長度 1
function tuft(n, seg, w, tilt, curve, twist = 0.35) {
  const pos = [], idx = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * PI * 2 + (k % 2) * twist, ca = Math.cos(a), sa = Math.sin(a);
    const t0 = tilt[0] + (tilt[1] - tilt[0]) * ((k * 7) % n) / n;   // 每片傾斜不同
    const base = pos.length / 3;
    for (let s = 0; s <= seg; s++) {
      const f = s / seg, lean = t0 + curve * f * f, r = Math.sin(lean) * f, y = Math.cos(lean) * f;
      const hw = w * (1 - f * 0.92);
      pos.push(ca * r - sa * hw, y, sa * r + ca * hw, ca * r + sa * hw, y, sa * r - ca * hw);
      if (s) { const b = base + (s - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export const grassTuftGeo = () => G('tuftGrass', () => tuft(8, 2, 0.035, [0.15, 0.7], 0.9));
export const susukiGeo = () => G('tuftSusuki', () => tuft(14, 4, 0.022, [0.1, 0.55], 1.3, 0.2));
export const needleTuftGeo = () => G('tuftNeedle', () => tuft(8, 1, 0.02, [0.35, 0.9], 0.2));

// 芒草穗：細長、往一側垂的羽狀穗
export const plumeGeo = () => G('plume', () =>
  flatLeaf([[0, 0], [0.025, 0.25], [0.04, 0.55], [0.025, 0.85], [0, 1], [-0.025, 0.85], [-0.04, 0.55], [-0.025, 0.25]], (u, v) => -0.5 * v * v));

// 蕨葉：中軸兩側排著逐漸變小的羽片，整片往下拱
export const fernGeo = () => G('fern', () => {
  const pos = [], idx = [];
  const rib = v => [0, 0.35 * v - 0.55 * v * v, v];
  for (let i = 0; i < 9; i++) {
    const v = 0.1 + i * 0.1, L = 0.22 * (1 - v * 0.85), [x, y, z] = rib(v), [, y2, z2] = rib(v + 0.08);
    for (const s of [-1, 1]) {
      const b = pos.length / 3;
      pos.push(x, y, z, x, y2, z2, x + s * L, y - 0.03, z + 0.06);
      idx.push(b, b + 1, b + 2);
    }
  }
  const b = pos.length / 3, [, ty, tz] = rib(1);
  pos.push(-0.012, 0, 0, 0.012, 0, 0, 0, ty, tz);
  idx.push(b, b + 1, b + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
});

// 建模小工具：box / cyl 以「底部高度」定位，並自動加上描邊
import * as THREE from 'three';
import { scene } from './context.js';
import { M, outline, outlineByDefault } from './materials.js';

const geoCache = new Map();
export const G = (key, make) => { let g = geoCache.get(key); if (!g) geoCache.set(key, g = make()); return g; };

// o: { parent, cast, recv, rx, ry, rz, outline, t(描邊粗細) }
export function add(mesh, o = {}) {
  mesh.castShadow = !!o.cast;
  mesh.receiveShadow = o.recv ?? true;
  if (o.rx) mesh.rotation.x = o.rx;
  if (o.ry) mesh.rotation.y = o.ry;
  if (o.rz) mesh.rotation.z = o.rz;
  if ((o.outline ?? outlineByDefault()) && !mesh.material.transparent) outline(mesh, o.t ?? 0.02);
  (o.parent ?? scene).add(mesh);
  return mesh;
}

export function box(w, h, d, mat, x, yb, z, o = {}) {
  const m = new THREE.Mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), M(mat));
  m.position.set(x, yb + h / 2, z);
  return add(m, o);
}

export function cyl(rt, rb, h, mat, x, yb, z, o = {}) {
  const seg = o.seg ?? 16;
  const m = new THREE.Mesh(G(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), M(mat));
  m.position.set(x, yb + h / 2, z);
  return add(m, o);
}

// 平面以中心定位，預設面向 +z，不描邊
export function plane(w, h, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(G(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)), M(mat));
  m.position.set(x, y, z);
  return add(m, { ...o, outline: false, recv: o.recv ?? false });
}

// 兩點之間的圓桿
const _up = new THREE.Vector3(0, 1, 0);
export function rod(a, b, r, mat, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(G(`r${r},${len.toFixed(3)},${o.seg ?? 8}`, () => new THREE.CylinderGeometry(r, r, len, o.seg ?? 8)), M(mat));
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_up, B.sub(A).normalize());
  return add(m, { t: 0.01, ...o });
}

export function grp(x = 0, y = 0, z = 0, ry = 0, parent = scene) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

// 共用的暫存物件（避免每格配置新物件）
export const tmp = {
  m4: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(),
  p: new THREE.Vector3(), s: new THREE.Vector3(), col: new THREE.Color(),
};

// 大量小物件（商品、飲料瓶…）用 InstancedMesh；list 內每項 {x,y,z,w,h,d,rx,ry,rz,c}
export function inst(geo, mat, list, parent = scene) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => {
    tmp.e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0); tmp.q.setFromEuler(tmp.e);
    tmp.p.set(it.x, it.y, it.z); tmp.s.set(it.w ?? 1, it.h ?? 1, it.d ?? 1);
    im.setMatrixAt(i, tmp.m4.compose(tmp.p, tmp.q, tmp.s));
    im.setColorAt(i, tmp.col.set(it.c ?? '#ffffff'));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  parent.add(im);
  return im;
}

// 四坡屋頂（寄棟）：W×D 的底面，屋脊高 H
export function hipRoof(W, D, H, mat, x, yb, z, o = {}) {
  const w = W / 2, d = D / 2, r = Math.max(0, w - d);
  const A = [-w, 0, -d], B = [w, 0, -d], C = [w, 0, d], Dd = [-w, 0, d], E = [-r, H, 0], F = [r, H, 0];
  const tris = [[Dd, C, F], [Dd, F, E], [B, A, E], [B, E, F], [C, B, F], [A, Dd, E], [A, B, C], [A, C, Dd]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M(mat));
  m.position.set(x, yb, z);
  return add(m, { cast: true, t: 0.035, ...o });
}

// 入母屋屋頂：下半部四坡（寄棟）、上半部兩坡（切妻）＋山牆三角、厚屋簷、屋脊與鬼瓦
// W 沿本地 x（屋脊方向）、D 沿 z；hip = 寄棟部分占總高的比例
// mats: { roof, gable, ridge }；UV 以公尺為單位做平面投影，方便套瓦片條紋貼圖
export function irimoyaRoof(W, D, H, mats, x, yb, z, o = {}) {
  const w = W / 2, d = D / 2, k = o.hip ?? 0.5, t = o.thick ?? 0.14;
  const h1 = H * k, d1 = d * (1 - k), w1 = w - d * k;
  const A = [-w, 0, d], B = [w, 0, d], C = [w1, h1, d1], Dp = [w1, H, 0], E = [-w1, H, 0], F = [-w1, h1, d1];
  const Ab = [-w, 0, -d], Bb = [w, 0, -d], Cb = [w1, h1, -d1], Fb = [-w1, h1, -d1];
  const L = [-w, -t, d], R = [w, -t, d], Lb = [-w, -t, -d], Rb = [w, -t, -d];
  const roofTris = [
    [A, B, C], [A, C, Dp], [A, Dp, E], [A, E, F],           // 前坡
    [Bb, Ab, Fb], [Bb, Fb, E], [Bb, E, Dp], [Bb, Dp, Cb],    // 後坡
    [B, Bb, Cb], [B, Cb, C], [Ab, A, F], [Ab, F, Fb],        // 兩端的寄棟斜面
    [L, R, B], [L, B, A], [R, Rb, Bb], [R, Bb, B],           // 屋簷厚度
    [Rb, Lb, Ab], [Rb, Ab, Bb], [Lb, L, A], [Lb, A, Ab],
    [Lb, Rb, R], [Lb, R, L],                                 // 簷底
  ];
  const gableTris = [[C, Cb, Dp], [Fb, F, E]];
  const build = tris => {
    const pos = [], uv = [];
    for (const tri of tris) {
      const [p, q, r] = tri.map(v => new THREE.Vector3(...v));
      const n = q.clone().sub(p).cross(r.clone().sub(p));
      const alongX = Math.abs(n.z) >= Math.abs(n.x);
      for (const v of [p, q, r]) { pos.push(v.x, v.y, v.z); uv.push(alongX ? v.x : v.z, v.y * 1.6 + (alongX ? 0 : 0.5)); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  };
  const g0 = grp(x, yb, z, o.ry ?? 0, o.parent ?? scene);
  add(new THREE.Mesh(build(roofTris), M(mats.roof)), { parent: g0, cast: true });
  add(new THREE.Mesh(build(gableTris), M(mats.gable)), { parent: g0, cast: true });
  box(2 * w1 + 0.3, 0.16, 0.24, mats.ridge ?? mats.roof, 0, H - 0.04, 0, { parent: g0, cast: true });
  for (const s of [-1, 1]) box(0.2, 0.32, 0.3, mats.ridge ?? mats.roof, s * (w1 + 0.14), H - 0.1, 0, { parent: g0 });
  return g0;
}

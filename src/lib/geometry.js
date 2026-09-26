// 建模小工具：box / cyl 以「底部高度」定位，並自動加上描邊
import * as THREE from 'three';
import { scene } from '../core/context.js';
import { M, outline } from './materials.js';

const geoCache = new Map();
export const G = (key, make) => { let g = geoCache.get(key); if (!g) geoCache.set(key, g = make()); return g; };

// o: { parent, cast, recv, rx, ry, rz, outline, t(描邊粗細) }
export function add(mesh, o = {}) {
  mesh.castShadow = !!o.cast;
  mesh.receiveShadow = o.recv ?? true;
  if (o.rx) mesh.rotation.x = o.rx;
  if (o.ry) mesh.rotation.y = o.ry;
  if (o.rz) mesh.rotation.z = o.rz;
  if (o.outline !== false && !mesh.material.transparent) outline(mesh, o.t ?? 0.02);
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

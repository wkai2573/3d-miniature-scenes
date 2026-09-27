// 葉團建模：把大量葉片的變換直接烘進頂點，合併成一個網格（之後再由 staticBatch 跨樹合併）
// 每片葉子的法線混入所屬葉團的球面法線，受光像圓潤的量體，輪廓卻是一片片葉子
// 頂點屬性：color（依朝上、朝外的程度做明暗）、aSway（離錨點的高度，給風擺動）、aFlutter（顫動相位、離葉柄的比例）
import * as THREE from 'three';
import { scene } from '../../engine/context.js';
import { rng, rand } from '../../engine/random.js';
import { G } from '../../engine/geometry.js';

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _B = new THREE.Vector3(), _T = new THREE.Vector3(), _N = new THREE.Vector3(), _S = new THREE.Vector3();

export function randDir(out = new THREE.Vector3()) {
  const z = rand(-1, 1), a = rand(0, Math.PI * 2), r = Math.sqrt(1 - z * z);
  return out.set(Math.cos(a) * r, z, Math.sin(a) * r);
}

/**
 * list 內每項：{ p 位置, n 葉面法線（草叢為軸）, t 葉尖方向, s 大小（數字或 [x,y,z]）, col 顏色,
 *              sn 形體法線（可省略）, nb 混入比例, sway 錨點以上的高度 }
 */
export function bakeLeaves(list, geo, mat, o = {}) {
  const gp = geo.attributes.position, gn = geo.attributes.normal, gi = geo.index;
  let maxR = 0;
  for (let i = 0; i < gp.count; i++) maxR = Math.max(maxR, _v.fromBufferAttribute(gp, i).length());
  const V = gp.count, pos = new Float32Array(list.length * V * 3), nrm = new Float32Array(list.length * V * 3);
  const col = new Float32Array(list.length * V * 3), sway = new Float32Array(list.length * V), flut = new Float32Array(list.length * V * 2);
  const idx = new (list.length * V > 65535 ? Uint32Array : Uint16Array)(list.length * gi.count);
  list.forEach((it, k) => {
    _N.copy(it.n).normalize();
    _T.copy(it.t).addScaledVector(_N, -it.t.dot(_N));
    if (_T.lengthSq() < 1e-6) _T.set(1, 0, 0).addScaledVector(_N, -_N.x);
    _T.normalize();
    _B.crossVectors(_N, _T);
    const s = it.s;
    _S.set(...(Array.isArray(s) ? s : [s, s, s]));
    _m.makeBasis(_B, _N, _T).scale(_S).setPosition(it.p);
    _n3.getNormalMatrix(_m);
    const seed = rng(), c = it.col, o3 = k * V * 3;
    for (let i = 0; i < V; i++) {
      _v.fromBufferAttribute(gp, i);
      const tip = _v.length() / maxR;
      _v.applyMatrix4(_m);
      pos.set([_v.x, _v.y, _v.z], o3 + i * 3);
      if (it.sn) _w.copy(_N).lerp(it.sn, it.nb ?? 0.7).normalize();
      else _w.fromBufferAttribute(gn, i).applyMatrix3(_n3).normalize();
      nrm.set([_w.x, _w.y, _w.z], o3 + i * 3);
      col.set([c.r, c.g, c.b], o3 + i * 3);
      sway[k * V + i] = Math.max(0, (it.sway ?? 0) + (_v.y - it.p.y));
      flut.set([seed, tip], (k * V + i) * 2);
    }
    for (let i = 0; i < gi.count; i++) idx[k * gi.count + i] = gi.getX(i) + k * V;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  g.setAttribute('aFlutter', new THREE.BufferAttribute(flut, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.Mesh(g, mat);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = true;
  (o.parent ?? scene).add(m);
  return m;
}

/**
 * 葉團：clusters 內每項 { c:[x,y,z], r:[rx,ry,rz], n 葉數, base 錨點高度（樹根的 y）, pal:[內側色, 外側色] }
 * o: { geo, mat, size:[min,max], inner 內層比例, nb 法線混入比例, upBias 葉面朝上的程度, droop 葉尖下垂 }
 */
export function leafCloud(clusters, o) {
  const list = [], d = new THREE.Vector3(), rv = new THREE.Vector3(), cIn = new THREE.Color(), cOut = new THREE.Color();
  for (const cl of clusters) {
    const [cx, cy, cz] = cl.c, [rx, ry, rz] = cl.r;
    cIn.set(cl.pal[0]); cOut.set(cl.pal[1]);
    for (let i = 0; i < cl.n; i++) {
      do randDir(d); while (d.y < -0.3 && rng() < 0.65);          // 底部葉子較少
      const inner = rng() < (o.inner ?? 0.22);
      const f = inner ? rand(0.4, 0.8) : rand(0.86, 1.06);
      const p = new THREE.Vector3(cx + d.x * rx * f, cy + d.y * ry * f, cz + d.z * rz * f);
      const sn = new THREE.Vector3(d.x / rx, d.y / ry, d.z / rz).normalize();
      const n = sn.clone().multiplyScalar(0.6).addScaledVector(UP, o.upBias ?? 0.55).add(randDir(rv).multiplyScalar(0.5)).normalize();
      const t = new THREE.Vector3(d.x, -(o.droop ?? 0.5), d.z).add(randDir(rv).multiplyScalar(0.8));
      // 顏色：朝上、朝外的葉子偏外側色且較亮；內層與底部偏內側色且較暗
      const lit = (0.5 + 0.5 * sn.y) * (inner ? 0.55 : 1);
      const col = cIn.clone().lerp(cOut, Math.min(1, Math.max(0, lit * 1.15 + rand(-0.25, 0.25))))
        .multiplyScalar((0.5 + 0.5 * lit) * rand(0.9, 1.08));
      list.push({ p, n, t, s: rand(o.size[0], o.size[1]), col, sn, nb: o.nb ?? 0.7, sway: p.y - cl.base });
    }
  }
  return bakeLeaves(list, o.geo, o.mat, o);
}

// 葉團內芯：比葉團小一圈的深色圓團，填住葉片之間的縫；帶 aSway 與頂點色才能和葉子一起擺動、跨樹合併
export function coreBlob(c, r, color, base, mat, o = {}) {
  const src = G('coreIco', () => new THREE.IcosahedronGeometry(1, 1));
  const g = src.clone();
  const p = g.attributes.position, nr = g.attributes.normal, n = p.count, col = new Float32Array(n * 3), sway = new Float32Array(n), cc = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]);
    _v.set(x / r[0], y / r[1], z / r[2]).normalize();           // 橢球的平滑法線
    nr.setXYZ(i, _v.x, _v.y, _v.z);
    const k = 0.6 + 0.4 * (0.5 + 0.5 * y);
    col.set([cc.r * k, cc.g * k, cc.b * k], i * 3);
    sway[i] = Math.max(0, c[1] + y * r[1] - base);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  const m = new THREE.Mesh(g, mat);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = true;
  (o.parent ?? scene).add(m);
  return m;
}

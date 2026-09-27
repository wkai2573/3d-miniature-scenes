// 紅葉屋共用的造型：多面體岩石、圓潤量體（苔丘、灌木、樹冠）、地面光斑
import * as THREE from 'three';
import { scene, PI } from '../../engine/context.js';
import { rng, rand } from '../../engine/random.js';
import { noise3 } from '../../engine/noise.js';
import { soft, glow } from '../../engine/materials.js';
import { G, add, plane } from '../../engine/geometry.js';
import { canvasTex } from '../../engine/canvas.js';
import { heightAt } from './terrain.js';

// 多面體岩石：Icosahedron 加雜訊位移；non-indexed 幾何算出的法線是每面一個，保留切面感
// o.moss（0 ~ 1）：朝上的面混入苔綠，改用頂點色，所有長苔的岩石共用一個材質
const MOSS = [new THREE.Color('#3f5e3c'), new THREE.Color('#56733f')];
export function rock(x, yb, z, sx, sy, sz, color, o = {}) {
  const g = new THREE.IcosahedronGeometry(1, o.detail ?? 1);
  const pos = g.attributes.position, seed = rng() * 100, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + noise3(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4) * (o.rough ?? 0.22));
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mossy(g, color, o.moss ?? 0.6, seed));
  m.position.set(x, yb + sy * (o.sink ?? 0.55), z);   // 下半部埋進地面
  m.rotation.y = o.ry ?? rng() * PI * 2;
  if (o.rx) m.rotation.x = o.rx;
  if (o.rz) m.rotation.z = o.rz;
  return add(m, { cast: o.cast ?? true, parent: o.parent });
}

// 朝上的面混入苔綠（每個三角形同一色），回傳共用的頂點色材質；moss 為 0 時回傳單色材質
function mossy(g, color, moss, seed) {
  if (moss <= 0) return soft(color, { flat: true });
  const pos = g.attributes.position, nrm = g.attributes.normal, base = new THREE.Color(color), c = new THREE.Color(), col = [];
  for (let i = 0; i < pos.count; i += 3) {
    const up = nrm.getY(i), n = noise3(pos.getX(i) * 3 + seed, pos.getY(i) * 3, pos.getZ(i) * 3);
    const k = Math.min(1, Math.max(0, (up - 0.35 + n * 0.25) * 2.2)) * moss;
    c.copy(base).multiplyScalar(0.94 + n * 0.08).lerp(MOSS[n > 0 ? 1 : 0], k);
    for (let j = 0; j < 3; j++) col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return soft('#ffffff', { flat: true, vc: true });
}

// 石垣的石塊：角落不規則的方石，正面略微前傾或後仰；以中心定位
export function block(x, y, z, sx, sy, sz, color, o = {}) {
  const g = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const pos = g.attributes.position, seed = rng() * 100, j = o.jitter ?? 0.13;
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const n1 = noise3(px * 1.7 + seed, py * 1.7, pz * 1.7), n2 = noise3(px * 1.7, py * 1.7 + seed, pz * 1.7 + 5);
    px += n1 * j; py += n2 * j;
    if (pz > 0.99) pz += n1 * 0.35 - 0.05;                                     // 正面四角前後錯落
    pos.setXYZ(i, px * sx, py * sy, pz * sz);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mossy(g, color, o.moss ?? 0.4, seed));
  m.position.set(x, y, z);
  m.rotation.set(rand(-0.06, 0.06), o.ry ?? 0, rand(-0.05, 0.05));
  return add(m, { cast: o.cast ?? false, parent: o.parent });
}

// 把「在平地上蓋好」的模組整組抬到某個高度：建造前後比對 scene 的子物件，新加入的都移進抬高的群組
export function onLevel(y, build) {
  const n0 = scene.children.length;
  lifting = true;
  const out = build();
  lifting = false;
  const g = new THREE.Group();
  g.position.y = y;
  for (const c of scene.children.slice(n0)) g.add(c);
  scene.add(g);
  return out;
}

// 圓潤量體：平滑法線的低面數球（detail 1 就有柔和的漸層受光）
export function blob(x, y, z, sx, sy, sz, mat, o = {}) {
  const m = new THREE.Mesh(G(`blob${o.detail ?? 1}`, () => new THREE.IcosahedronGeometry(1, o.detail ?? 1)), mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.y = rng() * PI * 2;
  return add(m, { cast: o.cast ?? true, parent: o.parent });
}

// 燈火投在地面的暖色光斑（加法混合），補足點光源數量的不足
let poolMat = null;
const poolMats = {};
export function lightPool(x, z, r, k = 0.5) {
  poolMat ??= glow('#ffffff', 1, {
    additive: true,
    map: canvasTex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }),
  });
  // 每種強度共用一個材質（顏色＝暖橘 × 強度），合併網格時才不會拆成太多組
  poolMats[k] ??= Object.assign(poolMat.clone(), { color: new THREE.Color('#ff9a4a').multiplyScalar(k * 0.8) });
  if (lifting) {                                   // 抬高的模組裡：建在局部的平地上
    const m = plane(r * 2, r * 2, poolMats[k], x, 0.03, z, { rx: -PI / 2 });
    m.userData.noAO = true;
    return m;
  }
  // 地面有起伏：光斑做成細分平面，貼著地形
  const geo = new THREE.PlaneGeometry(r * 2, r * 2, 10, 10).rotateX(-PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(x + p.getX(i), z + p.getZ(i)) + 0.035);
  const m = new THREE.Mesh(geo, poolMats[k]);
  m.position.set(x, 0, z);
  m.userData.noAO = true;
  return add(m, { recv: false });
}

// 放在地面上的高度：抬高的模組裡是局部的 0，其餘依地形
let lifting = false;
export const groundY = (x, z) => lifting ? 0 : heightAt(x, z);

// ---- 共用材質：瓦屋頂（瓦溝條紋）、山牆木格、木板 ----
let _roofMats = null, _plank = null;
export function roofMats(C) {
  if (_roofMats) return _roofMats;
  const tile = canvasTex(128, 128, (g, w, h) => {            // 1 公尺見方：4 行瓦溝
    g.fillStyle = C.tile; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = i * w / 4;
      g.fillStyle = '#4b5168'; g.fillRect(x + 4, 0, w / 4 - 12, h);
      g.fillStyle = C.tileDark; g.fillRect(x + w / 4 - 8, 0, 8, h);
    }
    g.fillStyle = 'rgba(20,24,40,0.35)'; for (let y = 0; y < h; y += h / 3) g.fillRect(0, y, w, 3);
  });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  const lattice = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = C.woodDark; g.fillRect(0, 0, w, h);
    g.fillStyle = C.wood; for (let x = 0; x < w; x += 16) g.fillRect(x + 3, 0, 9, h);
  });
  lattice.wrapS = lattice.wrapT = THREE.RepeatWrapping;
  return (_roofMats = {
    roof: soft('#ffffff', { map: tile, rough: 0.8 }),
    gable: soft('#ffffff', { map: lattice }),
    ridge: soft(C.ridge),
  });
}
export function plankMat(C) {
  return _plank ??= soft('#ffffff', {
    map: canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = C.woodLight; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { g.fillStyle = y % 32 ? '#94704f' : '#7f5e41'; g.fillRect(0, y, w, 14); g.fillStyle = '#5a4030'; g.fillRect(0, y + 14, w, 2); }
    }, { repeat: [6, 1] }),
  });
}

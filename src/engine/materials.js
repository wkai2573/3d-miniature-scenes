// 材質：三渲二（toon＋描邊）與柔和低多邊形（soft），由場景用 setStyle() 選擇預設
import * as THREE from 'three';

// 5 階色調：背光 0、側光 0.47、半受光 0.82、正受光 1
export const gradientMap = new THREE.DataTexture(new Uint8Array([0, 0, 120, 210, 255]), 5, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

const matCache = new Map();
function cached(key, make) {
  if (key && matCache.has(key)) return matCache.get(key);
  const m = make();
  if (key) matCache.set(key, m);
  return m;
}
function applyCommon(m, o) {
  if (o.emissive !== undefined) { m.emissive.set(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.opacity !== undefined && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.alphaTest) m.alphaTest = o.alphaTest;
  if (o.polyOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  return m;
}

// 三渲二材質；沒有貼圖的相同參數會共用同一個材質，方便合併網格
export function toon(color, o = {}) {
  const key = (o.map || o.noCache) ? null : ['t', color, o.emissive ?? '', o.ei ?? 1, o.side ?? 0, o.opacity ?? 1].join('|');
  return cached(key, () => applyCommon(new THREE.MeshToonMaterial({ color, gradientMap, map: o.map ?? null, side: o.side ?? THREE.FrontSide }), o));
}

// 柔和低多邊形：漫射為主的 Standard 材質；flat 為平面著色（岩石、土層），vc 使用頂點色
export function soft(color, o = {}) {
  const key = (o.map || o.noCache) ? null : ['s', color, o.flat ? 1 : 0, o.vc ? 1 : 0, o.rough ?? 0.9, o.emissive ?? '', o.ei ?? 1, o.side ?? 0, o.opacity ?? 1].join('|');
  return cached(key, () => applyCommon(new THREE.MeshStandardMaterial({
    color, map: o.map ?? null, side: o.side ?? THREE.FrontSide,
    roughness: o.rough ?? 0.9, metalness: 0, flatShading: !!o.flat, vertexColors: !!o.vc,
  }), o));
}

// 自發光材質（招牌、燈箱、燈具）；k > 1 會觸發泛光
export function glow(color, k = 1, o = {}) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), map: o.map ?? null, side: o.side ?? THREE.FrontSide });
  if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.additive) { m.blending = THREE.AdditiveBlending; m.transparent = true; m.depthWrite = false; }
  if (o.alphaTest) m.alphaTest = o.alphaTest;
  if (o.polyOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  return m;
}

// ---- 場景風格：M() 把顏色字串轉成預設材質；outline 決定 box/cyl… 預設是否描邊 ----
const style = { factory: toon, outline: true };
export function setStyle(s) { Object.assign(style, s); }
export const outlineByDefault = () => style.outline;
export const M = c => (c && c.isMaterial) ? c : style.factory(c);

// 背面擴張法描邊（inverted hull）：以包圍盒中心放大 t 公尺的黑色背面殼
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0e111c, side: THREE.BackSide });
const _s = new THREE.Vector3(), _c = new THREE.Vector3();
export function outline(mesh, t = 0.02) {
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  g.boundingBox.getSize(_s);
  g.boundingBox.getCenter(_c);
  const f = v => v < 1e-3 ? 1 : (v + 2 * t) / v;
  const o = new THREE.Mesh(g, outlineMat);
  o.scale.set(f(_s.x), f(_s.y), f(_s.z));
  o.position.set(_c.x * (1 - o.scale.x), _c.y * (1 - o.scale.y), _c.z * (1 - o.scale.z));
  o.layers.set(1);   // 不進地面反射
  mesh.add(o);
  return mesh;
}

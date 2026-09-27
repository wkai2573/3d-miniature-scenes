// 把靜態網格依「材質 × 陰影 × 圖層」合併，draw call 從數千降到約一百。
// userData.dynamic = true 的物件（自動門、反射面…）與其子物件不會被合併。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function staticBatch(root) {
  root.updateMatrixWorld(true);
  const groups = new Map(), removed = [], removedSet = new Set();

  (function collect(o) {
    if (o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && !o.material.isShaderMaterial) {
      const g = o.geometry;
      const key = [o.material.uuid, o.castShadow, o.receiveShadow, o.layers.mask, g.index ? 1 : 0, Object.keys(g.attributes).sort().join()].join('|');
      let e = groups.get(key);
      if (!e) groups.set(key, e = { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, mask: o.layers.mask, geos: [] });
      e.geos.push(g.clone().applyMatrix4(o.matrixWorld));
      removed.push(o); removedSet.add(o);
    }
    for (const c of o.children) collect(c);
  })(root);

  // 由子到父移除，未被合併的子物件（例如群組）改掛到上一層
  for (let i = removed.length - 1; i >= 0; i--) {
    const o = removed[i];
    for (const c of [...o.children]) if (!removedSet.has(c)) o.parent.attach(c);
    o.parent.remove(o);
  }

  for (const e of groups.values()) {
    const merged = e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, e.mat);
    m.castShadow = e.cast; m.receiveShadow = e.recv; m.layers.mask = e.mask;
    root.add(m);
  }
}

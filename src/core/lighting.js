// 環境光與月光；各處的點光源由 pLight 建立
import * as THREE from 'three';
import { scene } from './context.js';

scene.add(new THREE.HemisphereLight(0x6a80c0, 0x181d30, 1.7));

const moon = new THREE.DirectionalLight(0xa9bcff, 0.8);
moon.position.set(-14, 26, 12);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 70 });
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);

// 物理單位的點光源（燭光）；dist 之外不照明
export function pLight(color, intensity, x, y, z, dist = 12) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}

// 物理單位的點光源（燭光）；dist 之外不照明
import * as THREE from 'three';
import { scene } from './context.js';

export function pLight(color, intensity, x, y, z, dist = 12) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}

// 雨夜便利商店的環境：渲染參數、相機、天空、霧、環境光與月光
import * as THREE from 'three';
import { scene } from '../../engine/context.js';
import { setupRenderer } from '../../engine/renderer.js';
import { canvasTex } from '../../engine/canvas.js';

export function setupKonbini() {
  setupRenderer({
    exposure: 1.05,
    bloom: { strength: 0.5, radius: 0.55, threshold: 0.92 },
    view: { fov: 30, target: [0.5, 1.4, 0.5], azimuth: 36, elevation: 27, frame: [33, 43], min: 10, max: 200 },
    clamp: { x: [-13, 13], y: [0, 8], z: [-13, 13] },
  });

  scene.fog = new THREE.Fog(0x131b31, 75, 170);
  scene.background = canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#070b17'); gr.addColorStop(0.6, '#10182f'); gr.addColorStop(1, '#1b2644');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });

  scene.add(new THREE.HemisphereLight(0x6a80c0, 0x181d30, 1.7));
  const moon = new THREE.DirectionalLight(0xa9bcff, 0.8);
  moon.position.set(-14, 26, 12);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 70 });
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
}

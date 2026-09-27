// 紅葉屋的環境：柔和低多邊形材質、SSAO、黃昏紫色天空、霧、環境光與淡紫主光
import * as THREE from 'three';
import { scene } from '../../engine/context.js';
import { setupRenderer } from '../../engine/renderer.js';
import { canvasTex } from '../../engine/canvas.js';
import { setStyle, soft } from '../../engine/materials.js';
import { C } from './palette.js';

export function setupRyokan() {
  setStyle({ factory: c => soft(c), outline: false });

  setupRenderer({
    exposure: 1.15,
    bloom: { strength: 0.6, radius: 0.6, threshold: 0.85 },
    // 網址加上 #noao 可關閉環境光遮蔽（較弱的顯示卡）
    ao: location.hash === '#noao' ? null : { radius: 0.55, minDistance: 0.00004, maxDistance: 0.004, samples: 24 },
    view: { fov: 30, target: [0, 0.6, 0.2], azimuth: 24, elevation: 34, frame: [41, 43], min: 12, max: 210 },
    clamp: { x: [-15, 15], y: [-3, 7], z: [-16, 16] },
    vignette: 0.32,
  });

  scene.background = canvasTex(4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, C.sky[0]); gr.addColorStop(0.55, C.sky[1]); gr.addColorStop(1, C.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(C.fog, 110, 240);

  scene.add(new THREE.HemisphereLight(0x928ac4, 0x3e3434, 3.0));
  const key = new THREE.DirectionalLight(0xc4bcf0, 1.5);
  key.position.set(-20, 28, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(3072, 3072);
  Object.assign(key.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  scene.add(key, key.target);
}

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
    view: { fov: 30, target: [0, 0.2, 0.5], azimuth: 24, elevation: 36, frame: [33, 35], min: 12, max: 160 },
    clamp: { x: [-11, 11], y: [-3, 6], z: [-11, 11] },
  });

  scene.background = canvasTex(4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, C.sky[0]); gr.addColorStop(0.55, C.sky[1]); gr.addColorStop(1, C.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(C.fog, 70, 170);

  scene.add(new THREE.HemisphereLight(0x9a8fd6, 0x4a3636, 3.2));
  const key = new THREE.DirectionalLight(0xc8baff, 1.6);
  key.position.set(-14, 20, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 60 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  scene.add(key, key.target);
}

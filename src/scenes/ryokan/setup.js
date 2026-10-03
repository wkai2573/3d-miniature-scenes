// 紅葉屋的環境：柔和低多邊形材質、SSAO、環境光與主光（月光／陽光），以及天色的四組調色盤
// 開場是晚上 8 點、晴朗的秋夜；時間與天氣可以用畫面下方的面板調整（src/engine/env.js、src/engine/sky.js）
import * as THREE from 'three';
import { scene } from '../../engine/context.js';
import { setupRenderer } from '../../engine/renderer.js';
import { setStyle, soft } from '../../engine/materials.js';
import { initEnv } from '../../engine/env.js';
import { setupSky } from '../../engine/sky.js';
import { C } from './palette.js';

const VIEW_AZIMUTH = 24;

// 天色：夜 → 藍調時刻 → 日出日落 → 白天（欄位說明見 sky.js）。夜晚這組就是原本的紫藍夜色
// clouds 是浮島下方三層雲海的顏色、mist 是低處薄霧的顏色、mistK 是薄霧濃度
const PALETTES = {
  night: {
    sky: C.sky, fog: '#342a50',
    hemiSky: '#928ac4', hemiGround: '#3e3434', hemi: 3.0, key: '#c4bcf0', keyI: 1.5,
    exposure: 1.15, bloom: 0.6, bloomT: 0.85, glow: '#c8b8f0',
    clouds: ['#7a6a9e', '#5d4f84', '#44396a'], mist: '#b4a8d4', mistK: 1,
  },
  twilight: {
    sky: ['#262458', '#6a4f88', '#d88a8a'], fog: '#6a4a72',
    hemiSky: '#b09ac8', hemiGround: '#4a3a3a', hemi: 2.8, key: '#e0b8d0', keyI: 0.6,
    exposure: 1.1, bloom: 0.6, bloomT: 0.9, glow: '#ff9a7a',
    clouds: ['#c08aa0', '#8a6a98', '#5a4a7a'], mist: '#d0a8c0', mistK: 1,
  },
  golden: {
    sky: ['#4a6aa8', '#e89a7a', '#ffd49a'], fog: '#e0a890',
    hemiSky: '#f0c8b0', hemiGround: '#5a4838', hemi: 2.8, key: '#ffbe78', keyI: 2.4,
    exposure: 1.0, bloom: 0.4, bloomT: 1.3, glow: '#ffa060',
    clouds: ['#ffd8b8', '#e8b0a0', '#b88a98'], mist: '#ffe0c8', mistK: 0.8,
  },
  day: {
    sky: ['#4e8edc', '#9ccaf0', '#e4f2fa'], fog: '#c4dcf0',
    hemiSky: '#d6e6ff', hemiGround: '#7a705a', hemi: 3.0, key: '#fff2dc', keyI: 3.2,
    exposure: 0.95, bloom: 0.3, bloomT: 1.8, glow: '#fff4d0',
    clouds: ['#ffffff', '#e8eef8', '#cdd6e6'], mist: '#ffffff', mistK: 0.5,
  },
};

export function setupRyokan() {
  setStyle({ factory: c => soft(c), outline: false });

  setupRenderer({
    exposure: 1.15,
    bloom: { strength: 0.6, radius: 0.6, threshold: 0.85 },
    // 網址加上 #noao 可關閉環境光遮蔽（較弱的顯示卡）
    ao: location.hash === '#noao' ? null : { radius: 0.55, minDistance: 0.00004, maxDistance: 0.004, samples: 24 },
    view: { fov: 30, target: [0, 0.6, 0.2], azimuth: VIEW_AZIMUTH, elevation: 34, frame: [41, 43], min: 12, max: 210 },
    clamp: { x: [-15, 15], y: [-3, 7], z: [-16, 16] },
    vignette: 0.32,
  });

  scene.fog = new THREE.Fog(C.fog, 110, 240);
  const hemi = new THREE.HemisphereLight(0x928ac4, 0x3e3434, 3.0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xc4bcf0, 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(3072, 3072);
  Object.assign(key.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  scene.add(key, key.target);

  initEnv({ hour: 20, weather: 'clear' });
  setupSky({ palettes: PALETTES, stops: [0, 0.55, 1], hemi, key, keyDist: 36, azimuth: VIEW_AZIMUTH, fog: [110, 240] });
}

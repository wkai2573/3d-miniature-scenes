// 雨夜便利商店的環境：渲染參數、相機、環境光與主光（月光／陽光），以及天色的四組調色盤
// 開場是深夜 23 點、下著雨；時間與天氣可以用畫面下方的面板調整（src/engine/env.js、src/engine/sky.js）
import * as THREE from 'three';
import { scene } from '../../engine/context.js';
import { setupRenderer } from '../../engine/renderer.js';
import { initEnv } from '../../engine/env.js';
import { setupSky } from '../../engine/sky.js';

const VIEW_AZIMUTH = 36;

// 天色：夜 → 藍調時刻 → 日出日落 → 白天（欄位說明見 sky.js）。夜晚這組就是原本雨夜的配色
const PALETTES = {
  night: {
    sky: ['#070b17', '#10182f', '#1b2644'], fog: '#131b31',
    hemiSky: '#6a80c0', hemiGround: '#181d30', hemi: 1.7, key: '#a9bcff', keyI: 1.15,
    exposure: 1.05, bloom: 0.5, bloomT: 0.92, glow: '#b8b0e0',
  },
  twilight: {
    sky: ['#161d46', '#3c3b72', '#a06c84'], fog: '#3a3658',
    hemiSky: '#8088c0', hemiGround: '#2a2638', hemi: 1.9, key: '#c8b0d8', keyI: 0.5,
    exposure: 1.05, bloom: 0.5, bloomT: 0.95, glow: '#ff9a6a',
  },
  golden: {
    sky: ['#3a5a9a', '#d88a70', '#ffcf8a'], fog: '#d8a080',
    hemiSky: '#d0b0a0', hemiGround: '#4a3a34', hemi: 2.0, key: '#ffb46a', keyI: 1.8,
    exposure: 1.0, bloom: 0.35, bloomT: 1.3, glow: '#ff9a50',
  },
  day: {
    sky: ['#3d78c8', '#86b8e8', '#d6eaf8'], fog: '#b4cfe8',
    hemiSky: '#c4dcff', hemiGround: '#6a6458', hemi: 2.2, key: '#fff3dc', keyI: 2.8,
    exposure: 0.95, bloom: 0.25, bloomT: 1.8, glow: '#fff0c8',
  },
};

export function setupKonbini() {
  setupRenderer({
    exposure: 1.05,
    bloom: { strength: 0.5, radius: 0.55, threshold: 0.92 },
    view: { fov: 30, target: [0.5, 1.4, 0.5], azimuth: VIEW_AZIMUTH, elevation: 27, frame: [33, 43], min: 10, max: 200 },
    clamp: { x: [-13, 13], y: [0, 8], z: [-13, 13] },
  });

  scene.fog = new THREE.Fog(0x131b31, 75, 170);
  const hemi = new THREE.HemisphereLight(0x6a80c0, 0x181d30, 1.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xa9bcff, 0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 70 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);

  initEnv({ hour: 23, weather: 'rain' });
  setupSky({ palettes: PALETTES, stops: [0, 0.6, 1], hemi, key, keyDist: 32, azimuth: VIEW_AZIMUTH, fog: [105, 240] });
}

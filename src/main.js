// 進入點：等字型 → 依序搭建場景 → 合併靜態網格 → 開始渲染
import * as THREE from 'three';
import { scene, U, ticks } from './core/context.js';
import { renderer, resize, render } from './core/renderer.js';
import './core/lighting.js';
import { loadFonts } from './lib/canvas.js';
import { staticBatch } from './lib/batch.js';
import { buildBase } from './scene/base.js';
import { buildStoreExterior } from './scene/storeExterior.js';
import { buildStoreInterior } from './scene/storeInterior.js';
import { buildStreet } from './scene/street.js';
import { buildTraffic } from './scene/traffic.js';
import { buildBuildings } from './scene/buildings.js';
import { buildWeather } from './scene/weather.js';

await loadFonts();   // 貼圖上的日文要等字型載入後才畫

buildBase();
buildStoreExterior();
buildStoreInterior();
const { lampPositions } = buildStreet();
buildTraffic();
buildBuildings();
buildWeather({ lampPositions });

staticBatch(scene);

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  U.time.value += dt;
  for (const f of ticks) f(U.time.value, dt);
  render();
}

addEventListener('resize', resize);
resize();
frame();
window.__sceneStarted = true;
document.getElementById('note')?.remove();
renderer.setAnimationLoop(frame);

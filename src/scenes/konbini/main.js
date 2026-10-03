// 雨夜のことりマート：等字型 → 依序搭建場景 → 合併靜態網格 → 開始渲染
import * as THREE from 'three';
import { scene, U, ticks } from '../../engine/context.js';
import { renderer, resize, render } from '../../engine/renderer.js';
import { loadFonts } from '../../engine/canvas.js';
import { staticBatch } from '../../engine/batch.js';
import { weatherSurfaces } from '../../engine/surface.js';
import { setupKonbini } from './setup.js';
import { buildBase } from './base.js';
import { buildStoreExterior } from './storeExterior.js';
import { buildStoreInterior } from './storeInterior.js';
import { buildStreet } from './street.js';
import { buildTraffic } from './traffic.js';
import { buildBuildings } from './buildings.js';
import { buildWeather } from './weather.js';
import { buildSound } from './sound.js';

// 貼圖上會畫到的日文字元（新增文字時請一併加入）
const GLYPHS = 'ことりマート止まれおでん全品円秋の新作焼きいもつめた〜あっか飲み物にぎ・弁当菓子カップ麺日用料らげ肉コロケフェ'
  + 'しゃせえるごびペボル月見荘町内会知ゴミ出祭回覧板防災訓練丁目星野アイス駐輪場発売す営業中時間車台ホナクスッ増量二一曜願で';

setupKonbini();
await loadFonts(GLYPHS);

buildBase();
buildStoreExterior();
buildStoreInterior();
const { lampPositions } = buildStreet();
buildTraffic();
buildBuildings();
buildWeather({ lampPositions });
buildSound();

staticBatch(scene);
weatherSurfaces(scene, { x: [-14, 14], z: [-14, 14] });   // 積雪；路面的濕潤由濕地反射負責

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
dispatchEvent(new Event('scene:ready'));   // 轉場布幕與選單按鈕等這個訊號
document.getElementById('note')?.remove();
renderer.setAnimationLoop(frame);

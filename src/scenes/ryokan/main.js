// 秋夜の紅葉屋：等字型 → 依序搭建場景 → 合併靜態網格 → 開始渲染
import * as THREE from 'three';
import { scene, U, ticks } from '../../engine/context.js';
import { renderer, resize, render } from '../../engine/renderer.js';
import { loadFonts } from '../../engine/canvas.js';
import { staticBatch } from '../../engine/batch.js';
import { setupRyokan } from './setup.js';
import { buildIsland } from './island.js';
import { buildInn } from './inn.js';
import { buildOnsen } from './onsen.js';
import { buildGarden } from './garden.js';
import { buildFlora } from './flora.js';
import { buildGroundcover } from './groundcover.js';
import { startWind } from './wind.js';
import { buildFallingLeaves } from './fallingLeaves.js';
import { buildAtmosphere } from './atmosphere.js';
import { buildSound } from './sound.js';
import { onLevel } from './shapes.js';
import { LV } from './layout.js';

// 貼圖上會畫到的日文字元（新增文字時請一併加入）
const GLYPHS = 'ゆ湯紅葉屋男女';

setupRyokan();
await loadFonts(GLYPHS);

buildIsland();
onLevel(LV.up, buildInn);        // 主屋、湯屋、溫泉在上段台地
onLevel(LV.up, buildOnsen);
buildGarden();
buildFlora();
buildGroundcover();
buildFallingLeaves();
buildAtmosphere();
startWind();
buildSound();

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
dispatchEvent(new Event('scene:ready'));   // 轉場布幕與選單按鈕等這個訊號
document.getElementById('note')?.remove();
renderer.setAnimationLoop(frame);

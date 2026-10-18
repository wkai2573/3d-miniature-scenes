// 少女：在店門前的人行道出場，玩家用 WASD 操作她走路，按住 Shift 跑步；按 C 在俯瞰與跟拍視角之間切換
// 每格：讀取按鍵與自動門 → 少女行為算出下一格的狀態 → 告訴自動門該不該打開，少女外觀依狀態驅動骨骼 → 相機依視角跟上她
// 少女非同步載入，不擋開場布幕；載入或每格更新出錯時只在主控台留下訊息，場景照常運作
import * as THREE from 'three';
import { scene, onTick } from '../../engine/context.js';
import { camera, precompile } from '../../engine/renderer.js';
import { ENV } from '../../engine/env.js';
import { loadAppearance } from './appearance.js';
import { createGirlState, updateGirl } from './behavior.js';
import { createGirlInput } from './input.js';
import { createCameraRig } from './cameraRig.js';
import { KONBINI, groundAt } from './layout.js';
import { autoDoor } from '../konbini/storeExterior.js';
import { listen, takeEvents } from './events.js';
import { shelter } from './shelter.js';

const MODEL = 'assets/characters/three-vrm-girl.vrm';

export function buildGirl() {
  loadAppearance(MODEL, (x, z) => groundAt(KONBINI, x, z))
    .then(async look => {
      await precompile(look.root);   // 出場那一格才不會因為編譯著色器而卡頓
      const keys = createGirlInput();
      const world = { weather: ENV.weather, layout: KONBINI, door: autoDoor.open, seed: (Math.random() * 2 ** 32) >>> 0 };   // 每次載入的眨眼、視線與偶發動作都不同
      const view = new THREE.Vector3();
      let state = createGirlState(world);
      scene.add(look.root);
      const rig = createCameraRig(look.root, KONBINI);
      let broken = false;
      listen(true);   // 從現在起，場景裡發生的事會記在清單裡，每格讀一次
      onTick((t, dt) => {
        if (broken) return;
        try {
          world.weather = ENV.weather;
          world.door = autoDoor.open;
          world.events = takeEvents();
          camera.getWorldDirection(view);
          state = updateGirl(state, { ...keys.read(), cameraYaw: Math.atan2(view.x, view.z) }, world, dt);
          autoDoor.wanted = state.doorOpen;
          look.update(state, t, dt);
          shelter.set(look.canopy.center, look.canopy.axis, look.canopy.radius, look.canopy.height);
          rig.follow(state, dt);
        } catch (err) {
          broken = true;
          look.root.visible = false;
          autoDoor.wanted = false;   // 自動門回到自己開關的節奏
          shelter.clear();
          listen(false);
          console.warn('少女更新出錯，先把她藏起來，場景照常顯示：', err);
          rig.stop();
        }
      });
    })
    .catch(err => console.warn('少女沒有載入，場景照常顯示：', err));
}

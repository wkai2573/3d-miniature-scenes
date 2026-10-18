// 少女相機：管理俯瞰視角與跟拍視角
// 開場是俯瞰視角，由場景原本的操作控制管；按 C 在一秒內平滑飛到貼在少女背後的跟拍視角，再按一次飛回去
// 跟拍視角自己管相機，不用操作控制：左鍵拖曳繞著少女轉、滾輪調距離、右鍵不能平移；
// 少女走動一會兒、也沒有在拖曳時，相機慢慢轉回她背後；被牆或物件擋住時先抬高再拉近，在店內則只拉近、也不自動轉回背後，角度完全由使用者決定（見 cameraFit.js）
// 渲染流程每格把俯瞰視角的相機中心限制在底座範圍內（renderer.js 的 clamp）；跟拍視角停用操作控制，不受它限制，少女走到地面的邊緣也跟得上
import { MathUtils, Vector3 } from 'three';
import { camera, controls, canvas } from '../../engine/renderer.js';
import { fitCamera, clearView, orbit, inStore } from './cameraFit.js';
import { keysIgnored } from './input.js';

const CHEST = 1.2;                    // 繞轉中心在少女腳下往上多高
const DISTANCE = [1.5, 6];            // 滾輪調得到的距離範圍
const PITCH = [0.02, 1.25];           // 相機的仰角範圍（弧度，往上看她的角度）
const START = { distance: 3.2, pitch: 0.2 };   // 剛切到跟拍視角時的距離與仰角
const FLY = 1;                        // 兩種視角之間飛一趟要幾秒
const NEAR = 0.08;                    // 鏡頭很近時，原本 0.5 公尺的近裁切面會切掉少女
const WALKED = 0.8;                   // 少女走動這麼久之後，相機才開始轉回她背後
const IDLE_DRAG = 1.2;                // 放開拖曳這麼久之後，相機才開始轉回她背後
const TURN_BACK = 0.9, TURN_MAX = 1.4;   // 轉回背後的快慢（時間常數與最大角速度，弧度／秒）
const SMOOTH = 0.07;                  // 距離與仰角追上目標的時間常數
const RECOVER = 0.4;                  // 被擋住拉近之後，放開時慢慢回到原本距離的時間常數
const CLEAR_VIEW = { maxPitch: PITCH[1], lift: 0.14, steps: 9, clear: 0.85 };   // 被擋住時，每次多抬幾弧度、最多試幾次；抬高之後能到想要的距離的這個比例，就算沒被擋住
// 切到跟拍視角時改掉的操作控制設定，切回俯瞰時還原；不讓它們把跟拍的相機位置夾回去
const KEEP = ['minDistance', 'maxDistance', 'minPolarAngle', 'maxPolarAngle'];

const smooth = s => s * s * (3 - 2 * s);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = MathUtils.clamp;

/** root 是少女外觀的根節點：位置在她腳下，水平旋轉是她的面向；layout 是店面配置 */
export function createCameraRig(root, layout) {
  let wanted = false, blend = 0, stopped = false;   // wanted 現在想看的視角；blend 0 是俯瞰、1 是跟拍，兩者之間是在飛
  let saved = null;   // 離開俯瞰時的相機與操作控制，飛回去的終點
  const view = { yaw: 0, pitch: START.pitch, distance: START.distance };   // 使用者想要的跟拍角度，yaw 是相機在少女的哪個方位（朝 +z 是 0）
  const shown = { pitch: START.pitch, distance: START.distance, lift: 0, reach: START.distance };   // 實際顯示的：lift 是被擋住時多抬了幾弧度，reach 是被擋住時能拉出去多遠
  const follow = { pos: new Vector3(), target: new Vector3() }, from = new Vector3(), pivot = { x: 0, y: 0, z: 0 }, want = { x: 0, y: 0, z: 0 };
  let walked = 0, sinceDrag = Infinity, dragging = false;
  const tip = createTip();

  function enter() {
    settle();
    saved = {
      position: camera.position.clone(), target: controls.target.clone(), near: camera.near, enabled: controls.enabled,
      ...Object.fromEntries(KEEP.map(k => [k, controls[k]])),
    };
    controls.enabled = false;
    Object.assign(controls, { minDistance: 0, maxDistance: Infinity, minPolarAngle: 0, maxPolarAngle: Math.PI });
    camera.near = NEAR;
    camera.updateProjectionMatrix();
    // 一開始就在少女背後，距離與仰角沿用上一次調好的
    view.yaw = root.rotation.y + Math.PI;
    shown.pitch = view.pitch;
    shown.distance = shown.reach = view.distance;
    shown.lift = 0;
    walked = 0; sinceDrag = Infinity;
  }

  function leave() {
    const { position, target, near, enabled, ...kept } = saved;
    camera.position.copy(position);
    controls.target.copy(target);
    Object.assign(controls, kept, { enabled });
    camera.near = near;
    camera.updateProjectionMatrix();
    controls.update();
    saved = null;
    dragging = false;
  }

  // 拖曳放開後鏡頭還會靠阻尼慢慢轉一陣子：切換前一次轉完，記下的俯瞰才不會被這股慣性帶歪
  function settle() {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
  }

  function toggle() {
    wanted = !wanted;
    if (wanted && !saved) enter();
    tip(wanted ? '跟拍視角' : '俯瞰視角');
  }

  addEventListener('keydown', e => {
    if (stopped || e.code !== 'KeyC' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || keysIgnored(e.target)) return;
    e.preventDefault();
    toggle();
  });

  // 跟拍視角的滑鼠操作：左鍵拖曳繞轉，滾輪調距離；轉動的快慢和俯瞰視角的操作控制一樣
  const active = () => saved && wanted;   // 飛過去的途中就能拖曳與縮放，調整的是飛到終點時的角度
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !active()) return;
    dragging = true;
    sinceDrag = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const turn = 2 * Math.PI * controls.rotateSpeed / canvas.clientHeight;
    view.yaw -= e.movementX * turn;
    view.pitch = clamp(view.pitch + e.movementY * turn, ...PITCH);
    sinceDrag = 0;
  });
  const drop = () => { dragging = false; };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  canvas.addEventListener('wheel', e => {
    if (!active()) return;
    e.preventDefault();
    view.distance = clamp(view.distance * Math.exp(e.deltaY * 0.001 * controls.zoomSpeed), ...DISTANCE);
  }, { passive: false });

  // 這一格跟拍視角的相機位置與看的點
  function placeFollow(state, dt) {
    pivot.x = root.position.x; pivot.y = root.position.y + CHEST; pivot.z = root.position.z;
    // 少女走動一會兒、使用者也沒在拖曳時，慢慢轉回她背後；在店內不轉，角度由使用者決定
    const indoors = inStore(layout, pivot.x, pivot.z);
    walked = state.speed > 0.4 ? walked + dt : 0;
    sinceDrag += dt;
    if (!indoors && !dragging && walked > WALKED && sinceDrag > IDLE_DRAG) {
      const diff = wrapAngle(root.rotation.y + Math.PI - view.yaw);
      view.yaw += clamp(diff * (1 - Math.exp(-dt / TURN_BACK)), -TURN_MAX * dt, TURN_MAX * dt);
    }
    const ease = 1 - Math.exp(-dt / SMOOTH);
    shown.pitch += (view.pitch - shown.pitch) * ease;
    shown.distance += (view.distance - shown.distance) * ease;

    // 被擋住時先往上抬：從牆或貨架的上面看著她；抬到頂還是擋住才拉近。店內不抬，只拉近。拉近與抬高都是被擋住時馬上到位，放開後慢慢回去
    const d = shown.distance;
    const best = clearView(layout, pivot, view.yaw, shown.pitch, d, CLEAR_VIEW);
    const lift = best.pitch - shown.pitch;
    shown.lift = lift > shown.lift ? lift : shown.lift + (lift - shown.lift) * (1 - Math.exp(-dt / RECOVER));
    shown.reach = best.reach < shown.reach ? best.reach : shown.reach + (best.reach - shown.reach) * (1 - Math.exp(-dt / RECOVER));
    // 平滑過渡中的位置不一定沒被擋住，最後再檢查一次
    const cam = fitCamera(layout, pivot, orbit(pivot, view.yaw, shown.pitch + shown.lift, Math.min(d, shown.reach), want));
    follow.pos.set(cam.x, cam.y, cam.z);
    follow.target.set(pivot.x, pivot.y, pivot.z);
  }

  return {
    /** 每格在少女外觀更新之後呼叫：state 是少女行為的狀態 */
    follow(state, dt) {
      if (!saved) return;
      blend = clamp(blend + (wanted ? dt : -dt) / FLY, 0, 1);
      placeFollow(state, dt);
      if (blend <= 0 && !wanted) { blend = 0; leave(); return; }
      // 飛行中：從俯瞰的位置到跟拍的位置，終點是活的（少女還在走），所以每格依終點重算
      const e = smooth(blend);
      camera.position.lerpVectors(saved.position, follow.pos, e);
      controls.target.lerpVectors(saved.target, follow.target, e);
    },
    /** 少女不見了：回到俯瞰，之後按 C 也不再切換 */
    stop() {
      if (saved) leave();
      wanted = false; blend = 0; stopped = true;
    },
  };
}

// 切換時在畫面上方短暫顯示現在是哪個視角，配色與字型沿用選單與面板的深色玻璃（css/menu.css）
function createTip() {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);padding:4px 14px;border-radius:999px;'
    + 'background:var(--ui-glass);border:1px solid var(--ui-line);color:var(--ui-ink);font:13px/1.7 var(--ui-font);'
    + 'letter-spacing:0.08em;pointer-events:none;opacity:0;transition:opacity 0.4s;z-index:5';
  document.body.append(el);
  let timer = 0;
  return text => {
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(timer);
    timer = setTimeout(() => { el.style.opacity = '0'; }, 1400);
  };
}

// 跟拍相機的碰撞：從少女身上的一點（繞轉中心）往相機想去的位置看過去，被店面配置裡的牆或物件擋住就拉近到擋住的位置前面
// 不依賴 three.js；座標都是世界座標，單位公尺
import { inside, groundAt } from './layout.js';

export const MIN_DISTANCE = 0.45;   // 拉近之後離繞轉中心最近多少，再近就貼在她身上了
const MARGIN = 0.12;                // 相機和擋住它的東西留多少空隙，鏡頭才不會貼著牆
const CLEARANCE = 0.1;              // 相機的視線離矮物件的頂端要高出多少，才算越得過去
const CEILING_GAP = 0.18;           // 在店內時，相機離天花板留多少
const GROUND_GAP = 0.15;            // 相機離地面至少多高

/** (x, z) 在不在店內 */
export const inStore = (layout, x, z) => layout.store.some(r => inside(r, x, z));

/** 繞轉中心 pivot 往方位 yaw（相機在少女的哪個方位，朝 +z 是 0）、仰角 pitch、距離 distance 的位置，寫進 out */
export function orbit(pivot, yaw, pitch, distance, out) {
  const c = Math.cos(pitch) * distance;
  out.x = pivot.x + Math.sin(yaw) * c; out.y = pivot.y + Math.sin(pitch) * distance; out.z = pivot.z + Math.cos(yaw) * c;
  return out;
}

const _want = { x: 0, y: 0, z: 0 };

/**
 * 想把相機擺在方位 yaw、仰角 pitch、距離 distance，被擋住時該怎麼辦：回傳 { pitch 該用的仰角, reach 能拉出去多遠（公尺）}
 * 露天時先往上抬：從牆或貨架的上面看著她，每次多抬 lift 弧度、最多試 steps 次，抬到能到 distance 的 clear 倍就算沒被擋住，仰角不超過 maxPitch；
 * 抬到頂還是擋住才拉近。店內不抬：貨架之間的走道抬高了只會變成從天花板下往下俯看，仰角由使用者決定，被擋住只拉近
 */
export function clearView(layout, pivot, yaw, pitch, distance, { maxPitch, lift, steps, clear }) {
  const reachOf = p => {
    const cam = fitCamera(layout, pivot, orbit(pivot, yaw, p, distance, _want));
    return Math.hypot(cam.x - pivot.x, cam.y - pivot.y, cam.z - pivot.z);
  };
  let best = { pitch, reach: reachOf(pitch) };
  if (inStore(layout, pivot.x, pivot.z) || best.reach >= distance * clear) return best;
  let stuck = 0;
  for (let k = 1; k <= steps; k++) {
    const p = Math.min(maxPitch, pitch + k * lift), reach = reachOf(p);
    if (reach > best.reach + 0.02) { best = { pitch: p, reach }; stuck = 0; } else if (++stuck >= 2) break;   // 抬高了也沒有比較好（牆是高到頂的），不必試到最高
    if (reach >= distance * clear) break;
  }
  return best;
}

/**
 * 回傳相機實際該放的位置：pivot 是繞轉中心，want 是相機想去的位置
 * 店面配置的障礙物 [x0, z0, x1, z1, 高度]：視線從比物件高的地方越過去就不算擋住；沒寫高度的和牆一樣高到頂
 */
export function fitCamera(layout, pivot, want) {
  const dx = want.x - pivot.x, dy = want.y - pivot.y, dz = want.z - pivot.z, length = Math.hypot(dx, dy, dz);
  let reach = 1;   // 沿著視線走到哪裡被擋住（0 在繞轉中心、1 在想去的位置）
  if (length > 1e-9) {
    for (const [x0, z0, x1, z1, top = Infinity] of layout.obstacles) {
      const enter = enterBox(pivot, dx, dy, dz, x0 - MARGIN, z0 - MARGIN, x1 + MARGIN, z1 + MARGIN, top + CLEARANCE);
      if (enter !== null && enter < reach) reach = enter;
    }
    const [x0, z0, x1, z1] = layout.cameraBounds;
    reach = Math.min(reach, leaveBox(pivot, dx, dz, x0, z0, x1, z1));
    reach = Math.max(reach, Math.min(1, MIN_DISTANCE / length));
  }
  const cam = reach >= 1 ? { x: want.x, y: want.y, z: want.z } : { x: pivot.x + dx * reach, y: pivot.y + dy * reach, z: pivot.z + dz * reach };
  // 貼著矮的東西時，最近距離會讓相機落進它裡面：抬到它的上面去
  for (const [x0, z0, x1, z1, top = Infinity] of layout.obstacles) {
    if (cam.x > x0 && cam.x < x1 && cam.z > z0 && cam.z < z1 && cam.y < top + CLEARANCE) cam.y = Math.max(cam.y, top + CLEARANCE / 2);
  }
  if (inStore(layout, cam.x, cam.z)) cam.y = Math.min(cam.y, layout.ceiling - CEILING_GAP);
  cam.y = Math.max(cam.y, groundAt(layout, cam.x, cam.z) + GROUND_GAP);
  return cam;
}

// 視線 p + t·(dx, dy, dz)，t 在 0 ~ 1 之間，什麼時候進到方框（水平範圍 x0 ~ x1、z0 ~ z1，高度 top 以下）裡；碰不到就是 null
// 繞轉中心本來就在方框裡（少女緊貼著它）不算擋住：視線朝哪個方向都不是從外面撞上去，硬算只會讓相機縮到她身上
function enterBox(p, dx, dy, dz, x0, z0, x1, z1, top) {
  let t0 = 0, t1 = 1;
  for (const [o, d, lo, hi] of [[p.x, dx, x0, x1], [p.z, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return null; continue; }
    const a = (lo - o) / d, b = (hi - o) / d;
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    if (t0 > t1) return null;
  }
  if (t0 === 0) return null;
  // 視線在方框裡的那一段，最低的地方比物件高就是從上面越過去了
  if (Math.min(p.y + dy * t0, p.y + dy * t1) > top) return null;
  return t0;
}

// 視線什麼時候走出範圍（水平範圍 x0 ~ x1、z0 ~ z1）
function leaveBox(p, dx, dz, x0, z0, x1, z1) {
  let t = Infinity;
  for (const [o, d, lo, hi] of [[p.x, dx, x0, x1], [p.z, dz, z0, z1]]) {
    if (d > 1e-12) t = Math.min(t, (hi - o) / d);
    else if (d < -1e-12) t = Math.min(t, (lo - o) / d);
  }
  return Math.max(0, t);
}

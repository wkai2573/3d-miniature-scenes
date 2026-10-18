// 少女的視線動作：眼睛先動、頭與脖子慢半拍跟上，剩下的角度由眼睛負責
// 少女行為回報要看的世界座標點，這裡算出頭、脖子與眼球各要轉多少；頭與眼球各用一個彈簧追著目標，眼睛的彈簧快得多
// 角度一律是相對少女面向的：yaw 正值往她的左手邊（+x）轉，pitch 正值往上看
import { EYE_HEIGHT } from './idle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

const HEAD_YAW = 1.0, HEAD_UP = 0.8, HEAD_DOWN = 0.4;   // 脖子與頭加起來最多轉多少；往上加眼球的 10° 約 56°，和少女看得到的仰角一致
export const EYE_YAW = 12 * Math.PI / 180, EYE_PITCH = 10 * Math.PI / 180;   // 這個模型的眼球骨骼最多轉的角度
const NECK = 0.35, CHEST = 0.1;   // 轉向由脖子、上胸與頭分攤的比例，其餘給頭
const HEAD_OMEGA = 7, EYE_OMEGA = 40;   // 彈簧的快慢：頭約半秒追上，眼睛約十分之一秒
const AHEAD_PITCH = 0.4;   // 走路、跑步時看前方遠處（往下約 5°）：頭只低 2° 左右，幾乎水平，其餘約 3° 由眼睛負責，離眼球的極限（10°）還遠

// 臨界阻尼的彈簧：st 是 { x, v }，往 target 追，不會來回晃
export function spring(st, target, omega, dt) {
  const f = 1 + 2 * dt * omega, oo = omega * omega, hoo = dt * oo, hhoo = dt * hoo, det = 1 / (f + hhoo);
  const x = (f * st.x + dt * st.v + hhoo * target) * det;
  st.v = (st.v + hoo * (target - st.x)) * det;
  st.x = x;
}

/** 每位少女一個：記住頭與眼睛現在轉到哪裡 */
export function createLook() {
  const head = { yaw: { x: 0, v: 0 }, pitch: { x: 0, v: 0 } }, eye = { yaw: { x: 0, v: 0 }, pitch: { x: 0, v: 0 } };
  let ready = false;

  /** 把這一格的視線疊到姿勢 out 上：頭與脖子轉進骨骼，眼球的角度寫在 out.eyes（弧度） */
  return function look(state, out, dt) {
    const g = state.gaze, dx = g.x - state.x, dz = g.z - state.z;
    const yaw = wrapAngle(Math.atan2(dx, dz) - state.facing);
    const pitch = Math.atan2(g.y - (state.y + EYE_HEIGHT), Math.hypot(dx, dz));
    const headYaw = clamp(yaw, -HEAD_YAW, HEAD_YAW);
    const headPitch = clamp(pitch * (g.kind === 'ahead' ? AHEAD_PITCH : 0.8), -HEAD_DOWN, HEAD_UP);
    if (!ready) {   // 出場那一格直接看向目標，不從正前方慢慢轉過去
      ready = true;
      head.yaw.x = headYaw; head.pitch.x = headPitch;
    }
    spring(head.yaw, headYaw, HEAD_OMEGA, dt);
    spring(head.pitch, headPitch, HEAD_OMEGA, dt);
    spring(eye.yaw, clamp(yaw - head.yaw.x, -EYE_YAW, EYE_YAW), EYE_OMEGA, dt);
    spring(eye.pitch, clamp(pitch - head.pitch.x, -EYE_PITCH, EYE_PITCH), EYE_OMEGA, dt);

    const r = out.rot, a = head.yaw.x, p = head.pitch.x;
    r.neck[1] += a * NECK; r.upperChest[1] += a * CHEST; r.head[1] += a * (1 - NECK - CHEST);
    r.neck[0] -= p * 0.4; r.head[0] -= p * 0.6;
    out.eyes[0] = eye.yaw.x; out.eyes[1] = eye.pitch.x;
  };
}

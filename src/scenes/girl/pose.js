// 少女的骨骼姿勢：用程式旋轉 VRM 的正規化人形骨骼，不用外部動畫檔
// 角度一律以 VRM 1.0 的朝向來寫：少女面向 +z、左手在 +x；VRM 0.x 的模型由少女外觀把 x、z 反過來
// 正規化骨骼在 T 字站姿時旋轉全為 0。歐拉角 [x, y, z] 依 three.js 預設的 XYZ 順序套用：
//   x：前後彎，正值讓骨骼末端往後（手臂、腿）或往前（脊椎）  y：水平轉  z：左右擺，正值讓 +x 那一側往上
// 腿用兩節 IK：先決定腳踝要落在哪裡，再反推大腿、小腿與腳掌的角度，腳掌著地時就不會滑動
// 地面有高低時，每隻腳踩在自己腳下的地面上，身體的高度跟著兩腳中比較低的那一邊
// 手指與拇指的手形在 hands.js
// 拿傘的右臂姿勢與傘的朝向在本檔的「拿傘」一節
import { Euler, Quaternion, Vector3 } from 'three';
import { hash, noise3 } from '../../engine/noise.js';
import { createLook, spring } from './look.js';
import { HAND_BONES, LOOSE, FIST, GRIP, shapeHand, idleHands } from './hands.js';

// 姿勢會動到的骨骼；模型沒有的選用骨骼由套用端略過
export const BONES = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  ...['left', 'right'].flatMap(s => [
    'Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot', 'Toes', ...HAND_BONES,
  ].map(b => s + b)),
];

/**
 * 姿勢：hips 是髖部相對 T 字站姿的位移（公尺），rot 是各骨骼的歐拉角（弧度），eyes 是眼球的 [水平, 垂直] 轉角（弧度）；每格重複使用同一份
 * y 是少女整個人站在多高的地方（世界座標），由少女的姿勢產生器依腳下的地面決定
 * umbrella 是傘：open 張開程度（0 收起、1 撐開）、pitch 傘尖繞 x 軸往前轉的角度（0 朝上、π 朝下）、roll 繞 z 軸往左傾的角度
 */
export function createPose() {
  return { y: 0, hips: [0, 0, 0], eyes: [0, 0], umbrella: { open: 0, pitch: Math.PI, roll: 0 }, rot: Object.fromEntries(BONES.map(b => [b, [0, 0, 0]])) };
}

const TAU = Math.PI * 2;
const clamp1 = v => Math.min(1, Math.max(-1, v));
const smooth = s => s * s * (3 - 2 * s);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const add = (v, x, y, z) => { v[0] += x; v[1] += y; v[2] += z; };
const SIDES = [['left', 1], ['right', -1]];   // 骨骼名稱的前綴，以及那一側在 x 軸上的方向

// 手臂自然下垂：上臂從 T 字往下放約 76°（離身體約 14°）、幾乎不往前，手肘只微微彎，前臂接近垂直，轉一點讓掌心朝向大腿
// 參考：H-Anim 的 A 字站姿是手臂離身體 45°，放鬆站著時肩膀外展只剩接近 0 ~ 10°；VRM 的 T 字站姿掌心朝下，上臂放到垂直時掌心剛好朝向身體
const ARM_DOWN = 1.33;     // 上臂從 T 字往下放的角度（約 76°）
const ARM_FORWARD = 0.03;  // 上臂往前多少
const ELBOW = 0.05;        // 手肘微彎，前臂幾乎垂直
const FOREARM_TURN = 0.2;  // 前臂繞自己的軸轉多少，讓掌心朝向大腿
// 跑步與收起透明傘的右臂沿用票 09 之前的站姿，樣子不變
const OLD_ARM = { down: 1.4, forward: 0.1, elbow: 0.15 };

// 站姿：手臂放下、手肘微彎，其餘骨骼回到 T 字站姿；手形由各個動作自己寫進去
function stance(out) {
  out.hips.fill(0);
  for (const b of BONES) out.rot[b].fill(0);
  for (const [s, k] of SIDES) {
    out.rot[s + 'UpperArm'][0] = -ARM_FORWARD;
    out.rot[s + 'UpperArm'][2] = -k * ARM_DOWN;
    out.rot[s + 'LowerArm'][0] = k * FOREARM_TURN;
    out.rot[s + 'LowerArm'][1] = -k * ELBOW;
  }
}

// ---- 腿的 IK ----
// body 是從模型量出的左腿尺寸（VRM 1.0 方向），右腿取 x 的鏡像：
//   hip 髖關節相對髖部骨骼、thigh 膝蓋相對髖關節、shin 腳踝相對膝蓋、toe 腳尖關節相對腳踝、heel 腳跟著地點相對腳踝、
//   tip 鞋尖相對腳踝
// 腳踝的目標位置一律相對髖部骨骼的靜止位置，用少女自己的座標：面向 +z、左手在 +x
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0);
const _e = new Euler(), _qh = new Quaternion(), _qi = new Quaternion(), _qu = new Quaternion(), _ql = new Quaternion(), _qf = new Quaternion(), _qd = new Quaternion(), _qy = new Quaternion();
const _hip = new Vector3(), _thigh = new Vector3(), _shin = new Vector3(), _v = new Vector3(), _w = new Vector3();
const mirror = (out, v, k) => out.set(k * v.x, v.y, v.z);
const setRot = (arr, q) => { _e.setFromQuaternion(q, 'XYZ'); arr[0] = _e.x; arr[1] = _e.y; arr[2] = _e.z; };

/** 腳踝在 T 字站姿時相對髖部骨骼的位置 */
function restAnkle(body, k, out) {
  return mirror(out, body.hip, k).add(mirror(_v, body.thigh, k)).add(mirror(_v, body.shin, k));
}

/**
 * 讓 k 那一側的腳踝落在 ankle，腳掌水平轉 yaw、前後傾 pitch（正值腳跟抬起）
 * 髖部的位移與旋轉要先寫進 out
 */
function solveLeg(out, body, k, ankle, pitch, yaw) {
  const s = k > 0 ? 'left' : 'right';
  mirror(_hip, body.hip, k); mirror(_thigh, body.thigh, k); mirror(_shin, body.shin, k);
  _qh.setFromEuler(_e.set(...out.rot.hips));
  _qi.copy(_qh).invert();
  // 髖關節到腳踝目標的向量，換到髖部骨骼自己的座標
  _v.copy(_hip).applyQuaternion(_qh).add(_w.fromArray(out.hips));
  _v.subVectors(ankle, _v).applyQuaternion(_qi);
  const a = _thigh.length(), b = _shin.length();
  const rest = _w.copy(_thigh).add(_shin).length();
  const d = Math.min(_v.length(), rest);
  // 膝蓋：依需要的距離算出要比 T 字站姿多彎多少
  const inner = Math.acos(clamp1(-_thigh.dot(_shin) / (a * b)));
  const knee = Math.max(0, inner - Math.acos(clamp1((a * a + b * b - d * d) / (2 * a * b))));
  _ql.setFromAxisAngle(X, knee);
  // 大腿：把彎好膝蓋後「髖關節到腳踝」的方向轉到目標方向
  _w.copy(_shin).applyQuaternion(_ql).add(_thigh).normalize();
  _qu.setFromUnitVectors(_w, _v.normalize());
  // 腳掌：抵銷上面所有的旋轉，只留下水平轉與前後傾
  _qd.setFromAxisAngle(X, pitch).premultiply(_qy.setFromAxisAngle(Y, yaw));
  _qf.copy(_qh).multiply(_qu).multiply(_ql).invert().multiply(_qd);
  setRot(out.rot[s + 'UpperLeg'], _qu);
  setRot(out.rot[s + 'LowerLeg'], _ql);
  setRot(out.rot[s + 'Foot'], _qf);
  // 腳跟抬起時腳趾往回彎，鞋頭貼著地面
  out.rot[s + 'Toes'].fill(0)[0] = -Math.max(0, pitch);
}

// ---- 待機 ----
const _ankle = new Vector3();

// 平滑的雜訊：三層不同速度、互不同步的 value noise 疊在一起，沒有固定的週期；seed 不同就是互不相干的一條，回傳大約 -1 ~ 1
const drift = (t, seed, speed = 1) => clamp1(1.6 * (0.55 * noise3(t * 0.11 * speed, seed, 0) + 0.3 * noise3(t * 0.27 * speed, seed + 11.3, 1) + 0.15 * noise3(t * 0.61 * speed, seed + 23.7, 2)));
// 一段動作做到 u（0 ~ 1）時的強度：在 [a, b] 之間升起、在 [c, d] 之間放下，都是平滑的
const bump = (u, a, b, c, d) => smooth(clamp01((u - a) / (b - a))) * (1 - smooth(clamp01((u - c) / (d - c))));
const clamp01 = v => Math.min(1, Math.max(0, v));

/** 沒有偶發動作、重心在正中間時的待機心情 */
export const IDLE_MOOD = { bias: 0, kind: 'none', u: 0, fade: 0 };

/**
 * 待機的上半身、手與髖部：呼吸起伏、重心在兩腳之間移動、頭與肩的擺動、手指的小動作，腿由少女的姿勢產生器依腳的位置解出
 * 擺動都是不規則的平滑雜訊，看一分鐘也看不出重複；mood 是 { bias 承重的腳（1 是左腳、−1 是右腳，平順地換）, kind 偶發動作的種類, u 做到哪裡（0 ~ 1）, fade 淡入淡出（0 ~ 1） }
 */
export function idlePose(t, body, out, mood = IDLE_MOOD) {
  stance(out);
  // 呼吸：快慢與深淺都在慢慢變
  const breath = Math.sin(TAU * (t / 4.2 + 0.35 * noise3(t * 0.09, 90, 0))) * (0.8 + 0.25 * drift(t, 91));
  const weight = clamp1(0.55 * mood.bias + 0.5 * drift(t, 3, 0.7));   // 正值：重心在左腳

  // 重心：髖部移向承重腳、骨盆往承重那側抬高；整體微微下沉，讓另一腳的膝蓋放鬆
  const roll = 0.03 * weight;
  out.hips[0] = 0.02 * weight;
  out.hips[1] = -(Math.abs(body.hip.x * Math.sin(roll)) + 0.003);
  add(out.rot.hips, 0, 0, roll);
  add(out.rot.spine, 0, 0, -0.6 * roll);   // 上半身抵銷骨盆的傾斜，維持直立
  add(out.rot.chest, 0, 0, -0.3 * roll);

  // 呼吸：吸氣時胸口微微挺起、肩膀抬高，脖子抵銷讓頭不跟著點
  add(out.rot.chest, -0.012 * breath, 0, 0);
  add(out.rot.upperChest, -0.008 * breath, 0, 0);
  add(out.rot.leftShoulder, 0, 0, 0.02 * breath + 0.012 * drift(t, 8));
  add(out.rot.rightShoulder, 0, 0, -0.02 * breath - 0.012 * drift(t, 9));
  add(out.rot.neck, 0.015 * breath, 0.015 * drift(t, 4), 0);

  // 頭部輕輕飄
  add(out.rot.head, 0.025 * drift(t, 5), 0.04 * drift(t, 6), 0.02 * drift(t, 7) - 0.3 * roll);

  // 手臂跟著重心輕輕晃
  add(out.rot.leftUpperArm, 0.02 * drift(t, 12), 0, 0);
  add(out.rot.rightUpperArm, 0.02 * drift(t, 13), 0, 0);
  idleHands(t, out);
  idleAction(mood, out);
  return out;
}

// 偶發動作的姿勢：換腳站由重心與腳負責，張望與抬頭看天由視線帶動，這裡只補上身體跟著的部分
function idleAction({ kind, u, fade }, out) {
  if (fade < 0.005) return;
  if (kind === 'sky') {
    // 抬頭時胸口微微挺起
    const lean = fade * bump(u, 0.1, 0.35, 0.8, 1);
    add(out.rot.chest, -0.06 * lean, 0, 0);
    add(out.rot.upperChest, -0.05 * lean, 0, 0);
  } else if (kind === 'stretch') {
    // 前半聳一下肩，後半輕輕轉一下脖子：先往一邊歪、再往另一邊
    const shrug = fade * bump(u, 0, 0.2, 0.3, 0.5), turn = fade * Math.sin(TAU * clamp01((u - 0.45) / 0.55)) * bump(u, 0.45, 0.6, 0.9, 1);
    add(out.rot.leftShoulder, 0, 0, 0.16 * shrug);
    add(out.rot.rightShoulder, 0, 0, -0.16 * shrug);
    add(out.rot.leftUpperArm, 0, 0, 0.04 * shrug);
    add(out.rot.rightUpperArm, 0, 0, -0.04 * shrug);
    add(out.rot.neck, 0, 0.1 * turn, 0.1 * turn);
    add(out.rot.head, -0.03 * turn, 0.1 * turn, 0.08 * turn);
  }
}

// ---- 走路 ----
// 步伐相位 0 ~ 1 走完左右各一步；0 是左腳踩在身體正下方、右腳在半空中經過它旁邊的時刻，0.5 左右相反
const STANCE = 0.55;    // 一個步伐週期裡，腳掌著地的比例（兩腳同時著地的時間短短重疊）
const LIFT = 0.07;      // 擺動腳抬起的高度
const TOE_UP = 0.25;    // 腳跟著地時腳尖翹起的角度
const HEEL_UP = 0.4;    // 離地前腳跟抬起的角度
const SLACK = 0.993;    // 著地腳最多伸到 T 字站姿長度的多少，膝蓋不鎖死
const MAX_SLIP = 0.12;  // 著地腳最多離開原本該踩的位置多遠；原地轉身時超過就跟著拖過去，腿不會扭過頭
const MAX_TWIST = 0.6;  // 著地腳的方向最多和身體差多少
const RISE = 0.8;       // 踩上比較高的地面時，身體往上抬的最快速度（公尺／秒）
const NUDGE = 0.1;      // 落腳點最多前後挪多遠，讓整個腳掌踩在同一個平面上；腳掌約 0.19 公尺長，挪一半就夠
const LEVEL = 0.03;     // 高低差在這以內當成同一個平面，像門檻與地墊
const TOE_OUT = 0.12;   // 腳尖各往外轉的角度（約 7°），待機與走路一樣、跑步減半，站姿才不內八
const WIDTH = 0.02;     // 兩腳的腳踝各往外多少，站寬一點

// 跑步：兩腳之間有騰空的時間，擺動腳的腳跟往屁股收；跑走之間依少女行為的跑步權重內插
const RUN_STANCE = 0.36;   // 腳掌著地的比例，比一半少，所以有騰空
const RUN_LIFT = 0.17;     // 擺動腳抬起的高度
const RUN_TOE_UP = 0.1;    // 落地時腳尖翹起的角度，比走路平
const RUN_HEEL_UP = 0.6;   // 蹬地時腳跟抬起的角度
const RUN_DROP = 0.05;     // 著地腳在正下方時，膝蓋彎曲讓髖部壓低多少
const LEAN = 0.32;         // 上半身前傾的角度
const dutyOf = run => STANCE + (RUN_STANCE - STANCE) * run;   // 依跑步權重內插的著地比例

/**
 * 從模型量一次腿的尺寸，算髖部高度時重複使用：
 * leg 腿伸直的長度、side 與 back 是 T 字站姿時腳踝在髖關節左右與前後多遠、rest 是髖關節在腳踝上方多高
 */
function measureLegs(body) {
  restAnkle(body, 1, _ankle);
  return {
    leg: _w.copy(body.thigh).add(body.shin).length(),
    side: _ankle.x - body.hip.x, back: _ankle.z - body.hip.z, rest: body.hip.y - _ankle.y,
  };
}

/**
 * 著地腳伸直時，髖部的高度（相對 T 字站姿）：在它正上方是 high，在剛著地、腳還在前方時是 low
 * duty 是著地比例，著地時腳踝在髖關節前方 duty · stride / 2
 */
function legHeights(legs, stride, duty, slack) {
  const { side, back, rest } = legs, leg = legs.leg * slack, reach = duty * stride / 2;
  return {
    high: Math.sqrt(leg ** 2 - side ** 2 - back ** 2) - rest,
    low: Math.sqrt(Math.max(0, leg ** 2 - side ** 2 - (back + reach) ** 2)) - rest,
  };
}

/** 走路時髖部的高度：著地腳在正下方時最高，兩腳前後張開時壓低到腳踩得到地 */
function gaitHeight(phase, stride, duty, legs, slack = SLACK) {
  const { high, low } = legHeights(legs, stride, duty, slack);
  return high - (high - low) * (1 - Math.cos(2 * TAU * phase)) / 2;
}

/** 跑步時髖部的高度：著地腳在正下方時膝蓋彎著、壓得最低，騰空時最高，但不超過著地時腳踩得到地的高度 */
function runHeight(phase, stride, legs) {
  return legHeights(legs, stride, RUN_STANCE, SLACK).low - RUN_DROP * (1 + Math.cos(2 * TAU * phase)) / 2;
}

// 走路與跑步的上半身用同一套擺動，只差在係數：
//   duty 著地比例、sway 髖部移向著地腳、roll 著地那側髖部抬高、twist 跨出去那側髖部往前
//   pitch 各骨骼往前彎（正值前傾，脖子與頭為負時把頭抬回來看前方）、counter 胸口與頭反向扭轉的比例
//   swing 擺臂幅度 = 每公尺步幅的幅度 · stride + 固定幅度；back 手臂往後的偏移、out 手臂張開、elbow 手肘彎曲、elbowSwing 往前擺時手肘多彎
//   offset 與 turn 是補回站姿的上臂往前與前臂轉動（跑步用，跑步的樣子沿用原本的數值）
//   hand 手形；lag 是手腕與四指跟著擺臂慢半拍晃動的比例 [手腕, 四指]
const WALK_STYLE = {
  duty: STANCE, sway: 0.022, roll: 0.04, twist: 0.08,
  pitch: { hips: 0.03, spine: 0.01, chest: 0, neck: -0.02, head: -0.02 },
  counter: { spine: 0.5, chest: 0.5, upperChest: 0.4, neck: 0.2, head: 0.2 },
  swing: [0.24, 0], back: 0, out: 0, elbow: 0.1, elbowSwing: 1.2, offset: 0, turn: 0,
  hand: LOOSE, lag: [0.35, 0.22],
};
const RUN_STYLE = {
  duty: RUN_STANCE, sway: 0.015, roll: 0.03, twist: 0.1,
  pitch: { hips: 0.4 * LEAN, spine: 0.35 * LEAN, chest: 0.25 * LEAN, neck: -0.5 * LEAN, head: -0.4 * LEAN },
  counter: { spine: 0.7, chest: 0.6, upperChest: 0.5, neck: 0.3, head: 0.3 },
  swing: [0, 0.62], back: 0.12, out: ARM_DOWN - 1.08, elbow: 1.35 + OLD_ARM.elbow - ELBOW, elbowSwing: 0.3, offset: ARM_FORWARD, turn: -FOREARM_TURN,
  hand: FIST, lag: [0.12, 0],
};
// 手腕與四指比擺臂慢多少（步伐週期的比例）
const WRIST_DELAY = 0.08, FINGER_DELAY = 0.14;
const handSway = { sway: 0 };

/**
 * 走路或跑步的上半身與髖部：髖部左右起伏與扭轉、胸口反向扭轉、頭轉回正前方、手臂與對側腿同步擺動
 * phase 是步伐相位，stride 是一個週期前進的公尺數，height 是這一刻髖部的高度
 */
function gaitPose(style, phase, stride, height, out) {
  stance(out);
  const lead = Math.cos(TAU * (phase + style.duty / 2));   // 1：左腳跨在最前面、右腳在最後面
  out.hips[0] = style.sway * Math.cos(TAU * phase);
  out.hips[1] = height;
  const roll = style.roll * Math.cos(TAU * phase), twist = -style.twist * lead, { pitch, counter } = style;
  add(out.rot.hips, pitch.hips, twist, roll);
  // 胸口反向扭轉，頭轉回正前方；抵銷骨盆的側傾
  add(out.rot.spine, pitch.spine, -counter.spine * twist, -0.6 * roll);
  add(out.rot.chest, pitch.chest, -counter.chest * twist, -0.3 * roll);
  add(out.rot.upperChest, 0, -counter.upperChest * twist, 0);
  add(out.rot.neck, pitch.neck, counter.neck * twist, 0);
  add(out.rot.head, pitch.head, counter.head * twist, -0.1 * roll);
  // 手臂與對側腿同步：左腳在前時左手在後；往前擺時手肘多彎一點
  // 手腕與四指像被甩著一樣慢半拍：手臂擺到後面時，手還在往後晃
  const amp = style.swing[0] * stride + style.swing[1];
  const lagged = delay => amp * Math.cos(TAU * (phase + style.duty / 2 - delay));
  for (const [s, k] of SIDES) {
    const back = amp * k * lead + style.back;   // 正值往後
    add(out.rot[s + 'UpperArm'], back + style.offset, 0, style.out * k);
    add(out.rot[s + 'LowerArm'], k * style.turn, -k * (style.elbow + style.elbowSwing * Math.max(0, -back)), 0);
    // 手腕沒有乘 k：右手骨骼的 y 軸與左手相反，lagged 本身不帶左右的正負，直接用就和擺臂同向
    add(out.rot[s + 'Hand'], 0, style.lag[0] * lagged(WRIST_DELAY), 0);
    handSway.sway = -style.lag[1] * k * lagged(FINGER_DELAY);
    shapeHand(out, s, k, style.hand, handSway);
  }
  return out;
}

/** 走路的上半身與髖部 */
export const walkPose = (phase, stride, legs, out) => gaitPose(WALK_STYLE, phase, stride, gaitHeight(phase, stride, STANCE, legs), out);

/** 跑步的上半身與髖部：上半身前傾、髖部在著地時壓低、手肘彎成直角大幅擺臂、胸口扭轉得比走路多 */
export const runPose = (phase, stride, legs, out) => gaitPose(RUN_STYLE, phase, stride, runHeight(phase, stride, legs), out);

// ---- 拿傘 ----
// 傘握在右手：收起時右臂自然下垂、手肘彎著，傘尖朝下；撐開時右臂把傘舉到身體右前方，傘面在頭上偏右
// 只有右臂（上臂、前臂、手腕、手指）受影響，其餘的步態照舊；兩種姿勢之間依傘的張開程度內插
// 各骨骼的 [x, y, z]，用右臂的座標（右手骨骼的 y、z 與左手相反，見檔頭）
// 兩種姿勢都是讓手腕只要小角度修正就能對準傘柄（grip.js）：用試算找出手落在適當的位置、手腕修正最小的一組
const HOLD_CLOSED = { rightUpperArm: [-0.25, 0.12, 1.35], rightLowerArm: [-0.8, 1.1, 0], rightHand: [0, 0, 0] };
const HOLD_OPEN = { rightUpperArm: [-0.2, 0.27, 1.4], rightLowerArm: [-0.45, 1.65, 0], rightHand: [0, 0, 0] };
const KEEP_SWING = 0.4;      // 收起時還保留多少步態的擺臂
const UMBRELLA_UP = -0.4;    // 撐開時傘尖往後仰多少，傘面才罩在頭上
const UMBRELLA_RUN = 0.55;   // 跑步時傘往前多傾多少
const UMBRELLA_LEFT = 0.12;   // 撐開時傘往左（頭的方向）傾多少

function holdUmbrella(out, state, t) {
  const { umbrella: open, weights, phase } = state, e = smooth(open);
  // 收起時右臂還保留一部分步態的姿勢（含站姿）；站姿改了，這裡把右臂補回原本的站姿，收起的右臂才不變；跑步自己已經補回
  const old = 1 - weights.run;
  out.rot.rightUpperArm[0] -= old * (OLD_ARM.forward - ARM_FORWARD);
  out.rot.rightUpperArm[2] += old * (OLD_ARM.down - ARM_DOWN);
  out.rot.rightLowerArm[1] += old * (OLD_ARM.elbow - ELBOW);
  const swing = out.rot.rightUpperArm[0];
  const keep = KEEP_SWING + (0 - KEEP_SWING) * e;
  for (const b of Object.keys(HOLD_CLOSED)) for (let i = 0; i < 3; i++) {
    const hold = HOLD_CLOSED[b][i] + (HOLD_OPEN[b][i] - HOLD_CLOSED[b][i]) * e;
    out.rot[b][i] = out.rot[b][i] * keep + hold * (1 - keep);
  }
  shapeHand(out, 'right', -1, GRIP, { sway: 0 });
  // 傘的朝向：收起時像單擺掛在手上，跟著擺臂前後晃；撐開時跟著步伐輕輕左右搖、跑步時往前傾
  const u = out.umbrella;
  u.open = e;
  const hang = Math.PI - 0.5 * swing, held = UMBRELLA_UP + UMBRELLA_RUN * weights.run + 0.02 * Math.sin(TAU * 2 * phase) * (weights.walk + weights.run) + 0.015 * drift(t, 31);
  u.pitch = hang + (held - hang) * e;
  u.roll = e * (UMBRELLA_LEFT + 0.04 * Math.cos(TAU * phase) * (weights.walk + weights.run) + 0.015 * drift(t, 32));
}

// ---- 換腳站 ----
// 承重的腳換邊後，另一隻腳（原本承重的那隻）在動作的 30% ~ 72% 抬起、挪一小步、放下，之後就站在新的位置，下次換腳再挪回來
// 每次挪到哪裡由動作的編號決定：往外 −2 ~ 7 公分、前後 −7 ~ 6 公分，都在原本站的位置附近，不會越挪越遠
const STEP_FROM = 0.3, STEP_TO = 0.72, STEP_LIFT = 0.04;

function idleStep(st, side, k, state, walking, dt) {
  const a = state.action, free = state.weightOn === 'left' ? 'right' : 'left';
  let upGoal = 0;
  if (walking) { st.off.fill(0); st.up = 0; st.seq = -1; return st; }   // 走起來之後，下次停下是併攏的站姿
  if (a.kind === 'shift' && side === free) {
    const u = a.t / a.length;
    if (st.seq !== a.seq && u >= STEP_FROM) {
      st.seq = a.seq;
      st.from[0] = st.off[0]; st.from[1] = st.off[1];
      st.to[0] = k * (-0.02 + 0.09 * hash(a.seq, k, 5)); st.to[1] = -0.07 + 0.13 * hash(a.seq, k, 6);
    }
    if (st.seq === a.seq) {
      const p = clamp01((u - STEP_FROM) / (STEP_TO - STEP_FROM)), e = smooth(p);
      for (let i = 0; i < 2; i++) st.off[i] = st.from[i] + (st.to[i] - st.from[i]) * e;
      upGoal = STEP_LIFT * Math.sin(Math.PI * p);
    }
  }
  st.up += (upGoal - st.up) * (1 - Math.exp(-dt / 0.05));   // 動作被打斷時，抬著的腳也是很快放下
  return st;
}

// ---- 少女的姿勢產生器 ----
const _pivot = new Vector3(), _turned = new Vector3(), _land = new Vector3();

/**
 * 每位少女一個：記住著地的腳踩在地面上的哪裡，身體轉向時腳不會跟著在地上打轉
 * ground(x, z) 回傳世界座標 (x, z) 的地面高度
 * 回傳的函式依少女行為的狀態組出整個姿勢：上半身與髖部依混合權重疊加待機與走路，腿依步伐相位踩出腳的位置
 */
export function createGirlPoser(body, ground = () => 0) {
  const idle = createPose(), walk = createPose(), run = createPose(), legs = measureLegs(body), look = createLook();
  const feet = Object.fromEntries(SIDES.map(([s]) => [s, {
    down: false, x: 0, z: 0, yaw: 0, dx: 0, dz: 0, dyaw: null,   // dyaw 是落地時相對身體的方向，還沒落地過是 null（出場時兩腳直接站著，方向就是外轉的站姿）
    y: 0, from: null, shift: null, nudge: 0,                 // 著地處與離地處的地面高度、落腳處要挪與已經挪了多少
    u: null, swing: 0,                                       // 上一格的相位、擺動進行到哪裡
    ankle: new Vector3(), pitch: 0, turn: 0, height: 0,      // 這一格的腳踝位置、前後傾、水平轉與腳下的地面高度
    step: { off: [0, 0], from: [0, 0], to: [0, 0], seq: -1, up: 0 },   // 換腳站：腳挪到哪裡（相對原本站的位置）、這一步從哪裡到哪裡、是哪一個動作、抬多高
  }]));
  let bodyY = null;
  const weight = { x: 0, v: 0, ready: false }, mood = { bias: 0, kind: 'none', u: 0, fade: 0 };

  // 依步伐相位決定兩腳腳踝的位置，再用 IK 解出腿的角度；髖部要先寫進 out
  // lift 0 ~ 1 是抬腳與腳掌前後傾的程度，停著時為 0，兩腳平踩在地上
  function placeFeet(out, state, lift, dt) {
    const { phase, stride, facing } = state;
    // 走路與跑步的步態依跑步權重內插：著地比例、抬腳高度、腳掌前後傾，以及擺動腳最高點提早多少
    const r = state.weights.run, mix = (a, b) => a + (b - a) * r;
    const duty = dutyOf(r), height = mix(LIFT, RUN_LIFT), toeUp = mix(TOE_UP, RUN_TOE_UP), heelUp = mix(HEEL_UP, RUN_HEEL_UP);
    const early = mix(1, 0.6);
    const turnOut = 1 - 0.5 * r;   // 腳尖外轉的比例：跑步減半
    const c = Math.cos(facing), sn = Math.sin(facing);
    const worldX = v => state.x + c * v.x + sn * v.z, worldZ = v => state.z - sn * v.x + c * v.z;
    const groundAt = (lx, lz) => ground(state.x + c * lx + sn * lz, state.z - sn * lx + c * lz);
    // 腳踝在少女座標 (lx, lz)、腳掌往前挪 d、水平轉 yaw 時，腳跟、腳踝與鞋尖底下的地面，最低與最高各多高
    let lo, hi;
    const sole = (lx, lz, yaw, d = 0) => {
      const sx = Math.sin(yaw), sz = Math.cos(yaw);
      const a = groundAt(lx + sx * (d + body.heel.z), lz + sz * (d + body.heel.z));
      const b = groundAt(lx + sx * d, lz + sz * d);
      const t = groundAt(lx + sx * (d + body.tip.z), lz + sz * (d + body.tip.z));
      lo = Math.min(a, b, t); hi = Math.max(a, b, t);
      return hi;
    };
    // 落腳處：前後挪最少的距離，讓整個腳掌踩在同一個平面上，鞋尖不會頂進台階，腳跟也不會懸空；回傳挪多遠，高度留在 hi
    const footing = (lx, lz, yaw) => {
      for (let i = 0; i <= NUDGE * 100; i++) for (const d of i ? [i / 100, -i / 100] : [0]) {
        sole(lx, lz, yaw, d);
        if (hi - lo <= LEVEL) return d;
      }
      sole(lx, lz, yaw);
      return 0;
    };
    const reach = duty * stride / 2;
    for (const [s, k] of SIDES) {
      const foot = feet[s];
      const u = (phase + duty / 2 + (k > 0 ? 0 : 0.5)) % 1;   // 這隻腳從腳跟著地起算的相位
      // 擺動中的腳要等這一步擺完、相位繞回 0 才著地；跑走切換時著地比例變大，也不會在半空中被當成踩下去
      const wrapped = foot.u !== null && u < foot.u - 0.5;
      const standing = foot.down ? u < duty : u < duty && (wrapped || foot.u === null);
      foot.u = u;
      let z, up = 0, pitch, settle = 0, p;
      if (standing) {
        // 著地：腳踝跟著身體等速往後，腳跟著地時腳尖翹起、離地前腳跟抬起
        p = u / duty;
        z = reach * (1 - 2 * p);
        pitch = p < 0.2 ? -toeUp * (1 - p / 0.2) : p > 0.65 ? heelUp * (p - 0.65) / 0.35 : 0;
      } else {
        // 擺動：腳在地面上的位置從後方平滑移到前方，起落時對地速度為零；減去身體同時前進的距離就是相對髖部的位置
        // 擺動只會往前進行，著地比例變了也不會倒回去
        p = foot.swing = Math.min(1, Math.max(foot.down ? 0 : foot.swing, (u - duty) / (1 - duty)));
        const e = smooth(p);
        z = -reach + stride * e - (1 - duty) * stride * p;
        up = height * Math.sin(Math.PI * p ** early);
        pitch = heelUp + (-toeUp - heelUp) * e;
        settle = 1 - e;
      }
      pitch *= lift;
      restAnkle(body, k, _ankle).add(_v.set(k * WIDTH, up * lift, z));
      const toe = k * TOE_OUT * turnOut;   // 這隻腳著地時相對身體的方向：腳尖往外

      let yaw;
      if (standing) {
        // 著地的腳鎖在地面上：剛著地時記下世界座標，之後換回少女自己的座標
        if (!foot.down) {
          // 擺動時已經挪向落腳處了，照那個距離踩下去，腳才不會在著地那一格跳一下
          foot.down = true;
          foot.nudge = foot.shift ?? footing(_ankle.x, _ankle.z, toe);
          _land.copy(_ankle).z += foot.nudge;
          foot.x = worldX(_land);
          foot.z = worldZ(_land);
          foot.yaw = facing + toe;
          foot.y = sole(_land.x, _land.z, toe);
        }
        const wx = foot.x - state.x, wz = foot.z - state.z;
        foot.dx = c * wx - sn * wz - _ankle.x;
        foot.dz = sn * wx + c * wz - _ankle.z;
        foot.dyaw = wrapAngle(foot.yaw - facing);
        // 離開該踩的位置太遠、或和身體方向差太多時跟著拖過去；落腳時刻意挪的距離不算
        const slip = Math.hypot(foot.dx, foot.dz - foot.nudge);
        if (slip > MAX_SLIP) {
          foot.dx *= MAX_SLIP / slip; foot.dz = foot.nudge + (foot.dz - foot.nudge) * MAX_SLIP / slip;
          _land.set(_ankle.x + foot.dx, 0, _ankle.z + foot.dz);
          foot.x = worldX(_land);
          foot.z = worldZ(_land);
          foot.y = sole(_land.x, _land.z, foot.dyaw);
        }
        if (Math.abs(foot.dyaw - toe) > MAX_TWIST) {
          foot.dyaw = toe + Math.sign(foot.dyaw - toe) * MAX_TWIST;
          foot.yaw = facing + foot.dyaw;
        }
        _ankle.x += foot.dx; _ankle.z += foot.dz;
        yaw = foot.dyaw;
        foot.height = foot.y;
      } else {
        // 擺動：從離地時的位置與方向平滑回到該踩的地方；預計的落腳處要前後挪的話，一路慢慢挪過去
        // 落腳前身體還會再往前走一段，落腳處以那時的身體位置來算
        if (foot.down) { foot.down = false; foot.from = foot.y; }
        restAnkle(body, k, _land).add(_v.set(k * WIDTH, 0, reach + (1 - duty) * stride * (1 - p)));
        foot.shift = footing(_land.x, _land.z, toe) * lift;
        const land = sole(_land.x, _land.z, toe, foot.shift);
        _ankle.x += foot.dx * settle; _ankle.z += foot.dz * settle + foot.shift * (1 - settle);
        yaw = toe + ((foot.dyaw ?? toe) - toe) * settle;   // 離地處的方向平滑轉到落地時的外轉
        // 腳下的地面高度從離地處換到落腳處：往上踩時在前半段就抬到高處、往下踩時到後半段才放低，鞋尖不會勾到台階的邊
        const flat = sole(_ankle.x, _ankle.z, yaw);
        const from = foot.from ?? flat;
        const rise = land > from ? smooth(Math.min(1, 2 * p)) : smooth(Math.max(0, 2 * p - 1));
        foot.height = flat + (from + (land - from) * rise - flat) * lift;   // 停著時就踩在腳下的地面上
      }

      // 待機換腳站：不承重的腳抬起、挪一小步、放下；開始走路後隨著步態慢慢歸零
      const step = idleStep(foot.step, s, k, state, lift >= 1, dt), keep = 1 - lift;
      if (keep > 0 && (step.off[0] || step.off[1] || step.up > 1e-4)) {
        _ankle.x += step.off[0] * keep; _ankle.z += step.off[1] * keep; _ankle.y += step.up * keep;
        foot.height = sole(_ankle.x, _ankle.z, yaw);
      }

      // 腳跟抬起時以腳尖關節為支點，腳尖翹起時以腳跟為支點，支點留在原地
      if (pitch) {
        mirror(_pivot, pitch > 0 ? body.toe : body.heel, k);
        _turned.copy(_pivot).applyAxisAngle(X, pitch).applyAxisAngle(Y, yaw);
        _ankle.add(_pivot.applyAxisAngle(Y, yaw)).sub(_turned);
      }
      foot.ankle.copy(_ankle); foot.pitch = pitch; foot.turn = yaw;
    }

    // 身體站在兩腳中比較低的那一邊，腿才伸得到地面；往下馬上跟上，往上慢慢抬起
    const low = Math.min(feet.left.height, feet.right.height);
    bodyY = bodyY === null || low < bodyY ? low : Math.min(low, bodyY + RISE * dt);
    out.y = bodyY;
    for (const [s, k] of SIDES) {
      const foot = feet[s];
      foot.ankle.y += foot.height - bodyY;
      solveLeg(out, body, k, foot.ankle, foot.pitch, foot.turn);
    }
  }

  // 待機的心情：承重的腳平順地換邊；偶發動作被打斷時，姿勢在短時間內淡出，不會瞬間跳回去
  function moodOf({ weightOn, action }, dt) {
    const side = weightOn === 'left' ? 1 : -1;
    if (!weight.ready) { weight.ready = true; weight.x = side; }
    spring(weight, side, 3.5, dt);
    if (action.kind !== 'none') { mood.kind = action.kind; mood.u = action.t / action.length; }   // 被打斷後種類與進度留在最後那一格，淡出時用
    const goal = action.kind === 'none' ? 0 : 1;
    mood.fade += (goal - mood.fade) * (1 - Math.exp(-dt / (goal ? 0.05 : 0.12)));
    mood.bias = weight.x;
    return mood;
  }

  return function girlPose(state, t, dt, out) {
    const { phase, stride, weights } = state;
    out.hips.fill(0);
    for (const b of BONES) out.rot[b].fill(0);
    const mood = moodOf(state, dt);   // 走路時也要往前推進，被打斷的動作才會淡完
    if (weights.idle) blend(out, idlePose(t, body, idle, mood), weights.idle);
    if (weights.walk) blend(out, walkPose(phase, stride, legs, walk), weights.walk);
    if (weights.run) blend(out, runPose(phase, stride, legs, run), weights.run);
    // 兩腳張開著停下時，髖部也要低到腳踩得到地；著地比例跟著跑走混合，跑步騰空時才不會被壓低
    out.hips[1] = Math.min(out.hips[1], gaitHeight(phase, stride, dutyOf(weights.run), legs, 1));
    holdUmbrella(out, state, t);
    placeFeet(out, state, Math.min(1, 3 * (weights.walk + weights.run)), dt);
    look(state, out, dt);
    return out;
  };
}

function blend(out, p, w) {
  for (let i = 0; i < 3; i++) out.hips[i] += p.hips[i] * w;
  for (const b of BONES) for (let i = 0; i < 3; i++) out.rot[b][i] += p.rot[b][i] * w;
}

// 少女待機時的「心思」：眨眼、視線與偶發動作的計時，由少女行為每格推進
// 全部由狀態裡的亂數種子決定，相同的輸入一定得到相同的結果
// 這份模組只管計時與挑選，不碰骨骼與表情；姿勢與外觀讀少女行為回報的結果

const smooth = s => s * s * (3 - 2 * s);

/** 以 mulberry32 做的亂數產生器：rnd() 回傳 0 ~ 1 並往前推進，rnd.seed() 是現在的種子，下一格從它接著算 */
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.seed = () => s;
  return next;
}
export const between = (rnd, lo, hi) => lo + (hi - lo) * rnd();

// ---- 眨眼 ----
const BLINK_CLOSE = 0.07, BLINK_LENGTH = 0.2;   // 閉得快、睜得慢

/** 剛出場時的心思：第一次眨眼在一兩秒之後；站定幾秒後才開始第一個偶發動作 */
export function createMind(seed) {
  const rnd = rng(seed ^ 0x9e3779b9);   // 和每格的亂數不同源，第一次眨眼的時間才不會和第一格的亂數相關
  return { blinkNext: between(rnd, 1, 3), blinkSince: -1, still: 0, wait: between(rnd, 4, 9), last: 'none' };
}

/** 眼皮閉合的程度 0（張開）~ 1（閉上）；mind 是這一格的心思（可以直接改），soon 是想趁現在眨一下（視線大幅轉移時） */
export function stepBlink(mind, time, dt, rnd, soon = false) {
  if (mind.blinkSince >= 0) {
    mind.blinkSince += dt;
    if (mind.blinkSince >= BLINK_LENGTH) mind.blinkSince = -1;
  } else {
    if (soon && rnd() < 0.7) mind.blinkNext = Math.min(mind.blinkNext, time + between(rnd, 0.05, 0.15));
    if (time >= mind.blinkNext) {
      mind.blinkSince = 0;
      // 大約每 2 ~ 6 秒眨一次，偶爾緊接著再眨一下
      mind.blinkNext = time + (rnd() < 0.18 ? BLINK_LENGTH + between(rnd, 0.05, 0.15) : between(rnd, 2, 6));
    }
  }
  const u = mind.blinkSince;
  if (u < 0) return 0;
  return u < BLINK_CLOSE ? smooth(u / BLINK_CLOSE) : smooth(1 - (u - BLINK_CLOSE) / (BLINK_LENGTH - BLINK_CLOSE));
}

// ---- 視線 ----
// 視線是一個世界座標點，加上它是哪一種目標：焦點 focus、隨機方向 random、前方遠處 ahead（之後還有場景事件 event、天空 sky）
export const EYE_HEIGHT = 1.45;               // 眼睛離腳下的地面多高
export const VIEW_YAW = 70 * Math.PI / 180;   // 少女看得到的水平範圍：面向左右各多少，頭轉約 60°、再加眼球轉 12°
const VIEW_UP = 55 * Math.PI / 180, VIEW_DOWN = 30 * Math.PI / 180;
const AHEAD = 12;                             // 走路、跑步時看前方多遠（水平距離，公尺）
const AHEAD_DROP = 5 * Math.PI / 180;         // 看的點比眼睛低多少：往下約 5°，頭幾乎水平，眼睛只微微往下
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/** 從眼睛 (x, z, 腳下高度 y) 面向 facing 時，(px, py, pz) 在不在轉頭加轉眼看得到的範圍裡 */
export function canSee({ x, y, z, facing }, px, py, pz) {
  const dx = px - x, dz = pz - z, flat = Math.hypot(dx, dz);
  if (flat < 0.3) return false;
  const pitch = Math.atan2(py - (y + EYE_HEIGHT), flat);
  return Math.abs(wrap(Math.atan2(dx, dz) - facing)) <= VIEW_YAW && pitch <= VIEW_UP && pitch >= -VIEW_DOWN;
}

/** 看前方遠處、比眼睛略低的地方；出場時與走路、跑步時都是這個 */
export const createGaze = ({ x, y, z, facing }) => ({ x: x + Math.sin(facing) * AHEAD, y: y + EYE_HEIGHT - AHEAD * Math.tan(AHEAD_DROP), z: z + Math.cos(facing) * AHEAD, kind: 'ahead' });

const angleBetween = (a, b, from) => {
  const u = [a.x - from.x, a.y - from.y, a.z - from.z], v = [b.x - from.x, b.y - from.y, b.z - from.z];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...u) * Math.hypot(...v) || 1))));
};

/**
 * 這一格要看哪裡：走路與跑步時看前方遠處；待機時在店面的視線焦點與隨機方向之間轉移，每個目標停留的時間不固定
 * 場景事件發生在看得到的地方時，大約三分之一的機會轉過去看一下；events 是這一格的場景事件
 * 偶發動作是張望或抬頭看天時，視線由動作決定；做別的偶發動作時，不會被場景事件拉走
 * me 是少女這一格的位置、面向與是否在移動；mind 是這一格的心思（可以直接改）
 * 回傳 { gaze, big }：big 是這一格視線大幅轉移了
 */
export function stepGaze(prev, me, layout, events, action, mind, time, rnd) {
  const eye = { x: me.x, y: me.y + EYE_HEIGHT, z: me.z };
  let gaze = prev;
  const held = action.kind === 'look' || action.kind === 'sky';
  const react = me.moving || held || action.kind !== 'none' || prev.kind === 'event' ? null : reactTo(events, me, mind, time, rnd);   // 正在看事情時，不再被別的事情拉走
  if (me.moving) {
    gaze = createGaze(me);
    mind.gazeUntil = 0;
  } else if (held) {
    if (prev.kind !== action.kind) gaze = { ...action.at, kind: action.kind };
  } else if (react) {
    gaze = react;
  } else if (prev.kind === 'ahead' || prev.kind === 'look' || prev.kind === 'sky' || time >= mind.gazeUntil || !canSee(me, prev.x, prev.y, prev.z)) {
    gaze = pickGaze(prev, me, eye, layout, mind, time, rnd);
  }
  return { gaze, big: gaze !== prev && angleBetween(prev, gaze, eye) > 0.5 };
}

// 待機時挑下一個目標：多半是面前看得到的焦點，沒有時或偶爾看一個隨機的方向
function pickGaze(prev, me, eye, layout, mind, time, rnd) {
  const seen = layout.focus.filter(f => canSee(me, f.x, f.y, f.z) && !(prev.kind === 'focus' && f.x === prev.x && f.z === prev.z));
  if (seen.length && rnd() < 0.6) {
    const f = seen[Math.floor(rnd() * seen.length)];
    mind.gazeUntil = time + between(rnd, 2, 5);
    return { x: f.x, y: f.y, z: f.z, kind: 'focus' };
  }
  // 隨機的方向偏向正前方，距離約 6 公尺，略低於眼睛
  const yaw = me.facing + (rnd() + rnd() - 1) * VIEW_YAW * 0.8, pitch = between(rnd, -0.25, 0.12);
  mind.gazeUntil = time + between(rnd, 1, 3.5);
  const flat = 6 * Math.cos(pitch);
  return { x: me.x + Math.sin(yaw) * flat, y: eye.y + 6 * Math.sin(pitch), z: me.z + Math.cos(yaw) * flat, kind: 'random' };
}

// 看得到的場景事件，大約三分之一的機會把視線轉過去，沒有就回傳 null
const REACT = 1 / 3;
function reactTo(events, me, mind, time, rnd) {
  for (const e of events) {
    if (!canSee(me, e.x, e.y, e.z) || rnd() >= REACT) continue;
    mind.gazeUntil = time + between(rnd, 1.2, 2.5);
    return { x: e.x, y: e.y, z: e.z, kind: 'event' };
  }
  return null;
}

// ---- 偶發動作 ----
// 站定一段時間後開始，一次一個，兩次之間隔不固定的時間：換腳站、張望、抬頭看天、小伸展
// 抬頭看天只在下雨或下雪、而且人在露天時出現。開始走路時立即結束，平順收尾由姿勢負責
const LENGTH = { shift: [3.2, 4], look: [3.5, 5], sky: [3.5, 5], stretch: [2.8, 3.6] };   // 各動作做多久（秒）
const WEIGHT = { shift: 1.2, look: 1, sky: 1, stretch: 0.8 };   // 挑到的機會；和上一個一樣的動作機會減少
const WAIT_FIRST = [4, 9], WAIT_BETWEEN = [6, 16];              // 站定多久才做第一個、做完後隔多久做下一個

export const noAction = seq => ({ kind: 'none', t: 0, length: 0, seq });

/**
 * 這一格的偶發動作：回傳 { action, weightOn }
 * action 是 { kind, t 已經做了幾秒, length 一共做幾秒, seq 這是第幾個動作, at 張望或抬頭看的點 }；weightOn 是承重的腳，每次換腳站就換到另一隻
 * me 是少女這一格的位置、面向、是否在移動與所在區域；weather 是天氣
 */
export function stepAction(prev, weightOn, me, weather, mind, dt, rnd) {
  let action = prev;
  if (me.moving) {
    if (prev.kind !== 'none') mind.wait = between(rnd, ...WAIT_FIRST);
    mind.still = 0;
    return { action: prev.kind === 'none' ? prev : noAction(prev.seq), weightOn };
  }
  if (prev.kind !== 'none') {
    action = { ...prev, t: prev.t + dt };
    if (action.t >= action.length) {
      mind.still = 0;
      mind.wait = between(rnd, ...WAIT_BETWEEN);
      action = noAction(prev.seq);
    }
    return { action, weightOn };
  }
  mind.still += dt;
  if (mind.still < mind.wait) return { action, weightOn };
  // 開始一個新的偶發動作
  const sky = (weather === 'rain' || weather === 'snow') && me.zone === 'open';
  const kinds = Object.keys(LENGTH).filter(k => k !== 'sky' || sky);
  const weights = kinds.map(k => WEIGHT[k] * (k === mind.last ? 0.3 : 1));
  let pick = rnd() * weights.reduce((a, b) => a + b, 0), kind = kinds[0];
  for (let i = 0; i < kinds.length; i++) { pick -= weights[i]; if (pick <= 0) { kind = kinds[i]; break; } }
  mind.last = kind;
  action = { kind, t: 0, length: between(rnd, ...LENGTH[kind]), seq: prev.seq + 1 };
  if (kind === 'shift') weightOn = weightOn === 'left' ? 'right' : 'left';
  if (kind === 'look') action.at = awayPoint(me, (rnd() < 0.5 ? -1 : 1) * between(rnd, 0.6, 1.1), between(rnd, -0.1, 0.1));
  if (kind === 'sky') action.at = awayPoint(me, between(rnd, -0.3, 0.3), 0.85);
  return { action, weightOn };
}

// 從眼睛往面向偏 yaw、仰角 pitch 的方向 6 公尺處
function awayPoint({ x, y, z, facing }, yaw, pitch) {
  const flat = 6 * Math.cos(pitch);
  return { x: x + Math.sin(facing + yaw) * flat, y: y + EYE_HEIGHT + 6 * Math.sin(pitch), z: z + Math.cos(facing + yaw) * flat };
}

// 少女行為：不依賴 three.js 與畫面的純邏輯
// createGirlState() 建立出場時的狀態；updateGirl() 每格依輸入、場景資訊與經過時間算出下一格的狀態
//   狀態：位置 x、z 與地面高度 y、面向 facing、速度 speed、動作 motion 與混合權重 weights、
//         步伐相位 phase 與步幅 stride、所在區域 zone、自動門該不該打開 doorOpen
//         透明傘的張開程度 umbrella（0 收起、1 撐開）、上一個不在雨棚下的區域 lastZone（雨棚下的傘要開要收，看她是從哪裡來的）
//         站在感應區裡，或正朝門口走過來、門口就在前面幾公尺時，門該打開
//         時間 time、亂數種子 seed（每格往前推進）、眼皮閉合的程度 blink（0 張開、1 閉上）
//         視線 gaze：正在看的世界座標點 x、y、z，以及目標種類 kind（focus 店面的視線焦點、random 隨機方向、ahead 前方遠處、event 場景事件、look 張望、sky 天空）
//         偶發動作 action：{ kind none／shift 換腳站／look 張望／sky 抬頭看天／stretch 小伸展, t 已經做了幾秒, length 一共做幾秒, seq 第幾個, at 張望或抬頭看的點 }
//         承重的腳 weightOn：left 或 right，每次換腳站換到另一隻
//         心思 mind：眨眼與視線停留的計時，只給少女行為自己用
//   輸入 input：{ move: { x 右為正, y 前為正 }, run 是否按住 Shift, cameraYaw 相機看出去的水平方向 }
//   場景資訊 world：{ weather, layout, door, events }，layout 是店面配置，events 是這一格的場景事件，每一項 { kind, x, y, z } 是種類與世界座標，door 是自動門的門片滑開的比例（0 關著、1 全開）
// 面向與方向角都和場景相同：角度 a 的方向是 (sin a, cos a)，0 朝 +z
// 步伐相位 0 ~ 1 走完左右各一步；0 與 0.5 是兩腳併攏、一腳正好踩在身體正下方的時刻

import { groundAt, inside, outsideOf } from './layout.js';
import { rng, createMind, stepBlink, createGaze, stepGaze, stepAction, noAction } from './idle.js';

const WALK_SPEED = 1.2;   // 走路的速度（公尺／秒）
const RUN_SPEED = 3;      // 跑步的速度
const ACCEL = 3.5;        // 起步的加速度（公尺／秒²）
const DECEL = 5;          // 轉身時放慢的減速度
const STOP_DECEL = 8;     // 放開按鍵時最大的減速度
const STOP_EASE = 4;      // 放開按鍵後走到兩腳併攏處的減速度
const FINISH_SPEED = 0.6; // 放開時走得很慢，也用這個速度把這一步走完，不會拖著小碎步
const TURN_RATE = 8;      // 轉身的最大角速度（弧度／秒），轉半圈約 0.4 秒
// 一個步伐週期（左右腳各一步）前進的距離，跟著速度從走路的步幅加大到跑步的步幅
// 腿長約 0.77 公尺的少女，走路一步約 0.52 公尺，跑步一步約 0.95 公尺
const WALK_STRIDE = 1.05, RUN_STRIDE = 1.9;
// 開傘與收傘從頭到尾要花的時間（秒），期間走得比較慢（速度乘上這個係數）
const UMBRELLA_TIME = 0.8, UMBRELLA_PACE = 0.7;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const runAmount = v => clamp((v - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
const strideAt = v => WALK_STRIDE + (RUN_STRIDE - WALK_STRIDE) * runAmount(v);

// 區域：露天、雨棚下、店內
export const ZONE = { OPEN: 'open', CANOPY: 'canopy', STORE: 'store' };

function zoneAt(layout, x, z) {
  if (layout.store.some(r => inside(r, x, z))) return ZONE.STORE;
  if (layout.canopy.some(r => inside(r, x, z))) return ZONE.CANOPY;
  return ZONE.OPEN;
}

// 少女站在 (x, z) 時，腳下的地面高度、所在區域與門該不該打開
const surroundings = (layout, x, z) => ({ y: groundAt(layout, x, z), zone: zoneAt(layout, x, z), doorOpen: inside(layout.door.sensor, x, z) });

// 傘該撐開（1）還是收起（0）：晴天一律收起；雨雪天在露天撐開、在店內收起，
// 雨棚下看她從哪裡來：從露天來是要進店，先收起；從店內來是要出門，先撐開
function umbrellaGoal(weather, zone, lastZone) {
  if (weather !== 'rain' && weather !== 'snow') return 0;
  if (zone === ZONE.CANOPY) return lastZone === ZONE.STORE ? 1 : 0;
  return zone === ZONE.OPEN ? 1 : 0;
}

const toward = (v, to, step) => v < to ? Math.min(to, v + step) : Math.max(to, v - step);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

export function createGirlState(world) {
  const { x, z, facing } = world.layout.spawn;
  const seed = world.seed ?? 1;
  const here = surroundings(world.layout, x, z), lastZone = here.zone === ZONE.CANOPY ? ZONE.OPEN : here.zone;
  return {
    x, z, facing, speed: 0, ...motionOf(0), phase: 0, stride: strideAt(0), ...here, lastZone, umbrella: umbrellaGoal(world.weather, here.zone, lastZone),
    time: 0, seed, blink: 0, action: noAction(0), weightOn: 'left', gaze: createGaze({ x, y: groundAt(world.layout, x, z), z, facing }), mind: createMind(seed),
  };
}

// 動作與混合權重：權重跟著速度變，待機、走路、跑步之間自然平滑過渡
function motionOf(speed) {
  const moving = Math.min(1, speed / WALK_SPEED), run = runAmount(speed);
  return { motion: speed === 0 ? 'idle' : run > 0.5 ? 'run' : 'walk', weights: { idle: 1 - moving, walk: moving - run, run } };
}

export function updateGirl(s, input, world, dt) {
  const next = move(s, input, world, dt);
  return { ...next, ...stepUmbrella(s, next, world, dt), ...think(s, next, world, dt) };
}

// 每格的傘：記下上一個不在雨棚下的區域，張開程度朝目標以固定的速率移動，所以做到一半掉頭會從當下的程度反過來
function stepUmbrella(s, next, world, dt) {
  const lastZone = next.zone === ZONE.CANOPY ? s.lastZone : next.zone;
  const goal = umbrellaGoal(world.weather, next.zone, lastZone);
  return { lastZone, umbrella: toward(s.umbrella, goal, dt / UMBRELLA_TIME) };
}

// 每格的心思：時間往前、亂數往前推進、眨眼
function think(s, next, world, dt) {
  const rnd = rng(s.seed), mind = { ...s.mind }, time = s.time + dt;
  rnd();
  const me = { ...next, moving: next.speed > 0 };
  const { action, weightOn } = stepAction(s.action, s.weightOn, me, world.weather, mind, dt, rnd);
  const { gaze, big } = stepGaze(s.gaze, me, world.layout, world.events ?? [], action, mind, time, rnd);
  const blink = stepBlink(mind, time, dt, rnd, big);   // 視線大幅轉移時比較容易眨眼
  return { time, seed: rnd.seed(), blink, gaze, action, weightOn, mind };
}

// 每格的移動：依輸入與場景資訊算出位置、面向、速度與步伐
function move(s, input, world, dt) {
  let { facing, phase } = s, target, left = Infinity, heading = facing;   // left：到停下處還要走多少步伐相位
  const { x: mx, y: my } = input.move;
  let steering = !!(mx || my);
  const space = spaceOf(world), stride = strideAt(s.speed);
  if (steering) {
    // 方向鍵依相機的水平朝向轉成世界方向：前是 (sin, cos)，右是 (-cos, sin)
    const sin = Math.sin(input.cameraYaw), cos = Math.cos(input.cameraYaw);
    const want = heading = Math.atan2(sin * my - cos * mx, cos * my + sin * mx);
    let top = input.run ? RUN_SPEED : WALK_SPEED;
    const slow = s.umbrella > 0 && s.umbrella < 1 ? UMBRELLA_PACE : 1;   // 開傘或收傘的時候腳步放慢一點
    // 往那個方向不遠處就走不過去時，先放慢成走路，停在擋住之前最後一個兩腳併攏處
    // 往前看的距離依想要的速度算，放慢之後也不會縮短，才不會一放慢就看不到障礙物、又加速起來
    // 路程換成步伐相位時用現在的步幅：接下來只會放慢、步幅只會變小，估得保守，停下處不會超過擋住的地方
    const room = roomAhead(space, s.x, s.z, want, lookahead(Math.max(s.speed, top)));
    if (room < Infinity) {
      top = WALK_SPEED;
      left = lastStopWithin(phase, (room - GAP) / stride);
    }
    // 跑得太快、來不及在那裡停下也算走不到，像跑步時轉向一個很近的東西
    if (left !== null && phaseToStop(s.speed, DECEL) > left + s.speed * dt / stride) left = null;
    if (left === null && s.speed > 0) {
      // 連一個兩腳併攏處都走不到：先照原本的方向把這一步走完、停下，再轉過去
      steering = false;
    } else {
      left ??= 0;   // 站在跨步的半途、前面又走不過去，就留在原地
      const { steer, open } = probe(space, s.x, s.z, want);
      const diff = wrapAngle(steer - facing);
      facing = wrapAngle(facing + Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff)));
      // 還沒轉過來時先放慢，掉頭時幾乎原地轉身，不會倒退或橫著走
      target = top * slow * open * Math.max(0, Math.cos(wrapAngle(steer - facing)));
    }
  }
  if (!steering) {
    // 放開按鍵：停在來得及停下的下一個兩腳併攏處；前面被擋住就停在擋住之前的併攏處，一個都沒有只好停在擋住的地方
    left = nextStop(s.speed, phase, stride, dt);
    const reach = (roomAhead(space, s.x, s.z, facing, lookahead(s.speed)) - GAP) / stride;
    if (reach < left) left = lastStopWithin(phase, reach) ?? Math.max(0, reach);
    target = Math.max(s.speed, FINISH_SPEED);   // 走得太慢就用這個速度把這一步走完
  }
  // 跟著「剛好在停下處停住」的速度曲線：太快就減速
  if (left < Infinity) target = Math.min(target, speedToStopWithin(left));
  let speed = toward(s.speed, target, (target > s.speed ? ACCEL : steering ? DECEL : STOP_DECEL) * dt);
  let step = (s.speed + speed) / 2 * dt, pace = strideAt((s.speed + speed) / 2);
  if (step >= left * pace) { step = left * pace; speed = 0; }   // 這一格就走到了

  const { x, z } = moveBody(space, s.x, s.z, Math.sin(facing) * step, Math.cos(facing) * step);
  // 被擋住時，實際走多快就算多快；放開按鍵後撞上東西就停在那裡，不會貼著它慢慢蠕動
  const walked = Math.hypot(x - s.x, z - s.z);
  if (walked < step - 1e-9) speed = !steering && walked < step / 2 ? 0 : Math.min(speed, walked / dt);
  // 步伐相位依自己走出的距離推進，著地的腳對地面就不會滑動；被門片推開的距離不算
  phase = (phase + Math.min(walked, step) / pace) % 1;
  // 停在兩腳併攏處時消掉浮點誤差
  const together = Math.round(phase * 2) / 2;
  if (s.speed > 0 && speed === 0 && Math.abs(phase - together) < 0.01) phase = together % 1;
  const here = surroundings(world.layout, x, z);
  // 朝門口走過來時提早要求開門：看得比停下的規劃再遠一點，門開好之前她就不必為了門放慢
  if (!here.doorOpen && (mx || my || speed > 0)) {
    const reach = lookahead(input.run ? RUN_SPEED : Math.max(speed, WALK_SPEED)) + DOOR_AHEAD;
    here.doorOpen = crosses(doorway(world.layout.door), x, z, Math.sin(heading) * reach, Math.cos(heading) * reach);
  }
  return { x, z, facing, speed, ...motionOf(speed), phase, stride: strideAt(speed), ...here };
}

// ---- 自動門 ----
const DOOR_AHEAD = 1.5;   // 比停下的規劃多看多遠：門要約 0.3 秒才開出一個身體寬，跑步時約一公尺

// 門口：兩片門片關著時佔的範圍，左右各加上身體的半徑
const doorway = ({ leaves, z: [z0, z1] }) => [Math.min(...leaves.map(l => l.x[0])) - RADIUS, z0, Math.max(...leaves.map(l => l.x[1])) + RADIUS, z1];

// 從 (x, z) 出發的線段 (dx, dz) 有沒有穿過矩形
function crosses([x0, z0, x1, z1], x, z, dx, dz) {
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[x, dx, x0, x1], [z, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return false; continue; }
    const a = (lo - p) / d, b = (hi - p) / d;
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    if (t0 > t1) return false;
  }
  return true;
}

// ---- 停下的規劃：以步伐相位計算，跑步減速時步幅跟著變小，也能剛好停在兩腳併攏處 ----

// 往前看多遠：以 v 的速度煞得住，還能再多走一步
const lookahead = v => v * v / (2 * STOP_EASE) + strideAt(v);

// 從速度 v 以減速度 a 等減速停下，步伐相位會前進多少
// 步幅在走路速度以下固定，走路到跑步之間隨速度線性變大：S(u) = c + b·u，∫ u / (a·S(u)) du 有封閉解
const SLOPE = (RUN_STRIDE - WALK_STRIDE) / (RUN_SPEED - WALK_SPEED), BASE = WALK_STRIDE - WALK_SPEED * SLOPE;
const ramp = u => { const w = BASE + SLOPE * u; return w - BASE * Math.log(w); };
function phaseToStop(v, a) {
  const walk = Math.min(v, WALK_SPEED), run = Math.min(v, RUN_SPEED);
  let phi = walk * walk / (2 * a * WALK_STRIDE);
  if (v > WALK_SPEED) phi += (ramp(run) - ramp(WALK_SPEED)) / (a * SLOPE * SLOPE);
  if (v > RUN_SPEED) phi += (v * v - RUN_SPEED * RUN_SPEED) / (2 * a * RUN_STRIDE);
  return phi;
}

// 還要走 left 步伐相位就得停下時，現在最快能走多快：以 STOP_EASE 等減速剛好停在那裡
// 走路速度以下有封閉解，走路到跑步之間用二分法反推
const WALK_BRAKE = phaseToStop(WALK_SPEED, STOP_EASE), RUN_BRAKE = phaseToStop(RUN_SPEED, STOP_EASE);
function speedToStopWithin(left) {
  if (left <= WALK_BRAKE) return Math.sqrt(2 * STOP_EASE * WALK_STRIDE * left);
  if (left >= RUN_BRAKE) return Infinity;
  let lo = WALK_SPEED, hi = RUN_SPEED;
  for (let i = 0; i < 20; i++) { const v = (lo + hi) / 2; if (phaseToStop(v, STOP_EASE) <= left) lo = v; else hi = v; }
  return lo;
}

// 放開按鍵時停在哪裡：來得及停下的下一個兩腳併攏處，回傳還要走多少步伐相位；離得太近來不及停就再多走一步
// 走路時可以停得很乾脆；跑步時煞得緩一點，多跑一兩步才停
function nextStop(v, phase, stride, dt) {
  if (v <= 0) return 0;
  const need = phaseToStop(v, STOP_DECEL + (STOP_EASE - STOP_DECEL) * runAmount(v)) - v * dt / stride;   // 容許一格的誤差，接近終點時才不會被判成來不及
  let left = 0.5 - phase % 0.5;
  if (left < need) left += Math.ceil((need - left) / 0.5) * 0.5;
  return left;
}

// 前面最多還能走 reach 步伐相位時，最遠能停在哪個兩腳併攏處，回傳還要走多少步伐相位
// 正站在併攏處、前面又走不過去就是 0，一個都走不到是 null
// 擋住的地方要先扣掉 GAP，停下處和它留一點空隙，靠近牆時才不會先被當成撞上
const GAP = 0.05;
function lastStopWithin(phase, reach) {
  const past = phase % 0.5;   // 離上一個併攏處已經走了多少相位
  const left = Math.floor((reach + past) / 0.5) * 0.5 - past;
  if (left > 1e-9) return left;
  return past < 1e-9 ? 0 : null;
}

// ---- 碰撞：把少女當成半徑 RADIUS 的圓柱 ----
const RADIUS = 0.2;
const STEP = RADIUS / 2;   // 每一小步不超過半徑的一半，身體中心就不會一步跨過薄薄的玻璃

// 可走範圍以外的地方當成一公尺厚的牆，和障礙物一起推，電線桿和邊界之間太窄的縫才不會被擠過去；同一份可走範圍只算一次
const fencesOf = new WeakMap();
const fencesAround = walkable => fencesOf.get(walkable) ?? fencesOf.set(walkable, outsideOf(walkable)).get(walkable);

// 這一格擋路的方框：店面配置的障礙物、可走範圍以外的牆，加上自動門兩片門片目前的位置
// 門片跟著門滑開的程度移動，門口開得比少女的身體寬之前，門那一段一直擋著
function spaceOf(world) {
  const { obstacles, walkable, door } = world.layout, open = world.door ?? 0, [d0, d1] = door.z, fences = fencesAround(walkable);
  const leaves = door.leaves.map(({ x: [a, b], slide }) => [a + slide * open, d0, b + slide * open, d1]);
  return { obstacles, fences, leaves };
}

// 從 (x, z) 走一小步 (dx, dz)：被擋住就停在邊上
const stepBody = (space, x, z, dx, dz) => pushOut(space, x + dx, z + dz);

// 移動 (dx, dz)，分成幾小步走
function moveBody(space, x, z, dx, dz) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / STEP));
  for (let i = 0; i < n; i++) ({ x, z } = stepBody(space, x, z, dx / n, dz / n));
  return { x, z };
}

// 往想走的方向 want 試走一小段，看走得通的方向 steer 與走得通的比例 open
// 斜著貼上牆時，steer 是沿著牆的方向、open 隨角度變小；幾乎正面撞上時 open 是 0，少女面向牆停下
const PROBE = 0.15;
function probe(space, x, z, want) {
  const p = moveBody(space, x, z, Math.sin(want) * PROBE, Math.cos(want) * PROBE);
  const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
  if (d < 0.2 * PROBE) return { steer: want, open: 0 };
  return { steer: Math.atan2(dx, dz), open: Math.min(1, d / PROBE) };
}

// 往 want 方向一路試走 far 公尺，回傳被擋住之前走得到的路程；貼著牆滑得過去不算被擋住，一路走得通就是 Infinity
function roomAhead(space, x, z, want, far) {
  const dx = Math.sin(want) * STEP, dz = Math.cos(want) * STEP;
  let room = 0;
  for (let tried = 0; tried < far; tried += STEP) {
    const p = stepBody(space, x, z, dx, dz), moved = Math.hypot(p.x - x, p.z - z);
    if (moved < 0.2 * STEP) return room;
    room += moved; x = p.x; z = p.z;
  }
  return Infinity;
}

// 從每個撞進去的障礙物推出來；只推掉撞進去的那個方向，斜著撞上時沿著邊的那個方向照樣前進
function pushOut(space, x, z) {
  for (let pass = 0; pass < 4; pass++) {
    let hit = false;
    for (const blocks of [space.obstacles, space.fences, space.leaves]) for (const [x0, z0, x1, z1] of blocks) {
      const dx = x - clamp(x, x0, x1), dz = z - clamp(z, z0, z1), d = Math.hypot(dx, dz);
      if (d >= RADIUS) continue;
      hit = true;
      if (d > 0) {
        x += dx / d * (RADIUS - d); z += dz / d * (RADIUS - d);
      } else {
        // 中心已經在方框裡：從最近的那一邊出去
        const exits = [[x0 - RADIUS, z], [x1 + RADIUS, z], [x, z0 - RADIUS], [x, z1 + RADIUS]];
        [x, z] = exits.reduce((a, b) => Math.hypot(a[0] - x, a[1] - z) <= Math.hypot(b[0] - x, b[1] - z) ? a : b);
      }
    }
    if (!hit) break;
  }
  return { x, z };
}

// 少女行為的測試：只透過建立初始狀態與每格更新兩個函式，使用真實的店面配置
import { test, expect } from 'bun:test';
import { createGirlState, updateGirl } from './behavior.js';
import { KONBINI } from './layout.js';
import { VIEW_YAW } from './idle.js';

const world = { weather: 'rain', layout: KONBINI };
const FRAME = 1 / 60;

// 方向鍵：x 是右（D）為正，y 是前（W）為正；run 是按住 Shift
const W = { x: 0, y: 1 }, WD = { x: 1, y: 1 }, WA = { x: -1, y: 1 }, NONE = { x: 0, y: 0 };
const running = move => ({ ...move, run: true });
// 相機的水平朝向：相機看出去的方向是 (sin, cos)
const LOOK_NORTH = Math.PI, LOOK_EAST = Math.PI / 2, LOOK_SOUTH = 0;   // 看向 -z、+x、+z（大馬路）

// 玩家按住按鍵一段時間
function hold(state, move, cameraYaw, seconds, w = world) {
  const input = { move: { x: move.x, y: move.y }, run: !!move.run, cameraYaw };
  for (let t = 0; t < seconds - 1e-9; t += FRAME) state = updateGirl(state, input, w, FRAME);
  return state;
}

function heading(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
  return { x: dx / len, z: dz / len };
}

test('少女出場時站在露天', () => {
  expect(createGirlState(world).zone).toBe('open');
});

test('按 W 往相機看出去的方向走，相機轉向後同一個 W 會往別的方向走', () => {
  const start = createGirlState(world);
  const north = heading(start, hold(start, W, LOOK_NORTH, 2));
  const east = heading(start, hold(start, W, LOOK_EAST, 2));
  expect(north.z).toBeLessThan(-0.9);
  expect(east.x).toBeGreaterThan(0.9);
});

// 走穩之後，再走一秒移動的距離
function steadyPace(move) {
  const walking = hold(createGirlState(world), move, LOOK_NORTH, 2);
  const later = hold(walking, move, LOOK_NORTH, 1);
  return Math.hypot(later.x - walking.x, later.z - walking.z);
}

test('斜著走和直著走一樣快', () => {
  expect(steadyPace(WD) / steadyPace(W)).toBeCloseTo(1, 2);
});

// 從別的地方出發：店面配置只換掉出場位置
const standAt = (x, z, facing = Math.PI) => createGirlState({ ...world, layout: { ...KONBINI, spawn: { x, z, facing } } });

test('朝店面的玻璃牆一直走，會被擋在牆外', () => {
  const pushed = hold(standAt(-2, 1.8), W, LOOK_NORTH, 3);
  expect(pushed.zone).toBe('canopy');
  expect(pushed.z).toBeGreaterThan(1);   // 玻璃牆的外側在 z = 1
});

// 步伐相位 0 與 0.5 是兩腳併攏的時刻
const feetTogether = s => Math.min(s.phase % 0.5, 0.5 - s.phase % 0.5) < 1e-6;

test('朝牆走過去停下時兩腳併攏，不會停在跨步的半途', () => {
  for (const z of [1.8, 1.95, 2.1, 2.25, 2.4]) {
    const stopped = hold(standAt(-2, z), W, LOOK_NORTH, 3);
    const released = hold(stopped, NONE, LOOK_NORTH, 1);
    expect([stopped.speed, feetTogether(stopped), feetTogether(released)]).toEqual([0, true, true]);
  }
});

test('斜著撞上玻璃牆，會沿著牆滑開', () => {
  const start = standAt(-1.5, 1.3);
  const slid = hold(start, WA, LOOK_NORTH, 2);
  expect(slid.z).toBeGreaterThan(1);
  expect(start.x - slid.x).toBeGreaterThan(1);   // 沿著牆往左走了一公尺以上
});

// 可走範圍由兩個相接的矩形組成的 L 形場地（遠離店面，避開自動門）：西邊一塊 x -4 ~ 0、z 10 ~ 14，東邊一塊 x 0 ~ 8、z 10 ~ 12；沒有障礙物
const LSHAPE = { ...KONBINI, walkable: [[-4, 10, 0, 14], [0, 10, 8, 12]], obstacles: [] };
const standInL = (x, z, facing) => createGirlState({ ...world, layout: { ...LSHAPE, spawn: { x, z, facing } } });
const inL = { ...world, layout: LSHAPE };

test('可走範圍由相接的矩形組成時，能從一個矩形走進另一個，交接處不會卡住', () => {
  const crossed = hold(standInL(-2, 11, Math.PI / 2), W, LOOK_EAST, 9, inL);
  expect(crossed.x).toBeGreaterThan(7);   // 走到東邊那塊的盡頭，停在牆前
  expect(crossed.z).toBeCloseTo(11, 1);
});

test('可走範圍的聯集外的角落走不進去，貼著邊斜著走也能滑過交接處', () => {
  // 東邊那塊的北側（z > 12）不在範圍內：朝那裡走會被擋在邊緣
  const blocked = hold(standInL(4, 11, 0), W, LOOK_SOUTH, 3, inL);
  expect(blocked.z).toBeLessThanOrEqual(12 + 1e-6);
  expect(blocked.z).toBeGreaterThan(11.5);
  // 從西邊那塊斜著往東南走：先貼著南緣滑，再滑進東邊那塊，不會卡在交接處
  const slid = hold(standInL(-3, 13, 0), WD, LOOK_NORTH, 12, inL);
  expect(slid.x).toBeGreaterThan(5);
  expect(slid.z).toBeGreaterThanOrEqual(10);
});

// 地面的邊緣在 ±13.9；少女的身體半徑 0.2，兩腳併攏的停下處再留一點空隙
const EDGE = 13.9;

test('朝大馬路一直走，會越過路緣走上大馬路，最後停在地面邊緣前', () => {
  // 從出場處一路往南：先踩上人行道與大馬路之間的路緣，再走到大馬路上
  const list = frames(createGirlState(world), W, LOOK_SOUTH, 4);
  expect(list.some(s => s.y === 0.1)).toBe(true);   // 路緣
  expect(list.at(-1).z).toBeGreaterThan(7.62);       // 路緣的外側在 z = 7.62
  // 從斑馬線一直走到底：停在地面邊緣前，不越過邊緣
  const reached = hold(standAt(4.6, 6.45, 0), W, LOOK_SOUTH, 12);
  const later = hold(reached, W, LOOK_SOUTH, 1);
  expect(reached.z).toBeGreaterThan(EDGE - 0.8);
  expect(reached.z).toBeLessThan(EDGE - 0.2);
  expect(later.z).toBeCloseTo(reached.z, 6);
});

test('沿著大馬路往兩側一直走，都停在地面的邊緣前', () => {
  const east = hold(standAt(0, 10, Math.PI / 2), W, LOOK_EAST, 25);
  const west = hold(standAt(0, 10, -Math.PI / 2), W, LOOK_NORTH + LOOK_EAST, 25);   // 相機看向 -x
  expect(east.x).toBeGreaterThan(EDGE - 0.8);
  expect(east.x).toBeLessThan(EDGE - 0.2);
  expect(west.x).toBeLessThan(-EDGE + 0.8);
  expect(west.x).toBeGreaterThan(-EDGE + 0.2);
});

test('踩在路緣上時腳下的地面是路緣的高度，車道與人行道一樣高，斑馬線處沒有路緣', () => {
  const on = (x, z) => standAt(x, z).y;
  expect(on(0, 7.55)).toBe(0.1);                          // 店前人行道的路緣
  expect(on(0, 13.25)).toBe(0.1);                         // 對面的路緣
  expect(on(0, 6.8)).toBe(on(0, 10));                     // 人行道與車道一樣高
  expect(on(0, 13.6)).toBe(on(0, 10));                    // 對面的人行道也是
  expect(on(4.9, 7.55)).toBe(on(0, 10));                  // 斑馬線處沒有路緣
  expect(on(4.9, 13.25)).toBe(on(0, 10));
});

test('走過斑馬線時腳下的地面一樣平，沒有多餘的起伏', () => {
  const list = frames(standAt(4.9, 6.45, 0), W, LOOK_SOUTH, 5);
  expect(new Set(list.map(s => s.y))).toEqual(new Set([0]));
});

test('朝大馬路對面的號誌桿與ガードレール走，會被擋住並沿邊滑開', () => {
  // 號誌桿在 (6.6, 13.62)
  const pole = hold(standAt(6.6, 10, 0), W, LOOK_SOUTH, 6);
  expect(pole.z).toBeLessThan(13.52 - 0.2 + 1e-6);
  // 斜著走向ガードレール（z = 13.42，x 從 7.8 開始）：沿著它往東滑
  const start = standAt(9, 11, 0), rail = hold(start, WA, LOOK_SOUTH, 6);
  expect(rail.z).toBeLessThan(13.34 - 0.2 + 1e-6);
  expect(rail.x - start.x).toBeGreaterThan(1.5);
});

test('在大馬路上與對面的人行道，都是露天', () => {
  expect(standAt(0, 10).zone).toBe('open');
  expect(standAt(5, 13.5).zone).toBe('open');
});

test('在大馬路上，透明傘照常撐開', () => {
  const walked = hold(createGirlState(world), W, LOOK_SOUTH, 6);
  expect(walked.z).toBeGreaterThan(7.7);
  expect(walked.umbrella).toBe(1);
});

// 朝 -x 看過去的相機
const LOOK_WEST = LOOK_NORTH + LOOK_EAST;

test('朝側街的護欄走，會被擋在護欄前', () => {
  // 人行道上的護欄在 x = 7.55，z -5.4 ~ 1.8 一段沒有缺口
  const reached = hold(standAt(5.5, -3, Math.PI / 2), W, LOOK_EAST, 5);
  const later = hold(reached, W, LOOK_EAST, 1);
  expect(later.x).toBeLessThan(7.5 - 0.2 + 1e-6);
  expect(later.x).toBeCloseTo(reached.x, 6);
});

test('從轉角的斑馬線一帶可以走到側街上，也能走到側街對面的人行道，碰到圍牆停下', () => {
  const crossed = hold(standAt(6.2, 4.6, Math.PI / 2), W, LOOK_EAST, 10);
  expect(crossed.x).toBeGreaterThan(12.7);          // 過了側街，到了對面的人行道
  expect(crossed.x).toBeLessThan(13.58 - 0.2);      // 對面的圍牆與牆頭的植栽從 x = 13.58 開始
});

test('從護欄的缺口走出去，會踩過側街的路緣', () => {
  // 店前這側的護欄到 z = 1.8 為止，路緣在 x 7.68 ~ 7.82
  const list = frames(standAt(6, 3.2, Math.PI / 2), W, LOOK_EAST, 3);
  expect(list.some(s => s.y === 0.1)).toBe(true);
  expect(list.at(-1).x).toBeGreaterThan(7.82);
});

test('沿著側街往北一直走，停在地面的邊緣前', () => {
  const reached = hold(standAt(10, 5.5, Math.PI), W, LOOK_NORTH, 25);
  const later = hold(reached, W, LOOK_NORTH, 1);
  expect(reached.z).toBeLessThan(-EDGE + 0.8);
  expect(reached.z).toBeGreaterThan(-EDGE + 0.2);
  expect(later.z).toBeCloseTo(reached.z, 6);
});

test('側街對面的設施會擋住她：號誌桿與圍牆', () => {
  const pole = hold(standAt(13.1, 4, 0), W, LOOK_SOUTH, 6);   // 號誌桿在 (13.1, 6.95)
  expect(pole.z).toBeLessThan(6.83 - 0.2 + 1e-6);
});

test('西邊的小巷與北邊的民宅依然進不去', () => {
  const alley = hold(standAt(-5, 6.6, -Math.PI / 2), W, LOOK_WEST, 4);
  expect(alley.x).toBeGreaterThan(-6.2 + 0.2 - 1e-6);
  const house = hold(standAt(2.2, -6.5, Math.PI), W, LOOK_NORTH, 4);
  expect(house.z).toBeGreaterThan(-7.72 + 0.2 - 1e-6);
  // 從大馬路朝巷口走：人行道在路緣以北，不開放
  const mouth = hold(standAt(-7.4, 10, Math.PI), W, LOOK_NORTH, 5);
  expect(mouth.z).toBeGreaterThan(7.48 + 0.2 - 1e-6);
});

test('在側街上是露天', () => {
  expect(standAt(10, 0).zone).toBe('open');
  expect(standAt(13, -8).zone).toBe('open');
});

test('走到自動門前會要求開門，走遠之後不再要求', () => {
  const start = createGirlState(world);
  const atDoor = hold(start, W, LOOK_NORTH, 4);
  const away = hold(atDoor, W, LOOK_SOUTH, 4);
  expect([start.doorOpen, atDoor.doorOpen, away.doorOpen]).toEqual([false, true, false]);
});

test('跑向自動門時，離門口還有好幾公尺就要求開門', () => {
  const list = frames(createGirlState(world), running(W), LOOK_NORTH, 2);
  const first = list.find(s => s.doorOpen);
  expect(first.z).toBeGreaterThan(4);   // 門口在 z = 1
});

test('站在店內咖啡機前待著，不會讓自動門一直開著', () => {
  expect(standAt(3, -0.6).doorOpen).toBe(false);
});

// 自動門的門片滑開的比例：0 關著，1 全開
test('自動門只開一條縫時被門擋住，門打開後可以走進店內', () => {
  const ajar = hold(createGirlState(world), W, LOOK_NORTH, 7, { ...world, door: 0.15 });
  const open = hold(createGirlState(world), W, LOOK_NORTH, 7, { ...world, door: 1 });
  expect([ajar.zone, open.zone]).toEqual(['canopy', 'store']);
});

test('店內的地面比露天高', () => {
  const outside = createGirlState(world);
  const inside = hold(outside, W, LOOK_NORTH, 7, { ...world, door: 1 });
  expect(inside.zone).toBe('store');
  expect(inside.y).toBeGreaterThan(outside.y);
});

// 沿著店前的人行道往東走，穩定之後再走一秒移動的距離；這一段有十幾公尺沒有東西擋路
function paceAlongSidewalk(move) {
  const settled = hold(standAt(-5.5, 6.6), move, LOOK_EAST, 1.5);
  const later = hold(settled, move, LOOK_EAST, 1);
  return Math.hypot(later.x - settled.x, later.z - settled.z);
}

test('按住 Shift 跑步，穩定之後明顯比走路快', () => {
  expect(paceAlongSidewalk(running(W))).toBeGreaterThan(paceAlongSidewalk(W) * 1.5);
});

test('跑步中放開 Shift 會回到走路的速度', () => {
  const ran = hold(standAt(-5.5, 6.6), running(W), LOOK_EAST, 1.5);
  const walking = hold(ran, W, LOOK_EAST, 1.5);
  const later = hold(walking, W, LOOK_EAST, 1);
  expect([ran.motion, walking.motion]).toEqual(['run', 'walk']);
  expect(Math.hypot(later.x - walking.x, later.z - walking.z)).toBeCloseTo(paceAlongSidewalk(W), 2);
});

test('跑步中放開所有按鍵會停下，兩腳併攏回到待機', () => {
  const ran = hold(standAt(-5.5, 6.6), running(W), LOOK_EAST, 1.5);
  const stopped = hold(ran, NONE, LOOK_EAST, 1.5);
  expect([stopped.speed, stopped.motion, feetTogether(stopped)]).toEqual([0, 'idle', true]);
});

// 每格的狀態，用來檢查整段過程
function frames(state, move, cameraYaw, seconds, w = world) {
  const input = { move: { x: move.x, y: move.y }, run: !!move.run, cameraYaw }, list = [];
  for (let t = 0; t < seconds - 1e-9; t += FRAME) list.push(state = updateGirl(state, input, w, FRAME));
  return list;
}

test('跑向收銀台時一路減速，在前面兩腳併攏停下', () => {
  const list = frames(standAt(2.2, 0.6), running(W), LOOK_NORTH, 3, { ...world, door: 1 });
  const peak = list.reduce((m, s, i) => s.speed > list[m].speed ? i : m, 0);
  const after = list.slice(peak).map(s => s.speed);
  const last = list.at(-1);
  expect(after.every((v, i) => i === 0 || v <= after[i - 1] + 1e-9)).toBe(true);   // 開始減速後不會再加速
  expect([last.speed, feetTogether(last)]).toEqual([0, true]);
  expect(last.z).toBeGreaterThan(-1.52);   // 收銀台的邊在 z = -1.72，少女身體半徑 0.2
  expect(last.z).toBeLessThan(-0.9);       // 不會離收銀台還遠就停下
});

test('站在收銀台前不遠處，按住 Shift 也能再往前走一步', () => {
  const start = standAt(2.2, -0.85);
  const moved = hold(start, running(W), LOOK_NORTH, 2);
  expect(start.z - moved.z).toBeGreaterThan(0.4);
  expect(moved.z).toBeGreaterThan(-1.52);
});

test('放開按鍵時撞上東西就停下，不會貼著它慢慢蠕動', () => {
  const ran = hold(standAt(-5.5, 4.7), running(W), LOOK_NORTH, 0.9);
  const released = hold(ran, NONE, LOOK_NORTH, 1.5);
  const later = hold(released, NONE, LOOK_NORTH, 1);
  expect(released.speed).toBe(0);
  expect([later.x, later.z]).toEqual([released.x, released.z]);
});

test('只按 Shift 不按方向鍵時不會移動', () => {
  const start = createGirlState(world);
  const later = hold(start, running(NONE), LOOK_NORTH, 2);
  expect([later.x, later.z, later.motion]).toEqual([start.x, start.z, 'idle']);
});

test('放開按鍵後停下來，回到待機', () => {
  const walking = hold(createGirlState(world), W, LOOK_NORTH, 2);
  expect(walking.motion).toBe('walk');
  const released = hold(walking, NONE, LOOK_NORTH, 1.5);
  const later = hold(released, NONE, LOOK_NORTH, 0.5);
  expect(released.speed).toBe(0);
  expect(released.motion).toBe('idle');
  expect([later.x, later.z]).toEqual([released.x, released.z]);
});

// ---- 臉：眨眼 ----
// 眼皮閉合的程度超過一半算一次眨眼，回傳每次眨眼開始的時間，以及眨眼時少女的動作
function blinksOf(list) {
  const found = [];
  list.forEach((s, i) => { if (s.blink > 0.5 && !(list[i - 1]?.blink > 0.5)) found.push({ at: i * FRAME, motion: s.motion }); });
  return found;
}
const stillFor = (state, seconds, w = world) => frames(state, NONE, LOOK_NORTH, seconds, w);

test('待機一分鐘內眨眼好幾次，間隔不全相同', () => {
  const blinks = blinksOf(stillFor(createGirlState(world), 60));
  const gaps = blinks.slice(1).map((b, i) => b.at - blinks[i].at);
  expect(blinks.length).toBeGreaterThanOrEqual(5);
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.3);
});

test('走路與跑步時也會眨眼', () => {
  // 沿著人行道來回走，一次走不完這麼久
  for (const move of [W, running(W)]) {
    let state = standAt(-5.5, 6.6), list = [];
    for (let i = 0; i < 4; i++) {
      const east = frames(state, move, LOOK_EAST, 5), west = frames(east.at(-1), move, -LOOK_EAST, 5);
      list.push(...east, ...west);
      state = west.at(-1);
    }
    const moving = blinksOf(list).filter(b => b.motion !== 'idle');
    expect(moving.length).toBeGreaterThanOrEqual(3);
  }
});

test('相同的起始狀態與輸入，得到完全相同的結果', () => {
  const run = () => {
    let s = createGirlState(world);
    return [...stillFor(s, 20), ...frames(s, W, LOOK_NORTH, 3)].map(x => JSON.stringify(x));
  };
  expect(run()).toEqual(run());
});

test('起始的亂數種子不同，眨眼的時間也不同', () => {
  const at = seed => blinksOf(stillFor(createGirlState({ ...world, seed }), 30)).map(b => b.at.toFixed(2)).join();
  expect(at(1)).not.toBe(at(2));
});

// ---- 視線 ----
const gazeYaw = s => Math.atan2(s.gaze.x - s.x, s.gaze.z - s.z) - s.facing;
const wrapped = a => Math.atan2(Math.sin(a), Math.cos(a));
const faceStore = () => standAt(2.2, 4, Math.PI);   // 站在店門前的露天處、面向店面，視線焦點大多在面前
const spot = g => [g.x, g.y, g.z].map(v => v.toFixed(2)).join();

test('待機時視線在不同目標之間轉移，不會一直盯同一處', () => {
  const list = stillFor(faceStore(), 90);
  const targets = new Set(list.map(s => spot(s.gaze)));
  expect(targets.size).toBeGreaterThanOrEqual(5);
  expect(new Set(list.map(s => s.gaze.kind)).size).toBeGreaterThanOrEqual(2);
});

test('待機時看的目標都在面前，轉頭加轉眼看得到的範圍內，不看身後', () => {
  const list = stillFor(faceStore(), 120).filter(s => s.gaze.kind === 'focus' || s.gaze.kind === 'random');
  expect(list.some(s => s.gaze.kind === 'focus')).toBe(true);
  for (const s of list) expect(Math.abs(wrapped(gazeYaw(s)))).toBeLessThanOrEqual(VIEW_YAW + 1e-6);
});

test('站在店前露天面向馬路時，不會去看身後的招牌', () => {
  for (const s of stillFor(createGirlState(world), 120)) if (s.gaze.kind === 'focus') expect(Math.abs(wrapped(gazeYaw(s)))).toBeLessThanOrEqual(VIEW_YAW + 1e-6);
});

test('走路與跑步時視線看前方遠處，略低於眼睛，不是腳前方的路面', () => {
  for (const move of [W, running(W)]) {
    const list = frames(standAt(-5.5, 6.6), move, LOOK_EAST, 3).filter(s => s.motion !== 'idle');
    expect(list.length).toBeGreaterThan(60);
    for (const s of list) {
      expect(s.gaze.kind).toBe('ahead');
      expect(Math.abs(wrapped(gazeYaw(s)))).toBeLessThan(0.05);
      const far = Math.hypot(s.gaze.x - s.x, s.gaze.z - s.z), drop = s.y + 1.45 - s.gaze.y;   // 離眼睛的水平距離與往下多少
      expect(far).toBeGreaterThanOrEqual(10);
      expect(far).toBeLessThanOrEqual(15);
      expect(drop).toBeGreaterThan(0);                     // 略低於眼睛
      expect(Math.atan2(drop, far)).toBeLessThan(0.12);    // 往下不到 7°，不是盯著腳前面
    }
  }
});

test('從待機開始走路，視線目標一出發就在前方遠處；停下回到待機後視線照原本的方式轉移', () => {
  const start = standAt(-5.5, 6.6);
  const walking = hold(start, W, LOOK_EAST, 1);
  expect(walking.gaze.kind).toBe('ahead');
  const later = frames(hold(walking, NONE, LOOK_EAST, 2), NONE, LOOK_EAST, 40);
  expect(new Set(later.map(s => s.gaze.kind)).size).toBeGreaterThanOrEqual(2);
  expect(later.some(s => s.gaze.kind !== 'ahead')).toBe(true);
});

test('視線大幅轉移時比較容易眨眼', () => {
  // 每次視線的目標換掉、轉動超過約 30°，之後 0.3 秒內眨眼的比例，比隨便一個 0.3 秒內眨眼的比例高
  const list = stillFor(faceStore(), 600);
  let shifts = 0, blinked = 0, windows = 0, blinkedAny = 0;
  list.forEach((s, i) => {
    const before = list[i - 1];
    if (before && spot(before.gaze) !== spot(s.gaze) && Math.abs(wrapped(gazeYaw(s) - gazeYaw(before))) > 0.5) {
      shifts++;
      if (list.slice(i, i + 18).some(x => x.blink > 0.5)) blinked++;
    }
    if (i % 18 === 0) { windows++; if (list.slice(i, i + 18).some(x => x.blink > 0.5)) blinkedAny++; }
  });
  expect(shifts).toBeGreaterThan(10);
  expect(blinked / shifts).toBeGreaterThan(blinkedAny / windows);
});

// ---- 場景事件 ----
// 每隔 gap 秒發生一次事件，回傳少女有幾次轉頭去看
function reactions(start, event, count, gap = 6) {
  let state = start, looked = 0;
  for (let i = 0; i < count; i++) {
    let saw = false;
    for (let f = 0; f < gap * 60; f++) {
      state = updateGirl(state, { move: NONE, run: false, cameraYaw: LOOK_NORTH }, { ...world, events: f === 0 ? [event] : [] }, FRAME);
      if (state.gaze.kind === 'event' && Math.hypot(state.gaze.x - event.x, state.gaze.z - event.z) < 0.01) saw = true;
    }
    if (saw) looked++;
  }
  return looked;
}
const DOOR_OPENS = { kind: 'doorOpen', x: 2.2, y: 1.4, z: 1.1 };

test('場景事件發生在看得到的地方時，有時會轉頭去看，但不是每次都看', () => {
  const looked = reactions(faceStore(), DOOR_OPENS, 40);
  expect(looked).toBeGreaterThan(5);
  expect(looked).toBeLessThan(35);
});

test('場景事件發生在身後時不會去看', () => {
  expect(reactions(faceStore(), { kind: 'signFlicker', x: 2.2, y: 3, z: 12 }, 40)).toBe(0);
});

// ---- 待機的偶發動作 ----
// 站著不動，回傳每個偶發動作開始的時間與種類
function actionsOf(list) {
  const found = [];
  list.forEach((s, i) => { if (s.action.kind !== 'none' && s.action.seq !== list[i - 1]?.action.seq) found.push({ at: i * FRAME, kind: s.action.kind, weightOn: s.weightOn }); });
  return found;
}
const kindsOf = list => new Set(actionsOf(list).map(a => a.kind));
const SNOWY = { ...world, weather: 'snow' }, SUNNY = { ...world, weather: 'clear' };
const inStore = () => standAt(-2.5, -0.2);

test('待機一段時間內會出現換腳站與張望', () => {
  const kinds = kindsOf(stillFor(faceStore(), 240));
  expect(kinds.has('shift')).toBe(true);
  expect(kinds.has('look')).toBe(true);
});

test('下雨或下雪、人在露天時，待機會抬頭看天', () => {
  for (const w of [world, SNOWY]) expect(kindsOf(stillFor(faceStore(), 600, w)).has('sky')).toBe(true);
});

test('晴天或在店內時，不會抬頭看天', () => {
  expect(inStore().zone).toBe('store');
  expect(kindsOf(stillFor(faceStore(), 600, SUNNY)).has('sky')).toBe(false);
  expect(kindsOf(stillFor(inStore(), 600, world)).has('sky')).toBe(false);
  expect(kindsOf(stillFor(inStore(), 600, world)).size).toBeGreaterThan(0);   // 在店內照樣有別的偶發動作
});

test('偶發動作站定一段時間後才開始，一次一個，兩次之間隔不固定', () => {
  const list = stillFor(faceStore(), 300), starts = actionsOf(list);
  expect(starts.length).toBeGreaterThanOrEqual(8);
  expect(starts[0].at).toBeGreaterThan(3);
  const gaps = starts.slice(1).map((a, i) => a.at - starts[i].at);
  expect(Math.min(...gaps)).toBeGreaterThan(5);
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(2);
  // 一次只做一個：每一格最多一個動作，動作的 seq 只增不減
  expect(list.every((s, i) => i === 0 || s.action.seq >= list[i - 1].action.seq)).toBe(true);
});

test('每次換腳站，承重的腳換到另一隻', () => {
  const shifts = actionsOf(stillFor(faceStore(), 600)).filter(a => a.kind === 'shift');
  expect(shifts.length).toBeGreaterThanOrEqual(4);
  shifts.slice(1).forEach((a, i) => expect(a.weightOn).not.toBe(shifts[i].weightOn));
});

test('開始走路時，偶發動作立即結束', () => {
  for (const kind of ['shift', 'look', 'sky', 'stretch']) {
    let state = faceStore();
    for (let i = 0; i < 60 * 600 && state.action.kind !== kind; i++) state = updateGirl(state, { move: NONE, run: false, cameraYaw: LOOK_NORTH }, world, FRAME);
    expect(state.action.kind).toBe(kind);
    expect(updateGirl(state, { move: W, run: false, cameraYaw: LOOK_NORTH }, world, FRAME).action.kind).toBe('none');
  }
});

test('張望時視線轉向旁邊，抬頭看天時視線往上，做完後回到平常', () => {
  const list = stillFor(faceStore(), 600);
  const looking = list.filter(s => s.action.kind === 'look'), sky = list.filter(s => s.action.kind === 'sky');
  expect(looking.every(s => s.gaze.kind === 'look' && Math.abs(wrapped(gazeYaw(s))) > 0.5)).toBe(true);
  expect(sky.every(s => s.gaze.kind === 'sky' && s.gaze.y > s.y + 3)).toBe(true);
  expect(list.filter(s => s.action.kind === 'none').every(s => s.gaze.kind !== 'look' && s.gaze.kind !== 'sky')).toBe(true);
});

// ---- 透明傘 ----
const OPEN_DOOR = { ...world, door: 1 };
const FULL_STEP = FRAME / 0.8;   // 傘一格最多張開或合攏多少：0.8 秒走完全程

test('雨天與雪天出場時傘是撐開的，晴天是收起的', () => {
  const umbrellas = ['rain', 'snow', 'clear'].map(weather => createGirlState({ ...world, weather }).umbrella);
  expect(umbrellas).toEqual([1, 1, 0]);
});

test('從露天走進店內：進了雨棚下傘開始收，到店內時已經收起', () => {
  const list = frames(createGirlState(world), W, LOOK_NORTH, 8, OPEN_DOOR);
  const canopy = list.findIndex(s => s.zone === 'canopy'), store = list.findIndex(s => s.zone === 'store');
  expect(canopy).toBeGreaterThan(0);
  expect(list.slice(0, canopy).every(s => s.umbrella === 1)).toBe(true);   // 在露天一直撐著
  expect(list[canopy + 6].umbrella).toBeLessThan(1);                       // 進了雨棚下就開始收
  expect(list[store].umbrella).toBe(0);
});

test('從店內走出到露天：進了雨棚下傘開始開，到露天時已經撐開', () => {
  const start = standAt(2.2, -0.4);
  expect(start.umbrella).toBe(0);
  const list = frames(start, W, LOOK_SOUTH, 8, OPEN_DOOR);
  const canopy = list.findIndex(s => s.zone === 'canopy'), open = list.findIndex(s => s.zone === 'open');
  expect(list.slice(0, canopy).every(s => s.umbrella === 0)).toBe(true);   // 在店內一直收著
  expect(list[canopy + 6].umbrella).toBeGreaterThan(0);                    // 進了雨棚下就開始開
  expect(list[open].umbrella).toBe(1);
});

test('收傘到一半掉頭走回露天，傘從當下的程度開始回升，不會跳回 0 或 1', () => {
  const goIn = frames(createGirlState(world), W, LOOK_NORTH, 5, OPEN_DOOR);
  const turned = goIn.findIndex(s => s.zone === 'canopy' && s.umbrella < 0.6);
  expect(turned).toBeGreaterThan(0);
  const back = frames(goIn[turned], W, LOOK_SOUTH, 3, OPEN_DOOR);
  const all = [goIn[turned], ...back], steps = back.map((s, i) => s.umbrella - all[i].umbrella);
  expect(steps.every(d => Math.abs(d) <= FULL_STEP + 1e-9)).toBe(true);   // 每一格都只動一小步，沒有跳變
  const outside = back.findIndex(s => s.zone === 'open');
  expect(back[outside].umbrella).toBeGreaterThan(0);                      // 回到露天時還有一點張開的程度，不是從 0 重來
  expect(back[outside].umbrella).toBeLessThan(1);                         // 也還沒完全撐開
  expect(back.slice(outside).every((s, i, l) => i === 0 || s.umbrella >= l[i - 1].umbrella)).toBe(true);
  expect(back.at(-1).umbrella).toBe(1);
});

test('傘從收起到撐開不到一秒，從撐開到收起也是', () => {
  const sunny = { ...world, weather: 'clear' }, dry = createGirlState(sunny), wet = createGirlState(world);
  expect([hold(dry, NONE, LOOK_NORTH, 1, world).umbrella, hold(wet, NONE, LOOK_NORTH, 1, sunny).umbrella]).toEqual([1, 0]);
});

test('開傘或收傘的期間走得比較慢', () => {
  const sidewalk = standAt(-5.5, 6.6);
  const steady = hold(sidewalk, W, LOOK_EAST, 0.4), changing = hold({ ...sidewalk, umbrella: 0 }, W, LOOK_EAST, 0.4);
  expect(changing.umbrella).toBeGreaterThan(0);
  expect(changing.umbrella).toBeLessThan(1);
  expect(changing.speed).toBeLessThan(steady.speed - 0.1);
});

test('晴天無論在哪裡傘都是收起的', () => {
  const sunny = { ...OPEN_DOOR, weather: 'clear' };
  const out = frames(createGirlState(sunny), W, LOOK_NORTH, 8, sunny), back = frames(out.at(-1), W, LOOK_SOUTH, 8, sunny);
  expect(new Set([...out, ...back].map(s => s.zone))).toEqual(new Set(['open', 'canopy', 'store']));
  expect([...out, ...back].every(s => s.umbrella === 0)).toBe(true);
});

test('在露天時天氣由晴轉雨傘開始撐開，由雨轉晴傘開始收起', () => {
  const sunny = { ...world, weather: 'clear' };
  const opening = hold(createGirlState(sunny), NONE, LOOK_NORTH, 0.3, world);
  const closing = hold(createGirlState(world), NONE, LOOK_NORTH, 0.3, sunny);
  for (const s of [opening, closing]) expect([s.umbrella > 0, s.umbrella < 1]).toEqual([true, true]);
  expect(opening.umbrella).toBeLessThan(0.5);   // 開傘剛開始
  expect(closing.umbrella).toBeGreaterThan(0.5);   // 收傘剛開始
});

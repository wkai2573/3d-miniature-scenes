// 跟拍相機的碰撞：相機想去的位置被牆或物件擋住時，拉近到擋住的位置前面；使用真實的店面配置
import { test, expect } from 'bun:test';
import { fitCamera, clearView, orbit, MIN_DISTANCE } from './cameraFit.js';
import { KONBINI } from './layout.js';

const at = (x, y, z) => ({ x, y, z });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('四周空曠時，相機留在原本想去的位置', () => {
  const pivot = at(2.2, 1.2, 6.45), want = at(2.2, 1.8, 9.6);
  expect(fitCamera(KONBINI, pivot, want)).toEqual(want);
});

test('相機想繞到店面玻璃牆的另一邊時，被擋在牆外', () => {
  const pivot = at(-2, 1.2, 1.8), want = at(-2, 1.8, -1);   // 少女在店門前的雨棚下，相機在店裡面
  const cam = fitCamera(KONBINI, pivot, want);
  expect(cam.z).toBeGreaterThan(1);   // 玻璃牆的外側在 z = 1
  expect(dist(cam, pivot)).toBeGreaterThanOrEqual(MIN_DISTANCE - 1e-9);
});

test('少女在店內靠牆站，相機在牆外時被拉到店內', () => {
  const pivot = at(-5.3, 1.2, -3), want = at(-8.3, 1.8, -3);   // 左牆外是小巷
  const cam = fitCamera(KONBINI, pivot, want);
  expect(cam.x).toBeGreaterThan(-5.8);
});

test('矮的東西擋不住相機：從輪擋上方越過去', () => {
  const pivot = at(-3, 1.2, 4.6), want = at(-3, 1.8, 1.8);   // 輪擋在 z 2.87 ~ 3.03，高度 0.12
  expect(fitCamera(KONBINI, pivot, want)).toEqual(want);
});

test('高的東西擋得住相機：自動販賣機', () => {
  const pivot = at(5.5, 1.2, -4.5), want = at(2.5, 1.8, -4.5);   // 自動販賣機在 x 4.03 ~ 4.87，高 1.9 公尺
  const cam = fitCamera(KONBINI, pivot, want);
  expect(cam.x).toBeGreaterThan(4.87);
  expect(cam.x).toBeLessThan(pivot.x);
});

test('在店內時相機壓在天花板以下', () => {
  const pivot = at(-2, 1.2, -2.5), want = at(-2, 4, -5.5);   // 相機想升到天花板之上
  const cam = fitCamera(KONBINI, pivot, want);
  expect(cam.y).toBeLessThan(KONBINI.ceiling);
  expect(cam.y).toBeGreaterThan(pivot.y);
});

test('在露天時相機可以升得很高，不受天花板限制', () => {
  const pivot = at(2.2, 1.2, 6.45), want = at(2.2, 4.2, 8.5);
  expect(fitCamera(KONBINI, pivot, want).y).toBe(4.2);
});

test('少女貼著牆站，相機也不會縮到她身上', () => {
  const pivot = at(-2, 1.2, 1.25), want = at(-2, 1.8, -1.5);   // 站在玻璃牆外 0.25 公尺，相機在牆的另一邊
  expect(dist(fitCamera(KONBINI, pivot, want), pivot)).toBeGreaterThanOrEqual(MIN_DISTANCE - 1e-9);
});

test('相機不會飛出場景的範圍', () => {
  const [x0, z0] = KONBINI.cameraBounds;
  const cam = fitCamera(KONBINI, at(-6, 1.2, -7.4), at(-6 - 3, 1.8, -7.4 - 3));
  expect(cam.x).toBeGreaterThanOrEqual(x0 - 1e-9);
  expect(cam.z).toBeGreaterThanOrEqual(z0 - 1e-9);
});

test('相機不會沉到地面下', () => {
  const pivot = at(2.2, 1.2, 6.45), want = at(2.2, -0.5, 9);
  expect(fitCamera(KONBINI, pivot, want).y).toBeGreaterThan(0);
});

test('少女貼著矮的貨架，相機想去的位置在貨架裡面時，抬到貨架上面', () => {
  const pivot = at(-2.3, 1.2, -2), want = at(-1.7, 1.4, -2);   // 貨架在 x -2.1 ~ -1.2，高 1.5 公尺，離她只有 0.2 公尺
  const cam = fitCamera(KONBINI, pivot, want);
  expect(cam.y).toBeGreaterThan(1.5);
});

test('少女在地面邊緣的大馬路上，相機可以退到地面邊緣稍外一點', () => {
  const pivot = at(13.5, 1.2, 10), want = at(14.5, 1.8, 10);   // 地面到 ±14
  expect(fitCamera(KONBINI, pivot, want)).toEqual(want);
});

test('少女在大馬路西端，相機不會退進公寓的建築裡', () => {
  const pivot = at(-12, 1.2, 8.5), want = at(-12, 2.2, 0.5);   // 公寓的正面在 z = 1.6
  const cam = fitCamera(KONBINI, pivot, want);
  expect(cam.z).toBeGreaterThan(1.6);
});

// 被擋住時相機怎麼擺：店外先往上抬，店內只拉近
const VIEW = { maxPitch: 1.25, lift: 0.14, steps: 9, clear: 0.85 };

test('露天被高的東西擋住時，相機先抬高仰角', () => {
  const pivot = at(5.5, 1.2, -4.5);   // 自動販賣機的東邊，相機在它的另一邊（西）
  const view = clearView(KONBINI, pivot, -Math.PI / 2, 0.2, 3, VIEW);
  expect(view.pitch).toBeGreaterThan(0.2);
  expect(view.reach).toBeGreaterThan(MIN_DISTANCE);
});

test('店內被貨架擋住時，仰角不變，只把相機拉近', () => {
  const pivot = at(-2.6, 1.2, -2.5);   // 兩排中島貨架之間的走道，相機在東邊那排貨架的另一邊
  const view = clearView(KONBINI, pivot, Math.PI / 2, 0.2, 3, VIEW);
  expect(view.pitch).toBe(0.2);
  expect(view.reach).toBeLessThan(3);
  expect(view.reach).toBeGreaterThanOrEqual(MIN_DISTANCE - 1e-9);
});

test('店內往走道的長邊看、沒有被擋住時，相機留在原本的距離與仰角', () => {
  const pivot = at(-2.6, 1.2, -2.5);
  const view = clearView(KONBINI, pivot, 0, 0.2, 1.5, VIEW);   // 相機在她的南邊（+z）1.5 公尺
  expect(view.pitch).toBe(0.2);
  expect(view.reach).toBeCloseTo(1.5, 6);
});

test('店內拉近後的相機，不會穿進貨架', () => {
  const pivot = at(-2.6, 1.2, -2.5);
  const { pitch, reach } = clearView(KONBINI, pivot, Math.PI / 2, 0.2, 3, VIEW);
  const cam = fitCamera(KONBINI, pivot, orbit(pivot, Math.PI / 2, pitch, reach, {}));
  expect(cam.x).toBeLessThan(-2.1);   // 東邊那排貨架從 x = -2.1 開始
});

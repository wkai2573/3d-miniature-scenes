// 地形高度：純函式（不依賴 three.js），建模、擺放物件、落葉模擬都用它查地面高度
// 分層：後山 → 上段台地 → 石垣 → 中段庭園（瓢簞池、築山、墊高的枯山水）→ 石垣 → 前段參道
import { fbm3 } from '../../engine/noise.js';
import { LV, WALL_UP, WALL_LOW, POND, MOUND, ZEN, INN, ANNEX, ONSEN, STAIRS_UP, GATE, SPRING } from './layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 折線（x 由小到大）在 x 處的 z
function polyZ(line, x) {
  if (x <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    const [x1, z1] = line[i];
    if (x <= x1) { const [x0, z0] = line[i - 1]; return z0 + (z1 - z0) * (x - x0) / (x1 - x0); }
  }
  return line[line.length - 1][1];
}
export const wallUpZ = x => polyZ(WALL_UP, x);
export const wallLowZ = x => polyZ(WALL_LOW, x);
export const WALL_RUN = 0.32;     // 石垣由頂緣到牆腳的水平退縮

export function distToPolyline(line, x, z) {
  let d = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1];
    const vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return d;
}

// 瓢簞池：到兩個橢圓的「正規化半徑」取平滑最小值，< 1 大致在池內
export function pondE(x, z) {
  const [p, q] = POND.lobes;
  const a = Math.hypot((x - p[0]) / p[2], (z - p[1]) / p[3]);
  const b = Math.hypot((x - q[0]) / q[2], (z - q[1]) / q[3]);
  const k = 0.35, h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

// 需要保持平坦的範圍（建物、溫泉、枯山水、石段、入口門），邊緣 1.2 公尺內漸變
const FLAT = [
  [INN.x0 - 1.0, INN.z0 - 0.8, INN.x1 + 1.0, INN.z1 + 2.8],
  [ANNEX.x0 - 0.8, ANNEX.z0 - 0.5, ONSEN.cx + ONSEN.rx + 1.6, ONSEN.cz + ONSEN.rz + 1.2],
  [ZEN.x0 - 0.4, ZEN.z0 - 0.4, ZEN.x1 + 0.4, ZEN.z1 + 0.4],
  [STAIRS_UP.x - 1.8, -3.0, STAIRS_UP.x + 1.8, 1.8],
  [GATE.x - 2.4, GATE.z - 1.2, GATE.x + 2.4, 14.4],
];
function flatness(x, z) {
  let f = 0;
  for (const [x0, z0, x1, z1] of FLAT) {
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
    f = Math.max(f, 1 - ss(0, 1.2, Math.hypot(dx, dz)));
  }
  return f;
}

// 0 ~ 1：台地的程度（石垣頂緣以內為 1）
export const upness = (x, z) => { const zu = wallUpZ(x); return 1 - ss(zu, zu + WALL_RUN, z); };

export function heightAt(x, z) {
  const up = upness(x, z);
  const zl = wallLowZ(x), low = ss(zl, zl + WALL_RUN * 0.8, z);
  let h = LV.mid + (LV.up - LV.mid) * up + (LV.low - LV.mid) * low;

  // 後山與左側竹林坡
  const back = ss(-12.2, -17.2, z);
  h += 2.7 * Math.pow(back, 1.25);
  h += 1.1 * ss(-11.2, -16.2, x) * up * (0.35 + 0.65 * ss(-2.5, -8, z));

  // 自然起伏（平坦區不起伏），後山起伏較大
  h += fbm3(x * 0.16, z * 0.16, 3.7) * (0.22 + 0.45 * back) * (1 - flatness(x, z));

  // 墊高的枯山水
  const zx = ss(ZEN.x0 - 0.04, ZEN.x0 + 0.04, x) * (1 - ss(ZEN.x1 - 0.04, ZEN.x1 + 0.04, x));
  const zz = ss(ZEN.z0 - 0.04, ZEN.z0 + 0.04, z) * (1 - ss(ZEN.z1 - 0.04, ZEN.z1 + 0.04, z));
  h += LV.zen * zx * zz;

  // 築山
  const dm = Math.hypot(x - MOUND.x, z - MOUND.z) / MOUND.r;
  if (dm < 1) h += MOUND.h * (0.5 + 0.5 * Math.cos(Math.PI * dm));

  // 台地上的小溪
  const ds = distToPolyline(SPRING, x, z);
  if (ds < 0.5) h -= 0.14 * (1 - ss(0.12, 0.42, ds));

  // 瓢簞池：往池底收
  const e = pondE(x, z);
  if (e < 1.3) h = LV.bed + (h - LV.bed) * ss(0.55, 1.22, e);
  return h;
}

// 水面範圍：池塘裡、且地面低於水位
export const isWater = (x, z) => pondE(x, z) < 1.1 && heightAt(x, z) < LV.water - 0.02;

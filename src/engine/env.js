// 時間與天氣：全場景共用的狀態。場景用 initEnv() 設定開場的時間與天氣，畫面下方的面板（src/ui/env.js）用事件調整：
//   env:set（detail 是 { hour?, weather? }）、env:query（要求回報目前狀態）→ 這裡
//   env:state（detail 是 { hour, weather }）→ 面板
// 時間一拖就套用；切換天氣時雨量、雪量、雲量在幾秒內漸變，地面的濕度與積雪則慢慢累積、慢慢消退。
import { onTick } from './context.js';

export const WEATHERS = ['clear', 'rain', 'snow'];

export const ENV = {
  hour: 0, weather: 'clear',
  sun: 0,                  // 太陽高度（sin 值）：正午 1、日出日落 0、午夜 -1
  day: 0,                  // 天亮的程度：0 夜晚、1 白天
  lamps: 1,                // 人工照明（路燈、窗燈、燈籠）：天暗才點亮
  rain: 0, snow: 0,        // 降雨、降雪的強度
  cloud: 0,                // 雲量：天空變灰，日月與星星被遮住
  wet: 0,                  // 地面濕度：下雨很快變濕，雨停後慢慢變乾
  cover: 0,                // 積雪：下雪時慢慢變白，雪停後慢慢融化
};

// 給 shader 共用的 uniform（每格從 ENV 複製過去）
export const EU = {
  rain: { value: 0 }, snow: { value: 0 }, wet: { value: 0 }, cover: { value: 0 },
  lamps: { value: 1 }, day: { value: 0 },
};

const clamp01 = v => Math.min(1, Math.max(0, v));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const toward = (v, to, speed, dt) => v < to ? Math.min(to, v + speed * dt) : Math.max(to, v - speed * dt);
const target = w => ({ rain: w === 'rain' ? 1 : 0, snow: w === 'snow' ? 1 : 0, cloud: w === 'rain' ? 1 : w === 'snow' ? 0.85 : 0 });

let ready = false;

/** 場景開場的時間（0–24 時）與天氣；天氣直接到位，不從晴天漸變 */
export function initEnv({ hour = 0, weather = 'clear' } = {}) {
  ENV.hour = wrap(hour);
  ENV.weather = WEATHERS.includes(weather) ? weather : 'clear';
  Object.assign(ENV, target(ENV.weather));
  ENV.wet = ENV.rain;
  ENV.cover = ENV.snow;
  derive();
  ready = true;
  onTick((t, dt) => {
    const T = target(ENV.weather);
    ENV.rain = toward(ENV.rain, T.rain, 0.5, dt);              // 約 2 秒下大、停歇
    ENV.snow = toward(ENV.snow, T.snow, 0.4, dt);
    ENV.cloud = toward(ENV.cloud, T.cloud, 0.35, dt);
    if (ENV.rain > 0.05) ENV.wet = toward(ENV.wet, 1, 0.3 * ENV.rain, dt);    // 幾秒就濕透
    else ENV.wet = toward(ENV.wet, 0, ENV.snow > 0.3 ? 1 / 6 : 1 / 30, dt);  // 下雪時很快被雪蓋住；放晴後半分鐘才乾
    if (ENV.snow > 0.3) ENV.cover = toward(ENV.cover, 1, ENV.snow / 14, dt); // 十幾秒積滿
    else ENV.cover = toward(ENV.cover, 0, ENV.rain > 0.3 ? 1 / 5 : 1 / 10, dt);
    derive();
    for (const g of glows) g.c.copy(g.base).multiplyScalar(lampK(g.dayK));
    for (const l of lights) l.l.intensity = l.base * lampK(l.dayK);
  });
  emit();
}

function derive() {
  ENV.sun = Math.sin((ENV.hour - 6) / 24 * Math.PI * 2);
  ENV.day = ss(-0.1, 0.3, ENV.sun);
  ENV.lamps = 1 - ss(0.02, 0.22, ENV.sun - 0.15 * ENV.cloud);   // 陰雨天燈開得早
  for (const k of Object.keys(EU)) EU[k].value = ENV[k];
}

function wrap(h) { return ((h % 24) + 24) % 24; }

function emit() {
  dispatchEvent(new CustomEvent('env:state', { detail: { hour: ENV.hour, weather: ENV.weather } }));
}

addEventListener('env:set', e => {
  if (!ready) return;
  const { hour, weather } = e.detail ?? {};
  if (Number.isFinite(hour)) ENV.hour = wrap(hour);
  if (WEATHERS.includes(weather)) ENV.weather = weather;
  derive();
  emit();
});
addEventListener('env:query', () => { if (ready) emit(); });

// ---- 夜間照明：天亮時熄滅或調暗的燈光與發光材質 ----
// dayK 是白天保留的亮度比例（0 全暗；燈罩、紙窗白天看起來仍有顏色，可以留一些）
const glows = [], lights = [];

/** 人工照明在目前時間的亮度係數 */
export const lampK = (dayK = 0) => dayK + (1 - dayK) * ENV.lamps;

/** 發光的顏色（MeshBasicMaterial 的 color、shader 的顏色 uniform）跟著天色調暗 */
export function nightColor(color, dayK = 0) {
  glows.push({ c: color, base: color.clone(), dayK });
  return color;
}
export function nightGlow(mat, dayK = 0) {
  nightColor(mat.color, dayK);
  return mat;
}
/** 點光源白天關掉 */
export function nightLight(light, dayK = 0) {
  lights.push({ l: light, base: light.intensity, dayK });
  return light;
}

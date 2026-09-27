// 環境音：錄音循環（雨聲、樹葉沙沙聲、水聲…）加上跟畫面同步的合成音效（滴水、自動門、鹿威し…）
// 瀏覽器規定要等使用者互動（點擊、按鍵、拖曳）後才能出聲，所以第一次互動時才建立 AudioContext。
// 開關偏好存在 localStorage，兩個場景共用；選單的聲音按鈕用 sound:toggle / sound:state 事件和這裡溝通。
import * as THREE from 'three';
import { onTick } from './context.js';
import { camera } from './renderer.js';

const KEY = 'scene-sound';          // localStorage：'on' | 'off'，預設開
const LIVE = 'scene-sound-live';    // sessionStorage：換場景前正在播放，下一頁試著直接接上
const LEVEL = 0.85;                 // 整體音量

const get = (s, k) => { try { return s.getItem(k); } catch { return null; } };
const put = (s, k, v) => { try { v == null ? s.removeItem(k) : s.setItem(k, v); } catch { /* 無法記錄就算了 */ } };

let want = get(localStorage, KEY) !== 'off';
let ctx = null, master = null, bus = null, verbIn = null;
let scene = null;                  // { files, build }
let phase = 'idle';                // idle → loading → on
const cues = new Map();
const fetched = new Map();

// ---- 對外介面 ----

/**
 * 場景註冊環境音。files 是 { 名稱: 網址 }；build(A, 音檔) 在第一次出聲前呼叫一次，用 A 的工具搭建聲音。
 * 偏好是開的話，場景一畫好就先下載音檔，使用者一互動就能馬上播放。
 */
export function ambience(files, build) {
  scene = { files, build };
  if (want) prefetch();
  if (ctx && want) start();
}

/** 畫面上發生了有聲音的事件（滴水落地、門打開…）。聲音沒開時什麼都不做。 */
export function cue(name, ...args) {
  if (phase === 'on' && ctx.state === 'running') cues.get(name)?.(...args);
}

// ---- 建立與開關 ----

function prefetch() {
  for (const url of Object.values(scene.files)) {
    if (!fetched.has(url)) fetched.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }));
  }
}

function create() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC({ latencyHint: 'playback' });
  master = ctx.createGain();
  master.gain.value = 0;
  // 保險用的限幅，避免多個聲音疊在一起時破音
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -6; limit.knee.value = 6; limit.ratio.value = 12;
  limit.attack.value = 0.004; limit.release.value = 0.25;
  bus = ctx.createGain();
  bus.connect(master).connect(limit).connect(ctx.destination);
  // 共用的殘響：夜裡庭園、街道的空間感
  const verb = ctx.createConvolver();
  verb.buffer = impulse(2.6);
  verbIn = ctx.createGain();
  verbIn.connect(verb).connect(bus);
  ctx.onstatechange = emit;
  return true;
}

// 一定要在使用者互動的事件處理函式裡同步呼叫（Safari 的要求）
function start() {
  if (!ctx && !create()) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  if (scene && phase === 'idle') load();
  else if (phase === 'on') fade(LEVEL, 1.2);
  emit();
}

async function load() {
  phase = 'loading';
  prefetch();
  try {
    const bufs = {};
    await Promise.all(Object.entries(scene.files).map(async ([k, url]) => {
      bufs[k] = await ctx.decodeAudioData((await fetched.get(url)).slice(0));
    }));
    scene.build(A, bufs);
    phase = 'on';
    if (want) fade(LEVEL, 2.5);
  } catch (e) {
    console.warn('環境音載入失敗：', e);
    phase = 'idle';
    fetched.clear();
  }
  emit();
}

function fade(v, sec) {
  const g = master.gain, t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(v, t + sec);
}

let sleepTimer = 0;
function setWant(v) {
  want = v;
  put(localStorage, KEY, v ? 'on' : 'off');
  clearTimeout(sleepTimer);
  if (v) start();
  else if (ctx) {
    fade(0, 0.4);
    sleepTimer = setTimeout(() => { if (!want) ctx.suspend(); }, 500);
  }
  emit();
}

// 給選單按鈕：off（關）、wait（開，但還在等互動或下載）、on（播放中）
function emit() {
  const live = want && phase === 'on' && ctx?.state === 'running';
  dispatchEvent(new CustomEvent('sound:state', { detail: { state: !want ? 'off' : live ? 'on' : 'wait' } }));
}

addEventListener('sound:toggle', () => {
  if (want && !(phase === 'on' && ctx?.state === 'running')) start();   // 開著但還沒出聲：按一下就開始
  else setWant(!want);
});

// 任何互動都能讓聲音開始（聲音按鈕本身除外，交給 sound:toggle 處理）
const kick = e => {
  if (!want || document.hidden || e.target?.closest?.('.snd')) return;
  if (!ctx || ctx.state !== 'running' || phase === 'idle') start();
};
for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, kick, { capture: true, passive: true });

// 切到別的分頁就暫停，回來再接著播
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else if (want) ctx.resume().catch(() => {});
});

// 換場景：淡出，並記下「剛才在播」，下一頁試著不等互動就接上（瀏覽器允許時）
addEventListener('scene:leave', () => {
  if (!ctx || !want || phase !== 'on') return;
  fade(0, 0.5);
  put(sessionStorage, LIVE, '1');
});
addEventListener('pageshow', e => { if (e.persisted && ctx && want && phase === 'on') fade(LEVEL, 1); });
if (get(sessionStorage, LIVE)) {
  put(sessionStorage, LIVE, null);
  if (want) addEventListener('scene:ready', () => start(), { once: true });
}

// 聽者跟著相機走：拉近某個聲源，它就變大聲；轉動視角，左右聲道跟著換
const lp = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3();
onTick(() => {
  if (!ctx || ctx.state !== 'running') return;
  const L = ctx.listener;
  lp.setFromMatrixPosition(camera.matrixWorld);
  camera.getWorldDirection(fwd);
  up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  if (L.positionX) {
    L.positionX.value = lp.x; L.positionY.value = lp.y; L.positionZ.value = lp.z;
    L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
    L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z;
  } else {
    L.setPosition(lp.x, lp.y, lp.z);
    L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
  }
});

emit();

// ---- 給場景用的工具 ----

// 等功率交叉淡入淡出的曲線
const CURVE_IN = new Float32Array(64).map((_, i) => Math.sin(i / 63 * Math.PI / 2));
const CURVE_OUT = CURVE_IN.slice().reverse();
const rnd = (a, b) => a + (b - a) * Math.random();   // 不用場景的固定種子亂數，免得影響畫面上的事件時間

const A = {
  get ctx() { return ctx; },
  get out() { return bus; },
  get verb() { return verbIn; },

  /** 登錄事件的聲音：cue(name, ...) 會呼叫它 */
  on(name, fn) { cues.set(name, fn); },

  /** 每格更新，只在聲音播放時執行：fn(秒數) */
  tick(fn) { onTick(t => { if (phase === 'on' && ctx.state === 'running') fn(t); }); },

  /** 某一點到相機的距離（用來略過聽不到的遠處事件） */
  dist(x, y, z) { return tmp.set(x, y, z).distanceTo(lp); },

  /**
   * 錄音鋪底：每次從音檔裡隨機挑一段、用等功率交叉淡化接起來，所以不會聽出固定的循環點。
   * o: { gain, dest, seg:[最短, 最長] 每段秒數, xf 交叉淡化秒數, rate 播放速度 }
   * 回傳 GainNode，可以即時調整 gain.value
   */
  bed(buf, o = {}) {
    const { gain = 1, dest = bus, seg = [8, 14], xf = 2.5, rate = 1 } = o;
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(dest);
    let t = ctx.currentTime + 0.05;
    const schedule = () => {
      if (t < ctx.currentTime) t = ctx.currentTime + 0.05;             // 計時器被延誤過：從現在重新接
      while (t < ctx.currentTime + 5) {
        const len = Math.max(xf + 0.2, rnd(seg[0], seg[1]));
        const span = (len + xf) * rate;                               // 這段要用掉的音檔長度
        const off = 0.1 + Math.random() * Math.max(0, buf.duration - span - 0.2);
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.playbackRate.value = rate;
        const e = ctx.createGain();
        e.gain.value = 0;
        s.connect(e).connect(g);
        e.gain.setValueCurveAtTime(CURVE_IN, t, xf);
        e.gain.setValueCurveAtTime(CURVE_OUT, t + len, xf);
        s.start(t, off, span);
        s.onended = () => e.disconnect();
        t += len;
      }
    };
    schedule();
    setInterval(schedule, 1000);
    return g;
  },

  /**
   * 固定位置的聲源：回傳 PannerNode，接進去的聲音會依相機距離變小、依方位分左右。
   * o: { ref 這個距離內不衰減, roll 衰減快慢, verb 送進殘響的比例, dest }
   */
  spot(x, y, z, o = {}) {
    const { ref = 8, roll = 1, verb = 0, dest = bus } = o;
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = roll;
    p.maxDistance = 10000;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
    else p.setPosition(x, y, z);
    p.connect(dest);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; p.connect(s).connect(verbIn); }
    return p;
  },

  /** 一段白噪音（合成音效的原料，所有人共用同一份） */
  get noise() { return noiseBuf ??= makeNoise(4); },

  /** 播一小段音檔：{ dest, gain, rate, off, dur, fadeIn, fadeOut, at } */
  play(buf, o = {}) {
    const { dest = bus, gain = 1, rate = 1, off = 0, dur = buf.duration, fadeIn = 0.01, fadeOut = 0.05, at = ctx.currentTime } = o;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, at);
    e.gain.linearRampToValueAtTime(gain, at + fadeIn);
    e.gain.setValueAtTime(gain, at + Math.max(fadeIn, dur - fadeOut));
    e.gain.linearRampToValueAtTime(0, at + dur);
    s.connect(e).connect(dest);
    s.start(at, off, dur * rate);
    s.onended = () => e.disconnect();
    return s;
  },

  rnd,
};

let noiseBuf = null;
function makeNoise(sec) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// 人工殘響：左右聲道各一段指數衰減的噪音，越往後越暗
function impulse(sec) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n, a = 0.9 - 0.75 * k;                           // 低通係數隨時間變小 → 尾巴變暗
      lp = lp * (1 - a) + (Math.random() * 2 - 1) * a;
      d[i] = i < ctx.sampleRate * 0.012 ? 0 : lp * Math.pow(1 - k, 3.2) * 0.6;
    }
  }
  return b;
}

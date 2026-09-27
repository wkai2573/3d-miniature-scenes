// 雨夜的聲音
// 錄音：整片的雨聲鋪底；雨棚下的滴水與排水溝放在店門口，拉近店面才聽得清楚
// 合成（跟畫面同步）：屋簷水滴落進水窪、自動門開關與入店鈴、招牌與巷口路燈閃爍時的電流聲、店裡透出的空調聲、自販機的低鳴
// 音檔來源與授權見 assets/audio/CREDITS.md
import { ambience } from '../../engine/audio.js';

const DOOR = [2.2, 1.4, 1.15];
const VEND = [4.7, 1.0, -4.7];

export function buildSound() {
  ambience({
    rain: 'assets/audio/konbini/rain.mp3',
    eaves: 'assets/audio/konbini/eaves.mp3',
  }, (A, B) => {
    A.bed(B.rain, { gain: 0.62, seg: [9, 16], xf: 3 });
    A.bed(B.eaves, { gain: 0.85, seg: [8, 14], dest: A.spot(-0.8, 1.2, 2.6, { ref: 11 }) });
    const store = storeAir(A);
    hum(A);
    A.on('drip', (x, z) => plip(A, x, z));
    A.on('door', () => door(A, store));
    A.on('flicker', (x, y, z, dur) => buzz(A, x, y, z, dur));
  });
}

// 屋簷水滴落進水窪：短促的「滴」（往上滑的正弦，像水泡破掉）加一點水花噪音。遠處聽不到的就不發聲
function plip(A, x, z) {
  if (A.dist(x, 0, z) > 34 || Math.random() < 0.3) return;
  const { ctx } = A, t = ctx.currentTime + 0.005;
  const p = A.spot(x, 0.05, z, { ref: 2.5, roll: 1.2, verb: 0.1 });
  const f = A.rnd(1300, 2600), a = A.rnd(0.1, 0.26);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * A.rnd(1.5, 2.1), t + 0.05);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(a, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0005, t + A.rnd(0.05, 0.09));
  o.connect(g).connect(p);
  o.start(t); o.stop(t + 0.12);
  noiseHit(A, p, t, 0.02, a * 0.45, 'highpass', 2800);
  o.onended = () => p.disconnect();
}

// 自動門：馬達與門片滑開、兩秒多後再關上；有一半的機會響起入店鈴。門開著的時候，店裡的聲音透出來
function door(A, store) {
  const { ctx } = A, t = ctx.currentTime + 0.02;
  const p = A.spot(...DOOR, { ref: 6, verb: 0.12 });
  slide(A, p, t, 0.8);
  slide(A, p, t + 3.2, 0.9);
  if (Math.random() < 0.5) {
    bell(A, p, 659.3, t + 0.3);          // 叮
    bell(A, p, 523.3, t + 0.85);         // 咚
  }
  store.lp.frequency.setTargetAtTime(2200, t, 0.3);
  store.g.gain.setTargetAtTime(0.09, t, 0.3);
  store.lp.frequency.setTargetAtTime(380, t + 3.3, 0.35);
  store.g.gain.setTargetAtTime(0.04, t + 3.3, 0.35);
  setTimeout(() => p.disconnect(), 6000);
}

function slide(A, dest, t, d) {
  const { ctx } = A;
  const s = ctx.createBufferSource();
  s.buffer = A.noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 330; bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + d * 0.3);
  g.gain.linearRampToValueAtTime(0.1, t + d * 0.85);
  g.gain.linearRampToValueAtTime(0, t + d + 0.06);
  s.connect(bp).connect(g).connect(dest);
  s.start(t, Math.random() * 2, d + 0.1);
  noiseHit(A, dest, t + d, 0.06, 0.12, 'lowpass', 260);            // 門停下來的輕輕一聲
}

// 入店鈴：鐘聲般的泛音慢慢消失；聲音從店裡傳出來，所以濾得有點悶
function bell(A, dest, f, t) {
  const { ctx } = A;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2600;
  lp.connect(dest);
  for (const [m, a, d] of [[1, 0.07, 1.7], [2, 0.018, 0.9], [3.01, 0.009, 0.55], [4.2, 0.004, 0.35]]) {
    const o = ctx.createOscillator();
    o.frequency.value = f * m;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(lp);
    o.start(t); o.stop(t + d + 0.05);
  }
}

// 店裡的空調與日光燈低鳴，隔著玻璃只剩低頻；門打開時濾波器打開、聲音變亮
function storeAir(A) {
  const { ctx } = A;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 0.04;
  lp.connect(g).connect(A.spot(...DOOR, { ref: 5 }));
  const s = ctx.createBufferSource();
  s.buffer = A.noise; s.loop = true;
  s.connect(lp); s.start();
  for (const [f, a] of [[100, 0.25], [200, 0.1], [300, 0.05]]) {    // 50 Hz 電源 → 100 Hz 的日光燈嗡聲
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.frequency.value = f; og.gain.value = a;
    o.connect(og).connect(lp); o.start();
  }
  return { lp, g };
}

// 自販機的壓縮機低鳴：只有拉近到旁邊才聽得到
function hum(A) {
  const { ctx } = A;
  const p = A.spot(...VEND, { ref: 2, roll: 1.4 });
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 700;
  lp.connect(p);
  for (const [f, a] of [[100, 0.035], [200, 0.012], [247, 0.006]]) {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.frequency.value = f; og.gain.value = a;
    o.connect(og).connect(lp); o.start();
  }
}

// 招牌、路燈閃爍時的電流聲：跟畫面一樣約 9 Hz 一明一暗
function buzz(A, x, y, z, dur) {
  if (A.dist(x, y, z) > 60) return;
  const { ctx } = A, t = ctx.currentTime + 0.01;
  const p = A.spot(x, y, z, { ref: 4 });
  const o = ctx.createOscillator();
  o.type = 'sawtooth'; o.frequency.value = 100;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0;
  o.connect(bp).connect(g).connect(p);
  const step = 1 / 9.07;
  for (let k = 0; k * step < dur; k++) g.gain.setValueAtTime(Math.random() < 0.7 ? 0.05 : 0.012, t + k * step);
  g.gain.setValueAtTime(0, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
  o.onended = () => p.disconnect();
}

// 一小段濾過的噪音（水花、碰撞）
function noiseHit(A, dest, t, d, a, type, f) {
  const { ctx } = A;
  const s = ctx.createBufferSource();
  s.buffer = A.noise;
  const fl = ctx.createBiquadFilter();
  fl.type = type; fl.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(a, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + d);
  s.connect(fl).connect(g).connect(dest);
  s.start(t, Math.random() * 3, d + 0.02);
}

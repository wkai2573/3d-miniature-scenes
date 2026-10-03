// 紅葉屋的聲音
// 錄音：樹葉的沙沙聲鋪底；陣風時枯葉被捲起的聲音跟著畫面的陣風起落；秋蟲在陣風一來就停，風過了幾秒才慢慢再叫
//       秋蟲只在晴朗的夜裡叫；下雨時鋪上雨聲（借用便利商店的錄音），下雪時樹葉聲也變小
//       小瀑布、露天風呂的湯口、蹲踞的細流都放在實際位置，拉近才聽得清楚
// 合成（跟畫面同步）：鹿威し倒水，以及竹筒回彈敲在石頭上的「コーン」，帶一點庭園的回音
// 音檔來源與授權見 assets/audio/CREDITS.md
import { ambience } from '../../engine/audio.js';
import { ENV } from '../../engine/env.js';
import { W } from './wind.js';
import { LV, FALL, ONSEN, TSUKUBAI } from './layout.js';
import { heightAt, wallUpZ } from './terrain.js';

export function buildSound() {
  ambience({
    leaves: 'assets/audio/ryokan/leaves.mp3',
    gust: 'assets/audio/ryokan/gust.mp3',
    crickets: 'assets/audio/ryokan/crickets.mp3',
    waterfall: 'assets/audio/ryokan/waterfall.mp3',
    trickle: 'assets/audio/ryokan/trickle.mp3',
    rain: 'assets/audio/konbini/rain.mp3',
  }, (A, B) => {
    const CALM = 0.68, BUGS = 0.14, RAIN = 0.5;
    const bugsNow = () => BUGS * (1 - ENV.day) * (1 - Math.max(ENV.rain, ENV.snow));
    const calm = A.bed(B.leaves, { gain: CALM, seg: [10, 18], xf: 3 });
    const strong = A.bed(B.gust, { gain: 0, seg: [7, 11], xf: 2 });
    const bugs = A.bed(B.crickets, { gain: bugsNow(), seg: [8, 14], xf: 3 });
    const rain = A.bed(B.rain, { gain: RAIN * ENV.rain, seg: [9, 16], xf: 3 });

    A.bed(B.waterfall, { gain: 0.85, dest: A.spot(FALL.x, LV.water + 0.6, wallUpZ(FALL.x) + 0.62, { ref: 9 }) });
    A.bed(B.trickle, { gain: 0.55, dest: A.spot(ONSEN.cx + ONSEN.rx - 0.47, LV.up + 0.5, ONSEN.cz - 0.54, { ref: 4 }) });
    const { x, z } = TSUKUBAI;
    A.bed(B.trickle, { gain: 0.3, rate: 0.85, dest: A.spot(x + 0.5, heightAt(x, z) + 0.4, z - 0.3, { ref: 3 }) });

    let hush = 0;
    A.tick(() => {
      const g = W.gust.value, t = A.ctx.currentTime;
      strong.gain.setTargetAtTime(g * 0.85, t, 0.12);
      calm.gain.setTargetAtTime(CALM * (1 + g * 0.6) * (1 - 0.45 * ENV.snow), t, 0.25);
      rain.gain.setTargetAtTime(RAIN * ENV.rain, t, 0.5);
      if (g > 0.15) hush = t + 3.5;
      const quiet = t < hush;
      bugs.gain.setTargetAtTime(quiet ? 0 : bugsNow(), t, quiet ? 0.4 : 2.5);
    });

    A.on('pour', (px, py, pz) => A.play(B.trickle, {
      dest: A.spot(px, py, pz, { ref: 3 }), gain: 0.8, rate: 1.3,
      off: A.rnd(0, B.trickle.duration - 2), dur: 0.6, fadeIn: 0.04, fadeOut: 0.3,
    }));
    A.on('knock', (kx, ky, kz) => {
      if (A.dist(kx, ky, kz) > 90) return;
      const p = A.spot(kx, ky, kz, { ref: 6, verb: 0.55 });
      const t = A.ctx.currentTime + 0.005;
      knock(A, p, t, 1);
      knock(A, p, t + 0.2, 0.25);          // 回彈再輕碰一下
      setTimeout(() => p.disconnect(), 4000);
    });
  });
}

// 竹筒敲石頭：一瞬間的敲擊噪音，加上竹管的共鳴（幾個很快消失的正弦泛音）
function knock(A, dest, t, amp) {
  const { ctx } = A;
  const n = ctx.createBufferSource();
  n.buffer = A.noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.45 * amp, t);
  ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.025);
  n.connect(bp).connect(ng).connect(dest);
  n.start(t, Math.random() * 3, 0.04);
  for (const [f, a, d] of [[610, 0.42, 0.34], [1330, 0.18, 0.16], [2250, 0.08, 0.08]]) {
    const o = ctx.createOscillator(), fr = f * A.rnd(0.985, 1.015);
    o.frequency.setValueAtTime(fr * 1.03, t);
    o.frequency.exponentialRampToValueAtTime(fr, t + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a * amp, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, t + d);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + d + 0.05);
  }
}

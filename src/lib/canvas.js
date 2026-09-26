// Canvas 貼圖與日文字型
import * as THREE from 'three';
import { TEAL, CORAL, MUSTARD, CREAM } from '../palette.js';

const PI = Math.PI;
export const FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", sans-serif';

// Google Fonts 的日文字型依字元分段下載，這裡列出貼圖上會畫到的字元，先行載入。
// 在貼圖上新增文字時，請把新字元加進來，否則會用系統字型畫出。
const GLYPHS = 'ことりマート止まれおでん全品円秋の新作焼きいもつめた〜あっか飲み物にぎ・弁当菓子カップ麺日用料らげ肉コロケフェ'
  + 'しゃせえるごびペボル月見荘町内会知ゴミ出祭回覧板防災訓練丁目星野アイス駐輪場発売す営業中時間車台ホナクスッ増量二一曜願で'
  + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export async function loadFonts() {
  const link = document.getElementById('font-css');
  if (link) {
    await new Promise(r => {
      if (link.sheet) return r();
      link.addEventListener('load', r, { once: true });
      link.addEventListener('error', r, { once: true });
      setTimeout(r, 1500);
    });
  }
  try {
    await Promise.race([
      Promise.all(['500', '700', '900'].map(w => document.fonts.load(`${w} 32px "Zen Maru Gothic"`, GLYPHS))),
      new Promise(r => setTimeout(r, 2000)),
    ]);
  } catch (e) { /* 以系統字型代替 */ }
}

export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (!o.linear) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = o.aniso ?? 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function txt(g, s, x, y, size, color, weight = 700, align = 'center') {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

// ことりマート的小鳥商標
export function drawBird(g, cx, cy, r) {
  g.fillStyle = TEAL; g.beginPath(); g.arc(cx, cy, r, 0, PI * 2); g.fill();
  g.fillStyle = CREAM;
  g.beginPath(); g.ellipse(cx - r * 0.05, cy + r * 0.1, r * 0.5, r * 0.42, 0, 0, PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.3, cy - r * 0.22, r * 0.3, 0, PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx - r * 0.5, cy + r * 0.05); g.lineTo(cx - r * 0.85, cy - r * 0.2); g.lineTo(cx - r * 0.55, cy + r * 0.35); g.fill();
  g.fillStyle = MUSTARD;
  g.beginPath(); g.moveTo(cx + r * 0.56, cy - r * 0.28); g.lineTo(cx + r * 0.78, cy - r * 0.18); g.lineTo(cx + r * 0.56, cy - r * 0.1); g.fill();
  g.fillStyle = '#1b2430'; g.beginPath(); g.arc(cx + r * 0.36, cy - r * 0.28, r * 0.06, 0, PI * 2); g.fill();
  g.fillStyle = CORAL; g.beginPath(); g.ellipse(cx + r * 0.18, cy - r * 0.05, r * 0.09, r * 0.06, 0, 0, PI * 2); g.fill();
}

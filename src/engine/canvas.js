// Canvas 貼圖與日文字型
import * as THREE from 'three';
export const FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", sans-serif';

// Google Fonts 的日文字型依字元分段下載，所以由場景傳入貼圖上會畫到的字元先行載入。
// 在貼圖上新增文字時，請把新字元加進該場景的字元清單，否則會用系統字型畫出。
export async function loadFonts(glyphs) {
  glyphs += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
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
      Promise.all(['500', '700', '900'].map(w => document.fonts.load(`${w} 32px "Zen Maru Gothic"`, glyphs))),
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

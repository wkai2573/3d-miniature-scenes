// ことりマート的品牌圖：小鳥商標
import { TEAL, CORAL, MUSTARD, CREAM } from './palette.js';

const PI = Math.PI;

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

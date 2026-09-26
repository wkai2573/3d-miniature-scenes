// 多處共用的小道具：空調室外機、腳踏車（ママチャリ）
import * as THREE from 'three';
import { PI, scene } from '../core/context.js';
import { canvasTex } from '../lib/canvas.js';
import { toon } from '../lib/materials.js';
import { G, add, box, plane, rod, grp } from '../lib/geometry.js';

// ---- 室外機 ----
let fanMat = null;
function getFanMat() {
  if (fanMat) return fanMat;
  const tex = canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#c9ccc7'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#2a2e36'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.42, 0, PI * 2); g.fill();
    g.strokeStyle = '#8e939a'; g.lineWidth = 3;
    for (let r = 10; r < w * 0.42; r += 9) { g.beginPath(); g.arc(w / 2, w / 2, r, 0, PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(w * 0.08, w / 2); g.lineTo(w * 0.92, w / 2); g.moveTo(w / 2, w * 0.08); g.lineTo(w / 2, w * 0.92); g.stroke();
  });
  return (fanMat = toon('#ffffff', { map: tex }));
}

// 正面（風扇）朝本地 +z；ry 旋轉朝向
export function acUnit(x, yb, z, ry = 0, parent = scene) {
  const g0 = grp(x, yb, z, ry, parent);
  box(0.8, 0.58, 0.3, '#d9dbd6', 0, 0.08, 0, { parent: g0, cast: true, t: 0.012 });
  plane(0.44, 0.44, getFanMat(), -0.13, 0.37, 0.152, { parent: g0 });
  box(0.16, 0.4, 0.02, '#aeb2b0', 0.26, 0.17, 0.155, { parent: g0, outline: false });
  box(0.7, 0.08, 0.26, '#6d7078', 0, 0, 0, { parent: g0, outline: false });
  return g0;
}

// ---- 腳踏車：車身沿本地 x 軸，前輪在 +x ----
let bikeParts = null;
function getBikeParts() {
  return bikeParts ??= {
    tire: new THREE.TorusGeometry(0.32, 0.025, 6, 28),
    spoke: new THREE.CircleGeometry(0.3, 16),
    spokeMat: toon('#9aa0a8', { opacity: 0.35, side: THREE.DoubleSide }),
  };
}

export function bicycle(x, z, ry, color) {
  const { tire, spoke, spokeMat } = getBikeParts();
  const g0 = grp(x, 0, z, ry);
  const fr = toon(color), metal = '#b9bec6';
  for (const wx of [-0.52, 0.52]) {
    const t = new THREE.Mesh(tire, toon('#23262e'));
    t.position.set(wx, 0.345, 0); add(t, { parent: g0, t: 0.008 });
    const s = new THREE.Mesh(spoke, spokeMat);
    s.position.set(wx, 0.345, 0); g0.add(s);
    const f = new THREE.Mesh(G('fender', () => new THREE.TorusGeometry(0.37, 0.014, 4, 16, PI * 0.75)), fr);
    f.position.set(wx, 0.345, 0); f.rotation.z = PI * 0.12; add(f, { parent: g0, t: 0.006 });
  }
  const P0 = [-0.52, 0.345, 0], F0 = [0.52, 0.345, 0], BB = [-0.05, 0.3, 0], ST = [-0.22, 0.85, 0], HB = [0.44, 0.72, 0], HT = [0.4, 0.98, 0];
  rod(BB, ST, 0.02, fr, { parent: g0 });
  rod(BB, [0.2, 0.42, 0], 0.022, fr, { parent: g0 });
  rod([0.2, 0.42, 0], HB, 0.022, fr, { parent: g0 });
  rod(BB, P0, 0.014, fr, { parent: g0 });
  rod([-0.2, 0.8, 0], P0, 0.012, fr, { parent: g0 });
  rod(HB, F0, 0.016, metal, { parent: g0 });
  rod(HB, HT, 0.02, metal, { parent: g0 });
  rod([0.33, 1.02, -0.3], [0.33, 1.02, 0.3], 0.013, metal, { parent: g0 });
  rod(HT, [0.33, 1.02, 0], 0.015, metal, { parent: g0 });
  box(0.26, 0.07, 0.16, '#2a2b30', -0.24, 0.86, 0, { parent: g0, t: 0.01 });                   // 座墊
  box(0.3, 0.22, 0.36, toon('#aeb4bc', { opacity: 0.55 }), 0.64, 0.8, 0, { parent: g0 });       // 前籃
  box(0.3, 0.02, 0.36, '#8a9098', 0.64, 0.8, 0, { parent: g0, t: 0.006 });
  box(0.36, 0.02, 0.18, '#8a9098', -0.5, 0.78, 0, { parent: g0, t: 0.006 });                   // 後貨架
  rod([-0.34, 0.78, 0], [-0.52, 0.345, 0], 0.01, '#8a9098', { parent: g0, outline: false });
  rod(BB, [-0.2, 0.02, 0.18], 0.012, '#8a9098', { parent: g0, outline: false });               // 側柱
  return g0;
}

// 便利商店外觀：牆體、玻璃、自動門、雨棚、招牌、立式燈箱、自販機等
// 店面範圍 x -6 ~ 4、z -6 ~ 1，正面朝 +z，右側（x = 4）也有玻璃
import * as THREE from 'three';
import { PI, reduceMotion, onTick } from '../../engine/context.js';
import { pLight } from '../../engine/lights.js';
import { rand, pick } from '../../engine/random.js';
import { canvasTex, rr, txt, FONT } from '../../engine/canvas.js';
import { drawBird } from './brand.js';
import { toon, glow } from '../../engine/materials.js';
import { G, add, box, cyl, plane, rod, grp } from '../../engine/geometry.js';
import { glassPane } from './shaders/glass.js';
import { acUnit } from './props.js';
import { WALL, FRAME, KICK, CANOPY, CORAL, MUSTARD, TEAL, CREAM } from './palette.js';
import { cue } from '../../engine/audio.js';

export function buildStoreExterior() {
  // ---- 地板 ----
  const floorTex = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#f1e8d6'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#e8ddc8'; g.fillRect(0, 0, w / 2, w / 2); g.fillRect(w / 2, w / 2, w / 2, w / 2);
    g.strokeStyle = '#cbbfa8'; g.lineWidth = 3;
    g.strokeRect(0, 0, w / 2, w / 2); g.strokeRect(w / 2, w / 2, w / 2, w / 2); g.strokeRect(w / 2, 0, w / 2, w / 2); g.strokeRect(0, w / 2, w / 2, w / 2);
  }, { repeat: [10, 7] });
  box(10, 0.12, 7, toon('#ffffff', { map: floorTex, emissive: '#3b2e1e', ei: 0.6 }), -1, 0, -2.5, { outline: false });

  // ---- 牆體、招牌帶、屋頂 ----
  box(10, 3.8, 0.2, WALL, -1, 0, -5.9, { cast: true, t: 0.03 });
  box(0.2, 3.8, 7, WALL, -5.9, 0, -2.5, { cast: true, t: 0.03 });
  box(0.2, 3.8, 3.2, WALL, 3.9, 0, -4.4, { cast: true, t: 0.03 });
  box(0.35, 2.8, 0.25, WALL, -5.83, 0, 0.88, { t: 0.02 });
  box(0.3, 2.8, 0.3, WALL, 3.85, 0, 0.85, { t: 0.02 });
  box(10.3, 1.05, 0.3, WALL, -1, 2.75, 0.85, { cast: true, t: 0.03 });
  box(0.3, 1.05, 3.8, WALL, 3.85, 2.75, -0.9, { cast: true, t: 0.03 });
  box(10.3, 0.16, 7.3, '#9a958c', -1, 3.8, -2.5, { cast: true, t: 0.03 });
  box(10.3, 0.35, 0.14, WALL, -1, 3.96, 1.08, { t: 0.02 });
  box(10.3, 0.35, 0.14, WALL, -1, 3.96, -6.08, { t: 0.02 });
  box(0.14, 0.35, 7.3, WALL, -6.08, 3.96, -2.5, { t: 0.02 });
  box(0.14, 0.35, 7.3, WALL, 4.08, 3.96, -2.5, { t: 0.02 });
  box(1.0, 0.9, 1.0, '#bdb8ac', 2.4, 3.96, -4.8, { cast: true });     // 屋頂出入口
  box(0.1, 0.12, 5.5, '#8d8f94', -5.4, 3.96, -2.8);                   // 冷媒管

  // ---- 腳踢板、窗框、玻璃 ----
  box(6.9, 0.3, 0.14, KICK, -2.2, 0.12, 0.93);
  box(0.55, 0.3, 0.14, KICK, 3.425, 0.12, 0.93);
  box(0.14, 0.3, 3.5, KICK, 3.93, 0.12, -1.05);
  for (const x of [-5.65, -3.35, -1.05, 1.25, 3.15, 3.7]) box(0.07, 2.63, 0.1, FRAME, x, 0.12, 0.95, { t: 0.01 });
  box(9.4, 0.08, 0.1, FRAME, -0.975, 2.68, 0.95, { t: 0.01 });
  box(6.9, 0.06, 0.1, FRAME, -2.2, 0.4, 0.95, { t: 0.01 });
  for (const z of [-2.8, -1.05, 0.7]) box(0.1, 2.63, 0.07, FRAME, 3.95, 0.12, z, { t: 0.01 });
  box(0.1, 0.08, 3.5, FRAME, 3.95, 2.68, -1.05, { t: 0.01 });
  glassPane(6.9, 2.26, -2.2, 1.55, 0.95);
  glassPane(0.55, 2.26, 3.425, 1.55, 0.95);
  glassPane(3.5, 2.26, 3.95, 1.55, -1.05, PI / 2);

  buildAutoDoor();
  buildCanopy();
  buildSigns();
  buildFrontProps();

  // ---- 室外機、雨水管 ----
  acUnit(-4.3, 3.96, -4.4); acUnit(-3.3, 3.96, -4.4); acUnit(0.2, 3.96, -4.9);
  acUnit(-3.5, 0, -6.3, PI); acUnit(0.3, 0, -6.3, PI);
  acUnit(-6.35, 0, -2.2, -PI / 2); acUnit(-6.35, 0, -3.3, -PI / 2);
  rod([-6.08, 3.9, 1.08], [-6.08, 0.02, 1.08], 0.045, '#9da2aa', { seg: 10 });
  rod([4.08, 3.9, -6.08], [4.08, 0.02, -6.08], 0.045, '#9da2aa', { seg: 10 });

  buildVending();
}

// ---- 自動門：每 9–16 秒開關一次 ----
function buildAutoDoor() {
  const doorL = grp(1.725, 0, 1.02), doorR = grp(2.675, 0, 1.02);
  for (const d of [doorL, doorR]) {
    d.userData.dynamic = true;
    box(0.95, 0.06, 0.05, FRAME, 0, 0.12, 0, { parent: d, t: 0.008 });
    box(0.95, 0.06, 0.05, FRAME, 0, 2.6, 0, { parent: d, t: 0.008 });
    box(0.05, 2.54, 0.05, FRAME, -0.45, 0.12, 0, { parent: d, t: 0.008 });
    box(0.05, 2.54, 0.05, FRAME, 0.45, 0.12, 0, { parent: d, t: 0.008 });
    glassPane(0.86, 2.42, 0, 1.39, 0, 0, d);
  }
  const baseL = doorL.position.x, baseR = doorR.position.x;
  box(1.95, 0.12, 0.18, FRAME, 2.2, 2.62, 1.0);
  box(0.3, 0.06, 0.08, '#20242c', 2.2, 2.56, 1.1, { t: 0.008 });   // 感應器
  box(1.9, 0.02, 0.1, '#9aa0aa', 2.2, 0.12, 1.02, { outline: false });

  let next = 4, t0 = -10;
  onTick(t => {
    if (t > next) { t0 = t; next = t + rand(9, 16); cue('door'); }
    const e = t - t0;
    let k = 0;
    if (e < 0.8) k = e / 0.8; else if (e < 3.2) k = 1; else if (e < 4.1) k = 1 - (e - 3.2) / 0.9;
    k = k * k * (3 - 2 * k);
    doorL.position.x = baseL - 0.88 * k;
    doorR.position.x = baseR + 0.55 * k;
  });
}

// ---- 雨棚、簷下燈、投在地面的窗光 ----
function buildCanopy() {
  box(10.5, 0.14, 1.35, CANOPY, -0.95, 2.72, 1.67, { cast: true, t: 0.02 });
  box(10.5, 0.14, 0.06, CORAL, -0.95, 2.66, 2.35, { t: 0.012 });
  box(10.5, 0.06, 0.065, MUSTARD, -0.95, 2.8, 2.35, { outline: false });
  box(1.1, 0.14, 3.9, CANOPY, 4.55, 2.72, -0.9, { cast: true, t: 0.02 });
  box(0.06, 0.14, 3.9, CORAL, 5.1, 2.66, -0.9, { t: 0.012 });
  box(0.065, 0.06, 3.9, MUSTARD, 5.1, 2.8, -0.9, { outline: false });
  const downLight = glow('#fff1d6', 2.2);
  for (const x of [-5, -3, -1, 1, 2.2, 3.4]) cyl(0.09, 0.09, 0.02, downLight, x, 2.7, 1.7, { outline: false, seg: 12 });
  for (const z of [-2.2, -0.6]) cyl(0.09, 0.09, 0.02, downLight, 4.55, 2.7, z, { outline: false, seg: 12 });
  pLight('#ffd49a', 22, -1.6, 2.2, 2.4, 9);
  pLight('#ffd49a', 14, 4.7, 2.2, -1.0, 7);

  const windowLightTex = canvasTex(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,200,130,0.85)'); gr.addColorStop(1, 'rgba(255,200,130,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.08, 'rgba(0,0,0,0)'); side.addColorStop(0.92, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = side; g.fillRect(0, 0, w, h);
  });
  const windowLightMat = glow('#ffffff', 0.55, { map: windowLightTex, additive: true });
  plane(7.4, 3.2, windowLightMat, -2.0, 0.02, 2.55, { rx: -PI / 2 });
  plane(3.8, 2.4, windowLightMat, 5.15, 0.02, -1.05, { rx: -PI / 2, rz: PI / 2 });
}

// ---- 招牌（偶爾閃爍）與立式燈箱 ----
function buildSigns() {
  const stripes = (g, w, h) => {
    g.fillStyle = CORAL; g.fillRect(0, h - 36, w, 16);
    g.fillStyle = MUSTARD; g.fillRect(0, h - 20, w, 20);
  };
  const frontTex = canvasTex(1536, 156, (g, w, h) => {
    g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
    stripes(g, w, h);
    drawBird(g, 110, 62, 46);
    txt(g, 'ことりマート', 180, 64, 76, TEAL, 900, 'left');
    g.font = `900 76px ${FONT}`;
    const wName = g.measureText('ことりマート').width;
    txt(g, 'KOTORI MART', 200 + wName, 74, 30, CORAL, 700, 'left');
    rr(g, w - 250, 22, 190, 82, 16); g.fillStyle = TEAL; g.fill();
    txt(g, '24時間営業', w - 155, 64, 32, CREAM, 700);
  });
  const sideTex = canvasTex(576, 156, (g, w, h) => {
    g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
    stripes(g, w, h);
    drawBird(g, 90, 62, 44);
    txt(g, 'ことり', 160, 64, 74, TEAL, 900, 'left');
    txt(g, 'MART', 400, 72, 34, CORAL, 700, 'left');
  });
  const frontMat = glow('#ffffff', 1.25, { map: frontTex });
  const sideMat = glow('#ffffff', 1.25, { map: sideTex });
  plane(10.1, 1.0, frontMat, -1, 3.27, 1.012);
  plane(3.7, 1.0, sideMat, 4.012, 3.27, -0.9, { ry: PI / 2 });

  const flick = [{ m: frontMat, next: 6, end: 0, at: [-1, 3.27, 1.1] }, { m: sideMat, next: 11, end: 0, at: [4.1, 3.27, -0.9] }];
  onTick(t => {
    for (const f of flick) {
      let k = 1;
      if (!reduceMotion) {
        if (t > f.next) { f.end = t + rand(0.25, 0.7); f.next = t + rand(8, 18); cue('flicker', ...f.at, f.end - t); }
        if (t < f.end) k = Math.sin(t * 57) > 0.25 ? 0.6 : 1;
      }
      f.m.color.setScalar(1.25 * k);
    }
  });

  // 轉角的立式燈箱招牌（ポールサイン），斜 45° 同時面對兩條路
  const poleSignTex = canvasTex(320, 320, (g, w, h) => {
    g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
    drawBird(g, w / 2, 118, 86);
    txt(g, 'ことりマート', w / 2, 240, 44, TEAL, 900);
    g.fillStyle = CORAL; g.fillRect(0, h - 44, w, 20);
    g.fillStyle = MUSTARD; g.fillRect(0, h - 24, w, 24);
  });
  const pTex = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#2b5fa8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; rr(g, 12, 12, 72, 72, 10); g.fill();
    txt(g, 'P', 48, 50, 60, '#2b5fa8', 900);
    txt(g, '駐車場 3台', 170, 50, 30, '#ffffff', 700);
  });
  const g0 = grp(5.6, 0, 5.55, PI / 4);
  cyl(0.1, 0.12, 4.5, '#c9ccd2', 0, 0, 0, { parent: g0, cast: true });
  box(1.55, 1.55, 0.32, '#e9e5dc', 0, 4.4, 0, { parent: g0, cast: true, t: 0.025 });
  const psMat = glow('#ffffff', 1.3, { map: poleSignTex });
  plane(1.42, 1.42, psMat, 0, 5.175, 0.165, { parent: g0 });
  plane(1.42, 1.42, psMat, 0, 5.175, -0.165, { parent: g0, ry: PI });
  box(1.2, 0.45, 0.14, '#2b5fa8', 0, 3.75, 0, { parent: g0, t: 0.015 });
  const pMat = glow('#ffffff', 1.05, { map: pTex });
  plane(1.12, 0.4, pMat, 0, 3.975, 0.072, { parent: g0 });
  plane(1.12, 0.4, pMat, 0, 3.975, -0.072, { parent: g0, ry: PI });
  box(0.5, 0.25, 0.5, '#9aa0a8', 0, 0, 0, { parent: g0, t: 0.015 });
}

// ---- 門口：おでん燈箱、地墊、傘架、垃圾分類箱 ----
function buildFrontProps() {
  const odenTex = canvasTex(128, 256, (g, w) => {
    g.fillStyle = '#fff7e6'; g.fillRect(0, 0, w, 256);
    g.fillStyle = '#b3432f'; g.fillRect(0, 0, w, 70);
    txt(g, 'おでん', w / 2, 36, 34, '#fff7e6', 900);
    g.fillStyle = '#e9b04a'; g.beginPath(); g.arc(44, 120, 18, 0, PI * 2); g.fill();
    g.fillStyle = '#f3ecd6'; g.fillRect(70, 104, 36, 32);
    g.fillStyle = '#8a8580'; g.beginPath(); g.moveTo(44, 150); g.lineTo(78, 190); g.lineTo(18, 190); g.fill();
    txt(g, '全品', w / 2, 212, 26, '#6a4a3a', 700);
    txt(g, '70円', w / 2, 240, 32, '#b3432f', 900);
  });
  box(0.55, 1.2, 0.3, '#3a3f4a', 0.7, 0, 1.75, { cast: true, t: 0.015 });
  plane(0.46, 0.92, glow('#ffffff', 1.15, { map: odenTex }), 0.7, 0.7, 1.902);

  const matTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#34404f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6d7b8c'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    txt(g, 'いらっしゃいませ', w / 2, h / 2, 24, '#8c9aab', 700);
  });
  box(1.9, 0.025, 0.9, toon('#ffffff', { map: matTex }), 2.2, 0, 1.55, { outline: false });

  // 傘架（透明ビニール傘、深藍、紅）
  box(0.5, 0.42, 0.32, '#9aa1ad', 3.55, 0, 1.45, { t: 0.012 });
  box(0.44, 0.03, 0.26, '#5f6672', 3.55, 0.42, 1.45, { outline: false });
  [['#dfe8ef', 0.75], ['#2f3b66', 1], ['#c85a5a', 1], ['#dfe8ef', 0.75]].forEach(([c, op], i) => {
    const g0 = grp(3.4 + i * 0.1, 0.05, 1.4 + (i % 2) * 0.1);
    g0.rotation.z = (i - 1.5) * 0.08;
    cyl(0.045, 0.012, 0.72, op < 1 ? toon(c, { opacity: op }) : c, 0, 0, 0, { parent: g0, t: 0.006, seg: 8 });
    const hdl = new THREE.Mesh(G('uh', () => new THREE.TorusGeometry(0.045, 0.012, 6, 12, PI)), toon('#3b2a22'));
    hdl.position.set(0.045, 0.78, 0); hdl.rotation.z = PI;
    add(hdl, { parent: g0, t: 0.006 });
    cyl(0.01, 0.01, 0.08, '#3b2a22', 0, 0.72, 0, { parent: g0, outline: false, seg: 6 });
  });

  const binTex = canvasTex(384, 256, (g, w, h) => {
    g.fillStyle = '#ece9e1'; g.fillRect(0, 0, w, h);
    [['#d0573f', 'もえるごみ'], ['#2f7fb8', 'かん・びん'], ['#3b9a63', 'ペットボトル']].forEach(([c, s], i) => {
      const cx = w / 6 + i * w / 3;
      g.fillStyle = c; g.fillRect(cx - 58, 18, 116, 44);
      txt(g, s, cx, 41, 20, '#ffffff', 700);
      g.fillStyle = '#1d2129'; g.beginPath(); g.ellipse(cx, 110, 36, 26, 0, 0, PI * 2); g.fill();
      g.strokeStyle = '#b9b5ab'; g.lineWidth = 3; g.strokeRect(cx - 62, 8, 124, h - 16);
    });
  });
  box(1.5, 0.95, 0.5, '#ece9e1', -4.85, 0, 1.3, { cast: true, t: 0.015 });
  box(1.56, 0.06, 0.56, '#9aa0a8', -4.85, 0.95, 1.3, { t: 0.01 });
  plane(1.46, 0.9, toon('#ffffff', { map: binTex }), -4.85, 0.5, 1.552);
}

// ---- 右側：自動販賣機、回收箱、海報框 ----
function buildVending() {
  const DRINKS = ['#3aa0d8', '#6fbf5a', '#d8a13a', '#c93a3a', '#f2f2ee', '#7a4a2e', '#e8793a', '#9fd3e8'];
  const vendTex = (body, accent) => canvasTex(256, 480, (g, w, h) => {
    g.fillStyle = body; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, 0, w, 26);
    g.fillStyle = '#eef6ff'; rr(g, 14, 36, w - 28, 230, 10); g.fill();
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
      const x = 26 + i * 36, y = 50 + r * 72;
      g.fillStyle = pick(DRINKS); rr(g, x, y, 24, 44, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 3, y + 8, 5, 26);
      g.fillStyle = '#1b2430'; g.fillRect(x - 1, y + 48, 26, 9);
      g.fillStyle = r === 2 && i > 3 ? '#ff6a4a' : '#4ab0ff'; g.fillRect(x + 7, y + 59, 10, 5);
    }
    g.fillStyle = '#3d86d6'; g.fillRect(14, 272, 120, 30); txt(g, 'つめた〜い', 74, 288, 20, '#fff', 700);
    g.fillStyle = '#d9533b'; g.fillRect(138, 272, 104, 30); txt(g, 'あったか〜い', 190, 288, 17, '#fff', 700);
    g.fillStyle = 'rgba(0,0,0,0.25)'; rr(g, 180, 316, 60, 90, 6); g.fill();
    g.fillStyle = '#1b2430'; g.fillRect(196, 330, 26, 6); g.fillRect(196, 352, 26, 20);
    g.fillStyle = '#7cf0a0'; g.fillRect(190, 382, 40, 12);
    g.fillStyle = '#12151c'; rr(g, 20, 400, 150, 60, 6); g.fill();
  });
  [['#f3f5f7', '#2f6fb3', -5.25], ['#2d5d9f', MUSTARD, -4.2]].forEach(([body, acc, z]) => {
    box(0.8, 1.83, 1.0, body, 4.45, 0, z, { cast: true, t: 0.02 });
    box(0.84, 0.08, 1.04, '#5a606b', 4.45, 1.83, z, { t: 0.01 });
    plane(0.94, 1.72, glow('#ffffff', 1.0, { map: vendTex(body, acc) }), 4.856, 0.95, z, { ry: PI / 2 });
  });
  pLight('#dfeaff', 5, 5.4, 1.2, -4.7, 5);
  box(0.42, 0.8, 0.4, '#3d7fc0', 4.3, 0, -3.35, { t: 0.012 });
  box(0.44, 0.04, 0.42, '#e8eaee', 4.3, 0.8, -3.35, { t: 0.008 });

  const posterTex = canvasTex(160, 230, (g, w) => {
    g.fillStyle = '#f7e6c8'; g.fillRect(0, 0, w, 230);
    g.fillStyle = '#8a3f2b'; g.fillRect(0, 0, w, 56);
    txt(g, '秋の新作', w / 2, 30, 28, '#f7e6c8', 900);
    g.fillStyle = '#8e3b5a'; g.beginPath(); g.ellipse(w / 2, 124, 52, 30, -0.4, 0, PI * 2); g.fill();
    g.fillStyle = '#f2c14e'; g.beginPath(); g.ellipse(w / 2 + 14, 116, 26, 16, -0.4, 0, PI * 2); g.fill();
    txt(g, '焼きいも', w / 2, 184, 30, '#8a3f2b', 900);
    txt(g, '新発売', w / 2, 214, 18, '#8a3f2b', 700);
  });
  box(0.04, 0.8, 0.58, '#3a3f4a', 4.02, 1.2, -3.25, { t: 0.008 });
  plane(0.5, 0.72, toon('#ffffff', { map: posterTex, emissive: '#2a1a0a', ei: 0.4 }), 4.045, 1.6, -3.25, { ry: PI / 2 });
}

// 街道設施：電線桿與電線、路燈與光束、交通標誌、護欄、カーブミラー、腳踏車、町內會公告欄
import * as THREE from 'three';
import { scene, PI, reduceMotion, onTick } from '../../engine/context.js';
import { pLight } from '../../engine/lights.js';
import { rng, rand } from '../../engine/random.js';
import { canvasTex, rr, txt } from '../../engine/canvas.js';
import { toon, glow } from '../../engine/materials.js';
import { G, add, box, cyl, plane, rod, grp } from '../../engine/geometry.js';
import { bicycle } from './props.js';

// 回傳路燈位置，給雨絲 shader 做打光
export function buildStreet() {
  const poles = buildPoles();
  const lampPositions = buildLamps(poles);
  buildSigns();
  buildRails();
  buildCurveMirror();
  bicycle(5.35, -2.0, 0, '#9fc3d9');
  bicycle(5.4, -1.25, 0, '#e9dcc8');
  buildNoticeBoard();
  return { lampPositions };
}

// ---- 電線桿 ----
function plateTex(text) {
  return canvasTex(64, 200, (g, w, h) => {
    g.fillStyle = '#2b5fa8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
    const chars = [...text];   // 直書
    chars.forEach((ch, i) => txt(g, ch, w / 2, 24 + i * (h - 40) / Math.max(1, chars.length - 1), 26, '#ffffff', 700));
  });
}

// 橫擔沿本地 x 軸；回傳 6 個掛線點的世界座標（最後一個是較粗的通訊線）
function uPole(x, z, ry, tigerMat, o = {}) {
  const h = o.h ?? 9;
  const g0 = grp(x, 0, z, ry);
  cyl(0.13, 0.17, h, '#a7a59c', 0, 0, 0, { parent: g0, cast: true, seg: 12, t: 0.025 });
  cyl(0.18, 0.185, 1.8, tigerMat, 0, 0.15, 0, { parent: g0, seg: 12, t: 0.015 });   // 黃黑條紋護套
  box(1.6, 0.09, 0.09, '#6c6f75', 0, h - 0.62, 0, { parent: g0, t: 0.012 });
  box(1.2, 0.09, 0.09, '#6c6f75', 0, h - 1.45, 0, { parent: g0, t: 0.012 });
  for (const ix of [-0.7, 0, 0.7]) cyl(0.035, 0.05, 0.14, '#ecebe6', ix, h - 0.53, 0, { parent: g0, seg: 8, t: 0.008 });
  for (const ix of [-0.5, 0.5]) cyl(0.03, 0.045, 0.12, '#ecebe6', ix, h - 1.36, 0, { parent: g0, seg: 8, t: 0.008 });
  if (o.trans) {   // 變壓器
    cyl(0.26, 0.26, 0.85, '#9aa0a6', 0, h - 3.1, 0.42, { parent: g0, cast: true, seg: 12 });
    cyl(0.27, 0.27, 0.05, '#7d838a', 0, h - 2.25, 0.42, { parent: g0, seg: 12, t: 0.01 });
    box(0.1, 0.06, 0.3, '#6c6f75', 0, h - 2.6, 0.2, { parent: g0, t: 0.01 });
  }
  box(0.25, 0.35, 0.14, '#7d838a', 0, h - 4.3, -0.2, { parent: g0, t: 0.012 });
  for (let y = 2.3, k = 0; y < h - 1.8; y += 0.42, k++) {   // 腳踏釘
    const s = k % 2 ? 1 : -1;
    rod([s * 0.13, y, 0], [s * 0.32, y, 0], 0.014, '#6c6f75', { parent: g0, outline: false, seg: 5 });
  }
  if (o.plate) plane(0.19, 0.6, toon('#ffffff', { map: plateTex(o.plate) }), 0, 2.5, 0.185, { parent: g0 });
  g0.updateMatrixWorld(true);
  const pts = [[-0.7, h - 0.44, 0], [0.7, h - 0.44, 0], [0, h - 0.44, 0], [-0.5, h - 1.27, 0], [0.5, h - 1.27, 0], [0, h - 3.7, -0.16]]
    .map(p => g0.localToWorld(new THREE.Vector3(...p)));
  return { pts, x, z };
}

function buildPoles() {
  const tigerTex = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#f0c63a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d1f24';
    for (let i = -4; i < 14; i++) { g.beginPath(); g.moveTo(0, i * 16); g.lineTo(w, i * 16 - 24); g.lineTo(w, i * 16 - 16); g.lineTo(0, i * 16 + 8); g.fill(); }
  }, { repeat: [3, 1] });
  const tigerMat = toon('#ffffff', { map: tigerTex });
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x151823 });
  const wire = (a, b, sag = 0.35, r = 0.014) => {
    const mid = a.clone().lerp(b, 0.5); mid.y -= sag * 2;
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, r, 4, false), wireMat));
  };
  const span = (A, B, sag) => {
    for (let i = 0; i < 6; i++) wire(A.pts[i], B.pts[i], sag * (i === 5 ? 1.3 : 1) * (0.9 + rng() * 0.2), i === 5 ? 0.03 : 0.014);
  };

  const PA = uPole(7.05, 2.4, PI / 4, tigerMat, { trans: true, plate: 'ことり町二丁目' });
  const PB = uPole(7.05, -6.0, 0, tigerMat, { plate: 'ことり町二丁目' });
  const PC = uPole(7.05, -13.3, 0, tigerMat);
  const PD = uPole(-7.2, 6.95, PI / 2, tigerMat, { trans: true, plate: 'ことり町一丁目' });
  const PE = uPole(9.0, 13.62, PI / 2, tigerMat);
  const PF = uPole(-13.4, 6.95, PI / 2, tigerMat);
  span(PA, PB, 0.3); span(PB, PC, 0.28); span(PA, PD, 0.55); span(PD, PF, 0.3); span(PA, PE, 0.35);
  // 引入線（接到建築物）
  wire(PA.pts[5], new THREE.Vector3(3.95, 3.55, 0.9), 0.35, 0.02);
  wire(PB.pts[5], new THREE.Vector3(3.95, 3.5, -5.9), 0.25, 0.02);
  wire(PD.pts[5], new THREE.Vector3(-10.2, 6.8, 1.62), 0.3, 0.02);
  wire(PC.pts[5], new THREE.Vector3(4.75, 4.8, -9.4), 0.3, 0.02);
  return { PA, PB, PC, PD };
}

// ---- 路燈（掛在電線桿上）與雨中的光束 ----
function buildLamps({ PA, PB, PC, PD }) {
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color('#9fbfff').multiplyScalar(0.055) } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 col; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        gl_FragColor = vec4(col * f * pow(vUv.y, 1.3), 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const lens = glow('#e8f0ff', 1.6);
  const positions = [];
  const lamp = (px, pz, dx, dz, h = 5.8, reach = 0.95) => {
    const g0 = grp(px, 0, pz, Math.atan2(dx, dz));
    rod([0, h - 0.3, 0.12], [0, h, reach], 0.03, '#c9ccd2', { parent: g0 });
    box(0.22, 0.09, 0.52, '#d5d8dc', 0, h - 0.02, reach + 0.12, { parent: g0, t: 0.012 });
    plane(0.17, 0.44, lens, 0, h - 0.025, reach + 0.12, { rx: PI / 2, parent: g0 });
    g0.updateMatrixWorld(true);
    const p = g0.localToWorld(new THREE.Vector3(0, h - 0.3, reach + 0.12));
    positions.push(p.clone());
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.1, h - 0.1, 28, 1, true), beamMat);
    cone.position.set(p.x, (h - 0.1) / 2, p.z);
    cone.layers.set(1);
    cone.userData.dynamic = true;
    scene.add(cone);
    return pLight('#cfe0ff', 45, p.x, p.y, p.z, 15);
  };
  lamp(PA.x, PA.z, 1, 0);
  lamp(PB.x, PB.z, 1, 0);
  lamp(PC.x, PC.z, 1, 0.2);
  const alleyLamp = lamp(PD.x, PD.z, 0, 1);

  // 巷口路燈偶爾暗一下
  let next = 14, end = 0;
  onTick(t => {
    if (!reduceMotion && t > next) { end = t + rand(0.2, 0.5); next = t + rand(15, 30); }
    alleyLamp.intensity = t < end ? 45 * (Math.sin(t * 40) > 0 ? 1 : 0.55) : 45;
  });
  return positions;
}

// ---- 交通標誌 ----
function signPost(x, z, h, face, ry, w, hgt) {
  cyl(0.035, 0.035, h, '#c9ccd2', x, 0, z, { seg: 8, t: 0.01, cast: true });
  const g0 = grp(x, h - hgt / 2 - 0.05, z, ry);
  plane(w, hgt, toon('#ffffff', { map: face, emissive: '#2a2a30', ei: 0.35, alphaTest: 0.5 }), 0, 0, 0.03, { parent: g0 });
  plane(w, hgt, toon('#8a8f98', { map: face, alphaTest: 0.5, noCache: true }), 0, 0, 0.02, { parent: g0, ry: PI });
}

function buildSigns() {
  const speedTex = canvasTex(128, 128, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 62, 0, PI * 2); g.fill();
    g.strokeStyle = '#d8342c'; g.lineWidth = 14; g.beginPath(); g.arc(64, 64, 52, 0, PI * 2); g.stroke();
    txt(g, '30', 64, 68, 58, '#1f4fa0', 900);
  });
  const stopTex = canvasTex(128, 128, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(2, 8); g.lineTo(126, 8); g.lineTo(64, 122); g.closePath(); g.fill();
    g.fillStyle = '#d8342c'; g.beginPath(); g.moveTo(12, 14); g.lineTo(116, 14); g.lineTo(64, 110); g.closePath(); g.fill();
    txt(g, '止まれ', 64, 44, 26, '#ffffff', 900);
  });
  const crossTex = canvasTex(128, 128, g => {
    g.fillStyle = '#1f5fb8'; rr(g, 2, 2, 124, 124, 10); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 5; rr(g, 8, 8, 112, 112, 8); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(64, 18); g.lineTo(112, 104); g.lineTo(16, 104); g.closePath(); g.fill();
    g.fillStyle = '#1f5fb8';
    g.beginPath(); g.arc(66, 50, 7, 0, PI * 2); g.fill();
    g.strokeStyle = '#1f5fb8'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(64, 60); g.lineTo(60, 78); g.lineTo(50, 94); g.moveTo(60, 78); g.lineTo(72, 94); g.moveTo(63, 64); g.lineTo(52, 72); g.moveTo(63, 64); g.lineTo(76, 70); g.stroke();
    for (let i = 0; i < 4; i++) g.fillRect(34 + i * 16, 98, 9, 4);
  });
  signPost(10.6, 13.55, 2.7, speedTex, PI / 2, 0.6, 0.6);   // 速限 30
  signPost(12.75, 3.1, 2.5, stopTex, PI, 0.8, 0.8);         // 止まれ（面向側街來車）
  const g0 = grp(6.6, 3.3, 13.62, PI / 2);                  // 行人穿越道標誌
  plane(0.62, 0.62, toon('#ffffff', { map: crossTex, emissive: '#10204a', ei: 0.35 }), 0, 0, 0.1, { parent: g0 });
  box(0.64, 0.64, 0.04, '#8a8f98', 0, -0.32, 0.06, { parent: g0, outline: false });
}

// ---- 護欄、ガードレール、對街綠籬 ----
function buildRails() {
  const RAIL = '#e6e8ec';
  const fence = (x0, z0, x1, z1, h = 0.8) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) { const t = i / n; cyl(0.035, 0.035, h, RAIL, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, { seg: 8, t: 0.012 }); }
    rod([x0, h - 0.04, z0], [x1, h - 0.04, z1], 0.03, RAIL, { seg: 8 });
    rod([x0, h * 0.5, z0], [x1, h * 0.5, z1], 0.025, RAIL, { seg: 8 });
  };
  fence(-13.8, 7.3, -9.0, 7.3);
  fence(7.55, -13.6, 7.55, -6.6);
  fence(7.55, -5.4, 7.55, 1.8);
  fence(12.65, -13.6, 12.65, 3.6);

  const guardRail = (x0, x1, z) => {
    for (let x = x0; x <= x1 + 1e-6; x += 2) cyl(0.05, 0.05, 0.8, '#d9dce2', x, 0, z - 0.04, { seg: 8, t: 0.012 });
    box(+(x1 - x0).toFixed(2), 0.3, 0.05, '#eceef2', (x0 + x1) / 2, 0.45, z, { t: 0.015 });
  };
  guardRail(-13.8, 2.2, 13.42); guardRail(7.8, 13.8, 13.42);

  box(17.0, 0.55, 0.3, '#2f4a3a', -5.4, 0, 13.8, { t: 0.02 });
  box(6.6, 0.55, 0.3, '#2f4a3a', 10.6, 0, 13.8, { t: 0.02 });
  for (let x = -13.6; x < 13.8; x += 0.7) if (x < 3.0 || x > 7.4) {
    const s = rand(0.28, 0.4);
    const m = new THREE.Mesh(G('hedgeBump', () => new THREE.IcosahedronGeometry(1, 1)), toon('#35584a'));
    m.scale.set(s * 1.3, s, s * 0.9); m.position.set(x, 0.5, 13.8);
    add(m, { t: 0.02 });
  }
}

// ---- 巷口的カーブミラー ----
function buildCurveMirror() {
  const mirTex = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(50, 44, 4, 64, 64, 64);
    gr.addColorStop(0, '#dfe8f4'); gr.addColorStop(0.5, '#6f7f9c'); gr.addColorStop(1, '#2a3246');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(255,200,130,0.7)'; g.beginPath(); g.ellipse(84, 84, 16, 10, 0.4, 0, PI * 2); g.fill();
  });
  const g0 = grp(-8.45, 0, 6.45, PI / 4);
  cyl(0.045, 0.045, 2.9, '#e8793a', 0, 0, 0, { parent: g0, seg: 8, t: 0.012, cast: true });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), toon('#ffffff', { map: mirTex, emissive: '#1a2030', ei: 0.6 }));
  face.position.set(0, 2.72, 0.1); g0.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.035, 6, 24), toon('#e8793a'));
  rim.position.set(0, 2.72, 0.1); add(rim, { parent: g0, t: 0.01 });
  cyl(0.36, 0.3, 0.1, '#e8793a', 0, 2.67, 0.04, { parent: g0, rx: PI / 2, seg: 20, t: 0.01 });
}

// ---- 公寓前的町內會公告欄 ----
function buildNoticeBoard() {
  const t = canvasTex(320, 200, (g, w, h) => {
    g.fillStyle = '#3f6b52'; g.fillRect(0, 0, w, h);
    const flyers = [
      [12, 14, 92, 118, '#fbf7ee', '町内会の', 'お知らせ'], [112, 20, 96, 80, '#fff1c9', '秋祭り', '10月12日'],
      [216, 12, 92, 104, '#e6f0fb', 'ゴミ出し', 'ルール'], [112, 108, 96, 80, '#fde3e0', '防災訓練', '日曜 9時'],
      [16, 138, 88, 54, '#eef6e8', '回覧板', ''], [220, 124, 86, 66, '#fbf7ee', '駐輪場', 'のお願い'],
    ];
    for (const [x, y, fw, fh, c, a, b] of flyers) {
      g.save(); g.translate(x + fw / 2, y + fh / 2); g.rotate(rand(-0.05, 0.05));
      g.fillStyle = c; g.fillRect(-fw / 2, -fh / 2, fw, fh);
      txt(g, a, 0, b ? -12 : 0, 17, '#2b3140', 900); if (b) txt(g, b, 0, 14, 14, '#6a4a3a', 700);
      g.fillStyle = '#d8342c'; g.beginPath(); g.arc(0, -fh / 2 + 6, 3.5, 0, PI * 2); g.fill();
      g.restore();
    }
  });
  const x = -11.6, z = 5.95;
  cyl(0.05, 0.05, 2.1, '#6f5a44', x - 0.75, 0, z, { seg: 8, t: 0.012 });
  cyl(0.05, 0.05, 2.1, '#6f5a44', x + 0.75, 0, z, { seg: 8, t: 0.012 });
  box(1.6, 1.0, 0.08, '#6f5a44', x, 0.95, z, { t: 0.015, cast: true });
  plane(1.5, 0.92, toon('#ffffff', { map: t, emissive: '#1a2a20', ei: 0.5 }), x, 1.45, z + 0.042);
  box(1.8, 0.05, 0.36, '#4a3a2e', x, 2.08, z + 0.05, { t: 0.012, rx: 0.18 });
  box(0.5, 0.05, 0.06, glow('#e8f4ff', 1.8), x, 2.0, z + 0.2, { outline: false });
}

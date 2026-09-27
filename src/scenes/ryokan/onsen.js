// 露天風呂：岩石圍成的溫泉池、乳白綠水面、竹筒湯口與細流、竹垣、木平台、木桶與板凳、湯けむり
import * as THREE from 'three';
import { scene, PI, onTick } from '../../engine/context.js';
import { rand, pick } from '../../engine/random.js';
import { canvasTex } from '../../engine/canvas.js';
import { soft, glow } from '../../engine/materials.js';
import { box, cyl, plane, rod, grp } from '../../engine/geometry.js';
import { rock, plankMat } from './shapes.js';
import { waterMesh } from './water.js';
import { W } from './wind.js';
import { C } from './palette.js';
import { LV, ONSEN, DECK, LANTERNS } from './layout.js';

export function buildOnsen() {
  const { cx, cz, rx, rz } = ONSEN;
  const yukimi = LANTERNS.find(l => l[2] === 'yukimi');
  // 乳白溫泉：倒影淡、起伏小；漣漪只從湯口落點擴散（這裡在 onLevel 裡建造，燈與湯口用世界座標）
  scene.add(waterMesh({
    ellipse: { cx, cz, rx, rz, depth: 0.5 }, y: 0.1, shallow: '#98cbc8', deep: '#4c93a0', shore: '#cfe6e0', sky: ['#8c7caa', '#3a3060'],
    lamps: [[yukimi[0], LV.up + 0.72, yukimi[1]]], lampColor: '#ffb070', emitters: [[cx + rx - 0.47, cz - 0.54, 2.2, 0.8]], reflect: 0.55, calm: 0.5,
  }));

  // ---- 圍池的岩石（靠平台那側留給木板）----
  const stones = [C.stone, C.stoneDark, C.stoneWarm, '#7a7680'];
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * PI * 2 + rand(-0.05, 0.05);
    const s = Math.sin(a), c = Math.cos(a);
    if (s < -0.75 && Math.abs(c) < 0.55) continue;
    const r = rand(0.3, 0.52);
    rock(cx + c * (rx + 0.12), 0, cz + s * (rz + 0.12), r * 1.1, r * 0.75, r, pick(stones), { sink: 0.35 });
    if (i % 3 === 0) rock(cx + c * (rx + 0.6), 0, cz + s * (rz + 0.55), r * 0.8, r * 0.55, r * 0.8, pick(stones), { sink: 0.3 });
  }

  // ---- 竹筒湯口：大石上架著竹管，細細的熱水落進池裡 ----
  rock(cx + rx + 0.3, 0, cz - 0.9, 0.9, 1.25, 0.8, C.stoneDark, { sink: 0.3 });
  const spoutA = [cx + rx + 0.15, 1.1, cz - 0.75], spoutB = [cx + rx - 0.45, 0.98, cz - 0.55];
  rod(spoutA, spoutB, 0.055, C.bamboo, { seg: 8 });
  const streamTex = canvasTex(16, 64, (g, w, h) => {
    for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? 'rgba(230,245,255,0.9)' : 'rgba(170,215,235,0.5)'; g.fillRect(0, y, w, 8); }
  });
  streamTex.wrapT = THREE.RepeatWrapping;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.86, 8, 1, true), glow('#ffffff', 1.1, { map: streamTex, opacity: 0.75 }));
  stream.position.set(spoutB[0] - 0.02, 0.55, spoutB[2] + 0.01);
  stream.userData.dynamic = true;
  scene.add(stream);
  onTick(t => { streamTex.offset.y = -t * 2.2; });

  // ---- 竹垣：右側一整面、左側一小段 ----
  const fenceTex = canvasTex(256, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 8) { g.fillStyle = pick(['#6f8f4f', '#5f7f45', '#7fa05a', '#8aa864']); g.fillRect(x, 0, 7, h); g.fillStyle = 'rgba(30,40,20,0.5)'; g.fillRect(x + 7, 0, 1, h); }
  }, { repeat: [3, 1] });
  const fenceMat = soft('#ffffff', { map: fenceTex, side: THREE.DoubleSide });
  const fence = (x, z0, z1, h) => {
    const len = z1 - z0, zc = (z0 + z1) / 2;
    plane(len, h, fenceMat, x, h / 2 + 0.05, zc, { ry: -PI / 2, cast: true });
    for (const y of [0.35, h * 0.55, h - 0.1]) rod([x - 0.05, y, z0], [x - 0.05, y, z1], 0.035, C.bambooDark, { seg: 6 });
    for (let z = z0; z <= z1 + 1e-6; z += len / Math.max(1, Math.round(len / 1.6))) cyl(0.06, 0.06, h + 0.2, C.woodDark, x, 0, z, { seg: 8, cast: true });
  };
  fence(cx + 3.4, cz - 4.0, cz + 2.2, 2.0);
  fence(cx - 2.95, cz - 1.7, cz + 0.2, 1.6);

  // ---- 湯屋前的木平台、木桶、手桶、板凳 ----
  const deckW = DECK.x1 - DECK.x0, deckD = DECK.z1 - DECK.z0;
  box(deckW, 0.18, deckD, plankMat(C), (DECK.x0 + DECK.x1) / 2, 0, (DECK.z0 + DECK.z1) / 2, { cast: true });
  const bucket = (x, z, r, h, yb = 0.18) => {
    cyl(r, r * 0.9, h, C.woodLight, x, yb, z, { seg: 14, cast: true });
    cyl(r + 0.01, r + 0.01, 0.03, C.woodDark, x, yb + h * 0.25, z, { seg: 14 });
    cyl(r + 0.01, r + 0.01, 0.03, C.woodDark, x, yb + h * 0.75, z, { seg: 14 });
  };
  const bx = DECK.x0 + 0.7, bz = DECK.z1 - 0.7;
  bucket(bx, bz, 0.2, 0.18);
  bucket(bx + 0.02, bz, 0.19, 0.17, 0.36);  // 疊放
  bucket(bx + 0.55, bz + 0.3, 0.16, 0.16);
  const hand = grp(DECK.x1 - 0.6, 0.18, DECK.z1 - 0.5);      // 手桶：有提把
  cyl(0.15, 0.13, 0.18, C.woodLight, 0, 0, 0, { parent: hand, seg: 14 });
  rod([-0.15, 0.1, 0], [-0.15, 0.3, 0], 0.015, C.woodDark, { parent: hand });
  rod([0.15, 0.1, 0], [0.15, 0.3, 0], 0.015, C.woodDark, { parent: hand });
  rod([-0.15, 0.3, 0], [0.15, 0.3, 0], 0.02, C.woodDark, { parent: hand });
  const sx = DECK.x1 - 1.3, sz = DECK.z1 - 0.6;
  box(0.4, 0.05, 0.26, C.woodLight, sx, 0.38, sz, { cast: true });   // 風呂椅子
  for (const [dx, dz] of [[-0.16, -0.1], [0.16, -0.1], [-0.16, 0.1], [0.16, 0.1]]) box(0.04, 0.2, 0.04, C.woodDark, sx + dx, 0.18, sz + dz);

  buildSteam();
}

// ---- 湯けむり：從水面慢慢升起、變大、飄散，陣風時被吹斜 ----
function buildSteam() {
  const { cx, cz, rx, rz } = ONSEN;
  const tex = canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const puffs = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xece6f4, transparent: true, depthWrite: false, opacity: 0 }));
    s.layers.set(1);
    scene.add(s);
    const a = rand(0, PI * 2), d = Math.sqrt(rand(0, 1)) * 0.85;
    puffs.push({ s, x: cx + Math.cos(a) * rx * d, z: cz + Math.sin(a) * rz * d, life: rand(6.5, 9.5), ph: rand(0, 1) });
  }
  onTick(t => {
    const g = W.gust.value, d = W.dir.value, drift = 0.5 + 2.2 * g;
    for (const p of puffs) {
      const f = ((t / p.life) + p.ph) % 1;
      p.s.position.set(p.x + Math.sin(f * 3 + p.ph * 9) * 0.25 + f * drift * d.x, 0.2 + f * (2.6 - g), p.z + Math.cos(f * 2.3 + p.ph * 7) * 0.2 + f * drift * d.y);
      p.s.scale.setScalar(0.5 + f * 1.9);
      p.s.material.opacity = Math.sin(f * PI) * 0.2;
    }
  });
}

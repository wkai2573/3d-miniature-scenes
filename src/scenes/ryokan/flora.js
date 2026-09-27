// 植物：楓樹（橘、紅、黃）、杉、竹林、苔丘、灌木、地上的落葉
// 樹冠與竹子用 windy() 材質，在 vertex shader 依世界座標高度輕擺，合併網格與 InstancedMesh 都適用
import * as THREE from 'three';
import { U, PI } from '../../engine/context.js';
import { rng, rand, pick } from '../../engine/random.js';
import { soft } from '../../engine/materials.js';
import { G, add, cyl, rod, inst } from '../../engine/geometry.js';
import { blob } from './shapes.js';
import { C } from './palette.js';
import { MAPLES, CEDARS, BAMBOO, PATH, POND, TSUKUBAI, LANTERNS, ZEN, GATE, FENCE_Z } from './layout.js';

// ---- 微風搖擺材質 ----
const windCache = new Map();
export function windy(color, amp = 0.02, o = {}) {
  const key = [color, amp, o.flat ? 1 : 0].join('|');
  if (windCache.has(key)) return windCache.get(key);
  const m = soft(color, { noCache: true, flat: o.flat, side: o.side });
  m.onBeforeCompile = sh => {
    sh.uniforms.time = U.time;
    sh.uniforms.windAmp = { value: amp };
    sh.vertexShader = 'uniform float time;\nuniform float windAmp;\n' + sh.vertexShader.replace('#include <project_vertex>', /* glsl */`
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelMatrix * mvPosition;
      float hgt = max( mvPosition.y - 0.8, 0.0 );
      float sway = sin( time * 1.2 + mvPosition.x * 0.35 + mvPosition.z * 0.25 ) + 0.35 * sin( time * 2.6 + mvPosition.x * 1.3 );
      mvPosition.x += sway * windAmp * hgt;
      mvPosition.z += sway * windAmp * 0.45 * hgt;
      mvPosition = viewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'wind' + (o.flat ? 'F' : '');
  windCache.set(key, m);
  return m;
}

export function buildFlora() {
  for (const [x, z, s, ci] of MAPLES) maple(x, z, s, ci);
  for (const [x, z, s] of CEDARS) cedar(x, z, s);
  bambooGrove();
  mossMounds();
  shrubs();
  fallenLeaves();
}

// ---- 楓樹：短樹幹分出三枝，末端長出圓潤的葉團 ----
function maple(x, z, s, ci) {
  const bark = soft('#4a3530');
  const top = [x + rand(-0.2, 0.2) * s, 1.5 * s, z + rand(-0.2, 0.2) * s];
  rod([x, -0.1, z], top, 0.14 * s, bark, { cast: true, seg: 7 });
  const centers = [];
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + rand(-0.4, 0.4);
    const c = [top[0] + Math.cos(a) * 0.95 * s, top[1] + rand(0.6, 1.1) * s, top[2] + Math.sin(a) * 0.95 * s];
    rod(top, c, 0.075 * s, bark, { seg: 6, cast: true });
    centers.push(c);
  }
  centers.push([top[0], top[1] + 1.55 * s, top[2]]);
  for (const c of centers) for (let k = 0; k < 3; k++) {
    const r = rand(0.55, 0.85) * s;
    const col = rng() < 0.65 ? C.maple[ci] : pick(C.maple);
    blob(c[0] + rand(-0.45, 0.45) * s, c[1] + rand(-0.2, 0.35) * s, c[2] + rand(-0.45, 0.45) * s, r, r * 0.85, r, windy(col, 0.018));
  }
}

// ---- 杉：疊起來的圓錐 ----
function cedar(x, z, s) {
  cyl(0.12 * s, 0.18 * s, 2.4 * s, '#3e2c24', x, 0, z, { seg: 7, cast: true });
  for (let i = 0; i < 4; i++) {
    const r = (1.5 - 0.28 * i) * s, h = (1.9 - 0.3 * i) * s, y = (1.2 + i * 1.05) * s;
    const m = new THREE.Mesh(G('cedarCone', () => new THREE.ConeGeometry(1, 1, 8)), windy(i % 2 ? C.cedar2 : C.cedar, 0.008));
    m.scale.set(r, h, r);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rand(0, PI);
    add(m, { cast: true });
  }
}

// ---- 竹林：竹稈、竹節、葉團都用 InstancedMesh ----
function bambooGrove() {
  const { x0, x1, z0, z1 } = BAMBOO;
  const culms = [], nodes = [], leaves = [];
  for (let i = 0; i < 95; i++) {
    const x = rand(x0, x1), z = rand(z0, z1), h = rand(5.5, 8.5), tx = rand(-0.05, 0.05), tz = rand(-0.05, 0.05);
    culms.push({ x, y: 0, z, h, rx: tz, rz: tx, c: pick([C.bamboo, C.bambooDark, '#8aac62']) });
    const at = y => [x - y * tx, y, z + y * tz];
    for (let y = 0.5; y < h - 0.3; y += 0.55) { const [px, py, pz] = at(y); nodes.push({ x: px, y: py, z: pz, rx: tz, rz: tx, c: '#56733f' }); }
    for (let k = 0; k < 10; k++) {
      const [px, py, pz] = at(rand(0.45, 1.0) * h);
      const sc = rand(0.75, 1.2);
      leaves.push({ x: px + rand(-0.45, 0.45), y: py, z: pz + rand(-0.45, 0.45), w: 0.2 * sc, h: 0.07 * sc, d: 0.5 * sc, ry: rand(0, PI), rz: rand(-0.4, 0.4), rx: rand(-0.3, 0.3), c: pick(['#4f7a3f', '#5a8544', '#43693a', '#6a9450']) });
    }
  }
  const stalk = windy('#ffffff', 0.012), leaf = windy('#ffffff', 0.012, { flat: true });
  inst(new THREE.CylinderGeometry(0.05, 0.065, 1, 7).translate(0, 0.5, 0), stalk, culms).castShadow = true;
  inst(new THREE.CylinderGeometry(0.072, 0.072, 0.035, 7), stalk, nodes);
  inst(new THREE.IcosahedronGeometry(1, 1), leaf, leaves).castShadow = true;
}

// ---- 苔丘：避開小徑、池塘、蹲踞、燈籠與樹幹 ----
function distToPath(x, z) {
  let d = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1];
    const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return d;
}
function mossMounds() {
  const mats = [soft(C.moss), soft(C.moss2), soft('#48684c')];
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 30; tries++) {
    const x = rand(-11.3, ZEN.x0 - 0.4), z = rand(FENCE_Z + 0.5, GATE.z - 0.4), r = rand(0.5, 1.2);
    if (distToPath(x, z) < 0.8 + r * 0.6) continue;
    if (((x - POND.cx) / (POND.rx + 0.7)) ** 2 + ((z - POND.cz) / (POND.rz + 0.7)) ** 2 < 1) continue;
    if (Math.hypot(x - TSUKUBAI.x - 0.5, z - TSUKUBAI.z) < 1.6) continue;
    if (LANTERNS.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 0.9)) continue;
    if (MAPLES.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 0.5)) continue;
    blob(x, 0, z, r, rand(0.18, 0.34), r * rand(0.7, 1.0), pick(mats), { detail: 2, cast: false });
    placed++;
  }
}

// ---- 修剪成圓團的灌木（少數是轉紅的杜鵑）----
function shrub(x, z, s = 1, red = false) {
  const m = soft(red ? C.shrubRed : C.shrub);
  for (let i = 0; i < 3; i++) {
    const r = rand(0.35, 0.55) * s;
    blob(x + rand(-0.35, 0.35) * s, r * 0.55, z + rand(-0.3, 0.3) * s, r, r * 0.8, r, m);
  }
}
function shrubs() {
  for (const [x, z, s, red] of [[-8.3, -2.3, 1, false], [-7.8, -1.2, 0.8, true], [-9.2, -4.2, 0.9, false], [3.3, -3.2, 0.8, false],
    [-8.9, 2.3, 0.9, true], [-6.6, 2.3, 0.8, false], [-3.3, 2.4, 0.7, false], [2.3, 2.3, 0.8, true],
    [-1.8, 10.3, 0.8, true], [2.2, 10.3, 0.8, false], [-9.5, -7.2, 1, false], [3.5, -9.6, 0.9, false]]) shrub(x, z, s, red);
  for (let x = 3.0; x <= 11.2; x += 0.9) shrub(x, 11.65, 0.75, rng() < 0.2);   // 枯山水前緣的綠籬
  for (let x = 5.6; x <= 11.2; x += 0.9) shrub(x, FENCE_Z - 0.1, 0.7, rng() < 0.15);   // 露天風呂前的綠籬
}

// ---- 落葉：楓樹下與小徑邊 ----
function fallenLeaves() {
  const list = [];
  for (const [x, z, s] of MAPLES) {
    for (let i = 0; i < 70 * s; i++) {
      const a = rand(0, PI * 2), d = Math.pow(rand(0, 1), 0.6) * 2.6 * s;
      list.push({ x: x + Math.cos(a) * d, y: 0.02 + rand(0, 0.02), z: z + Math.sin(a) * d, ry: rand(0, PI), rx: rand(-0.2, 0.2), c: pick(C.maple) });
    }
  }
  for (const [x, z] of PATH) for (let i = 0; i < 4; i++) {
    const dx = rand(-0.6, 0.6), dz = rand(-0.5, 0.5), onStone = Math.hypot(dx, dz) < 0.28;
    list.push({ x: x + dx, y: onStone ? 0.115 : 0.02, z: z + dz, ry: rand(0, PI), c: pick(C.maple) });
  }
  inst(new THREE.PlaneGeometry(0.16, 0.11).rotateX(-PI / 2), soft('#ffffff', { side: THREE.DoubleSide }), list);
}

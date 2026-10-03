// 紅葉屋的雨與雪：落在整座浮島上，越過島緣繼續落進雲海；主屋、湯屋與渡り廊下的屋頂底下不下
// 雨絲靠近石燈籠與玄關時被染成暖色；雪花跟著陣風斜斜飄（粒子本身在 src/engine/precip.js）
// 下雨時露天的地面（泥地、砂地、飛石）會濺起水花，水花的位置與高度查一張地形高度圖
import * as THREE from 'three';
import { scene, U, DPR, onTick } from '../../engine/context.js';
import { seeded } from '../../engine/random.js';
import { ENV, EU } from '../../engine/env.js';
import { buildRain, buildSnow } from '../../engine/precip.js';
import { W } from './wind.js';
import { heightAt, isWater, pondE, wallUpZ, wallLowZ } from './terrain.js';
import { HX, HZ, LV, INN, ANNEX, DECK, ONSEN, ZEN_ROCKS, PATH, PATH_B, PATH_UP, STAIRS_UP, STAIRS_LOW, LANTERNS, GENKAN_X } from './layout.js';

const CORR_Z = INN.z1 - 2.5;
const inside = (x, z, x0, x1, z0, z1) => x > x0 && x < x1 && z > z0 && z < z1;
const underRoof = (x, z) =>
  inside(x, z, INN.x0 - 0.8, INN.x1 + 0.8, INN.z0 - 1.3, INN.z1 + 1.3) ||
  inside(x, z, ANNEX.x0 - 0.6, ANNEX.x1 + 0.6, ANNEX.z0 - 0.65, ANNEX.z1 + 0.65) ||
  inside(x, z, INN.x1, ANNEX.x0, CORR_Z - 1.1, CORR_Z + 1.1);

export function buildWeather() {
  const area = { x: [-HX, HX], z: [-HZ, HZ], y: [-5, 16], skip: underRoof };
  const lamps = LANTERNS.filter(l => l[3]).map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.9, z));
  buildRain({ ...area, n: 1375, lamps, lampTint: [1.0, 0.72, 0.42], warm: { at: [GENKAN_X, LV.up + 1.6, INN.z1 + 1.6] } });
  const { drift } = buildSnow({ ...area, n: 1425, size: 0.14 });
  onTick(() => drift.value.copy(W.dir.value).multiplyScalar(0.015 + 0.09 * W.gust.value));
  buildSplashes();
}

// ---- 地面水花 ----
// 地形高度圖：每格存水花要落的高度，不能濺水花的地方（水面、屋簷下、台階、陡坡、景石）存 -99
// 飛石比地面高 10 公分，水花要落在石面上
const CELL = 0.125, GX = Math.round(2 * HX / CELL), GZ = Math.round(2 * HZ / CELL);
const STONE_TOP = 0.1;
function splashMap() {
  const h = new Float32Array(GX * GZ), stones = [PATH, PATH_B, PATH_UP].flat();
  const onStairs = (x, z) => [[STAIRS_UP, wallUpZ], [STAIRS_LOW, wallLowZ]].some(([s, zf]) => Math.abs(x - s.x) < s.w / 2 + 0.4 && z > zf(s.x) - 0.5 && z < zf(s.x) + s.n * s.run + 0.3);
  const inEllipse = (x, z, e, k) => ((x - e.cx) / (e.rx + k)) ** 2 + ((z - e.cz) / (e.rz + k)) ** 2 < 1;
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const x = -HX + (i + 0.5) * CELL, z = -HZ + (j + 0.5) * CELL;
    let y = heightAt(x, z);
    if (stones.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.3)) y += STONE_TOP;
    const bad = Math.abs(x) > HX - 0.4 || Math.abs(z) > HZ - 0.4 || underRoof(x, z) || isWater(x, z) || pondE(x, z) < 1.12 ||
      inEllipse(x, z, ONSEN, 0.35) || (x > DECK.x0 - 0.3 && x < DECK.x1 + 0.3 && z > DECK.z0 - 0.3 && z < DECK.z1 + 0.3) ||
      onStairs(x, z) || ZEN_ROCKS.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r + 0.25);
    h[j * GX + i] = bad ? -99 : y;
  }
  const out = h.slice();                                          // 陡坡（石垣、築山邊坡）：和鄰格差太多就不濺
  for (let j = 1; j < GZ - 1; j++) for (let i = 1; i < GX - 1; i++) {
    const c = h[j * GX + i];
    if (c < -50) continue;
    for (const n of [h[j * GX + i - 1], h[j * GX + i + 1], h[(j - 1) * GX + i], h[(j + 1) * GX + i]]) if (n > -50 && Math.abs(n - c) > 0.12) out[j * GX + i] = -99;
  }
  return out;
}

function buildSplashes() {
  const N = 2800, seed = new Float32Array(N * 2), r = seeded(6211);   // 自己的一條亂數，不影響場景擺放
  for (let i = 0; i < N * 2; i++) seed[i] = r();
  const map = new THREE.DataTexture(splashMap(), GX, GZ, THREE.RedFormat, THREE.FloatType);
  map.minFilter = map.magFilter = THREE.NearestFilter;
  map.needsUpdate = true;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: U.time, pr: { value: DPR }, amount: EU.rain, map: { value: map }, box: { value: new THREE.Vector4(-HX, -HZ, 2 * HX, 2 * HZ) } },
    vertexShader: /* glsl */`
      attribute vec2 aSeed; uniform float time, pr, amount; uniform sampler2D map; uniform vec4 box; varying float vA;
      float h(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float cyc = time * (1.6 + aSeed.x) + aSeed.y * 10.0;
        float k = floor(cyc), f = fract(cyc);
        vec2 xz = vec2(h(k * 1.37 + aSeed.x * 91.7), h(k * 2.11 + aSeed.y * 53.3));
        float y = texture2D(map, xz).r;
        vec3 p = vec3(box.x + xz.x * box.z, y + 0.03, box.y + xz.y * box.w);
        vA = (y < -50.0) ? 0.0 : (1.0 - f / 0.35) * step(f, 0.35) * step(fract(aSeed.y * 7.31), amount * 0.35);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (f * 12.0 + 2.0) * pr * 40.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        if (vA <= 0.0) discard;
        float r = length(gl_PointCoord - 0.5);
        float ring = (1.0 - smoothstep(0.36, 0.5, r)) * smoothstep(0.12, 0.3, r);
        gl_FragColor = vec4(0.75, 0.83, 1.0, ring * vA * 0.3);
      }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.layers.set(1);
  scene.add(pts);
  onTick(() => { pts.visible = ENV.rain > 0.002; });
}

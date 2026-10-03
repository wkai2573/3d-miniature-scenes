// 天氣效果：雨絲、地面水花、屋簷與走廊滴水（下雨時），以及雪花（下雪時）
// 雨絲與雪花在 src/engine/precip.js；這些都在圖層 1（不進地面反射），雨量、雪量跟著 ENV 漸變
import * as THREE from 'three';
import { scene, U, DPR, PI, onTick } from '../../engine/context.js';
import { rng, rand, pick } from '../../engine/random.js';
import { glow } from '../../engine/materials.js';
import { tmp } from '../../engine/geometry.js';
import { cue } from '../../engine/audio.js';
import { ENV, EU } from '../../engine/env.js';
import { buildRain, buildSnow } from '../../engine/precip.js';

const underRoof = (x, z) => x > -6.7 && x < 5.2 && z > -6.3 && z < 2.45;   // 店內與雨棚下不下雨、不下雪

export function buildWeather({ lampPositions }) {
  // 雨絲：GPU 端依時間下落，靠近店門偏暖、靠近路燈偏冷
  buildRain({ x: [-13.9, 13.9], z: [-13.9, 13.9], y: [0, 15], n: 1250, skip: underRoof, lamps: lampPositions, warm: { at: [-0.8, 1.6, 3.2] } });
  buildSnow({ x: [-13.9, 13.9], z: [-13.9, 13.9], y: [0, 15], n: 1050, skip: underRoof });
  buildSplashes();
  buildDrips();
}

// ---- 地面水花：每個點週期性換到隨機位置閃一下 ----
function buildSplashes() {
  const N = 1400;   // 大雨時只顯示六成（在 shader 裡篩）；數量不能改，否則後面物件從 rng 取到的亂數會變
  const seed = new Float32Array(N * 2);
  for (let i = 0; i < N * 2; i++) seed[i] = rng();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: U.time, pr: { value: DPR }, amount: EU.rain },
    vertexShader: /* glsl */`
      attribute vec2 aSeed; uniform float time; uniform float pr; uniform float amount; varying float vA;
      float h(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float cyc = time * (1.6 + aSeed.x) + aSeed.y * 10.0;
        float k = floor(cyc); float f = fract(cyc);
        vec3 p = vec3(h(k * 1.37 + aSeed.x * 91.7) * 27.6 - 13.8, 0.03, h(k * 2.11 + aSeed.y * 53.3) * 27.6 - 13.8);
        bool hidden = (p.x > -6.5 && p.x < 5.2 && p.z > -7.6 && p.z < 2.4) || (p.x < -8.8 && p.z < 3.4) || (p.x > -5.4 && p.x < 5.1 && p.z < -9.0);
        vA = hidden ? 0.0 : (1.0 - f / 0.35) * step(f, 0.35) * step(fract(aSeed.y * 7.31), amount * 0.6);
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
        gl_FragColor = vec4(0.75, 0.83, 1.0, ring * vA * 0.55);
      }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.layers.set(1);
  scene.add(pts);
  onTick(() => { pts.visible = ENV.rain > 0.002; });
}

// ---- 屋簷、公寓走廊、民宅屋簷的滴水與落地漣漪：雨停後地面還濕的時候也會滴一陣子 ----
function buildDrips() {
  const drips = [];
  for (let i = 0; i < 16; i++) drips.push({ x: rand(-6.2, 4.3), z: 2.37, y0: 2.64 });
  for (let i = 0; i < 6; i++) drips.push({ x: 5.13, z: rand(-2.8, 0.9), y0: 2.64 });
  for (let i = 0; i < 6; i++) drips.push({ x: -8.78, z: rand(-13, 1.3), y0: pick([2.7, 5.5, 8.25]) });
  for (let i = 0; i < 4; i++) drips.push({ x: rand(-4.8, 3.0), z: -9.0, y0: 2.85 });
  drips.forEach((d, i) => { d.T = rand(1.4, 2.9); d.ph = rand(0, 10); d.tf = Math.sqrt(2 * d.y0 / 9.8); d.thr = 0.08 + 0.85 * (i * 7 % drips.length) / drips.length; });

  const drop = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 4), glow('#cfe0ff', 1.3), drips.length);
  const ring = new THREE.InstancedMesh(new THREE.RingGeometry(0.8, 1.0, 20).rotateX(-PI / 2), glow('#cfe0ff', 1, { opacity: 0.45 }), drips.length);
  for (const m of [drop, ring]) { m.layers.set(1); m.frustumCulled = false; scene.add(m); }

  onTick(t => {
    drips.forEach((d, i) => {
      if (ENV.wet < d.thr) {                                         // 還沒濕或已經乾了：這一處不滴
        drop.setMatrixAt(i, tmp.m4.makeScale(0, 0, 0));
        ring.setMatrixAt(i, tmp.m4);
        d.pu = 0;
        return;
      }
      const T = Math.max(d.T, d.tf + 0.9);
      const u = (t + d.ph) % T, hang = T - d.tf - 0.45;
      let y = d.y0, s = 0, sy = 1, rs = 0;
      if (u < hang) { s = 0.35 + 0.65 * (u / hang); sy = 1 + 0.35 * u / hang; y = d.y0 - 0.02 * s; }   // 水珠慢慢長大
      else {
        const f = u - hang;
        if (f < d.tf) { y = d.y0 - 4.9 * f * f; s = 1; sy = 2.4; }   // 自由落下
        else rs = 0.03 + (f - d.tf) * 0.5;                             // 落地漣漪
      }
      if (d.pu < hang + d.tf && u >= hang + d.tf) cue('drip', d.x, d.z);   // 落地的那一格發出水滴聲
      d.pu = u;
      drop.setMatrixAt(i, tmp.m4.compose(tmp.p.set(d.x, y, d.z), tmp.q.identity(), tmp.s.set(s, s * sy, s)));
      ring.setMatrixAt(i, tmp.m4.compose(tmp.p.set(d.x, 0.03, d.z), tmp.q.identity(), tmp.s.set(rs, 1, rs)));
    });
    drop.instanceMatrix.needsUpdate = true;
    ring.instanceMatrix.needsUpdate = true;
  });
}

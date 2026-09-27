// 氛圍：閃爍的星星、庭園裡漂浮的螢火光點、偶爾飄落的楓葉、燈火搖曳
// 全部放在圖層 1（不進 AO 法線階段）
import * as THREE from 'three';
import { scene, U, DPR, PI, reduceMotion, onTick } from '../../engine/context.js';
import { rng, rand, pick } from '../../engine/random.js';
import { noise3 } from '../../engine/noise.js';
import { soft } from '../../engine/materials.js';
import { tmp } from '../../engine/geometry.js';
import { flames } from './garden.js';
import { C } from './palette.js';
import { MAPLES } from './layout.js';

export function buildAtmosphere() {
  stars();
  fireflies();
  fallingLeaves();
  flicker();
}

// ---- 星星：上半球的點，各自以不同節奏閃爍 ----
function stars() {
  const N = 700, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = rand(0, PI * 2), y = rand(0.12, 1);
    const r = Math.sqrt(1 - y * y), R = 180;
    pos.set([Math.cos(a) * r * R, y * R - 20, Math.sin(a) * r * R], i * 3);
    seed[i] = rng();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: U.time, pr: { value: DPR } },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float time; uniform float pr; varying float vA;
      void main() {
        vA = (0.35 + 0.65 * aSeed) * (0.7 + 0.3 * sin(time * (0.8 + aSeed * 2.5) + aSeed * 40.0));
        vA *= smoothstep(-5.0, 40.0, position.y);
        gl_PointSize = (1.0 + aSeed * 1.8) * pr;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(1.0, 0.96, 1.0) * vA, vA * (1.0 - smoothstep(0.2, 0.5, d)));
      }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.layers.set(1);
  scene.add(pts);
}

// ---- 螢火光點：在庭園低處緩慢漂浮、呼吸般明滅 ----
function fireflies() {
  const N = 55, pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos.set([rand(-11, 11), rand(0.3, 2.6), rand(-9, 11)], i * 3);
    seed.set([rng(), rng(), rng()], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: U.time, pr: { value: DPR }, speed: { value: reduceMotion ? 0.3 : 1 } },
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float time, pr, speed; varying float vA;
      void main() {
        float t = time * speed;
        vec3 p = position + vec3(
          sin(t * (0.21 + aSeed.x * 0.2) + aSeed.y * 30.0) * 0.9,
          sin(t * (0.37 + aSeed.z * 0.3) + aSeed.x * 20.0) * 0.35,
          cos(t * (0.19 + aSeed.y * 0.2) + aSeed.z * 25.0) * 0.9);
        vA = pow(0.5 + 0.5 * sin(t * (0.9 + aSeed.x) + aSeed.z * 50.0), 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (14.0 + aSeed.y * 10.0) * pr * 10.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = exp(-d * d * 60.0), halo = exp(-d * d * 12.0) * 0.35;
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.38) * (core * 2.2 + halo) * vA, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.layers.set(1);
  scene.add(pts);
}

// ---- 飄落的楓葉：從樹冠落下、翻轉、左右擺盪，落地停一會兒再重來 ----
function fallingLeaves() {
  const N = reduceMotion ? 8 : 22;
  const leaves = [];
  const spawn = (l, t) => {
    const [x, z, s] = pick(MAPLES);
    l.x = x + rand(-1.3, 1.3) * s; l.z = z + rand(-1.3, 1.3) * s; l.y0 = rand(2.4, 3.6) * s;
    l.t0 = t + rand(0, 6); l.v = rand(0.35, 0.6); l.ph = rand(0, 10); l.spin = rand(1.5, 3.5);
  };
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.11), soft('#ffffff', { side: THREE.DoubleSide }), N);
  for (let i = 0; i < N; i++) { const l = {}; spawn(l, rand(-8, 0)); leaves.push(l); im.setColorAt(i, tmp.col.set(pick(C.maple))); }
  im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  im.layers.set(1);
  scene.add(im);
  const e = new THREE.Euler();
  onTick(t => {
    leaves.forEach((l, i) => {
      const age = t - l.t0;
      let y = l.y0, x = l.x, z = l.z;
      if (age > 0) {
        y = Math.max(0.03, l.y0 - age * l.v);
        x += Math.sin(age * 1.6 + l.ph) * 0.35 + age * 0.08;
        z += Math.cos(age * 1.1 + l.ph) * 0.2;
      }
      const landed = y <= 0.03;
      if (landed && age - (l.y0 - 0.03) / l.v > 4) spawn(l, t);
      e.set(landed ? -PI / 2 : age * l.spin, age * 0.7 + l.ph, landed ? 0 : Math.sin(age * 2 + l.ph));
      tmp.q.setFromEuler(e);
      im.setMatrixAt(i, tmp.m4.compose(tmp.p.set(x, age > 0 ? y : -50, z), tmp.q, tmp.s.set(1, 1, 1)));
    });
    im.instanceMatrix.needsUpdate = true;
  });
}

// ---- 燈火搖曳：點光源強度與火袋亮度用雜訊輕微起伏 ----
function flicker() {
  if (reduceMotion) return;
  flames.forEach((f, i) => { f.ph = i * 17.3; });
  onTick(t => {
    for (const f of flames) {
      const n = 0.9 + 0.1 * noise3(t * 5.0, f.ph, 0) + 0.04 * noise3(t * 13.0, f.ph, 3);
      if (f.light) f.light.intensity = f.base * n;
      if (f.mat) f.mat.color.set(f.color).multiplyScalar(f.k * n);
    }
  });
}

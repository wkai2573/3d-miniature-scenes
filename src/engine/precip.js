// 降雨與降雪：粒子都在 GPU 上依時間落下、在高度範圍內循環
// 每顆粒子有自己的門檻，雨量、雪量（0 ~ 1）決定顯示多少比例，所以切換天氣時是漸漸變大、漸漸停下
// 都放在圖層 1（不進地面反射與 AO）；位置用另一條亂數產生，不影響場景物件的擺放
import * as THREE from 'three';
import { scene, U, DPR, reduceMotion, onTick } from './context.js';
import { camera, onResize } from './renderer.js';
import { seeded } from './random.js';
import { ENV, EU } from './env.js';

/**
 * 雨絲：短線段，靠近燈的地方被染上燈色、也比較亮
 * o: { x:[a,b], z:[a,b], y:[底, 頂], n, skip(x, z) 不下雨的範圍,
 *      lamps: 最多 4 盞燈的位置, lampTint, warm: { at:[x,y,z], tint } 一處暖色光源（店門、玄關）}
 * 燈光的影響會跟著 ENV.lamps（天亮關燈）變小
 */
export function buildRain(o) {
  const r = seeded(4111), N = reduceMotion ? Math.round(o.n * 0.55) : o.n;
  const [x0, x1] = o.x, [z0, z1] = o.z, [y0, y1] = o.y;
  const pos = new Float32Array(N * 6), end = new Float32Array(N * 2);
  for (let n = 0; n < N;) {
    const x = x0 + (x1 - x0) * r(), z = z0 + (z1 - z0) * r();
    if (o.skip?.(x, z)) continue;
    const y = y0 + (y1 - y0) * r();
    pos.set([x, y, z, x, y, z], n * 6);
    end[n * 2 + 1] = 1;
    n++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const lamps = (o.lamps ?? []).slice(0, 4).map(p => p.clone());
  while (lamps.length < 4) lamps.push(new THREE.Vector3(0, -100, 0));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: U.time, amount: EU.rain, lampK: EU.lamps, speed: { value: reduceMotion ? 0.35 : 1 },
      y0: { value: y0 }, H: { value: y1 - y0 },
      lamps: { value: lamps }, lampTint: { value: new THREE.Vector3(...(o.lampTint ?? [0.75, 0.88, 1.1])) },
      warmAt: { value: new THREE.Vector3(...(o.warm?.at ?? [0, -100, 0])) }, warmTint: { value: new THREE.Vector3(...(o.warm?.tint ?? [1.0, 0.72, 0.42])) },
    },
    vertexShader: /* glsl */`
      attribute float aEnd; uniform float time, speed, amount, lampK, y0, H; uniform vec3 lamps[4], lampTint, warmAt, warmTint;
      varying float vEnd, vA; varying vec3 vTint; varying float vBoost;
      void main() {
        vec3 p = position;
        vA = step(fract(sin(dot(p.xz, vec2(12.9898, 78.233))) * 43758.5453), amount);
        float sp = (9.0 + fract(p.x * 3.17 + p.z * 1.31) * 4.0) * speed;
        p.y = y0 + mod(p.y - y0 - time * sp, H);
        p.y += aEnd * (0.3 + fract(p.z * 5.3) * 0.22);
        p.x += (p.y - y0) * 0.05;   // 微微斜雨
        vec3 dw = p - warmAt;
        float warm = exp(-dot(dw, dw) / 9.0) * lampK;
        float cool = 0.0;
        for (int i = 0; i < 4; i++) { vec3 d = p - lamps[i]; d.y *= 0.6; cool += exp(-dot(d, d) / 2.5); }
        cool *= lampK;
        vTint = vec3(0.6, 0.7, 0.92) + warmTint * warm * 1.4 + lampTint * cool * 0.45;
        vBoost = (1.0 + warm * 2.0 + cool * 0.7) * (1.0 - smoothstep(H * 0.67, H, p.y - y0));
        vEnd = aEnd;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vEnd, vA; varying vec3 vTint; varying float vBoost;
      void main() {
        if (vA < 0.5) discard;
        gl_FragColor = vec4(vTint, (0.04 + 0.16 * (1.0 - vEnd)) * vBoost);
      }`,
    transparent: true, depthWrite: false,
  });
  const rain = new THREE.LineSegments(geo, mat);
  rain.frustumCulled = false;
  rain.layers.set(1);
  scene.add(rain);
  onTick(() => { rain.visible = ENV.rain > 0.002; });
  return rain;
}

/**
 * 雪花：柔邊的圓點，慢慢飄落、左右搖擺；夜裡偏暗偏藍，白天是白的
 * o: { x:[a,b], z:[a,b], y:[底, 頂], n, skip(x, z), size（直徑，公尺） }
 * 回傳的 drift uniform（vec2）可以讓場景加上風：雪花落得越久被吹得越偏
 */
export function buildSnow(o) {
  const r = seeded(9203), N = reduceMotion ? Math.round(o.n * 0.5) : o.n;
  const [x0, x1] = o.x, [z0, z1] = o.z, [y0, y1] = o.y;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let n = 0; n < N;) {
    const x = x0 + (x1 - x0) * r(), z = z0 + (z1 - z0) * r();
    if (o.skip?.(x, z)) continue;
    pos.set([x, y0 + (y1 - y0) * r(), z], n * 3);
    seed.set([r(), r(), r()], n * 3);
    n++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const drift = { value: new THREE.Vector2() }, tint = { value: new THREE.Color() };
  const ps = { value: 1 };    // 1 公尺在 1 單位深度處是幾個像素
  const setPs = () => { ps.value = innerHeight * DPR / (2 * Math.tan(camera.fov * Math.PI / 360)); };
  setPs();
  onResize(setPs);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: U.time, amount: EU.snow, speed: { value: reduceMotion ? 0.4 : 1 }, y0: { value: y0 }, H: { value: y1 - y0 },
      size: { value: o.size ?? 0.13 }, ps, pr: { value: DPR }, drift, tint,
    },
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float time, speed, amount, y0, H, size, ps, pr; uniform vec2 drift;
      varying float vA;
      void main() {
        vec3 p = position;
        float fall = (0.75 + 0.5 * aSeed.x) * speed;
        p.y = y0 + mod(p.y - y0 - time * fall, H);
        float t = time * (0.5 + aSeed.y * 0.5) * speed + aSeed.z * 40.0;
        p.x += sin(t) * 0.3 + sin(t * 2.3 + aSeed.x * 9.0) * 0.1;
        p.z += cos(t * 0.8 + aSeed.y * 7.0) * 0.3;
        p.xz += drift * (y0 + H - p.y);
        float h = p.y - y0;
        vA = step(aSeed.y, amount) * (1.0 - smoothstep(H * 0.8, H, h)) * smoothstep(0.0, 0.4, h);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(size * (0.6 + 0.8 * aSeed.z) * ps / -mv.z, 1.5 * pr, 26.0 * pr);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 tint; varying float vA;
      void main() {
        if (vA <= 0.0) discard;
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(tint, (1.0 - smoothstep(0.2, 0.5, d)) * vA * 0.9);
      }`,
    transparent: true, depthWrite: false,
  });
  const snow = new THREE.Points(geo, mat);
  snow.frustumCulled = false;
  snow.layers.set(1);
  scene.add(snow);
  const night = new THREE.Color(0.42, 0.47, 0.62), day = new THREE.Color(0.95, 0.97, 1.0);
  onTick(() => {
    snow.visible = ENV.snow > 0.002;
    tint.value.lerpColors(night, day, ENV.day);
  });
  return { snow, drift };
}

// 降雨與降雪：粒子都在 GPU 上依時間落下、在高度範圍內循環
// 每顆粒子有自己的門檻，雨量、雪量（0 ~ 1）決定顯示多少比例，所以切換天氣時是漸漸變大、漸漸停下
// 都放在圖層 1（不進地面反射與 AO）；位置用另一條亂數產生，不影響場景物件的擺放
// 場景可以傳進一把傘的遮擋（createShelter）：傘面下方、被傘面擋住的雨絲與雪花不畫；沒有傳就是沒有遮擋，畫面照舊
import * as THREE from 'three';
import { scene, U, DPR, reduceMotion, onTick } from './context.js';
import { camera, onResize } from './renderer.js';
import { seeded } from './random.js';
import { ENV, EU } from './env.js';

/**
 * 傘的遮擋：場景每格呼叫 set() 告訴雨雪傘現在的位置與形狀，雨絲與雪花在 GPU 上判斷自己有沒有被傘面擋住
 * 傘面是一個拋物面的圓頂：圓頂的底（傘緣所在的圓）圓心在 center、軸朝 axis（單位向量，從底指向傘頂），半徑 radius，頂比底高 height
 * 從粒子往正上方看，會撞到傘面的就不畫；radius 是 0 就是沒有遮擋
 * 回傳的物件可以同時給雨與雪用
 */
export function createShelter() {
  const center = new THREE.Vector3(), axis = new THREE.Vector3(0, 1, 0), shape = new THREE.Vector2();
  return {
    uniforms: { shelterCenter: { value: center }, shelterAxis: { value: axis }, shelterShape: { value: shape } },
    set(c, a, radius, height) { center.copy(c); axis.copy(a); shape.set(radius, height); },
    clear() { shape.set(0, 0); },
  };
}
const NO_SHELTER = createShelter();

const SHELTER_GLSL = /* glsl */`
  uniform vec3 shelterCenter, shelterAxis; uniform vec2 shelterShape;
  // p 正上方有沒有傘面：1 有（被擋住）、0 沒有
  // 傘面在傘的座標裡是 y = H (1 - r² / R²)；粒子往正上方走 t，代入傘面的方程式得到一個二次式，有 t > 0 的解、而且落在傘緣以內就會撞到
  float sheltered(vec3 p) {
    float R = shelterShape.x;
    if (R < 0.05) return 0.0;
    float H = shelterShape.y, R2 = R * R, k = H / R2, ua = shelterAxis.y, ul2 = 1.0 - ua * ua;
    vec3 w = p - shelterCenter, ul = vec3(0.0, 1.0, 0.0) - ua * shelterAxis;
    float ly = dot(w, shelterAxis);
    vec3 l0 = w - ly * shelterAxis;
    float ll = dot(l0, l0), lu = dot(l0, ul);
    float a = k * ul2, b = ua + 2.0 * k * lu, c = ly - H + k * ll;
    float t1 = -1.0, t2 = -1.0;
    if (abs(a) < 1e-5) { if (abs(b) > 1e-5) t1 = -c / b; }
    else {
      float d = b * b - 4.0 * a * c;
      if (d >= 0.0) { float s = sqrt(d); t1 = (-b - s) / (2.0 * a); t2 = (-b + s) / (2.0 * a); }
    }
    float hit = 0.0;
    if (t1 > 0.0 && ll + 2.0 * t1 * lu + t1 * t1 * ul2 < R2) hit = 1.0;
    if (t2 > 0.0 && ll + 2.0 * t2 * lu + t2 * t2 * ul2 < R2) hit = 1.0;
    return hit;
  }`;

/**
 * 雨絲：短線段，靠近燈的地方被染上燈色、也比較亮
 * o: { x:[a,b], z:[a,b], y:[底, 頂], n, skip(x, z) 不下雨的範圍,
 *      lamps: 最多 4 盞燈的位置, lampTint, warm: { at:[x,y,z], tint } 一處暖色光源（店門、玄關）,
 *      shelter: createShelter() 傘的遮擋}
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
      ...(o.shelter ?? NO_SHELTER).uniforms,
      time: U.time, amount: EU.rain, lampK: EU.lamps, speed: { value: reduceMotion ? 0.35 : 1 },
      y0: { value: y0 }, H: { value: y1 - y0 },
      lamps: { value: lamps }, lampTint: { value: new THREE.Vector3(...(o.lampTint ?? [0.75, 0.88, 1.1])) },
      warmAt: { value: new THREE.Vector3(...(o.warm?.at ?? [0, -100, 0])) }, warmTint: { value: new THREE.Vector3(...(o.warm?.tint ?? [1.0, 0.72, 0.42])) },
    },
    vertexShader: /* glsl */`
      attribute float aEnd; uniform float time, speed, amount, lampK, y0, H; uniform vec3 lamps[4], lampTint, warmAt, warmTint;
      ${SHELTER_GLSL}
      varying float vEnd, vA; varying vec3 vTint; varying float vBoost;
      void main() {
        vec3 p = position;
        vA = step(fract(sin(dot(p.xz, vec2(12.9898, 78.233))) * 43758.5453), amount);
        float sp = (9.0 + fract(p.x * 3.17 + p.z * 1.31) * 4.0) * speed;
        p.y = y0 + mod(p.y - y0 - time * sp, H);
        vA *= 1.0 - sheltered(vec3(p.x + (p.y - y0) * 0.05, p.y, p.z));   // 一條雨絲的兩端用同一個高度判斷，才不會被傘面切成半條
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
 * o: { x:[a,b], z:[a,b], y:[底, 頂], n, skip(x, z), size（直徑，公尺）, shelter: createShelter() 傘的遮擋 }
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
      ...(o.shelter ?? NO_SHELTER).uniforms,
      time: U.time, amount: EU.snow, speed: { value: reduceMotion ? 0.4 : 1 }, y0: { value: y0 }, H: { value: y1 - y0 },
      size: { value: o.size ?? 0.13 }, ps, pr: { value: DPR }, drift, tint,
    },
    vertexShader: /* glsl */`
      ${SHELTER_GLSL}
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
        vA = step(aSeed.y, amount) * (1.0 - smoothstep(H * 0.8, H, h)) * smoothstep(0.0, 0.4, h) * (1.0 - sheltered(p));
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

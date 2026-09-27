// 水面：池塘（深青）與溫泉（乳白綠）共用的 shader，不做即時反射
// 平靜的水：緩慢的大尺度起伏、依視角變化的天空倒影、被波紋打散的燈火倒影
// 漣漪只出現在有原因的地方：落葉入水（addRipple）、瀑布落點與湯口（固定發射點 emitters）
import * as THREE from 'three';
import { U, PI } from '../../engine/context.js';

// 所有水面共用的事件漣漪：x, z, 開始時間, 強度
const MAX_R = 8;
const rippleU = { value: Array.from({ length: MAX_R }, () => new THREE.Vector4(0, 0, -99, 0)) };
let head = 0;
export function addRipple(x, z, strength = 1) {
  rippleU.value[head].set(x, z, U.time.value, strength);
  head = (head + 1) % MAX_R;
}

const VERT = /* glsl */`
  attribute float aDepth;
  varying vec3 vW; varying float vDepth;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz; vDepth = aDepth;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FRAG = /* glsl */`
  uniform float time, reflectK, calm;
  uniform vec3 shallow, deep, shore, skyLo, skyHi, lampColor;
  uniform vec3 lamps[3];
  uniform int nLamps;
  uniform vec4 ripples[${MAX_R}];
  uniform vec4 emitters[2];      // x, z, 每秒幾圈, 強度
  varying vec3 vW; varying float vDepth;

  // 一圈往外擴散的漣漪：回傳徑向的坡度
  float ring(float r, float age, float speed) {
    float R = age * speed, w = 0.05 + age * 0.025;
    float b = (r - R) / w;
    return sin(b * 2.6) * exp(-b * b * 0.6) * exp(-age * 1.3);
  }

  void main() {
    vec2 p = vW.xz;
    // 緩慢的大尺度起伏（高度場的梯度）
    vec2 g = vec2(0.0);
    g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 1.3 + time * 0.45) * 0.026;
    g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 2.3 - time * 0.6) * 0.016;
    g += vec2(0.3, -0.95) * cos(dot(p, vec2(0.3, -0.95)) * 4.1 + time * 0.8) * 0.008;
    g *= calm;
    // 事件漣漪
    for (int i = 0; i < ${MAX_R}; i++) {
      vec4 e = ripples[i];
      float age = time - e.z;
      if (age > 0.0 && age < 3.5) {
        vec2 d = p - e.xy; float r = length(d);
        g += d / max(r, 1e-3) * ring(r, age, 0.42) * 0.22 * e.w;
      }
    }
    // 固定發射點：一個接一個的環紋
    for (int i = 0; i < 2; i++) {
      vec4 e = emitters[i];
      if (e.w <= 0.0) continue;
      vec2 d = p - e.xy; float r = length(d);
      for (int k = 0; k < 3; k++) {       // 每 1/e.z 秒生一圈，同時最多三圈
        float age = fract(time * e.z / 3.0 + float(k) / 3.0) * 3.0 / e.z;
        g += d / max(r, 1e-3) * ring(r, age, 0.35) * 0.18 * e.w;
      }
    }
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 V = normalize(cameraPosition - vW);
    vec3 Rd = reflect(-V, n);
    float fres = (0.06 + 0.94 * pow(1.0 - max(dot(n, V), 0.0), 5.0)) * reflectK;

    vec3 body = mix(shallow, deep, smoothstep(0.02, 0.5, vDepth));
    vec3 sky = mix(skyLo, skyHi, smoothstep(-0.05, 0.7, Rd.y));
    vec3 col = mix(body, sky, clamp(fres + 0.12 * reflectK, 0.0, 1.0));

    // 燈火：倒影（反射方向對準燈）＋ 燈光照在水面上的暖色
    for (int i = 0; i < 3; i++) {
      if (i >= nLamps) break;
      vec3 L = lamps[i] - vW;
      float c = max(dot(Rd, normalize(L)), 0.0);
      col += lampColor * (pow(c, 1400.0) * 2.4 + pow(c, 90.0) * 0.22) * reflectK;
      col += lampColor * exp(-dot(L.xz, L.xz) / 2.2) * 0.12;
    }
    // 岸邊一圈淺色水線
    col = mix(col, shore, (1.0 - smoothstep(0.0, 0.05, vDepth)) * 0.55);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

/**
 * o.grid: { x0, z0, x1, z1, depth(x, z) }  → 細分平面，深度由函式給（池塘：水位 − 地面）
 * o.ellipse: { cx, cz, rx, rz, depth }      → 橢圓（溫泉），中央最深
 * 其他：y, shallow, deep, shore, sky:[低, 高], lamps:[[x,y,z]…]（世界座標）, lampColor, emitters:[[x,z,每秒圈數,強度]…], reflect, calm
 */
export function waterMesh(o) {
  let geo;
  if (o.grid) {
    const { x0, z0, x1, z1, depth } = o.grid, nx = Math.ceil((x1 - x0) / 0.15), nz = Math.ceil((z1 - z0) / 0.15);
    geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = geo.attributes.position, d = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) d[i] = Math.max(0, depth(p.getX(i), p.getZ(i)));
    geo.setAttribute('aDepth', new THREE.BufferAttribute(d, 1));
  } else {
    const { cx, cz, rx, rz } = o.ellipse;
    geo = new THREE.CircleGeometry(1, 48).rotateX(-PI / 2);
    const p = geo.attributes.position, d = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      d[i] = (o.ellipse.depth ?? 0.6) * (1 - r * r) + 0.03;
      p.setXYZ(i, cx + p.getX(i) * rx, 0, cz + p.getZ(i) * rz);
    }
    geo.setAttribute('aDepth', new THREE.BufferAttribute(d, 1));
  }
  const lamps = (o.lamps ?? []).slice(0, 3).map(v => new THREE.Vector3(...v));
  while (lamps.length < 3) lamps.push(new THREE.Vector3(0, -99, 0));
  const em = (o.emitters ?? []).slice(0, 2).map(e => new THREE.Vector4(...e));
  while (em.length < 2) em.push(new THREE.Vector4(0, 0, 1, 0));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: U.time,
      reflectK: { value: o.reflect ?? 1 },
      calm: { value: o.calm ?? 1 },
      shallow: { value: new THREE.Color(o.shallow) },
      deep: { value: new THREE.Color(o.deep) },
      shore: { value: new THREE.Color(o.shore ?? '#8fa6a8') },
      skyLo: { value: new THREE.Color(o.sky?.[0] ?? '#4a3d6e') },
      skyHi: { value: new THREE.Color(o.sky?.[1] ?? '#1c1735') },
      lampColor: { value: new THREE.Color(o.lampColor ?? '#ffb35c') },
      lamps: { value: lamps },
      nLamps: { value: (o.lamps ?? []).length },
      ripples: rippleU,
      emitters: { value: em },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = o.y ?? 0;
  m.receiveShadow = false;
  return m;
}

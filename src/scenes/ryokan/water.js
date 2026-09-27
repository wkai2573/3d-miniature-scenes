// 水面：溫泉（乳白綠、泛著燈色）與池塘（深青）共用的 shader，不做即時反射
// 橢圓範圍內由邊緣淺色漸變到中央深色，加上雨滴般的細小波紋與燈火的暖色倒影
import * as THREE from 'three';
import { U, PI } from '../../engine/context.js';

const RIPPLE = /* glsl */`
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec2 rippleField(vec2 p, float t) {
    vec2 acc = vec2(0.0);
    vec2 cell = floor(p);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      float h = h21(c);
      vec2 ctr = c + 0.2 + 0.6 * vec2(h21(c + 11.3), h21(c + 27.1));
      float ph = fract(t * (0.25 + 0.2 * h) + h * 7.0);
      vec2 d = p - ctr; float r = length(d);
      float band = r - ph * 0.9;
      float w = exp(-band * band * 120.0) * (1.0 - ph) * (1.0 - ph);
      acc += d / max(r, 1e-4) * sin(band * 30.0) * w;
    }
    return acc;
  }`;

/**
 * o: { cx, cz, rx, rz, shallow, deep, lamp:[x,z], lampColor, rippleScale }
 */
export function waterMesh(o) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: U.time,
      center: { value: new THREE.Vector2(o.cx, o.cz) },
      radii: { value: new THREE.Vector2(o.rx, o.rz) },
      shallow: { value: new THREE.Color(o.shallow) },
      deep: { value: new THREE.Color(o.deep) },
      lamp: { value: new THREE.Vector2(...(o.lamp ?? [999, 999])) },
      lampColor: { value: new THREE.Color(o.lampColor ?? '#ffb35c') },
      rippleScale: { value: o.rippleScale ?? 2.5 },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      uniform float time, rippleScale; uniform vec2 center, radii, lamp; uniform vec3 shallow, deep, lampColor;
      varying vec3 vW;
      ${RIPPLE}
      void main() {
        vec2 q = (vW.xz - center) / radii;
        float r = clamp(length(q), 0.0, 1.0);
        vec3 col = mix(deep, shallow, smoothstep(0.35, 1.0, r));
        vec2 rp = rippleField(vW.xz * rippleScale, time);
        float glint = clamp(length(rp), 0.0, 1.0);
        vec2 dl = vW.xz - lamp;
        float warm = exp(-dot(dl, dl) / 2.5);
        col += lampColor * warm * (0.35 + glint * 0.5);
        col += vec3(0.75, 0.82, 1.0) * glint * 0.18;
        col *= 0.92 + 0.08 * sin(vW.x * 1.7 + time * 0.6) * sin(vW.z * 2.1 - time * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
  m.rotation.x = -PI / 2;
  m.scale.set(o.rx, o.rz, 1);
  m.position.set(o.cx, o.y ?? 0.1, o.cz);
  m.receiveShadow = false;
  return m;
}

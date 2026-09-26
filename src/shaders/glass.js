// 帶雨痕的玻璃：靜止水珠 + 往下滑的水滴與水痕 + 邊緣反光
import * as THREE from 'three';
import { U, scene } from '../core/context.js';
import { rng } from '../lib/random.js';

export function glassMat(w, h) {
  return new THREE.ShaderMaterial({
    uniforms: { time: U.time, size: { value: new THREE.Vector2(w, h) }, seed: { value: rng() * 50 } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float time; uniform vec2 size; uniform float seed;
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
      void main() {
        vec2 p = vUv * size;   // 以公尺為單位
        // 靜止水珠
        vec2 g = p * vec2(14.0, 11.0) + seed; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
        float h = h21(id);
        vec2 o = (vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5) * 0.6;
        float rr = 0.12 + 0.18 * h21(id + 1.9);
        float bead = (1.0 - smoothstep(rr * 0.4, rr, length((f - o) * vec2(1.0, 0.85)))) * step(0.68, h);
        // 往下滑的水滴（分欄，每欄速度不同）
        float colW = 0.16; float cx = p.x / colW + seed; float col = floor(cx);
        float hc = h21(vec2(col, 4.2));
        float speed = 0.16 + hc * 0.3;
        float cyc = 1.6 + hc * 1.4;
        float ym = mod(p.y + time * speed + hc * 13.0, cyc);
        float xm = (fract(cx) - 0.5) * colW + sin(p.y * 7.0 + hc * 30.0) * 0.012;
        float head = 1.0 - smoothstep(0.008, 0.02, length(vec2(xm, (ym - 0.06) * 0.8)));
        float trail = (1.0 - smoothstep(0.0015, 0.006, abs(xm))) * step(0.06, ym) * (1.0 - smoothstep(0.06, 0.75, ym));
        float run = (head + trail * 0.5) * step(0.45, hc);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(normalize(vN), V)), 3.0);
        float a = 0.06 + fres * 0.3 + bead * 0.32 + run * 0.6;
        vec3 c = mix(vec3(0.55, 0.68, 0.85), vec3(1.0, 0.93, 0.82), clamp(bead + run, 0.0, 1.0));
        c += vec3(0.25, 0.3, 0.4) * fres;
        gl_FragColor = vec4(c, clamp(a, 0.0, 0.85));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function glassPane(w, h, x, yc, z, ry = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat(w, h));
  m.position.set(x, yc, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

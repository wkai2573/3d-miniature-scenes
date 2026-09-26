// 濕潤路面：Reflector 的鏡面反射 + 程序化雨滴波紋 + 縱向拉長的倒影
// tMask 的 R 通道是濕度：0 乾燥、0.4~0.5 濕路面、接近 1 是水窪
export const WetShader = {
  name: 'WetGround',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    tMask: { value: null }, time: { value: 0 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv; varying vec2 vUv0; varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vUv0 = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D tMask; uniform float time;
    varying vec4 vUv; varying vec2 vUv0; varying vec3 vWorld;

    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

    // 兩層網格，每格隨機位置週期性擴散一圈波紋；回傳擾動向量
    vec2 rippleField(vec2 p, float t) {
      vec2 acc = vec2(0.0);
      for (int layer = 0; layer < 2; layer++) {
        float sc = layer == 0 ? 3.2 : 5.1;
        vec2 q = p * sc + float(layer) * 17.0;
        vec2 cell = floor(q);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 c = cell + vec2(float(i), float(j));
          float h = h21(c);
          vec2 ctr = c + 0.2 + 0.6 * vec2(h21(c + 11.3), h21(c + 27.1));
          float ph = fract(t * (0.5 + 0.45 * h) + h * 7.0);
          vec2 d = q - ctr; float r = length(d);
          float band = r - ph * 0.8;
          float w = exp(-band * band * 160.0) * (1.0 - ph) * (1.0 - ph);
          acc += d / max(r, 1e-4) * sin(band * 38.0) * w;
        }
      }
      return acc;
    }

    void main() {
      float mask = texture2D(tMask, vUv0).r;
      float puddle = smoothstep(0.55, 0.9, mask);
      vec2 rp = rippleField(vWorld.xz, time);
      vec4 base = vUv;
      vec2 rpc = rp / max(1.0, length(rp));
      base.xy += rpc * (0.003 + 0.007 * puddle) * base.w;
      // 沿螢幕縱向多點取樣，讓燈光倒影拉成長條
      float spread = mix(0.011, 0.0035, puddle);
      vec3 refl = vec3(0.0); float ws = 0.0;
      for (int i = -3; i <= 3; i++) {
        float fi = float(i); float w = 1.0 - abs(fi) / 4.0;
        vec4 u = base; u.y += fi * spread * base.w;
        refl += texture2DProj(tDiffuse, u).rgb * w; ws += w;
      }
      refl /= ws;
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.55 + 0.45 * pow(1.0 - clamp(V.y, 0.0, 1.0), 2.0);
      float a = clamp(mask * fres + puddle * 0.25, 0.0, 0.95);
      float glint = clamp(length(rp) * 0.8, 0.0, 1.0) * (0.2 + 0.6 * puddle) * step(0.3, mask);
      vec3 col = refl * color + vec3(0.55, 0.65, 0.85) * glint * 0.35;
      gl_FragColor = vec4(col, max(a, glint * 0.35));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

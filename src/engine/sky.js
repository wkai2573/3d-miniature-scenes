// 天空與日月：依太陽高度在四組調色盤之間內插（夜 → 藍調時刻 → 日出日落 → 白天），再依天氣蓋上一層灰
// 背景漸層、霧、半球光、主光（太陽或月亮）、曝光與泛光每格由這裡設定；場景的其他部分（雲海、水面倒影…）讀 SKY.now
// 日月跟著相機、構圖固定：從畫面左邊升起、劃過上方、從右邊落下；主光的方向也由左往右繞過場景
import * as THREE from 'three';
import { scene, U, DPR, PI, onTick } from './context.js';
import { camera, controls, renderer, bloomPass, baseDistance } from './renderer.js';
import { canvasTex } from './canvas.js';
import { seeded } from './random.js';
import { ENV } from './env.js';

// 調色盤對應的太陽高度；中間線性內插，早晨與黃昏共用
const STOPS = [['night', -0.25], ['twilight', -0.1], ['golden', 0.04], ['day', 0.4]];
// 不蓋灰的欄位：主光顏色、日月的光暈
const KEEP = new Set(['key', 'glow']);

/** 這一格的天色（已套用天氣）。欄位與場景傳入的調色盤相同，顏色是 THREE.Color */
export const SKY = { now: null };

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * o.palettes: { night, twilight, golden, day }，每組欄位相同：
 *   sky:[頂, 中, 地平線], fog, hemiSky, hemiGround, hemi(強度), key(主光顏色), keyI(主光強度),
 *   exposure, bloom(泛光強度), bloomT(泛光門檻), glow(日月光暈)，以及場景自己要用的顏色（例如雲海）
 * o.stops:   背景漸層三個顏色的位置（0 頂 ~ 1 底）
 * o.hemi / o.key: 半球光與主光；o.keyDist: 主光離目標的距離
 * o.azimuth: 相機預設方位角（度），主光以此決定左右
 * o.fog:     晴天的霧 [near, far]（寬螢幕預設視角下的距離；相機退得更遠時整段往後推，場景才不會被霧蓋住）
 */
export function setupSky(o) {
  const pals = Object.fromEntries(Object.entries(o.palettes).map(([k, p]) => [k, compile(p)]));
  const time = clonePal(pals.night), out = clonePal(pals.night);
  SKY.now = out;

  // ---- 背景：直向漸層，顏色變了才重畫 ----
  const bgc = document.createElement('canvas');
  bgc.width = 4; bgc.height = 256;
  const bg = new THREE.CanvasTexture(bgc);
  bg.colorSpace = THREE.SRGBColorSpace;
  scene.background = bg;
  let bgKey = '';
  const paintBg = cols => {
    const key = cols.map(c => c.getHexString()).join();
    if (key === bgKey) return;
    bgKey = key;
    const g = bgc.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, bgc.height);
    o.stops.forEach((s, i) => gr.addColorStop(s, '#' + cols[i].getHexString()));
    g.fillStyle = gr; g.fillRect(0, 0, bgc.width, bgc.height);
    bg.needsUpdate = true;
  };

  const bodies = celestial();
  const starVis = stars();

  // ---- 主光方向：t 從 0（升起，畫面左側稍後方）到 1（落下，畫面右側），高度越高仰角越大 ----
  const az = THREE.MathUtils.degToRad(o.azimuth);
  const toCam = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)), right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
  const dir = new THREE.Vector3();
  const bodyDir = (t, E) => {
    const a = (-20 + 220 * t) * PI / 180, el = 0.42 + 0.55 * Math.max(0, E);
    dir.copy(right).multiplyScalar(-Math.cos(a)).addScaledVector(toCam, Math.sin(a)).normalize().multiplyScalar(Math.cos(el));
    dir.y = Math.sin(el);
    return dir;
  };
  const snowGround = new THREE.Color('#c4cad8'), snowNow = new THREE.Color();
  const [fogNear, fogFar] = o.fog;

  function update() {
    // 依太陽高度找出前後兩組調色盤
    const E = ENV.sun, last = STOPS.length - 1;
    if (E <= STOPS[0][1]) copyPal(time, pals[STOPS[0][0]]);
    else if (E >= STOPS[last][1]) copyPal(time, pals[STOPS[last][0]]);
    else {
      let i = 0;
      while (E > STOPS[i + 1][1]) i++;
      lerpPal(time, pals[STOPS[i][0]], pals[STOPS[i + 1][0]], (E - STOPS[i][1]) / (STOPS[i + 1][1] - STOPS[i][1]));
    }

    // 天氣：陰雨天顏色偏灰（白天更明顯），雨天再暗一些、雪天稍亮
    const cloud = ENV.cloud, day = ENV.day;
    const grey = cloud * (0.15 + 0.6 * day), gain = 1 - 0.32 * ENV.rain * day + 0.06 * ENV.snow * day;
    copyPal(out, time);
    for (const [k, v] of Object.entries(out)) {
      if (KEEP.has(k)) continue;
      if (v?.isColor) overcast(v, grey, gain);
      else if (Array.isArray(v)) v.forEach(c => overcast(c, grey, gain));
    }

    paintBg(out.sky);
    if (scene.fog) {
      const back = Math.max(0, camera.position.distanceTo(controls.target) - baseDistance);
      scene.fog.color.copy(out.fog);
      scene.fog.near = back + fogNear * (1 - 0.3 * cloud);
      scene.fog.far = back + fogFar * (1 - 0.3 * cloud);
    }
    o.hemi.color.copy(out.hemiSky);
    o.hemi.groundColor.copy(out.hemiGround).lerp(snowNow.copy(snowGround).multiplyScalar(0.25 + 0.75 * day), ENV.cover * 0.45);   // 積雪把地面的反光提亮
    o.hemi.intensity = out.hemi * (1 - 0.15 * ENV.rain * day);

    // 主光：太陽在地平線上就用太陽，否則用月亮；日出日落那一刻兩者都貼著地平線，強度降到 0 再換邊
    const up = E >= 0, t = up ? (ENV.hour - 6) / 12 : ((ENV.hour - 18 + 24) % 24) / 12;
    o.key.position.copy(o.key.target.position).addScaledVector(bodyDir(t, Math.abs(E)), o.keyDist);
    o.key.color.copy(out.key);
    o.key.intensity = out.keyI * ss(0, 0.07, Math.abs(E)) * (1 - cloud * (0.3 + 0.6 * day));

    renderer.toneMappingExposure = out.exposure;
    if (bloomPass) { bloomPass.strength = out.bloom; bloomPass.threshold = out.bloomT; }

    bodies(out, cloud);
    starVis.value = ss(-0.04, -0.2, E) * (1 - ss(0, 0.6, cloud));
  }
  update();
  onTick(update);
}

// ---- 太陽與月亮：掛在相機上的精靈，沿弧線從左到右；光暈用加法混合 ----
function celestial() {
  scene.add(camera);
  const radial = (stops) => canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    for (const [s, c] of stops) gr.addColorStop(s, c);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const sunTex = radial([[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,250,235,1)'], [0.66, 'rgba(255,240,210,0.6)'], [1, 'rgba(255,230,190,0)']]);
  const sunGlowTex = radial([[0, 'rgba(255,255,255,0.65)'], [0.12, 'rgba(255,255,255,0.3)'], [0.4, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
  const moonTex = canvasTex(256, 256, (g, w) => {
    const r = w / 2;
    const gr = g.createRadialGradient(r * 0.9, r * 0.85, 0, r, r, r * 0.62);
    gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.8, '#f6ecd8'); gr.addColorStop(1, '#e9dcc4');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r * 0.62, 0, PI * 2); g.fill();
    g.globalAlpha = 0.07; g.fillStyle = '#7a6a8a';                            // 淡淡的月海
    for (const [x, y, s] of [[0.42, 0.4, 0.14], [0.58, 0.47, 0.1], [0.47, 0.6, 0.12], [0.62, 0.62, 0.06]]) { g.beginPath(); g.arc(x * w, y * w, s * w, 0, PI * 2); g.fill(); }
  });
  const moonGlowTex = radial([[0, 'rgba(255,240,225,0.55)'], [0.18, 'rgba(220,200,240,0.22)'], [0.5, 'rgba(160,140,210,0.07)'], [1, 'rgba(120,100,180,0)']]);

  const mk = (map, size, additive) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, fog: false, depthWrite: false, transparent: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.scale.setScalar(size);
    s.layers.set(1);
    s.renderOrder = -10;
    camera.add(s);
    return s;
  };
  const sunGlow = mk(sunGlowTex, 130, true), sun = mk(sunTex, 15, false);
  const moonGlow = mk(moonGlowTex, 110, true), moon = mk(moonTex, 26, false);
  moon.material.color.setRGB(1.25, 1.2, 1.12);

  // 距相機 300，依畫面比例算出弧線
  const place = (s, t) => {
    const d = 300, h = Math.tan(camera.fov * PI / 360) * d, w = h * camera.aspect;
    s.position.set(w * (-0.86 + 1.72 * t), h * (0.06 + 0.66 * Math.sin(PI * t)), -d);
  };
  const low = new THREE.Color('#ff7a34'), high = new THREE.Color('#fff4dc');
  return (pal, cloud) => {
    const E = ENV.sun, clear = 1 - ss(0, 0.7, cloud);   // 雪天（雲量 0.85）也要完全遮住，暗部一點點亮度就看得出來
    const ts = (ENV.hour - 6) / 12, tm = ((ENV.hour - 18 + 24) % 24) / 12;
    const sv = ss(-0.05, 0.04, E) * clear, mv = ss(-0.05, 0.04, -E) * clear;
    sun.visible = sunGlow.visible = sv > 0.002;
    moon.visible = moonGlow.visible = mv > 0.002;
    if (sun.visible) {
      place(sun, Math.min(1, Math.max(0, ts))); sunGlow.position.copy(sun.position);
      const k = ss(0, 0.35, E);
      sun.material.color.lerpColors(low, high, k).multiplyScalar(2.2 + k);
      sun.material.opacity = sv;
      sunGlow.material.color.copy(pal.glow).multiplyScalar(sv * (0.8 + 0.5 * (1 - k)));
      sunGlow.scale.setScalar(130 + 110 * (1 - k));
    }
    if (moon.visible) {
      place(moon, Math.min(1, Math.max(0, tm))); moonGlow.position.copy(moon.position);
      moon.material.opacity = mv;
      moonGlow.material.color.setScalar(mv);
    }
  };
}

// ---- 星星：上半球與遠方的點，各自以不同節奏閃爍；回傳可見度 uniform ----
function stars() {
  const r = seeded(7031), N = 900, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = r() * PI * 2, y = -0.35 + r() * 1.35;
    const k = Math.sqrt(1 - y * y), R = 260;
    pos.set([Math.cos(a) * k * R, y * R, Math.sin(a) * k * R], i * 3);
    seed[i] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const vis = { value: 1 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: U.time, pr: { value: DPR }, vis },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float time; uniform float pr; uniform float vis; varying float vA;
      void main() {
        vA = vis * (0.3 + 0.7 * aSeed) * (0.72 + 0.28 * sin(time * (0.5 + aSeed * 1.6) + aSeed * 40.0));
        gl_PointSize = (0.9 + aSeed * 1.6) * pr;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        if (vA < 0.004) discard;
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(1.0, 0.96, 1.0) * vA, vA * (1.0 - smoothstep(0.2, 0.5, d)));
      }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.layers.set(1);
  scene.add(pts);
  return vis;
}

// ---- 調色盤工具 ----
function compile(p) {
  const o = {};
  for (const [k, v] of Object.entries(p)) o[k] = typeof v === 'string' ? new THREE.Color(v) : Array.isArray(v) ? v.map(c => new THREE.Color(c)) : v;
  return o;
}
function clonePal(p) {
  const o = {};
  for (const [k, v] of Object.entries(p)) o[k] = v?.isColor ? v.clone() : Array.isArray(v) ? v.map(c => c.clone()) : v;
  return o;
}
function copyPal(out, a) {
  for (const [k, v] of Object.entries(a)) {
    if (v?.isColor) out[k].copy(v);
    else if (Array.isArray(v)) v.forEach((c, i) => out[k][i].copy(c));
    else out[k] = v;
  }
}
function lerpPal(out, a, b, t) {
  for (const [k, x] of Object.entries(a)) {
    const y = b[k];
    if (x?.isColor) out[k].lerpColors(x, y, t);
    else if (Array.isArray(x)) x.forEach((c, i) => out[k][i].lerpColors(c, y[i], t));
    else out[k] = x + (y - x) * t;
  }
}
const _g = new THREE.Color();
function overcast(c, k, gain) {
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  _g.setRGB(l * 0.96, l * 0.99, l * 1.06);
  c.lerp(_g, k).multiplyScalar(gain);
}

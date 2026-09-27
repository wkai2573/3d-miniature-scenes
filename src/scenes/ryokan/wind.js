// 全場共用的風：平時是微風，開場 9 秒後吹來第一陣風，之後每隔 14 ~ 22 秒一陣（1.2 秒增強、維持 2 秒、約 3.3 秒減弱）
// windy() 材質：依頂點離錨點的高度（aSway）左右擺動，陣風時順風傾倒；有 aFlutter 的葉片另有葉尖顫動
import * as THREE from 'three';
import { U, reduceMotion, onTick } from '../../engine/context.js';
import { rand } from '../../engine/random.js';
import { soft } from '../../engine/materials.js';
import { ss } from './terrain.js';

export const W = {
  gust: { value: 0 },                                   // 0 ~ 1
  dir: { value: new THREE.Vector2(0.88, 0.34).normalize() },
};

let g0 = -99, next = 9, peak = 1;
export function triggerGust(t = U.time.value) { g0 = t; next = t + rand(14, 22); peak = rand(0.75, 1); }

export function startWind() {
  onTick(t => {
    if (reduceMotion) { W.gust.value = 0; return; }
    if (t > next) triggerGust(t);
    const u = t - g0;
    W.gust.value = peak * ss(0, 1.2, u) * (1 - ss(3.2, 6.5, u));
  });
}

// 微風擺動材質
// o: { amp（每公尺高度的擺幅）, vc, flat, leaf（雙面、背面不翻轉法線）, flutter（葉尖顫動幅度） }
const cache = new Map();
export function windy(color, o = {}) {
  const amp = o.amp ?? 0.02, flutter = o.flutter ?? 0;
  const key = [color, amp, flutter, o.vc ? 1 : 0, o.flat ? 1 : 0, o.leaf ? 1 : 0].join('|');
  if (cache.has(key)) return cache.get(key);
  const m = soft(color, { noCache: true, flat: o.flat, vc: o.vc, side: o.leaf ? THREE.DoubleSide : THREE.FrontSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { time: U.time, gust: W.gust, windDir: W.dir, windAmp: { value: amp }, flutterAmp: { value: flutter } });
    sh.vertexShader = /* glsl */`
      uniform float time, gust, windAmp, flutterAmp; uniform vec2 windDir;
      attribute float aSway; attribute vec2 aFlutter;
    ` + sh.vertexShader.replace('#include <project_vertex>', /* glsl */`
      vec4 mvPosition = vec4( transformed, 1.0 );
      float hgt = aSway;
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        hgt = max( mvPosition.y - instanceMatrix[3][1] - 0.4, 0.0 );   // 實例：以實例原點為錨點
      #endif
      mvPosition = modelMatrix * mvPosition;
      float ph = mvPosition.x * 0.31 + mvPosition.z * 0.23;
      float sway = sin( time * 1.05 + ph ) + 0.35 * sin( time * 2.3 + mvPosition.x * 1.3 );
      float k = windAmp * hgt;
      vec2 off = windDir * ( sway * k * ( 1.0 + gust * 1.8 ) + gust * k * 2.2 );
      off += vec2( -windDir.y, windDir.x ) * sin( time * 0.8 + ph * 1.7 ) * k * 0.35;
      mvPosition.xz += off;
      // 葉尖顫動：每片葉子相位不同，陣風時更明顯
      mvPosition.y += sin( time * 7.0 + aFlutter.x * 40.0 ) * flutterAmp * aFlutter.y * ( 1.0 + gust * 3.0 );
      mvPosition.xz += windDir * sin( time * 5.3 + aFlutter.x * 23.0 ) * flutterAmp * 0.6 * aFlutter.y * ( 1.0 + gust * 3.0 );
      mvPosition = viewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
    // 葉片雙面：背面沿用葉團的球面法線，不翻轉（否則背光面會整片變黑）
    if (o.leaf) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replaceAll('normal *= faceDirection;', '').replaceAll('normal = normal * faceDirection;', ''));
  };
  m.customProgramCacheKey = () => 'wind' + (o.leaf ? 'L' : '') + (o.flat ? 'F' : '') + (o.vc ? 'V' : '');
  cache.set(key, m);
  return m;
}

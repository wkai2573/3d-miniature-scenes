// 地表的天氣變化：積雪（朝上的面慢慢變白、雪停後融化），以及雨天的濕潤變暗（可選）
// 做法：替場景裡的 Toon / Standard 材質加一段 shader（onBeforeCompile），依世界法線的朝上程度混入雪色
// 遮蔽：場景搭好後從正上方畫一張「最高面高度圖」，比最高面低的地方（屋簷下、店裡、樹下）不積雪、也不會淋濕
// 要在 staticBatch() 之後、第一次渲染之前呼叫
import * as THREE from 'three';
import { renderer } from './renderer.js';
import { EU } from './env.js';

/**
 * root: 場景
 * o: { x:[a,b], z:[a,b] 高度圖涵蓋的範圍, res 高度圖解析度, wet 雨天變暗的程度（0 不變暗）}
 * userData.noSnow = true 的材質不處理
 */
export function weatherSurfaces(root, o) {
  const [x0, x1] = o.x, [z0, z1] = o.z, W = x1 - x0, D = z1 - z0;
  const top = renderTops(root, x0, x1, z0, z1, o.res ?? 1024);
  const uniforms = {
    snowCover: EU.cover, snowWet: EU.wet, snowWetK: { value: o.wet ?? 0 },
    snowTop: { value: top }, snowBox: { value: new THREE.Vector4(x0, z1, W, -D) },
    snowColor: { value: new THREE.Color('#f4f7fd') },
  };
  const seen = new Set();
  root.traverse(obj => {
    if (!obj.isMesh) return;
    for (const m of [].concat(obj.material)) {
      if (seen.has(m) || m.userData.noSnow) continue;
      if (!(m.isMeshToonMaterial || m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue;
      seen.add(m);
      patch(m, uniforms);
    }
  });
}

// ---- 最高面高度圖：正交相機從上往下看，每個像素寫入最高那一面的高度（+10，留給空白處用 0）----
function renderTops(root, x0, x1, z0, z1, res) {
  const W = x1 - x0, D = z1 - z0;
  const rt = new THREE.WebGLRenderTarget(res, Math.max(16, Math.round(res * D / W)), {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, D / 2, -D / 2, 1, 200);
  cam.up.set(0, 0, -1);                                  // 畫面上方是 -z：v 越大 z 越小
  cam.position.set((x0 + x1) / 2, 100, (z0 + z1) / 2);
  cam.lookAt((x0 + x1) / 2, 0, (z0 + z1) / 2);
  cam.updateMatrixWorld();
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      varying float vY;
      void main() {
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        vec4 w = modelMatrix * p;
        vY = w.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      varying float vY;
      void main() { gl_FragColor = vec4(vY + 10.0, 0.0, 0.0, 1.0); }`,
    side: THREE.DoubleSide,
  });

  // 透明的東西（玻璃、水氣、光斑、反射面）、點、線、精靈都不算遮蔽；
  // 不受光的材質（電線、燈具、招牌）也略過，否則電線底下會留下一條條沒積雪的線
  const hidden = [];
  root.traverse(obj => {
    if (!obj.visible) return;
    const mats = obj.material ? [].concat(obj.material) : [];
    const skip = mats.some(m => m.transparent || m.isMeshBasicMaterial) || obj.userData.noOcclude;
    if (obj.isPoints || obj.isLine || obj.isSprite || skip) { obj.visible = false; hidden.push(obj); }
  });
  const bg = root.background, ov = root.overrideMaterial, prevRT = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  root.background = null;
  root.overrideMaterial = mat;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(root, cam);
  renderer.setRenderTarget(prevRT);
  renderer.setClearColor(prevClear, prevAlpha);
  root.overrideMaterial = ov;
  root.background = bg;
  for (const obj of hidden) obj.visible = true;
  mat.dispose();
  return rt.texture;
}

const VERT_HEAD = /* glsl */`
  varying vec3 vSnowW; varying vec3 vSnowN;
`;
const VERT = /* glsl */`
  vec4 snowP = vec4( transformed, 1.0 );
  vec3 snowN = objectNormal;
  #ifdef USE_INSTANCING
    snowP = instanceMatrix * snowP;
    snowN = mat3( instanceMatrix ) * snowN;
  #endif
  vSnowW = ( modelMatrix * snowP ).xyz;
  vSnowN = mat3( modelMatrix ) * snowN;
`;
const FRAG_HEAD = /* glsl */`
  uniform float snowCover, snowWet, snowWetK; uniform sampler2D snowTop; uniform vec4 snowBox; uniform vec3 snowColor;
  varying vec3 vSnowW; varying vec3 vSnowN;
  float snowHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
  float snowNoise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( snowHash( i ), snowHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( snowHash( i + vec2( 0.0, 1.0 ) ), snowHash( i + 1.0 ), f.x ), f.y );
  }
`;
const FRAG = /* glsl */`
  if ( snowCover > 0.001 || snowWet * snowWetK > 0.001 ) {
    vec2 suv = ( vSnowW.xz - snowBox.xy ) / snowBox.zw;
    float topY = texture2D( snowTop, suv ).r - 10.0;
    float open = 1.0 - smoothstep( 0.06, 0.3, topY - vSnowW.y );   // 露天：自己就是最高的那一面
    float n = snowNoise( vSnowW.xz * 2.7 ) * 0.6 + snowNoise( vSnowW.xz * 9.0 ) * 0.4;
    float up = normalize( vSnowN ).y + ( n - 0.5 ) * 0.4;
    // 先積在平坦的頂面，積得越多斜面也跟著變白
    float k = smoothstep( 1.0 - 0.75 * snowCover, 1.1 - 0.6 * snowCover, up ) * smoothstep( 0.0, 0.3, snowCover ) * open;
    diffuseColor.rgb *= 1.0 - snowWetK * snowWet * open * ( 1.0 - k );
    diffuseColor.rgb = mix( diffuseColor.rgb, snowColor, k * 0.94 );
  }
`;

function patch(m, uniforms) {
  const prev = m.onBeforeCompile;
  const key = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey') ? m.customProgramCacheKey() : '';
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <fog_vertex>', VERT + '\n#include <fog_vertex>');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG);
  };
  m.customProgramCacheKey = () => key + '|snow';
  m.needsUpdate = true;
}

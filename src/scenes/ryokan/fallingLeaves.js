// 飄落的楓葉：CPU 模擬約 320 片。平時從樹冠零星飄落；陣風時大量飛起，地上的葉子也被捲起來
// 每片葉子像鐘擺一樣左右滑翔、翻轉，隨風與旋渦氣流飄移；落地後停一陣子、落水就漂流並激起一圈漣漪、飄出島緣就墜入雲海
import * as THREE from 'three';
import { scene, PI, reduceMotion, onTick } from '../../engine/context.js';
import { rng, rand, pick } from '../../engine/random.js';
import { noise3 } from '../../engine/noise.js';
import { soft } from '../../engine/materials.js';
import { W } from './wind.js';
import { CANOPY } from './flora.js';
import { mapleLeafGeo } from './leaves.js';
import { heightAt, isWater } from './terrain.js';
import { addRipple } from './water.js';
import { HX, HZ, LV } from './layout.js';

const N = reduceMotion ? 60 : 440;
const IDLE = 0, AIR = 1, GROUND = 2, WATER = 3, VOID = 4;
const COLS = ['#c9352b', '#e8622c', '#f28a2e', '#f5b73a', '#b02a26', '#d8762e'];

export function buildFallingLeaves() {
  const im = new THREE.InstancedMesh(mapleLeafGeo(), soft('#ffffff', { side: THREE.DoubleSide }), N);
  im.frustumCulled = false;
  im.layers.set(1);
  scene.add(im);
  const c = new THREE.Color(), L = [];
  for (let i = 0; i < N; i++) {
    im.setColorAt(i, c.set(pick(COLS)).multiplyScalar(rand(0.8, 1.05)));
    L.push({ st: IDLE, p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), ph: rand(0, 20), spin: rand(1.2, 3.2), s: rand(0.22, 0.32), age: 0, life: 0, fade: 1 });
  }
  im.instanceColor.needsUpdate = true;

  const spawnInCanopy = l => {
    const cl = pick(CANOPY), a = rand(0, PI * 2), d = rand(0.5, 1);
    l.p.set(cl.c[0] + Math.cos(a) * cl.r[0] * d, cl.c[1] + rand(-0.7, 0.2) * cl.r[1], cl.c[2] + Math.sin(a) * cl.r[2] * d);
    l.v.set(0, -0.2, 0);
    l.st = AIR; l.age = 0; l.fade = 1;
  };
  const land = l => {
    const water = isWater(l.p.x, l.p.z);
    l.st = water ? WATER : GROUND; l.age = 0;
    l.life = water ? rand(35, 70) : rand(25, 55);
    l.rot.set(rand(-0.25, 0.25), rand(0, PI * 2), rand(-0.25, 0.25));
    if (water) { l.p.y = LV.water + 0.012; addRipple(l.p.x, l.p.z, 0.7); }
  };
  // 開場就有葉子在空中、地上、水面
  L.forEach((l, i) => {
    spawnInCanopy(l);
    if (i % 3 === 0) { l.p.y -= rand(0, 2); }
    else if (i % 3 === 1) { l.p.x += rand(-1.5, 1.5); l.p.z += rand(-1.5, 1.5); l.p.y = heightAt(l.p.x, l.p.z); land(l); l.age = rand(0, l.life); }
    else l.st = IDLE;
  });

  const target = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), up = new THREE.Vector3();
  let acc = 0;
  onTick((t, dt) => {
    const gust = W.gust.value, wd = W.dir.value;
    // 生成：平時每秒約 7 片，陣風時大增；閒置的葉子不夠時，陣風把地上的葉子捲起來
    acc += dt * (7 + 120 * gust);
    while (acc >= 1) {
      acc -= 1;
      const idle = L.find(l => l.st === IDLE);
      if (idle) spawnInCanopy(idle);
      else if (gust > 0.3) {
        const g = L.find(l => l.st === GROUND && rng() < 0.3);
        if (g) { g.st = AIR; g.age = 0; g.v.set(wd.x * 1.2, rand(1.2, 2.6), wd.y * 1.2); }
      }
    }
    for (let i = 0; i < N; i++) {
      const l = L[i];
      l.age += dt;
      if (l.st === AIR || l.st === VOID) {
        const p = l.p, sw = t * 2.1 + l.ph;
        // 風：主風向 × 陣風，加上旋渦（雜訊）與陣風時的上升氣流
        const wind = 0.22 + 2.8 * gust;
        const nx = noise3(p.x * 0.3, p.y * 0.4, t * 0.25 + l.ph), nz = noise3(p.z * 0.3 + 7, p.y * 0.4, t * 0.25), ny = noise3(p.x * 0.25, p.z * 0.25, t * 0.3 + 3);
        const swirl = 0.3 + 1.4 * gust;
        target.set(wd.x * wind + nx * swirl, 0, wd.y * wind + nz * swirl);
        // 鐘擺滑翔：左右擺、擺到底時落得最快
        const glide = Math.cos(sw) * 0.55;
        target.x += Math.cos(l.ph) * glide; target.z += Math.sin(l.ph) * glide;
        target.y = -rand(0.35, 0.45) * (0.6 + 0.7 * Math.abs(Math.sin(sw))) + gust * (0.4 + ny * 1.1);
        l.v.lerp(target, Math.min(1, 2.2 * dt));
        p.addScaledVector(l.v, dt);
        l.rot.x = Math.sin(sw) * 0.9 + l.age * 0.4 * gust;
        l.rot.z = Math.cos(sw * 0.7) * 0.7;
        l.rot.y += l.spin * dt * (1 + gust * 2);
        if (l.st === AIR) {
          if (Math.abs(p.x) > HX || Math.abs(p.z) > HZ) { l.st = VOID; l.age = 0; }
          else if (p.y <= heightAt(p.x, p.z) + 0.02) land(l);
          else if (p.y > 16 || l.age > 60) l.st = IDLE;
        } else {                                                    // 墜入雲海：慢慢變小消失
          l.fade = Math.max(0, 1 - l.age / 7);
          if (!l.fade) l.st = IDLE;
        }
      } else if (l.st === GROUND || l.st === WATER) {
        if (l.st === WATER) {                                       // 漂流：慢慢轉、輕輕浮沉
          l.p.x += (wd.x * 0.05 + noise3(l.p.x, l.p.z, t * 0.1) * 0.04) * dt;
          l.p.z += (wd.y * 0.05 + noise3(l.p.z, l.p.x, t * 0.1 + 4) * 0.04) * dt;
          l.p.y = LV.water + 0.012 + Math.sin(t * 1.4 + l.ph) * 0.004;
          l.rot.y += 0.05 * dt;
          if (!isWater(l.p.x, l.p.z)) l.st = GROUND;
        } else if (gust > 0.5 && rng() < dt * 0.25 * gust) { l.st = AIR; l.age = 0; l.v.set(wd.x, rand(1, 2.2), wd.y); }
        l.fade = Math.min(1, (l.life - l.age) / 1.5);
        if (l.age > l.life) l.st = IDLE;
      }
      const s = l.st === IDLE ? 0 : l.s * Math.max(0, l.fade);
      q.setFromEuler(l.rot);
      im.setMatrixAt(i, m4.compose(l.st === IDLE ? up.set(0, -80, 0) : l.p, q, sc.set(s, s, s)));
    }
    im.instanceMatrix.needsUpdate = true;
  });
}

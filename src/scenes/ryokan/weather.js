// 紅葉屋的雨與雪：落在整座浮島上，越過島緣繼續落進雲海；主屋、湯屋與渡り廊下的屋頂底下不下
// 雨絲靠近石燈籠與玄關時被染成暖色；雪花跟著陣風斜斜飄（粒子本身在 src/engine/precip.js）
import * as THREE from 'three';
import { onTick } from '../../engine/context.js';
import { buildRain, buildSnow } from '../../engine/precip.js';
import { W } from './wind.js';
import { heightAt } from './terrain.js';
import { HX, HZ, LV, INN, ANNEX, LANTERNS, GENKAN_X } from './layout.js';

const CORR_Z = INN.z1 - 2.5;
const inside = (x, z, x0, x1, z0, z1) => x > x0 && x < x1 && z > z0 && z < z1;
const underRoof = (x, z) =>
  inside(x, z, INN.x0 - 0.8, INN.x1 + 0.8, INN.z0 - 1.3, INN.z1 + 1.3) ||
  inside(x, z, ANNEX.x0 - 0.6, ANNEX.x1 + 0.6, ANNEX.z0 - 0.65, ANNEX.z1 + 0.65) ||
  inside(x, z, INN.x1, ANNEX.x0, CORR_Z - 1.1, CORR_Z + 1.1);

export function buildWeather() {
  const area = { x: [-HX, HX], z: [-HZ, HZ], y: [-5, 16], skip: underRoof };
  const lamps = LANTERNS.filter(l => l[3]).map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.9, z));
  buildRain({ ...area, n: 1375, lamps, lampTint: [1.0, 0.72, 0.42], warm: { at: [GENKAN_X, LV.up + 1.6, INN.z1 + 1.6] } });
  const { drift } = buildSnow({ ...area, n: 1425, size: 0.14 });
  onTick(() => drift.value.copy(W.dir.value).multiplyScalar(0.015 + 0.09 * W.gust.value));
}

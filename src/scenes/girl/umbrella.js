// 透明傘：程式產生的透明塑膠傘，傘骨與傘面的開合由張開程度驅動
// 傘的座標：原點在握把被手握住的地方，傘柄沿 +y 往傘尖，開傘時傘面朝 +y 張開；單位公尺
import * as THREE from 'three';
import { toon } from '../../engine/materials.js';

const RIBS = 8, POINTS = 8;      // 傘骨的根數、每根傘骨取幾個點
const TOP = 0.7;                 // 傘柄頂端（傘骨匯合處）離握把多高
const RIB = 0.62;                // 傘骨的長度
const SHAFT_R = 0.007, RIB_R = 0.0045;
const FOLD = 0.02;               // 收起時傘骨離傘柄的距離
// 傘骨與往下的方向的夾角：收起時幾乎貼著傘柄；撐開時從傘頂的接近水平，一路彎到傘緣的斜下方
const ANGLE_CLOSED = 0.04, ANGLE_TOP = 1.5, ANGLE_RIM = 0.65;
const BUNCH = 0.03;              // 收起時傘面在傘骨之間鼓起多少

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 回傳 { root, shape(open), rim, top }：root 是整把傘，shape(open) 依張開程度（0 收起、1 撐開）調整傘骨與傘面
 * rim 是傘緣現在的半徑 radius 與高度 y（傘的座標），top 是傘頂的高度；雨雪的遮擋用它們算傘面在哪裡
 */
export function createUmbrella() {
  const root = new THREE.Group();
  root.name = 'umbrella';
  root.userData.dynamic = true;   // 不參與靜態網格合併

  // ---- 傘柄與握把 ----
  const metal = toon('#8d96a6'), handleMat = toon('#2b3042');
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_R, SHAFT_R, TOP + 0.04, 8), metal);
  shaft.position.y = (TOP + 0.04) / 2 - 0.04;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.012, 0.15, 10), handleMat);
  grip.position.y = -0.02;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 14, Math.PI).rotateZ(Math.PI).rotateY(Math.PI / 2).translate(0, -0.095, 0.03), handleMat);   // 握把底下的 J 型彎鉤
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.05, 8), metal);   // 傘頂的尖
  cap.position.y = TOP + 0.04;
  root.add(shaft, grip, hook, cap);

  // ---- 傘骨：每一節是一小段圓柱，張開程度變了就重新擺 ----
  const ribs = new THREE.InstancedMesh(new THREE.CylinderGeometry(RIB_R, RIB_R, 1, 5).translate(0, 0.5, 0), metal, RIBS * (POINTS - 1));
  ribs.frustumCulled = false;
  const tips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 6, 4), handleMat, RIBS);
  tips.frustumCulled = false;
  root.add(ribs, tips);

  // ---- 傘面：傘骨之間各有一片，中間多一排頂點讓收起時能鼓起來 ----
  const rib = Array.from({ length: RIBS }, () => Array.from({ length: POINTS }, () => new THREE.Vector3()));
  const verts = RIBS * POINTS * 2;
  const position = new THREE.BufferAttribute(new Float32Array(verts * 3), 3);
  const index = [];
  const at = (i, m, valley) => (i % RIBS * 2 + (valley ? 1 : 0)) * POINTS + m;
  for (let i = 0; i < RIBS; i++) for (let m = 0; m < POINTS - 1; m++) {
    const a = at(i, m), a2 = at(i, m + 1), v = at(i, m, true), v2 = at(i, m + 1, true), b = at(i + 1, m), b2 = at(i + 1, m + 1);
    index.push(a, v, a2, v, v2, a2, v, b, v2, b, b2, v2);
  }
  const canopyGeo = new THREE.BufferGeometry();
  canopyGeo.setAttribute('position', position);
  canopyGeo.setIndex(index);
  // 透明塑膠：淡淡的藍灰，收起時層層疊起來所以比較不透明
  const canopyMat = toon('#cfe3f2', { opacity: 0.4, side: THREE.DoubleSide, noCache: true });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.frustumCulled = false;
  root.add(canopy);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const rim = { radius: 0, y: 0 };
  const radial = new Array(POINTS), height = new Array(POINTS), mid = new THREE.Vector3();   // 每次重擺時共用，不重新配置
  let last = -1;

  /** 依張開程度（0 收起、1 撐開）擺好傘骨與傘面 */
  function shape(open) {
    if (open === last) return;
    last = open;
    // 一根傘骨從傘頂出發：沿著 (sin a, −cos a) 走，a 是和往下的方向的夾角，從傘頂的 ANGLE_TOP 彎到傘緣的 ANGLE_RIM
    const atTop = lerp(ANGLE_CLOSED, ANGLE_TOP, open), atRim = lerp(ANGLE_CLOSED, ANGLE_RIM, open), step = RIB / (POINTS - 1);
    radial[0] = lerp(0, FOLD, 1 - open); height[0] = TOP;
    for (let m = 1; m < POINTS; m++) {
      const a = lerp(atTop, atRim, (m - 0.5) / (POINTS - 1));
      radial[m] = radial[m - 1] + Math.sin(a) * step;
      height[m] = height[m - 1] - Math.cos(a) * step;
    }
    rim.radius = radial[POINTS - 1]; rim.y = height[POINTS - 1];
    for (let i = 0; i < RIBS; i++) {
      const az = i / RIBS * Math.PI * 2, sx = Math.sin(az), sz = Math.cos(az);
      for (let m = 0; m < POINTS; m++) rib[i][m].set(sx * radial[m], height[m], sz * radial[m]);
    }
    // 收起時傘面在傘骨之間鼓起來（兩端收細）；撐開時傘面繃在傘骨之間
    const bunch = (1 - open) * BUNCH;
    const p = position.array;
    for (let i = 0; i < RIBS; i++) for (let m = 0; m < POINTS; m++) {
      const a = rib[i][m], b = rib[(i + 1) % RIBS][m];
      let k = at(i, m) * 3;
      p[k] = a.x; p[k + 1] = a.y; p[k + 2] = a.z;
      mid.addVectors(a, b).multiplyScalar(0.5);
      const flat = Math.hypot(mid.x, mid.z), swell = flat > 1e-6 ? bunch * Math.sin(Math.PI * m / (POINTS - 1)) / flat : 0;
      mid.x += mid.x * swell; mid.z += mid.z * swell;
      k = at(i, m, true) * 3;
      p[k] = mid.x; p[k + 1] = mid.y; p[k + 2] = mid.z;
    }
    position.needsUpdate = true;
    canopyGeo.computeVertexNormals();
    canopyMat.opacity = lerp(0.62, 0.4, open);

    let n = 0;
    for (let i = 0; i < RIBS; i++) {
      for (let m = 0; m < POINTS - 1; m++, n++) {
        const a = rib[i][m], b = rib[i][m + 1];
        dir.subVectors(b, a);
        const len = dir.length();
        q.setFromUnitVectors(up, dir.divideScalar(len));
        ribs.setMatrixAt(n, m4.compose(a, q, s.set(1, len, 1)));
      }
      const e = rib[i][POINTS - 1];
      tips.setMatrixAt(i, m4.compose(e, q.identity(), s.set(1, 1, 1)));
    }
    ribs.instanceMatrix.needsUpdate = true;
    tips.instanceMatrix.needsUpdate = true;
    tips.visible = open > 0.3;
  }
  shape(0);

  return { root, shape, rim, top: TOP };
}

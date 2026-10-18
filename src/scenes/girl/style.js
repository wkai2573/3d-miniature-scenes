// 少女融入場景的風格：描邊與投影
// 場景的三渲二物件是用黑藍色的背面殼描邊（engine/materials.js 的 outline），引擎內建的做法是以包圍盒放大，不適用於有骨骼的網格，
// 所以少女用 three-vrm 的 MToon 材質自帶的描邊（沿著法線往外推的背面殼，蒙皮網格也適用），顏色與粗細改成和場景一致
// 夜晚在店內時，天花板燈離頭頂很近，白衣服與頭髮受光後亮度超過夜晚的泛光門檻，整個人會暈出光；這時把少女受光的亮度壓低（見 dimLit）
import * as THREE from 'three';

const INK = 0x0e111c;       // 描邊的顏色，和場景物件的描邊同一個黑藍色
const WIDTH = 0.004;        // 描邊的粗細（公尺）。場景裡一公尺多高的物件約 1 ~ 2 公分；少女近看有五官，細得多才不會糊成一團
const NIGHT_STORE_LIT = 0.3;   // 夜晚在店內時，少女受光的亮度剩下多少
const HIDDEN = new THREE.MeshBasicMaterial();
HIDDEN.visible = false;     // 放在材質陣列裡佔位：three.js 看到不可見的材質就整個跳過那一組

/**
 * 設定少女的描邊與投影；vrm 是載入好的 VRM
 * 回傳 dimLit(amount)：amount 0 ~ 1 是「夜晚、人在店內」的程度，0 是原本的亮度，1 是壓到 NIGHT_STORE_LIT 倍；
 * 只縮放受光的底色與暗部色，不碰描邊與自發光
 * 描邊殼拆成另一個圖層 1 的網格：地面倒影只畫圖層 0，所以少女本體在倒影裡、描邊殼不在
 * 少女投影到地面，也接收別的東西的影子（屋簷、招牌的遮擋）；半透明的眉、睫毛、高光這些細部不投影，否則會投出一整片方形的影子
 */
export function styleGirl(vrm) {
  const skinned = [], lit = [];
  vrm.scene.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  for (const mesh of skinned) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m.isMToonMaterial && !m.isOutline) lit.push({ color: m.color, shade: m.shadeColorFactor, baseColor: m.color.clone(), baseShade: m.shadeColorFactor.clone() });
      if (!m.isOutline) continue;
      m.outlineWidthMode = 'worldCoordinates';
      m.outlineWidthFactor = WIDTH;
      m.outlineColorFactor.set(INK);
      m.outlineLightingMixFactor = 0;   // 描邊是固定的墨色，不吃光
    }
    if (mats.some(m => m.isOutline)) splitOutline(mesh, mats);
    mesh.receiveShadow = true;
    mesh.castShadow = !mats.some(m => !m.isOutline && m.transparent);
  }
  let applied = 0;
  return function dimLit(amount) {
    if (Math.abs(amount - applied) < 1e-4) return;   // 沒變就不必每格重寫所有材質
    applied = amount;
    const k = 1 + (NIGHT_STORE_LIT - 1) * amount;
    for (const m of lit) {
      m.color.copy(m.baseColor).multiplyScalar(k);
      m.shade.copy(m.baseShade).multiplyScalar(k);
    }
  };
}

// 把網格裡的描邊那幾組拆到另一個網格：原本的只畫本體，新的只畫描邊，共用同一份幾何、骨架與形變
function splitOutline(mesh, mats) {
  const shell = new THREE.SkinnedMesh(mesh.geometry, mats.map(m => m.isOutline ? m : HIDDEN));
  mesh.material = mats.map(m => m.isOutline ? HIDDEN : m);
  shell.name = mesh.name + '_outline';
  shell.position.copy(mesh.position);
  shell.quaternion.copy(mesh.quaternion);
  shell.scale.copy(mesh.scale);
  shell.bind(mesh.skeleton, mesh.bindMatrix);
  shell.morphTargetInfluences = mesh.morphTargetInfluences;   // 臉的表情變形，描邊跟著動
  shell.morphTargetDictionary = mesh.morphTargetDictionary;
  shell.frustumCulled = false;
  shell.renderOrder = mesh.renderOrder;
  shell.layers.set(1);
  mesh.parent.add(shell);
}

// 少女的臉：放鬆、淡淡的微笑，表情有很淡的起伏，加上眨眼
// 把模型裡眉、眼、嘴分開的細部表情註冊成自訂表情，再依時間緩緩變化它們的權重
import { noise3 } from '../../engine/noise.js';

// 自訂表情對應模型的細部表情（morph target 的名稱結尾）：微笑的嘴角、放鬆的眉、眼睛淡淡的笑意
const CUSTOM = { calmMouth: 'Fcl_MTH_Fun', calmBrow: 'Fcl_BRW_Fun', calmEyes: 'Fcl_EYE_Joy' };
const BASE = { calmMouth: 0.4, calmBrow: 0.3, calmEyes: 0.12 };   // 基底的權重
const DRIFT = { calmMouth: 0.12, calmBrow: 0.15, calmEyes: 0.06 };   // 起伏的幅度，每一個慢慢飄、互不同步
const SPEED = { calmMouth: 0.11, calmBrow: 0.17, calmEyes: 0.07 };

/**
 * 在 vrm 的表情管理器登錄自訂表情；three-vrm 是動態匯入的模組
 * 細部表情的名稱記在 glTF 的 mesh 裡，載入後 three.js 只留下編號，所以要回頭查名稱；模型沒有那個細部表情或臉的 mesh 時就少一個，不會出錯
 */
export async function registerFace(vrm, gltf, { VRMExpression, VRMExpressionMorphTargetBind }) {
  const { parser } = gltf, meshIndex = parser.json.meshes.findIndex(m => m.name === 'Face');
  const names = parser.json.meshes[meshIndex]?.primitives[0].extras?.targetNames ?? [];
  const face = meshIndex < 0 ? null : await parser.getDependency('mesh', meshIndex);
  const primitives = !face ? [] : face.isMesh ? [face] : face.children.filter(o => o.isMesh);
  for (const [name, suffix] of Object.entries(CUSTOM)) {
    const index = names.findIndex(n => n.endsWith(suffix));
    if (index < 0) continue;
    const expression = new VRMExpression(name);
    expression.addBind(new VRMExpressionMorphTargetBind({ primitives, index, weight: 1 }));
    vrm.expressionManager.registerExpression(expression);
  }
}

/** 這個時間點各個自訂表情的權重；眨眼時眼睛的笑意讓出來，眼皮才不會疊在一起 */
export function faceWeights(t, blink) {
  const w = {};
  let i = 0;
  for (const name of Object.keys(CUSTOM)) w[name] = BASE[name] + DRIFT[name] * noise3(t * SPEED[name], i++ * 5.3, 7.1);
  w.calmEyes *= 1 - blink;
  return w;
}

/** 每格把臉套到 vrm：眨眼與自訂表情 */
export function updateFace(vrm, t, blink) {
  const em = vrm.expressionManager;
  em.setValue('blink', blink);
  for (const [name, v] of Object.entries(faceWeights(t, blink))) if (em.getExpression(name)) em.setValue(name, v);
}

// 少女外觀：載入 VRM 模型、把 VRM 0.x 的朝向轉正，每格依姿勢驅動正規化人形骨骼，再更新 three-vrm
// GLTFLoader 與 three-vrm 用動態匯入：CDN 或模型載入失敗時只會少了少女，不會拖垮整個場景
import * as THREE from 'three';
import { BONES, createPose, createGirlPoser } from './pose.js';
import { registerFace, updateFace } from './face.js';
import { EYE_YAW, EYE_PITCH } from './look.js';
import { createUmbrella } from './umbrella.js';
import { styleGirl } from './style.js';
import { measureGrip, alignWrist } from './grip.js';
import { ENV } from '../../engine/env.js';
import { ZONE } from './behavior.js';

// 手腕最多為了對準傘柄轉多少（弧度）；傘的朝向與手臂姿勢差太多時，改調拿傘的右臂姿勢，見 pose.js 的「拿傘」
const WRIST_LIMIT = 1.0;

// 眼球轉角換成 VRM 視線控制的輸入角度：這個模型的視線控制輸入 90° 對應眼球骨骼轉到最大
const lookInput = (angle, max) => Math.max(-1, Math.min(1, angle / max)) * 90;
function lookEyes(vrm, [yaw, pitch]) {
  if (!vrm.lookAt) return;
  vrm.lookAt.autoUpdate = false;
  vrm.lookAt.yaw = lookInput(yaw, EYE_YAW);
  vrm.lookAt.pitch = -lookInput(pitch, EYE_PITCH);   // 這個模型的垂直方向和姿勢相反
}

/** ground(x, z) 回傳世界座標 (x, z) 的地面高度，少女的腳踩在上面 */
export async function loadAppearance(url, ground) {
  const [{ GLTFLoader }, threeVrm] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('@pixiv/three-vrm'),
  ]);
  const { VRMLoaderPlugin, VRMUtils } = threeVrm;
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error(`${url} 不是 VRM 檔`);

  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.removeUnnecessaryJoints(gltf.scene);
  VRMUtils.rotateVRM0(vrm);   // VRM 0.x 面向 -z，轉 180° 讓臉朝 +z
  vrm.scene.traverse(o => { o.frustumCulled = false; });   // 蒙皮網格的包圍球不會跟著骨骼動，避免被誤裁
  await registerFace(vrm, gltf, threeVrm);
  const dimLit = styleGirl(vrm);
  vrm.scene.updateMatrixWorld(true);
  vrm.scene.position.y = -new THREE.Box3().setFromObject(vrm.scene).min.y;   // 鞋底略低於模型原點，抬到剛好踩在地面

  // 姿勢以 VRM 1.0 的朝向來寫；VRM 0.x 的正規化骨骼座標是轉 180° 之前的，x、z 要反過來
  const flip = vrm.meta?.metaVersion === '0' ? -1 : 1;
  const nodes = BONES.map(b => [b, vrm.humanoid.getNormalizedBoneNode(b)]).filter(([, n]) => n);
  const node = Object.fromEntries(nodes);
  const hipsRest = node.hips.position.clone();
  // 左腿各節的長度與方向，換成 VRM 1.0 的方向給姿勢的腿部 IK 用；沒有腳尖骨骼時以腳踝為支點
  // 腳跟著地點取腳踝正下方的鞋底、往後 3.5 公分；鞋尖取腳尖骨骼末端，沒有的話以腳尖關節代替
  const v1 = p => new THREE.Vector3(flip * p.x, p.y, flip * p.z);
  const ankle = node.leftFoot.getWorldPosition(new THREE.Vector3());
  const tipNode = vrm.humanoid.getRawBoneNode('leftToes')?.children[0] ?? node.leftToes ?? node.leftFoot;
  const body = {
    hip: v1(node.leftUpperLeg.position), thigh: v1(node.leftLowerLeg.position), shin: v1(node.leftFoot.position),
    toe: node.leftToes ? v1(node.leftToes.position) : new THREE.Vector3(),
    heel: new THREE.Vector3(0, -ankle.y, -0.035),
    tip: tipNode.getWorldPosition(new THREE.Vector3()).sub(ankle).setY(-ankle.y),   // 已經轉成臉朝 +z，不必再翻
  };

  const root = new THREE.Group();
  root.name = 'girl';
  root.userData.dynamic = true;   // 不參與靜態網格合併
  root.add(vrm.scene);

  // 透明傘掛在右手的骨骼上，傘柄穿過握拳的空心；傘的朝向由姿勢決定，每格抵銷手的轉動，再把手腕轉一點對準傘柄（見 grip.js）
  const umbrella = createUmbrella(), hand = vrm.humanoid.getRawBoneNode('rightHand'), wrist = node.rightHand;
  const grip = hand && wrist ? measureGrip(vrm, node, flip, root) : null;
  if (grip) {
    umbrella.root.position.copy(grip.center);
    hand.add(umbrella.root);
  }
  const handTurn = new THREE.Quaternion(), aim = new THREE.Quaternion(), euler = new THREE.Euler();
  // 撐開的傘面在世界裡的位置與形狀，給雨雪的遮擋用：傘緣的圓心 center、軸 axis、半徑 radius、傘頂比傘緣高 height；收起時半徑是 0
  const canopy = { center: new THREE.Vector3(), axis: new THREE.Vector3(), radius: 0, height: 0 };

  const pose = createPose(), girlPose = createGirlPoser(body, ground);
  let placed = false, indoors = null;   // indoors 是夜晚在店內的程度，進出店時平順地過渡；第一格直接到位

  /** 每格呼叫：state 是少女行為的狀態 */
  function update(state, t, dt) {
    girlPose(state, t, dt, pose);
    root.position.set(state.x, pose.y, state.z);
    root.rotation.y = state.facing;

    const [dx, dy, dz] = pose.hips;
    node.hips.position.set(hipsRest.x + flip * dx, hipsRest.y + dy, hipsRest.z + flip * dz);
    for (const [b, n] of nodes) {
      const [x, y, z] = pose.rot[b];
      n.rotation.set(flip * x, y, flip * z);
    }

    // 傘的朝向（世界座標）：手腕先照這個朝向修正，再讓傘照這個朝向掛在手上
    const u = pose.umbrella;
    aim.setFromEuler(euler.set(u.pitch, 0, u.roll, 'ZXY'));
    aim.premultiply(root.quaternion);
    canopy.axis.set(0, 1, 0).applyQuaternion(aim);
    if (grip) alignWrist(wrist, grip.axis, canopy.axis, WRIST_LIMIT);   // 內部會把上游的矩陣更新到最新

    if (!placed) {
      // 頭髮與裙子的彈簧骨以載入時的位置為起點，第一次就位後要重設，否則會從原點甩過來
      // 重設前要先把姿勢傳到實際骨骼，下面 vrm.update() 會再傳一次，只多做這一格
      placed = true;
      vrm.humanoid.update();
      root.updateMatrixWorld(true);
      vrm.springBoneManager?.reset();
    }
    const here = state.zone === ZONE.STORE ? ENV.lamps : 0;
    indoors = indoors === null ? here : indoors + (here - indoors) * (1 - Math.exp(-dt / 0.35));
    dimLit(indoors);
    updateFace(vrm, t, state.blink);
    lookEyes(vrm, pose.eyes);
    vrm.update(dt);

    umbrella.shape(u.open);
    if (umbrella.root.parent) {
      hand.getWorldQuaternion(handTurn).invert();
      umbrella.root.quaternion.copy(handTurn).multiply(aim);
      umbrella.root.updateWorldMatrix(true, false);
      umbrella.root.getWorldPosition(canopy.center).addScaledVector(canopy.axis, umbrella.rim.y);
      canopy.radius = u.open > 0.02 ? umbrella.rim.radius : 0;
      canopy.height = umbrella.top - umbrella.rim.y;
    }
  }

  return { root, vrm, update, canopy };
}

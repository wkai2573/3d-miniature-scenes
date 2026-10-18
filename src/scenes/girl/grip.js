// 握傘：傘柄要穿過握拳的空心。手跟著傘：傘的朝向由姿勢決定，這裡算出手腕要修正多少，讓拳頭的空心對準傘柄
// 握拳的位置與軸都從模型的手指骨骼量出來，不寫死成某個模型的數值
import { Quaternion, Vector3 } from 'three';
import { createPose } from './pose.js';
import { GRIP, HAND_BONES, shapeHand } from './hands.js';

const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _n = new Vector3();
const _p = new Quaternion(), _h = new Quaternion(), _d = new Quaternion(), _l = new Quaternion();

/**
 * 量握傘的手形：把右手的手指擺成握拳，取中指三節的位置擬出握拳的圓心與圓所在平面的法線
 * 回傳 { center 圓心（右手骨骼的座標）, axis 空心的方向（正規化右手骨骼的座標，正負號不拘） }
 * nodes 是正規化人形骨骼的節點表，flip 是 VRM 0.x 與 1.0 的方向差，root 是少女外觀的根節點
 */
export function measureGrip(vrm, nodes, flip, root) {
  const pose = createPose();
  shapeHand(pose, 'right', -1, GRIP);
  const set = shape => {
    for (const b of HAND_BONES) {
      const n = nodes['right' + b], r = pose.rot['right' + b];
      if (n) n.rotation.set(shape ? flip * r[0] : 0, shape ? r[1] : 0, shape ? flip * r[2] : 0);
    }
    vrm.humanoid.update();
    root.updateMatrixWorld(true);
  };
  const raw = name => vrm.humanoid.getRawBoneNode(name);
  const hand = raw('rightHand');
  const grip = { center: new Vector3(), axis: new Vector3(0, 0, 1) };
  set(true);
  const k = raw('rightMiddleProximal'), i = raw('rightMiddleIntermediate'), d = raw('rightMiddleDistal');
  if (hand && k && i && d) {
    const K = k.getWorldPosition(new Vector3()), I = i.getWorldPosition(new Vector3()), D = d.getWorldPosition(new Vector3());
    const axis = _n.crossVectors(_a.subVectors(I, K), _b.subVectors(D, I));
    if (axis.lengthSq() > 1e-12) {
      axis.normalize();
      // 通過三個關節的圓的圓心：從 K 出發，沿著 KI、KD 兩條弦的垂直平分線找交點
      const u = _a.subVectors(I, K), v = _b.subVectors(D, K), uu = u.dot(u), vv = v.dot(v), uv = u.dot(v), det = 2 * (uu * vv - uv * uv);
      const center = new Vector3();
      if (Math.abs(det) > 1e-12) {
        const s = vv * (uu - uv) / det, t = uu * (vv - uv) / det;
        center.copy(K).addScaledVector(u, s).addScaledVector(v, t);
      } else center.copy(K).add(I).add(D).multiplyScalar(1 / 3);
      grip.center.copy(hand.worldToLocal(center));
      const nHand = nodes.rightHand;
      nHand.getWorldQuaternion(_h);
      grip.axis.copy(axis).applyQuaternion(_h.invert());
    }
  }
  set(false);
  return grip;
}

/**
 * 把右手腕轉一點，讓握拳的空心對準傘柄 shaft（世界座標的單位向量）；回傳轉了多少弧度
 * hand 是正規化的右手節點，姿勢的旋轉要先寫進它與它的上游；limit 是最多轉多少
 * 傘柄與空心的軸可以朝向任一邊，取比較近的那一邊
 */
export function alignWrist(hand, axis, shaft, limit) {
  hand.updateWorldMatrix(true, false);
  hand.parent.getWorldQuaternion(_p);
  _h.copy(_p).multiply(hand.quaternion);                 // 手現在的世界朝向
  _c.copy(axis).applyQuaternion(_h);
  if (_c.dot(shaft) < 0) _c.negate();
  _d.setFromUnitVectors(_c, shaft);
  const angle = 2 * Math.acos(Math.min(1, Math.abs(_d.w)));
  if (angle > limit) _d.slerp(_l.identity(), 1 - limit / angle);
  // 世界座標的修正換回手腕的局部座標：新的局部旋轉 = 上游⁻¹ · 修正 · 上游 · 原本的局部旋轉
  hand.quaternion.premultiply(_p).premultiply(_d).premultiply(_p.invert());
  return Math.min(angle, limit);
}

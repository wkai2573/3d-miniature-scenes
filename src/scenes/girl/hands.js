// 少女的手形：待機、走路、跑步各一組，由各自的姿勢寫進手指骨骼，再依混合權重和其餘的姿勢一起疊加，切換時自然平順
// 角度一律以左手來寫（VRM 1.0 的朝向，見 pose.js），右手的 y、z 反過來
// T 字站姿時四指朝 +x、掌心朝下；拇指三節在掌面上朝 +x 與 +z 之間張開約 45°
import { Euler, Quaternion, Vector3 } from 'three';
import { hash, noise3 } from '../../engine/noise.js';

const DIGITS = ['Index', 'Middle', 'Ring', 'Little'];
const JOINTS = ['Proximal', 'Intermediate', 'Distal'];
const THUMB = ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'];

/** 手形會動到的骨骼，前面再加上 left 或 right */
export const HAND_BONES = [...DIGITS.flatMap(d => JOINTS.map(j => d + j)), ...THUMB];

// 手形：curl 是四指近節、中節、遠節的彎曲，spread 是指根往拇指那側張開（負值往小指那側）
// thumb 的掌骨先往食指靠攏 adduct、再繞著四指的方向轉到掌心前方 oppose，近節與遠節往指腹彎 flex
// 放鬆的手：四指併攏，食指彎得最少、小指彎得最多但差距不大，自然往下垂，拇指靠在食指前方
const RELAXED = {
  curl: [[0.14, 0.22, 0.15], [0.18, 0.27, 0.17], [0.22, 0.31, 0.19], [0.27, 0.35, 0.21]],
  spread: [0.01, 0, -0.01, -0.02],
  thumb: { adduct: 0.32, oppose: 0.38, flex: [0.12, 0.22] },
};
// 走路：和待機差不多放鬆，四指併攏，比待機多彎一點
export const LOOSE = {
  curl: [[0.18, 0.28, 0.18], [0.22, 0.32, 0.2], [0.26, 0.36, 0.22], [0.3, 0.4, 0.24]],
  spread: [0.01, 0, -0.01, -0.02],
  thumb: { adduct: 0.36, oppose: 0.42, flex: [0.16, 0.26] },
};
// 跑步：輕輕握拳，拇指收在食指與中指的中節上
export const FIST = {
  curl: [[0.95, 1.2, 0.75], [1.05, 1.3, 0.8], [1.1, 1.3, 0.8], [1.15, 1.25, 0.75]],
  spread: [0.02, 0, -0.02, -0.04],
  thumb: { adduct: 0.5, oppose: 0.75, flex: [0.4, 0.5] },
};

// 握著傘柄：四指環握一根粗約兩公分的柄，拇指壓在食指上
export const GRIP = {
  curl: [[0.75, 0.95, 0.6], [0.8, 1.0, 0.65], [0.85, 1.0, 0.65], [0.9, 0.95, 0.6]],
  spread: [0.02, 0, -0.02, -0.04],
  thumb: { adduct: 0.45, oppose: 0.7, flex: [0.35, 0.45] },
};

// 拇指近節與遠節往指腹彎的轉軸：指腹朝向掌心那側與四指那側的中間
const THUMB_DIR = new Vector3(1, 0, 1).normalize();
const THUMB_PAD = new Vector3(1, -Math.SQRT2, -1).normalize();
const THUMB_AXIS = new Vector3().crossVectors(THUMB_DIR, THUMB_PAD).normalize();
const _q = new Quaternion(), _e = new Euler();

const SQUEEZE = [0.1, 0.16, 0.2, 0.22];   // 輕收時四指各多彎多少，小指收得最多

/**
 * 把手形寫進 side 那隻手的手指骨骼，k 是那一側在 x 軸上的方向（左 1、右 −1）
 * squeeze 0 ~ 1 讓手指多收一點；reach 0 ~ 1 讓食指微彎、拇指貼到食指側面；rub 是拇指沿著食指來回的角度
 * sway 讓四指一起往前（負值往後）擺，走路時跟著擺臂晃
 */
export function shapeHand(out, side, k, shape, { squeeze = 0, reach = 0, rub = 0, sway = 0 } = {}) {
  DIGITS.forEach((d, f) => {
    const extra = squeeze * SQUEEZE[f] + (f === 0 ? 0.22 * reach : 0);
    JOINTS.forEach((j, i) => {
      const r = out.rot[side + d + j];
      r[0] = 0;
      r[1] = i ? 0 : -k * (shape.spread[f] + sway);
      r[2] = -k * (shape.curl[f][i] + extra * (i === 1 ? 1.2 : 1));
    });
  });
  const { adduct, oppose, flex } = shape.thumb;
  const meta = out.rot[side + 'ThumbMetacarpal'];
  meta[0] = oppose + 0.08 * squeeze + 0.12 * reach;
  meta[1] = k * (adduct + 0.1 * reach + rub);
  meta[2] = 0;
  for (let i = 0; i < 2; i++) {
    _e.setFromQuaternion(_q.setFromAxisAngle(THUMB_AXIS, flex[i] + 0.12 * squeeze + 0.15 * reach), 'XYZ');
    const r = out.rot[side + THUMB[i + 1]];
    r[0] = _e.x; r[1] = k * _e.y; r[2] = k * _e.z;
  }
}

// ---- 待機時手指的小動作 ----
// 時間切成一格一格，每格用雜湊決定這一格有沒有動作、從什麼時候開始；相同的時間一定得到相同的手形
const SQUEEZE_EVERY = 5, SQUEEZE_LENGTH = 1.5;   // 輕收：大約每 5 秒一格，一次 1.5 秒，收得快放得慢
const RUB_EVERY = 24, RUB_LENGTH = 2.8;          // 搓食指：大約每 24 秒一格，三成的格子會發生，一次只有一隻手
const smooth = s => s * s * (3 - 2 * s);
const handOpts = { squeeze: 0, reach: 0, rub: 0 };

// 這一格的動作從哪裡開始；odds 是這一格有動作的機率，沒有時回傳 null。動作不會超出自己那一格，起點至少隔開兩成格子
function slotStart(n, every, length, seed, odds) {
  if (hash(n, seed, 0) >= odds) return null;
  return (n + 0.2 + (0.8 - length / every) * hash(n, seed, 1)) * every;
}

// 輕收的程度 0 ~ 1：前三成時間收起、後七成慢慢放開，起落都平滑
function squeezeAt(t, seed) {
  const start = slotStart(Math.floor(t / SQUEEZE_EVERY), SQUEEZE_EVERY, SQUEEZE_LENGTH, seed, 0.85);
  const u = start === null ? -1 : (t - start) / SQUEEZE_LENGTH;
  if (u <= 0 || u >= 1) return 0;
  return u < 0.3 ? smooth(u / 0.3) : smooth((1 - u) / 0.7);
}

/** 待機的手：放鬆的手形、手指緩緩漂動，每隔幾秒輕輕收一下再放開，偶爾一隻手的拇指輕搓食指 */
export function idleHands(t, out) {
  const n = Math.floor(t / RUB_EVERY), start = slotStart(n, RUB_EVERY, RUB_LENGTH, 71, 0.3);
  const u = start === null ? -1 : (t - start) / RUB_LENGTH;
  const rubbing = u > 0 && u < 1 ? (hash(n, 71, 2) < 0.5 ? 'left' : 'right') : null;
  const env = rubbing ? Math.sin(Math.PI * u) ** 2 : 0;
  for (const [s, k, seed] of [['left', 1, 11], ['right', -1, 23]]) {
    const mine = s === rubbing ? env : 0;
    handOpts.squeeze = squeezeAt(t, seed) * (1 - mine);
    handOpts.reach = mine;
    handOpts.rub = mine * 0.09 * Math.sin(t * 2 * Math.PI * 2.2);
    shapeHand(out, s, k, RELAXED, handOpts);
    // 手指各自緩緩漂動一點點，靜止時也不會像蠟像
    DIGITS.forEach((d, f) => { out.rot[s + d + 'Proximal'][2] -= k * 0.03 * noise3(t * 0.3, f * 3.7, seed); });
  }
}

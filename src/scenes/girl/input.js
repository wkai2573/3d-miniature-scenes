// 少女輸入：讀取 WASD 的按鍵狀態組成移動方向，以及有沒有按住 Shift
// 以實體按鍵位置判斷，不受輸入法與大小寫影響
// 輸入焦點在可以打字的元件上、或場景選單開著時，移動鍵不會讓少女移動；滑桿不吃字母鍵，焦點留在滑桿上照樣能走

// 每個按鍵代表的方向：x 右為正、y 前為正；左右兩個 Shift 都能跑
const KEYS = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] };
const RUN = ['ShiftLeft', 'ShiftRight'];
const FORM = 'input:not([type="range"]), textarea, select, [contenteditable]';

const inForm = el => el instanceof Element && !!el.closest(FORM);

/** 少女的按鍵這時該不該被忽略：輸入焦點在可以打字的元件上，或場景選單開著 */
export const keysIgnored = (focus = document.activeElement) => inForm(focus) || !!document.querySelector('#scene-menu.is-open');

export function createGirlInput() {
  const held = new Set();
  // Windows 同時按住左右 Shift 再放開，常常只送出其中一個的 keyup；按鍵事件上沒有 Shift 就表示兩個都放開了
  const dropShift = e => { if (!e.shiftKey) for (const c of RUN) held.delete(c); };
  addEventListener('keydown', e => {
    dropShift(e);
    if (!(e.code in KEYS || RUN.includes(e.code)) || e.ctrlKey || e.metaKey || e.altKey || inForm(e.target)) return;
    held.add(e.code);
  });
  addEventListener('keyup', e => {
    held.delete(e.code);
    dropShift(e);
    if (e.key === 'Meta') held.clear();   // macOS 按住 Cmd 時，其他鍵放開不會送出 keyup
  });
  addEventListener('blur', () => held.clear());   // 切到別的視窗時當作全部放開，按鍵才不會卡住

  return {
    /** 這一格的輸入：move 是移動方向，按鍵互相抵銷時是零向量；run 是有沒有按住 Shift */
    read() {
      const move = { x: 0, y: 0 };
      if (!held.size || keysIgnored()) return { move, run: false };
      for (const c of held) if (c in KEYS) { move.x += KEYS[c][0]; move.y += KEYS[c][1]; }
      return { move, run: RUN.some(c => held.has(c)) };
    },
  };
}

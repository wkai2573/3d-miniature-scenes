// 右上角的聲音按鈕：點一下展開小面板（開關、音量百分比），播放時四根音量條跳動。
// 聲音本身在 src/engine/audio.js，兩邊用事件溝通；場景沒載入音訊引擎時按鈕不會出現。
// 鍵盤：S 開關、− / ＋ 每次調 10%、面板開著時 Esc 關閉。

const TIP = '點一下畫面，播放環境音';

export function initSound(current) {
  const el = document.createElement('div');
  el.className = 'snd';
  el.hidden = true;
  el.style.setProperty('--accent', current.accent);
  el.innerHTML = /* html */`
    <button class="snd-btn" type="button" aria-expanded="false" aria-controls="snd-panel" aria-label="環境音與音量" title="環境音（S）">
      <span class="snd-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </button>
    <span class="snd-tip" aria-hidden="true">${TIP}</span>
    <div class="snd-panel" id="snd-panel">
      <div class="snd-row">
        <span class="snd-label" id="snd-label">環境音</span>
        <button class="snd-switch" type="button" role="switch" aria-checked="false" aria-labelledby="snd-label"><span></span></button>
      </div>
      <div class="snd-row">
        <input class="snd-range" type="range" min="0" max="100" step="1" value="80" aria-label="音量">
        <output class="snd-pct">80%</output>
      </div>
      <p class="snd-keys"><span><kbd>S</kbd> 開關</span><span><kbd>−</kbd><kbd>＋</kbd> 音量</span></p>
    </div>`;
  document.body.appendChild(el);

  const btn = el.querySelector('.snd-btn');
  const panel = el.querySelector('.snd-panel');
  const sw = el.querySelector('.snd-switch');
  const range = el.querySelector('.snd-range');
  const pct = el.querySelector('.snd-pct');
  const tip = el.querySelector('.snd-tip');
  let open = false, state = 'wait', volume = 80, dragging = false, flashTimer = 0;
  panel.inert = true;

  const paint = v => {
    range.style.setProperty('--v', v + '%');
    pct.textContent = v + '%';
  };

  addEventListener('sound:state', e => {
    ({ state, volume } = e.detail);
    el.hidden = false;
    el.dataset.state = state;
    sw.setAttribute('aria-checked', String(state !== 'off'));
    btn.title = (state === 'on' ? '環境音播放中' : state === 'off' ? '環境音已關閉' : '環境音') + '（S）';
    if (!dragging) { range.value = volume; paint(volume); }
  });

  function setOpen(v, moveFocus) {
    if (open === v) return;
    open = v;
    el.classList.toggle('is-open', v);
    btn.setAttribute('aria-expanded', String(v));
    panel.inert = !v;
    if (v && moveFocus) range.focus({ preventScroll: true });
    else if (!v && moveFocus) btn.focus({ preventScroll: true });
  }

  const setVolume = v => dispatchEvent(new CustomEvent('sound:volume', { detail: v }));

  // 按鍵調音量時，在按鈕下方短暫顯示目前的百分比
  function flash(text) {
    tip.textContent = text;
    el.classList.add('is-flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.classList.remove('is-flash'); tip.textContent = TIP; }, 1200);
  }

  btn.addEventListener('click', e => {
    if (state === 'wait') dispatchEvent(new CustomEvent('sound:set', { detail: true }));   // 還沒出聲：順便開始播放
    setOpen(!open, e.detail === 0);
  });
  sw.addEventListener('click', () => dispatchEvent(new CustomEvent('sound:set', { detail: state === 'off' })));
  range.addEventListener('input', () => { dragging = true; paint(+range.value); setVolume(+range.value); });
  range.addEventListener('change', () => { dragging = false; });

  // 點面板以外的地方就收起來
  document.addEventListener('pointerdown', e => { if (open && !el.contains(e.target)) setOpen(false, false); });

  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.target instanceof Element && e.target.closest('input:not([type="range"]), textarea, select, [contenteditable]')) return;
    const k = e.key;
    if (k === 'Escape' && open) {
      setOpen(false, el.contains(document.activeElement));
    } else if ((k === 's' || k === 'S') && !e.repeat) {
      e.preventDefault();
      dispatchEvent(new Event('sound:toggle'));
    } else if (['-', '_', '=', '+'].includes(k)) {
      e.preventDefault();
      const v = Math.min(100, Math.max(0, Math.round((volume + (k === '-' || k === '_' ? -10 : 10)) / 10) * 10));
      setVolume(v);
      if (!open) flash(`音量 ${v}%` + (state === 'off' ? '（已關閉）' : ''));
    }
  });

  return {
    show(instant) {
      el.classList.toggle('is-instant', instant);
      el.classList.add('is-ready');
    },
  };
}

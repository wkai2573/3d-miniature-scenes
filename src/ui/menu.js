// 場景選單：左上角的按鈕展開場景卡片，選了別的場景就交給轉場布幕（src/ui/veil.js）換頁。
// 鍵盤：M 開關選單、Esc 關閉、數字鍵直接切換、選單開著時上下鍵在卡片間移動。
import { SCENES } from './scenes.js';

const nav = document.getElementById('scene-menu');
if (nav) initMenu(nav);

function initMenu(nav) {
  const current = SCENES.find(s => s.id === nav.dataset.current) ?? SCENES[0];
  const no = s => 'No.' + String(SCENES.indexOf(s) + 1).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  nav.classList.add('sm');
  nav.style.setProperty('--accent', current.accent);
  nav.innerHTML = /* html */`
    <button class="sm-toggle" type="button" aria-expanded="false" aria-controls="sm-panel" aria-label="切換場景，目前是 ${esc(current.title)}">
      <span class="cube" aria-hidden="true"></span>
      <span class="sm-now" aria-hidden="true">
        <span class="sm-no">${no(current)}</span>
        <span class="sm-name" lang="ja">${esc(current.title)}</span>
      </span>
      <span class="sm-chev" aria-hidden="true"></span>
    </button>
    <div class="sm-panel" id="sm-panel">
      <p class="sm-head"><span>微縮場景</span><span>共 ${SCENES.length} 座</span></p>
      <ul class="sm-list">${SCENES.map((s, i) => /* html */`
        <li style="--i:${i}; --accent:${s.accent}">
          <a class="sm-card" href="${esc(s.href)}" data-id="${s.id}"${s === current ? ' aria-current="page"' : ''}>
            <span class="sm-thumb">
              <img src="${esc(s.thumb)}" alt="" width="640" height="400" decoding="async">
              ${s === current ? '<span class="sm-badge">展示中</span>' : ''}
            </span>
            <span class="sm-info">
              <span class="sm-cardno">${no(s)}</span>
              <span class="sm-title" lang="ja">${esc(s.title)}</span>
              <span class="sm-desc">${esc(s.desc)}</span>
              <span class="sm-tags"><span>${esc(s.when)}</span><span>${esc(s.style)}</span></span>
            </span>
          </a>
        </li>`).join('')}
      </ul>
      <p class="sm-keys"><span><kbd>M</kbd> 開關選單</span><span><kbd>1</kbd>–<kbd>${SCENES.length}</kbd> 切換場景</span><span><kbd>Esc</kbd> 關閉</span></p>
    </div>`;

  const toggle = nav.querySelector('.sm-toggle');
  const panel = nav.querySelector('.sm-panel');
  const cards = [...nav.querySelectorAll('.sm-card')];
  let open = false, leaving = false;
  panel.inert = true;

  function setOpen(v, moveFocus) {
    if (open === v) return;
    open = v;
    nav.classList.toggle('is-open', v);
    toggle.setAttribute('aria-expanded', String(v));
    panel.inert = !v;
    if (!moveFocus) return;
    if (v) (cards.find(c => c.hasAttribute('aria-current')) ?? cards[0]).focus({ preventScroll: true });
    else toggle.focus({ preventScroll: true });
  }

  // 按鈕彈一下：布幕落進按鈕時、或按了目前場景的數字鍵時
  function bump() {
    toggle.classList.remove('is-bump');
    void toggle.offsetWidth;
    toggle.classList.add('is-bump');
  }

  function go(s, from) {
    if (!s || leaving) return;
    if (s === current) { if (open) setOpen(false, false); else bump(); return; }
    leaving = true;
    const r = (from ?? toggle).getBoundingClientRect();
    const d = { no: no(s), title: s.title, desc: s.desc, accent: s.accent, veil: s.veil };
    setOpen(false, false);
    const veil = window.__veil;
    (veil ? veil.cover(d, r.left + r.width / 2, r.top + r.height / 2) : Promise.resolve())
      .catch(() => {})
      .then(() => { location.href = s.href; });
  }

  toggle.addEventListener('click', e => setOpen(!open, e.detail === 0));   // detail 為 0 表示用鍵盤按下

  cards.forEach(a => a.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // 讓「在新分頁開啟」照常運作
    e.preventDefault();
    go(SCENES.find(s => s.id === a.dataset.id), a.querySelector('.sm-thumb'));
  }));

  // 點選單以外的地方（包含開始拖曳場景）就收起來
  document.addEventListener('pointerdown', e => { if (open && !nav.contains(e.target)) setOpen(false, false); });

  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || leaving) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const k = e.key;
    if (k === 'Escape' && open) {
      e.preventDefault();
      setOpen(false, true);
    } else if ((k === 'm' || k === 'M') && !e.repeat) {
      e.preventDefault();
      setOpen(!open, true);
    } else if (/^[1-9]$/.test(k) && !e.repeat && SCENES[k - 1]) {
      e.preventDefault();
      go(SCENES[k - 1], open ? cards[k - 1].querySelector('.sm-thumb') : null);
    } else if (open && (k === 'ArrowDown' || k === 'ArrowUp')) {
      e.preventDefault();
      const n = cards.length, step = k === 'ArrowDown' ? 1 : -1, i = cards.indexOf(document.activeElement);
      cards[i < 0 ? (step > 0 ? 0 : n - 1) : (i + step + n) % n].focus();
    }
  });

  // 第一次載入：場景畫出來後按鈕才滑進來。有轉場布幕時按鈕要先就位，布幕才能收進它
  const show = instant => {
    nav.classList.toggle('is-instant', instant);
    nav.classList.add('is-ready');
  };
  if (window.__veil?.active) show(true);
  else if (window.__sceneStarted) show(false);
  else {
    addEventListener('scene:ready', () => show(false), { once: true });
    addEventListener('scene:fail', () => show(false), { once: true });   // 載入失敗時仍可切到別的場景
  }
  addEventListener('veil:landed', bump);
  addEventListener('pageshow', e => { if (e.persisted) { leaving = false; setOpen(false, false); } });
}

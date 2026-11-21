// 場景選單：左上角的按鈕展開場景卡片，選了別的場景就交給轉場布幕（src/ui/veil.js）換頁。
// 鍵盤：M 開關選單、Esc 關閉、數字鍵直接切換、選單開著時上下鍵在卡片間移動。
// 面板最下方有語言切換（繁中、EN、日本語）；切換時只更新文字與 aria 屬性，不重建 DOM，選單保持開啟、焦點留在按鈕上。
// 右上角的聲音按鈕在 sound.js、下方的時間與天氣面板在 env.js，都跟著選單一起出現。
import { SCENES, wasdFree, sceneKey } from './scenes.js';
import { initSound } from './sound.js';
import { initEnv } from './env.js';
import { t } from './t.js';

const nav = document.getElementById('scene-menu');
if (nav) initMenu(nav);

function initMenu(nav) {
  const current = SCENES.find(s => s.id === nav.dataset.current) ?? SCENES[0];
  const keys = wasdFree(current);   // 場景用 WASD 操作少女時，天氣與聲音只能用滑鼠
  const no = s => 'No.' + String(SCENES.indexOf(s) + 1).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const hint = (k, key) => `<span>${k} <span data-t="${key}"></span></span>`;

  // 會隨語系變的文字在這裡都是空的，由下面的 paint() 填入
  nav.classList.add('sm');
  nav.style.setProperty('--accent', current.accent);
  nav.innerHTML = /* html */`
    <button class="sm-toggle" type="button" aria-expanded="false" aria-controls="sm-panel">
      <span class="cube" aria-hidden="true"></span>
      <span class="sm-now" aria-hidden="true">
        <span class="sm-no">${no(current)}</span>
        <span class="sm-name" lang="ja">${esc(current.title)}</span>
      </span>
      <span class="sm-chev" aria-hidden="true"></span>
    </button>
    <div class="sm-panel" id="sm-panel">
      <p class="sm-head"><span data-t="menu.title"></span><span class="sm-count"></span></p>
      <ul class="sm-list">${SCENES.map((s, i) => /* html */`
        <li style="--i:${i}; --accent:${s.accent}">
          <a class="sm-card" href="${esc(s.href)}" data-id="${s.id}"${s === current ? ' aria-current="page"' : ''}>
            <span class="sm-thumb">
              <img src="${esc(s.thumb)}" alt="" width="640" height="400" decoding="async">
              ${s === current ? '<span class="sm-badge" data-t="menu.current"></span>' : ''}
            </span>
            <span class="sm-info">
              <span class="sm-cardno">${no(s)}</span>
              <span class="sm-title" lang="ja">${esc(s.title)}</span>
              <span class="sm-desc" data-t="${sceneKey(s, 'desc')}"></span>
              <span class="sm-tags"><span data-t="${sceneKey(s, 'when')}"></span><span data-t="${sceneKey(s, 'style')}"></span></span>
            </span>
          </a>
        </li>`).join('')}
      </ul>
      <p class="sm-keys">${hint('<kbd>M</kbd>', 'menu.key.menu')}${hint(`<kbd>1</kbd>–<kbd>${SCENES.length}</kbd>`, 'menu.key.switch')}${keys ? hint('<kbd>S</kbd>', 'menu.key.sound') : ''}${hint('<kbd>−</kbd><kbd>＋</kbd>', 'menu.key.volume')}${keys ? hint('<kbd>W</kbd>', 'menu.key.weather') : ''}${hint('<kbd>←</kbd><kbd>→</kbd>', 'menu.key.time')}${hint('<kbd>Esc</kbd>', 'menu.key.close')}</p>
      <div class="sm-lang">
        <span class="sm-lang-label" id="sm-lang-label" data-t="menu.lang"></span>
        <div class="sm-lang-btns" role="group" aria-labelledby="sm-lang-label">${window.__i18n.LANGS.map(l => /* html */`
          <button class="sm-lang-btn" type="button" data-lang="${l.id}" lang="${l.id}" aria-pressed="false">${esc(l.label)}</button>`).join('')}
        </div>
      </div>
    </div>`;

  const toggle = nav.querySelector('.sm-toggle');
  const panel = nav.querySelector('.sm-panel');
  const cards = [...nav.querySelectorAll('.sm-card')];
  const langBtns = [...nav.querySelectorAll('.sm-lang-btn')];

  // 把所有會隨語系變的文字與 aria 屬性換成目前語系；不動 DOM 結構，開關狀態與焦點都保留
  function paint() {
    window.__i18n.apply(nav);
    nav.setAttribute('aria-label', t('menu.nav'));
    toggle.setAttribute('aria-label', t('menu.toggle', { title: current.title }));
    nav.querySelector('.sm-count').textContent = t('menu.count', { n: SCENES.length });
    for (const b of langBtns) b.setAttribute('aria-pressed', String(b.dataset.lang === window.__i18n.lang));
  }
  paint();
  addEventListener('lang:change', paint);
  langBtns.forEach(b => b.addEventListener('click', () => window.__i18n.set(b.dataset.lang)));

  const sound = initSound(current);
  const env = initEnv(current);

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
    const d = { no: no(s), title: s.title, desc: t(sceneKey(s, 'desc')), accent: s.accent, veil: s.veil };   // 說明是離開時的語系，換頁後語系沿用
    setOpen(false, false);
    dispatchEvent(new Event('scene:leave'));   // 環境音跟著淡出
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
    sound.show(instant);
    env.show(instant);
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

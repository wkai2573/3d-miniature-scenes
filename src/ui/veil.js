// 場景轉場布幕（一般腳本，非模組）。放在 canvas 之後、模組之前，換頁後第一次繪製時就能蓋住畫面。
// 離開：cover() 從點擊處以圓形展開布幕、記下目標場景，再由選單換頁。
// 進入：讀到記錄就立刻蓋上布幕；場景畫出第一格（scene:ready）後，布幕收進左上角的選單按鈕。
(function () {
  var KEY = 'scene-veil', MAX_AGE = 10000;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el = null;

  function make(d, mode) {
    var v = document.createElement('div');
    v.className = 'veil ' + mode;
    v.setAttribute('role', 'status');
    v.style.setProperty('--accent', d.accent);
    v.style.setProperty('--veil-a', d.veil[0]);
    v.style.setProperty('--veil-b', d.veil[1]);

    var mark = document.createElement('span');
    mark.className = 'veil-mark';
    var cube = document.createElement('span');
    cube.className = 'cube';
    mark.appendChild(cube);

    var no = document.createElement('p');
    no.className = 'veil-no';
    no.textContent = d.no;

    var title = document.createElement('p');
    title.className = 'veil-title';
    title.lang = 'ja';
    Array.from(d.title).forEach(function (ch, i) {
      var s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--i', i);
      title.appendChild(s);
    });

    var sub = document.createElement('p');
    sub.className = 'veil-sub';
    sub.textContent = d.desc;

    v.append(mark, no, title, sub);
    document.body.appendChild(v);
    return v;
  }

  function circle(r, x, y) { return 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'; }
  function farthest(x, y) { return Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 2; }

  // 離開目前場景：布幕展開、標題逐字浮現，留一點時間讓人讀到名字再換頁
  function cover(d, x, y) {
    if (el) el.remove();
    el = make(d, 'is-cover');
    var a = reduce
      ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'both' })
      : el.animate([{ clipPath: circle(0, x, y) }, { clipPath: circle(farthest(x, y), x, y) }],
        { duration: 760, easing: 'cubic-bezier(.66,0,.2,1)', fill: 'both' });
    return a.finished.then(function () {
      try { sessionStorage.setItem(KEY, JSON.stringify(Object.assign({ at: Date.now() }, d))); } catch (e) { /* 無法記錄就不接續布幕 */ }
      return new Promise(function (r) { setTimeout(r, reduce ? 0 : 420); });
    });
  }

  function landing() {
    var t = document.querySelector('.sm-toggle .cube');
    if (!t) return [40, 40];
    var r = t.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  // 新場景就緒：文字先淡出，布幕再收成一點落進選單按鈕
  function reveal() {
    if (!el || !el.classList.contains('is-held')) return;
    var v = el, p = landing();
    el = null;
    v.classList.add('is-leaving');
    var a = reduce
      ? v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'both' })
      : v.animate([{ clipPath: circle(farthest(p[0], p[1]), p[0], p[1]) }, { clipPath: circle(0, p[0], p[1]) }],
        { duration: 900, delay: 240, easing: 'cubic-bezier(.7,0,.25,1)', fill: 'both' });
    a.finished.then(function () {
      v.remove();
      dispatchEvent(new Event('veil:landed'));
    });
  }

  function drop() {
    if (el) { el.remove(); el = null; }
  }

  var saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
  } catch (e) { /* 沒有記錄就照一般載入 */ }
  if (saved && Date.now() - saved.at < MAX_AGE) el = make(saved, 'is-held');

  addEventListener('scene:ready', function () { requestAnimationFrame(reveal); });
  addEventListener('scene:fail', drop);   // 讓 #note 的錯誤訊息露出來
  addEventListener('pageshow', function (e) { if (e.persisted) drop(); });   // 從上一頁快取返回時拿掉舊布幕

  window.__veil = { cover: cover, get active() { return !!el; } };
})();

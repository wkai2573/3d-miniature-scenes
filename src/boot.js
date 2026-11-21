// 一般腳本（非模組），比模組先執行。
// 模組載入失敗或執行出錯時，把原因顯示在畫面上，而不是留下一片黑。
// 訊息文字從語系核心（src/i18n.js）取；錯誤畫面出現後切換語系，訊息會跟著換。
(function () {
  var note = document.getElementById('note');
  var i18n = window.__i18n;
  var shown = null;   // 目前顯示的錯誤原因：回傳文字的函式，語系切換時重新呼叫

  function render() {
    var hint = location.protocol === 'file:' ? i18n.t('boot.hintFile') : i18n.t('boot.hintNet');
    note.textContent = i18n.t('boot.fail', { msg: shown(), hint: hint });
  }

  // reason 是字典 key（會翻譯）或原樣顯示的字串（瀏覽器給的錯誤訊息）
  function fail(reason, translated) {
    if (window.__sceneStarted) return;
    shown = translated ? function () { return i18n.t(reason); } : function () { return reason; };
    note.className = 'error';
    render();
    window.dispatchEvent(new Event('scene:fail'));   // 讓轉場布幕退開、選單照常出現
  }
  window.__sceneFail = function (msg) { fail(msg, false); };

  window.addEventListener('lang:change', function () { if (shown) render(); });

  window.addEventListener('error', function (e) {
    if (e instanceof ErrorEvent) fail(e.message, false);
    else if (e.target && e.target.tagName === 'SCRIPT') fail('boot.moduleFail', true);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    fail(String(e.reason && e.reason.message || e.reason), false);
  });

  var c = document.createElement('canvas');
  if (!(c.getContext('webgl2') || c.getContext('webgl'))) fail('boot.noWebgl', true);

  setTimeout(function () {
    if (!window.__sceneStarted && note.className !== 'error') fail('boot.timeout', true);
  }, 25000);
})();

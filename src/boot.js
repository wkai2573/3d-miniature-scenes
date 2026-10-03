// 一般腳本（非模組），比模組先執行。
// 模組載入失敗或執行出錯時，把原因顯示在畫面上，而不是留下一片黑。
(function () {
  var note = document.getElementById('note');

  function fail(msg) {
    if (window.__sceneStarted) return;
    note.className = 'error';
    var hint = location.protocol === 'file:'
      ? '這個專案使用 ES 模組，不能直接雙擊 index.html 開啟。\n請在專案資料夾執行 bun start，再用瀏覽器開啟 http://localhost:5173'
      : '請改用 Chrome / Edge / Firefox 開啟，並確認網路能連到 cdn.jsdelivr.net。';
    note.textContent = '場景無法顯示：' + msg + '\n\n' + hint;
    window.dispatchEvent(new Event('scene:fail'));   // 讓轉場布幕退開、選單照常出現
  }
  window.__sceneFail = fail;

  window.addEventListener('error', function (e) {
    if (e instanceof ErrorEvent) fail(e.message);
    else if (e.target && e.target.tagName === 'SCRIPT') fail('模組載入失敗');
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    fail(String(e.reason && e.reason.message || e.reason));
  });

  var c = document.createElement('canvas');
  if (!(c.getContext('webgl2') || c.getContext('webgl'))) fail('這個瀏覽器或顯示卡沒有開啟 WebGL。');

  setTimeout(function () {
    if (!window.__sceneStarted && note.className !== 'error') fail('等候逾時，模組或 three.js 沒有載入成功。');
  }, 25000);
})();

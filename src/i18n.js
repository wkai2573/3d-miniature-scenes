// 語系核心（一般腳本，非模組）。三個場景頁都在轉場布幕與 boot 之前載入它。
// 轉場布幕與 boot 是一般腳本、執行時機比模組早，所以這裡不用 import / export，介面掛在 window.__i18n 上。
// 載入當下就決定語系並設好 <html lang>、分頁標題、畫布說明與載入文字；之後 set() 切換語系並發出 lang:change。
// 頂層碰 document、localStorage、navigator 前都先確認它們存在，這樣 bun 測試也能直接載入。
// 招牌字（3D 場景貼圖上的字）、場景名稱、og 與 meta description、console 訊息都不翻，見 docs/adr/。
(function (root) {
  var KEY = 'scene-lang';   // localStorage，三個場景頁共用
  var LANGS = [
    { id: 'zh-Hant', label: '繁中' },
    { id: 'en', label: 'EN' },
    { id: 'ja', label: '日本語' },
  ];

  // 每個 key 依序是 [繁中, 英文, 日文]，三種譯文並排方便審查
  var ENTRIES = {
    // 場景選單
    'menu.nav': ['場景選單', 'Scene menu', 'シーンメニュー'],
    'menu.toggle': ['切換場景，目前是 {title}', 'Switch scene. Current: {title}', 'シーンを切り替え。現在は{title}'],
    'menu.title': ['微縮場景', 'Miniature Scenes', 'ミニチュアシーン'],
    'menu.count': ['共 {n} 座', '{n} scenes', '全{n}シーン'],
    'menu.current': ['展示中', 'On display', '表示中'],
    'menu.lang': ['語言', 'Language', '言語'],
    'menu.key.menu': ['開關選單', 'Toggle menu', 'メニューを開閉'],
    'menu.key.switch': ['切換場景', 'Switch scene', 'シーン切り替え'],
    'menu.key.sound': ['聲音', 'Sound', 'サウンド'],
    'menu.key.volume': ['音量', 'Volume', '音量'],
    'menu.key.weather': ['天氣', 'Weather', '天気'],
    'menu.key.time': ['時間', 'Time', '時刻'],
    'menu.key.close': ['關閉', 'Close', '閉じる'],

    // 場景卡片與轉場布幕上的說明
    'scene.konbini.desc': ['深夜下著雨，街角的便利商店還亮著燈', 'A convenience store still lit on a rainy corner, deep in the night', '深夜の雨、街角のコンビニはまだ明かりがついている'],
    'scene.konbini.when': ['秋・深夜・雨', 'Autumn · Late night · Rain', '秋・深夜・雨'],
    'scene.konbini.style': ['三渲二', 'Cel-shaded', 'セルルック'],
    'scene.girl.desc': ['撐著透明傘的少女，走過下著雨的便利商店街角', 'A girl with a clear umbrella walks past a rainy convenience store', '透明な傘をさした少女が、雨のコンビニの前を歩いていく'],
    'scene.girl.when': ['秋・深夜・雨', 'Autumn · Late night · Rain', '秋・深夜・雨'],
    'scene.girl.style': ['三渲二・可操作', 'Cel-shaded · Playable', 'セルルック・操作できる'],
    'scene.ryokan.desc': ['浮在晚秋夜空裡、剛點上燈的溫泉旅館', 'A hot-spring inn floating in the late-autumn night sky, its lanterns just lit', '晩秋の夜空に浮かぶ、明かりがともったばかりの温泉旅館'],
    'scene.ryokan.when': ['晚秋・黃昏', 'Late autumn · Dusk', '晩秋・夕暮れ'],
    'scene.ryokan.style': ['柔和低多邊形', 'Soft low-poly', 'やわらかなローポリ'],

    // 分頁標題、畫布說明、載入文字
    'page.konbini.title': ['雨夜のことりマート', '雨夜のことりマート | Miniature Scenes', '雨夜のことりマート | ミニチュアシーン'],
    'page.konbini.canvas': [
      '雨夜のことりマート：拖曳旋轉、滾輪或雙指縮放、右鍵平移的微縮場景',
      '雨夜のことりマート: a miniature scene. Drag to rotate, scroll or pinch to zoom, right-drag to pan',
      '雨夜のことりマート：ドラッグで回転、ホイールかピンチでズーム、右ドラッグで移動できるミニチュアシーン'],
    'page.konbini.loading': ['正在組裝雨夜的街角…', 'Setting up the rainy street corner…', '雨の街角を組み立てています…'],
    'page.girl.title': ['雨夜のことりマート・傘の少女', '雨夜のことりマート・傘の少女 | Miniature Scenes', '雨夜のことりマート・傘の少女 | ミニチュアシーン'],
    'page.girl.canvas': [
      '雨夜のことりマート・傘の少女：拖曳旋轉、滾輪或雙指縮放、右鍵平移的微縮場景',
      '雨夜のことりマート・傘の少女: a miniature scene. Drag to rotate, scroll or pinch to zoom, right-drag to pan',
      '雨夜のことりマート・傘の少女：ドラッグで回転、ホイールかピンチでズーム、右ドラッグで移動できるミニチュアシーン'],
    'page.girl.loading': ['正在組裝雨夜的街角…', 'Setting up the rainy street corner…', '雨の街角を組み立てています…'],
    'page.ryokan.title': ['秋夜の紅葉屋', '秋夜の紅葉屋 | Miniature Scenes', '秋夜の紅葉屋 | ミニチュアシーン'],
    'page.ryokan.canvas': [
      '秋夜の紅葉屋：拖曳旋轉、滾輪或雙指縮放、右鍵平移的微縮場景',
      '秋夜の紅葉屋: a miniature scene. Drag to rotate, scroll or pinch to zoom, right-drag to pan',
      '秋夜の紅葉屋：ドラッグで回転、ホイールかピンチでズーム、右ドラッグで移動できるミニチュアシーン'],
    'page.ryokan.loading': ['正在準備溫泉旅館…', 'Getting the hot-spring inn ready…', '湯けむりの宿を支度しています…'],

    // 載入失敗
    'boot.fail': ['場景無法顯示：{msg}\n\n{hint}', 'The scene could not be displayed: {msg}\n\n{hint}', 'シーンを表示できません：{msg}\n\n{hint}'],
    'boot.hintFile': [
      '這個專案使用 ES 模組，不能直接雙擊 index.html 開啟。\n請在專案資料夾執行 bun start，再用瀏覽器開啟 http://localhost:5173',
      'This project uses ES modules, so index.html cannot be opened by double-clicking it.\nRun bun start in the project folder, then open http://localhost:5173 in your browser.',
      'このプロジェクトは ES モジュールを使うため、index.html をダブルクリックして開くことはできません。\nプロジェクトのフォルダーで bun start を実行し、ブラウザーで http://localhost:5173 を開いてください。'],
    'boot.hintNet': [
      '請改用 Chrome / Edge / Firefox 開啟，並確認網路能連到 cdn.jsdelivr.net。',
      'Please use Chrome, Edge or Firefox, and make sure your network can reach cdn.jsdelivr.net.',
      'Chrome / Edge / Firefox で開き、cdn.jsdelivr.net に接続できるか確認してください。'],
    'boot.noWebgl': ['這個瀏覽器或顯示卡沒有開啟 WebGL。', 'WebGL is not enabled in this browser or graphics card.', 'このブラウザーまたはグラフィックスカードでは WebGL が有効になっていません。'],
    'boot.timeout': ['等候逾時，模組或 three.js 沒有載入成功。', 'Timed out: the modules or three.js did not load.', 'タイムアウトしました。モジュールまたは three.js を読み込めませんでした。'],
    'boot.moduleFail': ['模組載入失敗', 'A module failed to load', 'モジュールの読み込みに失敗しました'],

    // 時間與天氣面板
    'env.weather': ['天氣', 'Weather', '天気'],
    'env.clear': ['晴', 'Clear', '晴れ'],
    'env.rain': ['雨', 'Rain', '雨'],
    'env.snow': ['雪', 'Snow', '雪'],
    'env.weatherKeyTitle': ['{name}（W 切換天氣）', '{name} (W: change weather)', '{name}（W で天気を切り替え）'],
    'env.time': ['時間', 'Time', '時刻'],
    'env.timeTitle': ['時間（← → 每次一小時）', 'Time (← → : one hour per press)', '時刻（← → で1時間ずつ）'],
    'env.period.lateNight': ['深夜', 'Late night', '深夜'],
    'env.period.earlyMorning': ['清晨', 'Early morning', '早朝'],
    'env.period.morning': ['上午', 'Morning', '午前'],
    'env.period.noon': ['中午', 'Noon', '昼'],
    'env.period.afternoon': ['下午', 'Afternoon', '午後'],
    'env.period.evening': ['傍晚', 'Evening', '夕方'],
    'env.period.night': ['夜晚', 'Night', '夜'],

    // 聲音面板
    'snd.tip': ['點一下畫面，播放環境音', 'Click anywhere to play ambient sound', '画面をクリックして環境音を再生'],
    'snd.btn': ['環境音與音量', 'Ambient sound and volume', '環境音と音量'],
    'snd.label': ['環境音', 'Ambient sound', '環境音'],
    'snd.on': ['環境音播放中', 'Ambient sound playing', '環境音を再生中'],
    'snd.off': ['環境音已關閉', 'Ambient sound off', '環境音はオフ'],
    'snd.withKey': ['{text}（S）', '{text} (S)', '{text}（S）'],
    'snd.volume': ['音量', 'Volume', '音量'],
    'snd.keyToggle': ['開關', 'Toggle', 'オン/オフ'],
    'snd.flash': ['音量 {v}%', 'Volume {v}%', '音量 {v}%'],
    'snd.flashOff': ['音量 {v}%（已關閉）', 'Volume {v}% (off)', '音量 {v}%（オフ）'],

    // 少女場景的相機提示
    'camera.follow': ['跟拍視角', 'Follow view', '追従ビュー'],
    'camera.overview': ['俯瞰視角', 'Overhead view', '俯瞰ビュー'],
  };

  var DICT = {};
  LANGS.forEach(function (l, i) {
    DICT[l.id] = {};
    Object.keys(ENTRIES).forEach(function (k) {
      if (ENTRIES[k][i] != null) DICT[l.id][k] = ENTRIES[k][i];   // 漏翻的 key 不補預設值，讓測試抓得到
    });
  });

  var hasId = function (id) { return LANGS.some(function (l) { return l.id === id; }); };

  /** stored 是合法語系就用它；否則依序看瀏覽器語言，第一個 ja 或 zh 開頭的決定；都沒有就是英文 */
  function resolve(stored, navigatorLanguages) {
    if (hasId(stored)) return stored;
    var list = navigatorLanguages || [];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '');
      if (/^ja([-_]|$)/i.test(code)) return 'ja';
      if (/^zh([-_]|$)/i.test(code)) return 'zh-Hant';
    }
    return 'en';
  }

  function read() {
    try { return root.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { root.localStorage.setItem(KEY, v); } catch (e) { /* 不能記憶就算了 */ }
  }

  var nav = typeof navigator === 'undefined' ? null : navigator;
  var lang = resolve(read(), nav ? (nav.languages && nav.languages.length ? nav.languages : [nav.language]) : []);

  function t(key, vars) {
    var s = DICT[lang][key];
    if (s == null) s = DICT['zh-Hant'][key];
    if (s == null) return key;
    return s.replace(/\{(\w+)\}/g, function (m, name) { return vars && vars[name] != null ? vars[name] : m; });
  }

  /** 把 root 底下標了 data-t（文字）、data-t-aria、data-t-title 的元素換成目前語系 */
  function apply(scope) {
    scope.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
    scope.querySelectorAll('[data-t-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
    scope.querySelectorAll('[data-t-title]').forEach(function (el) { el.setAttribute('title', t(el.getAttribute('data-t-title'))); });
  }

  // <html lang>、分頁標題、畫布說明與載入文字。頁面 id 取自場景選單 nav 的 data-current
  function applyPage() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    var navEl = document.getElementById('scene-menu');
    var id = navEl && navEl.dataset.current;
    if (!id) return;
    var has = function (k) { return DICT[lang][k] != null; };
    if (has('page.' + id + '.title')) document.title = t('page.' + id + '.title');
    var canvas = document.getElementById('stage');
    if (canvas && has('page.' + id + '.canvas')) canvas.setAttribute('aria-label', t('page.' + id + '.canvas'));
    var note = document.getElementById('note');
    if (note && note.className !== 'error' && has('page.' + id + '.loading')) note.textContent = t('page.' + id + '.loading');
  }

  function set(next) {
    if (!hasId(next)) return;
    var changed = next !== lang;
    lang = next;
    write(next);
    applyPage();
    if (changed && typeof root.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      root.dispatchEvent(new CustomEvent('lang:change', { detail: { lang: lang } }));
    }
  }

  applyPage();

  root.__i18n = {
    get lang() { return lang; },
    t: t,
    set: set,
    apply: apply,
    resolve: resolve,
    LANGS: LANGS,
    DICT: DICT,
  };
})(typeof window !== 'undefined' ? window : globalThis);

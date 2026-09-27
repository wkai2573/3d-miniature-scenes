# 3D 微縮場景

用 three.js 手工建模的日式夜景微縮場景集。所有模型、貼圖和動畫都由程式產生，沒有外部模型檔；也不需要建置步驟或安裝套件，開一個本機伺服器就能看。

| 雨夜のことりマート | 秋夜の紅葉屋 |
|---|---|
| ![雨夜のことりマート](assets/thumbs/konbini.jpg) | ![秋夜の紅葉屋](assets/thumbs/ryokan.jpg) |

## 場景

| 場景 | 頁面 | 風格 | 內容 |
|---|---|---|---|
| 雨夜のことりマート | `index.html` | 三渲二（toon 著色＋描邊） | 深夜下雨的街角便利商店。雨絲與地面水花、帶雨痕的玻璃、濕路面倒影、依週期輪替的紅綠燈，店內有貨架、關東煮和咖啡機 |
| 秋夜の紅葉屋 | `ryokan.html` | 柔和低多邊形＋SSAO | 浮在晚秋夜空中的溫泉旅館浮島。後山、台地、庭園、參道四層高低差，五裂楓葉樹冠、陣風與落葉模擬、池塘倒影與漣漪、露天風呂的湯けむり、月亮與雲海 |

## 執行

需要 Node.js（建議 18 以上），以及能連到 `cdn.jsdelivr.net`（three.js）和 Google Fonts 的網路。

```sh
npm start
```

然後用瀏覽器開啟：

- 雨夜のことりマート：http://localhost:5173
- 秋夜の紅葉屋：http://localhost:5173/ryokan.html

不需要 `npm install`：伺服器是零相依的 [server.mjs](server.mjs)，three.js 由 import map 從 CDN 載入。

要換連接埠時設定 `PORT`：

```sh
PORT=8080 npm start            # macOS / Linux / Git Bash
$env:PORT=8080; npm start      # PowerShell
```

> 不能直接雙擊 HTML 檔開啟。瀏覽器不允許從 `file://` 載入 ES 模組，畫面會顯示錯誤提示。

## 操作

| 動作 | 效果 |
|---|---|
| 左鍵拖曳 | 旋轉視角 |
| 滾輪、雙指縮放 | 拉近拉遠 |
| 右鍵拖曳 | 平移 |
| `M` | 開關左上角的場景選單 |
| `1`～`9` | 直接切換到第 N 個場景 |
| `↑` `↓` | 選單開啟時在卡片間移動 |
| `Esc` | 關閉選單 |

- 系統開啟「減少動態效果」時，雨絲和落葉的數量會減少，部分飄動效果停用，轉場布幕改成簡短的淡入淡出。
- 在紅葉屋的網址後面加上 `#noao`（`ryokan.html#noao`）可以關閉 SSAO，方便在較弱的顯示卡上比較效能。

## 專案結構

```
index.html              雨夜のことりマート（預設頁）
ryokan.html             秋夜の紅葉屋
server.mjs              零相依的本機靜態伺服器
css/
  style.css             畫布、載入提示、錯誤訊息
  menu.css              場景選單與轉場布幕
assets/thumbs/          選單卡片縮圖（640 × 400）
src/
  boot.js               一般腳本，比模組先執行；載入失敗時把原因顯示在畫面上
  engine/               兩個場景共用的引擎
  ui/                   場景選單、轉場布幕、場景目錄
  scenes/konbini/       雨夜のことりマート
  scenes/ryokan/        秋夜の紅葉屋
```

### 共用引擎（`src/engine/`）

| 檔案 | 用途 |
|---|---|
| [renderer.js](src/engine/renderer.js) | 渲染器、相機、OrbitControls 與後製，由各場景呼叫 `setupRenderer()` 設定 |
| [context.js](src/engine/context.js) | 共用的 `scene`、時間 uniform、每格更新的登錄表 `onTick()` |
| [batch.js](src/engine/batch.js) | `staticBatch()`：依「材質 × 陰影 × 圖層」合併靜態網格，draw call 從數千降到約一百 |
| [materials.js](src/engine/materials.js) | 三渲二（toon＋描邊）與柔和低多邊形（`soft`）材質，場景用 `setStyle()` 選預設 |
| [geometry.js](src/engine/geometry.js) | 建模小工具：`box`、`cyl` 等以底部高度定位 |
| [canvas.js](src/engine/canvas.js) | Canvas 貼圖與日文字型載入 |
| [lights.js](src/engine/lights.js) | 物理單位的點光源 |
| [noise.js](src/engine/noise.js) | 3D value noise，用在岩石表面、地形起伏和落葉的旋渦氣流 |
| [random.js](src/engine/random.js) | 固定種子的亂數，每次打開的場景都一樣 |

### 場景選單（`src/ui/`）

- [scenes.js](src/ui/scenes.js)：場景目錄，選單卡片與轉場布幕都讀這份清單。
- [menu.js](src/ui/menu.js)：左上角的選單按鈕與場景卡片。
- [veil.js](src/ui/veil.js)：換頁時的圓形轉場布幕。舊頁面蓋上布幕後換頁，新頁面等到場景畫出第一格（`scene:ready`）才收起布幕。

## 技術重點

- **無建置流程**：原生 ES 模組，three.js r160 透過 import map 從 jsDelivr 載入。
- **後製流程**：HalfFloat 緩衝 →（SSAO）→ 清除 NaN → Bloom → 色調映射 →（暗角）→ FXAA。刻意不用 MSAA 緩衝，因為在 Windows 的 D3D11 下，MSAA HalfFloat 加上 Bloom 會讓整個畫面變黑。
- **圖層 1**：透明與自發光的物件放在圖層 1，不進 SSAO 的法線 pass，避免水面、燈火出現錯誤的遮蔽。
- **紅葉屋的地形**：[terrain.js](src/scenes/ryokan/terrain.js) 的 `heightAt(x, z)` 是純函式，建模、擺放物件和落葉模擬都用它查地面高度。主屋、溫泉這類模組先在平地上蓋好，再用 `onLevel()` 整組抬上台地。
- **葉片**：[foliage.js](src/scenes/ryokan/foliage.js) 把數千片葉子的變換直接烘進頂點並合併成一個網格。葉片法線與葉團的球面法線混合，所以受光柔和，輪廓又看得出一片片葉子。
- **風與落葉**：[wind.js](src/scenes/ryokan/wind.js) 用 `onBeforeCompile` 在 shader 裡擺動樹葉與草，每隔 14～22 秒吹來一陣風；[fallingLeaves.js](src/scenes/ryokan/fallingLeaves.js) 在 CPU 上模擬約 440 片落葉，會落地、漂在池面上激起漣漪，或飄出島緣墜入雲海。

## 新增場景

1. 在 `src/scenes/<id>/` 建立場景模組。`main.js` 先呼叫 `setupRenderer()`，搭建完成、畫出第一格後設定 `window.__sceneStarted = true`，並送出 `scene:ready` 事件（可參考現有兩個場景的 `main.js`）。
2. 複製 [ryokan.html](ryokan.html) 成新頁面，修改 `<title>`、`<nav id="scene-menu" data-current="<id>">` 與最後一行的 `main.js` 路徑。
3. 在 [src/ui/scenes.js](src/ui/scenes.js) 加一筆資料：`id`、`href`、`title`、`desc`、`when`、`style`、`thumb`、`accent`（強調色）、`veil`（轉場布幕的外圈與中心色）。
4. 放一張 640 × 400 的縮圖到 `assets/thumbs/`。

貼圖上會畫到的日文字元要加進該場景 `main.js` 的 `GLYPHS`，字型才會預先載入。

## 瀏覽器需求

需要支援 WebGL 的桌面版 Chrome、Edge 或 Firefox。畫面一片黑或出現錯誤訊息時，先確認：

- 是用 `npm start` 開的 `http://localhost`，不是 `file://`。
- 網路能連到 `cdn.jsdelivr.net`。
- 瀏覽器沒有停用硬體加速（WebGL）。

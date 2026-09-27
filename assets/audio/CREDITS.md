# 音檔來源

以下錄音都來自 [Freesound](https://freesound.org)，授權皆為 [CC0 1.0（公眾領域）](https://creativecommons.org/publicdomain/zero/1.0/)，可自由使用、修改，不需要標示作者。這裡仍列出來源，感謝錄音者。

每個檔案都經過剪段、濾波（去掉低頻的風切聲與背景雜音）、響度統一到約 −20 LUFS，再轉成 MP3。播放時由 [src/engine/audio.js](../../src/engine/audio.js) 隨機挑段落交叉淡化，所以聽不出循環點。

| 檔案 | 內容 | 原始錄音 | 錄音者 | 處理 |
|---|---|---|---|---|
| `konbini/rain.mp3` | 整片的雨聲 | [Rain_03](https://freesound.org/people/vincefred/sounds/515839/) | vincefred | 取 0–84 秒，高通 60 Hz |
| `konbini/eaves.mp3` | 雨棚下的滴水與排水溝 | [Rain at night under house archway…](https://freesound.org/people/felix.blume/sounds/709870/) | felix.blume | 取 280–355 秒（避開雷聲），高通 90 Hz |
| `ryokan/leaves.mp3` | 樹葉的沙沙聲 | [Leaves in wind](https://freesound.org/people/Sandermotions/sounds/276294/) | Sandermotions | 取 3–83 秒，高通 110 Hz |
| `ryokan/gust.mp3` | 陣風捲起枯葉 | [Autumn wind and dry leaves](https://freesound.org/people/Stek59/sounds/457318/) | Stek59 | 全段，高通 170 Hz 去掉風切低頻 |
| `ryokan/crickets.mp3` | 秋蟲 | [Crickets At Night - Raw sound](https://freesound.org/people/Defelozedd94/sounds/522299/) | Defelozedd94 | 取 20–70 秒，只留 3–10 kHz 的蟲鳴 |
| `ryokan/waterfall.mp3` | 小瀑布 | [Small Waterfall at the Mill](https://freesound.org/people/willstepp/sounds/188295/) | willstepp | 全段，轉單聲道 |
| `ryokan/trickle.mp3` | 湯口、蹲踞的細流 | [Small Falling Water Onto Stones](https://freesound.org/people/lolamadeus/sounds/179361/) | lolamadeus | 全段，轉單聲道 |

其他聲音（屋簷水滴、自動門與入店鈴、電流聲、店內低鳴、自販機、鹿威し）都是在瀏覽器裡即時合成的。

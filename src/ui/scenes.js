// 場景目錄：選單卡片與轉場布幕都讀這份清單。
// 新增場景時在這裡加一筆，並在新頁面放上 <nav id="scene-menu" data-current="場景 id">。
// 場景說明、時間季節、風格標籤依語系翻譯，放在 src/i18n.js 的字典，key 見 sceneKey。title 是日文原名，三種語系都不翻。
// accent 是選單與布幕上的強調色；veil 是轉場布幕的漸層（外圈、中心）。
// usesWasd：這個場景用 WASD 操作少女，天氣（W）與聲音（S）的快捷鍵就不綁定。
export const SCENES = [
  {
    id: 'konbini',
    href: 'index.html',
    title: '雨夜のことりマート',
    thumb: 'assets/thumbs/konbini.jpg',
    accent: '#5ccbc9',
    veil: ['#070d1c', '#1b2b4c'],
    usesWasd: false,
  },
  {
    id: 'girl',
    href: 'girl.html',
    title: '雨夜のことりマート・傘の少女',
    thumb: 'assets/thumbs/girl.jpg',
    accent: '#8fb8ff',
    veil: ['#070d1c', '#1b2b4c'],
    usesWasd: true,
  },
  {
    id: 'ryokan',
    href: 'ryokan.html',
    title: '秋夜の紅葉屋',
    thumb: 'assets/thumbs/ryokan.jpg',
    accent: '#ffb35c',
    veil: ['#120d22', '#3d2f60'],
    usesWasd: false,
  },
];

/** 這個場景有沒有留 W（切換天氣）與 S（開關聲音）給選單：用 WASD 操作少女的場景沒有 */
export const wasdFree = scene => !scene.usesWasd;

/** 場景的語系文字在字典裡的 key：field 是 desc（說明）、when（時間季節）或 style（風格） */
export const sceneKey = (scene, field) => `scene.${scene.id}.${field}`;

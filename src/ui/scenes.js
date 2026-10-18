// 場景目錄：選單卡片與轉場布幕都讀這份清單。
// 新增場景時在這裡加一筆，並在新頁面放上 <nav id="scene-menu" data-current="場景 id">。
// accent 是選單與布幕上的強調色；veil 是轉場布幕的漸層（外圈、中心）。
// usesWasd：這個場景用 WASD 操作角色，天氣（W）與聲音（S）的快捷鍵就不綁定。
export const SCENES = [
  {
    id: 'konbini',
    href: 'index.html',
    title: '雨夜のことりマート',
    desc: '深夜下著雨，街角的便利商店還亮著燈',
    when: '秋・深夜・雨',
    style: '三渲二',
    thumb: 'assets/thumbs/konbini.jpg',
    accent: '#5ccbc9',
    veil: ['#070d1c', '#1b2b4c'],
    usesWasd: false,
  },
  {
    id: 'girl',
    href: 'girl.html',
    title: '雨夜のことりマート・傘の少女',
    desc: '撐著透明傘的少女，走過下著雨的便利商店街角',
    when: '秋・深夜・雨',
    style: '三渲二・可操作',
    thumb: 'assets/thumbs/konbini.jpg',   // 暫用便利商店的縮圖
    accent: '#8fb8ff',
    veil: ['#070d1c', '#1b2b4c'],
    usesWasd: true,
  },
  {
    id: 'ryokan',
    href: 'ryokan.html',
    title: '秋夜の紅葉屋',
    desc: '浮在晚秋夜空裡、剛點上燈的溫泉旅館',
    when: '晚秋・黃昏',
    style: '柔和低多邊形',
    thumb: 'assets/thumbs/ryokan.jpg',
    accent: '#ffb35c',
    veil: ['#120d22', '#3d2f60'],
    usesWasd: false,
  },
];

/** 這個場景有沒有留 W（切換天氣）與 S（開關聲音）給選單：用 WASD 操作角色的場景沒有 */
export const wasdFree = scene => !scene.usesWasd;

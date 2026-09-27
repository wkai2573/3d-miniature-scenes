// 場景目錄：選單卡片與轉場布幕都讀這份清單。
// 新增場景時在這裡加一筆，並在新頁面放上 <nav id="scene-menu" data-current="場景 id">。
// accent 是選單與布幕上的強調色；veil 是轉場布幕的漸層（外圈、中心）。
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
  },
];

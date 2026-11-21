// 語系核心的契約：語系怎麼判斷、字典是否完整、插值、場景目錄與程式碼用到的 key 是否都有譯文
import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES, sceneKey } from './ui/scenes.js';

const SRC = readFileSync(join(import.meta.dir, 'i18n.js'), 'utf8');
const IDS = ['zh-Hant', 'en', 'ja'];

/** 載入語系核心：用假的 window 與 navigator，模擬各種瀏覽器環境 */
function load({ stored, languages = [], storageBroken = false } = {}) {
  const data = new Map(stored === undefined ? [] : [['scene-lang', stored]]);
  const events = [];
  const win = {
    localStorage: storageBroken
      ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }
      : { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) },
    dispatchEvent: e => { events.push(e); return true; },
  };
  new Function('window', 'navigator', SRC)(win, { languages, language: languages[0] });
  return { i18n: win.__i18n, data, events };
}

describe('語系判斷', () => {
  const { i18n } = load();
  const r = i18n.resolve;

  test('存值是合法語系時以它為準，不管瀏覽器語言', () => {
    expect(r('en', ['ja'])).toBe('en');
    expect(r('ja', ['zh-TW'])).toBe('ja');
    expect(r('zh-Hant', ['en-US'])).toBe('zh-Hant');
  });

  test('沒有存值或存值不合法時看瀏覽器語言', () => {
    expect(r(null, ['ja'])).toBe('ja');
    expect(r(undefined, ['ja-JP'])).toBe('ja');
    expect(r('fr', ['ja'])).toBe('ja');
    for (const code of ['zh-TW', 'zh-CN', 'zh-Hant', 'zh']) expect(r(null, [code]), code).toBe('zh-Hant');
    for (const code of ['en-US', 'fr', 'ko']) expect(r(null, [code]), code).toBe('en');
  });

  test('清單裡有多個語言時，取第一個 ja 或 zh', () => {
    expect(r(null, ['en-US', 'ja', 'zh-TW'])).toBe('ja');
    expect(r(null, ['fr', 'zh-TW', 'ja'])).toBe('zh-Hant');
  });

  test('只比對語言子標籤，jv 之類不會被當成日文', () => {
    expect(r(null, ['jv'])).toBe('en');
    expect(r(null, ['zhx'])).toBe('en');
  });

  test('清單為空時回傳英文', () => {
    expect(r(null, [])).toBe('en');
    expect(r(null, undefined)).toBe('en');
  });
});

describe('載入與切換', () => {
  test('第一次進站依瀏覽器語言決定語系', () => {
    expect(load({ languages: ['ja-JP'] }).i18n.lang).toBe('ja');
    expect(load({ languages: ['zh-TW'] }).i18n.lang).toBe('zh-Hant');
    expect(load({ languages: ['de'] }).i18n.lang).toBe('en');
  });

  test('localStorage 的存值優先於瀏覽器語言', () => {
    expect(load({ stored: 'en', languages: ['ja'] }).i18n.lang).toBe('en');
  });

  test('localStorage 不能用時退回瀏覽器判斷，切換不報錯也不記憶', () => {
    const { i18n, data } = load({ languages: ['ja'], storageBroken: true });
    expect(i18n.lang).toBe('ja');
    expect(() => i18n.set('en')).not.toThrow();
    expect(i18n.lang).toBe('en');
    expect(data.size).toBe(0);
  });

  test('set 寫入 scene-lang 並發出 lang:change', () => {
    const { i18n, data, events } = load({ languages: ['ja'] });
    i18n.set('en');
    expect(i18n.lang).toBe('en');
    expect(data.get('scene-lang')).toBe('en');
    expect(events.map(e => e.type)).toEqual(['lang:change']);
    expect(events[0].detail.lang).toBe('en');
  });

  test('set 帶入不合法的語系時什麼都不做', () => {
    const { i18n, data, events } = load({ languages: ['ja'] });
    i18n.set('fr');
    expect(i18n.lang).toBe('ja');
    expect(data.size).toBe(0);
    expect(events).toHaveLength(0);
  });

  test('LANGS 的按鈕標籤用各語言自己的寫法', () => {
    const { i18n } = load();
    expect(i18n.LANGS.map(l => [l.id, l.label])).toEqual([['zh-Hant', '繁中'], ['en', 'EN'], ['ja', '日本語']]);
  });
});

describe('字典', () => {
  const { i18n } = load();
  const dict = i18n.DICT;

  test('三種語系的 key 集合完全相同', () => {
    const keys = IDS.map(id => Object.keys(dict[id]).sort());
    expect(keys[1]).toEqual(keys[0]);
    expect(keys[2]).toEqual(keys[0]);
    expect(keys[0].length).toBeGreaterThan(0);
  });

  test('每個值都是非空字串', () => {
    for (const id of IDS) {
      for (const [k, v] of Object.entries(dict[id])) {
        expect(typeof v === 'string' && v.trim() !== '', `${id} 的 ${k}`).toBe(true);
      }
    }
  });

  test('同一個 key 在三種語系用相同的插值變數', () => {
    const vars = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const k of Object.keys(dict['zh-Hant'])) {
      expect(vars(dict.en[k]), `en 的 ${k}`).toEqual(vars(dict['zh-Hant'][k]));
      expect(vars(dict.ja[k]), `ja 的 ${k}`).toEqual(vars(dict['zh-Hant'][k]));
    }
  });

  test('t 做具名插值，缺少的變數保留原樣，找不到的 key 回傳 key 本身', () => {
    const { i18n } = load({ stored: 'zh-Hant' });
    expect(i18n.t('menu.count', { n: 3 })).toBe('共 3 座');
    expect(i18n.t('menu.count')).toBe('共 {n} 座');
    expect(i18n.t('no.such.key')).toBe('no.such.key');
    i18n.set('en');
    expect(i18n.t('menu.count', { n: 3 })).toBe('3 scenes');
    i18n.set('ja');
    expect(i18n.t('menu.count', { n: 3 })).toBe('全3シーン');
  });
});

describe('場景目錄與字典對應', () => {
  const { DICT } = load().i18n;

  test('每個場景的說明、時間季節、風格標籤三種語系都有譯文', () => {
    for (const s of SCENES) {
      for (const field of ['desc', 'when', 'style']) {
        for (const id of IDS) expect(DICT[id][sceneKey(s, field)], `${s.id} 的 ${field}（${id}）`).toBeTruthy();
      }
    }
  });

  test('每個場景頁的分頁標題、畫布說明與載入文字三種語系都有譯文', () => {
    for (const s of SCENES) {
      for (const field of ['title', 'canvas', 'loading']) {
        for (const id of IDS) expect(DICT[id][`page.${s.id}.${field}`], `${s.id} 的 ${field}（${id}）`).toBeTruthy();
      }
    }
  });

  test('場景名稱是單一日文字串，不進字典', () => {
    for (const s of SCENES) {
      expect(typeof s.title).toBe('string');
      for (const id of IDS) expect(DICT[id][`scene.${s.id}.title`]).toBeUndefined();
    }
  });

  test('場景名稱在三種語系的分頁標題裡都保留日文原名', () => {
    for (const s of SCENES) {
      for (const id of IDS) expect(DICT[id][`page.${s.id}.title`].startsWith(s.title), `${s.id}（${id}）`).toBe(true);
    }
  });
});

describe('程式碼用到的 key', () => {
  const { DICT } = load().i18n;
  const dirs = ['ui', 'scenes/girl'].map(d => join(import.meta.dir, d));
  const files = [
    join(import.meta.dir, 'boot.js'),
    ...dirs.flatMap(d => readdirSync(d).filter(f => f.endsWith('.js') && !f.endsWith('.test.js')).map(f => join(d, f))),
  ];

  test('t(\'…\')、data-t 屬性與 boot 的 key 字面值，字典裡三種語系都有', () => {
    const used = new Set();
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\bt\('([a-z][\w.]*)'[,)]/g)) used.add(m[1]);
      for (const m of text.matchAll(/data-t(?:-aria|-title)?="([a-z][\w.]*)"/g)) used.add(m[1]);
      for (const m of text.matchAll(/fail\('(boot\.[\w.]+)', true\)/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(10);
    for (const k of used) for (const id of IDS) expect(DICT[id][k], `${k}（${id}）`).toBeTruthy();
  });
});

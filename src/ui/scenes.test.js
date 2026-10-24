// 場景目錄的契約：目錄這份資料、它指向的檔案、部署流程的複製清單，三者要保持一致
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES, wasdFree } from './scenes.js';

const ROOT = join(import.meta.dir, '..', '..');
const deploy = readFileSync(join(ROOT, '.github/workflows/deploy.yml'), 'utf8');

// 部署時複製進網站的項目：「cp -r a b c dist/」這一行裡，目的地之前的每個項目
const copied = (() => {
  const line = deploy.split('\n').find(l => /\bcp\s+-r\b/.test(l));
  if (!line) throw new Error('deploy.yml 找不到 cp -r 複製清單');
  return line.trim().replace(/^.*\bcp\s+-r\s+/, '').split(/\s+/).slice(0, -1);
})();
const isCopied = path => copied.some(c => path === c || path.startsWith(c + '/'));

describe('場景目錄', () => {
  test('共有三個場景，識別不重複', () => {
    expect(SCENES).toHaveLength(3);
    expect(new Set(SCENES.map(s => s.id)).size).toBe(3);
  });

  test('選單順序是便利商店、少女場景、紅葉屋', () => {
    expect(SCENES.map(s => s.id)).toEqual(['konbini', 'girl', 'ryokan']);
  });

  test('每個場景的頁面檔與縮圖檔都存在', () => {
    for (const s of SCENES) {
      expect(existsSync(join(ROOT, s.href)), `${s.id} 的頁面 ${s.href}`).toBe(true);
      expect(existsSync(join(ROOT, s.thumb)), `${s.id} 的縮圖 ${s.thumb}`).toBe(true);
    }
  });

  test('部署流程的複製清單涵蓋每個場景的頁面與縮圖', () => {
    for (const s of SCENES) {
      expect(isCopied(s.href), `${s.id} 的頁面 ${s.href}`).toBe(true);
      expect(isCopied(s.thumb), `${s.id} 的縮圖 ${s.thumb}`).toBe(true);
    }
    expect(isCopied('src/scenes/girl/main.js')).toBe(true);
    expect(isCopied('css/style.css')).toBe(true);
    expect(isCopied('assets/characters/three-vrm-girl.vrm')).toBe(true);
  });

  test('只有少女場景宣告佔用 WASD', () => {
    expect(SCENES.filter(s => s.usesWasd).map(s => s.id)).toEqual(['girl']);
    for (const s of SCENES) expect(typeof s.usesWasd).toBe('boolean');
  });

  test('W 與 S 只留給不佔用 WASD 的場景', () => {
    expect(SCENES.filter(wasdFree).map(s => s.id)).toEqual(['konbini', 'ryokan']);
  });

  test('每個頁面都標明自己是哪個場景，並載入對應的場景入口', () => {
    for (const s of SCENES) {
      const html = readFileSync(join(ROOT, s.href), 'utf8');
      expect(html).toContain(`data-current="${s.id}"`);
      expect(html).toContain(`src/scenes/${s.id}/main.js`);
    }
  });
});

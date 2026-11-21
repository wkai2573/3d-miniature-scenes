// 模組取介面文字的入口。語系核心是一般腳本（src/i18n.js），掛在 window.__i18n 上。
export const t = (key, vars) => window.__i18n.t(key, vars);

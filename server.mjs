// 零相依的本機靜態伺服器（Bun）：ES 模組不能從 file:// 載入，所以需要用 http 開啟。
// 用法：bun server.mjs（或 bun start），然後開啟 http://localhost:5173
// Content-Type 由 Bun.file() 依副檔名自動判斷
import path from 'node:path';

const ROOT = import.meta.dir;
const PORT = Number(Bun.env.PORT) || 5173;

Bun.serve({
  port: PORT,
  async fetch(req) {
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url).pathname); } catch { return new Response(null, { status: 400 }); }
    let file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT)) return new Response(null, { status: 403 });
    if (urlPath.endsWith('/')) file = path.join(file, 'index.html');
    const f = Bun.file(file);
    if (!(await f.exists())) return new Response('404', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return new Response(f, { headers: { 'Cache-Control': 'no-store' } });
  },
});

console.log(`3D 微縮場景 → http://localhost:${PORT}（紅葉屋：/ryokan.html）`);

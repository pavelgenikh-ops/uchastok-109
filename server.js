// Статический сервер приложения. Запуск: node.exe server.js
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const PORT = process.env.PORT || 8140;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.tsv': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm', '.bin': 'application/octet-stream',
};

// ---------------------------------------------------------------------------
//  Версия сборки = максимальное время изменения исходников.
//  Подставляется ко всем относительным импортам, чтобы браузер гарантированно
//  брал свежие модули: без этого Chrome держит ES-модули в кеше и показывает
//  старую версию проекта.
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', 'экспорт', 'models', 'lib', 'utils', 'data']);

function buildVersion() {
  let mx = 0;
  const scan = (dir) => {
    let items;
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const f of items) {
      if (SKIP_DIRS.has(f.name)) continue;
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { scan(full); continue; }
      if (!/\.(js|html|css)$/i.test(f.name)) continue;
      try {
        const t = fs.statSync(full).mtimeMs;
        if (t > mx) mx = t;
      } catch (e) { /* файл мог исчезнуть между вызовами */ }
    }
  };
  scan(ROOT);
  return Math.round(mx).toString(36);
}

const RE_FROM = /(from\s+['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g;
const RE_IMPORT = /(import\(\s*['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g;
const RE_SRC = /(src=")(\.{0,2}\/[^"?]+\.js)(")/g;
const RE_MAP = /("three"\s*:\s*")([^"?]+\.js)(")/g;

function stampVersion(text, ver) {
  const tag = (m, a, b, c) => `${a}${b}?v=${ver}${c}`;
  return text
    .replace(RE_FROM, tag)
    .replace(RE_IMPORT, tag)
    .replace(RE_SRC, tag)
    .replace(RE_MAP, tag);
}

function handler(req, res) {
  let p = decodeURIComponent(url.parse(req.url).pathname);

  // сохранение выгрузки (PDF) прямо в папку проекта: POST /_save?name=...
  if (req.method === 'POST' && p === '/_save') {
    const name = (url.parse(req.url, true).query.name || 'export.pdf')
      .replace(/[\\/:*?"<>|]/g, '_');
    const dir = path.join(ROOT, 'экспорт');
    fs.mkdirSync(dir, { recursive: true });
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const file = path.join(dir, name);
      fs.writeFileSync(file, Buffer.concat(chunks));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, file }));
      console.log('сохранено:', file);
    });
    return;
  }

  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + p);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    // версионируем только собственный код; библиотеки в lib/ не трогаем
    if ((ext === '.js' || ext === '.html') && !p.startsWith('/lib/') && !p.startsWith('/utils/')) {
      const ver = buildVersion();
      headers['X-Build'] = ver;
      res.writeHead(200, headers);
      res.end(stampVersion(data.toString('utf8'), ver));
      return;
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
//  Запуск с автоподбором порта: на чужом компьютере 8140 может быть занят,
//  и тогда сервер просто падал, а окно браузера открывалось в пустоту.
//  Фактический порт пишем в файл .port — его читает START.bat.
// ---------------------------------------------------------------------------

const server = http.createServer(handler);

function start(port, tries) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries > 0) {
      console.log('порт ' + port + ' занят, пробую ' + (port + 1));
      setTimeout(() => start(port + 1, tries - 1), 80);
    } else {
      console.error('не удалось занять порт:', e.message);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    try { fs.writeFileSync(path.join(ROOT, '.port'), String(port)); } catch (e) { /* не критично */ }
    console.log('Ландшафт 3D → http://localhost:' + port + '  (сборка ' + buildVersion() + ')');
  });
}
start(Number(PORT) || 8140, 20);

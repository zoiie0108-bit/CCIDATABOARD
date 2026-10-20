'use strict';

/* ============================================================
   预览服务：只做静态文件分发，便于同一局域网内手机 / 平板访问
   用法：node server/serve.js  [port]
   ============================================================ */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'dist');
const PORT = Number(process.argv[2] || process.env.PORT) || 8787;
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8'
};

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';

  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
});

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('未找到 dist/index.html，请先运行：node server/build.js');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('文化产业观察站 · 预览服务');
  console.log(`  本机：http://127.0.0.1:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`  局域网：http://${ip}:${PORT}   ← 手机/平板连同一 Wi-Fi 可直接打开`);
  }
  console.log('');
  console.log('  按 Ctrl+C 停止');
  console.log('');
});

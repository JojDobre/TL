'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

/** Statický server pre testovacie stránky na náhodnom porte (len 127.0.0.1). */
function startFixtureServer() {
  const dir = path.join(__dirname, 'fixtures');
  const server = http.createServer((req, res) => {
    const name = path.basename(new URL(req.url, 'http://x').pathname) || 'good.html';
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>404</title>'); }
    res.writeHead(name === 'challenge.html' ? 403 : 200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    url: (p) => `http://127.0.0.1:${server.address().port}/${p}`,
    close: () => new Promise((r) => server.close(r)),
  })));
}

module.exports = { startFixtureServer };

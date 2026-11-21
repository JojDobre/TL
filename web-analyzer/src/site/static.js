'use strict';

/*
 * Statické súbory: predkomprimované (brotli + gzip) v pamäti, ETag,
 * dlhodobá cache pre súbory s ?v=hash (asset fingerprinting).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;
const DEV = process.env.NODE_ENV === 'development';

const cache = new Map();

function compress(buf, type) {
  if (!COMPRESSIBLE.test(type) || buf.length < 600) return {};
  return {
    br: zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }),
    gzip: zlib.gzipSync(buf, { level: 9 }),
  };
}

function loadFile(rel) {
  if (!DEV && cache.has(rel)) return cache.get(rel);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return null;
  let buf;
  try { buf = fs.readFileSync(file); } catch { return null; }
  if (fs.statSync(file).isDirectory()) return null;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  const entry = { buf, type, hash, etag: `"${hash}"`, ...compress(buf, type) };
  cache.set(rel, entry);
  return entry;
}

/** URL s otlačkom obsahu (mení sa pri zmene súboru → prehliadač si stiahne novú verziu). */
function assetUrl(rel) {
  const e = loadFile(rel);
  return e ? `${rel}?v=${e.hash}` : rel;
}

function pickEncoding(req, entry) {
  const ae = String(req.headers['accept-encoding'] || '');
  if (entry.br && /\bbr\b/.test(ae)) return ['br', entry.br];
  if (entry.gzip && /\bgzip\b/.test(ae)) return ['gzip', entry.gzip];
  return [null, entry.buf];
}

/** Odošle obsah (statický súbor alebo vyrenderovanú stránku) s kompresiou a ETagom. */
function send(req, res, entry, { status = 200, headers = {}, immutable = false } = {}) {
  const base = {
    'Content-Type': entry.type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : (headers['Cache-Control'] || 'no-cache'),
    ETag: entry.etag,
    Vary: 'Accept-Encoding',
    ...headers,
  };
  if (immutable) base['Cache-Control'] = 'public, max-age=31536000, immutable';
  if (status === 200 && req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304, { ETag: entry.etag, 'Cache-Control': base['Cache-Control'], Vary: 'Accept-Encoding' });
    return res.end();
  }
  const [enc, body] = pickEncoding(req, entry);
  if (enc) base['Content-Encoding'] = enc;
  base['Content-Length'] = body.length;
  res.writeHead(status, base);
  res.end(req.method === 'HEAD' ? undefined : body);
}

/** Vytvorí položku pre dynamicky vyrenderovaný obsah (HTML, sitemap…). */
function entryFrom(content, type) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
  return { buf, type, hash, etag: `"${hash}"`, ...compress(buf, type) };
}

function serveStatic(req, res, url, headers) {
  const entry = loadFile(decodeURIComponent(url.pathname));
  if (!entry) return false;
  const immutable = url.searchParams.has('v') || url.pathname.startsWith('/fonts/');
  send(req, res, entry, { headers, immutable });
  return true;
}

module.exports = { serveStatic, send, entryFrom, assetUrl, MIME };

'use strict';

/* Jednoduché súborové úložisko (JSON) – pre malý projekt netreba databázu. */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'));
const DIRS = { previews: 'previews', orders: 'orders', audits: 'audits', reports: 'reports', subscriptions: 'subscriptions', outbox: 'outbox' };
for (const d of Object.values(DIRS)) fs.mkdirSync(path.join(DATA_DIR, d), { recursive: true });

const ID_RE = /^[a-f0-9-]{36}$/;

function file(dir, id, ext = 'json') {
  if (!ID_RE.test(String(id))) throw new Error('bad id');
  return path.join(DATA_DIR, DIRS[dir], `${id}.${ext}`);
}

async function load(dir, id) {
  if (!ID_RE.test(String(id))) return null;
  try { return JSON.parse(await fsp.readFile(file(dir, id), 'utf8')); } catch { return null; }
}

async function save(dir, obj) {
  const f = file(dir, obj.id);
  await fsp.writeFile(f + '.tmp', JSON.stringify(obj));
  await fsp.rename(f + '.tmp', f);
}

async function remove(dir, id, ext = 'json') {
  await fsp.unlink(file(dir, id, ext)).catch(() => {});
}

/** Načíta všetky záznamy adresára (pre admin prehľad a plánovač; pri malom objeme v poriadku). */
async function list(dir) {
  const names = await fsp.readdir(path.join(DATA_DIR, DIRS[dir])).catch(() => []);
  const out = [];
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    const o = await load(dir, n.slice(0, -5));
    if (o) out.push(o);
  }
  return out;
}

/** Chyba pre klienta: new PublicError('slovensky', 'english', 404) alebo new PublicError('text', 404). */
class PublicError extends Error {
  constructor(sk, en, status) {
    super(sk);
    if (typeof en === 'number') { status = en; en = null; }
    this.en = en || sk;
    this.status = status || 400;
  }
  text(lang) { return lang === 'en' ? this.en : this.message; }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const newId = () => crypto.randomUUID();
const newToken = () => crypto.randomBytes(24).toString('hex');

module.exports = { DATA_DIR, DIRS, ID_RE, file, load, save, remove, list, PublicError, safeEqual, newId, newToken };

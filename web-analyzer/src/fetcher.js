'use strict';

const dns = require('dns').promises;
const net = require('net');
const tls = require('tls');

const UA = 'Mozilla/5.0 (compatible; WebAnalyzer/1.0)';
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB HTML limit
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 6;

/* ---------- SSRF ochrana: nepustíme požiadavky na interné adresy ---------- */

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) ||           // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224                              // multicast + reserved
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true;
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new UserError('Lokálne a interné adresy nie je možné analyzovať.');
  }
  let addrs;
  if (net.isIP(host)) addrs = [{ address: host }];
  else {
    try {
      addrs = await dns.lookup(host, { all: true });
    } catch {
      throw new UserError(`Doménu „${host}“ sa nepodarilo nájsť (DNS).`);
    }
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new UserError('Lokálne a interné adresy nie je možné analyzovať.');
  }
  return addrs.map((a) => a.address);
}

class UserError extends Error {}

/* ---------- normalizácia vstupu ---------- */

function normalizeUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new UserError('Zadaj adresu webu.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let u;
  try { u = new URL(raw); } catch { throw new UserError('Neplatná adresa URL.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new UserError('Podporované sú len http a https adresy.');
  if (u.username || u.password) throw new UserError('URL nesmie obsahovať prihlasovacie údaje.');
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) throw new UserError('Nepodporovaný port.');
  if (!u.hostname.includes('.') && !net.isIP(u.hostname)) throw new UserError('Neplatná doména.');
  u.hash = '';
  return u;
}

/* ---------- HTTP požiadavka s manuálnym sledovaním presmerovaní ---------- */

async function readLimited(res, limit = MAX_BYTES) {
  if (!res.body) return { buf: Buffer.alloc(0), truncated: false };
  const chunks = [];
  let size = 0;
  let truncated = false;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > limit) { truncated = true; break; }
    chunks.push(chunk);
  }
  return { buf: Buffer.concat(chunks), truncated };
}

async function request(url, { method = 'GET', readBody = true, maxRedirects = MAX_REDIRECTS, limit } = {}) {
  const chain = [];
  let current = new URL(url);
  const started = performance.now();
  for (let i = 0; i <= maxRedirects; i++) {
    const ips = await assertPublicHost(current.hostname);
    const t0 = performance.now();
    const res = await fetch(current, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'sk,en;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
      },
    });
    const ttfb = performance.now() - t0;
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      chain.push({ url: current.href, status: res.status });
      res.body?.cancel().catch(() => {});
      current = new URL(loc, current);
      if (!['http:', 'https:'].includes(current.protocol)) throw new UserError('Presmerovanie na nepodporovaný protokol.');
      continue;
    }
    let body = Buffer.alloc(0);
    let truncated = false;
    if (readBody && method !== 'HEAD') ({ buf: body, truncated } = await readLimited(res, limit));
    else res.body?.cancel().catch(() => {});
    return {
      url: current.href,
      status: res.status,
      headers: res.headers,
      setCookies: typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [],
      body,
      truncated,
      ttfb,
      total: performance.now() - started,
      chain,
      ip: ips[0],
    };
  }
  throw new UserError('Príliš veľa presmerovaní.');
}

/** Bezpečný pokus – pri chybe vráti null namiesto výnimky. */
async function tryRequest(url, opts) {
  try { return await request(url, opts); } catch { return null; }
}

/* ---------- SSL/TLS certifikát ---------- */

function getCertificate(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, timeout: 6000, rejectUnauthorized: false });
    const done = (val) => { socket.destroy(); resolve(val); };
    socket.once('secureConnect', () => {
      const c = socket.getPeerCertificate();
      if (!c || !c.valid_to) return done(null);
      done({
        subject: c.subject?.CN || '',
        issuer: c.issuer?.O || c.issuer?.CN || '',
        validFrom: new Date(c.valid_from).toISOString(),
        validTo: new Date(c.valid_to).toISOString(),
        daysLeft: Math.floor((new Date(c.valid_to) - Date.now()) / 86400000),
        authorized: socket.authorized,
        authError: socket.authorizationError ? String(socket.authorizationError) : null,
        protocol: socket.getProtocol(),
        altNames: (c.subjectaltname || '').split(',').map((s) => s.trim().replace(/^DNS:/, '')).filter(Boolean).slice(0, 12),
      });
    });
    socket.once('timeout', () => done(null));
    socket.once('error', () => done(null));
  });
}

module.exports = { request, tryRequest, normalizeUrl, getCertificate, UserError, assertPublicHost };

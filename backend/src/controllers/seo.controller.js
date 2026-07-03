// backend/src/controllers/seo.controller.js
//
// SEO endpointy: sitemap.xml (dynamická) a ads.txt (Google AdSense).
//
// SITEMAP obsahuje:
//   - statické verejné stránky,
//   - verejné sezóny (bez hesla) → /seasons/:id,
//   - publikované blogové články → /blog/:slug.
// Je odolná: ak DB nie je dostupná, vráti aspoň statické stránky (žiadny 500).
//
// ADS.TXT: AdSense vyžaduje súbor /ads.txt s publisher ID. Generujeme ho z env
// ADSENSE_CLIENT_ID (tvar ca-pub-XXXXXXXXXXXXXXXX). Ak nie je nastavený → 404.

const { Season, Article } = require('../models');

// Základná URL webu — v produkcii nastav APP_URL=https://tifo.sk
const BASE = () => (process.env.APP_URL || 'https://tifo.sk').replace(/\/$/, '');

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/seasons', priority: '0.9', changefreq: 'daily' },
  { path: '/leaderboards', priority: '0.9', changefreq: 'daily' },
  { path: '/discover', priority: '0.8', changefreq: 'daily' },
  { path: '/blog', priority: '0.7', changefreq: 'weekly' },
  { path: '/navody', priority: '0.6', changefreq: 'monthly' },
  { path: '/about', priority: '0.5', changefreq: 'monthly' },
  { path: '/kontakt', priority: '0.4', changefreq: 'yearly' },
  { path: '/register', priority: '0.6', changefreq: 'yearly' },
  { path: '/login', priority: '0.3', changefreq: 'yearly' },
  { path: '/podmienky', priority: '0.2', changefreq: 'yearly' },
  { path: '/sukromie', priority: '0.2', changefreq: 'yearly' },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function urlEntry(loc, { lastmod, changefreq, priority } = {}) {
  return '  <url>\n'
    + `    <loc>${esc(loc)}</loc>\n`
    + (lastmod ? `    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>\n` : '')
    + (changefreq ? `    <changefreq>${changefreq}</changefreq>\n` : '')
    + (priority ? `    <priority>${priority}</priority>\n` : '')
    + '  </url>\n';
}

// GET /sitemap.xml
const sitemapXml = async (req, res) => {
  const base = BASE();
  let body = '';

  for (const p of STATIC_PAGES) {
    body += urlEntry(base + p.path, { changefreq: p.changefreq, priority: p.priority });
  }

  // dynamický obsah — pri chybe DB pokračujeme len so statickými stránkami
  try {
    const seasons = await Season.findAll({
      where: { password: null },
      attributes: ['id', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 500,
    });
    for (const s of seasons) {
      body += urlEntry(`${base}/seasons/${s.id}`, { lastmod: s.updatedAt, changefreq: 'daily', priority: '0.7' });
    }
  } catch (e) { /* DB nedostupná — sitemapa ostáva statická */ }

  try {
    const articles = await Article.findAll({
      where: { published: true },
      attributes: ['slug', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 500,
    });
    for (const a of articles) {
      if (!a.slug) continue;
      body += urlEntry(`${base}/blog/${a.slug}`, { lastmod: a.updatedAt, changefreq: 'monthly', priority: '0.6' });
    }
  } catch (e) { /* bez článkov */ }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + body
    + '</urlset>\n';

  res.set('Content-Type', 'application/xml; charset=utf-8');
  // sitemapa sa mení pomaly — nech ju CDN/crawler pokojne kešuje hodinu
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
};

// GET /ads.txt — povinný pre Google AdSense (overenie vlastníctva inventára).
// Formát: google.com, pub-XXXX, DIRECT, f08c47fec0942fa0
const adsTxt = (req, res) => {
  const client = (process.env.ADSENSE_CLIENT_ID || '').trim(); // napr. ca-pub-1234567890123456
  if (!client) return res.status(404).type('text/plain').send('Not configured');
  const pub = client.replace(/^ca-/, ''); // ads.txt používa "pub-...", meta tag "ca-pub-..."
  res.type('text/plain').send(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
};

module.exports = { sitemapXml, adsTxt };

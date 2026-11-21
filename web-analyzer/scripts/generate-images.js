'use strict';

/*
 * Vygeneruje obrázky pre sociálne siete (Open Graph 1200×630) a ikony aplikácie.
 * Spustenie: npm run images   (po zmene SITE_NAME alebo dizajnu)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'public', 'img');
const SITE = process.env.SITE_NAME || 'Web Analyzer';
const font = (f) => `data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'fonts', f)).toString('base64')}`;
const FONT_CSS = `
@font-face { font-family: I; font-weight: 100 900; src: url(${font('inter-latin-wght-normal.woff2')}) format('woff2'); unicode-range: U+0000-00FF, U+2000-206F, U+20AC; }
@font-face { font-family: I; font-weight: 100 900; src: url(${font('inter-latin-ext-wght-normal.woff2')}) format('woff2'); unicode-range: U+0100-02FF; }`;
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M8 11h6M11 8v6"/></svg>';

const OG = {
  'og-home-sk': { kicker: 'Analýza webu zadarmo', title: 'SEO, bezpečnosť<br>a rýchlosť webu', sub: 'Skóre a konkrétne odporúčania za pár sekúnd', chips: ['Bezpečnosť', 'SEO', 'Výkon', 'Prístupnosť'], score: 92 },
  'og-home-en': { kicker: 'Free website analyzer', title: 'SEO, security<br>& speed check', sub: 'A score and concrete fixes in seconds', chips: ['Security', 'SEO', 'Performance', 'Accessibility'], score: 92 },
  'og-audit-sk': { kicker: 'Európsky akt o prístupnosti', title: 'Audit prístupnosti<br>podľa EAA a WCAG', sub: 'Test zadarmo · PDF správa s návodom na opravu', chips: ['WCAG 2.1 AA', 'EN 301 549', 'Klávesnica', 'Mobil'], score: 48, accent: true },
  'og-audit-en': { kicker: 'European Accessibility Act', title: 'Accessibility audit<br>for EAA & WCAG', sub: 'Free scan · PDF report with fixes', chips: ['WCAG 2.1 AA', 'EN 301 549', 'Keyboard', 'Mobile'], score: 48, accent: true },
};

function ogHtml(o) {
  const c = o.score >= 90 ? '#12b76a' : o.score >= 65 ? '#f5b301' : '#ef4444';
  const r = 92, circ = 2 * Math.PI * r;
  return `<!doctype html><html><head><style>${FONT_CSS}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: I, sans-serif; color: #eef0f6; background: #0a0c11; overflow: hidden; position: relative; }
  .glow { position: absolute; inset: 0; background: radial-gradient(600px 380px at 15% 10%, rgba(109,93,252,.45), transparent 70%), radial-gradient(520px 360px at 90% 90%, ${o.accent ? 'rgba(16,185,129,.35)' : 'rgba(46,197,255,.30)'}, transparent 70%); }
  .wrap { position: relative; padding: 64px 72px; height: 100%; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 750; }
  .mark { width: 52px; height: 52px; border-radius: 15px; background: linear-gradient(135deg,#6d5dfc,#2ec5ff); display: grid; place-items: center; }
  .mark svg { width: 30px; height: 30px; }
  .main { display: flex; justify-content: space-between; align-items: center; flex: 1; }
  .kicker { display: inline-block; font-size: 24px; font-weight: 600; color: #b7bcff; padding: 8px 18px; border: 1px solid rgba(255,255,255,.18); border-radius: 99px; margin-bottom: 22px; }
  h1 { font-size: 72px; line-height: 1.04; font-weight: 800; letter-spacing: -0.035em; }
  .sub { font-size: 28px; color: #9aa1b4; margin-top: 20px; }
  .chips { display: flex; gap: 12px; margin-top: 30px; }
  .chip { font-size: 21px; font-weight: 600; padding: 8px 16px; border-radius: 12px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); }
  .card { width: 290px; height: 290px; border-radius: 40px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); display: grid; place-items: center; position: relative; }
  .num { position: absolute; font-size: 84px; font-weight: 800; letter-spacing: -0.04em; }
  </style></head><body><div class="glow"></div><div class="wrap">
    <div class="brand"><span class="mark">${LOGO}</span>${SITE}</div>
    <div class="main">
      <div><span class="kicker">${o.kicker}</span><h1>${o.title}</h1><p class="sub">${o.sub}</p>
        <div class="chips">${o.chips.map((x) => `<span class="chip">${x}</span>`).join('')}</div></div>
      <div class="card"><svg width="230" height="230" viewBox="0 0 230 230"><circle cx="115" cy="115" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="20"/>
        <circle cx="115" cy="115" r="${r}" fill="none" stroke="${c}" stroke-width="20" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - o.score / 100)}" transform="rotate(-90 115 115)"/></svg>
        <span class="num">${o.score}</span></div>
    </div>
  </div></body></html>`;
}

const iconHtml = (size, pad) => `<!doctype html><html><head><style>* { margin: 0 } body { width: ${size}px; height: ${size}px; background: ${pad ? '#6d5dfc' : 'transparent'}; display: grid; place-items: center; }
  .m { width: ${pad ? size * 0.62 : size}px; height: ${pad ? size * 0.62 : size}px; border-radius: ${pad ? 0 : size * 0.22}px; background: linear-gradient(135deg,#6d5dfc,#2ec5ff); display: grid; place-items: center; }
  .m svg { width: 58%; height: 58%; }</style></head><body><div class="m">${LOGO}</div></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  for (const [name, o] of Object.entries(OG)) {
    await p.setContent(ogHtml(o));
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 86 });
    console.log('✓', name);
  }
  for (const [name, size, pad] of [['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true], ['apple-touch-icon', 180, true]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(iconHtml(size, pad));
    await p.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: !pad });
    console.log('✓', name);
  }
  await b.close();
})();

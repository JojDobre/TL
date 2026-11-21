// Vygeneruje ikony (PNG) a náhľadové obrázky pre sociálne siete (1200×630) pre každú stránku.
// Spustenie: node tools/generate-images.js  (potrebuje Playwright; spúšťa sa len pri zmene názvov)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const cfg = require('./site.config.js');

const root = path.join(__dirname, '..');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.mkdirSync(path.join(root, 'assets/og'), { recursive: true });
fs.mkdirSync(path.join(root, 'assets/icons'), { recursive: true });

const ikona = (velkost, okraj) => `<!doctype html><html><body style="margin:0">
<div style="width:${velkost}px;height:${velkost}px;background:#0b6bcb;border-radius:${okraj ? Math.round(velkost * 0.22) : 0}px;
display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${Math.round(velkost * 0.62)}px Arial,Helvetica,sans-serif">€</div>
</body></html>`;

const og = s => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;width:1200px;height:630px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;
background:linear-gradient(135deg,#0b6bcb 0%,#0a4f96 100%);color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:70px 80px;box-sizing:border-box}
.brand{display:flex;align-items:center;gap:18px;font-size:38px;font-weight:800}
.brand i{width:64px;height:64px;border-radius:14px;background:#fff;color:#0b6bcb;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:42px}
h1{font-size:${(s.obrazok || s.title).length > 28 ? 72 : 86}px;line-height:1.08;margin:0 0 18px;letter-spacing:-1px}
p{font-size:38px;margin:0;opacity:.9}
.foot{font-size:28px;opacity:.85}
</style></head><body>
<div class="brand"><i>€</i>SpočítajSi</div>
<div><h1>${esc(s.obrazok || s.title)}</h1><p>${esc(s.podtitul || 'Bezplatné slovenské kalkulačky')}</p></div>
<div class="foot">Aktuálne sadzby 2026 a 2027 · výpočet zadarmo</div>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [subor, v, okraj] of [['icon-48.png', 48, true], ['icon-192.png', 192, false], ['icon-512.png', 512, false], ['apple-touch-icon.png', 180, false]]) {
    await p.setViewportSize({ width: v, height: v });
    await p.setContent(ikona(v, okraj));
    await p.screenshot({ path: path.join(root, 'assets/icons', subor), omitBackground: true });
  }
  await p.setViewportSize({ width: 1200, height: 630 });
  let n = 0;
  for (const s of cfg.stranky.filter(x => !x.noindex)) {
    const data = s.slug ? s : { ...s, obrazok: 'Slovenské kalkulačky 2026 a 2027', podtitul: 'Mzda, dane, odvody, dávky, hypotéka' };
    await p.setContent(og(data));
    await p.screenshot({ path: path.join(root, 'assets/og', (s.slug || 'domov') + '.jpg'), type: 'jpeg', quality: 86 });
    n++;
  }
  await b.close();
  console.log(`✓ 4 ikony a ${n} náhľadových obrázkov`);
})();

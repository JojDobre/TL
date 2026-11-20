// Vloží jednotnú hlavičku a pätičku do všetkých stránok a obnoví sitemap.xml.
// Spustenie: node tools/build-layout.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const DOMENA = 'https://www.VASA-DOMENA.sk';

// Poradie = poradie v pätičke a na úvodnej stránke
const stranky = [
  { file: 'cista-mzda.html', nazov: 'Čistá mzda' },
  { file: 'hypoteka.html', nazov: 'Hypotéka' },
  { file: 'pn.html', nazov: 'PN (nemocenská)' },
  { file: 'materska.html', nazov: 'Materská a rodičovský' },
  { file: 'odvody-szco.html', nazov: 'Odvody SZČO' },
  { file: 'dph.html', nazov: 'DPH' },
  { file: 'priplatky.html', nazov: 'Príplatky a min. mzda' },
  { file: 'cestovne-nahrady.html', nazov: 'Cestovné náhrady' },
  { file: 'sporenie.html', nazov: 'Sporenie a úroky' },
  { file: 'e-faktura-2027.html', nazov: 'E-faktúra 2027' }
];
const vHlavicke = ['cista-mzda.html', 'hypoteka.html', 'pn.html', 'materska.html'];

function header(aktivna) {
  const odkazy = vHlavicke.map(f => {
    const s = stranky.find(x => x.file === f);
    return `    <a href="${f}"${f === aktivna ? ' aria-current="page"' : ''}>${s.nazov.replace(/ \(.*\)| a .*/, '')}</a>`;
  }).join('\n');
  return `<header class="site"><div class="wrap">
  <a class="logo" href="./">Spočítaj<span>Si</span></a>
  <nav class="main">
${odkazy}
    <a href="./#vsetky"${aktivna === 'index.html' ? ' aria-current="page"' : ''}>Všetky kalkulačky</a>
  </nav>
</div></header>`;
}

function footer() {
  const odkazy = stranky.map(s => `    <a href="${s.file}">${s.nazov}</a>`).join('\n');
  return `<footer class="site"><div class="wrap">
  <div class="links">
${odkazy}
    <a href="ochrana-sukromia.html">Ochrana súkromia</a>
  </div>
  <p>© 2026 SpočítajSi. Výpočty sú orientačné a nenahrádzajú odborné daňové ani právne poradenstvo.</p>
</div></footer>`;
}

const subory = fs.readdirSync(root).filter(f => f.endsWith('.html'));
for (const f of subory) {
  const p = path.join(root, f);
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace(/<header class="site">[\s\S]*?<\/header>/, header(f));
  html = html.replace(/<footer class="site">[\s\S]*?<\/footer>/, footer());
  fs.writeFileSync(p, html);
}

const dnes = new Date().toISOString().slice(0, 10);
const urls = ['', ...stranky.map(s => s.file)]
  .map(f => `  <url><loc>${DOMENA}/${f}</loc><lastmod>${dnes}</lastmod></url>`).join('\n');
fs.writeFileSync(path.join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

console.log(`Hlavička a pätička aktualizované v ${subory.length} súboroch, sitemap má ${stranky.length + 1} adries.`);

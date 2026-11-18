// backend/scripts/check.js — rýchla kontrola pred nasadením (spúšťa ju CI).
//   • syntax všetkých JS súborov (node --check)
//   • skompilovanie všetkých EJS šablón (preklep v šablóne by inak zhodil
//     stránku až v produkcii)
//   • načítanie controllerov a rout (chýbajúci require / preklep v názve)
// Nepotrebuje bežiacu databázu. Spustenie: npm run check
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ejs = require('ejs');

const root = path.join(__dirname, '..');
let failed = 0;

function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'node_modules') walk(p, ext, out); } else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

const jsFiles = [
  path.join(root, 'index.js'),
  ...walk(path.join(root, 'src'), '.js'),
  ...walk(path.join(root, 'public', 'js'), '.js'),
  ...walk(path.join(root, 'scripts'), '.js'),
];
for (const f of jsFiles) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) {
    failed++; console.error(`✗ syntax: ${path.relative(root, f)}\n${e.stderr}`);
  }
}

const views = walk(path.join(root, 'views'), '.ejs');
for (const f of views) {
  try { ejs.compile(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) {
    failed++; console.error(`✗ šablóna: ${path.relative(root, f)}: ${e.message.split('\n')[0]}`);
  }
}

// controllery a routy len načítame (Sequelize sa k DB pripája až pri dotaze)
const mods = [...walk(path.join(root, 'src', 'controllers'), '.js'), ...walk(path.join(root, 'src', 'routes'), '.js')];
for (const f of mods) {
  try { require(f); } catch (e) {
    failed++; console.error(`✗ require: ${path.relative(root, f)}: ${e.message}`);
  }
}

console.log(failed
  ? `\n${failed} chýb (JS: ${jsFiles.length}, šablón: ${views.length}, modulov: ${mods.length})`
  : `OK — JS súborov: ${jsFiles.length}, šablón: ${views.length}, modulov: ${mods.length}`);
process.exit(failed ? 1 : 0);

// backend/src/utils/asset-version.js
//
// Verzia statických assetov pre cache-busting (?v=…).
// Poradie: ASSET_VERSION z .env → krátky hash aktuálneho git commitu
// (nasadenie cez git pull ho zmení) → čas štartu procesu.
const { execSync } = require('child_process');
const path = require('path');

function resolve() {
  if (process.env.ASSET_VERSION) return String(process.env.ASSET_VERSION);
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: path.join(__dirname, '..', '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch (e) {
    return Date.now().toString(36);
  }
}

module.exports = resolve();

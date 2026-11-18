// deploy/ecosystem.config.js — konfigurácia pm2 pre produkciu.
//
// Prvé spustenie na serveri (z koreňa repozitára):
//   pm2 start deploy/ecosystem.config.js && pm2 save
// Ďalšie nasadenia robí deploy/deploy.sh (spúšťa ho GitHub Actions).
//
// Premenné prostredia aplikácie sa čítajú z backend/.env (dotenv).
const path = require('path');

module.exports = {
  apps: [{
    name: process.env.PM2_APP || 'tiperliga',
    cwd: path.join(__dirname, '..', 'backend'),
    script: 'index.js',
    instances: 1,                 // plánovač a automatické výsledky bežia v procese → 1 inštancia
    exec_mode: 'fork',
    max_memory_restart: '600M',
    kill_timeout: 8000,
    restart_delay: 3000,
    time: true,                   // časové značky v `pm2 logs`
    merge_logs: true,
  }],
};

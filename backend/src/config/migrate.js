// backend/src/config/migrate.js
//
// Jednoduchý a bezpečný runner databázových migrácií.
//
// PREČO: `DB_SYNC=alter` vie pridať stĺpec, ale nevie bezpečne pridať index,
// vyčistiť duplicity či presunúť dáta — a na MariaDB pri každom štarte navyše
// množí indexy. Produkcia preto môže bežať s DB_SYNC=off a zmeny schémy sa
// aplikujú cez migrácie v src/migrations/ (spúšťajú sa automaticky pri štarte
// aj ručne cez `npm run migrate`).
//
// Každá migrácia sa vykoná len raz — názov sa zapíše do tabuľky
// `schema_migrations`. Migrácie sú navyše písané idempotentne (pred pridaním
// stĺpca/indexu overia, či už neexistuje), takže fungujú aj po `DB_SYNC=force`
// alebo `alter`, keď stĺpce už vytvoril Sequelize z modelov.

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'migrations');
const { QueryTypes } = require('sequelize');

// SELECT cez mariadb konektor musí mať type: SELECT (inak Sequelize padá na 'meta').
const select = (sequelize, sql, replacements = []) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

function helpers(sequelize) {
  const qi = sequelize.getQueryInterface();

  async function tableExists(table) {
    const rows = await select(sequelize, 'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1', [table]);
    return rows.length > 0;
  }
  async function columnExists(table, column) {
    const rows = await select(sequelize, 'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1', [table, column]);
    return rows.length > 0;
  }
  async function indexExists(table, name) {
    const rows = await select(sequelize, 'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1', [table, name]);
    return rows.length > 0;
  }
  async function addColumnIfMissing(table, column, spec) {
    if (!(await tableExists(table))) return false;
    if (await columnExists(table, column)) return false;
    await qi.addColumn(table, column, spec);
    return true;
  }
  async function addIndexIfMissing(table, name, columns, { unique = false } = {}) {
    if (!(await tableExists(table))) return false;
    if (await indexExists(table, name)) return false;
    const cols = columns.map((c) => '`' + c + '`').join(', ');
    await sequelize.query(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX \`${name}\` ON \`${table}\` (${cols})`);
    return true;
  }
  return { qi, tableExists, columnExists, indexExists, addColumnIfMissing, addIndexIfMissing };
}

async function runMigrations(sequelize, { log = console.log } = {}) {
  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS `schema_migrations` ('
    + '`name` VARCHAR(191) NOT NULL PRIMARY KEY, '
    + '`applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
    + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  );
  const doneRows = await select(sequelize, 'SELECT name FROM schema_migrations');
  const done = new Set(doneRows.map((r) => r.name));

  const files = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter((f) => /^\d+.*\.js$/.test(f)).sort()
    : [];

  const h = { ...helpers(sequelize), select: (sql, r) => select(sequelize, sql, r) };
  const { Sequelize } = require('sequelize');
  let applied = 0;
  for (const file of files) {
    const name = file.replace(/\.js$/, '');
    if (done.has(name)) continue;
    const mig = require(path.join(DIR, file));
    log(`[migrate] ${name} …`);
    await mig.up({ sequelize, Sequelize, ...h, log });
    await sequelize.query('INSERT INTO schema_migrations (name) VALUES (?)', { replacements: [name] });
    applied++;
  }
  log(applied ? `[migrate] hotovo, aplikovaných migrácií: ${applied}` : '[migrate] schéma je aktuálna');
  return applied;
}

module.exports = { runMigrations };

// CLI: node src/config/migrate.js
if (require.main === module) {
  require('dotenv').config();
  const db = require('../models');
  runMigrations(db.sequelize)
    .then(() => process.exit(0))
    .catch((e) => { console.error('[migrate] ZLYHALO:', e); process.exit(1); });
}

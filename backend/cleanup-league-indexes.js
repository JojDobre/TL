// cleanup-all-indexes.js
// Univerzalny jednorazovy skript: prejde VSETKY tabulky a odstrani
// naakumulovane duplicitne indexy typu "<stlpec>_2, <stlpec>_3, ..." ktore
// vznikli opakovanym DB_SYNC=alter restartom (ER_TOO_MANY_KEYS, max 64).
//
// Pre kazdy stlpec, ktory ma viac unikatnych single-column indexov, necha
// jeden (prvy podla nazvu) a ostatne zmaze.
//
// Spustenie z priecinka backend/:
//   node cleanup-all-indexes.js

require('dotenv').config();

(async () => {
  let sequelize, QueryTypes;
  try {
    const db = require('./src/models');
    sequelize = db.sequelize;
    QueryTypes = db.Sequelize ? db.Sequelize.QueryTypes : require('sequelize').QueryTypes;
    if (!sequelize || typeof sequelize.query !== 'function') {
      throw new Error('models/index.js neexportuje sequelize instanciu');
    }
  } catch (e) {
    console.error('Chyba pri nacitani DB konfiguracie:', e.message);
    process.exit(1);
  }

  try {
    // 1) nacitaj vsetky indexy vo VSETKYCH tabulkach aktualnej DB
    const rows = await sequelize.query(
      "SELECT TABLE_NAME AS tbl, INDEX_NAME AS idx, COLUMN_NAME AS col," +
      "       NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS seq" +
      "  FROM INFORMATION_SCHEMA.STATISTICS" +
      " WHERE TABLE_SCHEMA = DATABASE()" +
      " ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
      { type: QueryTypes.SELECT }
    );

    // 2) zosumarizuj indexy: {tbl -> {idx -> {cols:[], unique:bool}}}
    const tables = {};
    for (const r of rows) {
      tables[r.tbl] = tables[r.tbl] || {};
      tables[r.tbl][r.idx] = tables[r.tbl][r.idx] || { cols: [], unique: Number(r.nonUnique) === 0 };
      tables[r.tbl][r.idx].cols.push(r.col);
    }

    let totalDropped = 0;

    // 3) pre kazdu tabulku najdi single-column unikatne indexy zoskupene podla stlpca
    for (const tbl of Object.keys(tables)) {
      const idxs = tables[tbl];
      const byColumn = {}; // col -> [indexNames]
      for (const idxName of Object.keys(idxs)) {
        if (idxName === 'PRIMARY') continue;
        const info = idxs[idxName];
        if (!info.unique) continue;              // len unikatne
        if (info.cols.length !== 1) continue;    // len single-column
        const col = info.cols[0];
        byColumn[col] = byColumn[col] || [];
        byColumn[col].push(idxName);
      }

      for (const col of Object.keys(byColumn)) {
        const names = byColumn[col];
        if (names.length <= 1) continue; // ziadny duplikat

        // ktore nechat: preferuj pomenovany "*_unique", inak abecedne prvy
        const preferred = names.find((n) => /_unique$/.test(n)) || names.slice().sort()[0];
        const drop = names.filter((n) => n !== preferred);

        console.log(`\n[${tbl}.${col}] najdenych unikatnych indexov: ${names.length}, nechavam: ${preferred}, mazem: ${drop.length}`);
        for (const name of drop) {
          try {
            await sequelize.query('ALTER TABLE `' + tbl + '` DROP INDEX `' + name + '`', { raw: true });
            process.stdout.write('.');
            totalDropped++;
          } catch (err) {
            console.error('\n  chyba pri mazani ' + name + ':', err.message);
          }
        }
      }
    }

    console.log(`\n\nHotovo ✓  Zmazanych indexov spolu: ${totalDropped}`);
    process.exit(0);
  } catch (e) {
    console.error('Chyba:', e.message || e);
    process.exit(1);
  }
})();
const fs = require('fs');                // Na prácu so súborovým systémom
const path = require('path');            // Na prácu s cestami k súborom
const { Sequelize } = require('sequelize');
const config = require('../config/db.config.js')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    port: config.port,
    logging: config.logging,
    define: config.define,
  }
);

// Testovanie spojenia s databázou
sequelize
  .authenticate()
  .then(() => {
    console.log('Spojenie s databázou bolo úspešne nadviazané.');
  })
  .catch((err) => {
    console.error('Nemožno sa spojiť s databázou:', err);
  });

const db = {
  sequelize,
  Sequelize,
};

// Automatické načítanie všetkých modelov z adresára
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&         // Filtruje skryté súbory (začínajúce bodkou)
      file !== path.basename(__filename) && // Filtruje aktuálny súbor (index.js)
      file.slice(-3) === '.js' &&        // Filtruje len JavaScript súbory
      file.indexOf('.test.js') === -1     // Filtruje testovacie súbory
    );
  })
  .forEach(file => {
    // Načítava model z každého JS súboru v adresári
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Nastavenie asociácií medzi modelmi
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
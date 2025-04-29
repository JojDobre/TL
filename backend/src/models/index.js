const { Sequelize } = require('sequelize');
const config = require('../config/db.config.js')[process.env.NODE_ENV || 'development'];

// Vytvorenie instancie Sequelize s nastaveniami z konfiguracie
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
  
  // Testovanie spojenia s databazou
  sequelize
    .authenticate()
    .then(() => {
      console.log('Spojenie s databázou bolo úspešne nadviazané.');
    })
    .catch((err) => {
      console.error('Nemožno sa spojiť s databázou:', err);
    });
  
  // Vytvorenie objektu db pre export modelov
  const db = {
    sequelize,
    Sequelize,
    // Tu budu importovane modely
  };
  
  module.exports = db;
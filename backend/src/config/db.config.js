// backend/src/config/db.config.js
require('dotenv').config();

// Konfigurácia pripojenia k databáze (MariaDB)
module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mariadb',                 // ZMENA: predtým 'postgres'
    logging: false,                     // SQL logy vypnuté (zapni console.log pri ladení)
    define: {
      timestamps: true,
      underscored: true,
    },
    dialectOptions: {
      // MariaDB: korektné spracovanie dátumov a časových zón
      timezone: '+00:00',
    },
    // viac spojení než predvolených 5 — práca na pozadí (automatické výsledky,
    // odznaky) nesmie blokovať návštevníkov webu
    pool: { max: Number(process.env.DB_POOL_MAX || 15), min: 0, acquire: 30000, idle: 10000 },
  },
  test: {},
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mariadb',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
    dialectOptions: {
      timezone: '+00:00',
    },
    pool: { max: Number(process.env.DB_POOL_MAX || 15), min: 0, acquire: 30000, idle: 10000 },
  },
};
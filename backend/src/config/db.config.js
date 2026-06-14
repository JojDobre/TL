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
      timezone: 'Etc/GMT0',
    },
  },
  test: {},
  production: {},
};

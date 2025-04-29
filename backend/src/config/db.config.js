// backend/src/config/db.config.js
require('dotenv').config();

// Konfiguracia pre pripojenie k databaze
module.exports = {
  development: {
    username: process.env.DB_USER,        // Meno uzivatela databazy definovane v .env subore
    password: process.env.DB_PASSWORD,    // Heslo k databaze definovane v .env subore
    database: process.env.DB_NAME,        // Nazov databazy definovany v .env subore
    host: process.env.DB_HOST,            // Host databazy definovany v .env subore
    port: process.env.DB_PORT,            // Port databazy definovany v .env subore
    dialect: 'postgres',                  // Typ databazy, ktoru pouzivame (PostgreSQL)
    logging: console.log,                 // Povolenie logovania SQL prikazov do konzoly
    define: {
      timestamps: true,                   // Automaticke pridavanie stlpcov createdAt a updatedAt
      underscored: true,                  // Pouzivanie snake_case namiesto camelCase v databaze
    },
  },
  test: {
    // Tu budu konfiguracie pre testovanie
  },
  production: {
    // Tu budu konfiguracie pre produkcne prostredie
  },
};
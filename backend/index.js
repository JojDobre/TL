// backend/index.js
require('dotenv').config();                 // Nacitanie premennych z .env suboru
const express = require('express');         // Import express frameworku
const cors = require('cors');               // Import CORS middleware pre cross-origin requesty
const helmet = require('helmet');           // Import helmet pre zabezpecenie HTTP hlaviciek
const morgan = require('morgan');           // Import morgan pre logovanie HTTP requestov

// Vytvorenie express aplikacie
const app = express();
const PORT = process.env.PORT || 5000;      // Definovanie portu z .env alebo default 5000

// Middleware
app.use(cors());                            // Povolenie CORS
app.use(helmet());                          // Pridanie bezpecnostnych hlaviciek
app.use(morgan('dev'));                     // Logovanie requestov
app.use(express.json());                    // Parsovanie JSON tela requestov
app.use(express.urlencoded({ extended: true })); // Parsovanie URL-encoded tela requestov

// Zakladna route pre testovanie
app.get('/', (req, res) => {
  res.send('Tipovacia aplikácia API beží!');
});

// Spustenie servera
app.listen(PORT, () => {
  console.log(`Server beží na porte ${PORT}`);
});

// Exportovanie app pre testy
module.exports = app;
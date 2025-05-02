require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const syncDatabase = require('./src/config/db.sync');

// Importovanie routes
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const seasonRoutes = require('./src/routes/season.routes');
const leagueRoutes = require('./src/routes/league.routes');
const roundRoutes = require('./src/routes/round.routes');
// Vytvorenie express aplikácie
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Registrácia routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/seasons', seasonRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/rounds', roundRoutes);

// Základná route pre testovanie
app.get('/', (req, res) => {
  res.send('Tipovacia aplikácia API beží!');
});

// Synchronizácia databázy pri spustení aplikácie (len pre vývoj)
if (process.env.NODE_ENV === 'development') {
  syncDatabase()
    .then(() => {
      console.log('Databáza bola úspešne inicializovaná.');
    })
    .catch((error) => {
      console.error('Chyba pri inicializácii databázy:', error);
    });
}

// Spustenie servera
app.listen(PORT, () => {
  console.log(`Server beží na porte ${PORT}`);
});

// Exportovanie app pre testy
module.exports = app;
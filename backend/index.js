require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const syncDatabase = require('./src/config/db.sync');

const { errorHandler } = require('./src/middleware/error.middleware');

// API routes (vracajú JSON — pre akcie cez fetch z prehliadača)
const authApi = require('./src/routes/auth.routes');
const userApi = require('./src/routes/user.routes');
const seasonApi = require('./src/routes/season.routes');
const leagueApi = require('./src/routes/league.routes');
const roundApi = require('./src/routes/round.routes');
const matchApi = require('./src/routes/match.routes');
const teamApi = require('./src/routes/team.routes');
const tipApi = require('./src/routes/tip.routes');

// Page routes (vracajú HTML cez EJS render)
const pageRoutes = require('./src/routes/page.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ---- EJS view engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---- statické súbory (CSS, shell.js, enhance.js, obrázky) ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- bezpečnosť a logovanie ----
// helmet s vypnutým CSP (inline štýly v šablónach); pri produkcii doladiť
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));

// ---- parsovanie tiel požiadaviek ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- session (nahrádza JWT v localStorage) ----
app.use(session({
  secret: process.env.SESSION_SECRET || 'zmen-ma',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 dní
}));

// ---- sprístupnenie prihláseného používateľa všetkým šablónam ----
app.use((req, res, next) => {
  res.locals.currentUserId = req.session.userId || null;
  res.locals.currentUserRole = req.session.userRole || null;
  res.locals.currentUserName = req.session.userName || null;
  next();
});

// ---- API (JSON) ----
app.use('/api/auth', authApi);
app.use('/api/users', userApi);
app.use('/api/seasons', seasonApi);
app.use('/api/leagues', leagueApi);
app.use('/api/rounds', roundApi);
app.use('/api/matches', matchApi);
app.use('/api/teams', teamApi);
app.use('/api/tips', tipApi);

// ---- Stránky (HTML cez EJS) ----
app.use('/', pageRoutes);

// ---- Error handling ----
app.use(errorHandler);

// ---- štart ----
if (process.env.NODE_ENV === 'development') {
  syncDatabase()
    .then(() => console.log('Databáza bola úspešne inicializovaná.'))
    .catch((error) => console.error('Chyba pri inicializácii databázy:', error));
}

app.listen(PORT, () => console.log(`Tiperliga beží na http://localhost:${PORT}`));

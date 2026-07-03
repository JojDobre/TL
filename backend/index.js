require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const syncDatabase = require('./src/config/db.sync');

const { errorHandler, notFoundHandler } = require('./src/middleware/error.middleware');
const { createSessionStore } = require('./src/config/session-store');
const { provideCsrfToken, verifyCsrf } = require('./src/middleware/csrf.middleware');

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
const isProd = process.env.NODE_ENV === 'production';

// ---- kontrola SESSION_SECRET ----
// V produkcii MUSÍ byť nastavený silný tajný kľúč — inak by sa session cookie
// podpisovala verejne známym fallbackom a dala by sa sfalšovať. Radšej spadnúť
// pri štarte s jasnou hláškou než tíško bežať nebezpečne.
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'zmen-ma')) {
  console.error('FATALNE: SESSION_SECRET nie je nastaveny (alebo ma predvolenu hodnotu). '
    + 'Nastav ho v .env, napr.: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'zmen-ma';

// za nginx reverse proxy — aby secure cookie a req.protocol fungovali správne
app.set('trust proxy', 1);

// ---- EJS view engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---- statické súbory (CSS, shell.js, enhance.js, obrázky) ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- bezpečnosť a logovanie ----
// helmet s vypnutým CSP (inline štýly v šablónach); pri produkcii doladiť
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // povoliť obrázky (logá tímov, covery) z hocijakej https domény + data: + blob:
      'img-src': ["'self'", 'https:', 'data:', 'blob:'],
      // pre prípadné inline štýly v šablónach
      'style-src': ["'self'", "'unsafe-inline'", 'https:'],
      // Google Analytics (gtag) + AdSense skripty
      'script-src': [
        "'self'", "'unsafe-inline'",
        'https://www.googletagmanager.com',
        'https://pagead2.googlesyndication.com',
        'https://*.adtrafficquality.google',
      ],
      // povoliť inline event handlery (onchange/onclick v šablónach);
      // helmet defaultne nastavuje script-src-attr na 'none', čo ich blokuje
      'script-src-attr': ["'unsafe-inline'"],
      // fetch/beacon ciele: naše API + GA merania + AdSense
      'connect-src': [
        "'self'",
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://www.googletagmanager.com',
        'https://pagead2.googlesyndication.com',
        'https://*.adtrafficquality.google',
      ],
      // AdSense renderuje reklamy v iframe z týchto domén
      'frame-src': [
        "'self'",
        'https://googleads.g.doubleclick.net',
        'https://tpc.googlesyndication.com',
        'https://www.google.com',
        'https://*.adtrafficquality.google',
      ],
    },
  },
}));
if (!isProd) app.use(morgan('dev'));

// ---- parsovanie tiel požiadaviek ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- session (nahrádza JWT v localStorage) ----
// Perzistentný store v MariaDB — sessions prežijú reštart servera a fungujú aj
// pri viacerých inštanciách (na rozdiel od predvoleného MemoryStore).
app.use(session({
  secret: SESSION_SECRET,
  store: createSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,          // cez HTTPS posielať cookie len bezpečne
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  }, // 7 dní
}));

// ---- CSRF: zabezpeč token v session a sprístupni ho šablónam ----
// (samotné overenie tokenu je až na mutujúcich routes cez verifyCsrf)
app.use(provideCsrfToken);

// ---- sprístupnenie prihláseného používateľa všetkým šablónam ----
app.use(async (req, res, next) => {
  res.locals.currentUserId = req.session.userId || null;
  res.locals.currentUserRole = req.session.userRole || null;
  res.locals.currentUserName = req.session.userName || null;
  // Analytics/Ads: šablóny vložia skripty len ak sú ID nastavené v .env
  res.locals.gaMeasurementId = process.env.GA_MEASUREMENT_ID || '';
  res.locals.adsenseClientId = process.env.ADSENSE_CLIENT_ID || '';
  // canonical URL — absolútna adresa stránky bez query stringu (SEO: zabráni
  // duplicitnému indexovaniu variantov ako /leaderboards?season=1)
  const appBase = (process.env.APP_URL || 'https://tifo.sk').replace(/\/$/, '');
  res.locals.canonicalUrl = appBase + (req.path === '/' ? '/' : req.path.replace(/\/$/, ''));
  // profilová fotka prihláseného — načítava sa z DB (lacný select podľa PK),
  // aby bola vždy aktuálna bez ohľadu na to, kedy bola nastavená.
  res.locals.currentUserImage = null;
  if (req.session.userId) {
    try {
      const { User } = require('./src/models');
      const u = await User.findByPk(req.session.userId, { attributes: ['profileImage'] });
      res.locals.currentUserImage = u ? (u.profileImage || null) : null;
    } catch (e) { /* ignoruj — avatar je vedľajší */ }
  }
  next();
});

// ---- CSRF overenie ----
// Kontroluje token pri POST/PUT/PATCH/DELETE (GET/HEAD/OPTIONS sa preskočia).
// Umiestnené ZA parsermi tela a session, PRED routami. Platí pre API aj stránky.
app.use(verifyCsrf);

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

// ---- 404 — žiadna z routes vyššie nesedela ----
// Musí byť ZA všetkými routes a PRED errorHandlerom. Vytvorí ApiError(404),
// ktorý errorHandler vyrenderuje ako HTML stránku (prehliadač) alebo JSON (/api/*).
app.use(notFoundHandler);

// ---- Error handling (úplne posledný middleware) ----
app.use(errorHandler);

// ---- štart ----
// Synchronizáciu riadi DB_SYNC (force/alter/off) — nie NODE_ENV.
syncDatabase()
  .then(() => console.log('Inicializácia DB hotová.'))
  .catch((error) => console.error('Chyba pri inicializácii databázy:', error));

app.listen(PORT, () => console.log(`Tiperliga beží na porte ${PORT}`));
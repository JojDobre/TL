// backend/src/utils/app-i18n.js
//
// JAZYK MOBILNEJ APLIKÁCIE (/app/*)
//
// Appka je po slovensky alebo po anglicky. Jazyk sa určí pri prvom spustení
// podľa zariadenia (sk, cs → slovenčina, inak angličtina) — rozhoduje
// klient (partials/app-lang.ejs) a uloží ho do localStorage + cookie
// `tifo_lang`. Kým cookie nie je (úplne prvá požiadavka), rozhodne hlavička
// Accept-Language, ktorú posiela prehliadač podľa jazyka zariadenia.
//
// Cookie sa číta LEN pri obrazovkách appky — web (aj v Chrome na tom istom
// telefóne, ktorý s appkou cookies zdieľa) ostáva po slovensky.

const LANGS = ['sk', 'en'];

function fromTag(tag) {
  const t = String(tag || '').trim().toLowerCase();
  if (!t) return null;
  if (/^(sk|cs)\b/.test(t)) return 'sk';
  return 'en';
}

function readCookie(req, name) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return null;
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// sk | en pre obrazovku appky
function resolveLang(req) {
  const c = readCookie(req, 'tifo_lang');
  if (LANGS.includes(c)) return c;
  const al = String((req.headers && req.headers['accept-language']) || '');
  // prvý jazyk v zozname (podľa poradia, q-hodnoty prehliadače dávajú zostupne)
  const first = al.split(',')[0].split(';')[0];
  return fromTag(first) || 'en';
}

// ── texty ────────────────────────────────────────────────────────────────────
// {x} sa nahradí premennou. Množné čísla: P[lang][kľúč] = [1, 2–4, 5+] (sk)
// alebo [1, viac] (en).

const T = {
  sk: {
    'title.welcome': 'Vitaj', 'title.home': 'Domov', 'title.tip': 'Tipovať', 'title.ranks': 'Rebríčky',
    'title.global': 'Celkový rebríček', 'title.noti': 'Notifikácie', 'title.profile': 'Profil',
    'tab.nav': 'Navigácia aplikácie', 'tab.home': 'Domov', 'tab.tip': 'Tipovať', 'tab.ranks': 'Rebríčky', 'tab.noti': 'Notifikácie', 'tab.profile': 'Profil',
    'common.back': 'Späť', 'common.player': 'Hráč', 'common.you': 'Ty', 'common.pts': 'b',
    'greet.morning': 'Dobré ráno', 'greet.day': 'Dobrý deň', 'greet.evening': 'Dobrý večer',
    'when.today': 'dnes', 'when.tomorrow': 'zajtra', 'when.in': 'o {x}',
    'day.today': 'Dnes', 'day.tomorrow': 'Zajtra', 'day.yesterday': 'Včera', 'day.older': 'Staršie',
    'round.opens': 'otvorí sa {x}', 'round.deadline': 'uzávierka {x}',
    // domov
    'home.deadline': 'Uzávierka {x}',
    'home.tippedOf': 'Máš natipované {a} z {b} {m}',
    'home.finish': 'Dotipovať {n} {m}',
    'home.allTipped': 'Všetko natipované', 'home.tippedN': 'Máš otipovaných {n} {m}',
    'home.canChange': 'Tipy môžeš meniť až do výkopu.',
    'home.noOpen': 'Žiadne otvorené kolo', 'home.nothing': 'Momentálne nie je čo tipovať',
    'home.joinNext': 'Pridaj sa do ďalšej súťaže a tipuj s ostatnými.', 'home.find': 'Nájsť súťaž',
    'home.last7': 'Posledných 7 dní', 'home.more': 'o {n} b viac ako týždeň predtým', 'home.less': 'o {n} b menej ako týždeň predtým',
    'home.same': 'rovnako ako týždeň predtým', 'home.accuracy': 'Presnosť', 'home.best': 'Najlepšie',
    'home.myLeagues': 'Moje ligy', 'home.noLeagues': 'Zatiaľ nie si v žiadnej lige',
    'home.noLeaguesTx': 'Vyber si oficiálnu súťaž alebo sa pridaj ku kamarátom.', 'home.browse': 'Prehľadať súťaže',
    // liga
    'liga.web': 'Webová verzia ligy', 'liga.official': 'Oficiálna liga', 'liga.community': 'Komunitná liga',
    'liga.roundOf': 'kolo {a} z {b}', 'liga.ended': 'Ukončená', 'liga.open': 'Kolo otvorené', 'liga.auto': 'Automatické výsledky',
    'liga.youAre': 'Si {r}. · {p} b', 'liga.rounds': 'Kolá', 'liga.board': 'Rebríček', 'liga.prizes': 'Ceny', 'liga.rules': 'Pravidlá',
    'liga.noRounds': 'Zatiaľ žiadne kolá', 'liga.noRoundsTx': 'Kolá pridá správca ligy.',
    'liga.noPoints': 'Zatiaľ bez bodov', 'liga.noPointsTx': 'Rebríček sa zobrazí po prvých vyhodnotených zápasoch.',
    'liga.fullBoard': 'Celý rebríček', 'liga.place': '{n}. miesto',
    'liga.prizeNote': 'Účasť je zadarmo, nehrá sa o peniaze. Ceny venuje organizátor ligy, podrobnosti sú v časti',
    'liga.scoring': 'Bodovanie', 'liga.exact': 'Presný výsledok', 'liga.winner': 'Správny víťaz alebo remíza',
    'liga.diff': 'Správny gólový rozdiel', 'liga.goals': 'Presný počet gólov tímu', 'liga.seasonRules': 'Pravidlá súťaže',
    // notifikácie
    'noti.readAll': 'Označiť všetko ako prečítané', 'noti.all': 'Všetky', 'noti.tips': 'Tipy', 'noti.results': 'Výsledky',
    'noti.leagues': 'Ligy', 'noti.other': 'Ostatné', 'noti.none': 'Žiadne notifikácie', 'noti.noneTx': 'Keď sa niečo udeje, nájdeš to tu.',
    'noti.tip': 'Tipovať',
    // profil
    'prof.settings': 'Nastavenia', 'prof.since': 'člen od {x}', 'prof.points': 'bodov', 'prof.accuracy': 'presnosť', 'prof.exact': 'presných',
    'prof.badges': 'Odznaky', 'prof.badgesOf': '{a} z {b}', 'prof.seasons': 'Sezóny a súťaže', 'prof.history': 'História tipov',
    'prof.stats': 'Štatistiky', 'prof.news': 'Novinky', 'prof.admin': 'Administrácia', 'prof.logout': 'Odhlásiť sa',
    'prof.lang': 'Jazyk', 'prof.terms': 'Podmienky', 'prof.privacy': 'Súkromie', 'prof.contact': 'Kontakt',
    // rebríček
    'rb.label': 'Rebríček', 'rb.pick': 'Vybrať ligu', 'rb.detail': 'Detail ligy', 'rb.total': 'Celkovo', 'rb.round': 'Toto kolo',
    'rb.30': '30 dní', 'rb.points': 'Body', 'rb.first100': 'Zobrazených prvých 100 z {n}', 'rb.leading': 'Vedieš rebríček',
    'rb.behind': '{n} {m} za {r}. miestom', 'rb.tie': 'Rovnako bodov ako {r}. miesto',
    'rbs.mine': 'Moje ligy', 'rbs.global': 'Celkový rebríček', 'rbs.none': 'Zatiaľ žiadne ligy',
    'rbs.noneTx': 'Keď sa pridáš do ligy, uvidíš tu svoje poradie.', 'rbs.leading': 'vedieš', 'rbs.gap': '{n} b za lídrom',
    'rbs.top': 'top {n} %', 'rbs.prizes': 'Ceny v lige', 'rbs.hist': 'poradie za posledných {n} kôl', 'rbs.best': 'najlepšie {n}.',
    'rbs.ended': 'Ukončené', 'rbs.endedOne': 'Ukončená',
    // tipovanie
    'tip.ring': 'Natipované {a} z {b}', 'tip.all': 'Všetky', 'tip.nothing': 'Nič na tipovanie',
    'tip.nothingTx': 'Momentálne nie je otvorené žiadne kolo. Keď sa otvorí, dáme ti vedieť.', 'tip.join': 'Pridať sa do súťaže',
    'tip.atKickoff': 'uzávierka pri výkope', 'tip.homePlus': 'Domáci +1', 'tip.homeMinus': 'Domáci −1',
    'tip.awayPlus': 'Hostia +1', 'tip.awayMinus': 'Hostia −1', 'tip.saved': 'Uložené', 'tip.notYet': 'Ešte netipnuté',
    // úvod
    'onb.skip': 'Preskočiť', 'onb.mascot': 'Maskot Tifo', 'onb.step': 'KROK {n} Z 3',
    'onb.h1': 'Tipuj výsledky<br>svojich zápasov',
    'onb.p1': 'Pridaj sa do ligy s kamarátmi alebo do oficiálnej súťaže. Tip zmeníš kedykoľvek až do výkopu.',
    'onb.h2': 'Zbieraj body<br>a stúpaj v rebríčku', 'onb.exact': 'Presný výsledok', 'onb.winner': 'Správny víťaz alebo remíza', 'onb.diff': 'Gólový rozdiel',
    'onb.h3': 'Nezmeškaj<br>žiadnu uzávierku',
    'onb.p3': 'Pripomenieme ti netipnuté zápasy a dáme vedieť, keď dostaneš body. Výsledky sa vyhodnocujú automaticky.',
    'onb.continue': 'Pokračovať', 'onb.start': 'Začať', 'onb.have': 'Už máš účet?', 'onb.login': 'Prihlásiť sa',
    // app.js
    'js.error': 'Nepodarilo sa. Skús to znova.', 'js.saving': 'Ukladám…', 'js.saved': 'Uložené',
    'js.pushTitle': 'Pripomenúť uzávierku?', 'js.pushTx': 'Pošleme ti upozornenie, keď sa blíži uzávierka a keď dostaneš body za tip.',
    'js.pushYes': 'Zapnúť upozornenia', 'js.pushNo': 'Teraz nie', 'js.pushOn': 'Upozornenia zapnuté',
    'js.pushErr': 'Nepodarilo sa zapnúť upozornenia.', 'js.allRead': 'Všetko prečítané',
    'js.continue': 'Pokračovať', 'js.start': 'Začať',
  },
  en: {
    'title.welcome': 'Welcome', 'title.home': 'Home', 'title.tip': 'Predict', 'title.ranks': 'Leaderboards',
    'title.global': 'Overall leaderboard', 'title.noti': 'Notifications', 'title.profile': 'Profile',
    'tab.nav': 'App navigation', 'tab.home': 'Home', 'tab.tip': 'Predict', 'tab.ranks': 'Rankings', 'tab.noti': 'Alerts', 'tab.profile': 'Profile',
    'common.back': 'Back', 'common.player': 'Player', 'common.you': 'You', 'common.pts': 'pts',
    'greet.morning': 'Good morning', 'greet.day': 'Good afternoon', 'greet.evening': 'Good evening',
    'when.today': 'today', 'when.tomorrow': 'tomorrow', 'when.in': 'in {x}',
    'day.today': 'Today', 'day.tomorrow': 'Tomorrow', 'day.yesterday': 'Yesterday', 'day.older': 'Earlier',
    'round.opens': 'opens {x}', 'round.deadline': 'deadline {x}',
    'home.deadline': 'Deadline {x}',
    'home.tippedOf': 'You have predicted {a} of {b} {m}',
    'home.finish': 'Predict {n} more {m}',
    'home.allTipped': 'All predicted', 'home.tippedN': 'You have predicted {n} {m}',
    'home.canChange': 'You can change your predictions until kick-off.',
    'home.noOpen': 'No open round', 'home.nothing': 'Nothing to predict right now',
    'home.joinNext': 'Join another competition and play with others.', 'home.find': 'Find a competition',
    'home.last7': 'Last 7 days', 'home.more': '{n} pts more than the week before', 'home.less': '{n} pts less than the week before',
    'home.same': 'same as the week before', 'home.accuracy': 'Accuracy', 'home.best': 'Best',
    'home.myLeagues': 'My leagues', 'home.noLeagues': 'You are not in any league yet',
    'home.noLeaguesTx': 'Pick an official competition or join your friends.', 'home.browse': 'Browse competitions',
    'liga.web': 'Web version of the league', 'liga.official': 'Official league', 'liga.community': 'Community league',
    'liga.roundOf': 'round {a} of {b}', 'liga.ended': 'Finished', 'liga.open': 'Round open', 'liga.auto': 'Automatic results',
    'liga.youAre': 'You are {r}. · {p} pts', 'liga.rounds': 'Rounds', 'liga.board': 'Leaderboard', 'liga.prizes': 'Prizes', 'liga.rules': 'Rules',
    'liga.noRounds': 'No rounds yet', 'liga.noRoundsTx': 'Rounds are added by the league admin.',
    'liga.noPoints': 'No points yet', 'liga.noPointsTx': 'The leaderboard appears after the first matches are scored.',
    'liga.fullBoard': 'Full leaderboard', 'liga.place': '{n}. place',
    'liga.prizeNote': 'Taking part is free, no money is involved. Prizes are provided by the league organiser, details are in',
    'liga.scoring': 'Scoring', 'liga.exact': 'Exact score', 'liga.winner': 'Correct winner or draw',
    'liga.diff': 'Correct goal difference', 'liga.goals': 'Exact goals of a team', 'liga.seasonRules': 'Competition rules',
    'noti.readAll': 'Mark all as read', 'noti.all': 'All', 'noti.tips': 'Predictions', 'noti.results': 'Results',
    'noti.leagues': 'Leagues', 'noti.other': 'Other', 'noti.none': 'No notifications', 'noti.noneTx': 'When something happens, you will find it here.',
    'noti.tip': 'Predict',
    'prof.settings': 'Settings', 'prof.since': 'member since {x}', 'prof.points': 'points', 'prof.accuracy': 'accuracy', 'prof.exact': 'exact',
    'prof.badges': 'Badges', 'prof.badgesOf': '{a} of {b}', 'prof.seasons': 'Seasons and competitions', 'prof.history': 'Prediction history',
    'prof.stats': 'Statistics', 'prof.news': 'News', 'prof.admin': 'Administration', 'prof.logout': 'Log out',
    'prof.lang': 'Language', 'prof.terms': 'Terms', 'prof.privacy': 'Privacy', 'prof.contact': 'Contact',
    'rb.label': 'Leaderboard', 'rb.pick': 'Choose league', 'rb.detail': 'League details', 'rb.total': 'Overall', 'rb.round': 'This round',
    'rb.30': '30 days', 'rb.points': 'Points', 'rb.first100': 'Showing the first 100 of {n}', 'rb.leading': 'You lead the leaderboard',
    'rb.behind': '{n} {m} behind {r}. place', 'rb.tie': 'Level on points with {r}. place',
    'rbs.mine': 'My leagues', 'rbs.global': 'Overall leaderboard', 'rbs.none': 'No leagues yet',
    'rbs.noneTx': 'Once you join a league, you will see your position here.', 'rbs.leading': 'leading', 'rbs.gap': '{n} pts behind the leader',
    'rbs.top': 'top {n} %', 'rbs.prizes': 'League prizes', 'rbs.hist': 'position over the last {n} rounds', 'rbs.best': 'best {n}.',
    'rbs.ended': 'Finished', 'rbs.endedOne': 'Finished',
    'tip.ring': 'Predicted {a} of {b}', 'tip.all': 'All', 'tip.nothing': 'Nothing to predict',
    'tip.nothingTx': 'No round is open right now. We will let you know when one opens.', 'tip.join': 'Join a competition',
    'tip.atKickoff': 'deadline at kick-off', 'tip.homePlus': 'Home +1', 'tip.homeMinus': 'Home −1',
    'tip.awayPlus': 'Away +1', 'tip.awayMinus': 'Away −1', 'tip.saved': 'Saved', 'tip.notYet': 'Not predicted yet',
    'onb.skip': 'Skip', 'onb.mascot': 'Tifo mascot', 'onb.step': 'STEP {n} OF 3',
    'onb.h1': 'Predict the scores<br>of your matches',
    'onb.p1': 'Join a league with friends or an official competition. Change your prediction any time until kick-off.',
    'onb.h2': 'Collect points<br>and climb the table', 'onb.exact': 'Exact score', 'onb.winner': 'Correct winner or draw', 'onb.diff': 'Goal difference',
    'onb.h3': 'Never miss<br>a deadline',
    'onb.p3': 'We remind you of matches you have not predicted and let you know when you score points. Results are scored automatically.',
    'onb.continue': 'Continue', 'onb.start': 'Get started', 'onb.have': 'Already have an account?', 'onb.login': 'Log in',
    'js.error': 'Something went wrong. Please try again.', 'js.saving': 'Saving…', 'js.saved': 'Saved',
    'js.pushTitle': 'Remind you of deadlines?', 'js.pushTx': 'We will notify you when a deadline is near and when you get points for a prediction.',
    'js.pushYes': 'Turn on notifications', 'js.pushNo': 'Not now', 'js.pushOn': 'Notifications turned on',
    'js.pushErr': 'Could not turn on notifications.', 'js.allRead': 'All marked as read',
    'js.continue': 'Continue', 'js.start': 'Get started',
  },
};

const P = {
  sk: {
    match: ['zápas', 'zápasy', 'zápasov'], matchGen: ['zápasu', 'zápasov', 'zápasov'],
    player: ['hráč', 'hráči', 'hráčov'], point: ['bod', 'body', 'bodov'],
    exactTip: ['presný tip', 'presné tipy', 'presných tipov'], day: ['deň', 'dni', 'dní'],
  },
  en: {
    match: ['match', 'matches'], matchGen: ['match', 'matches'],
    player: ['player', 'players'], point: ['point', 'points'],
    exactTip: ['exact prediction', 'exact predictions'], day: ['day', 'days'],
  },
};

function plural(lang, n, key) {
  const forms = (P[lang] || P.sk)[key];
  if (!forms) return key;
  const a = Math.abs(Number(n) || 0);
  if (lang === 'en') return a === 1 ? forms[0] : forms[1];
  if (a === 1) return forms[0];
  if (a >= 2 && a <= 4) return forms[1];
  return forms[2];
}

function translate(lang, key, vars) {
  const dict = T[lang] || T.sk;
  let s = dict[key];
  if (s === undefined) s = T.sk[key] !== undefined ? T.sk[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  return s;
}

// texty pre app.js (klient) — len kľúče js.*
function clientStrings(lang) {
  const dict = T[lang] || T.sk;
  const out = {};
  Object.keys(T.sk).filter((k) => k.startsWith('js.')).forEach((k) => { out[k.slice(3)] = dict[k] !== undefined ? dict[k] : T.sk[k]; });
  return out;
}

function forLang(lang) {
  const l = LANGS.includes(lang) ? lang : 'sk';
  return {
    lang: l,
    t: (key, vars) => translate(l, key, vars),
    tn: (n, key) => plural(l, n, key),
    clientStrings: () => clientStrings(l),
  };
}

module.exports = { LANGS, resolveLang, fromTag, forLang, translate, plural, _T: T, _P: P };

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
    'liga.menu': 'Možnosti ligy', 'liga.invite': 'Pozvať priateľov', 'liga.code': 'ID ligy', 'liga.copy': 'Kopírovať',
    'liga.manage': 'Spravovať ligu', 'liga.newRound': 'Vytvoriť kolo', 'liga.members': 'Členovia', 'liga.season': 'Sezóna a ostatné ligy',
    'js.jokerToast': 'Žolík nasadený — za tento zápas dostaneš dvojnásobok.', 'js.jokerOff': 'Žolík zrušený.', 'js.jokerSet': 'Nasadiť žolíka', 'js.jokerActive': 'Žolík nasadený', 'js.jokerUsed': 'Žolík v tomto kole už hrá',
    'share.btn': 'Zdieľať výsledok', 'share.got': 'V tomto kole mám', 'share.rank': '{r}. miesto z {n}', 'share.exact': 'presné výsledky', 'share.hits': 'bodované tipy', 'share.joker': 'Žolík v hre', 'share.cta': 'Tipuj so mnou na Tifo', 'share.code': 'kód ligy', 'share.text': 'Mám {p} b v kole {r} na Tifo ⚽',
    'joker.rule': 'Žolík (1 zápas v kole)', 'joker.set': 'Nasadiť žolíka', 'joker.active': 'Žolík nasadený', 'joker.used': 'Žolík v tomto kole už hrá', 'joker.title': 'Žolík — dvojnásobné body', 'joker.tipFirst': 'Najprv zápas tipni.',
    'comp.stop': 'Nesúťažiť (len spravovať)', 'comp.stopQ': 'Prestať súťažiť? Súťaž budeš ďalej spravovať, ale tvoje tipy v nej sa zmažú a zmizneš z rebríčka.',
    'liga.leave': 'Opustiť ligu', 'liga.leaveQ': 'Naozaj opustiť túto ligu?', 'liga.join': 'Pripojiť sa do ligy',
    'liga.locked': 'Súkromná liga', 'liga.lockedTx': 'Na pripojenie potrebuješ heslo ligy.', 'liga.password': 'Heslo ligy',
    'liga.noTeams': 'Liga nemá žiadne tímy', 'liga.noTeamsTx': 'Bez tímov nevieš vytvárať zápasy. Prirad ich v správe ligy.',
    'liga.close': 'Zavrieť',
    'kolo.menu': 'Možnosti kola', 'kolo.evaluate': 'Vyhodnotiť zápasy', 'kolo.addMatches': 'Pridať zápasy', 'kolo.edit': 'Upraviť kolo',
    'kolo.delete': 'Zmazať kolo', 'kolo.deleteQ': 'Naozaj zmazať toto kolo aj s jeho zápasmi? Kolo s tipmi sa nedá zmazať.',
    'kolo.openLeague': 'Otvoriť ligu', 'kolo.matches': 'Zápasy', 'kolo.board': 'Rebríček kola', 'kolo.scoring': 'Bodovanie',
    'kolo.st.open': 'Otvorené', 'kolo.st.scheduled': 'Naplánované', 'kolo.st.finished': 'Ukončené',
    'kolo.toTip': 'Na tipovanie', 'kolo.rest': 'Ostatné zápasy', 'kolo.opensAt': 'Kolo sa otvorí {x}. Potom môžeš tipovať.',
    'kolo.notMember': 'Tipovať môžu len členovia ligy.', 'kolo.yourTip': 'Tvoj tip', 'kolo.noTip': 'netipované',
    'kolo.others': 'Tipy ostatných ({n})', 'kolo.noOthers': 'Nikto iný netipoval.',
    'kolo.s.finished': 'Vyhodnotené', 'kolo.s.canceled': 'Zrušený', 'kolo.s.live': 'Čaká na výsledok', 'kolo.s.waiting': 'Naplánovaný',
    'kolo.myPts': 'Získal si {n} b', 'kolo.rank': '{r}. v kole', 'kolo.empty': 'V kole zatiaľ nie sú zápasy.',
    'kolo.noBoard': 'Rebríček kola sa zobrazí po vyhodnotení prvých zápasov.', 'kolo.allDone': 'Všetko natipované',
    'kolo.canChange': 'Tipy sa ukladajú samé a môžeš ich meniť až do výkopu.',
    'sez.menu': 'Možnosti sezóny', 'sez.code': 'ID sezóny', 'sez.tip': 'Tipovať zápasy', 'sez.manage': 'Spravovať sezónu',
    'sez.newLeague': 'Vytvoriť ligu', 'sez.members': 'Členovia', 'sez.leave': 'Opustiť sezónu', 'sez.leaveQ': 'Naozaj opustiť túto sezónu?',
    'sez.join': 'Pripojiť sa do sezóny', 'sez.locked': 'Súkromná sezóna', 'sez.lockedTx': 'Na pripojenie potrebuješ heslo sezóny.',
    'sez.password': 'Heslo sezóny', 'sez.leagues': 'Ligy', 'sez.board': 'Rebríček', 'sez.rules': 'Pravidlá', 'sez.news': 'Novinky',
    'sez.official': 'Oficiálna sezóna', 'sez.community': 'Komunitná sezóna', 'sez.active': 'Prebieha', 'sez.upcoming': 'Čoskoro',
    'sez.ended': 'Ukončená', 'sez.youAre': 'Si {r}. · {p} b', 'sez.noLeagues': 'Zatiaľ žiadne ligy', 'sez.noNews': 'Zatiaľ žiadne novinky.',
    'sez.member': 'Si členom', 'sez.fullBoard': 'Celý rebríček', 'sez.joined': 'Pridal si sa do sezóny',
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
    // pridať sa / vytvoriť ligu
    'title.add': 'Ligy', 'add.aria': 'Pridať sa alebo vytvoriť ligu',
    'join.tabJoin': 'Pridať sa', 'join.tabCreate': 'Vytvoriť ligu',
    'join.codeLabel': 'Kód ligy', 'join.codeHint': 'Kód ti pošle správca ligy — 6 znakov, napr. 29E384.',
    'join.pwLabel': 'Heslo ligy', 'join.pwPh': 'Zadaj heslo', 'join.submit': 'Pridať sa do ligy',
    'join.official': 'Oficiálne súťaže', 'join.officialTx': 'Tipuj s celou komunitou Tifo — stačí ťuknúť.',
    'join.btn': 'Pridať sa', 'join.member': 'Si v lige', 'join.noneOfficial': 'Momentálne nie je otvorená žiadna oficiálna súťaž.',
    'join.joined': 'Si v lige!', 'join.joinedSeason': 'Si v sezóne — vyber si ligu.',
    'join.err.emptyCode': 'Zadaj kód ligy.', 'join.err.notFound': 'Liga s týmto kódom neexistuje. Skontroluj ho.',
    'join.err.needPassword': 'Liga je chránená heslom — zadaj ho.', 'join.err.badPassword': 'Nesprávne heslo.',
    'join.err.ended': 'Táto liga už skončila.', 'join.err.nameRequired': 'Zadaj názov ligy.', 'join.err.nameTooLong': 'Názov je príliš dlhý.',
    'join.err.limit': 'Máš už maximálny počet aktívnych líg ({n}). Ukonči niektorú v jej správe.',
    'join.err.templateMissing': 'Vybraná súťaž už nie je dostupná.', 'join.err.failed': 'Nepodarilo sa. Skús to znova.',
    'create.name': 'Názov ligy', 'create.namePh': 'napr. Partia z práce',
    'create.matches': 'Zápasy', 'create.fromTpl': 'Z oficiálnej súťaže', 'create.fromTplTx': 'Kolá, zápasy aj výsledky sa doplnia samy.',
    'create.own': 'Vlastné kolá', 'create.ownTx': 'Kolá si zostavíš sám — aj zo zápasov viacerých oficiálnych líg.',
    'create.pickTpl': 'Vyber súťaž', 'create.noTpl': 'Momentálne nie je dostupná žiadna oficiálna súťaž.',
    'create.tipType': 'Typ tipovania', 'create.exact': 'Presný výsledok', 'create.exactTx': 'napr. 2 : 1',
    'create.winner': 'Víťaz 1X2', 'create.winnerTx': 'domáci / remíza / hostia',
    'create.pw': 'Heslo (voliteľné)', 'create.pwTx': 'Bez hesla sa pridá každý, kto má kód.',
    'create.submit': 'Vytvoriť ligu', 'create.doneTitle': 'Liga je pripravená',
    'create.doneTx': 'Pošli kamarátom kód alebo odkaz, nech sa pridajú.', 'create.code': 'Kód ligy',
    'create.share': 'Pozvať kamarátov', 'create.copy': 'Kopírovať kód', 'create.copied': 'Skopírované',
    'create.open': 'Otvoriť ligu', 'create.firstRound': 'Vytvoriť prvé kolo',
    'create.shareText': 'Pridaj sa do mojej ligy „{name}“ na Tifo. Kód: {code}',
    'home.joinCode': 'Pridať sa kódom', 'home.create': 'Vytvoriť ligu',
    'home.mySeasons': 'Moje sezóny', 'home.place': 'miesto', 'home.toTip': '{n} na tip', 'home.noRank': 'bez poradia',
    'home.allSeasons': 'Všetky ({n})', 'home.howItWorks': 'Ako to funguje',
    'tour.skip': 'Preskočiť', 'tour.next': 'Ďalej', 'tour.start': 'Začať tipovať', 'tour.find': 'Nájsť súťaž',
    'tour.h1': 'Vitaj v Tifo', 'tour.p1': 'Tipuj výsledky zápasov s kamarátmi aj s celou komunitou. Je to zadarmo a nehrá sa o peniaze.',
    'tour.h2': 'Sezóna → liga → kolo', 'tour.p2': 'Sezóna je súťaž, napríklad MS 2026. V nej sú ligy, teda skupiny hráčov. Každá liga má kolá so zápasmi.',
    'tour.season': 'Sezóna', 'tour.league': 'Liga', 'tour.round': 'Kolo',
    'tour.h3': 'Tipuj šípkami', 'tour.p3': 'Šípkami nastav skóre. Tip sa uloží sám a môžeš ho meniť až do výkopu zápasu.',
    'tour.h4': 'Zbieraj body', 'tour.p4': 'Po zápase dostaneš body podľa toho, ako presne si trafil. Bodovanie si môže liga upraviť.',
    'tour.h5': 'Vyhraj rebríček', 'tour.p5': 'Body sa sčítajú do rebríčka ligy aj sezóny. Pripomenieme ti uzávierku aj nové body.',
    'tour.join': 'Pridaj sa do oficiálnej súťaže jedným ťuknutím alebo založ ligu pre kamarátov.',
    'prof.addLeague': 'Pridať sa do ligy', 'prof.createLeague': 'Vytvoriť ligu',
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
    'liga.menu': 'League options', 'liga.invite': 'Invite friends', 'liga.code': 'League ID', 'liga.copy': 'Copy',
    'liga.manage': 'Manage league', 'liga.newRound': 'Create a round', 'liga.members': 'Members', 'liga.season': 'Season and other leagues',
    'js.jokerToast': 'Joker played — this match counts double.', 'js.jokerOff': 'Joker removed.', 'js.jokerSet': 'Play joker', 'js.jokerActive': 'Joker played', 'js.jokerUsed': 'Joker already in play this round',
    'share.btn': 'Share result', 'share.got': 'This round I scored', 'share.rank': '{r}. place of {n}', 'share.exact': 'exact scores', 'share.hits': 'scoring tips', 'share.joker': 'Joker in play', 'share.cta': 'Predict with me on Tifo', 'share.code': 'league code', 'share.text': 'I scored {p} pts in {r} on Tifo ⚽',
    'joker.rule': 'Joker (1 match per round)', 'joker.set': 'Play joker', 'joker.active': 'Joker played', 'joker.used': 'Joker already in play this round', 'joker.title': 'Joker — double points', 'joker.tipFirst': 'Predict the match first.',
    'comp.stop': 'Stop competing (manage only)', 'comp.stopQ': 'Stop competing? You will still manage the competition, but your predictions in it will be deleted and you will disappear from the leaderboard.',
    'liga.leave': 'Leave league', 'liga.leaveQ': 'Really leave this league?', 'liga.join': 'Join the league',
    'liga.locked': 'Private league', 'liga.lockedTx': 'You need the league password to join.', 'liga.password': 'League password',
    'liga.noTeams': 'The league has no teams', 'liga.noTeamsTx': 'You cannot create matches without teams. Assign them in league management.',
    'liga.close': 'Close',
    'kolo.menu': 'Round options', 'kolo.evaluate': 'Score matches', 'kolo.addMatches': 'Add matches', 'kolo.edit': 'Edit round',
    'kolo.delete': 'Delete round', 'kolo.deleteQ': 'Really delete this round with its matches? A round with predictions cannot be deleted.',
    'kolo.openLeague': 'Open league', 'kolo.matches': 'Matches', 'kolo.board': 'Round leaderboard', 'kolo.scoring': 'Scoring',
    'kolo.st.open': 'Open', 'kolo.st.scheduled': 'Scheduled', 'kolo.st.finished': 'Finished',
    'kolo.toTip': 'To predict', 'kolo.rest': 'Other matches', 'kolo.opensAt': 'The round opens {x}. Then you can predict.',
    'kolo.notMember': 'Only league members can predict.', 'kolo.yourTip': 'Your prediction', 'kolo.noTip': 'not predicted',
    'kolo.others': 'Others\' predictions ({n})', 'kolo.noOthers': 'Nobody else predicted.',
    'kolo.s.finished': 'Scored', 'kolo.s.canceled': 'Canceled', 'kolo.s.live': 'Awaiting result', 'kolo.s.waiting': 'Scheduled',
    'kolo.myPts': 'You got {n} pts', 'kolo.rank': '{r}. in round', 'kolo.empty': 'No matches in this round yet.',
    'kolo.noBoard': 'The round leaderboard appears after the first matches are scored.', 'kolo.allDone': 'All predicted',
    'kolo.canChange': 'Predictions save automatically and can be changed until kick-off.',
    'sez.menu': 'Season options', 'sez.code': 'Season ID', 'sez.tip': 'Predict matches', 'sez.manage': 'Manage season',
    'sez.newLeague': 'Create a league', 'sez.members': 'Members', 'sez.leave': 'Leave season', 'sez.leaveQ': 'Really leave this season?',
    'sez.join': 'Join the season', 'sez.locked': 'Private season', 'sez.lockedTx': 'You need the season password to join.',
    'sez.password': 'Season password', 'sez.leagues': 'Leagues', 'sez.board': 'Leaderboard', 'sez.rules': 'Rules', 'sez.news': 'News',
    'sez.official': 'Official season', 'sez.community': 'Community season', 'sez.active': 'In progress', 'sez.upcoming': 'Coming soon',
    'sez.ended': 'Finished', 'sez.youAre': 'You are {r}. · {p} pts', 'sez.noLeagues': 'No leagues yet', 'sez.noNews': 'No news yet.',
    'sez.member': 'Member', 'sez.fullBoard': 'Full leaderboard', 'sez.joined': 'You joined the season',
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
    'title.add': 'Leagues', 'add.aria': 'Join or create a league',
    'join.tabJoin': 'Join', 'join.tabCreate': 'Create league',
    'join.codeLabel': 'League code', 'join.codeHint': 'Ask the league admin for the code — 6 characters, e.g. 29E384.',
    'join.pwLabel': 'League password', 'join.pwPh': 'Enter password', 'join.submit': 'Join league',
    'join.official': 'Official competitions', 'join.officialTx': 'Predict with the whole Tifo community — just tap.',
    'join.btn': 'Join', 'join.member': 'Joined', 'join.noneOfficial': 'No official competition is open right now.',
    'join.joined': 'You joined the league!', 'join.joinedSeason': 'You joined the season — pick a league.',
    'join.err.emptyCode': 'Enter the league code.', 'join.err.notFound': 'No league with this code. Please check it.',
    'join.err.needPassword': 'This league is password protected — enter the password.', 'join.err.badPassword': 'Wrong password.',
    'join.err.ended': 'This league has already finished.', 'join.err.nameRequired': 'Enter a league name.', 'join.err.nameTooLong': 'The name is too long.',
    'join.err.limit': 'You already have the maximum number of active leagues ({n}). Finish one in its settings.',
    'join.err.templateMissing': 'The selected competition is no longer available.', 'join.err.failed': 'Something went wrong. Please try again.',
    'create.name': 'League name', 'create.namePh': 'e.g. Office crew',
    'create.matches': 'Matches', 'create.fromTpl': 'From an official competition', 'create.fromTplTx': 'Rounds, matches and results are filled in automatically.',
    'create.own': 'Custom rounds', 'create.ownTx': 'Build the rounds yourself — even from matches of several official leagues.',
    'create.pickTpl': 'Choose competition', 'create.noTpl': 'No official competition is available right now.',
    'create.tipType': 'Prediction type', 'create.exact': 'Exact score', 'create.exactTx': 'e.g. 2 : 1',
    'create.winner': 'Winner 1X2', 'create.winnerTx': 'home / draw / away',
    'create.pw': 'Password (optional)', 'create.pwTx': 'Without a password anyone with the code can join.',
    'create.submit': 'Create league', 'create.doneTitle': 'Your league is ready',
    'create.doneTx': 'Send your friends the code or the link so they can join.', 'create.code': 'League code',
    'create.share': 'Invite friends', 'create.copy': 'Copy code', 'create.copied': 'Copied',
    'create.open': 'Open league', 'create.firstRound': 'Create the first round',
    'create.shareText': 'Join my league “{name}” on Tifo. Code: {code}',
    'home.joinCode': 'Join with code', 'home.create': 'Create league',
    'home.mySeasons': 'My seasons', 'home.place': 'place', 'home.toTip': '{n} to predict', 'home.noRank': 'no rank yet',
    'home.allSeasons': 'All ({n})', 'home.howItWorks': 'How it works',
    'tour.skip': 'Skip', 'tour.next': 'Next', 'tour.start': 'Start predicting', 'tour.find': 'Find a competition',
    'tour.h1': 'Welcome to Tifo', 'tour.p1': 'Predict match results with friends and the whole community. It is free and no money is involved.',
    'tour.h2': 'Season → league → round', 'tour.p2': 'A season is a competition, e.g. World Cup 2026. It has leagues, i.e. groups of players. Each league has rounds with matches.',
    'tour.season': 'Season', 'tour.league': 'League', 'tour.round': 'Round',
    'tour.h3': 'Predict with arrows', 'tour.p3': 'Set the score with the arrows. The prediction saves itself and you can change it until kick-off.',
    'tour.h4': 'Collect points', 'tour.p4': 'After the match you get points depending on how accurate you were. A league can adjust the scoring.',
    'tour.h5': 'Win the leaderboard', 'tour.p5': 'Points add up in the league and season leaderboards. We remind you of deadlines and new points.',
    'tour.join': 'Join an official competition with one tap or start a league for your friends.',
    'prof.addLeague': 'Join a league', 'prof.createLeague': 'Create a league',
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
    league: ['liga', 'ligy', 'líg'], tip: ['tip', 'tipy', 'tipov'],
  },
  en: {
    match: ['match', 'matches'], matchGen: ['match', 'matches'],
    player: ['player', 'players'], point: ['point', 'points'],
    exactTip: ['exact prediction', 'exact predictions'], day: ['day', 'days'],
    league: ['league', 'leagues'], tip: ['tip', 'tips'],
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

// backend/src/seeds/achievements.def.js
//
// Centrálna definícia všetkých odznakov. Slúži ako zdroj pre seed (naplnenie
// tabuľky `achievements`) aj ako referencia pre engine (achievement.engine.js).
//
// Polia:
//  - code: strojový identifikátor (jedinečný)
//  - criteria: druh kritéria, ktoré engine vyhodnocuje
//  - value: cieľová hodnota (pri nemerateľných 0)
//  - measurable: či sa dá teraz vyhodnotiť z dostupných dát
//
// MERATEĽNÉ kritériá (engine ich počíta z reálnych dát):
//   first_tip       — aspoň 1 odoslaný tip
//   tips_total      — počet odoslaných tipov >= value
//   exact_total     — počet presných výsledkov (tip.points >= exactScore) >= value
//   exact_in_round  — value presných výsledkov v rámci jedného kola
//   create_league   — vytvoril aspoň 1 ligu (League.creatorId)
//   podium          — skončil v TOP 3 aspoň v jednej lige (podľa bodov)
//   total_points    — súčet získaných bodov >= value
//   point_streak    — najdlhšia séria kôl po sebe so ziskom bodu >= value
//   exact_streak    — najdlhšia séria kôl po sebe s presným výsledkom >= value
//   collector       — získal aspoň `value` iných odznakov
//
// NEMERATEĽNÉ (measurable:false) ostávajú ako budúce ciele v locked stave —
// platforma zatiaľ nezbiera dáta na ich vyhodnotenie (čas tipu, šport zápasu,
// dlhé série dní, kurzy, globálny rebríček).

const ACHIEVEMENTS = [
  // ---- merateľné ----
  {
    code: 'first_tip', name: 'Prvý tip',
    description: 'Odoslal si svoj úplne prvý tip na platforme.',
    icon: '✅', rarity: 'common', criteria: 'first_tip', value: 1, measurable: true, sortOrder: 10,
  },
  {
    code: 'create_league', name: 'Zakladateľ',
    description: 'Vytvoril si vlastnú ligu.',
    icon: '🤝', rarity: 'common', criteria: 'create_league', value: 1, measurable: true, sortOrder: 20,
  },
  {
    code: 'tips_25', name: 'Rozbeh',
    description: 'Odoslal si celkovo 25 tipov.',
    icon: '📨', rarity: 'common', criteria: 'tips_total', value: 25, measurable: true, sortOrder: 30,
  },
  {
    code: 'century', name: 'Storočie tipov',
    description: 'Odoslal si celkovo 100 tipov.',
    icon: '💯', rarity: 'rare', criteria: 'tips_total', value: 100, measurable: true, sortOrder: 40,
  },
  {
    code: 'exact_first', name: 'Trefa',
    description: 'Trafil si svoj prvý presný výsledok.',
    icon: '🎯', rarity: 'common', criteria: 'exact_total', value: 1, measurable: true, sortOrder: 50,
  },
  {
    code: 'sharpshooter', name: 'Ostrostrelec',
    description: 'Trafil si 5 presných výsledkov v jednom kole.',
    icon: '🏹', rarity: 'rare', criteria: 'exact_in_round', value: 5, measurable: true, sortOrder: 60,
  },
  {
    code: 'exact_25', name: 'Snajper',
    description: 'Trafil si celkovo 25 presných výsledkov.',
    icon: '🎯', rarity: 'epic', criteria: 'exact_total', value: 25, measurable: true, sortOrder: 70,
  },
  {
    code: 'podium', name: 'Na pódiu',
    description: 'Skončil si v TOP 3 v niektorej lige.',
    icon: '🥉', rarity: 'rare', criteria: 'podium', value: 1, measurable: true, sortOrder: 80,
  },
  {
    code: 'on_fire', name: 'V plameňoch',
    description: '3 kolá po sebe so ziskom aspoň 1 bodu.',
    icon: '🔥', rarity: 'rare', criteria: 'point_streak', value: 3, measurable: true, sortOrder: 84,
  },
  {
    code: 'unbeatable', name: 'Neporaziteľný',
    description: '3 kolá po sebe s aspoň jedným presným výsledkom.',
    icon: '🛡️', rarity: 'epic', criteria: 'exact_streak', value: 3, measurable: true, sortOrder: 86,
  },
  {
    code: 'points_machine', name: 'Bodový stroj',
    description: 'Nazbieral si celkovo 200 bodov.',
    icon: '📈', rarity: 'rare', criteria: 'total_points', value: 200, measurable: true, sortOrder: 88,
  },
  {
    code: 'risk_paid_off', name: 'Risk sa vyplatil',
    description: 'Trafil si celkovo 10 presných výsledkov.',
    icon: '🎰', rarity: 'epic', criteria: 'exact_total', value: 10, measurable: true, sortOrder: 89,
  },
  {
    code: 'collector', name: 'Zberateľ',
    description: 'Získal si aspoň 5 odznakov.',
    icon: '🌟', rarity: 'epic', criteria: 'collector', value: 5, measurable: true, sortOrder: 90,
  },

  // ---- nemerateľné (budúce ciele, ostávajú locked) ----
  {
    code: 'flash_tip', name: 'Bleskový tip',
    description: 'Odtipuj celé kolo do 60 sekúnd od otvorenia.',
    icon: '⚡', rarity: 'epic', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 200,
  },
  {
    code: 'loyal', name: 'Verný tipér',
    description: 'Tipuj 30 dní po sebe bez prestávky.',
    icon: '📅', rarity: 'rare', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 210,
  },
  {
    code: 'season_champion', name: 'Šampión sezóny',
    description: 'Vyhraj oficiálnu sezónu — skonči na 1. mieste.',
    icon: '🏆', rarity: 'legendary', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 220,
  },
  {
    code: 'number_one', name: 'Číslo jeden',
    description: 'Buď na 1. mieste globálneho rebríčka.',
    icon: '👑', rarity: 'legendary', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 230,
  },
  {
    code: 'cold_blooded', name: 'Chladnokrvný',
    description: 'Traf presný výsledok finálového zápasu.',
    icon: '🧊', rarity: 'rare', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 240,
  },
  {
    code: 'football_prophet', name: 'Futbalový prorok',
    description: '100 správnych tipov na futbalové zápasy.',
    icon: '⚽', rarity: 'common', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 244,
  },
  {
    code: 'hockey_expert', name: 'Hokejový expert',
    description: '50 správnych tipov na hokejové zápasy.',
    icon: '🏒', rarity: 'common', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 246,
  },
  {
    code: 'legend', name: 'Legenda',
    description: 'Získaj všetky ostatné odznaky.',
    icon: '✨', rarity: 'legendary', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 250,
  },
];

module.exports = { ACHIEVEMENTS };
// backend/src/utils/team.constants.js
//
// Pevné číselníky pre tímy — aby filter fungoval konzistentne (nie "Anglicko"
// aj "England" aj "UK"). Rozširuj podľa potreby; hodnoty (kódy) sa ukladajú do DB,
// labely sa zobrazujú v UI.

// Športy (pre kluby)
const SPORTS = [
  { code: 'football', label: 'Futbal' },
  { code: 'hockey', label: 'Hokej' },
  { code: 'basketball', label: 'Basketbal' },
  { code: 'handball', label: 'Hádzaná' },
  { code: 'volleyball', label: 'Volejbal' },
  { code: 'tennis', label: 'Tenis' },
  { code: 'other', label: 'Iné' },
];

// Krajiny (pre kluby aj národné tímy). Skratka = kód, label = názov.
const COUNTRIES = [
  { code: 'SK', label: 'Slovensko' },
  { code: 'CZ', label: 'Česko' },
  { code: 'EN', label: 'Anglicko' },
  { code: 'ES', label: 'Španielsko' },
  { code: 'DE', label: 'Nemecko' },
  { code: 'IT', label: 'Taliansko' },
  { code: 'FR', label: 'Francúzsko' },
  { code: 'CA', label: 'Kanada' },
  { code: 'US', label: 'USA' },
  { code: 'SE', label: 'Švédsko' },
  { code: 'FI', label: 'Fínsko' },
  { code: 'RU', label: 'Rusko' },
  { code: 'CH', label: 'Švajčiarsko' },
  { code: 'AT', label: 'Rakúsko' },
  { code: 'PL', label: 'Poľsko' },
  { code: 'NL', label: 'Holandsko' },
  { code: 'PT', label: 'Portugalsko' },
  { code: 'other', label: 'Iné / medzinárodné' },
];

const SPORT_CODES = SPORTS.map((s) => s.code);
const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

const sportLabel = (code) => (SPORTS.find((s) => s.code === code) || {}).label || code || '';
const countryLabel = (code) => (COUNTRIES.find((c) => c.code === code) || {}).label || code || '';

module.exports = { SPORTS, COUNTRIES, SPORT_CODES, COUNTRY_CODES, sportLabel, countryLabel };

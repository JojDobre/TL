'use strict';

require('dotenv').config();

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.TSDB_API_KEY;
const RATE_LIMIT_MS = parseInt(process.env.TSDB_DELAY_MS || '650', 10);
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const PROGRESS_FILE = path.join(__dirname, '.tsdb-progress.json');

// Ligy, ktoré sa spracujú ako prvé — ich tímy majú prednosť pred pohármi
const PRIORITY_LEAGUES = [
  'English Premier League',
  'Spanish La Liga',
  'German Bundesliga',
  'Italian Serie A',
  'French Ligue 1',
  'Slovak First Football League',
  'Czech First League',
  'Polish Ekstraklasa',
];

// Ligy, ktoré preskakujeme úplne (ženy, mládež, rezervy, futsal, playoff)
const SKIP_LEAGUE_RX = new RegExp(
  [
    '^_',                       // _No League, _Defunct Soccer Teams
    'women', 'femini', 'femenil', 'frauen', 'dames', 'ladies',
    'u1[5-9]\\b', 'u2[01]\\b', 'under-1[579]', 'under-2[01]',
    'youth', 'junior', 'academy',
    'reserve', 'b-team',
    'futsal', 'indoor', 'beach',
    'playoff', 'play-off', 'relegation', 'promotion',
    'friendl', 'summer series', 'all-star',
    // reprezentácie / medzinárodné súťaže
    'world cup', 'qualifying', 'nations league', 'nations cup',
    'european championship', 'copa america', 'gold cup', 'asian cup',
    'african cup', 'cup of nations', 'olympic', 'finalissima',
    'confederations cup', 'arab cup', 'baltic cup', 'saff championship',
    'asean championship', 'cafa nations', 'cosafa', 'concacaf series',
    'pan american games', 'asian games', 'pacific games', 'shebelieves',
  ].join('|'),
  'i'
);

const COUNTRY_MAP = {
  Afghanistan: 'AF', Albania: 'AL', Algeria: 'DZ', Andorra: 'AD', Angola: 'AO',
  Anguilla: 'AI', 'Antigua and Barbuda': 'AG', Argentina: 'AR', Armenia: 'AM',
  Aruba: 'AW', Australia: 'AU', Austria: 'AT', Azerbaijan: 'AZ', Bahamas: 'BS',
  Bahrain: 'BH', Bangladesh: 'BD', Barbados: 'BB', Belarus: 'BY', Belgium: 'BE',
  Belize: 'BZ', Benin: 'BJ', Bermuda: 'BM', Bhutan: 'BT', Bolivia: 'BO',
  'Bosnia and Herzegovina': 'BA', Botswana: 'BW', Brazil: 'BR', Brunei: 'BN',
  Bulgaria: 'BG', 'Burkina Faso': 'BF', Burundi: 'BI', Cambodia: 'KH',
  Cameroon: 'CM', Canada: 'CA', 'Cape Verde': 'CV', 'Cayman Islands': 'KY',
  'Central African Republic': 'CF', Chad: 'TD', Chile: 'CL', China: 'CN',
  'Chinese Taipei': 'other', Colombia: 'CO', Comoros: 'KM', 'Cook Islands': 'CK',
  'Costa Rica': 'CR', Croatia: 'HR', Cuba: 'CU', 'Curaçao': 'CW', Curacao: 'CW',
  Cyprus: 'CY', Czechia: 'CZ', 'Czech Republic': 'CZ',
  'DR Congo': 'CD', 'Democratic Republic of the Congo': 'CD', Congo: 'CG',
  Denmark: 'DK', Djibouti: 'DJ', Dominica: 'DM', 'Dominican Republic': 'DO',
  Ecuador: 'EC', Egypt: 'EG', 'El Salvador': 'SV', England: 'EN',
  'Equatorial Guinea': 'GQ', Eritrea: 'ER', Estonia: 'EE', Eswatini: 'SZ',
  Ethiopia: 'ET', 'Faroe Islands': 'FO', Fiji: 'FJ', Finland: 'FI', France: 'FR',
  Gabon: 'GA', Gambia: 'GM', Georgia: 'GE', Germany: 'DE', Ghana: 'GH',
  Gibraltar: 'GI', Greece: 'GR', Grenada: 'GD', Guam: 'GU', Guatemala: 'GT',
  Guinea: 'GN', 'Guinea-Bissau': 'GW', Guyana: 'GY', Haiti: 'HT', Honduras: 'HN',
  'Hong Kong': 'HK', Hungary: 'HU', Iceland: 'IS', India: 'IN', Indonesia: 'ID',
  Iran: 'IR', Iraq: 'IQ', Ireland: 'IE', Israel: 'IL', Italy: 'IT',
  'Ivory Coast': 'CI', Jamaica: 'JM', Japan: 'JP', Jordan: 'JO', Kazakhstan: 'KZ',
  Kenya: 'KE', Kiribati: 'KI', Kosovo: 'XK', Kuwait: 'KW', Kyrgyzstan: 'KG',
  Laos: 'LA', Latvia: 'LV', Lebanon: 'LB', Liberia: 'LR', Libya: 'LY',
  Liechtenstein: 'LI', Lithuania: 'LT', Luxembourg: 'LU', Macau: 'MO',
  Macao: 'MO', Madagascar: 'MG', Malawi: 'MW', Malaysia: 'MY', Maldives: 'MV',
  Mali: 'ML', Malta: 'MT', 'Marshall Islands': 'MH', Mauritania: 'MR',
  Mauritius: 'MU', Mexico: 'MX', Micronesia: 'FM', Moldova: 'MD', Monaco: 'MC',
  Mongolia: 'MN', Montenegro: 'ME', Montserrat: 'MS', Morocco: 'MA',
  Mozambique: 'MZ', Myanmar: 'MM', Namibia: 'NA', Nauru: 'NR', Nepal: 'NP',
  Netherlands: 'NL', 'New Caledonia': 'NC', 'New Zealand': 'NZ',
  Nicaragua: 'NI', Niger: 'NE', Nigeria: 'NG', Niue: 'NU',
  'North Korea': 'KP', 'North Macedonia': 'MK', Macedonia: 'MK',
  'Northern Ireland': 'NIR', Norway: 'NO', Oman: 'OM', Pakistan: 'PK',
  Palau: 'PW', Palestine: 'PS', Panama: 'PA', 'Papua New Guinea': 'PG',
  Paraguay: 'PY', Peru: 'PE', Philippines: 'PH', Poland: 'PL', Portugal: 'PT',
  'Puerto Rico': 'PR', Qatar: 'QA', Romania: 'RO', Russia: 'RU', Rwanda: 'RW',
  'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC',
  'Saint Vincent and the Grenadines': 'VC', Samoa: 'WS', 'American Samoa': 'AS',
  'San Marino': 'SM', 'Sao Tome and Principe': 'ST', 'Saudi Arabia': 'SA',
  Scotland: 'SCO', Senegal: 'SN', Serbia: 'RS', Seychelles: 'SC',
  'Sierra Leone': 'SL', Singapore: 'SG', Slovakia: 'SK', Slovenia: 'SI',
  'Solomon Islands': 'SB', Somalia: 'SO', 'South Africa': 'ZA',
  'South Korea': 'KR', 'South Sudan': 'SS', Spain: 'ES', 'Sri Lanka': 'LK',
  Sudan: 'SD', Suriname: 'SR', Sweden: 'SE', Switzerland: 'CH', Syria: 'SY',
  Taiwan: 'other', Tajikistan: 'TJ', Tanzania: 'TZ', Thailand: 'TH',
  'Timor-Leste': 'TL', 'East Timor': 'TL', Togo: 'TG', Tonga: 'TO',
  'Trinidad and Tobago': 'TT', Tunisia: 'TN', Turkey: 'TR', Turkmenistan: 'TM',
  'Turks and Caicos Islands': 'TC', Tuvalu: 'TV', Uganda: 'UG', Ukraine: 'UA',
  'United Arab Emirates': 'AE', 'United Kingdom': 'GB',
  'United States': 'US', USA: 'US', Uruguay: 'UY', Uzbekistan: 'UZ',
  Vanuatu: 'VU', 'Vatican City': 'VA', Venezuela: 'VE', Vietnam: 'VN',
  'British Virgin Islands': 'VG', 'US Virgin Islands': 'VI', Wales: 'WA',
  Yemen: 'YE', Zambia: 'ZM', Zimbabwe: 'ZW', Tahiti: 'PF',
  'French Polynesia': 'PF', 'The Netherlands': 'NL',
  Swaziland: 'SZ',            
  Lesotho: 'LS',                
  'United States Virgin Islands': 'VI',
  Jersey: 'other',
  Bonaire: 'other',
  'French Guiana': 'other',
  Guadeloupe: 'other',
  Martinique: 'other',
  Mayotte: 'other',
  Reunion: 'other',
  'Saint-Martin': 'other',
  'Northern Mariana Islands': 'other',
  Worldwide: 'other',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(pathname) {
  return new Promise((resolve, reject) => {
    https
      .get(`${BASE}/${pathname}`, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            reject(new Error('Neplatný JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

function loadProgress() {
  try {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveProgress(done) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...done]));
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapTeam(t) {
  return {
    name: (t.strTeam || '').trim(),
    logo: t.strBadge || null,
    country: COUNTRY_MAP[(t.strCountry || '').trim()] || 'other',
    sport: 'football',
    scope: 'global',
    teamType: 'club',
    externalId: String(t.idTeam),
    shortName: t.strTeamShort || null,
    alternateName: t.strTeamAlternate || null,
    foundedYear: toInt(t.intFormedYear),
    stadium: t.strStadium || null,
    stadiumCapacity: toInt(t.intStadiumCapacity),
    city: t.strLocation || null,
    website: t.strWebsite || null,
    description: t.strDescriptionEN || null,
  };
}

async function run({ dryRun, reset }) {
  if (!API_KEY) throw new Error('Chýba TSDB_API_KEY');

  const { Team } = require('../models');

  if (reset && fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  const done = loadProgress();

  const { leagues } = await get('all_leagues.php');
  await sleep(RATE_LIMIT_MS);

  const soccer = (leagues || [])
    .filter((l) => l.strSport === 'Soccer')
    .filter((l) => !SKIP_LEAGUE_RX.test(l.strLeague));

  // priorita: 8 hlavných líg najprv, zvyšok v pôvodnom poradí
  const prio = [];
  const rest = [];
  for (const l of soccer) {
    (PRIORITY_LEAGUES.includes(l.strLeague) ? prio : rest).push(l);
  }
  prio.sort(
    (a, b) => PRIORITY_LEAGUES.indexOf(a.strLeague) - PRIORITY_LEAGUES.indexOf(b.strLeague)
  );
  const queue = [...prio, ...rest];

  const missingPrio = PRIORITY_LEAGUES.filter(
    (n) => !prio.some((l) => l.strLeague === n)
  );
  if (missingPrio.length) {
    console.log('⚠ Prioritné ligy nenájdené v API:', missingPrio.join(', '));
  }

  console.log(`Líg na spracovanie: ${queue.length} (prioritných: ${prio.length})`);
  console.log(`Už hotových: ${done.size}\n`);

  // externalId, ktoré sme už v tomto behu zapísali — prvá liga vyhráva
  const seen = new Set();
  const stats = { added: 0, updated: 0, skippedTeam: 0, failedLeagues: [] };
  const unmappedCountries = new Set();

  let i = 0;
  for (const league of queue) {
    i++;
    if (done.has(league.idLeague)) continue;

    let teams;
    try {
      const res = await get(`search_all_teams.php?l=${encodeURIComponent(league.strLeague)}`);
      teams = res.teams || [];
    } catch (e) {
      stats.failedLeagues.push(`${league.strLeague}: ${e.message}`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }
    await sleep(RATE_LIMIT_MS);

    let a = 0;
    let u = 0;

    for (const t of teams) {
      if (t.strSport !== 'Soccer') continue;
      if (t.strGender && t.strGender !== 'Male') continue;

      const payload = mapTeam(t);
      if (!payload.name || !payload.externalId) continue;

      if (seen.has(payload.externalId)) {
        stats.skippedTeam++;
        continue;
      }
      seen.add(payload.externalId);

      const raw = (t.strCountry || '').trim();
      if (raw && !COUNTRY_MAP[raw]) unmappedCountries.add(raw);

      if (dryRun) continue;

      const [, created] = await Team.findOrCreate({
        where: { externalId: payload.externalId },
        defaults: payload,
      });
      if (created) {
        a++;
      } else {
        await Team.update(payload, { where: { externalId: payload.externalId } });
        u++;
      }
    }

    stats.added += a;
    stats.updated += u;

    if (!dryRun) {
      done.add(league.idLeague);
      saveProgress(done);
    }

    console.log(
      `[${String(i).padStart(3)}/${queue.length}] ${league.strLeague} — ${teams.length} tímov (+${a} ~${u})`
    );
  }

  console.log('\n──────────────────────────────');
  console.log(`Pridané      : ${stats.added}`);
  console.log(`Aktualizované: ${stats.updated}`);
  console.log(`Duplicity    : ${stats.skippedTeam}`);
  console.log(`Zlyhané ligy : ${stats.failedLeagues.length}`);
  console.log('──────────────────────────────');

  if (unmappedCountries.size) {
    console.log('\n⚠ Nenamapované krajiny (uložené ako "other"):');
    [...unmappedCountries].sort().forEach((c) => console.log(`  ${c}`));
  }
  if (stats.failedLeagues.length) {
    console.log('\nZlyhané ligy:');
    stats.failedLeagues.forEach((f) => console.log(`  ${f}`));
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const db = require('../models');

  db.sequelize
    .authenticate()
    .then(() => run({ dryRun: args.includes('--dry-run'), reset: args.includes('--reset') }))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Zlyhalo:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
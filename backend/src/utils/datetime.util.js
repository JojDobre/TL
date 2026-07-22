// backend/src/utils/datetime.util.js
//
// Jednotné formátovanie dátumu a času pre celú aplikáciu.
//
// PREČO TENTO SÚBOR EXISTUJE:
// Časy sa v DB ukladajú v UTC. Keď ich šablóna vykreslí na SERVERI cez
// `new Date(x).toLocaleString('sk-SK')`, použije sa časová zóna servera —
// a tá je na VPS spravidla UTC. Používateľ tak videl čas posunutý o 2 hodiny
// (v lete) oproti tomu, čo mu ukázal klientsky JS (ten používa zónu prehliadača).
//
// Riešenie: všetko server-rendered formátovanie ide cez tieto funkcie, ktoré
// vždy explicitne prepínajú do APP_TZ (Europe/Bratislava). Tým je jedno,
// v akej zóne beží server — výsledok je vždy slovenský čas.
//
// Zóna sa dá prepísať cez APP_TZ v .env (napr. pre inú krajinu).

const TZ = process.env.APP_TZ || 'Europe/Bratislava';
const LOCALE = 'sk-SK';

// Bezpečný prevod vstupu na Date. Vracia null pre prázdne/neplatné hodnoty,
// aby šablóny mohli zobraziť "—" namiesto "Invalid Date".
function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "15. 8. 2026"
function fmtDate(value, fallback = '—') {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(LOCALE, { timeZone: TZ });
}

// "15. 8." — krátky tvar bez roku (pre zoznamy, kde rok nie je podstatný)
function fmtDateShort(value, fallback = '—') {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(LOCALE, { timeZone: TZ, day: 'numeric', month: 'short' });
}

// "18:00"
function fmtTime(value, fallback = '—') {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleTimeString(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

// "15. 8. 2026, 18:00"
function fmtDateTime(value, fallback = '—') {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString(LOCALE, { timeZone: TZ });
}

// "15. 8. · 18:00" — kompaktný tvar používaný v kartách zápasov
function fmtDateTimeShort(value, fallback = '—') {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(LOCALE, { timeZone: TZ, day: 'numeric', month: 'short' })
    + ' · '
    + d.toLocaleTimeString(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

// "15. augusta 2026" — dlhý tvar (profil: "člen od ...")
function fmtDateLong(value, fallback = '—') {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(LOCALE, { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
}

// Hodnota pre <input type="datetime-local"> ("2026-08-15T18:00") v slovenskom
// čase. Bez tohto by editačné formuláre predvyplnili UTC čas a používateľ by
// pri uložení nechtiac posunul zápas.
function toLocalInputValue(value) {
  const d = toDate(value);
  if (!d) return '';
  // en-CA dáva ISO-like poradie (YYYY-MM-DD), hodiny berieme v 24h formáte
  const datePart = d.toLocaleDateString('en-CA', { timeZone: TZ });
  const timePart = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart}T${timePart}`;
}

// Posun zóny (v minútach) pre daný okamih — kladné číslo znamená "pred UTC".
// Používa sa pri parsovaní vstupu z formulárov (viď parseLocalInput).
function tzOffsetMinutes(at = new Date()) {
  // Trik: naformátujeme ten istý okamih ako keby bol v UTC a v našej zóne,
  // rozdiel oboch je práve hľadaný posun (rieši aj letný/zimný čas).
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(at.toLocaleString('en-US', { timeZone: TZ }));
  return Math.round((local - utc) / 60000);
}

// Parsuje hodnotu z <input type="datetime-local"> ("2026-08-15T18:00") ako
// SLOVENSKÝ čas a vracia korektný Date (v UTC pod kapotou).
//
// Bez tejto funkcie Node interpretuje reťazec bez zóny v časovej zóne servera:
// na VPS bežiacom v UTC by sa "18:00" uložilo ako 18:00 UTC = 20:00 SK.
// Hodnoty, ktoré už zónu obsahujú (končia na Z alebo +02:00), necháme tak.
function parseLocalInput(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const str = String(value).trim();
  // Už obsahuje zónu → štandardný parse je správny
  if (/[zZ]$/.test(str) || /[+-]\d{2}:?\d{2}$/.test(str)) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Očakávame "YYYY-MM-DDTHH:mm" (prípadne so sekundami alebo medzerou)
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const [, y, mo, da, h, mi, s] = m;
  // Najprv predpokladajme, že zadané čísla sú UTC…
  const asUtc = Date.UTC(+y, +mo - 1, +da, +h, +mi, +(s || 0));
  // …a potom odčítajme skutočný posun zóny pre daný okamih (rieši DST).
  const offset = tzOffsetMinutes(new Date(asUtc));
  return new Date(asUtc - offset * 60000);
}

module.exports = {
  TZ,
  fmtDate,
  fmtDateShort,
  fmtTime,
  fmtDateTime,
  fmtDateTimeShort,
  fmtDateLong,
  toLocalInputValue,
  parseLocalInput,
  tzOffsetMinutes,
};

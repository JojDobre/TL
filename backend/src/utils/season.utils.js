// backend/src/utils/season.utils.js
//
// Spoločná logika pre sezóny: stav (upcoming/active/ended) a prístup
// (kto smie vidieť dáta súkromnej sezóny). Používa sa naprieč stránkami aj API.

// Stav sezóny z dátumov + ručného ukončenia.
//  'ended'   — ručne ukončená alebo po endDate (uzamknutá)
//  'upcoming'— ešte nezačala (pred startDate)
//  'active'  — prebieha
function seasonStatus(season) {
  if (season.ended) return 'ended';
  const now = new Date();
  if (season.endDate && new Date(season.endDate) < now) return 'ended';
  if (season.startDate && new Date(season.startDate) > now) return 'upcoming';
  return 'active';
}

// Je sezóna „uzamknutá" (nedá sa v nej nič meniť)? = ended.
function isSeasonLocked(season) {
  return seasonStatus(season) === 'ended';
}

// Smie daný používateľ vidieť OBSAH sezóny (ligy, rebríčky)?
//  - verejná (bez hesla) → áno, ktokoľvek
//  - súkromná (hasPassword) → len členovia (a tvorca/admin)
// Vyžaduje, aby volajúci dodal, či je užívateľ člen (isMember) a či je admin.
function canViewSeasonContent(season, { isMember, isCreator, isGlobalAdmin } = {}) {
  if (!season.hasPassword) return true;       // verejná
  return !!(isMember || isCreator || isGlobalAdmin);
}

module.exports = { seasonStatus, isSeasonLocked, canViewSeasonContent };

// backend/src/seeds/achievements.def.js
//
// Centrálna definícia všetkých odznakov. Slúži ako zdroj pre seed (naplnenie
// tabuľky `achievements`) aj ako referencia pre engine (achievement.engine.js).
//
// Polia:
//  - code: strojový identifikátor (jedinečný)
//  - criteria: druh kritéria, ktoré engine vyhodnocuje
//  - value: cieľová hodnota (pri nemerateľných 0)
//  - sport: (voliteľné) pri kritériu 'sport_correct' určuje šport ('football'/'hockey')
//  - rank: (voliteľné) pri kritériu 'podium'/'podium_official' hranica umiestnenia
//  - rarityKind: (voliteľné) pri kritériu 'rarity_count' ktorá rarity sa počíta
//  - measurable: či sa dá teraz vyhodnotiť z dostupných dát
//
// MERATEĽNÉ kritériá (engine ich počíta z reálnych dát):
//   first_tip        - aspoň 1 odoslaný tip
//   tips_total       - počet odoslaných tipov >= value
//   exact_total      - počet presných výsledkov (tip.points >= exactScore) >= value
//   exact_in_round   - value presných výsledkov v rámci jedného kola
//   perfect_round    - trafil VSETKY výsledky v kole (min. `value` zápasov v kole)
//   total_points     - súčet všetkých získaných bodov >= value
//   official_points  - súčet bodov z oficiálnych líg (League.type='official') >= value
//   point_streak     - najdlhšia séria kôl po sebe so ziskom bodu >= value
//   exact_streak     - najdlhšia séria kôl po sebe s presným výsledkom >= value
//   sport_correct    - počet správnych (bodovaných) tipov v danom športe >= value
//   wrong_tips       - počet vyhodnotených tipov s 0 bodmi >= value
//   daily_streak     - počet po sebe idúcich dní s aspoň jedným tipom >= value
//   podium           - skončil v TOP `rank` v niektorej UKONCENEJ lige (podľa bodov)
//   podium_official  - skončil v TOP `rank` v niektorej UKONCENEJ OFICIALNEJ lige
//   league_winner    - vyhral (1. miesto) UKONCENU oficiálnu ligu
//   create_league    - vytvoril aspoň 1 ligu/sezónu (League.creatorId)
//   end_competition  - ukončil vlastnú ligu/sezónu (ended:true)
//   use_template     - vytvoril ligu naklonovaním šablóny (League.templateId)
//   edit_profile     - vyplnil si meno/priezvisko alebo bio
//   set_avatar       - nastavil si profilovú fotku
//   collector        - získal aspoň `value` iných odznakov
//   rarity_count     - získal aspoň `value` odznakov rarity `rarityKind`
//
// NEMERATEĽNE (measurable:false) ostávajú ako budúce ciele v locked stave -
// platforma zatiaľ nezbiera dáta na ich vyhodnotenie (vlastný zápas nemá autora,
// globálne 1. miesto sa netrackuje historicky, vyhodnotenie zápasu per-user).

const ACHIEVEMENTS = [
  // --------------------------- Počet tipov ---------------------------
  { code: 'first_tip', name: 'Prvý tip', description: 'Odoslal si svoj úplne prvý tip na platforme.', icon: '✅', rarity: 'common', criteria: 'first_tip', value: 1, measurable: true, sortOrder: 10 },
  { code: 'tips_25', name: 'Rozbeh', description: 'Odoslal si celkovo 25 tipov.', icon: '📨', rarity: 'common', criteria: 'tips_total', value: 25, measurable: true, sortOrder: 11 },
  { code: 'tips_100', name: 'Storočie tipov', description: 'Odoslal si celkovo 100 tipov.', icon: '💯', rarity: 'rare', criteria: 'tips_total', value: 100, measurable: true, sortOrder: 12 },
  { code: 'tips_500', name: 'Tipovací maratón', description: 'Odoslal si celkovo 500 tipov.', icon: '📬', rarity: 'rare', criteria: 'tips_total', value: 500, measurable: true, sortOrder: 13 },
  { code: 'tips_1000', name: 'Tisícka', description: 'Odoslal si celkovo 1000 tipov.', icon: '📮', rarity: 'epic', criteria: 'tips_total', value: 1000, measurable: true, sortOrder: 14 },
  { code: 'tips_5000', name: 'Tipovací veterán', description: 'Odoslal si celkovo 5000 tipov.', icon: '🗳️', rarity: 'epic', criteria: 'tips_total', value: 5000, measurable: true, sortOrder: 15 },
  { code: 'tips_10000', name: 'Tipovacia legenda', description: 'Odoslal si celkovo 10 000 tipov.', icon: '🏛️', rarity: 'legendary', criteria: 'tips_total', value: 10000, measurable: true, sortOrder: 16 },

  // --------------------------- Presný výsledok ---------------------------
  { code: 'exact_first', name: 'Trefa', description: 'Trafil si svoj prvý presný výsledok.', icon: '🎯', rarity: 'common', criteria: 'exact_total', value: 1, measurable: true, sortOrder: 20 },
  { code: 'exact_5', name: 'Pästička', description: 'Trafil si celkovo 5 presných výsledkov.', icon: '🎯', rarity: 'common', criteria: 'exact_total', value: 5, measurable: true, sortOrder: 21 },
  { code: 'exact_10', name: 'Risk sa vyplatil', description: 'Trafil si celkovo 10 presných výsledkov.', icon: '🎰', rarity: 'rare', criteria: 'exact_total', value: 10, measurable: true, sortOrder: 22 },
  { code: 'exact_25', name: 'Snajper', description: 'Trafil si celkovo 25 presných výsledkov.', icon: '🎯', rarity: 'rare', criteria: 'exact_total', value: 25, measurable: true, sortOrder: 23 },
  { code: 'exact_50', name: 'Odstreľovač', description: 'Trafil si celkovo 50 presných výsledkov.', icon: '🏹', rarity: 'epic', criteria: 'exact_total', value: 50, measurable: true, sortOrder: 24 },
  { code: 'exact_100', name: 'Presná muška', description: 'Trafil si celkovo 100 presných výsledkov.', icon: '🎯', rarity: 'epic', criteria: 'exact_total', value: 100, measurable: true, sortOrder: 25 },
  { code: 'exact_250', name: 'Majster presnosti', description: 'Trafil si celkovo 250 presných výsledkov.', icon: '🏹', rarity: 'epic', criteria: 'exact_total', value: 250, measurable: true, sortOrder: 26 },
  { code: 'exact_500', name: 'Veštec', description: 'Trafil si celkovo 500 presných výsledkov.', icon: '🔮', rarity: 'legendary', criteria: 'exact_total', value: 500, measurable: true, sortOrder: 27 },
  { code: 'exact_1000', name: 'Vševidiaci', description: 'Trafil si celkovo 1000 presných výsledkov.', icon: '👁️', rarity: 'legendary', criteria: 'exact_total', value: 1000, measurable: true, sortOrder: 28 },

  // ----------------------- Presné výsledky v jednom kole -----------------------
  { code: 'sharpshooter', name: 'Ostrostrelec', description: 'Trafil si 5 presných výsledkov v jednom kole.', icon: '🏹', rarity: 'rare', criteria: 'exact_in_round', value: 5, measurable: true, sortOrder: 30 },
  { code: 'perfect_round', name: 'Dokonalé kolo', description: 'Trafil si všetky výsledky v kole (min. 5 zápasov).', icon: '🌟', rarity: 'legendary', criteria: 'perfect_round', value: 5, measurable: true, sortOrder: 31 },

  // --------------------------- Rebríček (po skončení ligy) ---------------------------
  { code: 'podium', name: 'Na pódiu', description: 'Skončil si v TOP 3 v niektorej lige (po jej ukončení).', icon: '🥉', rarity: 'rare', criteria: 'podium', value: 1, rank: 3, measurable: true, sortOrder: 40 },
  { code: 'top10', name: 'Prvá desiatka', description: 'Skončil si v TOP 10 v niektorej lige (po jej ukončení).', icon: '🔟', rarity: 'common', criteria: 'podium', value: 1, rank: 10, measurable: true, sortOrder: 41 },
  { code: 'top10_official', name: 'Desiatka medzi elitou', description: 'Skončil si v TOP 10 v oficiálnej lige.', icon: '🎖️', rarity: 'rare', criteria: 'podium_official', value: 1, rank: 10, measurable: true, sortOrder: 42 },
  { code: 'top5_official', name: 'Elitná päťka', description: 'Skončil si v TOP 5 v oficiálnej lige.', icon: '🏅', rarity: 'epic', criteria: 'podium_official', value: 1, rank: 5, measurable: true, sortOrder: 43 },
  { code: 'top3_official', name: 'Oficiálne pódium', description: 'Skončil si v TOP 3 v oficiálnej lige.', icon: '🥈', rarity: 'epic', criteria: 'podium_official', value: 1, rank: 3, measurable: true, sortOrder: 44 },
  { code: 'season_champion', name: 'Šampión ligy', description: 'Vyhral si oficiálnu ligu - skončil si na 1. mieste.', icon: '🏆', rarity: 'legendary', criteria: 'league_winner', value: 1, measurable: true, sortOrder: 45 },
  { code: 'number_one', name: 'Číslo jeden', description: 'Buď na chvíľu na 1. mieste globálneho rebríčka.', icon: '👑', rarity: 'legendary', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 46 },

  // --------------------------- Série (bodové) ---------------------------
  { code: 'on_fire', name: 'V plameňoch', description: '3 kolá po sebe so ziskom aspoň 1 bodu.', icon: '🔥', rarity: 'rare', criteria: 'point_streak', value: 3, measurable: true, sortOrder: 50 },
  { code: 'point_streak_5', name: 'Rozpálený', description: '5 kôl po sebe so ziskom aspoň 1 bodu.', icon: '🔥', rarity: 'rare', criteria: 'point_streak', value: 5, measurable: true, sortOrder: 51 },
  { code: 'point_streak_10', name: 'Nezastaviteľný', description: '10 kôl po sebe so ziskom aspoň 1 bodu.', icon: '🔥', rarity: 'epic', criteria: 'point_streak', value: 10, measurable: true, sortOrder: 52 },
  { code: 'point_streak_25', name: 'Živelná pohroma', description: '25 kôl po sebe so ziskom aspoň 1 bodu.', icon: '🌋', rarity: 'legendary', criteria: 'point_streak', value: 25, measurable: true, sortOrder: 53 },

  // --------------------------- Série (presné výsledky) ---------------------------
  { code: 'unbeatable', name: 'Neporaziteľný', description: '3 kolá po sebe s aspoň jedným presným výsledkom.', icon: '🛡️', rarity: 'epic', criteria: 'exact_streak', value: 3, measurable: true, sortOrder: 55 },
  { code: 'exact_streak_5', name: 'Neomylný', description: '5 kôl po sebe s aspoň jedným presným výsledkom.', icon: '🛡️', rarity: 'epic', criteria: 'exact_streak', value: 5, measurable: true, sortOrder: 56 },
  { code: 'exact_streak_10', name: 'Prorocká séria', description: '10 kôl po sebe s aspoň jedným presným výsledkom.', icon: '🛡️', rarity: 'legendary', criteria: 'exact_streak', value: 10, measurable: true, sortOrder: 57 },
  { code: 'exact_streak_25', name: 'Absolútny veštec', description: '25 kôl po sebe s aspoň jedným presným výsledkom.', icon: '🔱', rarity: 'legendary', criteria: 'exact_streak', value: 25, measurable: true, sortOrder: 58 },

  // --------------------------- Tipy podľa športu ---------------------------
  { code: 'football_10', name: 'Futbalový nováčik', description: '10 správnych tipov na futbalové zápasy.', icon: '⚽', rarity: 'common', criteria: 'sport_correct', sport: 'football', value: 10, measurable: true, sortOrder: 60 },
  { code: 'football_20', name: 'Futbalový fanúšik', description: '20 správnych tipov na futbalové zápasy.', icon: '⚽', rarity: 'common', criteria: 'sport_correct', sport: 'football', value: 20, measurable: true, sortOrder: 61 },
  { code: 'football_50', name: 'Futbalový znalec', description: '50 správnych tipov na futbalové zápasy.', icon: '⚽', rarity: 'rare', criteria: 'sport_correct', sport: 'football', value: 50, measurable: true, sortOrder: 62 },
  { code: 'football_100', name: 'Futbalový prorok', description: '100 správnych tipov na futbalové zápasy.', icon: '⚽', rarity: 'epic', criteria: 'sport_correct', sport: 'football', value: 100, measurable: true, sortOrder: 63 },
  { code: 'football_500', name: 'Futbalová legenda', description: '500 správnych tipov na futbalové zápasy.', icon: '⚽', rarity: 'legendary', criteria: 'sport_correct', sport: 'football', value: 500, measurable: true, sortOrder: 64 },
  { code: 'hockey_10', name: 'Hokejový nováčik', description: '10 správnych tipov na hokejové zápasy.', icon: '🏒', rarity: 'common', criteria: 'sport_correct', sport: 'hockey', value: 10, measurable: true, sortOrder: 65 },
  { code: 'hockey_20', name: 'Hokejový fanúšik', description: '20 správnych tipov na hokejové zápasy.', icon: '🏒', rarity: 'common', criteria: 'sport_correct', sport: 'hockey', value: 20, measurable: true, sortOrder: 66 },
  { code: 'hockey_50', name: 'Hokejový expert', description: '50 správnych tipov na hokejové zápasy.', icon: '🏒', rarity: 'rare', criteria: 'sport_correct', sport: 'hockey', value: 50, measurable: true, sortOrder: 67 },
  { code: 'hockey_100', name: 'Hokejový prorok', description: '100 správnych tipov na hokejové zápasy.', icon: '🏒', rarity: 'epic', criteria: 'sport_correct', sport: 'hockey', value: 100, measurable: true, sortOrder: 68 },
  { code: 'hockey_500', name: 'Hokejová legenda', description: '500 správnych tipov na hokejové zápasy.', icon: '🏒', rarity: 'legendary', criteria: 'sport_correct', sport: 'hockey', value: 500, measurable: true, sortOrder: 69 },

  // --------------------------- Nesprávne tipy ---------------------------
  { code: 'wrong_10', name: 'Smoliar', description: '10 nesprávnych tipov (0 bodov).', icon: '🙈', rarity: 'common', criteria: 'wrong_tips', value: 10, measurable: true, sortOrder: 70 },
  { code: 'wrong_20', name: 'Vedľa', description: '20 nesprávnych tipov (0 bodov).', icon: '🙈', rarity: 'common', criteria: 'wrong_tips', value: 20, measurable: true, sortOrder: 71 },
  { code: 'wrong_50', name: 'Nešťastná ruka', description: '50 nesprávnych tipov (0 bodov).', icon: '🃏', rarity: 'rare', criteria: 'wrong_tips', value: 50, measurable: true, sortOrder: 72 },
  { code: 'wrong_100', name: 'Kráľ omylu', description: '100 nesprávnych tipov (0 bodov).', icon: '🤡', rarity: 'rare', criteria: 'wrong_tips', value: 100, measurable: true, sortOrder: 73 },
  { code: 'wrong_500', name: 'Legendárny smoliar', description: '500 nesprávnych tipov (0 bodov).', icon: '💀', rarity: 'epic', criteria: 'wrong_tips', value: 500, measurable: true, sortOrder: 74 },

  // --------------------------- Body (celkovo) ---------------------------
  { code: 'points_100', name: 'Prvá stovka', description: 'Nazbieral si celkovo 100 bodov.', icon: '📈', rarity: 'common', criteria: 'total_points', value: 100, measurable: true, sortOrder: 80 },
  { code: 'points_machine', name: 'Bodový stroj', description: 'Nazbieral si celkovo 200 bodov.', icon: '📈', rarity: 'common', criteria: 'total_points', value: 200, measurable: true, sortOrder: 81 },
  { code: 'points_500', name: 'Päťsto bodov', description: 'Nazbieral si celkovo 500 bodov.', icon: '📊', rarity: 'rare', criteria: 'total_points', value: 500, measurable: true, sortOrder: 82 },
  { code: 'points_1000', name: 'Tisíc bodov', description: 'Nazbieral si celkovo 1000 bodov.', icon: '📊', rarity: 'rare', criteria: 'total_points', value: 1000, measurable: true, sortOrder: 83 },
  { code: 'points_2000', name: 'Dvetisíc bodov', description: 'Nazbieral si celkovo 2000 bodov.', icon: '📊', rarity: 'epic', criteria: 'total_points', value: 2000, measurable: true, sortOrder: 84 },
  { code: 'points_5000', name: 'Bodový magnát', description: 'Nazbieral si celkovo 5000 bodov.', icon: '💰', rarity: 'epic', criteria: 'total_points', value: 5000, measurable: true, sortOrder: 85 },
  { code: 'points_10000', name: 'Bodový kráľ', description: 'Nazbieral si celkovo 10 000 bodov.', icon: '👑', rarity: 'legendary', criteria: 'total_points', value: 10000, measurable: true, sortOrder: 86 },

  // --------------------------- Body (oficiálne ligy/sezóny) ---------------------------
  { code: 'off_points_100', name: 'Oficiálny nováčik', description: 'Nazbieral si 100 bodov v oficiálnej lige/sezóne.', icon: '🎖️', rarity: 'common', criteria: 'official_points', value: 100, measurable: true, sortOrder: 90 },
  { code: 'off_points_200', name: 'Oficiálny hráč', description: 'Nazbieral si 200 bodov v oficiálnej lige/sezóne.', icon: '🎖️', rarity: 'rare', criteria: 'official_points', value: 200, measurable: true, sortOrder: 91 },
  { code: 'off_points_500', name: 'Oficiálny bojovník', description: 'Nazbieral si 500 bodov v oficiálnej lige/sezóne.', icon: '🏅', rarity: 'rare', criteria: 'official_points', value: 500, measurable: true, sortOrder: 92 },
  { code: 'off_points_1000', name: 'Oficiálny majster', description: 'Nazbieral si 1000 bodov v oficiálnej lige/sezóne.', icon: '🏅', rarity: 'epic', criteria: 'official_points', value: 1000, measurable: true, sortOrder: 93 },
  { code: 'off_points_2000', name: 'Oficiálny šampión', description: 'Nazbieral si 2000 bodov v oficiálnej lige/sezóne.', icon: '🏆', rarity: 'epic', criteria: 'official_points', value: 2000, measurable: true, sortOrder: 94 },
  { code: 'off_points_10000', name: 'Oficiálna legenda', description: 'Nazbieral si 10 000 bodov v oficiálnej lige/sezóne.', icon: '🏆', rarity: 'legendary', criteria: 'official_points', value: 10000, measurable: true, sortOrder: 95 },

  // --------------------------- Odznaky (meta) ---------------------------
  { code: 'collector', name: 'Zberateľ', description: 'Získal si aspoň 5 odznakov.', icon: '🌟', rarity: 'rare', criteria: 'collector', value: 5, measurable: true, sortOrder: 100 },
  { code: 'collector_10', name: 'Veľký zberateľ', description: 'Získal si aspoň 10 odznakov.', icon: '🌟', rarity: 'epic', criteria: 'collector', value: 10, measurable: true, sortOrder: 101 },
  { code: 'collector_20', name: 'Majster zberateľ', description: 'Získal si aspoň 20 odznakov.', icon: '🌟', rarity: 'legendary', criteria: 'collector', value: 20, measurable: true, sortOrder: 102 },
  { code: 'first_legendary', name: 'Prvá legenda', description: 'Získal si svoj prvý legendárny odznak.', icon: '💎', rarity: 'epic', criteria: 'rarity_count', rarityKind: 'legendary', value: 1, measurable: true, sortOrder: 103 },
  { code: 'legendary_5', name: 'Zberateľ legiend', description: 'Získal si aspoň 5 legendárnych odznakov.', icon: '💎', rarity: 'legendary', criteria: 'rarity_count', rarityKind: 'legendary', value: 5, measurable: true, sortOrder: 104 },
  { code: 'rare_5', name: 'Vzácny zberateľ', description: 'Získal si aspoň 5 vzácnych (rare) odznakov.', icon: '🔷', rarity: 'rare', criteria: 'rarity_count', rarityKind: 'rare', value: 5, measurable: true, sortOrder: 105 },
  { code: 'rare_10', name: 'Znalec vzácností', description: 'Získal si aspoň 10 vzácnych (rare) odznakov.', icon: '🔷', rarity: 'epic', criteria: 'rarity_count', rarityKind: 'rare', value: 10, measurable: true, sortOrder: 106 },

  // --------------------------- Vernosť ---------------------------
  { code: 'daily_5', name: 'Pravidelný tipér', description: 'Tipuj 5 dní po sebe bez prestávky.', icon: '📅', rarity: 'common', criteria: 'daily_streak', value: 5, measurable: true, sortOrder: 110 },
  { code: 'daily_10', name: 'Oddaný tipér', description: 'Tipuj 10 dní po sebe bez prestávky.', icon: '📅', rarity: 'rare', criteria: 'daily_streak', value: 10, measurable: true, sortOrder: 111 },
  { code: 'loyal', name: 'Verný tipér', description: 'Tipuj 30 dní po sebe bez prestávky.', icon: '📅', rarity: 'epic', criteria: 'daily_streak', value: 30, measurable: true, sortOrder: 112 },

  // --------------------------- Komunita ---------------------------
  { code: 'edit_profile', name: 'Vlastná identita', description: 'Upravil si si profil (meno alebo bio).', icon: '📝', rarity: 'common', criteria: 'edit_profile', value: 1, measurable: true, sortOrder: 120 },
  { code: 'set_avatar', name: 'Tvár do davu', description: 'Nastavil si si profilovú fotku.', icon: '🖼️', rarity: 'common', criteria: 'set_avatar', value: 1, measurable: true, sortOrder: 121 },
  { code: 'create_league', name: 'Zakladateľ', description: 'Vytvoril si vlastnú ligu alebo sezónu.', icon: '🤝', rarity: 'common', criteria: 'create_league', value: 1, measurable: true, sortOrder: 122 },
  { code: 'use_template', name: 'Podľa vzoru', description: 'Vytvoril si ligu/sezónu použitím šablóny tifo.', icon: '📋', rarity: 'common', criteria: 'use_template', value: 1, measurable: true, sortOrder: 123 },
  { code: 'end_competition', name: 'Do finále', description: 'Ukončil si svoju ligu alebo sezónu.', icon: '🏁', rarity: 'rare', criteria: 'end_competition', value: 1, measurable: true, sortOrder: 124 },

  // ----------------------- Nemerateľné (budúce ciele, ostávajú locked) -----------------------
  // Match nemá autora -> počet vytvorených zápasov sa nedá per-user vyhodnotiť.
  { code: 'create_match', name: 'Tvorca zápasov', description: 'Vytvor vlastný zápas.', icon: '🆕', rarity: 'common', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 200 },
  { code: 'create_match_10', name: 'Organizátor', description: 'Vytvor 10 vlastných zápasov.', icon: '🗓️', rarity: 'rare', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 201 },
  { code: 'create_match_100', name: 'Ligový architekt', description: 'Vytvor 100 vlastných zápasov.', icon: '🏗️', rarity: 'epic', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 202 },
  { code: 'create_match_500', name: 'Majster kalendára', description: 'Vytvor 500 vlastných zápasov.', icon: '📆', rarity: 'legendary', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 203 },
  { code: 'evaluate_match', name: 'Rozhodca', description: 'Vyhodnoť zápas.', icon: '⚖️', rarity: 'common', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 204 },
  { code: 'flash_tip', name: 'Bleskový tip', description: 'Odtipuj celé kolo do 60 sekúnd od otvorenia.', icon: '⚡', rarity: 'epic', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 205 },

  // Legenda musí ostať posledná (sortOrder najvyšší) - "získaj všetky ostatné".
  { code: 'legend', name: 'Legenda', description: 'Získaj všetky ostatné odznaky.', icon: '✨', rarity: 'legendary', criteria: 'measurable:false', value: 0, measurable: false, sortOrder: 999 },
];

module.exports = { ACHIEVEMENTS };
/*
 * Výpočtové funkcie pre slovenské kalkulačky – parametre platné pre rok 2026.
 * Všetky sumy v eurách. Pri zmene legislatívy upravte len objekt P.
 * Súbor funguje v prehliadači (window.Calc) aj v Node.js (module.exports) kvôli testom.
 */
(function (root) {
  'use strict';

  var P = {
    rok: 2026,
    zivotneMinimum: 284.13,
    // Zamestnanec
    spZamestnanec: 0.094,          // nemocenské 1,4 + starobné 4 + invalidné 3 + nezamestnanosť 1
    zpZamestnanec: 0.05,
    // Zamestnávateľ
    spZamestnavatelStrop: 0.244,   // časť sociálneho poistenia so stropom
    urazove: 0.008,                // úrazové poistenie bez stropu
    zpZamestnavatel: 0.11,
    maxVZ: 16764,                  // 11 × priemerná mzda 2024 (1 524 €)
    // Daň – mesačné pásma (ročné / 12)
    pasma: [
      { do: 3665.28, sadzba: 0.19 },   // 43 983,32 € ročne
      { do: 5029.10, sadzba: 0.25 },   // 60 349,21 € ročne
      { do: 6250.86, sadzba: 0.30 },   // 75 010,32 € ročne
      { do: Infinity, sadzba: 0.35 }
    ],
    pasmaRocne: [
      { do: 43983.32, sadzba: 0.19 },
      { do: 60349.21, sadzba: 0.25 },
      { do: 75010.32, sadzba: 0.30 },
      { do: Infinity, sadzba: 0.35 }
    ],
    // Nezdaniteľná časť na daňovníka (mesačne)
    nczdPlna: 497.23,
    nczdHranica: 2173.59,          // 91,8 × ŽM / 12
    nczdKonstanta: 1221.76,        // 51,6 × ŽM / 12
    // Daňový bonus
    bonusDo15: 100,
    bonusDo18: 50,
    bonusLimit: [0, 0.29, 0.36, 0.43, 0.50, 0.57, 0.64],
    bonusHranica: 2286,            // 27 432 € ročne
    // DPH
    dph: { zakladna: 23, znizena: 19, superZnizena: 5 },
    // SZČO
    szco: {
      hranicaBezSP: 2876.90,
      hranicaMikro: 9144,
      mikroodvod: 131.34,
      spSadzba: 0.3315,
      spMinVZ: 914.40,
      spMaxVZ: 16764,
      koeficient: 1.486,
      zpSadzba: 0.16,
      zpMinVZ: 762,
      pausalPercento: 0.60,
      pausalMax: 20000
    }
  };

  function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

  /** Progresívna daň zo základu podľa pásiem. */
  function danProgresivna(zaklad, pasma) {
    var dan = 0, dolna = 0;
    for (var i = 0; i < pasma.length; i++) {
      var horna = pasma[i].do;
      if (zaklad > dolna) {
        dan += (Math.min(zaklad, horna) - dolna) * pasma[i].sadzba;
      }
      dolna = horna;
    }
    return dan;
  }

  /** Mesačná nezdaniteľná časť základu dane na daňovníka. */
  function nczdMesacne(zd) {
    if (zd <= P.nczdHranica) return P.nczdPlna;
    return Math.max(0, P.nczdKonstanta - zd / 3);
  }

  /** Mesačný daňový bonus. deti = {do15: n, od15do18: n} */
  function danovyBonus(zd, deti) {
    var a = deti && deti.do15 ? deti.do15 : 0;
    var b = deti && deti.od15do18 ? deti.od15do18 : 0;
    var pocet = a + b;
    if (pocet === 0 || zd <= 0) return 0;
    var znizenie = zd > P.bonusHranica ? (zd - P.bonusHranica) / 10 : 0;
    var spolu = a * Math.max(0, P.bonusDo15 - znizenie) +
                b * Math.max(0, P.bonusDo18 - znizenie);
    var limit = P.bonusLimit[Math.min(pocet, 6)] * zd;
    return Math.min(spolu, limit);
  }

  /** Čistá mzda zamestnanca z hrubej mzdy (mesačne). */
  function cistaMzda(hruba, opt) {
    opt = opt || {};
    var uplatnitNCZD = opt.nczd !== false;
    hruba = Math.max(0, +hruba || 0);

    var sp = Math.min(hruba, P.maxVZ) * P.spZamestnanec;
    var zp = hruba * P.zpZamestnanec;
    var zd = hruba - sp - zp;
    var nczd = uplatnitNCZD ? Math.min(nczdMesacne(zd), Math.max(0, zd)) : 0;
    var zakladDane = Math.max(0, zd - nczd);
    var dan = danProgresivna(zakladDane, P.pasma);
    var bonus = danovyBonus(zd, opt.deti);

    var spZam = Math.min(hruba, P.maxVZ) * P.spZamestnavatelStrop + hruba * P.urazove;
    var zpZam = hruba * P.zpZamestnavatel;

    var res = {
      hruba: hruba,
      sp: sp, zp: zp, odvody: sp + zp,
      zd: zd, nczd: nczd, zakladDane: zakladDane,
      dan: dan, bonus: bonus,
      cista: hruba - sp - zp - dan + bonus,
      spZamestnavatel: spZam, zpZamestnavatel: zpZam,
      cenaPrace: hruba + spZam + zpZam
    };
    Object.keys(res).forEach(function (k) { res[k] = r2(res[k]); });
    return res;
  }

  /** Hrubá mzda potrebná na dosiahnutie zadanej čistej mzdy (bisekcia). */
  function hrubaZCistej(cielCista, opt) {
    var lo = 0, hi = Math.max(100, cielCista * 3);
    while (cistaMzda(hi, opt).cista < cielCista) hi *= 2;
    for (var i = 0; i < 100; i++) {
      var mid = (lo + hi) / 2;
      if (cistaMzda(mid, opt).cista < cielCista) lo = mid; else hi = mid;
    }
    return r2(hi);
  }

  /** DPH: smer 'pridat' (z ceny bez DPH) alebo 'odobrat' (z ceny s DPH). */
  function dph(suma, sadzba, smer) {
    suma = +suma || 0;
    var k = sadzba / 100;
    var bez, s;
    if (smer === 'odobrat') { s = suma; bez = suma / (1 + k); }
    else { bez = suma; s = suma * (1 + k); }
    return { bezDPH: r2(bez), dph: r2(s - bez), sDPH: r2(s) };
  }

  /**
   * Odvody SZČO podľa daňového priznania za predchádzajúci rok (pravidlá od 1. 7. 2026).
   * vstup: { prijem, vydavky: 'pausal' | číslo, zaplateneOdvody }
   */
  function odvodySZCO(vstup) {
    var S = P.szco;
    var prijem = Math.max(0, +vstup.prijem || 0);
    var vydavky;
    if (vstup.vydavky === 'pausal' || vstup.vydavky === undefined) {
      vydavky = Math.min(prijem * S.pausalPercento, S.pausalMax);
    } else {
      vydavky = Math.max(0, +vstup.vydavky || 0);
    }
    var zaplatene = Math.max(0, +vstup.zaplateneOdvody || 0);
    var zd = Math.max(0, prijem - vydavky);
    var vypocitanyVZ = (zd + zaplatene) / 12 / S.koeficient;

    var sp, spRezim, spVZ = 0;
    if (prijem <= S.hranicaBezSP) {
      sp = 0; spRezim = 'bez';
    } else if (prijem <= S.hranicaMikro) {
      sp = S.mikroodvod; spRezim = 'mikro'; spVZ = S.mikroodvod / S.spSadzba;
    } else {
      spVZ = Math.min(Math.max(vypocitanyVZ, S.spMinVZ), S.spMaxVZ);
      sp = spPodlaFondov(spVZ);
      spRezim = vypocitanyVZ <= S.spMinVZ ? 'minimum' : (vypocitanyVZ >= S.spMaxVZ ? 'maximum' : 'vypocet');
    }

    var zpVZ = Math.max(vypocitanyVZ, S.zpMinVZ);
    var zp = zpVZ * S.zpSadzba;

    return {
      prijem: r2(prijem), vydavky: r2(vydavky), zd: r2(zd),
      vypocitanyVZ: r2(vypocitanyVZ),
      sp: r2(sp), spRezim: spRezim, spVZ: r2(spVZ),
      zp: r2(zp), zpMinimum: vypocitanyVZ <= S.zpMinVZ,
      spolu: r2(sp + zp), rocne: r2((sp + zp) * 12)
    };
  }

  /** Sociálne poistenie SZČO: každý fond (18 + 6 + 4,4 + 4,75 %) sa zaokrúhľuje na centy nadol. */
  function spPodlaFondov(vz) {
    return r2([0.18, 0.06, 0.044, 0.0475].reduce(function (sum, sadzba) {
      return sum + Math.floor(vz * sadzba * 100 + 1e-6) / 100;
    }, 0));
  }

  /** Formátovanie sumy po slovensky: 1 234,56 € */
  function eur(x) {
    var n = (+x || 0).toFixed(2).split('.');
    n[0] = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return n[0] + ',' + n[1] + ' €';
  }

  /** Načítanie čísla z inputu – akceptuje čiarku aj medzery. */
  function cislo(s) {
    if (typeof s === 'number') return s;
    var v = parseFloat(String(s || '').replace(/\s| /g, '').replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }

  var api = {
    P: P, danProgresivna: danProgresivna, nczdMesacne: nczdMesacne,
    danovyBonus: danovyBonus, cistaMzda: cistaMzda, hrubaZCistej: hrubaZCistej,
    dph: dph, odvodySZCO: odvodySZCO, spPodlaFondov: spPodlaFondov, eur: eur, cislo: cislo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);

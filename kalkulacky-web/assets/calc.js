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

  /** Ročná nezdaniteľná časť na daňovníka 2026: 5 966,73 € do 26 083,13 €, potom 14 661,11 − ZD/3, najmenej 0. */
  function nczdRocne(zd) {
    var plna = r2(21 * P.zivotneMinimum);            // 5 966,73 €
    var hranica = r2(91.8 * P.zivotneMinimum);       // 26 083,13 €
    var konst = r2(51.6 * P.zivotneMinimum);         // 14 661,11 €
    zd = Math.max(0, +zd || 0);
    var n = zd <= hranica ? plna : Math.max(0, konst - zd / 3);
    return r2(Math.min(n, zd));
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

  /* ------------------------------------------------------------------
   * Nemocenské dávky (zákon 461/2003 Z. z.) a náhrada príjmu (zákon 462/2003 Z. z.)
   * ------------------------------------------------------------------ */
  var D = {
    maxDVZ: { 2026: 100.2083, 2027: 106.5206 }, // 2 × priemerná mzda spred 2 rokov × 12 / 365 (podľa roku vzniku nároku)
    nahradaDni1az3: 0.25,      // zamestnávateľ, 1. – 3. deň
    nahradaDni4az14: 0.55,     // zamestnávateľ, 4. – 14. deň (od 2026 do 14. dňa)
    dniZamestnavatel: 14,
    nemocenske: 0.55,          // Sociálna poisťovňa od 15. dňa
    materske: 0.75,
    rodicovskyPoMaterskej: 500.10,
    rodicovskyBezMaterskej: 364.80
  };

  function ceilTo(x, krok) { return Math.ceil(x / krok - 1e-9) * krok; }

  /** Denný vymeriavací základ zo stabilnej hrubej mesačnej mzdy (zaokrúhlený na 4 des. miesta nahor). */
  function maxDVZ(rok) { return D.maxDVZ[rok] || D.maxDVZ[2026]; }

  function dvz(hrubaMesacna, rok) {
    var v = Math.max(0, +hrubaMesacna || 0) * 12 / 365;
    return Math.min(Math.round(ceilTo(v, 0.0001) * 10000) / 10000, maxDVZ(rok));
  }

  /** PN zamestnanca: náhrada príjmu od zamestnávateľa + nemocenské zo Sociálnej poisťovne. */
  function pn(hrubaMesacna, dni, rok) {
    var d = dvz(hrubaMesacna, rok);
    dni = Math.max(0, Math.floor(+dni || 0));
    var dni1 = Math.min(dni, 3);
    var dni2 = Math.max(0, Math.min(dni, D.dniZamestnavatel) - 3);
    var dniSP = Math.max(0, dni - D.dniZamestnavatel);
    var nahrada1 = ceilTo(dni1 * d * D.nahradaDni1az3, 0.01);
    var nahrada2 = ceilTo(dni2 * d * D.nahradaDni4az14, 0.01);
    var nemocenske = dniSP > 0 ? ceilTo(dniSP * d * D.nemocenske, 0.1) : 0;
    return {
      dvz: d, dni: dni,
      dni1: dni1, dni2: dni2, dniSP: dniSP,
      denne1: r2(d * D.nahradaDni1az3), denne2: r2(d * D.nahradaDni4az14),
      nahrada1: r2(nahrada1), nahrada2: r2(nahrada2),
      nahradaSpolu: r2(nahrada1 + nahrada2),
      nemocenske: r2(nemocenske),
      spolu: r2(nahrada1 + nahrada2 + nemocenske),
      maxDVZ: d >= maxDVZ(rok)
    };
  }

  /** Materské: 75 % DVZ za každý kalendárny deň. tyzdne = 34 / 37 / 43 */
  function materske(hrubaMesacna, tyzdne, rok) {
    var d = dvz(hrubaMesacna, rok);
    var denne = d * D.materske;
    var dni = (tyzdne || 34) * 7;
    return {
      dvz: d, denne: Math.round(denne * 10000) / 10000,
      mesiac30: r2(ceilTo(denne * 30, 0.1)),
      mesiac31: r2(ceilTo(denne * 31, 0.1)),
      dni: dni,
      spolu: r2(ceilTo(denne * dni, 0.1)),
      maxDVZ: d >= maxDVZ(rok)
    };
  }

  /* ------------------------------------------------------------------
   * Úvery a sporenie
   * ------------------------------------------------------------------ */

  /** Anuitná splátka úveru. urokPa v %, roky. */
  function hypoteka(istina, urokPa, roky) {
    istina = Math.max(0, +istina || 0);
    var n = Math.max(1, Math.round((+roky || 0) * 12));
    var i = (+urokPa || 0) / 100 / 12;
    var splatka = i === 0 ? istina / n : istina * i / (1 - Math.pow(1 + i, -n));
    var zostatok = istina, rocne = [], urokRok = 0, istinaRok = 0;
    for (var m = 1; m <= n; m++) {
      var u = zostatok * i;
      var s = Math.min(splatka - u, zostatok);
      zostatok -= s; urokRok += u; istinaRok += s;
      if (m % 12 === 0 || m === n) {
        rocne.push({ rok: Math.ceil(m / 12), urok: r2(urokRok), istina: r2(istinaRok), zostatok: r2(Math.max(0, zostatok)) });
        urokRok = 0; istinaRok = 0;
      }
    }
    return {
      splatka: r2(splatka), pocetSplatok: n,
      zaplateneSpolu: r2(splatka * n), urokySpolu: r2(splatka * n - istina),
      rocne: rocne
    };
  }

  /**
   * Sporenie s mesačným pripisovaním úrokov a zrážkovou daňou 19 % (§ 43 zákona 595/2003).
   * vklad = počiatočný vklad, mesacne = pravidelný vklad na začiatku mesiaca.
   */
  function sporenie(vklad, mesacne, urokPa, roky, danovat) {
    var i = (+urokPa || 0) / 100 / 12;
    var n = Math.max(0, Math.round((+roky || 0) * 12));
    var dan = danovat === false ? 0 : 0.19;
    var zostatok = Math.max(0, +vklad || 0), vlozene = zostatok, urokHruby = 0, danSpolu = 0;
    mesacne = Math.max(0, +mesacne || 0);
    for (var m = 0; m < n; m++) {
      zostatok += mesacne; vlozene += mesacne;   // vklad na začiatku mesiaca
      var u = r2(zostatok * i);
      var d = r2(u * dan);
      urokHruby += u; danSpolu += d;
      zostatok += u - d;
    }
    return {
      vlozene: r2(vlozene), urokHruby: r2(urokHruby), dan: r2(danSpolu),
      urokCisty: r2(urokHruby - danSpolu), konecnaSuma: r2(zostatok)
    };
  }

  /* ------------------------------------------------------------------
   * Cestovné náhrady (zákon 283/2002 Z. z.)
   * ------------------------------------------------------------------ */
  var CN = {
    stravneDo30112026: [9.30, 13.80, 20.60],
    stravneOd1122026: [9.80, 14.60, 21.70],
    kratenie: { ranajky: 0.25, obed: 0.40, vecera: 0.35 },
    kmNahrada: 0.313
  };

  /** Stravné na tuzemskej pracovnej ceste. jedla = {ranajky, obed, vecera} poskytnuté bezplatne. */
  function stravne(hodiny, jedla, sadzby) {
    sadzby = sadzby || CN.stravneOd1122026;
    hodiny = +hodiny || 0;
    jedla = jedla || {};
    var pasmo = hodiny < 5 ? -1 : (hodiny <= 12 ? 0 : (hodiny <= 18 ? 1 : 2));
    if (pasmo < 0) return { pasmo: -1, zaklad: 0, kratenie: 0, stravne: 0 };
    var zaklad = sadzby[pasmo];
    if (jedla.ranajky && jedla.obed && jedla.vecera) {
      return { pasmo: pasmo, zaklad: zaklad, kratenie: zaklad, stravne: 0 };
    }
    var k = 0, top = sadzby[2];
    if (jedla.ranajky) k += top * CN.kratenie.ranajky;
    if (jedla.obed) k += top * CN.kratenie.obed;
    if (jedla.vecera) k += top * CN.kratenie.vecera;
    var vysledok = Math.max(0, zaklad - k);
    return { pasmo: pasmo, zaklad: zaklad, kratenie: Math.round(k * 1000) / 1000, stravne: r2(ceilTo(vysledok, 0.01)) };
  }

  /** Náhrada za použitie súkromného auta: základná náhrada za každý začatý km + PHM. */
  function nahradaAuto(km, spotreba, cenaPHM, sadzbaKm) {
    km = Math.max(0, +km || 0);
    var zakladna = Math.ceil(km - 1e-9) * (sadzbaKm || CN.kmNahrada);
    var phm = km * (Math.max(0, +spotreba || 0) / 100) * Math.max(0, +cenaPHM || 0);
    return { zakladna: r2(zakladna), phm: r2(phm), spolu: r2(r2(zakladna) + r2(phm)) };
  }

  /* ------------------------------------------------------------------
   * Minimálna mzda a príplatky 2026 (Zákonník práce)
   * ------------------------------------------------------------------ */
  var MZ = {
    roky: {
      2026: { mesacna: 915, hodinova: 5.259 },
      2027: { mesacna: 972, hodinova: 5.586 }
    },
    zakladStupne: 580,   // nárast medzi stupňami: (koeficient − 1) × 580 €
    koeficienty: [1.0, 1.2, 1.4, 1.6, 1.8, 2.0],
    // percentá z hodinovej minimálnej mzdy; dohodnuté = minimum pri dohode v KZ/pracovnej zmluve
    priplatky: {
      sobota: { zakon: 0.50, dohodnute: 0.45 },
      nedela: { zakon: 1.00, dohodnute: 0.90 },
      noc: { zakon: 0.40, dohodnute: 0.35 },
      nocRizikova: { zakon: 0.50, dohodnute: null }   // znížená sadzba nie je stanovená
    },
    sviatok: 1.00,       // % priemerného zárobku
    nadcas: 0.25,
    nadcasRizikovy: 0.35
  };

  function mzRok(rok) { return MZ.roky[rok] || MZ.roky[2026]; }

  /** § 120 ods. 4 ZP: (MM − MM 2020) + MM 2020 × koeficient, kde MM 2020 = 580 € */
  function minimalneNaroky(rok) {
    var mm = mzRok(rok).mesacna;
    return MZ.koeficienty.map(function (k, idx) {
      var mesacne = r2(mm + (k - 1) * MZ.zakladStupne);
      return { stupen: idx + 1, koeficient: k, mesacne: mesacne, hodinove: Math.round(mesacne / 174 * 1000) / 1000 };
    });
  }

  /** Percento príplatku (pri dohode znížené, ak zákon zníženie pripúšťa). */
  function priplatokPercento(typ, dohodnute) {
    var p = MZ.priplatky[typ];
    return dohodnute && p.dohodnute !== null ? p.dohodnute : p.zakon;
  }

  /** Presná sadzba príplatku za hodinu (z minimálnej hodinovej mzdy), bez zaokrúhlenia. */
  function priplatokHodina(typ, dohodnute, rok) {
    return Math.round(mzRok(rok).hodinova * priplatokPercento(typ, dohodnute) * 10000) / 10000;
  }

  /** hodiny = {sobota, nedela, noc, nocRizikova, sviatok, nadcas}; priemer = priemerný hodinový zárobok */
  function priplatky(hodiny, priemer, dohodnute, rizikovyNadcas, rok) {
    hodiny = hodiny || {};
    var out = {}, spolu = 0;
    ['sobota', 'nedela', 'noc', 'nocRizikova'].forEach(function (t) {
      var h = Math.max(0, +hodiny[t] || 0);
      out[t] = r2(h * priplatokHodina(t, dohodnute, rok));   // zaokrúhľuje sa až výsledok
      spolu += out[t];
    });
    priemer = Math.max(0, +priemer || 0);
    out.sviatok = r2(Math.max(0, +hodiny.sviatok || 0) * priemer * MZ.sviatok);
    out.nadcas = r2(Math.max(0, +hodiny.nadcas || 0) * priemer * (rizikovyNadcas ? MZ.nadcasRizikovy : MZ.nadcas));
    out.spolu = r2(spolu + out.sviatok + out.nadcas);
    return out;
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
    P: P, danProgresivna: danProgresivna, nczdMesacne: nczdMesacne, nczdRocne: nczdRocne,
    danovyBonus: danovyBonus, cistaMzda: cistaMzda, hrubaZCistej: hrubaZCistej,
    dph: dph, odvodySZCO: odvodySZCO, spPodlaFondov: spPodlaFondov, eur: eur, cislo: cislo,
    D: D, maxDVZ: maxDVZ, dvz: dvz, pn: pn, materske: materske,
    hypoteka: hypoteka, sporenie: sporenie,
    CN: CN, stravne: stravne, nahradaAuto: nahradaAuto,
    MZ: MZ, mzRok: mzRok, minimalneNaroky: minimalneNaroky, priplatokPercento: priplatokPercento,
    priplatokHodina: priplatokHodina, priplatky: priplatky
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);

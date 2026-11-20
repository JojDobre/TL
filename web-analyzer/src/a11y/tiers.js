'use strict';

/** Cenník – jediný zdroj pravdy, klient posiela len kľúč balíka. */
const TIERS = {
  basic: {
    key: 'basic',
    name: 'Základ',
    price: 19,
    pages: 5,
    tagline: 'Pre malé weby a vizitky',
    features: ['Audit až 5 podstránok', 'Test klávesnice a mobilného zobrazenia', 'PDF správa so snímkami chýb', 'Návod na opravu, mapovanie na WCAG 2.1 / 2.2 AA'],
    deepPages: 1, manual: false, criteria: false, plan: false, statement: false, examples: 2,
  },
  standard: {
    key: 'standard',
    name: 'Štandard',
    price: 29,
    pages: 15,
    tagline: 'Pre firemné weby a menšie e-shopy',
    popular: true,
    features: ['Audit až 15 podstránok', 'Všetko zo Základu', 'Tabuľka kritérií WCAG + EN 301 549', 'Kontrolný zoznam manuálnych testov', 'Viac príkladov kódu na opravu'],
    deepPages: 3, manual: true, criteria: true, plan: false, statement: false, examples: 4,
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    price: 49,
    pages: 40,
    tagline: 'Pre e-shopy a služby podliehajúce EAA',
    features: ['Audit až 40 podstránok', 'Všetko zo Štandardu', 'Prioritizovaný plán nápravy', 'Šablóna Vyhlásenia o prístupnosti', 'Maximum príkladov a detailov'],
    deepPages: 5, manual: true, criteria: true, plan: true, statement: true, examples: 6,
  },
};

/** Mesačné predplatné – opakovaný audit, porovnanie a správa e-mailom. */
const MONITORING = {
  key: 'monitor',
  name: 'Monitoring',
  price: 9,
  interval: 'month',
  pages: 15,
  tagline: 'Priebežná kontrola po každej zmene webu',
  features: ['Mesačný audit až 15 podstránok', 'PDF správa e-mailom každý mesiac', 'Porovnanie: nové a opravené chyby', 'Upozornenie, keď sa skóre zhorší', 'Zrušenie kedykoľvek'],
  deepPages: 3, manual: true, criteria: true, plan: true, statement: false, examples: 4,
};

module.exports = { TIERS, MONITORING, ALL_TIERS: { ...TIERS, monitor: MONITORING } };

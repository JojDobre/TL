'use strict';

/** Cenník – jediný zdroj pravdy, klient posiela len kľúč balíka. */
const TIERS = {
  basic: {
    key: 'basic',
    name: 'Základ',
    price: 19,
    pages: 5,
    tagline: 'Pre malé weby a vizitky',
    features: ['Audit až 5 podstránok', 'PDF správa v slovenčine', 'Zoznam chýb s návodom na opravu', 'Mapovanie na WCAG 2.1 / 2.2 AA'],
    manual: false, criteria: false, plan: false, statement: false, examples: 2,
  },
  standard: {
    key: 'standard',
    name: 'Štandard',
    price: 29,
    pages: 15,
    tagline: 'Pre firemné weby a menšie e-shopy',
    popular: true,
    features: ['Audit až 15 podstránok', 'Všetko zo Základu', 'Tabuľka kritérií WCAG + EN 301 549', 'Kontrolný zoznam manuálnych testov', 'Viac príkladov kódu na opravu'],
    manual: true, criteria: true, plan: false, statement: false, examples: 4,
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    price: 49,
    pages: 40,
    tagline: 'Pre e-shopy a služby podliehajúce EAA',
    features: ['Audit až 40 podstránok', 'Všetko zo Štandardu', 'Prioritizovaný plán nápravy', 'Šablóna Vyhlásenia o prístupnosti', 'Maximum príkladov a detailov'],
    manual: true, criteria: true, plan: true, statement: true, examples: 6,
  },
};

module.exports = { TIERS };

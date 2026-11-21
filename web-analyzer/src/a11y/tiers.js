'use strict';

/** Cenník – jediný zdroj pravdy, klient posiela len kľúč balíka. Texty v SK aj EN. */
const TIERS = {
  basic: {
    key: 'basic',
    name: { sk: 'Základ', en: 'Basic' },
    price: 19,
    pages: 5,
    tagline: { sk: 'Pre malé weby a vizitky', en: 'For small and brochure sites' },
    features: {
      sk: ['Audit až 5 podstránok', 'Test klávesnice a mobilného zobrazenia', 'PDF správa so snímkami chýb', 'Návod na opravu, mapovanie na WCAG 2.1 / 2.2 AA'],
      en: ['Audit of up to 5 pages', 'Keyboard and mobile view testing', 'PDF report with screenshots of issues', 'How to fix, mapped to WCAG 2.1 / 2.2 AA'],
    },
    deepPages: 1, manual: false, criteria: false, plan: false, statement: false, examples: 2,
  },
  standard: {
    key: 'standard',
    name: { sk: 'Štandard', en: 'Standard' },
    price: 29,
    pages: 15,
    tagline: { sk: 'Pre firemné weby a menšie e-shopy', en: 'For business sites and smaller stores' },
    popular: true,
    features: {
      sk: ['Audit až 15 podstránok', 'Všetko zo Základu', 'Tabuľka kritérií WCAG + EN 301 549', 'Kontrolný zoznam manuálnych testov', 'Viac príkladov kódu na opravu'],
      en: ['Audit of up to 15 pages', 'Everything in Basic', 'WCAG + EN 301 549 criteria table', 'Manual testing checklist', 'More code examples to fix'],
    },
    deepPages: 3, manual: true, criteria: true, plan: false, statement: false, examples: 4,
  },
  pro: {
    key: 'pro',
    name: { sk: 'Pro', en: 'Pro' },
    price: 49,
    pages: 40,
    tagline: { sk: 'Pre e-shopy a služby podliehajúce EAA', en: 'For online stores and services under the EAA' },
    features: {
      sk: ['Audit až 40 podstránok', 'Všetko zo Štandardu', 'Prioritizovaný plán nápravy', 'Šablóna Vyhlásenia o prístupnosti', 'Maximum príkladov a detailov'],
      en: ['Audit of up to 40 pages', 'Everything in Standard', 'Prioritized remediation plan', 'Accessibility statement template', 'Maximum examples and detail'],
    },
    deepPages: 5, manual: true, criteria: true, plan: true, statement: true, examples: 6,
  },
};

/** Mesačné predplatné – opakovaný audit, porovnanie a správa e-mailom. */
const MONITORING = {
  key: 'monitor',
  name: { sk: 'Monitoring', en: 'Monitoring' },
  price: 9,
  interval: 'month',
  pages: 15,
  tagline: { sk: 'Priebežná kontrola po každej zmene webu', en: 'Ongoing checks as your site changes' },
  features: {
    sk: ['Mesačný audit až 15 podstránok', 'PDF správa e-mailom každý mesiac', 'Porovnanie: nové a opravené chyby', 'Upozornenie, keď sa skóre zhorší', 'Zrušenie kedykoľvek'],
    en: ['Monthly audit of up to 15 pages', 'PDF report by email every month', 'Comparison: new and fixed issues', 'Alert when your score drops', 'Cancel anytime'],
  },
  deepPages: 3, manual: true, criteria: true, plan: true, statement: false, examples: 4,
};

const ALL_TIERS = { ...TIERS, monitor: MONITORING };

/** Balík s textami v danom jazyku. */
function localizeTier(t, lang) {
  const l = lang === 'en' ? 'en' : 'sk';
  return { ...t, name: t.name[l], tagline: t.tagline[l], features: t.features[l] };
}

module.exports = { TIERS, MONITORING, ALL_TIERS, localizeTier };

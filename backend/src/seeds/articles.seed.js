// backend/src/seeds/articles.seed.js
//
// Naplní DB ukážkovými blogovými článkami (obsah vychádza zo šablóny blog.html
// a blog-post.html). Idempotentné — článok sa pridá len ak rovnaký slug ešte
// neexistuje. Autor = prvý admin v DB (alebo prvý používateľ, ak admin nie je).
//
// Použitie: zavolaj seedArticles() (napr. z db.sync.js alebo samostatným skriptom).

const { Article, User } = require('../models');

const ARTICLES = [
  {
    slug: '5-chyb-pri-tipovani-presneho-vysledku',
    title: '5 chýb, ktoré robí 90 % tipérov pri presnom výsledku',
    category: 'Stratégia',
    coverEmoji: '🏒',
    coverGradient: 'linear-gradient(135deg,#2b0a4a,#5b3fd6 60%,#0b4ea2)',
    readMinutes: 6,
    featured: true,
    excerpt: 'Tipovať presné skóre je umenie. Pozreli sme sa na dáta z 2 miliónov tipov a našli vzorce, ktoré ťa stoja body. Tu je, ako sa im vyhnúť.',
    content: [
      'Tipovať víťaza zápasu vie každý. Ale trafiť **presný výsledok** — to je disciplína, ktorá oddeľuje top hráčov rebríčka od zvyšku.',
      '',
      '## Tipuješ príliš veľa gólov',
      'Priemerný tipér nadhodnocuje počet gólov o takmer 0,8 gólu na zápas. Sníva sa nám o veľkolepých 4:3 perlách, ale realita je často nudná 1:0.',
      '',
      '> Najčastejší správny presný výsledok vo futbale je 1:0. Tipuje ho však len 6 % hráčov.',
      '',
      '## Ignoruješ defenzívu',
      'Útok predáva lístky, obrana vyhráva tituly — a tipovacie ligy.',
      '',
      '- Pozri si počet inkasovaných gólov, nie len strelených.',
      '- Domáce tímy s pevnou obranou = ideálni kandidáti na 1:0 alebo 2:0.',
      '- Pri dvoch ofenzívnych tímoch radšej staví na vyšší súčet.',
      '',
      '## Necháš sa unášať emóciami',
      'Tvoje srdce nie je dobrý analytik. Tipéri, ktorí systematicky nadhodnocujú obľúbený tím, majú o 12 % nižšiu presnosť.',
      '',
      '## Tipuješ na poslednú chvíľu',
      'Tipni skoro, sleduj novinky a uprav tip, ak treba.',
      '',
      '## Zabúdaš na bodový systém',
      'Aj keď netrafíš presný výsledok, čiastočné body sa rátajú: správny víťaz, gólový rozdiel aj počet gólov tímu vedia spraviť veľký rozdiel za celú sezónu.',
      '',
      'Vyskúšaj tieto princípy už v [najbližšom kole](/seasons) a sleduj, ako sa tvoja presnosť posúva nahor.',
    ].join('\n'),
  },
  {
    slug: 'liga-majstrov-26-27-tipuj-od-osemfinale',
    title: 'Liga majstrov 26/27 je tu — tipuj od osemfinále',
    category: 'Novinky',
    coverEmoji: '⚽',
    coverGradient: 'linear-gradient(135deg,#0a3d2e,#15543a)',
    readMinutes: 3,
    excerpt: 'Spustili sme novú oficiálnu sezónu s 125 zápasmi a globálnym rebríčkom.',
    content: [
      'Nová oficiálna sezóna Ligy majstrov je otvorená.',
      '',
      '## Čo ťa čaká',
      'Tipovať môžeš od osemfinále až po finále. Každé kolo má vlastnú uzávierku.',
      '',
      'Pridaj sa medzi tipérov a sleduj [otvorené sezóny](/seasons).',
    ].join('\n'),
  },
  {
    slug: 'ako-lucia-vyhrala-3-sezony-po-sebe',
    title: 'Ako Lucia vyhrala 3 sezóny po sebe',
    category: 'Rozhovory',
    coverEmoji: '🏆',
    coverGradient: 'linear-gradient(135deg,#5b3fd6,#2b0a4a)',
    readMinutes: 7,
    excerpt: 'Líderka rebríčka prezrádza svoju rutinu a prečo nikdy netipuje remízy.',
    content: [
      'Lucia patrí k najúspešnejším tipérkam na platforme.',
      '',
      '## Rutina pred kolom',
      'Tipy si pripravuje deň vopred a aktualizuje ich podľa zostáv.',
      '',
      '> Stabilita poráža hazard na dlhej trati.',
      '',
      'Skús jej prístup vo [vlastnej lige](/leagues/create).',
    ].join('\n'),
  },
  {
    slug: 'ako-si-zalozit-ligu-pre-celu-firmu',
    title: 'Ako si založiť ligu pre celú firmu',
    category: 'Návody',
    coverEmoji: '📊',
    coverGradient: 'linear-gradient(135deg,#c2410c,#7a1f06)',
    readMinutes: 4,
    excerpt: 'Krok za krokom: od vytvorenia sezóny po pozvanie 50 kolegov cez ID.',
    content: [
      'Firemná liga je skvelý teambuilding.',
      '',
      '## Postup',
      '- Vytvor si sezónu a v nej ligu.',
      '- Skopíruj jedinečné ID ligy.',
      '- Pošli ID kolegom — pripoja sa cez stránku Pripojiť sa.',
      '',
      'Začni na stránke [Vytvoriť ligu](/leagues/create).',
    ].join('\n'),
  },
];

async function seedArticles() {
  console.log('Seedujem blogové články...');

  // nájdeme autora: prvý admin, inak prvý používateľ
  let author = await User.findOne({ where: { role: 'admin' } });
  if (!author) author = await User.findOne();
  if (!author) {
    console.log('Preskakujem seed článkov — v DB nie je žiadny používateľ.');
    return;
  }

  for (const a of ARTICLES) {
    const exists = await Article.findOne({ where: { slug: a.slug } });
    if (exists) continue; // idempotencia
    await Article.create(Object.assign({}, a, { published: true, authorId: author.id }));
  }

  console.log('Blogové články naseedované.');
}

module.exports = { seedArticles };

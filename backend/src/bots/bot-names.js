// backend/src/bots/bot-names.js
//
// Generovanie realistických slovenských mien a prezývok pre botov.
// Deterministické podľa seedu — rovnaký index vždy vyrobí rovnaké meno,
// takže opakované spustenie create skriptu nevytvára náhodné duplicity.

const FIRST = [
  'Martin','Peter','Tomáš','Michal','Ján','Lukáš','Marek','Jakub','Milan','Patrik',
  'Andrej','Dávid','Filip','Samuel','Matej','Adam','Richard','Roman','Erik','Dominik',
  'Juraj','Vladimír','Štefan','Pavol','Miroslav','Radoslav','Branislav','Norbert','Igor','Denis',
  'Marián','Róbert','Dušan','Marián','Anton','Karol','František','Viktor','Radovan','Oliver',
  'Sebastián','Kristián','Kevin','Alex','Alexej','Daniel','Matúš','Boris','Rastislav','Emil',
  'Ondrej','Viliam','Marcel','René','Stanislav','Ladislav','Jozef','Cyril','Alojz','Eduard',
  'Kristián','Nikolas','Teodor','Leo','Tibor','Šimon','Róbert','Roland','Arnold','Mário',
  'Katarína','Lucia','Veronika','Simona','Monika','Zuzana','Petra','Kristína','Nikola','Michaela',
  'Barbora','Dominika','Jana','Anna','Eva','Alena','Tatiana','Ivana','Lenka','Adriana',
  'Silvia','Natália','Nina','Laura','Sofia','Karolína','Denisa','Viktória','Ema','Timea',
  'Bianka','Vanesa','Klaudia','Alexandra','Mária','Terézia','Miriam','Renáta','Sandra','Diana'
];

const LAST = [
'Kováč','Horváth','Varga','Tóth','Nagy','Baláž','Szabó','Molnár','Balog','Lukáč',
'Novák','Polák','Hudák','Urban','Král','Marek','Gajdoš','Bartoš','Sedlák','Fabian',
'Krajčí','Šimko','Baran','Čierny','Nemec','Dubovský','Pavlík','Vaško','Rybár','Sokol',
'Klein','Kováčik','Benko','Krištof','Kováčik','Kučera','Farkaš','Mikula','Petrík','Kmeť',
'Slanina','Švec','Kovárik','Hruška','Bielik','Chovan','Konečný','Mráz','Valach','Čech',
'Brezina','Kubík','Púček','Hajduk','Kovár','Dudáš','Šimon','Ondrejka','Kardoš','Brezovský',
'Šimončič','Petráš','Kovács','Benedik','Kováčik','Lipták','Dobiáš','Biely','Krupa','Kollár',
'Beneš','Pospíšil','Dvořák','Procházka','Svoboda','Černý','Kučera','Jelínek','Marek','Bartoň',
'Škoda','Zeman','Soukup','Holub','Malina','Kysel','Kubala','Fodor','Bodnár','Balla'
];

const SHORT_NAMES = {
  Martin:['Mato','Maťo','Marti'],
  Michal:['Mišo','Miso'],
  Peter:['Peťo','Peto'],
  Tomáš:['Tomi','Tomiino'],
  Jakub:['Kubo','Kubko'],
  Lukáš:['Luky','Luki'],
  Ján:['Jano'],
  Samuel:['Samo'],
  Matej:['Maťej','Mates'],
  Patrik:['Paťo','Pato'],
  Richard:['Rišo'],
  Dominik:['Dodo'],
  Katarína:['Katka'],
  Lucia:['Lucka'],
  Veronika:['Vera','Verča'],
  Simona:['Sima'],
  Michaela:['Miška'],
  Nikola:['Nika']
};

const TIP_WORDS = ['tiper','tip','gol','goal','strelec','kanonier','snajper','bombarder','kapitan','captain',
  'coach','trener','manager','boss','king','kral','queen','ace','legend','legenda','winner','champion',
  'master','majster','pro','elite','ultra','top','best','expert','guru','vip','mvp','fan','fanda','ultras',
  'supporter','derby','liga','cup','champions','premier','ofsajd','offside','var','penalta','roh','stadion',
  'tribuna','futbal','soccer','football','fc','sk','united','city','rovers','athletic','spartan','warrior',
  'gladiator','predator','hunter','sniper','killer','shadow','ghost','phantom','reaper','viper','cobra',
  'python','wolf','lonewolf','alpha','beta','lion','tiger','bear','eagle','falcon','hawk','panther','jaguar',
  'rhino','dragon','phoenix','storm','thunder','lightning','fire','ice','frost','blaze','inferno','venom',
  'rage','turbo','nitro','rocket','speed','flash','rapid','zoom','power','force','iron','steel','diamond',
  'gold','silver','bronze','pixel','byte','ninja','samurai','viking','pirate','joker','bandit','outlaw',
  'rebel','nomad','spartan','chief','captain','commander','general','lord','duke','prince','emperor','cz',
  'sk','svk','eu'];

// Vzory prezývok — mix štýlov, aké reálne vidno v tipovačkách
const NICK_PATTERNS = [
(f,l,n)=>`${strip(f).toLowerCase()}${strip(l).toLowerCase()}`,
(f,l,n)=>`${strip(f).toLowerCase()}.${strip(l).toLowerCase()}`,
(f,l,n)=>`${strip(f).toLowerCase()}_${strip(l).toLowerCase()}`,
(f,l,n)=>`${strip(f)[0].toLowerCase()}${strip(l).toLowerCase()}`,
(f,l,n)=>`${strip(f).toLowerCase()}${strip(l)[0].toLowerCase()}`,
(f,l,n)=>`${strip(f).slice(0,3).toLowerCase()}${strip(l).slice(0,3).toLowerCase()}`,
(f,l,n)=>`${strip(f).toLowerCase()}${1980+n%25}`,
(f,l,n)=>`${strip(f).toLowerCase()}${90+n%10}`,
(f,l,n)=>`${strip(l).toLowerCase()}${1985+n%30}`,
(f,l,n)=>`${pickFrom(TIP_WORDS,n)}_${strip(f).toLowerCase()}`,
(f,l,n)=>`${strip(f).toLowerCase()}_${pickFrom(TIP_WORDS,n)}`,
(f,l,n)=>`${pickFrom(TIP_WORDS,n)}${strip(l).toLowerCase()}`,
(f,l,n)=>`${pickFrom(TIP_WORDS,n)}.${strip(f).toLowerCase()}`,
(f,l,n)=>`${pickFrom(TIP_WORDS,n)}${n%999}`,
(f,l,n)=>`${strip(f).toLowerCase()}${n%1000}`,
(f,l,n)=>`${strip(l).toLowerCase()}${n%1000}`,
(f,l,n)=>`${strip(f).toLowerCase()}${strip(l).toLowerCase()}${n%99}`,
(f,l,n)=>`${strip(f)[0].toLowerCase()}_${strip(l).toLowerCase()}`,
(f,l,n)=>`${strip(f).toLowerCase()}-${strip(l).toLowerCase()}`,
(f,l,n)=>`${strip(f).toLowerCase()}xx`,
(f,l,n)=>`${strip(f).toLowerCase()}007`,
(f,l,n)=>`${strip(f).toLowerCase()}10`,
(f,l,n)=>`${strip(f).toLowerCase()}11`,
(f,l,n)=>`${strip(f).toLowerCase()}99`,
(f,l,n)=>`${strip(f).toLowerCase()}_official`,
(f,l,n)=>`${strip(f).toLowerCase()}_sk`,
(f,l,n)=>`${strip(f).toLowerCase()}_svk`,
(f,l,n)=>`${strip(f).toLowerCase()}_nr`,
(f,l,n)=>`${strip(f).toLowerCase()}_ba`,
(f,l,n)=>`${strip(f).toLowerCase()}_tt`,
(f,l,n)=>`${pickFrom(TIP_WORDS,n)}_${n%100}`,
(f,l,n)=>`${pickFrom(TIP_WORDS,n)}${strip(f)[0].toLowerCase()}${strip(l).toLowerCase()}`,
(f,l,n)=>`${strip(f).toLowerCase()}${pickFrom(TIP_WORDS,n)}`,
(f,l,n)=>`${strip(l).toLowerCase()}_${pickFrom(TIP_WORDS,n)}`,
(f,l,n)=>`${strip(f).toLowerCase()}_${n%100}`,
(f,l,n)=>`${strip(l).toLowerCase()}_${n%100}`,
(f,l,n)=>`${strip(f).toLowerCase()}.${n%100}`,
(f,l,n)=>`${strip(l).toLowerCase()}.${n%100}`,
(f,l,n)=>`${pickFrom(TIP_WORDS,n)}.${strip(l).toLowerCase()}`,
(f,l,n)=>`${pickFrom(TIP_WORDS,n)}_${strip(f).slice(0,3).toLowerCase()}`
];


// Indexy vzorov, ktoré vyrobia "meno + priezvisko" (jan.novak, jnovak, jan-novak…).
// Zvyšné vzory sú skutočné prezývky (sniper_jan, kanonier412, peto99…).
// Reálni používatelia si oveľa častejšie volia prezývku než celé meno, preto
// sa REAL_NAME_PATTERNS ťahajú len v menšine prípadov (viď botIdentity).
const REAL_NAME_PATTERNS = [0, 1, 2, 3, 4, 5, 17, 18];

function strip(s) {
  // odstráň diakritiku pre username (Kováč → kovac)
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function pickFrom(arr, n) { return arr[Math.abs(n) % arr.length]; }

// deterministický "hash" indexu → rozhádže výber mien, aby nešli po poradí
function scramble(i) { let x = (i + 1) * 2654435761 % 2 ** 31; return Math.abs(x); }

// Vygeneruje meno pre bota s daným indexom (0..N). Deterministické.
// Deterministický avatar (DiceBear) — kreslené figúrky, žiadne fotky reálnych
// ľudí. Seed je odvodený od indexu, takže bot má vždy rovnakú tvár.
const AVATAR_STYLES = [
  'avataaars', 'bottts', 'notionists', 'adventurer', 'big-smile',
  'fun-emoji', 'lorelei', 'micah', 'miniavs', 'open-peeps',
  'personas', 'pixel-art', 'thumbs',
];
function botAvatar(index) {
  const s = scramble(index);
  const style = AVATAR_STYLES[(s >> 9) % AVATAR_STYLES.length];
  const seed = `tifo${index}${(s >> 12) % 9973}`;
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

// Vygeneruje meno pre bota s daným indexom (0..N). Deterministické.
function botIdentity(index) {
  const s = scramble(index);
  const first = FIRST[s % FIRST.length];
  const last = LAST[(s >> 3) % LAST.length];

  // ~20 % botov má username odvodený od mena a priezviska, zvyšok prezývku
  const wantsRealName = (s >> 17) % 100 < 20;
  let pattern;
  if (wantsRealName) {
    pattern = NICK_PATTERNS[REAL_NAME_PATTERNS[(s >> 6) % REAL_NAME_PATTERNS.length]];
  } else {
    const nickOnly = NICK_PATTERNS.filter((_, i) => !REAL_NAME_PATTERNS.includes(i));
    pattern = nickOnly[(s >> 6) % nickOnly.length];
  }

  let username = pattern(first, last, s % 997);
  // poistka proti kolíziám medzi botmi: pri opakovaní pridaj index
  username = username.slice(0, 24);
  const email = `${strip(first).toLowerCase()}.${strip(last).toLowerCase()}${index}@bot.tifo.sk`;
  return { first, last, username, email, avatar: botAvatar(index) };
}

// Názvy komunitných súťaží, ktoré boti zakladajú
const LEAGUE_NAME_PARTS = {
  prefixes: ['Kamoši','Partia','Krčma','Firma','Trieda','Chalani','Baby','Dedina','Bytovka','Panelák',
    'Šatňa','Kabína','Klub','Hospoda','Pivári','Pivnica','Grilovačka','Rodina','Bratranci','Sesternice',
    'Susedia','Partička','Banda','Elita','VIP','Legendy','Majstri','Šampióni','Borci','Frajeri','Šéfovia',
    'Kolegovia','Kancelária','IT','Programátori','Testeri','Developeri','Admini','Fanúšikovia','Ultras',
    'Futbalisti','Hokejisti','Realisti','Optimisti','Pesimisti','Gambleri','Tipéri','Profíci','Nováčikovia',
    'Veteráni','Dream Team','FC','FK','TJ','AC','Spartak','Slovan','Lokomotíva','Rapid','United','City',
    'Real','Dynamo','Inter','Galaxy','Titani','Vlci','Levy','Orli','Draci','Žraloci','Kobry','Panteri',
    'Medvede','Rytieri','Gladiátori','Vikingovia','Pirati','Lovci','Predátori','Noční jazdci','Čierni kone',
    'Bieli tigri','Červení diabli','Modrá krv','Zelenáči','Stará garda','Mladé pušky','Kanonieri','Strelci',
    'Víťazi','Favoriti','Outsideri','Rebeli','Nezdolní','Neporaziteľní','Nadšenci','Šialenci',
    'Blázni do futbalu'],
  suffixes: ['tipuje','liga','superliga','miniliga','extraliga','cup','super cup','tipovačka',
    'battle','aréna','majstri','derby','challenge','liga majstrov','fantasy','víťazi','šampióni',
    'elite','all stars','11','XI','team','squad','crew','boys','girls','gang','united','forever',
    '2026','2027','2028','sezóna','playoff','finále','pohár','trofej','králi','hviezdy','legendy',
    'experti','tipéri','masters','arena','showdown','challenge cup','open','classic','premium',
    'gold','silver','bronze','night cup','weekend liga','liga snov','liga priateľov','liga kamarátov',
    'liga bossov','liga krčmy','liga firmy','liga dediny','liga ulice','liga sídliska','ultimate','infinity',
    'power league','winner cup','pro league','champions','dream league','best of','invitational','royale',
    'world cup','euro cup','knockout','survivor','battle royale','top liga','top cup','super tipéri','all in',
    'double chance','golden boot','golden ball','hattrick','penalty cup','ofsajd liga','var liga']
};
function botLeagueName(seed) {
  const p = LEAGUE_NAME_PARTS.prefixes[seed % LEAGUE_NAME_PARTS.prefixes.length];
  const s = LEAGUE_NAME_PARTS.suffixes[(seed >> 4) % LEAGUE_NAME_PARTS.suffixes.length];
  return `${p} ${s}`;
}

module.exports = { botIdentity, botLeagueName, botAvatar };

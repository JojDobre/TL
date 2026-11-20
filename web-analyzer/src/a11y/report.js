'use strict';

const { withPage } = require('./browser');
const { IMPACT, MANUAL_CHECKS, SC } = require('./wcag');
const { TIERS } = require('./tiers');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
const scoreColor = (s) => (s >= 90 ? '#12b76a' : s >= 65 ? '#e0a100' : s >= 50 ? '#f97316' : '#ef4444');
const IMPACT_COLOR = { critical: '#b42318', serious: '#ef4444', moderate: '#f59e0b', minor: '#64748b' };
const short = (u, n = 70) => { const s = String(u).replace(/^https?:\/\//, ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function ringSvg(score, size = 180, stroke = 16) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e7e9f0" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${scoreColor(score)}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.3}" font-weight="800" fill="#0e1220">${score}</text>
  </svg>`;
}

const badge = (impact) => `<span class="badge" style="background:${IMPACT_COLOR[impact]}1a;color:${IMPACT_COLOR[impact]}">${esc(IMPACT[impact]?.label || impact)}</span>`;

/* ======================= Šablóna správy ======================= */

function buildHtml(audit, order) {
  const tier = TIERS[order.tier];
  const a = audit;
  const crit = a.counts.critical + a.counts.serious;
  const statusColor = a.conformance.key === 'fail' ? '#ef4444' : a.conformance.key === 'partial' ? '#e0a100' : '#12b76a';

  /* ---------- 1. Titulná strana ---------- */
  const cover = `
  <section class="cover">
    <div class="cover-top">
      <div class="brand"><span class="mark">◎</span> Web Analyzer</div>
      <div class="cover-meta">Číslo správy: <b>${esc(order.id.slice(0, 8).toUpperCase())}</b><br>Balík: <b>${esc(tier.name)}</b></div>
    </div>
    <h1>Audit prístupnosti webu</h1>
    <p class="cover-sub">podľa Európskeho aktu o prístupnosti (EAA), zákona č. 351/2022 Z. z.<br>a normy EN 301 549 / WCAG 2.1 a 2.2, úroveň AA</p>
    <div class="cover-site">
      <div class="host">${esc(a.host)}</div>
      <div class="muted">${esc(a.title)}</div>
    </div>
    <div class="cover-grid">
      <div class="cover-score">${ringSvg(a.score)}<div class="muted">Skóre prístupnosti</div></div>
      <div>
        <div class="status" style="border-color:${statusColor};color:${statusColor}">${esc(a.conformance.label)}</div>
        <p>${esc(a.conformance.text)}</p>
        <table class="mini">
          <tr><td>Dátum auditu</td><td>${fmtDate(a.scannedAt)}</td></tr>
          <tr><td>Analyzované podstránky</td><td>${a.pages.length}</td></tr>
          <tr><td>Typy problémov</td><td>${a.issues.length}</td></tr>
          <tr><td>Výskyty problémov</td><td>${a.totalNodes}</td></tr>
        </table>
      </div>
    </div>
    ${a.screenshot ? `<div class="shot"><img src="data:image/jpeg;base64,${a.screenshot}" alt=""></div>` : ''}
  </section>`;

  /* ---------- 2. Zhrnutie ---------- */
  const topIssues = a.issues.slice(0, 5);
  const summary = `
  <section class="page">
    <h2><span class="num">1</span> Zhrnutie pre vedenie</h2>
    <p class="lead">${crit
      ? `Na webe <b>${esc(a.host)}</b> sme automatickým testom našli <b>${crit} ${crit === 1 ? 'kritický alebo závažný typ problému' : 'kritických alebo závažných typov problémov'}</b>, ktoré bránia ľuďom so zdravotným postihnutím web plnohodnotne používať. Tieto chyby sú v rozpore s požiadavkami WCAG 2.1 AA, na ktoré odkazuje EAA.`
      : a.issues.length
        ? `Web <b>${esc(a.host)}</b> nemá kritické ani závažné automaticky zistiteľné chyby. Zistili sme však ${a.issues.length} menej závažných nedostatkov, ktoré odporúčame odstrániť.`
        : `Automatický test webu <b>${esc(a.host)}</b> nezistil žiadne porušenia testovateľných kritérií WCAG. Pre plnú zhodu odporúčame doplniť manuálne testovanie.`}</p>

    <div class="kpis">
      ${['critical', 'serious', 'moderate', 'minor'].map((k) => `
        <div class="kpi" style="border-top:4px solid ${IMPACT_COLOR[k]}">
          <div class="kpi-n">${a.counts[k]}</div>
          <div class="kpi-l">${IMPACT[k].label}</div>
          <div class="muted small">${a.nodeCounts[k]} výskytov</div>
        </div>`).join('')}
    </div>

    <h3>Ako čítať závažnosť</h3>
    <table class="tbl">
      <tr><td>${badge('critical')}</td><td>Úplne znemožňuje používanie časti webu (napr. tlačidlo bez názvu pre nevidiaceho).</td></tr>
      <tr><td>${badge('serious')}</td><td>Výrazne sťažuje používanie, často porušuje kritériá úrovne A/AA.</td></tr>
      <tr><td>${badge('moderate')}</td><td>Spôsobuje ťažkosti, existuje však obchádzka.</td></tr>
      <tr><td>${badge('minor')}</td><td>Drobný nedostatok, ktorý zhoršuje komfort.</td></tr>
    </table>

    <h3>Najdôležitejšie zistenia</h3>
    ${topIssues.length ? `<table class="tbl">
      <thead><tr><th>Problém</th><th>Závažnosť</th><th>WCAG</th><th class="r">Stránky</th></tr></thead>
      <tbody>${topIssues.map((i) => `<tr><td>${esc(i.title)}</td><td>${badge(i.impact)}</td><td>${i.sc.map((s) => esc(s.id)).join(', ')}</td><td class="r">${i.pages.length}/${a.pages.length}</td></tr>`).join('')}</tbody>
    </table>` : '<p class="ok">Bez zistených problémov.</p>'}

    <div class="keep">
    <h3>Výsledok podľa princípov WCAG</h3>
    <div class="principles">
      ${Object.entries(a.principles).map(([k, p]) => `
        <div class="pr ${p.issues ? 'bad' : 'good'}">
          <div class="pr-n">${k}. ${esc(p.name)}</div>
          <div class="pr-v">${p.issues ? `${p.issues} ${p.issues === 1 ? 'problém' : p.issues < 5 ? 'problémy' : 'problémov'}` : 'Bez chýb'}</div>
          <div class="muted small">${esc(p.desc)}</div>
        </div>`).join('')}
    </div>
    </div>
  </section>`;

  /* ---------- 3. Právny rámec ---------- */
  const legal = `
  <section class="page">
    <h2><span class="num">2</span> Právny rámec</h2>
    <div class="cols">
      <div>
        <h3>Európsky akt o prístupnosti (EAA)</h3>
        <p>Smernica (EÚ) 2019/882 o požiadavkách na prístupnosť výrobkov a služieb. Na Slovensku ju preberá <b>zákon č. 351/2022 Z. z.</b> Požiadavky sa uplatňujú od <b>28. júna 2025</b>.</p>
        <h3>Na koho sa vzťahuje</h3>
        <ul>
          <li>elektronický obchod (e-shopy, online objednávky),</li>
          <li>bankové a finančné služby pre spotrebiteľov,</li>
          <li>elektronické komunikácie, e-knihy, prístup k audiovizuálnym službám,</li>
          <li>vybrané prvky osobnej dopravy (weby, aplikácie, predaj lístkov).</li>
        </ul>
        <p class="small muted">Mikropodniky poskytujúce služby (menej ako 10 zamestnancov a ročný obrat alebo súvaha do 2 mil. €) sú z povinností pre služby spravidla vyňaté. Verejný sektor sa riadi samostatnou smernicou (EÚ) 2016/2102.</p>
      </div>
      <div>
        <h3>Technický štandard</h3>
        <p>Za splnenie požiadaviek sa v praxi považuje súlad s harmonizovanou normou <b>EN 301 549</b>, ktorá pre webový obsah preberá kritériá <b>WCAG 2.1 na úrovni A a AA</b>. Táto správa navyše hodnotí aj nové kritériá WCAG 2.2.</p>
        <h3>Čo EAA vyžaduje od poskytovateľa</h3>
        <ul>
          <li>prístupný web a mobilnú aplikáciu podľa uvedených kritérií,</li>
          <li>zverejnenie informácií o tom, ako služba spĺňa požiadavky prístupnosti (napr. vo forme vyhlásenia o prístupnosti),</li>
          <li>priebežné udržiavanie súladu pri zmenách webu.</li>
        </ul>
        <p class="small muted">Dodržiavanie kontroluje orgán dohľadu nad trhom; za nesplnenie povinností zákon umožňuje uložiť sankcie.</p>
      </div>
    </div>
    <div class="note">Táto správa je technický audit, nie právne poradenstvo. Či sa na vašu službu EAA vzťahuje, odporúčame overiť s právnikom.</div>
  </section>`;

  /* ---------- 4. Tabuľka kritérií ---------- */
  const critRows = (tier.criteria ? a.criteria : a.criteria.filter((c) => c.status === 'fail'));
  const criteria = `
  <section class="page">
    <h2><span class="num">3</span> ${tier.criteria ? 'Stav kritérií WCAG a EN 301 549' : 'Porušené kritériá WCAG'}</h2>
    <p>${tier.criteria
      ? 'Prehľad všetkých kritérií úrovne A a AA. <b>Vyhovuje</b> = automatický test kritérium overil bez chýb; <b>Nevyhovuje</b> = zistené porušenie; <b>Manuálne</b> = automat ho nedokáže spoľahlivo overiť.'
      : 'Kritériá, pri ktorých automatický test zistil porušenie.'}</p>
    ${critRows.length ? `<table class="tbl crit">
      <thead><tr><th>Kritérium</th><th>Názov</th><th>Úroveň</th><th>EN 301 549</th><th>Stav</th></tr></thead>
      <tbody>${critRows.map((c) => `<tr>
        <td><b>${esc(c.id)}</b></td><td>${esc(c.name)}${c.ver === '2.2' ? ' <span class="tag">2.2</span>' : ''}</td><td>${c.level}</td>
        <td>${c.en301549 || '—'}</td>
        <td><span class="st st-${c.status}">${c.status === 'fail' ? 'Nevyhovuje' : c.status === 'pass' ? 'Vyhovuje' : 'Manuálne'}</span></td></tr>`).join('')}</tbody>
    </table>` : '<p class="ok">Žiadne porušené kritériá.</p>'}
  </section>`;

  /* ---------- 5. Detail problémov ---------- */
  const issues = `
  <section class="page">
    <h2><span class="num">4</span> Zistené problémy a ich oprava</h2>
    ${a.issues.length ? '' : '<p class="ok">Automatický test nenašiel žiadne problémy.</p>'}
    ${a.issues.map((i, idx) => `
      <article class="issue">
        <div class="issue-head">
          <div><span class="issue-n">${idx + 1}</span> <b>${esc(i.title)}</b></div>
          ${badge(i.impact)}
        </div>
        <div class="issue-meta">
          ${i.sc.map((s) => `<span class="tag">WCAG ${esc(s.id)} ${esc(s.name)} (${s.level})</span>`).join(' ')}
          ${i.sc.filter((s) => s.en301549).map((s) => `<span class="tag">EN 301 549 – ${s.en301549}</span>`).join(' ')}
        </div>
        <table class="mini">
          <tr><td>Výskyt</td><td>${i.nodeCount}× na ${i.pages.length} z ${a.pages.length} podstránok</td></tr>
          ${i.affects ? `<tr><td>Koho sa týka</td><td>${esc(i.affects)}</td></tr>` : ''}
          <tr><td>Pravidlo</td><td class="mono">${esc(i.id)}</td></tr>
        </table>
        <div class="fix"><b>Ako opraviť:</b> ${esc(i.fix)}</div>
        ${i.examples.slice(0, tier.examples).map((e) => `
          <div class="ex">
            <div class="ex-page">${esc(short(e.page))} · <span class="mono">${esc(e.target.slice(0, 120))}</span></div>
            <pre>${esc(e.html)}</pre>
          </div>`).join('')}
        ${i.pages.length > 1 ? `<div class="small muted">Podstránky: ${i.pages.slice(0, 6).map((p) => esc(short(p, 50))).join(', ')}${i.pages.length > 6 ? ` a ďalších ${i.pages.length - 6}` : ''}</div>` : ''}
      </article>`).join('')}
  </section>`;

  /* ---------- 6. Podstránky ---------- */
  const pages = `
  <section class="page">
    <h2><span class="num">5</span> Analyzované podstránky</h2>
    <table class="tbl">
      <thead><tr><th>#</th><th>Stránka</th><th class="r">Skóre</th><th class="r">Typy chýb</th><th class="r">Výskyty</th></tr></thead>
      <tbody>${a.pages.map((p, i) => `<tr>
        <td>${i + 1}</td>
        <td><div>${esc(short(p.url, 80))}</div>${p.title ? `<div class="muted small">${esc(p.title.slice(0, 90))}</div>` : ''}${p.error ? `<div class="small" style="color:#ef4444">${esc(p.error)}</div>` : ''}</td>
        <td class="r"><b style="color:${p.score == null ? '#64748b' : scoreColor(p.score)}">${p.score ?? '—'}</b></td>
        <td class="r">${p.error ? '—' : p.violations}</td><td class="r">${p.error ? '—' : p.nodes}</td></tr>`).join('')}</tbody>
    </table>
  </section>`;

  /* ---------- 7. Plán nápravy (Pro) ---------- */
  let plan = '';
  if (tier.plan) {
    const p1 = a.issues.filter((i) => i.impact === 'critical' || (i.impact === 'serious' && i.level === 'A'));
    const p2 = a.issues.filter((i) => !p1.includes(i) && (i.impact === 'serious' || i.impact === 'moderate'));
    const p3 = a.issues.filter((i) => !p1.includes(i) && !p2.includes(i));
    const phase = (n, title, when, list, desc) => `
      <div class="phase">
        <div class="phase-h"><span class="phase-n">${n}</span><div><b>${title}</b><div class="muted small">${when}</div></div></div>
        <p class="small">${desc}</p>
        ${list.length ? `<ul>${list.map((i) => `<li>${esc(i.title)} <span class="muted">(${i.nodeCount}×, WCAG ${i.sc.map((s) => s.id).join(', ')})</span></li>`).join('')}</ul>` : '<p class="muted small">Žiadne položky.</p>'}
      </div>`;
    plan = `
    <section class="page">
      <h2><span class="num">6</span> Plán nápravy</h2>
      <p>Odporúčané poradie opráv podľa dopadu na používateľov a právneho rizika.</p>
      ${phase(1, 'Okamžite – blokujúce bariéry', 'odporúčaný termín: do 2 týždňov', p1, 'Kritické chyby a závažné porušenia úrovne A. Bránia používateľom dokončiť nákup, odoslať formulár alebo sa zorientovať.')}
      ${phase(2, 'Krátkodobo – závažné nedostatky', 'odporúčaný termín: do 1–2 mesiacov', p2, 'Zostávajúce závažné a stredné problémy úrovne AA (kontrast, popisy, štruktúra).')}
      ${phase(3, 'Priebežne – vylepšenia', 'pri najbližšom vývoji', p3, 'Drobné nedostatky a vylepšenia komfortu.')}
      ${phase(4, 'Overenie', 'po opravách', [], 'Vykonajte manuálne testovanie podľa kontrolného zoznamu, otestujte web s čítačkou obrazovky (NVDA, VoiceOver) a zopakujte audit. Aktualizujte vyhlásenie o prístupnosti.')}
    </section>`;
  }

  /* ---------- 8. Manuálne testy ---------- */
  let manual = '';
  if (tier.manual) {
    manual = `
    <section class="page">
      <h2><span class="num">${tier.plan ? 7 : 6}</span> Kontrolný zoznam manuálnych testov</h2>
      <p>Automatické nástroje odhalia približne 30–40 % problémov prístupnosti. Nasledujúce kritériá je potrebné overiť človekom.</p>
      <table class="tbl check">
        <thead><tr><th></th><th>Kritérium</th><th>Čo overiť a ako</th></tr></thead>
        <tbody>${MANUAL_CHECKS.map(([sc, title, how]) => `<tr><td><span class="box"></span></td>
          <td><b>${esc(sc)}</b><div class="small muted">${esc(SC[sc]?.name || '')} (${SC[sc]?.level || ''})</div></td>
          <td><b>${esc(title)}</b><div class="small">${esc(how)}</div></td></tr>`).join('')}</tbody>
      </table>
      ${a.incomplete.length ? `
        <h3>Prvky, ktoré automat označil na ručné overenie</h3>
        <table class="tbl"><thead><tr><th>Kontrola</th><th>WCAG</th><th class="r">Prvky</th></tr></thead>
        <tbody>${a.incomplete.map((x) => `<tr><td>${esc(x.title)}</td><td>${esc(x.sc.join(', '))}</td><td class="r">${x.nodeCount}</td></tr>`).join('')}</tbody></table>` : ''}
    </section>`;
  }

  /* ---------- 9. Vyhlásenie o prístupnosti (Pro) ---------- */
  let statement = '';
  if (tier.statement) {
    const stLabel = a.conformance.key === 'pass' ? 'v plnom súlade' : a.conformance.key === 'partial' ? 'čiastočne v súlade' : 'čiastočne v súlade';
    statement = `
    <section class="page">
      <h2><span class="num">8</span> Šablóna: Vyhlásenie o prístupnosti</h2>
      <p class="muted small">Predvyplnený návrh na zverejnenie na webe (napr. na adrese /pristupnost). Údaje v [hranatých zátvorkách] doplňte. Po opravách text aktualizujte.</p>
      <div class="statement">
        <h3>Vyhlásenie o prístupnosti</h3>
        <p>[Názov spoločnosti], [IČO], sa zaväzuje zabezpečiť prístupnosť svojej webovej stránky <b>${esc(a.host)}</b> v súlade so zákonom č. 351/2022 Z. z. o požiadavkách na prístupnosť výrobkov a služieb a smernicou (EÚ) 2019/882.</p>
        <p><b>Stav súladu:</b> Táto webová stránka je <b>${stLabel}</b> s normou EN 301 549 V3.2.1 a pravidlami WCAG 2.1 na úrovni AA${a.issues.length ? ' z dôvodov uvedených nižšie' : ''}.</p>
        ${a.issues.length ? `<p><b>Neprístupný obsah:</b></p><ul>${a.issues.slice(0, 12).map((i) => `<li>${esc(i.title)} (WCAG ${i.sc.map((s) => s.id).join(', ')}).</li>`).join('')}</ul>
        <p>Na odstránení uvedených nedostatkov pracujeme, predpokladaný termín: [dátum].</p>` : ''}
        <p><b>Vypracovanie vyhlásenia:</b> Vyhlásenie bolo vypracované dňa ${fmtDate(a.scannedAt)} na základe auditu vykonaného kombináciou automatického testovania (axe-core ${esc(a.axeVersion)}) a [manuálneho testovania].</p>
        <p><b>Spätná väzba a kontakt:</b> Ak narazíte na problém s prístupnosťou, kontaktujte nás na [e-mail], [telefón]. Odpovieme do [počet] pracovných dní.</p>
        <p><b>Vymáhanie:</b> Ak nie ste spokojní s odpoveďou, môžete sa obrátiť na príslušný orgán dohľadu nad trhom [doplniť podľa sektora].</p>
      </div>
    </section>`;
  }

  /* ---------- 10. Metodika ---------- */
  const methodology = `
  <section class="page">
    <h2><span class="num">${tier.statement ? 9 : tier.manual ? 7 : 6}</span> Metodika a obmedzenia</h2>
    <ul>
      <li>Web bol načítaný v prehliadači Chromium (rozlíšenie 1280 × 900 px) a otestovaný knižnicou <b>axe-core ${esc(a.axeVersion)}</b> s pravidlami WCAG 2.0, 2.1 a 2.2 úrovne A a AA.</li>
      <li>Podstránky boli vybrané automaticky z odkazov na webe (prioritne kontakt, produkty, košík, formuláre, právne informácie). Rozsah balíka ${esc(tier.name)}: max. ${tier.pages} podstránok.</li>
      <li>Skóre (0–100) vyjadruje počet a závažnosť automaticky zistených problémov. Nie je to percento splnených kritérií.</li>
      <li>Automatické testovanie neodhalí všetky bariéry – napr. zrozumiteľnosť textov, ovládanie klávesnicou, kvalitu alternatívnych textov či titulkov. Na potvrdenie plnej zhody je potrebné manuálne testovanie a testovanie s používateľmi.</li>
      <li>Obsah za prihlásením, v PDF dokumentoch a v mobilných aplikáciách nebol testovaný.</li>
      <li>Výsledok platí ku dňu auditu (${fmtDate(a.scannedAt)}). Zmeny na webe môžu stav ovplyvniť.</li>
    </ul>
    <div class="note">Správa slúži ako technický podklad na zlepšenie prístupnosti. Nepredstavuje certifikát zhody ani právne stanovisko.</div>
  </section>`;

  return `<!doctype html><html lang="sk"><head><meta charset="utf-8">
<title>Audit prístupnosti – ${esc(a.host)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono&display=swap">
<style>${CSS}</style></head><body>
${cover}${summary}${legal}${criteria}${issues}${pages}${plan}${manual}${statement}${methodology}
</body></html>`;
}

const CSS = `
@page { size: A4; margin: 18mm 16mm 20mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, "Segoe UI", "DejaVu Sans", Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #1d2333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 34pt; line-height: 1.05; letter-spacing: -0.03em; margin: 28mm 0 4mm; font-weight: 800; }
h2 { font-size: 17pt; letter-spacing: -0.02em; margin: 0 0 5mm; display: flex; align-items: center; gap: 10px; }
h3 { font-size: 11.5pt; margin: 6mm 0 2mm; break-after: avoid; }
.keep { break-inside: avoid; }
p { margin: 0 0 3mm; }
ul { margin: 0 0 3mm; padding-left: 5mm; } li { margin-bottom: 1mm; }
.num { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: linear-gradient(135deg,#6d5dfc,#2ec5ff); color: #fff; font-size: 11pt; }
.muted { color: #6b7287; } .small { font-size: 8.5pt; }
.mono, pre { font-family: "JetBrains Mono", "DejaVu Sans Mono", monospace; }
.lead { font-size: 11pt; }
.page { break-before: page; }
.cover { height: 257mm; position: relative; }
.cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
.brand { font-weight: 800; font-size: 13pt; display: flex; align-items: center; gap: 8px; }
.mark { width: 28px; height: 28px; border-radius: 9px; display: inline-grid; place-items: center; color: #fff; background: linear-gradient(135deg,#6d5dfc,#2ec5ff); }
.cover-meta { text-align: right; font-size: 9pt; color: #6b7287; }
.cover-sub { color: #6b7287; font-size: 11.5pt; }
.cover-site { margin: 10mm 0 8mm; padding: 5mm 6mm; border-radius: 12px; background: #f4f5fa; border-left: 5px solid #6d5dfc; }
.cover-site .host { font-size: 18pt; font-weight: 750; }
.cover-grid { display: grid; grid-template-columns: 62mm 1fr; gap: 8mm; align-items: center; }
.cover-score { text-align: center; }
.status { display: inline-block; padding: 2mm 5mm; border: 2px solid; border-radius: 99px; font-weight: 750; font-size: 12pt; margin-bottom: 3mm; }
.shot { position: absolute; bottom: 0; left: 0; right: 0; height: 62mm; border-radius: 12px; overflow: hidden; border: 1px solid #e3e6ee; }
.shot img { width: 100%; display: block; }
table { width: 100%; border-collapse: collapse; }
.mini td { padding: 1.2mm 0; border-bottom: 1px solid #eef0f5; font-size: 9pt; }
.mini td:first-child { color: #6b7287; width: 38mm; }
.tbl { margin: 2mm 0 4mm; font-size: 9pt; }
.tbl th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: #6b7287; padding: 2mm; border-bottom: 2px solid #e3e6ee; }
.tbl td { padding: 2mm; border-bottom: 1px solid #eef0f5; vertical-align: top; }
.tbl tr { break-inside: avoid; }
.r { text-align: right; }
.badge { display: inline-block; padding: 0.6mm 2.5mm; border-radius: 99px; font-weight: 650; font-size: 8pt; white-space: nowrap; }
.tag { display: inline-block; padding: 0.4mm 2mm; border-radius: 5px; background: #eef0f6; color: #464d63; font-size: 7.5pt; margin: 0 1mm 1mm 0; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 4mm 0; }
.kpi { padding: 4mm; border-radius: 10px; background: #f6f7fb; }
.kpi-n { font-size: 24pt; font-weight: 800; line-height: 1; }
.kpi-l { font-weight: 650; margin-top: 1mm; }
.principles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; break-inside: avoid; }
.pr { break-inside: avoid; }
.pr { padding: 3mm; font-size: 8.5pt; border-radius: 10px; border: 1px solid #e3e6ee; }
.pr.bad { border-left: 4px solid #ef4444; } .pr.good { border-left: 4px solid #12b76a; }
.pr-n { font-weight: 700; } .pr-v { font-size: 11pt; font-weight: 750; margin: 1mm 0; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
.note { margin-top: 6mm; padding: 3.5mm 4.5mm; border-radius: 10px; background: #fff8e6; border: 1px solid #f5d98a; font-size: 9pt; }
.ok { color: #12b76a; font-weight: 600; }
.st { font-weight: 650; font-size: 8.5pt; } .st-fail { color: #ef4444; } .st-pass { color: #12b76a; } .st-manual { color: #8a90a2; }
.crit td { padding: 1.4mm 2mm; }
.issue { border: 1px solid #e3e6ee; border-radius: 12px; padding: 4.5mm 5mm; margin-bottom: 5mm; }
.issue-head, .issue-meta, .mini, .fix { break-inside: avoid; break-after: avoid; }
.ex { break-inside: avoid; }
.issue-head { display: flex; justify-content: space-between; align-items: center; gap: 4mm; font-size: 11pt; margin-bottom: 2mm; }
.issue-n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; background: #eef0f6; font-size: 8.5pt; font-weight: 700; margin-right: 4px; }
.issue-meta { margin-bottom: 2mm; }
.fix { margin: 3mm 0; padding: 3mm 4mm; background: #f1efff; border-left: 3px solid #6d5dfc; border-radius: 6px; }
.ex { margin: 2mm 0; }
.ex-page { font-size: 7.5pt; color: #6b7287; margin-bottom: 1mm; word-break: break-all; }
pre { margin: 0; padding: 2.5mm 3mm; background: #0f1320; color: #e6e9f2; border-radius: 6px; font-size: 7.3pt; white-space: pre-wrap; word-break: break-all; }
.phase { border: 1px solid #e3e6ee; border-radius: 12px; padding: 4mm 5mm; margin-bottom: 4mm; break-inside: avoid; }
.phase-h { display: flex; gap: 3mm; align-items: center; margin-bottom: 2mm; }
.phase-n { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #6d5dfc; color: #fff; font-weight: 700; }
.check .box { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #8a90a2; border-radius: 3px; }
.statement { border: 1px dashed #b9bfd0; border-radius: 12px; padding: 6mm; background: #fbfbfd; }
.statement h3 { margin-top: 0; }
`;

/* ======================= Render do PDF ======================= */

async function renderPdf(audit, order) {
  const html = buildHtml(audit, order);
  return withPage(async (page) => {
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    return page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#8a90a2;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif">
        <span>Audit prístupnosti · ${esc(audit.host)} · ${fmtDate(audit.scannedAt)}</span>
        <span>Strana <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
  });
}

module.exports = { renderPdf, buildHtml };

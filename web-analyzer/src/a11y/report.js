'use strict';

const fs = require('fs');
const path = require('path');
const { withPage } = require('./browser');
const { impactLabel, manualChecksIn, scIn } = require('./wcag');
const { ALL_TIERS, localizeTier } = require('./tiers');

const SITE_NAME = process.env.SITE_NAME || 'Web Analyzer';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const scoreColor = (s) => (s >= 90 ? '#12b76a' : s >= 65 ? '#e0a100' : s >= 50 ? '#f97316' : '#ef4444');
const IMPACT_COLOR = { critical: '#b42318', serious: '#ef4444', moderate: '#f59e0b', minor: '#64748b' };
const short = (u, n = 70) => { const s = String(u).replace(/^https?:\/\//, ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// Lokálny font (bez závislosti od siete pri generovaní PDF)
const FONT_DIR = path.join(__dirname, '..', '..', 'public', 'fonts');
const fontData = (f) => { try { return fs.readFileSync(path.join(FONT_DIR, f)).toString('base64'); } catch { return null; } };
const FONTS = [['inter-latin-wght-normal.woff2', 'U+0000-00FF, U+2000-206F, U+20AC, U+2190-2193, U+2212'], ['inter-latin-ext-wght-normal.woff2', 'U+0100-02FF, U+1E00-1EFF']]
  .map(([f, range]) => { const d = fontData(f); return d ? `@font-face { font-family: 'Inter'; font-weight: 100 900; src: url(data:font/woff2;base64,${d}) format('woff2'); unicode-range: ${range}; }` : ''; })
  .join('\n');

function ringSvg(score, size = 180, stroke = 16) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e7e9f0" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${scoreColor(score)}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.3}" font-weight="800" fill="#0e1220">${score}</text>
  </svg>`;
}

/* ======================= Šablóna správy ======================= */

function buildHtml(audit, order) {
  const lang = order.lang || audit.lang || 'sk';
  const L = (sk, en) => (lang === 'en' ? en : sk);
  const fmtDate = (d) => new Date(d).toLocaleDateString(L('sk-SK', 'en-GB'), { day: 'numeric', month: 'long', year: 'numeric' });
  const plural = (n, sk1, sk2, sk5, en1, en2) => (lang === 'en' ? (n === 1 ? en1 : en2) : n === 1 ? sk1 : n >= 2 && n <= 4 ? sk2 : sk5);
  const badge = (impact) => `<span class="badge" style="background:${IMPACT_COLOR[impact]}1a;color:${IMPACT_COLOR[impact]}">${esc(impactLabel(impact, lang) || impact)}</span>`;
  const tier = localizeTier(ALL_TIERS[order.tier], lang);
  const a = audit;
  let secNo = 0;
  const num = () => `<span class="num">${++secNo}</span>`;
  const VP = { desktop: L('počítač', 'desktop'), mobile: L('mobil', 'mobile') };
  const crit = a.counts.critical + a.counts.serious;
  const statusColor = a.conformance.key === 'fail' ? '#ef4444' : a.conformance.key === 'partial' ? '#e0a100' : '#12b76a';

  /* ---------- 1. Titulná strana ---------- */
  const cover = `
  <section class="cover">
    <div class="cover-top">
      <div class="brand"><span class="mark">◎</span> ${esc(SITE_NAME)}</div>
      <div class="cover-meta">${L('Číslo správy', 'Report no.')}: <b>${esc(order.id.slice(0, 8).toUpperCase())}</b><br>${order.tier === 'monitor' ? L('Mesačný monitoring', 'Monthly monitoring') : `${L('Balík', 'Plan')}: <b>${esc(tier.name)}</b>`}</div>
    </div>
    <h1>${L('Audit prístupnosti webu', 'Website accessibility audit')}</h1>
    <p class="cover-sub">${L('podľa Európskeho aktu o prístupnosti (EAA), zákona č. 351/2022 Z. z.<br>a normy EN 301 549 / WCAG 2.1 a 2.2, úroveň AA', 'under the European Accessibility Act (EAA), Directive (EU) 2019/882<br>and EN 301 549 / WCAG 2.1 and 2.2, level AA')}</p>
    <div class="cover-site">
      <div class="host">${esc(a.host)}</div>
      <div class="muted">${esc(a.title)}</div>
    </div>
    <div class="cover-grid">
      <div class="cover-score">${ringSvg(a.score)}<div class="muted">${L('Skóre prístupnosti', 'Accessibility score')}</div></div>
      <div>
        <div class="status" style="border-color:${statusColor};color:${statusColor}">${esc(a.conformance.label)}</div>
        <p>${esc(a.conformance.text)}</p>
        <table class="mini">
          <tr><td>${L('Dátum auditu', 'Audit date')}</td><td>${fmtDate(a.scannedAt)}</td></tr>
          <tr><td>${L('Analyzované podstránky', 'Pages analysed')}</td><td>${a.pages.length}${a.mobilePages?.length ? L(` + ${a.mobilePages.length} v mobilnom zobrazení`, ` + ${a.mobilePages.length} in mobile view`) : ''}</td></tr>
          <tr><td>${L('Typy problémov', 'Issue types')}</td><td>${a.issues.length}</td></tr>
          <tr><td>${L('Výskyty problémov', 'Issue occurrences')}</td><td>${a.totalNodes}</td></tr>
        </table>
      </div>
    </div>
    ${a.screenshot ? `<div class="shot"><img src="data:image/jpeg;base64,${a.screenshot}" alt=""></div>` : ''}
  </section>`;

  /* ---------- 2. Zhrnutie ---------- */
  const topIssues = a.issues.slice(0, 5);
  const summary = `
  <section class="page">
    <h2>${num()} ${L('Zhrnutie pre vedenie', 'Executive summary')}</h2>
    <p class="lead">${crit
      ? L(`Na webe <b>${esc(a.host)}</b> sme automatickým testom našli <b>${crit} ${plural(crit, 'kritický alebo závažný typ problému', 'kritické alebo závažné typy problémov', 'kritických alebo závažných typov problémov')}</b>, ktoré bránia ľuďom so zdravotným postihnutím web plnohodnotne používať. Tieto chyby sú v rozpore s požiadavkami WCAG 2.1 AA, na ktoré odkazuje EAA.`,
        `On <b>${esc(a.host)}</b> our automated test found <b>${crit} critical or serious issue type${crit === 1 ? '' : 's'}</b> that prevent people with disabilities from using the website fully. These issues conflict with the WCAG 2.1 AA requirements referenced by the EAA.`)
      : a.issues.length
        ? L(`Web <b>${esc(a.host)}</b> nemá kritické ani závažné automaticky zistiteľné chyby. Zistili sme však ${a.issues.length} menej závažných nedostatkov, ktoré odporúčame odstrániť.`,
          `<b>${esc(a.host)}</b> has no critical or serious issues detectable by automated testing. We did find ${a.issues.length} minor issue${a.issues.length === 1 ? '' : 's'} we recommend fixing.`)
        : L(`Automatický test webu <b>${esc(a.host)}</b> nezistil žiadne porušenia testovateľných kritérií WCAG. Pre plnú zhodu odporúčame doplniť manuálne testovanie.`,
          `The automated test of <b>${esc(a.host)}</b> found no violations of testable WCAG criteria. To confirm full conformance we recommend adding manual testing.`)}</p>

    <div class="kpis">
      ${['critical', 'serious', 'moderate', 'minor'].map((k) => `
        <div class="kpi" style="border-top:4px solid ${IMPACT_COLOR[k]}">
          <div class="kpi-n">${a.counts[k]}</div>
          <div class="kpi-l">${impactLabel(k, lang)}</div>
          <div class="muted small">${a.nodeCounts[k]} ${plural(a.nodeCounts[k], 'výskyt', 'výskyty', 'výskytov', 'occurrence', 'occurrences')}</div>
        </div>`).join('')}
    </div>

    <h3>${L('Ako čítať závažnosť', 'How to read severity')}</h3>
    <table class="tbl">
      <tr><td>${badge('critical')}</td><td>${L('Úplne znemožňuje používanie časti webu (napr. tlačidlo bez názvu pre nevidiaceho).', 'Completely blocks use of part of the site (e.g. an unnamed button for a blind user).')}</td></tr>
      <tr><td>${badge('serious')}</td><td>${L('Výrazne sťažuje používanie, často porušuje kritériá úrovne A/AA.', 'Makes use significantly harder; often fails level A/AA criteria.')}</td></tr>
      <tr><td>${badge('moderate')}</td><td>${L('Spôsobuje ťažkosti, existuje však obchádzka.', 'Causes difficulties, but a workaround exists.')}</td></tr>
      <tr><td>${badge('minor')}</td><td>${L('Drobný nedostatok, ktorý zhoršuje komfort.', 'A minor flaw that reduces comfort.')}</td></tr>
    </table>

    <h3>${L('Najdôležitejšie zistenia', 'Key findings')}</h3>
    ${topIssues.length ? `<table class="tbl">
      <thead><tr><th>${L('Problém', 'Issue')}</th><th>${L('Závažnosť', 'Severity')}</th><th>WCAG</th><th class="r">${L('Stránky', 'Pages')}</th></tr></thead>
      <tbody>${topIssues.map((i) => `<tr><td>${esc(i.title)}</td><td>${badge(i.impact)}</td><td>${i.sc.map((s) => esc(s.id)).join(', ')}</td><td class="r">${i.pages.length}/${a.pages.length}</td></tr>`).join('')}</tbody>
    </table>` : `<p class="ok">${L('Bez zistených problémov.', 'No issues found.')}</p>`}

    <div class="keep">
    <h3>${L('Výsledok podľa princípov WCAG', 'Results by WCAG principle')}</h3>
    <div class="principles">
      ${Object.entries(a.principles).map(([k, p]) => `
        <div class="pr ${p.issues ? 'bad' : 'good'}">
          <div class="pr-n">${k}. ${esc(p.name)}</div>
          <div class="pr-v">${p.issues ? `${p.issues} ${plural(p.issues, 'problém', 'problémy', 'problémov', 'issue', 'issues')}` : L('Bez chýb', 'No issues')}</div>
          <div class="muted small">${esc(p.desc)}</div>
        </div>`).join('')}
    </div>
    </div>
  </section>`;

  /* ---------- 2b. Porovnanie s predchádzajúcim auditom (monitoring) ---------- */
  let comparison = '';
  if (a.comparison) {
    const c = a.comparison;
    const d = c.scoreDelta;
    const row = (i, extra = '') => `<tr><td>${esc(i.title)}</td><td>${badge(i.impact)}</td><td class="r">${extra || i.nodeCount + '×'}</td></tr>`;
    comparison = `
    <section class="page">
      <h2>${num()} ${L('Zmeny od posledného auditu', 'Changes since the last audit')}</h2>
      <p class="lead">${L('Predchádzajúci audit', 'Previous audit')}: ${fmtDate(c.previousDate)}. ${L('Skóre sa zmenilo z', 'The score changed from')} <b>${c.previousScore}</b> ${L('na', 'to')} <b>${a.score}</b>
        (<b style="color:${d > 0 ? '#12b76a' : d < 0 ? '#ef4444' : '#6b7287'}">${d > 0 ? '+' : ''}${d}</b>).</p>
      <div class="kpis kpis-3">
        <div class="kpi" style="border-top:4px solid #12b76a"><div class="kpi-n">${c.fixedIssues.length}</div><div class="kpi-l">${L('Opravené problémy', 'Fixed issues')}</div></div>
        <div class="kpi" style="border-top:4px solid #ef4444"><div class="kpi-n">${c.newIssues.length}</div><div class="kpi-l">${L('Nové problémy', 'New issues')}</div></div>
        <div class="kpi" style="border-top:4px solid #e0a100"><div class="kpi-n">${c.changed.length}</div><div class="kpi-l">${L('Zmenený počet výskytov', 'Changed occurrence count')}</div></div>
      </div>
      ${c.newIssues.length ? `<h3>${L('Nové problémy', 'New issues')}</h3><table class="tbl"><tbody>${c.newIssues.map((i) => row(i)).join('')}</tbody></table>` : ''}
      ${c.fixedIssues.length ? `<h3>${L('Opravené problémy', 'Fixed issues')}</h3><table class="tbl"><tbody>${c.fixedIssues.map((i) => row(i)).join('')}</tbody></table>` : ''}
      ${c.changed.length ? `<h3>${L('Zmenený počet výskytov', 'Changed occurrence count')}</h3><table class="tbl"><tbody>${c.changed.map((i) => row(i, `${i.before}× → <b>${i.after}×</b>`)).join('')}</tbody></table>` : ''}
      ${!c.newIssues.length && !c.fixedIssues.length && !c.changed.length ? `<p class="muted">${L('Od posledného auditu sa výsledky nezmenili.', 'Results have not changed since the last audit.')}</p>` : ''}
    </section>`;
  }

  /* ---------- 3. Právny rámec ---------- */
  const legal = L(`
  <section class="page">
    <h2>${num()} Právny rámec</h2>
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
  </section>`, `
  <section class="page">
    <h2>${num()} Legal context</h2>
    <div class="cols">
      <div>
        <h3>European Accessibility Act (EAA)</h3>
        <p>Directive (EU) 2019/882 on the accessibility requirements for products and services. It has been transposed into national law in every EU member state and applies from <b>28 June 2025</b>.</p>
        <h3>Who it applies to</h3>
        <ul>
          <li>e-commerce (online stores, online ordering),</li>
          <li>consumer banking and financial services,</li>
          <li>electronic communications, e-books, access to audiovisual media services,</li>
          <li>certain passenger transport services (websites, apps, ticketing).</li>
        </ul>
        <p class="small muted">Micro-enterprises providing services (fewer than 10 employees and annual turnover or balance sheet up to €2 million) are generally exempt from the service obligations. The public sector is covered by the separate Directive (EU) 2016/2102.</p>
      </div>
      <div>
        <h3>Technical standard</h3>
        <p>In practice, conformity is presumed when a site meets the harmonised standard <b>EN 301 549</b>, which adopts <b>WCAG 2.1 levels A and AA</b> for web content. This report also covers the new WCAG 2.2 criteria.</p>
        <h3>What the EAA requires of service providers</h3>
        <ul>
          <li>an accessible website and mobile app meeting these criteria,</li>
          <li>published information on how the service meets accessibility requirements (e.g. an accessibility statement),</li>
          <li>ongoing compliance as the website changes.</li>
        </ul>
        <p class="small muted">National market surveillance authorities enforce compliance and may impose penalties for non-compliance.</p>
      </div>
    </div>
    <div class="note">This report is a technical audit, not legal advice. We recommend confirming with a lawyer whether the EAA applies to your service.</div>
  </section>`);

  /* ---------- 4. Tabuľka kritérií ---------- */
  const critRows = (tier.criteria ? a.criteria : a.criteria.filter((c) => c.status === 'fail'));
  const stLabel = { fail: L('Nevyhovuje', 'Fails'), pass: L('Bez zistených chýb', 'No issues found'), manual: L('Overiť manuálne', 'Verify manually') };
  const criteria = `
  <section class="page">
    <h2>${num()} ${tier.criteria ? L('Stav kritérií WCAG a EN 301 549', 'Status of WCAG and EN 301 549 criteria') : L('Porušené kritériá WCAG', 'Failed WCAG criteria')}</h2>
    <p>${tier.criteria
      ? L('Prehľad všetkých kritérií úrovne A a AA. <b>Nevyhovuje</b> = test zistil porušenie. <b>Bez zistených chýb</b> = automatické pravidlá pre toto kritérium prebehli bez nálezu; <i>neznamená to</i> potvrdenie plnej zhody, keďže automat overí len časť požiadaviek kritéria. <b>Overiť manuálne</b> = automat kritérium nedokáže testovať.',
        'All level A and AA criteria. <b>Fails</b> = the test found a violation. <b>No issues found</b> = the automated rules for this criterion found nothing; this <i>does not</i> confirm full conformance, as automation verifies only part of each criterion. <b>Verify manually</b> = the criterion cannot be tested automatically.')
      : L('Kritériá, pri ktorých automatický test zistil porušenie.', 'Criteria where the automated test found a violation.')}</p>
    ${critRows.length ? `<table class="tbl crit">
      <thead><tr><th>${L('Kritérium', 'Criterion')}</th><th>${L('Názov', 'Name')}</th><th>${L('Úroveň', 'Level')}</th><th>EN 301 549</th><th>${L('Stav', 'Status')}</th></tr></thead>
      <tbody>${critRows.map((c) => `<tr>
        <td><b>${esc(c.id)}</b></td><td>${esc(c.name)}${c.ver === '2.2' ? ' <span class="tag">2.2</span>' : ''}</td><td>${c.level}</td>
        <td>${c.en301549 || '—'}</td>
        <td><span class="st st-${c.status}">${stLabel[c.status]}</span></td></tr>`).join('')}</tbody>
    </table>` : `<p class="ok">${L('Žiadne porušené kritériá.', 'No failed criteria.')}</p>`}
  </section>`;

  /* ---------- 5. Detail problémov ---------- */
  const issues = `
  <section class="page">
    <h2>${num()} ${L('Zistené problémy a ich oprava', 'Issues found and how to fix them')}</h2>
    ${a.issues.length ? '' : `<p class="ok">${L('Automatický test nenašiel žiadne problémy.', 'The automated test found no issues.')}</p>`}
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
          <tr><td>${L('Výskyt', 'Occurrences')}</td><td>${L(`${i.nodeCount}× na ${i.pages.length} z ${a.pages.length} podstránok`, `${i.nodeCount}× on ${i.pages.length} of ${a.pages.length} pages`)}</td></tr>
          ${i.affects ? `<tr><td>${L('Koho sa týka', 'Who is affected')}</td><td>${esc(i.affects)}</td></tr>` : ''}
          <tr><td>${L('Zobrazenie', 'View')}</td><td>${(i.viewports || ['desktop']).map((v) => VP[v] || v).join(', ')}</td></tr>
          <tr><td>${L('Zdroj', 'Source')}</td><td>${i.custom ? L(`vlastný test ${esc(SITE_NAME)} (simulácia klávesnice / zobrazenia)`, `${esc(SITE_NAME)} custom test (keyboard / layout simulation)`) : 'axe-core'} · <span class="mono">${esc(i.id)}</span></td></tr>
        </table>
        <div class="fix"><b>${L('Ako opraviť', 'How to fix')}:</b> ${esc(i.fix)}</div>
        ${i.examples.slice(0, tier.examples).map((e) => `
          <div class="ex">
            <div class="ex-page">${esc(short(e.page))}${e.viewport === 'mobile' ? ` · <b>${VP.mobile}</b>` : ''} · <span class="mono">${esc(e.target.slice(0, 120))}</span></div>
            ${e.shot ? `<img class="ex-shot" src="data:image/jpeg;base64,${e.shot}" alt="">` : ''}
            <pre>${esc(e.html)}</pre>
            ${i.custom && e.summary ? `<div class="small muted">${esc(e.summary)}</div>` : ''}
          </div>`).join('')}
        ${i.pages.length > 1 ? `<div class="small muted">${L('Podstránky', 'Pages')}: ${i.pages.slice(0, 6).map((p) => esc(short(p, 50))).join(', ')}${i.pages.length > 6 ? L(` a ďalších ${i.pages.length - 6}`, ` and ${i.pages.length - 6} more`) : ''}</div>` : ''}
      </article>`).join('')}
  </section>`;

  /* ---------- 6. Podstránky ---------- */
  const pages = `
  <section class="page">
    <h2>${num()} ${L('Analyzované podstránky', 'Pages analysed')}</h2>
    <table class="tbl">
      <thead><tr><th>#</th><th>${L('Stránka', 'Page')}</th><th class="r">${L('Skóre', 'Score')}</th><th class="r">${L('Typy chýb', 'Issue types')}</th><th class="r">${L('Výskyty', 'Occurrences')}</th></tr></thead>
      <tbody>${a.pages.map((p, i) => `<tr>
        <td>${i + 1}</td>
        <td><div>${esc(short(p.url, 80))}</div>${p.title ? `<div class="muted small">${esc(p.title.slice(0, 90))}</div>` : ''}${p.error ? `<div class="small" style="color:#ef4444">${esc(p.error)}</div>` : ''}</td>
        <td class="r"><b style="color:${p.score == null ? '#64748b' : scoreColor(p.score)}">${p.score ?? '—'}</b></td>
        <td class="r">${p.error ? '—' : p.violations}</td><td class="r">${p.error ? '—' : p.nodes}</td></tr>`).join('')}</tbody>
    </table>
    ${a.mobilePages?.length ? `
      <h3>${L('Mobilné zobrazenie', 'Mobile view')} (390 × 844 px)</h3>
      <table class="tbl">
        <thead><tr><th>${L('Stránka', 'Page')}</th><th class="r">${L('Skóre', 'Score')}</th><th class="r">${L('Typy chýb', 'Issue types')}</th></tr></thead>
        <tbody>${a.mobilePages.map((p) => `<tr><td>${esc(short(p.url, 80))}</td><td class="r"><b style="color:${scoreColor(p.score)}">${p.score}</b></td><td class="r">${p.violations}</td></tr>`).join('')}</tbody>
      </table>` : ''}
    ${a.keyboard ? `<p class="small muted">${L(`Test klávesnice na úvodnej stránke: ${a.keyboard.tabStops} zastávok klávesom Tab, vizuálne overený fokus na ${a.keyboard.visualTests} typoch prvkov.`, `Keyboard test on the homepage: ${a.keyboard.tabStops} Tab stops, focus visibility verified on ${a.keyboard.visualTests} element types.`)}</p>` : ''}
    ${a.consent?.dismissed ? `<p class="small muted">${L(`Cookie lišta bola otestovaná a potom zatvorená tlačidlom „${esc(a.consent.label)}“. Problémy lišty sú v správe označené ako [cookie lišta].`, `The cookie banner was tested and then closed with the “${esc(a.consent.label)}” button. Banner issues are marked [cookie banner] in this report.`)}</p>` : ''}
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
        ${list.length ? `<ul>${list.map((i) => `<li>${esc(i.title)} <span class="muted">(${i.nodeCount}×, WCAG ${i.sc.map((s) => s.id).join(', ')})</span></li>`).join('')}</ul>` : `<p class="muted small">${L('Žiadne položky.', 'No items.')}</p>`}
      </div>`;
    plan = `
    <section class="page">
      <h2>${num()} ${L('Plán nápravy', 'Remediation plan')}</h2>
      <p>${L('Odporúčané poradie opráv podľa dopadu na používateľov a právneho rizika.', 'Recommended order of fixes by user impact and legal risk.')}</p>
      ${phase(1, L('Okamžite – blokujúce bariéry', 'Immediately – blocking barriers'), L('odporúčaný termín: do 2 týždňov', 'recommended: within 2 weeks'), p1, L('Kritické chyby a závažné porušenia úrovne A. Bránia používateľom dokončiť nákup, odoslať formulár alebo sa zorientovať.', 'Critical issues and serious level A violations. They stop users from completing a purchase, submitting a form or finding their way.'))}
      ${phase(2, L('Krátkodobo – závažné nedostatky', 'Short term – serious issues'), L('odporúčaný termín: do 1–2 mesiacov', 'recommended: within 1–2 months'), p2, L('Zostávajúce závažné a stredné problémy úrovne AA (kontrast, popisy, štruktúra).', 'Remaining serious and moderate level AA issues (contrast, labels, structure).'))}
      ${phase(3, L('Priebežne – vylepšenia', 'Ongoing – improvements'), L('pri najbližšom vývoji', 'in your next development cycle'), p3, L('Drobné nedostatky a vylepšenia komfortu.', 'Minor issues and comfort improvements.'))}
      ${phase(4, L('Overenie', 'Verification'), L('po opravách', 'after the fixes'), [], L('Vykonajte manuálne testovanie podľa kontrolného zoznamu, otestujte web s čítačkou obrazovky (NVDA, VoiceOver) a zopakujte audit. Aktualizujte vyhlásenie o prístupnosti.', 'Run manual tests from the checklist, test the site with a screen reader (NVDA, VoiceOver) and repeat the audit. Update your accessibility statement.'))}
    </section>`;
  }

  /* ---------- 8. Manuálne testy ---------- */
  let manual = '';
  if (tier.manual) {
    manual = `
    <section class="page">
      <h2>${num()} ${L('Kontrolný zoznam manuálnych testov', 'Manual testing checklist')}</h2>
      <p>${L('Automatické nástroje odhalia približne 30–40 % problémov prístupnosti. Nasledujúce kritériá je potrebné overiť človekom.', 'Automated tools detect roughly 30–40% of accessibility issues. The following criteria need to be verified by a person.')}</p>
      <table class="tbl check">
        <thead><tr><th></th><th>${L('Kritérium', 'Criterion')}</th><th>${L('Čo overiť a ako', 'What to check and how')}</th></tr></thead>
        <tbody>${manualChecksIn(lang).map(([sc, title, how]) => { const c = scIn(sc, lang); return `<tr><td><span class="box"></span></td>
          <td><b>${esc(sc)}</b><div class="small muted">${esc(c?.name || '')} (${c?.level || ''})</div></td>
          <td><b>${esc(title)}</b><div class="small">${esc(how)}</div></td></tr>`; }).join('')}</tbody>
      </table>
      ${a.incomplete.length ? `
        <h3>${L('Prvky, ktoré automat označil na ručné overenie', 'Elements flagged for manual review')}</h3>
        <table class="tbl"><thead><tr><th>${L('Kontrola', 'Check')}</th><th>WCAG</th><th class="r">${L('Prvky', 'Elements')}</th></tr></thead>
        <tbody>${a.incomplete.map((x) => `<tr><td>${esc(x.title)}</td><td>${esc(x.sc.join(', '))}</td><td class="r">${x.nodeCount}</td></tr>`).join('')}</tbody></table>` : ''}
    </section>`;
  }

  /* ---------- 9. Vyhlásenie o prístupnosti (Pro) ---------- */
  let statement = '';
  if (tier.statement) {
    const full = a.conformance.key === 'pass';
    const list = a.issues.length ? `<ul>${a.issues.slice(0, 12).map((i) => `<li>${esc(i.title)} (WCAG ${i.sc.map((s) => s.id).join(', ')}).</li>`).join('')}</ul>` : '';
    statement = L(`
    <section class="page">
      <h2>${num()} Šablóna: Vyhlásenie o prístupnosti</h2>
      <p class="muted small">Predvyplnený návrh na zverejnenie na webe (napr. na adrese /pristupnost). Údaje v [hranatých zátvorkách] doplňte. Po opravách text aktualizujte.</p>
      <div class="statement">
        <h3>Vyhlásenie o prístupnosti</h3>
        <p>[Názov spoločnosti], [IČO], sa zaväzuje zabezpečiť prístupnosť svojej webovej stránky <b>${esc(a.host)}</b> v súlade so zákonom č. 351/2022 Z. z. o požiadavkách na prístupnosť výrobkov a služieb a smernicou (EÚ) 2019/882.</p>
        <p><b>Stav súladu:</b> Táto webová stránka je <b>${full ? 'v plnom súlade' : 'čiastočne v súlade'}</b> s normou EN 301 549 V3.2.1 a pravidlami WCAG 2.1 na úrovni AA${a.issues.length ? ' z dôvodov uvedených nižšie' : ''}.</p>
        ${list ? `<p><b>Neprístupný obsah:</b></p>${list}<p>Na odstránení uvedených nedostatkov pracujeme, predpokladaný termín: [dátum].</p>` : ''}
        <p><b>Vypracovanie vyhlásenia:</b> Vyhlásenie bolo vypracované dňa ${fmtDate(a.scannedAt)} na základe auditu vykonaného kombináciou automatického testovania (axe-core ${esc(a.axeVersion)}) a [manuálneho testovania].</p>
        <p><b>Spätná väzba a kontakt:</b> Ak narazíte na problém s prístupnosťou, kontaktujte nás na [e-mail], [telefón]. Odpovieme do [počet] pracovných dní.</p>
        <p><b>Vymáhanie:</b> Ak nie ste spokojní s odpoveďou, môžete sa obrátiť na príslušný orgán dohľadu nad trhom [doplniť podľa sektora].</p>
      </div>
    </section>`, `
    <section class="page">
      <h2>${num()} Template: Accessibility statement</h2>
      <p class="muted small">A pre-filled draft to publish on your website (e.g. at /accessibility). Fill in the [bracketed] fields and update the text after fixes.</p>
      <div class="statement">
        <h3>Accessibility statement</h3>
        <p>[Company name], [company number], is committed to making its website <b>${esc(a.host)}</b> accessible in accordance with Directive (EU) 2019/882 (European Accessibility Act) and [national law transposing it].</p>
        <p><b>Compliance status:</b> This website is <b>${full ? 'fully compliant' : 'partially compliant'}</b> with EN 301 549 V3.2.1 and WCAG 2.1 level AA${a.issues.length ? ' due to the issues listed below' : ''}.</p>
        ${list ? `<p><b>Non-accessible content:</b></p>${list}<p>We are working on fixing these issues; expected date: [date].</p>` : ''}
        <p><b>Preparation of this statement:</b> This statement was prepared on ${fmtDate(a.scannedAt)} based on an audit combining automated testing (axe-core ${esc(a.axeVersion)}) and [manual testing].</p>
        <p><b>Feedback and contact:</b> If you encounter an accessibility problem, contact us at [email], [phone]. We will respond within [number] working days.</p>
        <p><b>Enforcement:</b> If you are not satisfied with our response, you can contact the competent market surveillance authority [add per sector and country].</p>
      </div>
    </section>`);
  }

  /* ---------- 10. Metodika ---------- */
  const methodology = `
  <section class="page">
    <h2>${num()} ${L('Metodika a obmedzenia', 'Methodology and limitations')}</h2>
    <ul>
      <li>${L(`Web bol načítaný v prehliadači Chromium (1280 × 900 px) a otestovaný knižnicou <b>axe-core ${esc(a.axeVersion)}</b> s pravidlami WCAG 2.0, 2.1 a 2.2 úrovne A a AA.`, `The website was loaded in Chromium (1280 × 900 px) and tested with <b>axe-core ${esc(a.axeVersion)}</b> using WCAG 2.0, 2.1 and 2.2 level A and AA rules.`)}</li>
      <li>${L('Kľúčové stránky boli navyše otestované <b>vlastnými testami</b>: prechod klávesom Tab (viditeľnosť fokusu overená porovnaním snímok prvku so zameraním a bez neho, pasca pre klávesnicu, zakrytie fokusu, ovládacie prvky mimo poradia Tab), zobrazenie pri šírke 320 px (reflow) a sken v mobilnom zobrazení.', 'Key pages were additionally checked with <b>custom tests</b>: Tab-key navigation (focus visibility verified by comparing screenshots with and without focus, keyboard traps, obscured focus, controls outside the Tab order), the 320 px layout (reflow) and a mobile-view scan.')}</li>
      <li>${L('Cookie lišta bola otestovaná v zobrazenom stave a pred ďalším testovaním zatvorená, aby neprekrývala obsah.', 'The cookie banner was tested while visible and then closed before further testing so it would not cover content.')}</li>
      <li>${L(`Podstránky boli vybrané automaticky z odkazov na webe (prioritne kontakt, produkty, košík, formuláre, právne informácie). Rozsah balíka ${esc(tier.name)}: max. ${tier.pages} podstránok.`, `Pages were selected automatically from links on the site (prioritising contact, products, cart, forms and legal pages). ${esc(tier.name)} plan scope: up to ${tier.pages} pages.`)}</li>
      <li>${L('Skóre (0–100) vyjadruje počet a závažnosť automaticky zistených problémov. Nie je to percento splnených kritérií.', 'The score (0–100) reflects the number and severity of automatically detected issues. It is not a percentage of criteria met.')}</li>
      <li>${L('Automatické testovanie neodhalí všetky bariéry – napr. zrozumiteľnosť textov, ovládanie zložitých prvkov (menu, formuláre, modálne okná), kvalitu alternatívnych textov či titulkov. Na potvrdenie plnej zhody je potrebné manuálne testovanie a testovanie s používateľmi.', 'Automated testing does not find every barrier – e.g. readability, complex widgets (menus, forms, dialogs), the quality of alt text or captions. Confirming full conformance requires manual testing and testing with users.')}</li>
      <li>${L('Obsah za prihlásením, v PDF dokumentoch a v mobilných aplikáciách nebol testovaný.', 'Content behind a login, in PDF documents and in mobile apps was not tested.')}</li>
      <li>${L(`Výsledok platí ku dňu auditu (${fmtDate(a.scannedAt)}). Zmeny na webe môžu stav ovplyvniť.`, `Results are valid as of the audit date (${fmtDate(a.scannedAt)}). Changes to the website may affect them.`)}</li>
    </ul>
    <div class="note">${L('Správa slúži ako technický podklad na zlepšenie prístupnosti. Nepredstavuje certifikát zhody ani právne stanovisko.', 'This report is a technical basis for improving accessibility. It is not a certificate of conformance or a legal opinion.')}</div>
  </section>`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<title>${L('Audit prístupnosti', 'Accessibility audit')} – ${esc(a.host)}</title>
<style>${FONTS}\n${CSS}</style></head><body>
${cover}${summary}${comparison}${legal}${criteria}${issues}${pages}${plan}${manual}${statement}${methodology}
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
.mono, pre { font-family: "DejaVu Sans Mono", Menlo, Consolas, monospace; }
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
.ex-shot { display: block; width: 100%; max-height: 62mm; object-fit: contain; object-position: left top; border-radius: 6px; border: 1px solid #e3e6ee; margin-bottom: 1.5mm; }
.kpis-3 { grid-template-columns: repeat(3, 1fr); }
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
  const en = (order.lang || audit.lang) === 'en';
  const date = new Date(audit.scannedAt).toLocaleDateString(en ? 'en-GB' : 'sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  return withPage(async (page) => {
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    return page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#8a90a2;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif">
        <span>${en ? 'Accessibility audit' : 'Audit prístupnosti'} · ${esc(audit.host)} · ${date}</span>
        <span>${en ? 'Page' : 'Strana'} <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
  });
}

module.exports = { renderPdf, buildHtml };

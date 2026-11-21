'use strict';

const { esc } = require('../layout');

/** FAQ: viditeľný obsah (details/summary) + štruktúrované dáta FAQPage. */
function faq(items, { id = 'faq', title, lead } = {}) {
  const html = `
    <section class="content-section" id="${id}" aria-labelledby="${id}-title">
      <div class="section-head">
        <h2 id="${id}-title">${esc(title)}</h2>
        ${lead ? `<p class="sub">${esc(lead)}</p>` : ''}
      </div>
      <div class="faq">
        ${items.map(([q, a], i) => `
        <details class="card faq-item"${i === 0 ? ' open' : ''}>
          <summary><h3>${esc(q)}</h3></summary>
          <div class="faq-a">${a}</div>
        </details>`).join('')}
      </div>
    </section>`;
  const jsonLd = {
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() },
    })),
  };
  return { html, jsonLd };
}

const ticks = (arr) => `<ul class="ticks">${arr.map((x) => `<li>${x}</li>`).join('')}</ul>`;

module.exports = { faq, ticks };

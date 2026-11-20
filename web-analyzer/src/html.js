'use strict';

/*
 * Ľahký HTML parser bez závislostí. Nie je to plnohodnotný DOM, ale na
 * extrakciu tagov a atribútov pre audit úplne stačí.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function parseAttrs(str) {
  const attrs = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(str))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function stripNoise(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, (m, tag) => `<${tag}></${tag}>`);
}

class Doc {
  constructor(html) {
    this.raw = html;
    this.clean = stripNoise(html);
  }

  /** Všetky výskyty tagu ako { attrs, inner } (inner len pre párové tagy). */
  all(tag, { inner = false, source = 'clean' } = {}) {
    const src = source === 'raw' ? this.raw : this.clean;
    const out = [];
    const re = inner
      ? new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi')
      : new RegExp(`<${tag}\\b([^>]*?)\\/?>`, 'gi');
    let m;
    while ((m = re.exec(src))) out.push({ attrs: parseAttrs(m[1]), inner: inner ? m[2] : undefined });
    return out;
  }

  first(tag, opts) { return this.all(tag, opts)[0] || null; }

  meta(key) {
    key = key.toLowerCase();
    const m = this.all('meta').find((x) => (x.attrs.name || x.attrs.property || x.attrs['http-equiv'] || '').toLowerCase() === key);
    return m ? (m.attrs.content || '').trim() : null;
  }

  links(rel) {
    return this.all('link').filter((l) => (l.attrs.rel || '').toLowerCase().split(/\s+/).includes(rel));
  }

  htmlAttrs() {
    const m = /<html\b([^>]*)>/i.exec(this.clean);
    return m ? parseAttrs(m[1]) : {};
  }

  head() {
    const m = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(this.raw);
    return m ? m[1] : '';
  }

  text() {
    const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(this.clean);
    return toText(body ? body[1] : this.clean);
  }
}

function toText(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

module.exports = { Doc, toText, parseAttrs, decodeEntities };

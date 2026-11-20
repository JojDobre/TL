'use strict';

process.env.WA_ALLOW_PRIVATE_HOSTS = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startFixtureServer } = require('./helpers');
const { analyze } = require('../src/analyzer');

let srv;
test.before(async () => { srv = await startFixtureServer(); });
test.after(() => srv.close());

const status = (r, cat, id) => r.categories[cat].checks.find((c) => c.id === id)?.status;

test('rýchla analýza: chýbajúce HTTPS a hlavičky, SEO podľa obsahu', async () => {
  const r = await analyze(srv.url('good.html'));
  assert.equal(status(r, 'security', 'https'), 'fail');
  assert.equal(status(r, 'security', 'csp'), 'fail');
  assert.equal(status(r, 'security', 'xcto'), 'fail');
  assert.equal(status(r, 'seo', 'title'), 'pass');
  assert.equal(status(r, 'seo', 'h1'), 'pass');
  assert.equal(status(r, 'seo', 'viewport'), 'pass');
  assert.equal(status(r, 'seo', 'robots'), 'warn'); // fixture server nemá robots.txt
  assert.equal(status(r, 'security', 'soft404'), 'pass');
  assert.equal(status(r, 'accessibility', 'lang'), 'pass');
});

test('rýchla analýza: zlá stránka má chyby prístupnosti', async () => {
  const r = await analyze(srv.url('bad.html'));
  assert.equal(status(r, 'accessibility', 'lang'), 'fail');
  assert.notEqual(status(r, 'accessibility', 'alt'), 'pass');
  assert.equal(status(r, 'seo', 'description'), 'fail');
});

// backend/src/controllers/adminBlog.controller.js
//
// Admin správa blogu (len pre rolu admin): zoznam, vytvorenie, úprava, zmazanie.
// Formuláre posielajú klasický POST (rovnaký vzor ako sezóny/ligy v projekte).

const { Article, User } = require('../models');
const { Op } = require('sequelize');
const { asyncHandler } = require('../middleware/error.middleware');

// --- vytvorenie slugu z reťazca (diakritika → ascii, medzery → pomlčky) ---
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // odstráni diakritiku
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// --- zabezpečí jedinečnosť slugu (pri kolízii pridá -2, -3, ...) ---
async function uniqueSlug(base, ignoreId) {
  let slug = base || 'clanok';
  let n = 1;
  // hľadáme voľný slug; pri edite ignorujeme vlastný záznam
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const where = { slug };
    if (ignoreId) where.id = { [Op.ne]: ignoreId };
    const exists = await Article.findOne({ where });
    if (!exists) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

// GET /admin/blog — zoznam všetkých článkov (aj konceptov)
const adminBlogListPage = asyncHandler(async (req, res) => {
  const articles = await Article.findAll({ order: [['createdAt', 'DESC']] });
  res.render('adminBlog', { articles: articles.map((a) => a.toJSON()), flash: req.query.flash || null });
});

// GET /admin/blog/new — formulár nového článku
const adminBlogNewPage = (req, res) => {
  res.render('adminBlogForm', { article: null, error: null });
};

// POST /admin/blog/new — vytvorenie článku
const adminBlogCreate = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  // základná validácia
  if (!title || !title.trim() || !content || !content.trim()) {
    return res.status(400).render('adminBlogForm', { article: req.body, error: 'Vyplň aspoň nadpis a obsah článku.' });
  }

  // slug: použijeme zadaný, inak z nadpisu; vždy normalizujeme a overíme jedinečnosť
  const baseSlug = slugify(req.body.slug && req.body.slug.trim() ? req.body.slug : title);
  const slug = await uniqueSlug(baseSlug);

  await Article.create({
    title: title.trim(),
    slug,
    excerpt: (req.body.excerpt || '').trim() || null,
    content,
    category: req.body.category || 'Novinky',
    coverEmoji: (req.body.coverEmoji || '📝').trim() || '📝',
    coverGradient: req.body.coverGradient || 'linear-gradient(135deg,#2b0a4a,#5b3fd6 60%,#0b4ea2)',
    readMinutes: Number(req.body.readMinutes) > 0 ? Number(req.body.readMinutes) : 3,
    featured: req.body.featured === '1',
    published: req.body.published === '1',
    authorId: Number(req.session.userId),
  });

  res.redirect('/admin/blog?flash=' + encodeURIComponent('Článok bol vytvorený.'));
});

// GET /admin/blog/:id/edit — formulár úpravy
const adminBlogEditPage = asyncHandler(async (req, res) => {
  const article = await Article.findByPk(req.params.id);
  if (!article) return res.status(404).render('error-page', { message: 'Článok sa nenašiel.' });
  res.render('adminBlogForm', { article: article.toJSON(), error: null });
});

// POST /admin/blog/:id/edit — uloženie zmien
const adminBlogUpdate = asyncHandler(async (req, res) => {
  const article = await Article.findByPk(req.params.id);
  if (!article) return res.status(404).render('error-page', { message: 'Článok sa nenašiel.' });

  const { title, content } = req.body;
  if (!title || !title.trim() || !content || !content.trim()) {
    // pri chybe vrátime formulár s rozpracovanými dátami (zachová id pre action)
    return res.status(400).render('adminBlogForm', {
      article: Object.assign({}, article.toJSON(), req.body),
      error: 'Vyplň aspoň nadpis a obsah článku.',
    });
  }

  // slug prepočítame len ak ho admin zmenil alebo nadpis; jedinečnosť ignoruje vlastný záznam
  const baseSlug = slugify(req.body.slug && req.body.slug.trim() ? req.body.slug : title);
  const slug = await uniqueSlug(baseSlug, article.id);

  await article.update({
    title: title.trim(),
    slug,
    excerpt: (req.body.excerpt || '').trim() || null,
    content,
    category: req.body.category || 'Novinky',
    coverEmoji: (req.body.coverEmoji || '📝').trim() || '📝',
    coverGradient: req.body.coverGradient || article.coverGradient,
    readMinutes: Number(req.body.readMinutes) > 0 ? Number(req.body.readMinutes) : 3,
    featured: req.body.featured === '1',
    published: req.body.published === '1',
  });

  res.redirect('/admin/blog?flash=' + encodeURIComponent('Zmeny boli uložené.'));
});

// POST /admin/blog/:id/delete — zmazanie článku
const adminBlogDelete = asyncHandler(async (req, res) => {
  const article = await Article.findByPk(req.params.id);
  if (article) await article.destroy();
  res.redirect('/admin/blog?flash=' + encodeURIComponent('Článok bol zmazaný.'));
});

module.exports = {
  adminBlogListPage,
  adminBlogNewPage,
  adminBlogCreate,
  adminBlogEditPage,
  adminBlogUpdate,
  adminBlogDelete,
};

// backend/src/controllers/blogPage.controller.js
//
// Verejné stránky blogu: zoznam článkov (/blog) a detail článku (/blog/:slug).
// Obsah článku je v Markdown — prevádzame ho na HTML jednoduchým parserom bez
// externej závislosti (podporuje nadpisy, tučné, kurzívu, odkazy, zoznamy,
// blokové citácie => .pull, odseky). Zároveň generujeme TOC z H2 nadpisov.

const { Article, User } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');

// --- bezpečnostné escapovanie HTML (proti XSS v texte z DB) ---
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- inline formátovanie: **tučné**, *kurzíva*, [text](url), `kód` ---
// Pracuje nad UŽ escapovaným textom, takže do HTML pridáva len bezpečné tagy.
function inline(text) {
  let t = esc(text);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // odkazy [text](url) — povolíme len http(s) a interné cesty začínajúce /
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
    const safe = /^(https?:\/\/|\/)/.test(url) ? url : '#';
    return '<a href="' + esc(safe) + '">' + label + '</a>';
  });
  return t;
}

// --- jednoduchý prevod celého Markdown bloku na HTML + zber TOC ---
function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let inList = false;
  let para = [];

  // uzavrie otvorený odsek
  function flushPara() {
    if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; }
  }
  // uzavrie otvorený zoznam
  function flushList() {
    if (inList) { out.push('</ul>'); inList = false; }
  }
  // jednoduchý slug z nadpisu pre id (kotvy v TOC)
  function slugify(s) {
    return s.toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éě]/g, 'e').replace(/[íi]/g, 'i')
      .replace(/[óô]/g, 'o').replace(/[úů]/g, 'u').replace(/[ý]/g, 'y')
      .replace(/[čc]/g, 'c').replace(/[šs]/g, 's').replace(/[žz]/g, 'z')
      .replace(/[ňn]/g, 'n').replace(/[ťt]/g, 't').replace(/[ďd]/g, 'd').replace(/[ľl]/g, 'l').replace(/[ŕr]/g, 'r')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') { flushPara(); flushList(); continue; }

    // blokové citácie "> text" => pull-quote zo šablóny
    if (/^>\s?/.test(trimmed)) {
      flushPara(); flushList();
      out.push('<div class="pull">' + inline(trimmed.replace(/^>\s?/, '')) + '</div>');
      continue;
    }
    // nadpisy ## a ###
    const h2 = trimmed.match(/^##\s+(.*)$/);
    const h3 = trimmed.match(/^###\s+(.*)$/);
    if (h2) {
      flushPara(); flushList();
      const id = slugify(h2[1]);
      toc.push({ id, text: h2[1] });
      out.push('<h2 id="' + id + '">' + inline(h2[1]) + '</h2>');
      continue;
    }
    if (h3) {
      flushPara(); flushList();
      out.push('<h3>' + inline(h3[1]) + '</h3>');
      continue;
    }
    // položky zoznamu "- " alebo "* "
    const li = trimmed.match(/^[-*]\s+(.*)$/);
    if (li) {
      flushPara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + inline(li[1]) + '</li>');
      continue;
    }
    // bežný text => súčasť odseku
    para.push(trimmed);
  }
  flushPara(); flushList();

  return { html: out.join('\n'), toc };
}

// GET /blog — zoznam publikovaných článkov (voliteľný filter ?kategoria=)
const blogListPage = asyncHandler(async (req, res) => {
  const category = req.query.kategoria || null; // filter podľa kategórie
  const where = { published: true };
  if (category && category !== 'Všetko') where.category = category;

  // featured článok len keď nefiltrujeme (na vrchu zoznamu)
  let featured = null;
  if (!category || category === 'Všetko') {
    featured = await Article.findOne({
      where: { published: true, featured: true },
      include: [{ model: User, as: 'author', attributes: ['username', 'profileImage'] }],
      order: [['createdAt', 'DESC']],
    });
  }

  // ostatné články (bez featured, ak nejaký je)
  const exclude = featured ? { id: { [require('sequelize').Op.ne]: featured.id } } : {};
  const posts = await Article.findAll({
    where: Object.assign({}, where, exclude),
    include: [{ model: User, as: 'author', attributes: ['username', 'profileImage'] }],
    order: [['createdAt', 'DESC']],
  });

  res.render('blog', { featured, posts, currentCategory: category || 'Všetko' });
});

// GET /blog/:slug — detail článku
const blogPostPage = asyncHandler(async (req, res) => {
  const article = await Article.findOne({
    where: { slug: req.params.slug },
    include: [{ model: User, as: 'author', attributes: ['username', 'profileImage'] }],
  });

  // neexistuje alebo je nepublikovaný (nepublikovaný smie vidieť len admin)
  if (!article || (!article.published && req.session.userRole !== 'admin')) {
    return res.status(404).render('error-page', {
      message: 'Tento článok neexistuje alebo ešte nebol publikovaný.',
    });
  }

  const { html, toc } = renderMarkdown(article.content);

  // súvisiace články: ďalšie 3 publikované (najprv rovnaká kategória)
  const { Op } = require('sequelize');
  const related = await Article.findAll({
    where: { published: true, id: { [Op.ne]: article.id } },
    order: [['createdAt', 'DESC']],
    limit: 3,
  });

  res.render('blog-post', { article, contentHtml: html, toc, related });
});

module.exports = { blogListPage, blogPostPage, renderMarkdown };
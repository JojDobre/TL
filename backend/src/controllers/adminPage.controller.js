// backend/src/controllers/adminPage.controller.js
//
// Admin EJS stránky. Zatiaľ len správa užívateľov (ostatné admin stránky sú
// vizuál a doplnia sa, keď bude ich backend). Prvú stranu užívateľov vykreslí
// server; filter/akcie potom beží cez /api/users (klientsky skript v šablóne).

const { User } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');

// GET /admin/users
const adminUsersPage = asyncHandler(async (req, res) => {
  const limit = 20;
  const { count, rows } = await User.findAndCountAll({
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
    limit,
    offset: 0,
  });

  res.render('adminUsers', {
    users: rows.map((u) => u.toJSON()),
    pagination: { total: count, page: 1, limit, pages: Math.ceil(count / limit) || 1 },
  });
});

module.exports = { adminUsersPage };

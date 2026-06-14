// backend/src/controllers/user.controller.js
//
// Správa užívateľov (admin). Prepísané na produkčnú kvalitu:
//  - asyncHandler + ApiError (žiadny únik interných chýb, centrálne spracovanie)
//  - stránkovanie + vyhľadávanie + filter podľa roly/stavu (škáluje pri tisícoch)
//  - ochrana: admin nemôže sám seba degradovať, zablokovať ani vymazať
//  - validácia roly a kontrola duplicít username/email pri úprave
//  - voliteľná zmena hesla adminom

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User } = require('../models');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');

const SAFE_ATTRS = { exclude: ['password'] };
const VALID_ROLES = ['admin', 'vip', 'player'];

// GET /api/users?page=1&limit=20&search=&role=&status=
// Zoznam užívateľov so stránkovaním, vyhľadávaním a filtrom.
const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const where = {};

  // vyhľadávanie v mene/prezývke/e-maile (case-insensitive)
  if (req.query.search) {
    const q = `%${req.query.search.trim()}%`;
    where[Op.or] = [
      { username: { [Op.iLike]: q } },
      { email: { [Op.iLike]: q } },
      { firstName: { [Op.iLike]: q } },
      { lastName: { [Op.iLike]: q } },
    ];
  }

  // filter podľa roly
  if (req.query.role && VALID_ROLES.includes(req.query.role)) {
    where.role = req.query.role;
  }

  // filter podľa stavu (active/blocked)
  if (req.query.status === 'active') where.active = true;
  if (req.query.status === 'blocked') where.active = false;

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: SAFE_ATTRS,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.status(200).json({
    success: true,
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit) || 1,
    },
  });
});

// GET /api/users/:id
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, { attributes: SAFE_ATTRS });
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');
  res.status(200).json({ success: true, data: user });
});

// PUT /api/users/:id
// Aktualizácia užívateľa adminom (username, email, meno, rola, stav).
const updateUser = asyncHandler(async (req, res) => {
  const { username, email, firstName, lastName, role, active } = req.body;
  const targetId = parseInt(req.params.id, 10);

  const user = await User.findByPk(targetId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  // Ochrana: admin nemôže sám sebe zmeniť rolu ani sa zablokovať
  const isSelf = Number(req.userId) === targetId;
  if (isSelf && role && role !== user.role) {
    throw new ApiError(400, 'Nemôžeš zmeniť rolu vlastného účtu.');
  }
  if (isSelf && active === false) {
    throw new ApiError(400, 'Nemôžeš zablokovať vlastný účet.');
  }

  // Validácia roly
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    throw new ApiError(400, 'Neplatná rola. Povolené: admin, vip, player.');
  }

  // Kontrola duplicít pri zmene username/e-mailu (pekná hláška namiesto SQL chyby)
  if (username && username !== user.username) {
    const exists = await User.findOne({ where: { username, id: { [Op.ne]: targetId } } });
    if (exists) throw new ApiError(409, 'Prezývka už je obsadená.');
    user.username = username;
  }
  if (email && email !== user.email) {
    const exists = await User.findOne({ where: { email, id: { [Op.ne]: targetId } } });
    if (exists) throw new ApiError(409, 'E-mail už je registrovaný.');
    user.email = email;
  }

  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = active;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Používateľ bol úspešne aktualizovaný.',
    data: {
      id: user.id, username: user.username, email: user.email,
      firstName: user.firstName, lastName: user.lastName,
      role: user.role, active: user.active,
    },
  });
});

// PUT /api/users/:id/password
// Reset hesla adminom.
const changeUserPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    throw new ApiError(400, 'Heslo musí mať aspoň 6 znakov.');
  }
  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  res.status(200).json({ success: true, message: 'Heslo bolo zmenené.' });
});

// DELETE /api/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const targetId = parseInt(req.params.id, 10);

  // Ochrana: admin nemôže vymazať sám seba
  if (Number(req.userId) === targetId) {
    throw new ApiError(400, 'Nemôžeš vymazať vlastný účet.');
  }

  const user = await User.findByPk(targetId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  await user.destroy();
  res.status(200).json({ success: true, message: 'Používateľ bol úspešne vymazaný.' });
});

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  changeUserPassword,
  deleteUser,
};
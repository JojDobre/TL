// backend/src/controllers/user.controller.js
//
// Správa užívateľov pre admina. Plná verzia:
//  - serverové stránkovanie + hľadanie + filter roly/stavu (?page&limit&search&role&status)
//  - ochrana seba samého (admin nemôže si zmeniť rolu / zablokovať / zmazať vlastný účet)
//  - validácia roly, kontrola duplicít
//  - asyncHandler + ApiError (žiadny únik chýb)
//
// Pozn.: používame Op.like (MariaDB ho vyhodnocuje case-insensitive pri bežnom
// collation utf8mb4_general_ci), takže netreba PostgreSQL-ovský Op.iLike.

const { User, Sequelize } = require('../models');
const Op = Sequelize.Op;
const bcrypt = require('bcrypt');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');

const VALID_ROLES = ['admin', 'vip', 'player'];
const publicAttrs = { exclude: ['password'] };

// id prihláseného admina (zo session pri stránkach, alebo z req.userId pri JWT API)
const currentId = (req) => Number(req.session?.userId || req.userId);

// GET /api/users?page&limit&search&role&status
const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const where = {};
  if (req.query.search) {
    const q = `%${req.query.search}%`;
    where[Op.or] = [
      { username: { [Op.like]: q } },
      { email: { [Op.like]: q } },
      { firstName: { [Op.like]: q } },
      { lastName: { [Op.like]: q } },
    ];
  }
  if (req.query.role && VALID_ROLES.includes(req.query.role)) {
    where.role = req.query.role;
  }
  if (req.query.status === 'active') where.active = true;
  if (req.query.status === 'blocked') where.active = false;

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: publicAttrs,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  // Body a počet tipov — LEN z oficiálnych líg (type: 'official'), konzistentne
  // so serverovým renderom adminUsers a s globálnym rebríčkom.
  const { League, Round, Match, Tip } = require('../models');
  const statsByUser = {};
  try {
    const offLeagueIds = (await League.findAll({ where: { type: 'official' }, attributes: ['id'] })).map((l) => l.id);
    if (offLeagueIds.length && rows.length) {
      const roundIds = (await Round.findAll({ where: { leagueId: { [Op.in]: offLeagueIds } }, attributes: ['id'] })).map((r) => r.id);
      if (roundIds.length) {
        const agg = await Tip.findAll({
          attributes: [
            'userId',
            [Sequelize.fn('SUM', Sequelize.col('points')), 'totalPoints'],
            [Sequelize.fn('COUNT', Sequelize.col('Tip.id')), 'tipsCount'],
          ],
          where: { userId: { [Op.in]: rows.map((u) => u.id) } },
          include: [{ model: Match, attributes: [], required: true, where: { roundId: { [Op.in]: roundIds } } }],
          group: ['userId'],
          raw: true,
        });
        agg.forEach((r) => { statsByUser[r.userId] = { totalPoints: Number(r.totalPoints) || 0, tipsCount: Number(r.tipsCount) || 0 }; });
      }
    }
  } catch (e) { /* štatistiky sú vedľajšie */ }

  const data = rows.map((u) => {
    const obj = u.toJSON();
    const s = statsByUser[u.id] || { totalPoints: 0, tipsCount: 0 };
    obj.totalPoints = s.totalPoints;
    obj.tipsCount = s.tipsCount;
    return obj;
  });

  res.status(200).json({
    success: true,
    data,
    pagination: { total: count, page, limit, pages: Math.ceil(count / limit) || 1 },
  });
});

// GET /api/users/:id
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, { attributes: publicAttrs });
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');
  res.status(200).json({ success: true, data: user });
});

// PUT /api/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const { username, email, firstName, lastName, role, active } = req.body;
  const targetId = Number(req.params.id);
  const meId = currentId(req);

  const user = await User.findByPk(targetId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  const editingSelf = meId === targetId;

  // ochrana seba samého: admin si nesmie zmeniť rolu ani sa zablokovať
  if (editingSelf && role !== undefined && role !== user.role) {
    throw new ApiError(400, 'Nemôžeš zmeniť rolu vlastnému účtu.');
  }
  if (editingSelf && active === false) {
    throw new ApiError(400, 'Nemôžeš zablokovať vlastný účet.');
  }

  // validácia roly
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    throw new ApiError(400, 'Neplatná rola. Povolené: admin, vip, player.');
  }

  // kontrola duplicít pri zmene username/email
  if (username && username !== user.username) {
    const dup = await User.findOne({ where: { username } });
    if (dup) throw new ApiError(409, 'Túto prezývku už používa iný účet.');
    user.username = username;
  }
  if (email && email !== user.email) {
    const dup = await User.findOne({ where: { email } });
    if (dup) throw new ApiError(409, 'Tento e-mail už používa iný účet.');
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
const changeUserPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    throw new ApiError(400, 'Heslo musí mať aspoň 8 znakov.');
  }
  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  res.status(200).json({ success: true, message: 'Heslo bolo úspešne zmenené.' });
});

// DELETE /api/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  const meId = currentId(req);

  if (meId === targetId) {
    throw new ApiError(400, 'Nemôžeš vymazať vlastný účet.');
  }

  const user = await User.findByPk(targetId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  await user.destroy();
  res.status(200).json({ success: true, message: 'Používateľ bol úspešne vymazaný.' });
});

// POST /api/users — admin vytvorí používateľa (session-chránené cez apiRequireAdmin).
// Nahrádza pôvodné admin-pridávanie cez verejný JWT endpoint /api/auth/register,
// ktoré padalo, keď nebol nastavený JWT_SECRET.
const createUser = asyncHandler(async (req, res) => {
  const { username, email, password, firstName, lastName, role } = req.body;

  if (!username || !email || !password) {
    throw new ApiError(400, 'Používateľské meno, e-mail a heslo sú povinné.');
  }
  if (String(password).length < 6) {
    throw new ApiError(400, 'Heslo musí mať aspoň 6 znakov.');
  }
  const newRole = VALID_ROLES.includes(role) ? role : 'player';

  // kontrola duplicít (rovnaká logika ako pri registrácii)
  const existing = await User.findOne({ where: { [Op.or]: [{ email }, { username }] } });
  if (existing) {
    throw new ApiError(400, 'Používateľ s týmto e-mailom alebo menom už existuje.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    username, email, password: hashedPassword,
    firstName: firstName || null,
    lastName: lastName || null,
    role: newRole,
    active: true,
  });

  // odpoveď bez hesla
  const { password: _omit, ...safe } = user.toJSON();
  res.status(201).json({ success: true, message: 'Používateľ bol vytvorený.', data: safe });
});

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserPassword,
  deleteUser,
};
// backend/src/controllers/settingsPage.controller.js
//
// Nastavenia účtu (/settings). Šablóna prenesená 1:1. Funkčné sú sekcie, pre
// ktoré máme backend: Účet (nick/meno/email) a Zmena hesla. Notifikácie,
// súkromie, vzhľad a nebezpečná zóna sú zatiaľ vizuálne (netrackujeme / neskôr).

const bcrypt = require('bcrypt');
const { User } = require('../models');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');

// GET /settings
const settingsPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId, { attributes: { exclude: ['password'] } });
  if (!user) return res.redirect('/login');
  res.render('settings', {
    account: {
      username: user.username,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      email: user.email || '',
    },
  });
});

// PUT /api/profile  { username, name, email }
const updateProfile = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  const username = (req.body.username || '').trim();
  const email = (req.body.email || '').trim();
  const fullName = (req.body.name || '').trim();

  if (!username) throw new ApiError(400, 'Prezývka je povinná.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, 'Neplatný e-mail.');

  // kolízia username/email s iným používateľom
  const { Op } = require('../models').Sequelize;
  const clash = await User.findOne({ where: { id: { [Op.ne]: meId }, [Op.or]: [{ username }, ...(email ? [{ email }] : [])] } });
  if (clash) throw new ApiError(409, 'Prezývka alebo e-mail už používa iný účet.');

  // rozdelenie mena na krstné/priezvisko
  const parts = fullName.split(/\s+/).filter(Boolean);
  user.firstName = parts.length ? parts[0] : null;
  user.lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  user.username = username;
  if (email) user.email = email;
  await user.save();

  res.status(200).json({ success: true, message: 'Údaje uložené.' });
});

// PUT /api/profile/password  { currentPassword, newPassword, confirmPassword }
const changePassword = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Vyplň súčasné aj nové heslo.');
  if (newPassword.length < 6) throw new ApiError(400, 'Nové heslo musí mať aspoň 6 znakov.');
  if (newPassword !== confirmPassword) throw new ApiError(400, 'Nové heslá sa nezhodujú.');

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new ApiError(403, 'Súčasné heslo nie je správne.');

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.status(200).json({ success: true, message: 'Heslo zmenené.' });
});

module.exports = { settingsPage, updateProfile, changePassword };

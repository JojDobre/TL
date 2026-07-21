// backend/src/controllers/settingsPage.controller.js
//
// Nastavenia účtu (/settings). Funkčné sekcie: Účet (nick/meno/email),
// Profilová fotka (URL), Zmena hesla, Notifikácie (in-app prepínač),
// Súkromie (verejný profil, povoliť porovnávanie), a Nebezpečná zóna
// (opustiť všetky súťaže, vymazať účet).

const bcrypt = require('bcrypt');
const { User, UserLeague, UserSeason, sequelize } = require('../models');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const achievements = require('../utils/achievement.engine');

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
      profileImage: user.profileImage || '',
      initials: ([user.firstName, user.lastName].filter(Boolean).map((x) => x[0]).join('') || (user.username || '?')[0] || '?').toUpperCase(),
    },
    prefs: {
      notifyInApp: user.notifyInApp !== false,
      notifyPush: user.notifyPush !== false,
      profilePublic: user.profilePublic !== false,
      allowCompare: user.allowCompare !== false,
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

  const { Op } = require('../models').Sequelize;
  const clash = await User.findOne({ where: { id: { [Op.ne]: meId }, [Op.or]: [{ username }, ...(email ? [{ email }] : [])] } });
  if (clash) throw new ApiError(409, 'Prezývka alebo e-mail už používa iný účet.');

  const parts = fullName.split(/\s+/).filter(Boolean);
  user.firstName = parts.length ? parts[0] : null;
  user.lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  user.username = username;
  if (email) user.email = email;
  await user.save();

  // achievement: úprava profilu
  achievements.evaluateInBackground([meId]);

  res.status(200).json({ success: true, message: 'Údaje uložené.' });
});

// PUT /api/profile/avatar  { profileImage }  (URL alebo prázdne = odstrániť)
const updateAvatar = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  const url = (req.body.profileImage || '').trim();
  if (url) {
    if (!/^https?:\/\/.+/i.test(url)) throw new ApiError(400, 'Zadaj platnú URL adresu obrázka (http/https).');
    if (url.length > 1000) throw new ApiError(400, 'URL je príliš dlhá.');
  }
  user.profileImage = url || null;
  await user.save();

  // aktualizuj cache fotky v session, aby ju navbar hneď zobrazil
  if (req.session) req.session.userImage = user.profileImage;

  // achievement: nastavenie avatara
  if (user.profileImage) achievements.evaluateInBackground([meId]);

  res.status(200).json({ success: true, message: url ? 'Profilová fotka uložená.' : 'Profilová fotka odstránená.', data: { profileImage: user.profileImage } });
});

// PUT /api/profile/password
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

// PUT /api/profile/notifications  { notifyInApp }
const updateNotifications = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  user.notifyInApp = !!req.body.notifyInApp;
  // notifyPush je voliteľný — meníme ho len ak prišiel v tele (spätná kompatibilita)
  if (typeof req.body.notifyPush !== 'undefined') {
    user.notifyPush = !!req.body.notifyPush;
  }
  await user.save();

  res.status(200).json({ success: true, message: 'Nastavenia notifikácií uložené.' });
});

// PUT /api/profile/privacy  { profilePublic, allowCompare }
const updatePrivacy = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  user.profilePublic = !!req.body.profilePublic;
  // Porovnávanie má zmysel len pri verejnom profile — pri súkromnom ho vždy vypneme,
  // aj keby klient poslal true (poistka voči obídeniu UI).
  user.allowCompare = user.profilePublic ? !!req.body.allowCompare : false;
  await user.save();

  res.status(200).json({ success: true, message: 'Nastavenia súkromia uložené.' });
});

// POST /api/profile/leave-all — odhlásenie zo všetkých líg a sezón
const leaveAllCompetitions = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  // tipy ostávajú zachované (historický rebríček); rušíme len členstvá.
  await sequelize.transaction(async (t) => {
    await UserLeague.destroy({ where: { userId: meId }, transaction: t });
    await UserSeason.destroy({ where: { userId: meId }, transaction: t });
  });

  res.status(200).json({ success: true, message: 'Opustil si všetky súťaže.' });
});

// DELETE /api/profile — vymazanie účtu
const deleteAccount = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId);
  if (!user) throw new ApiError(404, 'Používateľ nenájdený.');

  // bezpečnostné overenie heslom (ak ho frontend pošle)
  if (req.body && req.body.password) {
    const ok = await bcrypt.compare(req.body.password, user.password);
    if (!ok) throw new ApiError(403, 'Heslo nie je správne.');
  }

  const { Tip } = require('../models');
  await sequelize.transaction(async (t) => {
    await Tip.destroy({ where: { userId: meId }, transaction: t });
    await UserLeague.destroy({ where: { userId: meId }, transaction: t });
    await UserSeason.destroy({ where: { userId: meId }, transaction: t });
    await user.destroy({ transaction: t });
  });

  req.session.destroy(() => {});
  res.clearCookie('connect.sid');
  res.status(200).json({ success: true, message: 'Účet bol vymazaný.' });
});

module.exports = {
  settingsPage,
  updateProfile,
  updateAvatar,
  changePassword,
  updateNotifications,
  updatePrivacy,
  leaveAllCompetitions,
  deleteAccount,
};
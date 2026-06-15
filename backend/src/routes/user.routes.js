// backend/src/routes/user.routes.js
//
// Správa užívateľov (admin). Volané zo stránky /admin/users cez fetch, takže
// ochrana je cez session (apiRequireAdmin), nie JWT.

const express = require('express');
const {
  getAllUsers, getUserById, updateUser, changeUserPassword, deleteUser,
} = require('../controllers/user.controller');
const { apiRequireAdmin } = require('../middleware/page-auth.middleware');

const router = express.Router();

// Všetky routes vyžadujú prihláseného admina (session)
router.use(apiRequireAdmin);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.put('/:id/password', changeUserPassword);
router.delete('/:id', deleteUser);

module.exports = router;

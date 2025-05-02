// backend/src/controllers/user.controller.js
const { User } = require('../models');

// Získanie zoznamu všetkých používateľov (pre admina)
const getAllUsers = async (req, res) => {
  try {
    // Načítanie všetkých používateľov z databázy (bez hesla)
    const users = await User.findAll({
      attributes: { exclude: ['password'] }
    });
    
    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní zoznamu používateľov.',
      error: error.message
    });
  }
};

// Získanie detailu používateľa podľa ID (pre admina)
const getUserById = async (req, res) => {
  try {
    // Načítanie používateľa z databázy podľa ID
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    
    // Ak používateľ neexistuje, vrátime chybu
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Používateľ nenájdený.'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní detailu používateľa.',
      error: error.message
    });
  }
};

// Aktualizácia používateľa (pre admina)
const updateUser = async (req, res) => {
  try {
    // Extrahovanie dát z request body
    const { username, email, firstName, lastName, role, active } = req.body;
    
    // Nájdenie používateľa podľa ID
    const user = await User.findByPk(req.params.id);
    
    // Ak používateľ neexistuje, vrátime chybu
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Používateľ nenájdený.'
      });
    }
    
    // Aktualizácia údajov používateľa
    if (username) user.username = username;
    if (email) user.email = email;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    if (active !== undefined) user.active = active;
    
    // Uloženie zmien
    await user.save();
    
    // Vrátenie aktualizovaného používateľa
    res.status(200).json({
      success: true,
      message: 'Používateľ bol úspešne aktualizovaný.',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        active: user.active
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chyba pri aktualizácii používateľa.',
      error: error.message
    });
  }
};

// Vymazanie používateľa (pre admina)
const deleteUser = async (req, res) => {
  try {
    // Nájdenie používateľa podľa ID
    const user = await User.findByPk(req.params.id);
    
    // Ak používateľ neexistuje, vrátime chybu
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Používateľ nenájdený.'
      });
    }
    
    // Vymazanie používateľa
    await user.destroy();
    
    // Vrátenie úspešnej odpovede
    res.status(200).json({
      success: true,
      message: 'Používateľ bol úspešne vymazaný.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chyba pri vymazávaní používateľa.',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};
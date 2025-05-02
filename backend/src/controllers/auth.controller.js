const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Sequelize } = require('../models');
const Op = Sequelize.Op; // Pridanie Sequelize.Op

// Kontrolér pre registráciu nového používateľa
const register = async (req, res) => {
  try {
    // Extrahovanie dát z request body
    const { username, email, password, firstName, lastName } = req.body;
    
    // Kontrola, či používateľ s daným e-mailom alebo používateľským menom už existuje
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [  // Oprava: použitie Op.or namiesto User.sequelize.Op.or
          { email },
          { username }
        ]
      }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Používateľ s týmto e-mailom alebo používateľským menom už existuje.'
      });
    }
    
    // Hashovanie hesla
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Vytvorenie nového používateľa
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'player', // Základná rola pre nových používateľov
    });
    
    // Generovanie JWT tokenu
    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // Token vyprší po 24 hodinách
    );
    
    // Vrátenie odpovede s používateľom (bez hesla) a tokenom
    res.status(201).json({
      success: true,
      message: 'Používateľ bol úspešne registrovaný.',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
        token
      }
    });
  } catch (error) {
    console.error('Chyba pri registrácii:', error); // Pridanie detailnejšieho logovania
    res.status(500).json({
      success: false,
      message: 'Chyba pri registrácii používateľa.',
      error: error.message
    });
  }
};

// Kontrolér pre prihlásenie používateľa
const login = async (req, res) => {
  try {
    // Extrahovanie dát z request body
    const { email, password } = req.body;
    
    // Nájdenie používateľa podľa e-mailu
    const user = await User.findOne({ where: { email } });
    
    // Ak používateľ neexistuje, vrátime chybu
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Nesprávny e-mail alebo heslo.'
      });
    }
    
    // Porovnanie hesla
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    // Ak heslo nie je správne, vrátime chybu
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Nesprávny e-mail alebo heslo.'
      });
    }
    
    // Generovanie JWT tokenu
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // Token vyprší po 24 hodinách
    );
    
    // Vrátenie odpovede s používateľom (bez hesla) a tokenom
    res.status(200).json({
      success: true,
      message: 'Prihlásenie úspešné.',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chyba pri prihlásení.',
      error: error.message
    });
  }
};

// Kontrolér pre získanie profilu prihláseného používateľa
const getProfile = async (req, res) => {
  try {
    // Načítanie používateľa z databázy (ID používateľa je uložené v req.userId vďaka verifyToken middleware)
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ['password'] } // Vylúčenie hesla z odpovede
    });
    
    // Ak používateľ neexistuje, vrátime chybu
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Používateľ nenájdený.'
      });
    }
    
    // Vrátenie profilu používateľa
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní profilu.',
      error: error.message
    });
  }
};

// Kontrolér pre aktualizáciu profilu používateľa
const updateProfile = async (req, res) => {
  try {
    // Extrahovanie dát z request body
    const { firstName, lastName, bio, profileImage } = req.body;
    
    // Nájdenie používateľa podľa ID
    const user = await User.findByPk(req.userId);
    
    // Ak používateľ neexistuje, vrátime chybu
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Používateľ nenájdený.'
      });
    }
    
    // Aktualizácia údajov používateľa
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.bio = bio || user.bio;
    user.profileImage = profileImage || user.profileImage;
    
    // Uloženie zmien
    await user.save();
    
    // Vrátenie aktualizovaného profilu
    res.status(200).json({
      success: true,
      message: 'Profil bol úspešne aktualizovaný.',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        profileImage: user.profileImage,
        role: user.role,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chyba pri aktualizácii profilu.',
      error: error.message
    });
  }
};

// Kontrolér pre zmenu hesla
const changePassword = async (req, res) => {
  try {
    // Extrahovanie dát z request body
    const { currentPassword, newPassword } = req.body;
    
    // Nájdenie používateľa podľa ID
    const user = await User.findByPk(req.userId);
    
    // Ak používateľ neexistuje, vrátime chybu
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Používateľ nenájdený.'
      });
    }
    
    // Overenie aktuálneho hesla
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    // Ak aktuálne heslo nie je správne, vrátime chybu
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Nesprávne aktuálne heslo.'
      });
    }
    
    // Hashovanie nového hesla
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Aktualizácia hesla
    user.password = hashedPassword;
    
    // Uloženie zmien
    await user.save();
    
    // Vrátenie úspešnej odpovede
    res.status(200).json({
      success: true,
      message: 'Heslo bolo úspešne zmenené.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Chyba pri zmene hesla.',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};
// backend/src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Middleware pre overenie JWT tokenu
const verifyToken = (req, res, next) => {
  // Získanie tokenu z hlavičky Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
  
  // Ak token neexistuje, vrátime chybu
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Prístup zamietnutý. Nie je poskytnutý autentifikačný token.' 
    });
  }

  try {
    // Overenie tokenu
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId; // Uloženie ID používateľa do request objektu
    next(); // Pokračovanie na ďalší middleware alebo handler
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Neplatný alebo expirovaný token.' 
    });
  }
};

// Middleware pre overenie role používateľa
const checkRole = (roles) => {
  return async (req, res, next) => {
    try {
      // Načítanie používateľa z databázy
      const user = await User.findByPk(req.userId);
      
      // Ak používateľ neexistuje, vrátime chybu
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'Používateľ nenájdený.' 
        });
      }
      
      // Overenie, či používateľ má požadovanú rolu
      if (!roles.includes(user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Nemáte oprávnenie na vykonanie tejto akcie.' 
        });
      }
      
      next(); // Používateľ má požadovanú rolu, pokračujeme
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: 'Interná chyba servera.',
        error: error.message 
      });
    }
  };
};

module.exports = {
  verifyToken,
  checkRole,
  // Pomocné funkcie pre rýchle overenie rolí
  isAdmin: checkRole(['admin']),
  isVIP: checkRole(['admin', 'vip']),
  isPlayer: checkRole(['admin', 'vip', 'player']),
};
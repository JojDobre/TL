// backend/src/controllers/team.controller.js
const { Team, User, Sequelize } = require('../models');
const { Op } = Sequelize;

// Získanie všetkých tímov
const getAllTeams = async (req, res) => {
  try {
    // Možnosť filtrovania podľa parametrov
    const { type } = req.query;
    
    let where = {};
    if (type) where.type = type;
    
    // Načítanie tímov
    const teams = await Team.findAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        }
      ],
      order: [['name', 'ASC']]
    });
    
    res.status(200).json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Chyba pri získavaní tímov:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní tímov.',
      error: error.message
    });
  }
};

// Získanie detailu tímu
const getTeamById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Načítanie tímu
    const team = await Team.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        }
      ]
    });
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Tím nebol nájdený.'
      });
    }
    
    res.status(200).json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Chyba pri získavaní detailu tímu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní detailu tímu.',
      error: error.message
    });
  }
};

// Vytvorenie nového tímu
const createTeam = async (req, res) => {
  try {
    const { name, logo, type } = req.body;
    const userId = req.userId;
    
    // Kontrola, či tím s rovnakým menom už neexistuje
    const existingTeam = await Team.findOne({
      where: { name }
    });
    
    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'Tím s týmto názvom už existuje.'
      });
    }
    
    // Kontrola oprávnení pre vytvorenie oficiálneho tímu
    if (type === 'official') {
      const user = await User.findByPk(userId);
      
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Na vytvorenie oficiálneho tímu potrebujete admin oprávnenia.'
        });
      }
    }
    
    // Vytvorenie nového tímu
    const newTeam = await Team.create({
      name,
      logo,
      type: type || 'community',
      creatorId: userId
    });
    
    res.status(201).json({
      success: true,
      message: 'Tím bol úspešne vytvorený.',
      data: newTeam
    });
  } catch (error) {
    console.error('Chyba pri vytváraní tímu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vytváraní tímu.',
      error: error.message
    });
  }
};

// Aktualizácia tímu
const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logo } = req.body;
    const userId = req.userId;
    
    // Načítanie tímu
    const team = await Team.findByPk(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Tím nebol nájdený.'
      });
    }
    
    // Kontrola oprávnení pre aktualizáciu tímu
    if (team.type === 'official') {
      const user = await User.findByPk(userId);
      
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Na aktualizáciu oficiálneho tímu potrebujete admin oprávnenia.'
        });
      }
    } else if (team.creatorId !== userId) {
      const user = await User.findByPk(userId);
      
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Nemáte oprávnenie na aktualizáciu tohto tímu.'
        });
      }
    }
    
    // Aktualizácia údajov tímu
    if (name) team.name = name;
    if (logo !== undefined) team.logo = logo;
    
    await team.save();
    
    res.status(200).json({
      success: true,
      message: 'Tím bol úspešne aktualizovaný.',
      data: team
    });
  } catch (error) {
    console.error('Chyba pri aktualizácii tímu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri aktualizácii tímu.',
      error: error.message
    });
  }
};

// Vymazanie tímu
const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // Načítanie tímu
    const team = await Team.findByPk(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Tím nebol nájdený.'
      });
    }
    
    // Kontrola oprávnení pre vymazanie tímu
    if (team.type === 'official') {
      const user = await User.findByPk(userId);
      
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Na vymazanie oficiálneho tímu potrebujete admin oprávnenia.'
        });
      }
    } else if (team.creatorId !== userId) {
      const user = await User.findByPk(userId);
      
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Nemáte oprávnenie na vymazanie tohto tímu.'
        });
      }
    }
    
    // Vymazanie tímu
    await team.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Tím bol úspešne vymazaný.'
    });
  } catch (error) {
    console.error('Chyba pri vymazávaní tímu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vymazávaní tímu.',
      error: error.message
    });
  }
};

module.exports = {
  getAllTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam
};
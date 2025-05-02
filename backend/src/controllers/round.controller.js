const { Round, League, Match, User, UserSeason, Season, Team, Tip, Sequelize } = require('../models');
const { Op } = Sequelize;

// Získanie všetkých kôl
const getAllRounds = async (req, res) => {
  try {
    // Možnosť filtrovania podľa parametrov
    const { leagueId } = req.query;
    
    let where = {};
    if (leagueId) where.leagueId = leagueId;
    
    // Načítanie kôl bez pokročilých agregácií
    const rounds = await Round.findAll({
      where,
      include: [
        {
          model: League,
          attributes: ['id', 'name', 'seasonId']
        }
      ],
      order: [['startDate', 'ASC']]
    });
    
    // Manuálne načítame počty zápasov pre každé kolo
    const roundsWithCounts = await Promise.all(
      rounds.map(async (round) => {
        const matchesCount = await Match.count({
          where: { roundId: round.id }
        });
        
        // Vrátime kolo s pridaným počtom zápasov
        const roundJson = round.toJSON();
        return {
          ...roundJson,
          matchesCount
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: roundsWithCounts
    });
  } catch (error) {
    console.error('Chyba pri získavaní kôl:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní kôl.',
      error: error.message
    });
  }
};

// Získanie detailu kola
const getRoundById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Načítanie kola s ligou a zápasmi
    const round = await Round.findByPk(id, {
      include: [
        {
          model: League,
          attributes: ['id', 'name', 'seasonId', 'scoringSystem'],
          include: [
            {
              model: Season,
              attributes: ['id', 'name', 'creatorId']
            }
          ]
        },
        {
          model: Match,
          include: [
            { model: Team, as: 'homeTeam' },
            { model: Team, as: 'awayTeam' },
            { model: Tip, include: [{ model: User }] }
          ]
        }
      ]
    });
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Kolo nebolo nájdené.'
      });
    }
    
    res.status(200).json({
      success: true,
      data: round
    });
  } catch (error) {
    console.error('Chyba pri získavaní detailu kola:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní detailu kola.',
      error: error.message
    });
  }
};

// Vytvorenie nového kola
const createRound = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      leagueId, 
      startDate, 
      endDate 
    } = req.body;
    const userId = req.userId;
    
    // Kontrola existencie ligy
    const league = await League.findByPk(leagueId, {
      include: [
        {
          model: Season,
          attributes: ['id', 'creatorId']
        }
      ]
    });
    
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'Liga nebola nájdená.'
      });
    }
    
    // Kontrola, či má užívateľ oprávnenie vytvoriť kolo v tejto lige
    const user = await User.findByPk(userId);
    const userSeasonRole = await UserSeason.findOne({
      where: { 
        userId, 
        seasonId: league.Season.id 
      }
    });
    
    if (
      league.Season.creatorId !== userId && 
      (!userSeasonRole || userSeasonRole.role !== 'admin') && 
      user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na vytvorenie kola v tejto lige.'
      });
    }
    
    // Validácia dátumov
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (endDateObj <= startDateObj) {
      return res.status(400).json({
        success: false,
        message: 'Dátum konca musí byť po dátume začiatku.'
      });
    }
    
    // Vytvorenie nového kola
    const newRound = await Round.create({
      name,
      description,
      leagueId,
      startDate: startDateObj,
      endDate: endDateObj,
      active: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Kolo bolo úspešne vytvorené.',
      data: newRound
    });
  } catch (error) {
    console.error('Chyba pri vytváraní kola:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vytváraní kola.',
      error: error.message
    });
  }
};

// Aktualizácia kola
const updateRound = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      startDate, 
      endDate,
      active
    } = req.body;
    const userId = req.userId;
    
    // Načítanie kola
    const round = await Round.findByPk(id, {
      include: [
        {
          model: League,
          include: [
            {
              model: Season,
              attributes: ['id', 'creatorId']
            }
          ]
        }
      ]
    });
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Kolo nebolo nájdené.'
      });
    }
    
    // Kontrola, či má užívateľ oprávnenie aktualizovať kolo
    const user = await User.findByPk(userId);
    const userSeasonRole = await UserSeason.findOne({
      where: { 
        userId, 
        seasonId: round.League.Season.id 
      }
    });
    
    if (
      round.League.Season.creatorId !== userId && 
      (!userSeasonRole || userSeasonRole.role !== 'admin') && 
      user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na aktualizáciu tohto kola.'
      });
    }
    
    // Validácia dátumov, ak sú poskytnuté
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (endDateObj <= startDateObj) {
        return res.status(400).json({
          success: false,
          message: 'Dátum konca musí byť po dátume začiatku.'
        });
      }
      
      round.startDate = startDateObj;
      round.endDate = endDateObj;
    } else if (startDate) {
      const startDateObj = new Date(startDate);
      const currentEndDate = new Date(round.endDate);
      
      if (currentEndDate <= startDateObj) {
        return res.status(400).json({
          success: false,
          message: 'Dátum konca musí byť po dátume začiatku.'
        });
      }
      
      round.startDate = startDateObj;
    } else if (endDate) {
      const endDateObj = new Date(endDate);
      const currentStartDate = new Date(round.startDate);
      
      if (endDateObj <= currentStartDate) {
        return res.status(400).json({
          success: false,
          message: 'Dátum konca musí byť po dátume začiatku.'
        });
      }
      
      round.endDate = endDateObj;
    }
    
    // Aktualizácia ostatných údajov
    if (name) round.name = name;
    if (description !== undefined) round.description = description;
    if (active !== undefined) round.active = active;
    
    await round.save();
    
    res.status(200).json({
      success: true,
      message: 'Kolo bolo úspešne aktualizované.',
      data: round
    });
  } catch (error) {
    console.error('Chyba pri aktualizácii kola:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri aktualizácii kola.',
      error: error.message
    });
  }
};

// Vymazanie kola
const deleteRound = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // Načítanie kola
    const round = await Round.findByPk(id, {
      include: [
        {
          model: League,
          include: [
            {
              model: Season,
              attributes: ['id', 'creatorId']
            }
          ]
        }
      ]
    });
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Kolo nebolo nájdené.'
      });
    }
    
    // Kontrola, či má užívateľ oprávnenie vymazať kolo
    const user = await User.findByPk(userId);
    const userSeasonRole = await UserSeason.findOne({
      where: { 
        userId, 
        seasonId: round.League.Season.id 
      }
    });
    
    if (
      round.League.Season.creatorId !== userId && 
      (!userSeasonRole || userSeasonRole.role !== 'admin') && 
      user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na vymazanie tohto kola.'
      });
    }
    
    // Kontrola, či kolo nemá už tipy
    const hasTips = await Tip.findOne({
      include: [
        {
          model: Match,
          where: { roundId: id }
        }
      ]
    });
    
    if (hasTips) {
      return res.status(400).json({
        success: false,
        message: 'Kolo nemôže byť vymazané, pretože už obsahuje tipy.'
      });
    }
    
    // Vymazanie kola a všetkých jeho zápasov
    await Match.destroy({ where: { roundId: id } });
    await round.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Kolo bolo úspešne vymazané.'
    });
  } catch (error) {
    console.error('Chyba pri vymazávaní kola:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vymazávaní kola.',
      error: error.message
    });
  }
};

module.exports = {
  getAllRounds,
  getRoundById,
  createRound,
  updateRound,
  deleteRound
};
// backend/src/controllers/match.controller.js
const { Match, Round, Team, League, Season, User, Sequelize, Tip } = require('../models');
const { Op } = Sequelize;

// Získanie všetkých zápasov
const getAllMatches = async (req, res) => {
  try {
    // Možnosť filtrovania podľa parametrov
    const { roundId } = req.query;
    
    let where = {};
    if (roundId) where.roundId = roundId;
    
    // Načítanie zápasov
    const matches = await Match.findAll({
      where,
      include: [
        {
          model: Round,
          attributes: ['id', 'name', 'leagueId']
        },
        {
          model: Team,
          as: 'homeTeam'
        },
        {
          model: Team,
          as: 'awayTeam'
        }
      ],
      order: [['matchTime', 'ASC']]
    });
    
    res.status(200).json({
      success: true,
      data: matches
    });
  } catch (error) {
    console.error('Chyba pri získavaní zápasov:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní zápasov.',
      error: error.message
    });
  }
};

// Získanie detailu zápasu
const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Načítanie zápasu
    const match = await Match.findByPk(id, {
      include: [
        {
          model: Round,
          include: [
            {
              model: League,
              include: [
                {
                  model: Season
                }
              ]
            }
          ]
        },
        {
          model: Team,
          as: 'homeTeam'
        },
        {
          model: Team,
          as: 'awayTeam'
        }
      ]
    });
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Zápas nebol nájdený.'
      });
    }
    
    res.status(200).json({
      success: true,
      data: match
    });
  } catch (error) {
    console.error('Chyba pri získavaní detailu zápasu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní detailu zápasu.',
      error: error.message
    });
  }
};

// Vytvorenie nového zápasu
const createMatch = async (req, res) => {
  try {
    const { 
      roundId, 
      homeTeamId, 
      awayTeamId, 
      matchTime,
      tipType
    } = req.body;
    const userId = req.userId;
    
    // Kontrola existencie kola
    const round = await Round.findByPk(roundId, {
      include: [
        {
          model: League,
          include: [
            {
              model: Season
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
    
    // Kontrola, či má užívateľ oprávnenie vytvoriť zápas v tomto kole
    const user = await User.findByPk(userId);
    
    // Admin má vždy oprávnenie
    if (user.role !== 'admin' && round.League.Season.creatorId !== userId) {
      // Tu by bola kontrola, či je používateľ admin sezóny, ale pre teraz to zjednodušíme
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na vytvorenie zápasu v tomto kole.'
      });
    }
    
    // Kontrola existencie tímov
    const homeTeam = await Team.findByPk(homeTeamId);
    const awayTeam = await Team.findByPk(awayTeamId);
    
    if (!homeTeam || !awayTeam) {
      return res.status(404).json({
        success: false,
        message: 'Jeden alebo oba tímy neboli nájdené.'
      });
    }
    
    // Kontrola, či nie je rovnaký tím ako domáci aj hosťujúci
    if (homeTeamId === awayTeamId) {
      return res.status(400).json({
        success: false,
        message: 'Domáci a hosťujúci tím nemôžu byť rovnaké.'
      });
    }
    
    // Vytvorenie nového zápasu
    const newMatch = await Match.create({
      roundId,
      homeTeamId,
      awayTeamId,
      matchTime: new Date(matchTime),
      tipType: tipType || 'exact_score',
      status: 'scheduled'
    });
    
    res.status(201).json({
      success: true,
      message: 'Zápas bol úspešne vytvorený.',
      data: newMatch
    });
  } catch (error) {
    console.error('Chyba pri vytváraní zápasu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vytváraní zápasu.',
      error: error.message
    });
  }
};

// Aktualizácia zápasu
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      homeTeamId, 
      awayTeamId, 
      matchTime, 
      homeScore, 
      awayScore, 
      status, 
      tipType 
    } = req.body;
    const userId = req.userId;
    
    // Načítanie zápasu
    const match = await Match.findByPk(id, {
      include: [
        {
          model: Round,
          include: [
            {
              model: League,
              include: [
                {
                  model: Season
                }
              ]
            }
          ]
        }
      ]
    });
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Zápas nebol nájdený.'
      });
    }
    
    // Kontrola, či má užívateľ oprávnenie aktualizovať zápas
    const user = await User.findByPk(userId);
    
    // Admin má vždy oprávnenie
    if (user.role !== 'admin' && match.Round.League.Season.creatorId !== userId) {
      // Tu by bola kontrola, či je používateľ admin sezóny, ale pre teraz to zjednodušíme
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na aktualizáciu tohto zápasu.'
      });
    }
    
    // Aktualizácia údajov zápasu
    if (homeTeamId) match.homeTeamId = homeTeamId;
    if (awayTeamId) match.awayTeamId = awayTeamId;
    if (matchTime) match.matchTime = new Date(matchTime);
    if (homeScore !== undefined) match.homeScore = homeScore;
    if (awayScore !== undefined) match.awayScore = awayScore;
    if (status) match.status = status;
    if (tipType) match.tipType = tipType;
    
    await match.save();
    
    res.status(200).json({
      success: true,
      message: 'Zápas bol úspešne aktualizovaný.',
      data: match
    });
  } catch (error) {
    console.error('Chyba pri aktualizácii zápasu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri aktualizácii zápasu.',
      error: error.message
    });
  }
};

// Vymazanie zápasu
const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // Načítanie zápasu
    const match = await Match.findByPk(id, {
      include: [
        {
          model: Round,
          include: [
            {
              model: League,
              include: [
                {
                  model: Season
                }
              ]
            }
          ]
        }
      ]
    });
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Zápas nebol nájdený.'
      });
    }
    
    // Kontrola, či má užívateľ oprávnenie vymazať zápas
    const user = await User.findByPk(userId);
    
    // Admin má vždy oprávnenie
    if (user.role !== 'admin' && match.Round.League.Season.creatorId !== userId) {
      // Tu by bola kontrola, či je používateľ admin sezóny, ale pre teraz to zjednodušíme
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na vymazanie tohto zápasu.'
      });
    }
    
    // Kontrola, či zápas nemá už tipy
    // const hasTips = await Tip.findOne({ where: { matchId: id } });
    
    // if (hasTips) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Zápas nemôže byť vymazaný, pretože už obsahuje tipy.'
    //   });
    // }
    
    // Vymazanie zápasu
    await match.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Zápas bol úspešne vymazaný.'
    });
  } catch (error) {
    console.error('Chyba pri vymazávaní zápasu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vymazávaní zápasu.',
      error: error.message
    });
  }
};

// Vyhodnotenie zápasu a výpočet bodov za tipy
const evaluateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { homeScore, awayScore, status } = req.body;
    const userId = req.userId;
    
    // Načítanie zápasu
    const match = await Match.findByPk(id, {
      include: [
        {
          model: Round,
          include: [
            {
              model: League,
              attributes: ['id', 'seasonId', 'scoringSystem'],
              include: [
                {
                  model: Season
                }
              ]
            }
          ]
        },
        {
          model: Tip,
          include: [
            {
              model: User,
              attributes: ['id', 'username']
            }
          ]
        }
      ]
    });
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Zápas nebol nájdený.'
      });
    }
    
    // Kontrola, či má užívateľ oprávnenie vyhodnotiť zápas
    const user = await User.findByPk(userId);
    
    // Admin má vždy oprávnenie
    if (user.role !== 'admin' && match.Round.League.Season.creatorId !== userId) {
      // Tu by bola kontrola, či je používateľ admin sezóny
      const userSeasonRole = await UserSeason.findOne({
        where: { 
          userId, 
          seasonId: match.Round.League.Season.id,
          role: 'admin'
        }
      });
      
      if (!userSeasonRole) {
        return res.status(403).json({
          success: false,
          message: 'Nemáte oprávnenie na vyhodnotenie tohto zápasu.'
        });
      }
    }
    
    // Aktualizácia zápasu
    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.status = status || 'finished';
    
    await match.save();
    
    // Výpočet bodov za tipy
    if (status === 'finished' && match.Tips && match.Tips.length > 0) {
      const scoringSystem = match.Round.League.scoringSystem || {
        exactScore: 10,
        correctGoals: 1,
        correctWinner: 3,
        goalDifference: 2
      };
      
      // Výpočet pre každý tip
      for (const tip of match.Tips) {
        let points = 0;
        
        // Určenie víťaza zápasu
        const matchWinner = homeScore > awayScore 
          ? 'home' 
          : homeScore < awayScore 
            ? 'away' 
            : 'draw';
        
        // Výpočet bodov pre rôzne typy tipov
        if (match.tipType === 'exact_score') {
          // Presný výsledok
          if (tip.homeScore === homeScore && tip.awayScore === awayScore) {
            points += scoringSystem.exactScore;
          } else {
            // Správny počet gólov domáceho tímu
            if (tip.homeScore === homeScore) {
              points += scoringSystem.correctGoals;
            }
            
            // Správny počet gólov hosťujúceho tímu
            if (tip.awayScore === awayScore) {
              points += scoringSystem.correctGoals;
            }
            
            // Správny víťaz alebo remíza
            if (tip.winner === matchWinner) {
              points += scoringSystem.correctWinner;
            }
            
            // Správny gólový rozdiel
            const matchGoalDiff = homeScore - awayScore;
            const tipGoalDiff = tip.homeScore - tip.awayScore;
            
            if (matchGoalDiff === tipGoalDiff) {
              points += scoringSystem.goalDifference;
            }
          }
        } else if (match.tipType === 'winner') {
          // Iba víťaz
          if (tip.winner === matchWinner) {
            points += scoringSystem.correctWinner;
          }
        }
        
        // Aktualizácia bodov za tip
        tip.points = points;
        await tip.save();
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Zápas bol úspešne vyhodnotený.',
      data: match
    });
  } catch (error) {
    console.error('Chyba pri vyhodnotení zápasu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vyhodnotení zápasu.',
      error: error.message
    });
  }
};

module.exports = {
  getAllMatches,
  getMatchById,
  createMatch,
  updateMatch,
  deleteMatch,
  evaluateMatch
};
// backend/src/controllers/tip.controller.js
const { Tip, Match, User, Round, League, Team, Sequelize } = require('../models');
const { Op } = Sequelize;

// Získanie tipu používateľa pre konkrétny zápas
const getUserTipForMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.userId;
    
    // Načítanie tipu
    const tip = await Tip.findOne({
      where: {
        userId,
        matchId
      }
    });
    
    res.status(200).json({
      success: true,
      data: tip
    });
  } catch (error) {
    console.error('Chyba pri získavaní tipu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní tipu.',
      error: error.message
    });
  }
};

// Získanie všetkých tipov používateľa
const getUserTips = async (req, res) => {
  try {
    const { roundId } = req.query;
    const userId = req.userId;
    
    // Vytvorenie podmienky pre filtrovanie
    let where = { userId };
    
    // Ak je zadané kolo, filtrujeme tipy pre zápasy v tomto kole
    if (roundId) {
      // Získame ID zápasov v danom kole
      const matchIds = await Match.findAll({
        where: { roundId },
        attributes: ['id']
      }).then(matches => matches.map(match => match.id));
      
      // Pridáme podmienku pre filtrovanie
      where.matchId = {
        [Op.in]: matchIds
      };
    }
    
    // Načítanie tipov
    const tips = await Tip.findAll({
      where,
      include: [
        {
          model: Match,
          include: [
            {
              model: Team,
              as: 'homeTeam'
            },
            {
              model: Team,
              as: 'awayTeam'
            },
            {
              model: Round
            }
          ]
        }
      ]
    });
    
    res.status(200).json({
      success: true,
      data: tips
    });
  } catch (error) {
    console.error('Chyba pri získavaní tipov:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní tipov.',
      error: error.message
    });
  }
};

// Vytvorenie alebo aktualizácia tipu
const createOrUpdateTip = async (req, res) => {
  try {
    const { matchId, homeScore, awayScore, winner } = req.body;
    const userId = req.userId;
    
    // Načítanie zápasu
    const match = await Match.findByPk(matchId, {
      include: [
        {
          model: Round,
          attributes: ['id', 'startDate', 'endDate']
        }
      ]
    });
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Zápas nebol nájdený.'
      });
    }
    
    // Kontrola, či nie je po uzávierke tipovania
    const now = new Date();
    const endDate = new Date(match.Round.endDate);
    
    if (now > endDate) {
      return res.status(403).json({
        success: false,
        message: 'Tipovanie pre toto kolo je už uzavreté.'
      });
    }
    
    // Kontrola, či je tip platný
    if (match.tipType === 'exact_score') {
      if (homeScore === undefined || awayScore === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Pre tento typ zápasu je potrebné zadať presný výsledok.'
        });
      }
    } else if (match.tipType === 'winner') {
      if (!winner) {
        return res.status(400).json({
          success: false,
          message: 'Pre tento typ zápasu je potrebné zadať víťaza.'
        });
      }
    }
    
    // Hľadáme existujúci tip používateľa pre tento zápas
    let tip = await Tip.findOne({
      where: {
        userId,
        matchId
      }
    });
    
    // Ak tip existuje, aktualizujeme ho, inak vytvoríme nový
    if (tip) {
      // Aktualizácia údajov tipu
      if (match.tipType === 'exact_score') {
        tip.homeScore = homeScore;
        tip.awayScore = awayScore;
        tip.winner = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
      } else {
        tip.winner = winner;
      }
      
      tip.submitted = true;
      
      await tip.save();
    } else {
      // Vytvorenie nového tipu
      if (match.tipType === 'exact_score') {
        tip = await Tip.create({
          userId,
          matchId,
          homeScore,
          awayScore,
          winner: homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw',
          submitted: true,
          points: 0
        });
      } else {
        tip = await Tip.create({
          userId,
          matchId,
          winner,
          submitted: true,
          points: 0
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Tip bol úspešne uložený.',
      data: tip
    });
  } catch (error) {
    console.error('Chyba pri vytváraní tipu:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vytváraní tipu.',
      error: error.message
    });
  }
};

module.exports = {
  getUserTipForMatch,
  getUserTips,
  createOrUpdateTip
};
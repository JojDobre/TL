const { League, Season, Round, Match, User, UserSeason, Team, Tip, Sequelize } = require('../models');
const { Op } = Sequelize;

// Získanie všetkých líg
const getAllLeagues = async (req, res) => {
  try {
    // Možnosť filtrovania podľa parametrov
    const { seasonId, type } = req.query;
    
    let where = {};
    if (seasonId) where.seasonId = seasonId;
    if (type) where.type = type;
    
    // Načítanie líg bez pokročilých agregácií
    const leagues = await League.findAll({
      where,
      include: [
        {
          model: Season,
          attributes: ['id', 'name', 'type']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Manuálne načítame počty kôl pre každú ligu
    const leaguesWithCounts = await Promise.all(
      leagues.map(async (league) => {
        const roundsCount = await Round.count({
          where: { leagueId: league.id }
        });
        
        // Vrátime ligu s pridaným počtom kôl
        const leagueJson = league.toJSON();
        return {
          ...leagueJson,
          roundsCount
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: leaguesWithCounts
    });
  } catch (error) {
    console.error('Chyba pri získavaní líg:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní líg.',
      error: error.message
    });
  }
};

// Získanie detailu ligy
const getLeagueById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Fetching league with ID: ${id}`);
    
    // Načítanie ligy s kolami a zápasmi
    const league = await League.findByPk(id, {
      include: [
        {
          model: Season,
          attributes: ['id', 'name', 'type', 'creatorId'],
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'username']
            }
          ]
        },
        {
          model: Round,
          attributes: ['id', 'name', 'description', 'startDate', 'endDate', 'active']
        }
      ]
    });
    
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'Liga nebola nájdená.'
      });
    }
    
    // Manuálne načítame počty zápasov pre každé kolo
    const rounds = await Promise.all(
      league.Rounds.map(async (round) => {
        const matchesCount = await Match.count({
          where: { roundId: round.id }
        });
        
        const roundJson = round.toJSON();
        return {
          ...roundJson,
          matchesCount
        };
      })
    );
    
    // Vytvoríme objekt s výslednou ligou a kolami
    const result = league.toJSON();
    result.Rounds = rounds;
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Chyba pri získavaní detailu ligy:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní detailu ligy.',
      error: error.message
    });
  }
};

// Vytvorenie novej ligy
const createLeague = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      image, 
      type,
      password,
      seasonId,
      scoringSystem
    } = req.body;
    const userId = req.userId;
    
    // Kontrola existencie sezóny
    const season = await Season.findByPk(seasonId);
    
    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Sezóna nebola nájdená.'
      });
    }
    
    // Kontrola, či má užívateľ oprávnenie vytvoriť ligu v tejto sezóne
    const userRole = await UserSeason.findOne({
      where: { 
        userId, 
        seasonId 
      }
    });
    
    if (!userRole || (userRole.role !== 'admin' && season.creatorId !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na vytvorenie ligy v tejto sezóne.'
      });
    }
    
    // Kontrola limitu líg pre užívateľov
    const user = await User.findByPk(userId);
    if (user.role === 'player') {
      const userLeagueCount = await League.count({
        include: [
          {
            model: Season,
            where: { creatorId: userId }
          }
        ]
      });
      
      if (userLeagueCount >= 5) {
        return res.status(403).json({
          success: false,
          message: 'Ako bežný užívateľ môžete vytvoriť maximálne 5 líg. Upgradujte na VIP pre vytvorenie viacerých líg.'
        });
      }
    } else if (user.role === 'vip') {
      const userLeagueCount = await League.count({
        include: [
          {
            model: Season,
            where: { creatorId: userId }
          }
        ]
      });
      
      if (userLeagueCount >= 10) {
        return res.status(403).json({
          success: false,
          message: 'Ako VIP užívateľ môžete vytvoriť maximálne 10 líg.'
        });
      }
    }
    
    // Vytvorenie novej ligy
    const newLeague = await League.create({
      name,
      description,
      image,
      type: type || 'custom',
      password,
      seasonId,
      scoringSystem: scoringSystem || {
        exactScore: 10,
        correctGoals: 1,
        correctWinner: 3,
        goalDifference: 2,
      },
      scoringLocked: false,
      active: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Liga bola úspešne vytvorená.',
      data: newLeague
    });
  } catch (error) {
    console.error('Chyba pri vytváraní ligy:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vytváraní ligy.',
      error: error.message
    });
  }
};

// Aktualizácia ligy
const updateLeague = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      image, 
      password,
      active,
      scoringSystem
    } = req.body;
    const userId = req.userId;
    
    // Načítanie ligy
    const league = await League.findByPk(id, {
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
    
    // Kontrola, či má užívateľ oprávnenie aktualizovať ligu
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
        message: 'Nemáte oprávnenie na aktualizáciu tejto ligy.'
      });
    }
    
    // Kontrola, či sa nemení bodovací systém po začiatku prvého kola
    const hasStartedRounds = await Round.findOne({
      where: { 
        leagueId: id,
        startDate: { [Op.lt]: new Date() }
      }
    });
    
    if (hasStartedRounds && league.scoringLocked && scoringSystem) {
      return res.status(400).json({
        success: false,
        message: 'Bodovací systém nemôže byť zmenený po začiatku prvého kola.'
      });
    }
    
    // Aktualizácia ligy
    if (name) league.name = name;
    if (description !== undefined) league.description = description;
    if (image !== undefined) league.image = image;
    if (password !== undefined) league.password = password;
    if (active !== undefined) league.active = active;
    if (scoringSystem && !league.scoringLocked) league.scoringSystem = scoringSystem;
    
    // Ak začalo prvé kolo, uzamkneme bodovací systém
    if (hasStartedRounds && !league.scoringLocked) {
      league.scoringLocked = true;
    }
    
    await league.save();
    
    res.status(200).json({
      success: true,
      message: 'Liga bola úspešne aktualizovaná.',
      data: league
    });
  } catch (error) {
    console.error('Chyba pri aktualizácii ligy:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri aktualizácii ligy.',
      error: error.message
    });
  }
};

// Vymazanie ligy
const deleteLeague = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // Načítanie ligy
    const league = await League.findByPk(id, {
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
    
    // Kontrola, či má užívateľ oprávnenie vymazať ligu
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
        message: 'Nemáte oprávnenie na vymazanie tejto ligy.'
      });
    }
    
    // Vymazanie ligy
    await league.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Liga bola úspešne vymazaná.'
    });
  } catch (error) {
    console.error('Chyba pri vymazávaní ligy:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vymazávaní ligy.',
      error: error.message
    });
  }
};

// Získanie rebríčka ligy
const getLeagueLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Kontrola existencie ligy
    const leagueExists = await League.findByPk(id);
    
    if (!leagueExists) {
      return res.status(404).json({
        success: false,
        message: 'Liga nebola nájdená.'
      });
    }
    
    // Získanie všetkých tipov v zápasoch, ktoré patria do tejto ligy
    const tips = await Tip.findAll({
      include: [
        {
          model: Match,
          include: [
            {
              model: Round,
              where: { leagueId: id },  // Dôležitý filter - len kolá patriace do tejto ligy
              required: true,  // Vyžaduje sa, aby každý tip bol spojený s kolom patriacim do tejto ligy
              include: [
                {
                  model: League,
                  attributes: ['id', 'name']
                }
              ]
            }
          ],
          required: true  // Vyžaduje sa, aby každý tip bol spojený s takým zápasom
        },
        {
          model: User,
          attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage']
        }
      ]
    });
    
    // Spracovanie dát pre rebríček
    const userPoints = {};
    
    tips.forEach(tip => {
      const userId = tip.User.id;
      
      if (!userPoints[userId]) {
        userPoints[userId] = {
          user: {
            id: tip.User.id,
            username: tip.User.username,
            firstName: tip.User.firstName,
            lastName: tip.User.lastName,
            profileImage: tip.User.profileImage
          },
          totalPoints: 0,
          tipsCount: 0,
          correctPredictions: 0
        };
      }
      
      userPoints[userId].totalPoints += tip.points;
      userPoints[userId].tipsCount += 1;
      
      if (tip.points > 0) {
        userPoints[userId].correctPredictions += 1;
      }
    });
    
    // Konverzia na pole a zoradenie podľa bodov
    const leaderboard = Object.values(userPoints).sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Pridanie poradia
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
      entry.accuracy = Math.round((entry.correctPredictions / entry.tipsCount) * 100) || 0;
    });
    
    res.status(200).json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Chyba pri získavaní rebríčka ligy:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní rebríčka ligy.',
      error: error.message
    });
  }
};

module.exports = {
  getAllLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  deleteLeague,
  getLeagueLeaderboard
};
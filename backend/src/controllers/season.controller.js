const { Season, User, League, Round, Match, Team, Tip, UserSeason, Sequelize } = require('../models');
const { Op } = Sequelize;
const { v4: uuidv4 } = require('uuid');

const uuid = require('uuid');
console.log('UUID module:', uuid);

// Generovanie náhodného kódu pre pozvánku
const generateInviteCode = () => {
  // Vytvorenie 6-znakového alfanumerického kódu
  return uuidv4().substr(0, 6).toUpperCase();
};

// Získanie všetkých sezón
const getAllSeasons = async (req, res) => {
  try {
    // Ak je požadovaný typ, filtrujeme podľa neho
    const { type } = req.query;
    
    let where = {};
    if (type) {
      where.type = type;
    }
    
    // Načítanie sezón s ich tvorcami
    const seasons = await Season.findAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Pre každú sezónu načítame počet líg a účastníkov manuálne
    const seasonsWithCounts = await Promise.all(
      seasons.map(async (season) => {
        const leaguesCount = await League.count({ where: { seasonId: season.id } });
        
        // Získanie počtu účastníkov - táto časť môže vyžadovať úpravu podľa vašej databázovej schémy
        let participantsCount = 0;
        try {
          participantsCount = await season.countParticipants();
        } catch (error) {
          console.error(`Chyba pri počítaní účastníkov pre sezónu ${season.id}:`, error);
        }
        
        // Vrátime sezónu s pridanými počtami
        const seasonJson = season.toJSON();
        return {
          ...seasonJson,
          leaguesCount,
          participantsCount
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: seasonsWithCounts
    });
  } catch (error) {
    console.error('Chyba pri získavaní sezón:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní sezón.',
      error: error.message
    });
  }
};

// Získanie detailu sezóny
const getSeasonById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Requesting season detail for ID: ${id}`);
    
    // Načítanie sezóny bez akýchkoľvek asociácií
    const season = await Season.findByPk(id);
    
    if (!season) {
      console.log(`Season with ID ${id} not found`);
      return res.status(404).json({
        success: false,
        message: 'Sezóna nebola nájdená.'
      });
    }
    
    // Načítame tvorcu sezóny samostatne
    let creator = null;
    try {
      creator = await User.findByPk(season.creatorId, {
        attributes: ['id', 'username', 'firstName', 'lastName']
      });
    } catch (err) {
      console.error('Error fetching creator:', err);
      // Pokračujeme aj keď sa nepodarí načítať tvorcu
    }
    
    // Vytvorenie objektu s minimálnymi potrebnými údajmi
    const seasonData = {
      id: season.id,
      name: season.name,
      description: season.description,
      image: season.image,
      type: season.type,
      active: season.active,
      inviteCode: season.inviteCode,
      rules: season.rules,
      creatorId: season.creatorId,
      creator: creator ? {
        id: creator.id,
        username: creator.username,
        firstName: creator.firstName,
        lastName: creator.lastName
      } : null,
      createdAt: season.createdAt,
      updatedAt: season.updatedAt
    };
    
    console.log('Successfully fetched season data');
    
    res.status(200).json({
      success: true,
      data: seasonData
    });
  } catch (error) {
    console.error('Error fetching season detail:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní detailu sezóny.',
      error: error.message
    });
  }
};

// Vytvorenie novej sezóny
const createSeason = async (req, res) => {

  const inviteCode = uuidv4().substring(0, 6).toUpperCase();
  console.log('Generated invite code:', inviteCode);


  try {
    const { name, description, image, type, rules } = req.body;
    const userId = req.userId;
    
    // Kontrola, či už užívateľ nemá vytvorenú sezónu (ak nie je admin)
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Používateľ nebol nájdený.'
      });
    }
    
    // Kontrola limitu sezón podľa role
    if (user.role === 'player') {
      const userSeasonCount = await Season.count({
        where: { creatorId: userId }
      });
      
      if (userSeasonCount >= 1) {
        return res.status(403).json({
          success: false,
          message: 'Ako bežný užívateľ môžete vytvoriť maximálne 1 sezónu. Upgradujte na VIP pre vytvorenie viacerých sezón.'
        });
      }
    } else if (user.role === 'vip') {
      const userSeasonCount = await Season.count({
        where: { creatorId: userId }
      });
      
      if (userSeasonCount >= 2) {
        return res.status(403).json({
          success: false,
          message: 'Ako VIP užívateľ môžete vytvoriť maximálne 2 sezóny.'
        });
      }
    }
    
    // Generovanie jedinečného kódu pre pozvánku
    const inviteCode = uuidv4().substring(0, 6).toUpperCase();
    
    // Vytvorenie novej sezóny
    const newSeason = await Season.create({
      name,
      description,
      image,
      type: type || 'community',
      rules,
      inviteCode,
      creatorId: userId,
      active: true
    });
    
    // Označenie problémov pri vytváraní asociácie
    try {
      // Pridanie tvorcu ako účastníka sezóny s admin rolou
      await newSeason.addParticipant(userId, { 
        through: { role: 'admin' } 
      });
    } catch (assocError) {
      console.error('Chyba pri pridávaní tvorcu k sezóne:', assocError);
      // Pokračujeme aj napriek chybe asociácie
    }
    
    res.status(201).json({
      success: true,
      message: 'Sezóna bola úspešne vytvorená.',
      data: newSeason
    });
  } catch (error) {
    console.error('Chyba pri vytváraní sezóny:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vytváraní sezóny.',
      error: error.message
    });
  }
};

// Aktualizácia sezóny
const updateSeason = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, active, rules } = req.body;
    const userId = req.userId;
    
    // Načítanie sezóny
    const season = await Season.findByPk(id);
    
    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Sezóna nebola nájdená.'
      });
    }
    
    // Kontrola, či užívateľ je tvorcom sezóny alebo admin
    const user = await User.findByPk(userId);
    
    if (season.creatorId !== userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na aktualizáciu tejto sezóny.'
      });
    }
    
    // Aktualizácia sezóny
    if (name) season.name = name;
    if (description !== undefined) season.description = description;
    if (image !== undefined) season.image = image;
    if (active !== undefined) season.active = active;
    if (rules !== undefined) season.rules = rules;
    
    await season.save();
    
    res.status(200).json({
      success: true,
      message: 'Sezóna bola úspešne aktualizovaná.',
      data: season
    });
  } catch (error) {
    console.error('Chyba pri aktualizácii sezóny:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri aktualizácii sezóny.',
      error: error.message
    });
  }
};

// Vymazanie sezóny
const deleteSeason = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // Načítanie sezóny
    const season = await Season.findByPk(id);
    
    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Sezóna nebola nájdená.'
      });
    }
    
    // Kontrola, či užívateľ je tvorcom sezóny alebo admin
    const user = await User.findByPk(userId);
    
    if (season.creatorId !== userId && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Nemáte oprávnenie na vymazanie tejto sezóny.'
      });
    }
    
    // Vymazanie sezóny
    await season.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Sezóna bola úspešne vymazaná.'
    });
  } catch (error) {
    console.error('Chyba pri vymazávaní sezóny:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vymazávaní sezóny.',
      error: error.message
    });
  }
};

// Pripojenie k sezóne pomocou kódu
const joinSeason = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.userId;
    
    // Nájdenie sezóny podľa kódu
    const season = await Season.findOne({
      where: { inviteCode }
    });
    
    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Sezóna s týmto kódom nebola nájdená.'
      });
    }
    
    // Kontrola, či je sezóna aktívna
    if (!season.active) {
      return res.status(400).json({
        success: false,
        message: 'Táto sezóna nie je aktívna.'
      });
    }
    
    // Kontrola, či užívateľ už nie je v sezóne
    const isParticipant = await season.hasParticipant(userId);
    
    if (isParticipant) {
      return res.status(400).json({
        success: false,
        message: 'Už ste členom tejto sezóny.'
      });
    }
    
    // Pridanie užívateľa do sezóny
    await season.addParticipant(userId, { 
      through: { role: 'player' } 
    });
    
    res.status(200).json({
      success: true,
      message: 'Úspešne ste sa pripojili k sezóne.',
      data: {
        seasonId: season.id,
        seasonName: season.name
      }
    });
  } catch (error) {
    console.error('Chyba pri pripájaní k sezóne:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri pripájaní k sezóne.',
      error: error.message
    });
  }
};

// Získanie rebríčka sezóny
const getSeasonLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Kontrola existencie sezóny
    const seasonExists = await Season.findByPk(id);
    
    if (!seasonExists) {
      return res.status(404).json({
        success: false,
        message: 'Sezóna nebola nájdená.'
      });
    }
    
    // Získanie všetkých tipov v sezóne
    const tips = await Tip.findAll({
      include: [
        {
          model: Match,
          include: [
            {
              model: Round,
              include: [
                {
                  model: League,
                  where: { seasonId: id }
                }
              ]
            }
          ]
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
    console.error('Chyba pri získavaní rebríčka sezóny:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri získavaní rebríčka sezóny.',
      error: error.message
    });
  }
};

module.exports = {
  getAllSeasons,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
  joinSeason,
  getSeasonLeaderboard
};
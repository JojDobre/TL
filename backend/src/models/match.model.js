// models/match.model.js
module.exports = (sequelize, DataTypes) => {
    const Match = sequelize.define('Match', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      roundId: {
        type: DataTypes.INTEGER,  // Odkaz na kolo, do ktorého zápas patrí
        allowNull: false,
      },
      homeTeamId: {
        type: DataTypes.INTEGER,  // Odkaz na domáci tím
        allowNull: false,
      },
      awayTeamId: {
        type: DataTypes.INTEGER,  // Odkaz na hosťujúci tím
        allowNull: false,
      },
      matchTime: {
        type: DataTypes.DATE,  // Dátum a čas zápasu
        allowNull: false,
      },
      homeScore: {
        type: DataTypes.INTEGER,  // Skóre domáceho tímu
        allowNull: true,
      },
      awayScore: {
        type: DataTypes.INTEGER,  // Skóre hosťujúceho tímu
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'in_progress', 'finished', 'canceled'),  // Stav zápasu
        defaultValue: 'scheduled',
      },
      tipType: {
        // winner = víťaz 1/X/2 (možná remíza), winner_no_draw = víťaz 1/2 (bez remízy,
        // pre tenis/šípky a pod.), exact_score = presný výsledok
        type: DataTypes.ENUM('winner', 'winner_no_draw', 'exact_score'),
        defaultValue: 'exact_score',
      },
      // Ak je tento zápas v KLONOVANEJ lige, odkaz na zdrojový zápas v oficiálnej
      // lige-šablóne. Výsledok sa potom číta z originálu (jeden zdroj pravdy).
      sourceMatchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // --- automatické vyhodnocovanie (utils/auto-results.js) ---
      externalId: { type: DataTypes.STRING(32), allowNull: true },     // idEvent v TheSportsDB
      resultSource: { type: DataTypes.STRING(16), allowNull: true },   // 'manual' | 'auto'
      autoResults: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, // vypnutie pre 1 zápas
      autoCheckedAt: { type: DataTypes.DATE, allowNull: true },        // posledný pokus o stiahnutie výsledku
      autoAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      autoAlertedAt: { type: DataTypes.DATE, allowNull: true },        // admin upozornený, že výsledok chýba
    }, {
      tableName: 'matches',
      timestamps: true,
    });
  
    Match.associate = function(models) {
      // Zápas patrí do kola
      Match.belongsTo(models.Round, {
        foreignKey: 'roundId',
      });
      
      // Zápas má domáci tím
      Match.belongsTo(models.Team, {
        foreignKey: 'homeTeamId',
        as: 'homeTeam',
      });
      
      // Zápas má hosťujúci tím
      Match.belongsTo(models.Team, {
        foreignKey: 'awayTeamId',
        as: 'awayTeam',
      });
      
      // Zápas môže mať viacero tipov
      Match.hasMany(models.Tip, {
        foreignKey: 'matchId',
      });
    };
  
    return Match;
  };
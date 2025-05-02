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
        type: DataTypes.ENUM('winner', 'exact_score'),  // Typ tipovania: víťaz alebo presný výsledok
        defaultValue: 'exact_score',
      },
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
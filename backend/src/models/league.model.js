// models/league.model.js
module.exports = (sequelize, DataTypes) => {
    const League = sequelize.define('League', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      image: {
        type: DataTypes.STRING,  // URL k obrázku ligy
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('official', 'custom'),  // Typ ligy: oficiálna alebo vlastná
        defaultValue: 'custom',
      },
      password: {
        type: DataTypes.STRING,  // Heslo pre ligu (voliteľné)
        allowNull: true,
      },
      seasonId: {
        type: DataTypes.INTEGER,  // Odkaz na sezónu, do ktorej liga patrí
        allowNull: false,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      scoringSystem: {
        type: DataTypes.JSON,  // JSON s pravidlami bodovania
        allowNull: true,
        defaultValue: {  // Predvolený bodovací systém
          exactScore: 10,  // Presný výsledok
          correctGoals: 1,  // Správny počet gólov jedného tímu
          correctWinner: 3,  // Správny víťaz/remíza
          goalDifference: 2,  // Správny gólový rozdiel
        },
      },
      scoringLocked: {
        type: DataTypes.BOOLEAN,  // Či je bodovací systém uzamknutý (po začiatku prvého kola)
        defaultValue: false,
      },
    }, {
      tableName: 'leagues',
      timestamps: true,
    });
  
    League.associate = function(models) {
      // Liga patrí do sezóny
      League.belongsTo(models.Season, {
        foreignKey: 'seasonId',
      });
      
      // Liga môže mať viacero kôl
      League.hasMany(models.Round, {
        foreignKey: 'leagueId',
      });
    };
  
    return League;
  };
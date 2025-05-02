// models/tip.model.js
module.exports = (sequelize, DataTypes) => {
    const Tip = sequelize.define('Tip', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,  // Odkaz na používateľa, ktorý zadal tip
        allowNull: false,
      },
      matchId: {
        type: DataTypes.INTEGER,  // Odkaz na zápas, ku ktorému sa tip vzťahuje
        allowNull: false,
      },
      homeScore: {
        type: DataTypes.INTEGER,  // Tipované skóre domáceho tímu
        allowNull: true,
      },
      awayScore: {
        type: DataTypes.INTEGER,  // Tipované skóre hosťujúceho tímu
        allowNull: true,
      },
      winner: {
        type: DataTypes.ENUM('home', 'away', 'draw'),  // Tipovaný víťaz (ak je typ tipu 'winner')
        allowNull: true,
      },
      points: {
        type: DataTypes.INTEGER,  // Počet bodov získaných za tip
        defaultValue: 0,
      },
      submitted: {
        type: DataTypes.BOOLEAN,  // Či bol tip odoslaný
        defaultValue: false,
      },
    }, {
      tableName: 'tips',
      timestamps: true,
    });
  
    Tip.associate = function(models) {
      // Tip patrí používateľovi
      Tip.belongsTo(models.User, {
        foreignKey: 'userId',
      });
      
      // Tip sa vzťahuje na zápas
      Tip.belongsTo(models.Match, {
        foreignKey: 'matchId',
      });
    };
  
    return Tip;
  };
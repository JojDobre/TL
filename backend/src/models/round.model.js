// models/round.model.js
module.exports = (sequelize, DataTypes) => {
    const Round = sequelize.define('Round', {
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
      leagueId: {
        type: DataTypes.INTEGER,  // Odkaz na ligu, do ktorej kolo patrí
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATE,  // Dátum a čas začiatku tipovania
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATE,  // Dátum a čas konca tipovania
        allowNull: false,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    }, {
      tableName: 'rounds',
      timestamps: true,
    });
  
    Round.associate = function(models) {
      // Kolo patrí do ligy
      Round.belongsTo(models.League, {
        foreignKey: 'leagueId',
      });
      
      // Kolo môže mať viacero zápasov
      Round.hasMany(models.Match, {
        foreignKey: 'roundId',
      });
    };
  
    return Round;
  };
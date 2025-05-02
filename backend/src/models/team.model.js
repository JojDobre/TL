// models/team.model.js
module.exports = (sequelize, DataTypes) => {
    const Team = sequelize.define('Team', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      logo: {
        type: DataTypes.STRING,  // URL k logu tímu
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('official', 'community'),  // Typ tímu: oficiálny alebo komunitný
        defaultValue: 'community',
      },
      creatorId: {
        type: DataTypes.INTEGER,  // Odkaz na používateľa, ktorý vytvoril tím (ak je komunitný)
        allowNull: true,
      },
    }, {
      tableName: 'teams',
      timestamps: true,
    });
  
    Team.associate = function(models) {
      // Tím môže byť vytvorený používateľom
      Team.belongsTo(models.User, {
        foreignKey: 'creatorId',
        as: 'creator',
      });
      
      // Tím môže hrať v mnohých zápasoch ako domáci
      Team.hasMany(models.Match, {
        foreignKey: 'homeTeamId',
        as: 'homeMatches',
      });
      
      // Tím môže hrať v mnohých zápasoch ako hosť
      Team.hasMany(models.Match, {
        foreignKey: 'awayTeamId',
        as: 'awayMatches',
      });
    };
  
    return Team;
  };
// models/season.model.js
module.exports = (sequelize, DataTypes) => {
    const Season = sequelize.define('Season', {
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
        type: DataTypes.STRING,  // URL k obrázku sezóny
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('official', 'community'),  // Typ sezóny: oficiálna alebo komunitná
        defaultValue: 'community',
      },
      inviteCode: {
        type: DataTypes.STRING,  // Jedinečný kód na prihlásenie do sezóny
        allowNull: false,
        unique: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      rules: {
        type: DataTypes.TEXT,  // Pravidlá sezóny
        allowNull: true,
      },
      creatorId: {
        type: DataTypes.INTEGER,  // Odkaz na používateľa, ktorý vytvoril sezónu
        allowNull: false,
      },
    }, {
      tableName: 'seasons',
      timestamps: true,
    });
  
    Season.associate = function(models) {
      // Sezóna patrí používateľovi, ktorý ju vytvoril
      Season.belongsTo(models.User, {
        foreignKey: 'creatorId',
        as: 'creator',
      });
      
      // Sezóna môže mať viacero používateľov (hráčov)
      Season.belongsToMany(models.User, {
        through: models.UserSeason,  // Dôležité: použite správny spojovací model
        foreignKey: 'seasonId',
        as: 'participants',
      });
      
      // Sezóna môže mať viacero líg
      Season.hasMany(models.League, {
        foreignKey: 'seasonId',
      });
    };
  
    return Season;
  };
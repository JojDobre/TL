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
      type: DataTypes.STRING,  // URL k logu tímu (žiadne nahrávanie)
      allowNull: true,
    },
    // global = oficiálny tím (tvorí admin, vidia všetci)
    // custom = súkromný tím (tvorí používateľ, vidí len on)
    scope: {
      type: DataTypes.ENUM('global', 'custom'),
      defaultValue: 'custom',
    },
    // national = národný tím (bez športu, naprieč športmi)
    // club = klub (so športom + krajinou)
    // individual = jednotlivec (osoba — tenis, šípky, box…); súťaží sám za seba
    teamType: {
      type: DataTypes.ENUM('national', 'club', 'individual'),
      defaultValue: 'club',
    },
    // šport (kód z číselníka) — len pre kluby
    sport: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // krajina (kód z číselníka)
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // kto vytvoril (pri custom tíme)
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'teams',
    timestamps: true,
  });

  Team.associate = function (models) {
    Team.belongsTo(models.User, { foreignKey: 'creatorId', as: 'creator' });
    Team.hasMany(models.Match, { foreignKey: 'homeTeamId', as: 'homeMatches' });
    Team.hasMany(models.Match, { foreignKey: 'awayTeamId', as: 'awayMatches' });
    // Tím môže byť v súpiske viacerých líg
    Team.belongsToMany(models.League, {
      through: models.LeagueTeam,
      foreignKey: 'teamId',
      otherKey: 'leagueId',
      as: 'leagues',
    });
  };

  return Team;
};
// models/user-league.model.js
//
// Členstvo používateľa v lige (Model A). KĽÚČOVÉ: zložený primárny kľúč
// (userId, leagueId) — aby v lige mohlo byť veľa hráčov a každý raz.
// Pôvodný model spôsobil, že PK vznikol len na league_id (do ligy sa vošiel
// len 1 user). Necháme underscored mapovanie (user_id/league_id) ako vo zvyšku DB.
module.exports = (sequelize, DataTypes) => {
  const UserLeague = sequelize.define('UserLeague', {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    leagueId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: 'leagues', key: 'id' },
    },
    role: {
      type: DataTypes.ENUM('player', 'admin'),
      defaultValue: 'player',
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'user_leagues',
    timestamps: true,
  });

  return UserLeague;
};

// models/user-season.model.js
//
// Členstvo používateľa v sezóne. Zložený primárny kľúč (userId, seasonId) —
// pridané allowNull:false na oba kľúče, aby Sequelize vytvoril SPRÁVNY zložený
// PK (predtým vznikol PK len na season_id → do sezóny sa vošiel len 1 user).
module.exports = (sequelize, DataTypes) => {
  const UserSeason = sequelize.define('UserSeason', {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    seasonId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: 'seasons', key: 'id' },
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
    tableName: 'user_seasons',
    timestamps: true,
  });

  return UserSeason;
};

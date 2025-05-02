module.exports = (sequelize, DataTypes) => {
  const UserSeason = sequelize.define('UserSeason', {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    seasonId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: 'Seasons',
        key: 'id'
      }
    },
    role: {
      type: DataTypes.ENUM('player', 'admin'),
      defaultValue: 'player'
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_seasons',
    timestamps: true
  });

  return UserSeason;
};
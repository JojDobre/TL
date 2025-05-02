module.exports = (sequelize, DataTypes) => {
    const UserAchievement = sequelize.define('UserAchievement', {
      userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      achievementId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      dateAwarded: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    }, {
      tableName: 'user_achievements',
      timestamps: true,
    });
  
    return UserAchievement;
  };
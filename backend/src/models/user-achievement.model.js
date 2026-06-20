// models/user-achievement.model.js
//
// Spojovacia tabuľka medzi používateľom a získaným odznakom. dateAwarded drží
// dátum udelenia (zobrazuje sa v galérii „Získané …").
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

  UserAchievement.associate = function (models) {
    // Druhá strana M:N väzby z pohľadu používateľa.
    models.User.belongsToMany(models.Achievement, {
      through: UserAchievement,
      foreignKey: 'userId',
      otherKey: 'achievementId',
      as: 'achievements',
    });
  };

  return UserAchievement;
};

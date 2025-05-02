// models/achievement.model.js
module.exports = (sequelize, DataTypes) => {
    const Achievement = sequelize.define('Achievement', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,  // Názov achievementu
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,  // Popis achievementu
        allowNull: false,
      },
      icon: {
        type: DataTypes.STRING,  // URL k ikone achievementu
        allowNull: true,
      },
      criteria: {
        type: DataTypes.STRING,  // Kritérium pre získanie achievementu
        allowNull: false,
      },
      value: {
        type: DataTypes.INTEGER,  // Hodnota potrebná na splnenie kritéria
        allowNull: false,
      },
    }, {
      tableName: 'achievements',
      timestamps: true,
    });
  
    Achievement.associate = function(models) {
      // Achievement môže byť získaný viacerými používateľmi
      Achievement.belongsToMany(models.User, {
        through: 'UserAchievements',
        foreignKey: 'achievementId',
      });
    };
  
    return Achievement;
  };
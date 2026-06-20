// models/achievement.model.js
//
// Odznak (achievement). Rozšírené o polia potrebné pre šablónu achievements.html:
// rarity (common/rare/epic/legendary), emoji ikona, farebný akcent a strojový
// `code` na previazanie s vyhodnocovacou logikou (achievement engine).
module.exports = (sequelize, DataTypes) => {
  const Achievement = sequelize.define('Achievement', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // Strojový identifikátor (napr. 'first_tip', 'century'), použije ho engine.
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,  // Názov odznaku
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,  // Popis odznaku
      allowNull: false,
    },
    // Emoji ikona (šablóna používa emoji, nie obrázky). Pôvodné pole `icon`
    // ponechané kvôli spätnej kompatibilite, ale primárne plníme emoji sem.
    icon: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '🏅',
    },
    // Vzácnosť odznaku — riadi farbu štítku v UI.
    rarity: {
      type: DataTypes.ENUM('common', 'rare', 'epic', 'legendary'),
      allowNull: false,
      defaultValue: 'common',
    },
    // Druh kritéria, ktoré engine vyhodnocuje (napr. 'tips_total',
    // 'exact_total', 'first_tip', 'create_league', 'podium', 'measurable:false').
    criteria: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Cieľová hodnota kritéria (napr. 100 tipov). Pri nemerateľných = 0.
    value: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Či je odznak v súčasnosti vyhodnotiteľný z dostupných dát. Nemerateľné
    // (napr. „odtipoval do 60 sekúnd") ostávajú ako budúce ciele v locked stave.
    measurable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // Poradie zobrazenia v galérii.
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
  }, {
    tableName: 'achievements',
    timestamps: true,
  });

  Achievement.associate = function (models) {
    // M:N cez explicitný model UserAchievement (tabuľka user_achievements).
    Achievement.belongsToMany(models.User, {
      through: models.UserAchievement,
      foreignKey: 'achievementId',
      otherKey: 'userId',
      as: 'users',
    });
  };

  return Achievement;
};

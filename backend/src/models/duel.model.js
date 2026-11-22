// models/duel.model.js
//
// SÚBOJ 1 NA 1: hráč vyzve iného hráča z tej istej ligy na jedno kolo. Kto
// v kole získa viac bodov, vyhrá. Výsledok sa nepočíta dopredu — odvodí sa
// z bodov tipov v kole (utils/duel.util.js).
module.exports = (sequelize, DataTypes) => {
  const Duel = sequelize.define('Duel', {
    roundId: { type: DataTypes.INTEGER, allowNull: false },
    challengerId: { type: DataTypes.INTEGER, allowNull: false },
    opponentId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'accepted', 'declined', 'canceled'), allowNull: false, defaultValue: 'pending' },
    resultNotifiedAt: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'duels', timestamps: true });

  Duel.associate = (models) => {
    Duel.belongsTo(models.Round, { foreignKey: 'roundId' });
    Duel.belongsTo(models.User, { as: 'challenger', foreignKey: 'challengerId' });
    Duel.belongsTo(models.User, { as: 'opponent', foreignKey: 'opponentId' });
  };
  return Duel;
};

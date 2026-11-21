// Automatické dopĺňanie chýbajúcich lôg tímov z TheSportsDB:
// kedy sa logo tímu naposledy hľadalo (aby sa neúspešné hľadanie neopakovalo stále dookola).
module.exports = {
  async up({ Sequelize, addColumnIfMissing, addIndexIfMissing }) {
    const { DataTypes } = Sequelize;
    await addColumnIfMissing('teams', 'logo_checked_at', { type: DataTypes.DATE, allowNull: true });
    await addIndexIfMissing('teams', 'teams_logo_checked_at', ['logo_checked_at']);
  },
};

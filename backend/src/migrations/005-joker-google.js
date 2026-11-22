// Žolík (dvojnásobné body za jeden zápas v kole, zapína sa v nastaveniach
// ligy) a prihlásenie cez Google (ID účtu Google pri používateľovi).
module.exports = {
  async up({ Sequelize, addColumnIfMissing, addIndexIfMissing }) {
    const { DataTypes } = Sequelize;
    await addColumnIfMissing('leagues', 'joker_enabled', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumnIfMissing('tips', 'is_joker', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumnIfMissing('users', 'google_id', { type: DataTypes.STRING(64), allowNull: true });
    await addIndexIfMissing('users', 'users_google_id', ['google_id']);
  },
};

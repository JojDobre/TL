// nový typ notifikácie „duel“ (výzva, prijatie, výsledok súboja 1 na 1)
module.exports = {
  async up({ sequelize }) {
    await sequelize.query("ALTER TABLE `notifications` MODIFY `type` ENUM('new_round','deadline','result','achievement','admin','rank','member','canceled','season','sysadmin','duel') NOT NULL");
  },
};

// Súboje 1 na 1 (hráč vyzve hráča na kolo) a pripomienka netipnutých zápasov
// 2 h pred ich začiatkom (príznak na zápase, aby sa neposlala dvakrát).
module.exports = {
  async up({ sequelize, Sequelize, tableExists, addColumnIfMissing, addIndexIfMissing }) {
    const { DataTypes } = Sequelize;
    await addColumnIfMissing('matches', 'remind_notified_at', { type: DataTypes.DATE, allowNull: true });
    if (!(await tableExists('duels'))) {
      await sequelize.query(
        'CREATE TABLE `duels` ('
        + '`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY, '
        + '`round_id` INT NOT NULL, '
        + '`challenger_id` INT NOT NULL, '
        + '`opponent_id` INT NOT NULL, '
        + "`status` ENUM('pending','accepted','declined','canceled') NOT NULL DEFAULT 'pending', "
        + '`result_notified_at` DATETIME NULL, '
        + '`created_at` DATETIME NOT NULL, `updated_at` DATETIME NOT NULL, '
        + 'CONSTRAINT `duels_round_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE, '
        + 'CONSTRAINT `duels_challenger_fk` FOREIGN KEY (`challenger_id`) REFERENCES `users` (`id`) ON DELETE CASCADE, '
        + 'CONSTRAINT `duels_opponent_fk` FOREIGN KEY (`opponent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE'
        + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
      );
    }
    await addIndexIfMissing('duels', 'duels_challenger', ['challenger_id']);
    await addIndexIfMissing('duels', 'duels_opponent', ['opponent_id']);
    await addIndexIfMissing('duels', 'duels_round', ['round_id']);
  },
};

// Automatické vyhodnocovanie výsledkov a synchronizácia programu (TheSportsDB).
module.exports = {
  async up({ Sequelize, addColumnIfMissing, addIndexIfMissing }) {
    const { DataTypes } = Sequelize;

    // --- leagues: prepojenie so súťažou u poskytovateľa ---
    await addColumnIfMissing('leagues', 'external_source', { type: DataTypes.STRING(32), allowNull: true });
    await addColumnIfMissing('leagues', 'external_league_id', { type: DataTypes.STRING(32), allowNull: true });
    await addColumnIfMissing('leagues', 'external_season', { type: DataTypes.STRING(32), allowNull: true });
    await addColumnIfMissing('leagues', 'auto_results', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
    await addColumnIfMissing('leagues', 'auto_sync_fixtures', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
    await addColumnIfMissing('leagues', 'external_sync_cursor', { type: DataTypes.INTEGER, allowNull: true });
    await addColumnIfMissing('leagues', 'external_synced_at', { type: DataTypes.DATE, allowNull: true });
    await addColumnIfMissing('leagues', 'external_sync_note', { type: DataTypes.STRING(500), allowNull: true });

    // --- rounds: číslo kola u poskytovateľa ---
    await addColumnIfMissing('rounds', 'external_round', { type: DataTypes.INTEGER, allowNull: true });

    // --- matches: id udalosti, zdroj výsledku, stav automatického vyhodnotenia ---
    await addColumnIfMissing('matches', 'external_id', { type: DataTypes.STRING(32), allowNull: true });
    await addColumnIfMissing('matches', 'result_source', { type: DataTypes.STRING(16), allowNull: true });
    await addColumnIfMissing('matches', 'auto_results', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
    await addColumnIfMissing('matches', 'auto_checked_at', { type: DataTypes.DATE, allowNull: true });
    await addColumnIfMissing('matches', 'auto_attempts', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnIfMissing('matches', 'auto_alerted_at', { type: DataTypes.DATE, allowNull: true });

    await addIndexIfMissing('matches', 'matches_external_id', ['external_id']);
    await addIndexIfMissing('leagues', 'leagues_external', ['external_source', 'external_league_id']);
  },
};

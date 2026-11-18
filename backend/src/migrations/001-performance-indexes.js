// Indexy pre najčastejšie dotazy + unikátny tip (jeden hráč = jeden tip na zápas).
module.exports = {
  async up({ sequelize, select, addIndexIfMissing, indexExists, tableExists, log }) {
    // --- tips: odstráň duplicitné tipy (súbeh / dvojklik) pred unikátnym indexom ---
    // Ponecháme najnovší záznam (najvyššie id) pre každú dvojicu hráč+zápas.
    if (await tableExists('tips') && !(await indexExists('tips', 'tips_user_match_unique'))) {
      const dups = await select(
        'SELECT COUNT(*) AS n FROM tips t JOIN tips t2 '
        + 'ON t.user_id = t2.user_id AND t.match_id = t2.match_id AND t.id < t2.id',
      );
      const n = Number(dups[0] && dups[0].n) || 0;
      if (n > 0) {
        await sequelize.query(
          'DELETE t FROM tips t JOIN tips t2 '
          + 'ON t.user_id = t2.user_id AND t.match_id = t2.match_id AND t.id < t2.id',
        );
        log(`[migrate]   odstránených duplicitných tipov: ${n}`);
      }
    }
    await addIndexIfMissing('tips', 'tips_user_match_unique', ['user_id', 'match_id'], { unique: true });

    await addIndexIfMissing('matches', 'matches_round_time', ['round_id', 'match_time']);
    await addIndexIfMissing('matches', 'matches_status_time', ['status', 'match_time']);
    await addIndexIfMissing('matches', 'matches_source_match', ['source_match_id']);

    await addIndexIfMissing('rounds', 'rounds_league_dates', ['league_id', 'start_date', 'end_date']);
    await addIndexIfMissing('rounds', 'rounds_dates', ['start_date', 'end_date']);
    await addIndexIfMissing('rounds', 'rounds_source_round', ['source_round_id']);

    await addIndexIfMissing('leagues', 'leagues_template', ['template_id']);
    await addIndexIfMissing('leagues', 'leagues_type_tpl', ['type', 'is_template']);

    await addIndexIfMissing('seasons', 'seasons_type_created', ['type', 'created_at']);

    await addIndexIfMissing('notifications', 'notifications_user_read', ['user_id', 'read']);
    await addIndexIfMissing('notifications', 'notifications_user_created', ['user_id', 'created_at']);

    await addIndexIfMissing('users', 'users_is_bot', ['is_bot']);
  },
};

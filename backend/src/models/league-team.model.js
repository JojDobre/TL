// models/league-team.model.js
//
// Súpiska tímov ligy (many-to-many liga ↔ tím). Z týchto tímov sa potom tvoria
// zápasy v create-matches. Zložený PK (leagueId, teamId) — allowNull:false na
// oboch kľúčoch, aby Sequelize vytvoril SPRÁVNY zložený PK (nie len jeden stĺpec).
module.exports = (sequelize, DataTypes) => {
  const LeagueTeam = sequelize.define('LeagueTeam', {
    leagueId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: 'leagues', key: 'id' },
    },
    teamId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
    },
  }, {
    tableName: 'league_teams',
    timestamps: true,
  });

  return LeagueTeam;
};

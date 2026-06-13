// frontend/src/components/ui/Leaderboard.js
//
// Rebríček a štatistická dlaždica. Nad components.css.

import React from 'react';
import { Avatar } from './Primitives';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* Jeden riadok rebríčka.
   rank, name, sub (napr. počet tipov), points, trend (+/-/0), me (zvýraznenie). */
export const LeaderboardRow = ({ rank, name, sub, points, avatarSrc, trend, me }) => {
  // Top 3 dostávajú zlatú/striebornú/bronzovú farbu hodnosti
  const rankClass = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
  // Trend: kladný = hore (zelená), záporný = dole (červená), 0 = bez zmeny
  const trendClass = trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-flat';
  const trendText = trend > 0 ? `▲${trend}` : trend < 0 ? `▼${Math.abs(trend)}` : '–';

  return (
    <div className={cx('lb-row', me && 'me')}>
      <div className={cx('lb-rank', rankClass)}>{rank}</div>
      <div className="lb-user">
        <Avatar size="sm" src={avatarSrc} name={name} />
        <div style={{ minWidth: 0 }}>
          <div className="lb-name">{name}</div>
          {sub && <div className="lb-sub">{sub}</div>}
        </div>
      </div>
      <div className="lb-pts">{points}</div>
      {trend !== undefined && <div className={cx('lb-trend', trendClass)}>{trendText}</div>}
    </div>
  );
};

// Obal rebríčka
export const Leaderboard = ({ children, className }) => (
  <div className={cx('lb', className)}>{children}</div>
);

/* Štatistická dlaždica.
   label, value, tone ('brand'|'gold'), delta (zmena). */
export const StatTile = ({ label, value, tone, delta }) => (
  <div className="stat card">
    <div className="stat-label">{label}</div>
    <div className={cx('stat-value', tone)}>{value}</div>
    {delta && <div className="stat-delta">{delta}</div>}
  </div>
);

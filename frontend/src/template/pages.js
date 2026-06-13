// frontend/src/template/pages.js
//
// Generuje React komponent pre každú stránku šablóny. Každý komponent len obalí
// telo zo šablóny cez TemplatePage. Stránky s backendom dostanú onMount hook,
// ktorý po vykreslení doplní reálne dáta do markupu (bez zmeny štruktúry).
//
// Import v App.js:
//   import { Seasons, SeasonDetail, AdminUsers, ... } from './template/pages';

import React from 'react';
import TemplatePage from './TemplatePage';

// --- import všetkých HTML modulov (musia byť hore kvôli ESLint import/first) ---
import * as mHome from './html/index.html.js';
import * as mSeasons from './html/seasons.html.js';
import * as mSeason from './html/season.html.js';
import * as mLeague from './html/league.html.js';
import * as mRound from './html/round.html.js';
import * as mRoundResults from './html/round-results.html.js';
import * as mCreateSeason from './html/create-season.html.js';
import * as mCreateLeague from './html/create-league.html.js';
import * as mCreateRound from './html/create-round.html.js';
import * as mCreateMatches from './html/create-matches.html.js';
import * as mCreateTeam from './html/create-team.html.js';
import * as mLogin from './html/login.html.js';
import * as mRegister from './html/register.html.js';
import * as mForgot from './html/forgot-password.html.js';
import * as mProfile from './html/profile.html.js';
import * as mSettings from './html/settings.html.js';
import * as mMy from './html/my.html.js';
import * as mTipHistory from './html/tip-history.html.js';
import * as mStats from './html/stats.html.js';
import * as mAchievements from './html/achievements.html.js';
import * as mNotifications from './html/notifications.html.js';
import * as mDiscover from './html/discover.html.js';
import * as mJoin from './html/join.html.js';
import * as mLeave from './html/leave-competition.html.js';
import * as mPlayer from './html/player.html.js';
import * as mCompare from './html/compare.html.js';
import * as mLeaderboards from './html/leaderboards.html.js';
import * as mBlog from './html/blog.html.js';
import * as mBlogPost from './html/blog-post.html.js';
import * as mAbout from './html/about.html.js';
import * as mKontakt from './html/kontakt.html.js';
import * as mAdmin from './html/admin.html.js';
import * as mAdminUsers from './html/admin-users.html.js';
import * as mAdminLeagues from './html/admin-leagues.html.js';
import * as mAdminCompetition from './html/admin-competition.html.js';
import * as mAdminEvaluate from './html/admin-evaluate.html.js';
import * as mNotFound from './html/404.html.js';
import * as mError from './html/error.html.js';

// Pomocník: vytvorí stránkový komponent z modulu šablóny
const make = (mod, onMount) => () => (
  <TemplatePage html={mod.html} dataPage={mod.dataPage} inlineScript={mod.inlineScript} onMount={onMount} />
);

// onMount hooky pre napojenie backendu doplníme v ďalšom kroku.
// Zatiaľ všetky stránky renderujú telo 1:1 so šablónovými (ukážkovými) dátami.

export const Home = make(mHome);
export const Seasons = make(mSeasons);
export const SeasonDetail = make(mSeason);
export const LeagueDetail = make(mLeague);
export const RoundDetail = make(mRound);
export const RoundResults = make(mRoundResults);
export const CreateSeason = make(mCreateSeason);
export const CreateLeague = make(mCreateLeague);
export const CreateRound = make(mCreateRound);
export const CreateMatches = make(mCreateMatches);
export const CreateTeam = make(mCreateTeam);
export const Login = make(mLogin);
export const Register = make(mRegister);
export const ForgotPassword = make(mForgot);
export const Profile = make(mProfile);
export const Settings = make(mSettings);
export const My = make(mMy);
export const TipHistory = make(mTipHistory);
export const Stats = make(mStats);
export const Achievements = make(mAchievements);
export const Notifications = make(mNotifications);
export const Discover = make(mDiscover);
export const Join = make(mJoin);
export const LeaveCompetition = make(mLeave);
export const PlayerProfile = make(mPlayer);
export const Compare = make(mCompare);
export const Leaderboards = make(mLeaderboards);
export const Blog = make(mBlog);
export const BlogPost = make(mBlogPost);
export const About = make(mAbout);
export const Kontakt = make(mKontakt);
export const AdminDashboard = make(mAdmin);
export const AdminUsers = make(mAdminUsers);
export const AdminLeagues = make(mAdminLeagues);
export const AdminCompetition = make(mAdminCompetition);
export const AdminEvaluate = make(mAdminEvaluate);
export const NotFound = make(mNotFound);
export const ErrorPage = make(mError);
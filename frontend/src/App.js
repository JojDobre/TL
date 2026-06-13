// frontend/src/App.js
//
// Každá stránka prenáša CELÉ telo zo šablóny vrátane navbaru a footera
// (generuje shell.js). Preto tu NIE JE žiadny Layout — stránky sú samostatné.

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AuthProvider } from './contexts/AuthContext';
import buildTheme from './theme';

import {
  Home, Seasons, SeasonDetail, LeagueDetail, RoundDetail, RoundResults,
  CreateSeason, CreateLeague, CreateRound, CreateMatches, CreateTeam,
  Login, Register, ForgotPassword, Profile, Settings,
  My, TipHistory, Stats, Achievements, Notifications,
  Discover, Join, LeaveCompetition, PlayerProfile, Compare,
  Leaderboards, Blog, BlogPost, About, Kontakt,
  AdminDashboard, AdminUsers, AdminLeagues, AdminCompetition, AdminEvaluate,
  NotFound, ErrorPage,
} from './template/pages';

const theme = buildTheme('dark');

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              <Route path="/seasons" element={<Seasons />} />
              <Route path="/seasons/create" element={<CreateSeason />} />
              <Route path="/seasons/:id" element={<SeasonDetail />} />
              <Route path="/leagues/create" element={<CreateLeague />} />
              <Route path="/leagues/:id" element={<LeagueDetail />} />
              <Route path="/rounds/create" element={<CreateRound />} />
              <Route path="/rounds/:id" element={<RoundDetail />} />
              <Route path="/rounds/:id/results" element={<RoundResults />} />
              <Route path="/matches/create" element={<CreateMatches />} />
              <Route path="/teams/create" element={<CreateTeam />} />

              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/my" element={<My />} />
              <Route path="/tip-history" element={<TipHistory />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/notifications" element={<Notifications />} />

              <Route path="/discover" element={<Discover />} />
              <Route path="/join" element={<Join />} />
              <Route path="/leave" element={<LeaveCompetition />} />
              <Route path="/player/:id" element={<PlayerProfile />} />
              <Route path="/compare" element={<Compare />} />

              <Route path="/leaderboards" element={<Leaderboards />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:id" element={<BlogPost />} />
              <Route path="/about" element={<About />} />
              <Route path="/kontakt" element={<Kontakt />} />

              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/leagues" element={<AdminLeagues />} />
              <Route path="/admin/competition" element={<AdminCompetition />} />
              <Route path="/admin/evaluate" element={<AdminEvaluate />} />

              <Route path="/error" element={<ErrorPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;

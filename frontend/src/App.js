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
import ProtectedRoute from './components/auth/ProtectedRoute';
import buildTheme from './theme';

import {
  Home, LeagueDetail, RoundDetail, RoundResults,
  CreateLeague, CreateRound, CreateMatches, CreateTeam,
  ForgotPassword, Profile, Settings,
  My, TipHistory, Stats, Achievements, Notifications,
  Discover, Join, LeaveCompetition, PlayerProfile, Compare,
  Leaderboards, Blog, BlogPost, About, Kontakt,
  AdminDashboard, AdminLeagues, AdminCompetition, AdminEvaluate,
  NotFound, ErrorPage,
} from './template/pages';
// Login a Register sú napojené na AuthContext (samostatný súbor)
import { Login, Register } from './template/authPages';
// Admin — užívatelia: napojené na reálne dáta (userService)
import AdminUsersPage from './template/adminUsersPage';
// Sezóny — napojené na reálne dáta (seasonService)
import SeasonsPage from './template/seasonsPage';
import SeasonDetailPage from './template/seasonDetailPage';
import CreateSeasonPage from './template/createSeasonPage';

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

              <Route path="/seasons" element={<SeasonsPage />} />
              <Route path="/seasons/create" element={<CreateSeasonPage />} />
              <Route path="/seasons/:id" element={<SeasonDetailPage />} />
              <Route path="/leagues/create" element={<CreateLeague />} />
              <Route path="/leagues/:id" element={<LeagueDetail />} />
              <Route path="/rounds/create" element={<CreateRound />} />
              <Route path="/rounds/:id" element={<RoundDetail />} />
              <Route path="/rounds/:id/results" element={<RoundResults />} />
              <Route path="/matches/create" element={<CreateMatches />} />
              <Route path="/teams/create" element={<CreateTeam />} />

              <Route path="/profile" element={<ProtectedRoute />}>
                <Route index element={<Profile />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/settings" element={<Settings />} />
                <Route path="/my" element={<My />} />
                <Route path="/tip-history" element={<TipHistory />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/join" element={<Join />} />
                <Route path="/leave" element={<LeaveCompetition />} />
              </Route>

              <Route path="/discover" element={<Discover />} />
              <Route path="/player/:id" element={<PlayerProfile />} />
              <Route path="/compare" element={<Compare />} />

              <Route path="/leaderboards" element={<Leaderboards />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:id" element={<BlogPost />} />
              <Route path="/about" element={<About />} />
              <Route path="/kontakt" element={<Kontakt />} />

              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/leagues" element={<AdminLeagues />} />
                <Route path="/admin/competition" element={<AdminCompetition />} />
                <Route path="/admin/evaluate" element={<AdminEvaluate />} />
              </Route>

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
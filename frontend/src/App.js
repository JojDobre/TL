// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AuthProvider } from './contexts/AuthContext';

// Komponenty pre layout
import Layout from './components/layout/Layout';

// Komponenty pre autentifikáciu
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Profile from './components/auth/Profile';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Komponenty pre domovskú stránku
import Home from './components/home/Home';

// Komponenty pre sezóny
import SeasonsList from './components/season/SeasonsList';
import CreateSeason from './components/season/CreateSeason';
import SeasonDetail from './components/season/SeasonDetail';

// Komponenty pre ligy
import CreateLeague from './components/league/CreateLeague';
import LeagueDetail from './components/league/LeagueDetail';

// Komponenty pre kolá
import CreateRound from './components/round/CreateRound';
import RoundDetail from './components/round/RoundDetail';

// Komponenty pre zápasy
import CreateMatches from './components/match/CreateMatches';

// Vytvorenie témy
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AuthProvider>
          <Router>
            <Layout>
              <Routes>
                {/* Verejné cesty */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/seasons" element={<SeasonsList />} />
                <Route path="/seasons/:id" element={<SeasonDetail />} />
                <Route path="/leagues/:id" element={<LeagueDetail />} />
                <Route path="/rounds/:id" element={<RoundDetail />} />
                
                {/* Chránené cesty (vyžadujú autentifikáciu) */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/seasons/create" element={<CreateSeason />} />
                  <Route path="/leagues/create" element={<CreateLeague />} />
                  <Route path="/rounds/create" element={<CreateRound />} />
                  <Route path="/matches/create" element={<CreateMatches />} />
                </Route>
                
                {/* Cesty vyžadujúce admin rolu */}
                <Route element={<ProtectedRoute requiredRole="admin" />}>
                  <Route path="/admin" element={<div>Admin Panel</div>} />
                </Route>
                
                {/* Ostatné cesty */}
                <Route path="/about" element={<div>O nás</div>} />
                <Route path="/blog" element={<div>Blog</div>} />
                <Route path="/leaderboards" element={<div>Rebríčky</div>} />
                
                {/* Fallback cesta */}
                <Route path="*" element={<div>Stránka nenájdená</div>} />
              </Routes>
            </Layout>
          </Router>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
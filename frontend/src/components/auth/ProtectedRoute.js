// frontend/src/components/auth/ProtectedRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

// Komponent pre ochranu ciest, ktoré vyžadujú autentifikáciu
const ProtectedRoute = ({ requiredRole }) => {
  const { user, loading, isAuthenticated, isAdmin, isVIP } = useAuth();
  
  // Ak sa načítavajú údaje o používateľovi, zobrazíme loading spinner
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Ak používateľ nie je autentifikovaný, presmerujeme ho na prihlásenie
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // Ak je vyžadovaná rola admin a používateľ nie je admin, presmerujeme ho
  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/" />;
  }
  
  // Ak je vyžadovaná rola vip a používateľ nie je vip ani admin, presmerujeme ho
  if (requiredRole === 'vip' && !isVIP) {
    return <Navigate to="/" />;
  }
  
  // Používateľ je autentifikovaný a má požadovanú rolu, zobrazíme chránený obsah
  return <Outlet />;
};

export default ProtectedRoute;
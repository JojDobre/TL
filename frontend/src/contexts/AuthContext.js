// frontend/src/contexts/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// Vytvorenie kontextu pre autentifikáciu
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Stav pre používateľa a nahrávanie
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Pri načítaní aplikácie skontrolujeme, či je používateľ prihlásený
  useEffect(() => {
    const loadUser = async () => {
      // Skontrolujeme, či máme uložený token
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          // Nastavenie autorizačnej hlavičky pre všetky requesty
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Získanie profilu používateľa
          const response = await axios.get('/api/auth/profile');
          
          // Nastavenie používateľa do stavu
          setUser(response.data.data);
        } catch (error) {
          // Ak token nie je platný, odstránime ho
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      
      setLoading(false);
    };
    
    loadUser();
  }, []);
  
  // Funkcia pre prihlásenie
  const login = async (email, password) => {
    try {
      // Poslanie požiadavky na prihlásenie
      const response = await axios.post('/api/auth/login', { email, password });
      
      // Uloženie tokenu do localStorage
      localStorage.setItem('token', response.data.data.token);
      
      // Nastavenie autorizačnej hlavičky pre všetky requesty
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.data.token}`;
      
      // Nastavenie používateľa do stavu
      setUser(response.data.data.user);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Chyba pri prihlásení'
      };
    }
  };
  
  // Funkcia pre registráciu
  const register = async (userData) => {
    try {
      // Poslanie požiadavky na registráciu
      const response = await axios.post('/api/auth/register', userData);
      
      // Uloženie tokenu do localStorage
      localStorage.setItem('token', response.data.data.token);
      
      // Nastavenie autorizačnej hlavičky pre všetky requesty
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.data.token}`;
      
      // Nastavenie používateľa do stavu
      setUser(response.data.data.user);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Chyba pri registrácii'
      };
    }
  };
  
  // Funkcia pre odhlásenie
  const logout = () => {
    // Odstránenie tokenu z localStorage
    localStorage.removeItem('token');
    
    // Odstránenie autorizačnej hlavičky
    delete axios.defaults.headers.common['Authorization'];
    
    // Nastavenie používateľa na null
    setUser(null);
  };
  
  // Funkcia pre aktualizáciu profilu
  const updateProfile = async (userData) => {
    try {
      // Poslanie požiadavky na aktualizáciu profilu
      const response = await axios.put('/api/auth/profile', userData);
      
      // Aktualizácia používateľa v stave
      setUser(response.data.data);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Chyba pri aktualizácii profilu'
      };
    }
  };
  
  // Funkcia pre zmenu hesla
  const changePassword = async (currentPassword, newPassword) => {
    try {
      // Poslanie požiadavky na zmenu hesla
      await axios.put('/api/auth/change-password', { currentPassword, newPassword });
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Chyba pri zmene hesla'
      };
    }
  };
  
  // Poskytnutie kontextu pre potomkov
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isVIP: user?.role === 'vip' || user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook pre jednoduché použitie AuthContext
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
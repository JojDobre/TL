// frontend/src/components/layout/Layout.js
import React from 'react';
import { Box } from '@mui/material';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Transparentný navbar */}
      <Navbar />
      
      <Box component="main" sx={{ 
        flexGrow: 1, 
        pt: { xs: '56px', sm: '64px' } // Padding top na vypĺňanie priestoru navbaru
      }}>
        {children}
      </Box>
      
      <Box component="footer" sx={{ py: 3, bgcolor: 'background.paper', textAlign: 'center' }}>
        © {new Date().getFullYear()} Tiperliga - Všetky práva vyhradené
      </Box>
    </Box>
  );
};

export default Layout;
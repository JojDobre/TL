// frontend/src/components/layout/Layout.js
import React from 'react';
import { Container, Box } from '@mui/material';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
        {children}
      </Container>
      <Box component="footer" sx={{ py: 3, bgcolor: 'background.paper', textAlign: 'center' }}>
        © {new Date().getFullYear()} Tiperliga - Všetky práva vyhradené
      </Box>
    </Box>
  );
};

export default Layout;
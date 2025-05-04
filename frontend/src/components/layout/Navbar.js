
// frontend/src/components/layout/Navbar.js
import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  Container,
  Avatar,
  Button,
  Tooltip,
  MenuItem,
  Link
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';

const Navbar = () => {
  // State pre mobilné menu
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);

  // Nový state pre sledovanie scrollu
  const [scrolled, setScrolled] = useState(false);

  // Hook pre navigáciu a autentifikáciu
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  
  // Položky menu
  const pages = [
    { title: 'Domov', path: '/' },
    { title: 'Sezóny', path: '/seasons' },
    { title: 'O nás', path: '/about' },
    { title: 'Blog', path: '/blog' },
  ];

    // Effect pre sledovanie scrollu
  useEffect(() => {
    const handleScroll = () => {
      // Nastavíme threshold na 50px - po scrollovaní 50px sa zmení pozadie
      const isScrolled = window.scrollY > 50;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };
    
    // Pridáme event listener pre scroll
    window.addEventListener('scroll', handleScroll);
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);
  
  // Položky používateľského menu pre prihlásených používateľov
  const userMenuItems = [
    { title: 'Profil', path: '/profile' },
    { title: 'Moje tipy', path: '/my-tips' },
  ];
  
  // Položky používateľského menu pre admin používateľov
  if (isAdmin) {
    userMenuItems.push({ title: 'Admin', path: '/admin' });
  }
  
  
  // Handlery pre otvorenie/zatvorenie menu
  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };
  
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };
  
  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };
  
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  
  // Handler pre položky používateľského menu
  const handleUserMenuItemClick = (path) => {
    handleCloseUserMenu();
    
    if (path === 'logout') {
      logout();
      navigate('/');
    } else {
      navigate(path);
    }
  };
  
  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        background: scrolled ? 'rgba(32, 31, 31, 0.95)' : 'transparent', // Zmena pozadia podľa scrollu
        boxShadow: scrolled ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none', // Pridanie tieňa pri scrolle
        backdropFilter: scrolled ? 'blur(10px)' : 'none', // Pridanie efektu blur pri scrolle
        transition: 'all 0.3s ease', // Plynulá animácia zmien
        zIndex: 10,
      }}
      elevation={scrolled ? 4 : 0}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo pre desktop */}
          <SportsSoccerIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1, color: 'white' }} />
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'white',
              textDecoration: 'none',
            }}
          >
            TIPERLIGA
          </Typography>

          {/* Menu pre mobilné zariadenia */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              sx={{ color: 'white' }}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: 'block', md: 'none' },
              }}
            >
              {pages.map((page) => (
                <MenuItem 
                  key={page.title} 
                  onClick={() => {
                    handleCloseNavMenu();
                    navigate(page.path);
                  }}
                >
                  <Typography textAlign="center">{page.title}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Logo pre mobilné zariadenia */}
          <SportsSoccerIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1, color: 'white' }} />
          <Typography
            variant="h5"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'white',
              textDecoration: 'none',
            }}
          >
            TIPERLIGA
          </Typography>

          {/* Menu pre desktop */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page) => (
              <Button
                key={page.title}
                component={RouterLink}
                to={page.path}
                onClick={handleCloseNavMenu}
                sx={{ my: 2, color: 'white', display: 'block' }}
              >
                {page.title}
              </Button>
            ))}
          </Box>

          {/* Používateľské menu */}
          <Box sx={{ flexGrow: 0 }}>
            {isAuthenticated ? (
              <>
                <Tooltip title="Otvoriť nastavenia">
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar 
                      alt={user?.username} 
                      src={user?.profileImage} 
                      sx={{ bgcolor: 'secondary.main' }}
                    >
                      {user?.username?.charAt(0).toUpperCase()}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  sx={{ mt: '45px' }}
                  id="menu-appbar"
                  anchorEl={anchorElUser}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                >
                  {/* Položky používateľského menu */}
                  {/* ... */}
                </Menu>
              </>
            ) : (
              <Box sx={{ display: 'flex' }}>
                <Button
                  component={RouterLink}
                  to="/login"
                  sx={{ color: 'white', mr: 1 }}
                >
                  Prihlásiť sa
                </Button>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  color="secondary"
                >
                  Registrovať sa
                </Button>
              </Box>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
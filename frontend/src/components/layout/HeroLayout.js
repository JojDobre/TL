// frontend/src/components/layout/HeroLayout.js
import React from 'react';
import { Box, Typography, styled } from '@mui/material';
import Navbar from './Navbar';

// Styled komponenty
const HeroContainer = styled(Box)({
  width: '100%',
  backgroundColor: '#201F1F',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '588px',
  padding: 0,
  margin: 0,
});

const ContentContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '588px',
  width: '100%',
  paddingTop: '64px', // Priestor pre navbar
  zIndex: 2,
  position: 'relative',
});

const BlurredEllipse = styled('div')(({ top, left, width, height, color }) => ({
  position: 'absolute',
  top,
  left,
  width,
  height,
  borderRadius: '50%',
  background: color,
  filter: 'blur(82px)',
  zIndex: 1,
}));

const HeroTitle = styled(Typography)({
  color: '#1DB954',
  fontFamily: 'Montserrat',
  fontSize: '144px',
  fontStyle: 'italic',
  fontWeight: 900,
  lineHeight: 'normal',
  textTransform: 'uppercase',
  zIndex: 2,
  textAlign: 'center',
});

const NavbarContainer = styled(Box)({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    zIndex: 10,
  });

const HeroLayout = ({ children, title, subtitle }) => {
  return (
    <>
      {/* Navbar s fixed pozíciou */}
      <NavbarContainer>
        <Navbar transparent={true} />
      </NavbarContainer>
      
      {/* Hero container */}
      <HeroContainer>
        {/* Blurred elipsy */}
        <BlurredEllipse 
          top="-50px" 
          left="10%" 
          width="166px" 
          height="164px" 
          color="rgba(59, 92, 255, 0.50)" 
        />
        <BlurredEllipse 
          top="60%" 
          left="70%" 
          width="227px" 
          height="225px" 
          color="rgba(255, 59, 235, 0.20)" 
        />
        <BlurredEllipse 
          top="40%" 
          left="-50px" 
          width="167px" 
          height="164px" 
          color="rgba(255, 59, 235, 0.50)" 
        />
        
        {/* Content container */}
        <ContentContainer>
          <HeroTitle>{title}</HeroTitle>
          {subtitle && (
            <Typography 
              variant="subtitle1" 
              sx={{ 
                color: 'white',
                zIndex: 2,
                fontSize: '18px',
                mt: 2
              }}
            >
              {subtitle}
            </Typography>
          )}
        </ContentContainer>
      </HeroContainer>
      
      {/* Hlavný obsah stránky */}
      {children}
    </>
  );
};

export default HeroLayout;
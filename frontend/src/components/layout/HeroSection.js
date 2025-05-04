// frontend/src/components/layout/HeroSection.js
import React from 'react';
import { Box, Typography, styled, Container } from '@mui/material';

// Styled komponenty
const HeroContainer = styled(Box)({
  width: '100%',
  backgroundColor: '#201F1F',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '588px',
  padding: 0,
  margin: 0,
  marginTop: '-64px', // Posunúť hero sekciu nahor, aby bola pod navbarom
  paddingTop: '64px',  // Kompenzovať posunutie pre obsah
});

const ContentContainer = styled(Container)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start', // Zarovnanie obsahu vľavo
    position: 'relative',
    minHeight: '524px', // 588px - 64px (paddingTop)
    zIndex: 2,
  }));

const SeasonTypeText = styled(Typography)({
    color: '#FFF',
    fontFamily: 'Montserrat',
    fontSize: '24px',
    fontStyle: 'italic',
    fontWeight: 900,
    lineHeight: 'normal',
    letterSpacing: '24px',
    textTransform: 'uppercase',
    position: 'absolute',
    top: '47%',
    left: '55%',
    transform: 'translate(-50%, -50%)',
    zIndex: 3,
    textAlign: 'left', // Zarovnanie textu vľavo
    width: '100%',
  });

const HeroTitle = styled(Typography)(({ length }) => ({
    color: '#1DB954',
    fontFamily: 'Montserrat',
    fontSize: length > 10 ? `${Math.max(80, 144 - (length - 10) * 8)}px` : '144px', // Zmenšenie fontu ak je text dlhý
    fontStyle: 'italic',
    fontWeight: 900,
    lineHeight: 'normal',
    textTransform: 'uppercase',
    zIndex: 2,
    textAlign: 'left', // Zarovnanie textu vľavo
    maxWidth: '100%',
  }));

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

const HeroSection = ({ title, subtitle, seasonType }) => {
  // Určíme text pre typ sezóny
  const typeText = seasonType === 'official' ? 'Official Season' : 'Community Season';
  
  // Vypočítame dĺžku titulku pre prípadné zmenšenie fontu
  const titleLength = title ? title.length : 0;
  

  //R   zdelíme subtitle na štylizované časti (napr. "HRÁČI: 34/100 | ID: #A12B3C")
  let playersPart = "";
  let idPart = "";
  
  if (subtitle) {
    const parts = subtitle.split('|');
    if (parts.length >= 2) {
      playersPart = parts[0].trim();
      idPart = parts[1].trim();
    } else {
      playersPart = subtitle;
    }
  }

  return (
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
      <ContentContainer maxWidth="xl">
        {/* Text typu sezóny */}
        <SeasonTypeText>
          {typeText}
        </SeasonTypeText>
        
        {/* Názov sezóny */}
        <HeroTitle length={titleLength}>
          {title}
        </HeroTitle>
        
        {/* Detaily hráčov a ID - nový štylizovaný formát */}
        {subtitle && (
          <Box sx={{ mt: 2, display: 'flex', gap: 4 }}>
            {playersPart && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography 
                  component="span" 
                  sx={{ 
                    color: '#FFF',
                    fontFamily: 'Montserrat',
                    fontSize: '24px',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    lineHeight: 'normal',
                    textTransform: 'uppercase',
                    mr: 1
                  }}
                >
                  {playersPart.split(':')[0]}:
                </Typography>
                <Typography 
                  component="span" 
                  sx={{ 
                    color: '#ACACB5',
                    fontFamily: 'Montserrat',
                    fontSize: '24px',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    lineHeight: 'normal',
                    textTransform: 'uppercase'
                  }}
                >
                  {playersPart.split(':')[1]}
                </Typography>
              </Box>
            )}
            
            {idPart && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography 
                  component="span" 
                  sx={{ 
                    color: '#FFF',
                    fontFamily: 'Montserrat',
                    fontSize: '24px',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    lineHeight: 'normal',
                    textTransform: 'uppercase',
                    mr: 1
                  }}
                >
                  {idPart.split(':')[0]}:
                </Typography>
                <Typography 
                  component="span" 
                  sx={{ 
                    color: '#ACACB5',
                    fontFamily: 'Montserrat',
                    fontSize: '24px',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    lineHeight: 'normal',
                    textTransform: 'uppercase'
                  }}
                >
                  {idPart.split(':')[1]}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </ContentContainer>
    </HeroContainer>
  );
};

export default HeroSection;
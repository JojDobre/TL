// frontend/src/components/home/HomeHero.js
import React from 'react';
import { Box, Typography, Container, Grid, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { keyframes } from '@mui/material';
import { KeyboardArrowDown } from '@mui/icons-material';
import salahImg from '../../images/hero/salah.png'; // uprav cestu podľa umiestnenia súboru
import viniImg from '../../images/hero/vini.png'; // uprav cestu podľa umiestnenia súboru
import martinezImg from '../../images/hero/martinez.png'; // uprav cestu podľa umiestnenia súboru





// Animácia pre button
const pulseAnimation = keyframes`
  0% {
    transform: translateY(0);
    opacity: 0.8;
  }
  50% {
    transform: translateY(10px);
    opacity: 1;
  }
  100% {
    transform: translateY(0);
    opacity: 0.8;
  }
`;

// Styled komponenty pre scroll button
const ScrollButton = styled(Box)({
  position: 'absolute',
  bottom: '40px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  zIndex: 10,
  animation: `${pulseAnimation} 2s infinite ease-in-out`,
});

const ScrollText = styled(Typography)({
  color: '#FFF',
  fontFamily: 'Montserrat',
  fontSize: '12px',
  fontStyle: 'italic',
  fontWeight: 700,
  lineHeight: 'normal',
  textTransform: 'uppercase',
  marginBottom: '8px',
  opacity: 0.7,
});

// Funkcia pre scroll
const scrollToNextSection = () => {
  const heroHeight = window.innerHeight;
  window.scrollTo({
    top: heroHeight,
    behavior: 'smooth'
  });
};






// Styled komponenty
const HeroContainer = styled(Box)({
  minHeight: '100vh',
  width: '100%',
  backgroundColor: '#201F1F',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  marginTop: '-64px', // Posunúť hero sekciu nahor, aby bola pod navbarom
  paddingTop: '64px',  // Kompenzovať posunutie pre obsah
  justifyContent: 'center', // Centrujeme obsah vertikálne
});

const ContentContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  position: 'relative',
  zIndex: 2,
  paddingTop: 0,
  height: '100%',
  flexGrow: 1,
  // Využijem rovnaký maxWidth a padding ako má Container v navbare
  padding: theme.spacing(0, 2), // Zabezpečí konzistentný padding na mobilných zariadeniach
  [theme.breakpoints.up('xl')]: {
    maxWidth: theme.breakpoints.values.xl,
  },
}));

const WelcomeText = styled(Typography)({
  color: '#FFF',
  fontFamily: 'Montserrat',
  fontSize: '24px',
  fontStyle: 'italic',
  fontWeight: 900,
  lineHeight: 'normal',
  letterSpacing: '24px',
  textTransform: 'uppercase',
  marginBottom: '-20px',
  
});

const SeasonBannerContainer = styled(Box)(({ theme }) => ({
  justifyContent: 'justify-start',
  alignItems: 'center',
}));

const TiperligaText = styled(Typography)({
  color: '#1DB954',
  fontFamily: 'Montserrat',
  fontSize: '144px',
  fontStyle: 'italic',
  fontWeight: 900,
  lineHeight: 'normal',
  textTransform: 'uppercase',
  '& span': {
    color: '#FFF',
  },
  marginBottom: '-20px',
});

const DescriptionText = styled(Typography)({
  color: '#ACACB5',
  fontFamily: 'Noto Sans',
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: 400,
  lineHeight: 'normal',
  maxWidth: '600px',
  marginBottom: '80px',
});

const SeasonsHeading = styled(Typography)({
  color: '#FFF',
  fontFamily: 'Montserrat',
  fontSize: '24px',
  fontStyle: 'italic',
  fontWeight: 900,
  lineHeight: 'normal',
  textTransform: 'uppercase',
  marginBottom: '40px',
  zIndex: 1,
});

const SeasonBanner = styled(Box)(({ bgcolor }) => ({
  width: '467px',
  height: '227.538px',
  borderRadius: '8px',
  backgroundColor: bgcolor || '#0095FF',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  paddingBottom: '50px',
  paddingTop: '30px',
  paddingLeft: '40px',
  zIndex: 1,
}));

const SeasonTitle = styled(Typography)({
  color: '#FFF',
  fontFamily: 'Montserrat',
  fontSize: '16px',
  fontStyle: 'normal',
  fontWeight: 800,
  lineHeight: 'normal',
  textTransform: 'uppercase',
  zIndex: 1,
});

const BannerButton = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  zIndex: 10,
  position: 'relative',
  textDecoration: 'none',
});

const BannerButtonText = styled(Typography)({
  color: '#FFF',
  fontFamily: 'Noto Sans',
  fontSize: '12px',
  fontStyle: 'italic',
  fontWeight: 800,
  lineHeight: 'normal',
  textTransform: 'uppercase',
  opacity: 0.6,
  marginLeft: '10px',
});

const ViewAllLink = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  width: '100%',
  marginTop: '20px',
  cursor: 'pointer',
  textDecoration: 'none',
});

const ViewAllText = styled(Typography)({
  color: '#FFF',
  fontFamily: 'Noto Sans',
  fontSize: '14px',
  fontStyle: 'italic',
  fontWeight: 700,
  lineHeight: 'normal',
  textTransform: 'uppercase',
  marginRight: '10px',
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


const PlayerImageContainer = styled(Box)({
  position: 'absolute',
  right: '0',
  bottom: '0',
  zIndex: 5,
  overflow: 'visible', // Tento kontajner dovoľuje presah
  height: '100%',
  pointerEvents: 'none', // Zabezpečí, že interakcie prejdú cez obrázok
});

const PlayerImage = styled('img')({
  position: 'absolute',
  right: '0',
  bottom: '0',
  maxHeight: '250px', // Vyššia ako banner, aby presahovala
  zIndex: 5,
  pointerEvents: 'none', // Aby obrázok nerušil klikanie na tlačidlá
});

// SVG Komponenty
const BannerSvgLeft = () => (
  <Box
    component="svg"
    xmlns="http://www.w3.org/2000/svg"
    width= '285px'
    height= '355px'
    viewBox="0 0 212 228"
    fill="none"
    sx={{
      position: 'absolute',
      bottom: '-90px',
      left: '-50px',
      transform: 'rotate(15deg)',
      zIndex: 1,
    }}
  >
    <path
      opacity="0.1"
      d="M188.957 76.2444C179.805 80.3764 172.524 82.0951 172.524 82.0951L167.393 101.591C171.196 108.862 175.194 115.114 176.797 124.982C187.852 113.809 191.601 94.0328 188.957 76.2444L188.957 76.2444ZM165.774 138.353C165.774 138.353 166.393 129.911 161.878 120.667L146.901 117.032C146.901 117.032 122.341 128.452 109.999 125.568C109.999 125.568 113.466 139.59 115.169 146.888C122.279 147.253 135.51 145.256 141.733 141.124C141.733 141.124 142.231 151.874 138.505 163.41C146.213 161.428 158.189 153.643 165.774 138.353L165.774 138.353ZM156.019 98.0454L161.19 78.6357C161.19 78.6357 153.039 73.4765 145.473 63.7623C125.659 61.4585 97.5697 73.957 97.5697 73.957C97.5697 73.957 101.503 90.4603 105.868 108.302C120.319 114.364 147.365 101.828 156.02 98.0457L156.019 98.0454ZM185.21 192.461L176.49 175.944C163.408 210.767 137.294 236.315 98.6001 248.645L98.721 228.003C65.4058 240.219 13.8732 240.123 -21.3469 206.281C-9.37886 182.154 2.10126 157.533 0.61506 123.971C-31.5155 152.361 -55.3884 160.462 -55.3884 160.462C-64.0725 131.027 -49.0886 80.6605 -40.4729 66.961L-68.2831 67.8304C-63.7148 50.7812 -41.4258 17.987 -17.729 2.55961L-33.1256 -4.25401L-33.1415 -4.25828C-16.3962 -23.0736 4.92511 -37.4461 28.6415 -46.1781L28.6736 -46.1865C20.2167 -38.5759 14.0363 -15.8575 29.262 -2.50523C25.2228 -17.2245 28.5395 -33.1896 38.5029 -39.2488C48.4851 -45.3784 60.8192 -39.0531 67.4724 -30.4444C66.8876 -38.2124 61.9918 -49.0989 51.2344 -52.6306L51.2185 -52.6349C74.6141 -57.4509 99.5893 -56.9959 124.365 -50.3573C128.993 -49.1172 133.554 -47.6837 137.961 -46.08C144.408 -41.332 152.33 -28.6078 155.612 -21.1288C155.612 -21.1288 157.904 -28.2924 156.116 -38.1648C181.238 -24.6072 191.188 -10.5393 195.179 -3.97268C193.251 7.62225 194.906 15.3298 196.614 27.295C190.462 15.4831 172.723 -5.67069 163.277 -12.1283C163.277 -12.1283 159.799 -2.5642 154.952 1.18082C138.094 -18.9817 128.883 -25.3915 128.883 -25.3915C105.236 -28.3147 88.2744 -23.6775 78.5005 -19.0776L83.8987 -11.4546C69.0562 -11.0218 57.0517 -1.91532 57.0517 -1.91532C57.0961 -1.6766 68.8212 3.27709 68.8212 3.27709C68.8212 3.27709 63.8434 16.8791 79.408 30.4128C92.7487 42.0065 117.293 38.631 135.887 52.312C126.349 33.2953 118.744 23.9027 118.744 23.9027C118.744 23.9027 113.614 21.3504 109.789 20.3554C105.008 19.1044 97.647 18.1139 90.6442 13.0661C87.294 10.6432 83.6126 6.96865 80.7581 3.9687C80.7581 3.9687 92.9183 -3.05742 107.499 -1.41571C107.499 -1.41571 119.211 5.4376 127.287 15.3336C135.631 10.8038 142.521 12.8613 142.521 12.8613C142.521 12.8613 133.96 17.2726 134.012 25.4113C141.68 36.7688 149.197 52.1029 149.197 52.1029C161.825 49.174 185.486 56.9637 188.923 63.8649C184.793 54.2862 177.549 45.2775 172.088 37.7735C172.028 34.5859 167.184 22.2334 166.153 20.9303C166.153 20.9303 172.803 25.0379 177.755 32.4204C180.297 30.3379 184.47 28.6472 189.509 28.7591C193.304 34.0347 192.537 40.3683 192.135 41.3479C189.268 43.313 186.819 43.7744 186.819 43.7744L195.223 59.2706L198.769 50.7217C215.696 95.5038 218.761 142.899 185.206 192.458L185.21 192.461ZM35.7537 -102.294C49.4548 -91.1776 57.1005 -79.7356 58.5642 -77.9087C58.7894 -82.0467 60.7747 -101.721 62.1476 -113.903C69.5737 -105.344 86.8044 -85.4739 92.4939 -78.9959C97.5832 -86.7085 114.772 -111.748 114.772 -111.748C114.772 -111.748 124.978 -79.1416 126.789 -73.8087C131.485 -76.5826 158.736 -93.8212 165.755 -98.1474C163.136 -84.7288 159.332 -65.5569 158.891 -62.6395C160.321 -63.7515 171.366 -72.6319 187.644 -79.1739C178.751 -69.4751 171.777 -54.6713 167.185 -42.5065C154.82 -49.7008 141.268 -55.416 126.776 -59.2991C98.9345 -66.7593 70.8748 -66.6363 44.9125 -60.1673C44.0405 -73.3433 41.629 -90.088 35.7537 -102.294Z"
      fill="black"
    />
  </Box>
);

const BannerSvgRight = () => (
  <Box
    component="svg"
    xmlns="http://www.w3.org/2000/svg"
    width="223"
    height="261"
    viewBox="0 0 212 228"
    fill="none"
    sx={{
      position: 'absolute',
      bottom: '-40px',
      right: '-30px',
      zIndex: 1,
    }}
  >
    <path
      opacity="0.1"
      d="M188.957 76.2444C179.805 80.3764 172.524 82.0951 172.524 82.0951L167.393 101.591C171.196 108.862 175.194 115.114 176.797 124.982C187.852 113.809 191.601 94.0328 188.957 76.2444L188.957 76.2444ZM165.774 138.353C165.774 138.353 166.393 129.911 161.878 120.667L146.901 117.032C146.901 117.032 122.341 128.452 109.999 125.568C109.999 125.568 113.466 139.59 115.169 146.888C122.279 147.253 135.51 145.256 141.733 141.124C141.733 141.124 142.231 151.874 138.505 163.41C146.213 161.428 158.189 153.643 165.774 138.353L165.774 138.353ZM156.019 98.0454L161.19 78.6357C161.19 78.6357 153.039 73.4765 145.473 63.7623C125.659 61.4585 97.5697 73.957 97.5697 73.957C97.5697 73.957 101.503 90.4603 105.868 108.302C120.319 114.364 147.365 101.828 156.02 98.0457L156.019 98.0454ZM185.21 192.461L176.49 175.944C163.408 210.767 137.294 236.315 98.6001 248.645L98.721 228.003C65.4058 240.219 13.8732 240.123 -21.3469 206.281C-9.37886 182.154 2.10126 157.533 0.61506 123.971C-31.5155 152.361 -55.3884 160.462 -55.3884 160.462C-64.0725 131.027 -49.0886 80.6605 -40.4729 66.961L-68.2831 67.8304C-63.7148 50.7812 -41.4258 17.987 -17.729 2.55961L-33.1256 -4.25401L-33.1415 -4.25828C-16.3962 -23.0736 4.92511 -37.4461 28.6415 -46.1781L28.6736 -46.1865C20.2167 -38.5759 14.0363 -15.8575 29.262 -2.50523C25.2228 -17.2245 28.5395 -33.1896 38.5029 -39.2488C48.4851 -45.3784 60.8192 -39.0531 67.4724 -30.4444C66.8876 -38.2124 61.9918 -49.0989 51.2344 -52.6306L51.2185 -52.6349C74.6141 -57.4509 99.5893 -56.9959 124.365 -50.3573C128.993 -49.1172 133.554 -47.6837 137.961 -46.08C144.408 -41.332 152.33 -28.6078 155.612 -21.1288C155.612 -21.1288 157.904 -28.2924 156.116 -38.1648C181.238 -24.6072 191.188 -10.5393 195.179 -3.97268C193.251 7.62225 194.906 15.3298 196.614 27.295C190.462 15.4831 172.723 -5.67069 163.277 -12.1283C163.277 -12.1283 159.799 -2.5642 154.952 1.18082C138.094 -18.9817 128.883 -25.3915 128.883 -25.3915C105.236 -28.3147 88.2744 -23.6775 78.5005 -19.0776L83.8987 -11.4546C69.0562 -11.0218 57.0517 -1.91532 57.0517 -1.91532C57.0961 -1.6766 68.8212 3.27709 68.8212 3.27709C68.8212 3.27709 63.8434 16.8791 79.408 30.4128C92.7487 42.0065 117.293 38.631 135.887 52.312C126.349 33.2953 118.744 23.9027 118.744 23.9027C118.744 23.9027 113.614 21.3504 109.789 20.3554C105.008 19.1044 97.647 18.1139 90.6442 13.0661C87.294 10.6432 83.6126 6.96865 80.7581 3.9687C80.7581 3.9687 92.9183 -3.05742 107.499 -1.41571C107.499 -1.41571 119.211 5.4376 127.287 15.3336C135.631 10.8038 142.521 12.8613 142.521 12.8613C142.521 12.8613 133.96 17.2726 134.012 25.4113C141.68 36.7688 149.197 52.1029 149.197 52.1029C161.825 49.174 185.486 56.9637 188.923 63.8649C184.793 54.2862 177.549 45.2775 172.088 37.7735C172.028 34.5859 167.184 22.2334 166.153 20.9303C166.153 20.9303 172.803 25.0379 177.755 32.4204C180.297 30.3379 184.47 28.6472 189.509 28.7591C193.304 34.0347 192.537 40.3683 192.135 41.3479C189.268 43.313 186.819 43.7744 186.819 43.7744L195.223 59.2706L198.769 50.7217C215.696 95.5038 218.761 142.899 185.206 192.458L185.21 192.461ZM35.7537 -102.294C49.4548 -91.1776 57.1005 -79.7356 58.5642 -77.9087C58.7894 -82.0467 60.7747 -101.721 62.1476 -113.903C69.5737 -105.344 86.8044 -85.4739 92.4939 -78.9959C97.5832 -86.7085 114.772 -111.748 114.772 -111.748C114.772 -111.748 124.978 -79.1416 126.789 -73.8087C131.485 -76.5826 158.736 -93.8212 165.755 -98.1474C163.136 -84.7288 159.332 -65.5569 158.891 -62.6395C160.321 -63.7515 171.366 -72.6319 187.644 -79.1739C178.751 -69.4751 171.777 -54.6713 167.185 -42.5065C154.82 -49.7008 141.268 -55.416 126.776 -59.2991C98.9345 -66.7593 70.8748 -66.6363 44.9125 -60.1673C44.0405 -73.3433 41.629 -90.088 35.7537 -102.294Z"
      fill="black"
    />
  </Box>
);

const ButtonIcon = () => (
  <Box sx={{ position: 'relative', width: 33, height: 33 }}>
    <Box
      component="svg"
      xmlns="http://www.w3.org/2000/svg"
      width="33"
      height="35"
      viewBox="0 0 33 35"
      fill="none"
      sx={{ position: 'absolute' }}
    >
      <mask id="path-1-inside-1_48_1183" fill="white">
        <path fillRule="evenodd" clipRule="evenodd" d="M5.27827 3.42067C5.50615 1.96003 6.7641 0.883118 8.24241 0.883118H10.1538H12.6046H24.6152C24.7658 0.883118 24.9124 0.899738 25.0534 0.931224C25.2279 0.89959 25.4074 0.883118 25.5902 0.883118H29.9524C31.7937 0.883118 33.2004 2.52635 32.9166 4.34557L28.6353 31.7871C28.4074 33.2478 27.1494 34.3247 25.6711 34.3247H23.7597H21.3089H9.29834C9.14773 34.3247 9.00112 34.3081 8.86017 34.2766C8.68561 34.3082 8.50614 34.3247 8.32331 34.3247H3.96111C2.11989 34.3247 0.713142 32.6814 0.996967 30.8622L5.27827 3.42067Z"/>
      </mask>
      <path d="M5.27827 3.42067L4.29022 3.26652L5.27827 3.42067ZM25.0534 0.931224L24.8354 1.90717L25.0327 1.95126L25.2317 1.9152L25.0534 0.931224ZM32.9166 4.34557L31.9285 4.19142V4.19142L32.9166 4.34557ZM28.6353 31.7871L27.6472 31.633L28.6353 31.7871ZM8.86017 34.2766L9.07818 33.3006L8.88082 33.2565L8.68184 33.2926L8.86017 34.2766ZM0.996967 30.8622L0.00891984 30.7081L0.996967 30.8622ZM8.24241 -0.116882C6.27133 -0.116882 4.59406 1.31901 4.29022 3.26652L6.26631 3.57482C6.41824 2.60106 7.25687 1.88312 8.24241 1.88312V-0.116882ZM10.1538 -0.116882H8.24241V1.88312H10.1538V-0.116882ZM10.1538 1.88312H12.6046V-0.116882H10.1538V1.88312ZM12.6046 1.88312H24.6152V-0.116882H12.6046V1.88312ZM24.6152 1.88312C24.692 1.88312 24.7655 1.89157 24.8354 1.90717L25.2714 -0.0447212C25.0593 -0.0920947 24.8396 -0.116882 24.6152 -0.116882V1.88312ZM25.5902 -0.116882C25.3472 -0.116882 25.1081 -0.0949805 24.8751 -0.0527493L25.2317 1.9152C25.3478 1.89416 25.4676 1.88312 25.5902 1.88312V-0.116882ZM29.9524 -0.116882H25.5902V1.88312H29.9524V-0.116882ZM33.9046 4.49972C34.2831 2.0741 32.4074 -0.116882 29.9524 -0.116882V1.88312C31.1799 1.88312 32.1177 2.97861 31.9285 4.19142L33.9046 4.49972ZM29.6233 31.9413L33.9046 4.49972L31.9285 4.19142L27.6472 31.633L29.6233 31.9413ZM25.6711 35.3247C27.6422 35.3247 29.3195 33.8888 29.6233 31.9413L27.6472 31.633C27.4953 32.6067 26.6567 33.3247 25.6711 33.3247V35.3247ZM23.7597 35.3247H25.6711V33.3247H23.7597V35.3247ZM23.7597 33.3247H21.3089V35.3247H23.7597V33.3247ZM21.3089 33.3247H9.29834V35.3247H21.3089V33.3247ZM9.29834 33.3247C9.22153 33.3247 9.14802 33.3162 9.07818 33.3006L8.64215 35.2525C8.85422 35.2999 9.07393 35.3247 9.29834 35.3247V33.3247ZM8.32331 35.3247C8.5663 35.3247 8.80544 35.3028 9.03849 35.2605L8.68184 33.2926C8.56577 33.3136 8.44598 33.3247 8.32331 33.3247V35.3247ZM3.96111 35.3247H8.32331V33.3247H3.96111V33.3247ZM0.00891984 30.7081C-0.369514 33.1337 1.50615 35.3247 3.96111 35.3247V33.3247C2.73363 33.3247 1.7958 32.2292 1.98501 31.0164L0.00891984 30.7081ZM4.29022 3.26652L0.00891984 30.7081L1.98501 31.0164L6.26631 3.57482L4.29022 3.26652Z" fill="white" fillOpacity="0.3" mask="url(#path-1-inside-1_48_1183)"/>
    </Box>
    <Box
      component="svg"
      xmlns="http://www.w3.org/2000/svg"
      width="9"
      height="11"
      viewBox="0 0 9 11"
      fill="none"
      sx={{ position: 'absolute', top: '11px', left: '13px' }}
    >
      <path d="M6.53194 6.15363L3.2053 8.81022C2.97537 8.99384 2.64108 8.97441 2.45975 8.76689L2.0185 8.26765C1.83497 8.06 1.87249 7.74366 2.10217 7.56212L4.46017 5.67907L2.57803 3.54958C2.3945 3.34193 2.43201 3.02559 2.6617 2.84405L3.2128 2.3983C3.44273 2.21468 3.77702 2.23411 3.95835 2.44163L6.61366 5.44589C6.79939 5.65367 6.76187 5.97001 6.53194 6.15363Z" fill="#1DB954"/>
    </Box>
  </Box>
);

const ViewButton = ({ to }) => (
  <BannerButton to={to}>
    <Box sx={{ position: 'relative', width: '34px', height: '34px' }}>
      {/* Pozadie tlačidla - obrys */}
      <svg xmlns="http://www.w3.org/2000/svg" width="33" height="35" viewBox="0 0 33 35" fill="none" style={{ position: 'absolute' }}>
        <mask id="path-1-inside-1_48_1183" fill="white">
          <path fillRule="evenodd" clipRule="evenodd" d="M5.27827 3.42067C5.50615 1.96003 6.7641 0.883118 8.24241 0.883118H10.1538H12.6046H24.6152C24.7658 0.883118 24.9124 0.899738 25.0534 0.931224C25.2279 0.89959 25.4074 0.883118 25.5902 0.883118H29.9524C31.7937 0.883118 33.2004 2.52635 32.9166 4.34557L28.6353 31.7871C28.4074 33.2478 27.1494 34.3247 25.6711 34.3247H23.7597H21.3089H9.29834C9.14773 34.3247 9.00112 34.3081 8.86017 34.2766C8.68561 34.3082 8.50614 34.3247 8.32331 34.3247H3.96111C2.11989 34.3247 0.713142 32.6814 0.996967 30.8622L5.27827 3.42067Z"/>
        </mask>
        <path d="M5.27827 3.42067L4.29022 3.26652L5.27827 3.42067ZM25.0534 0.931224L24.8354 1.90717L25.0327 1.95126L25.2317 1.9152L25.0534 0.931224ZM32.9166 4.34557L31.9285 4.19142V4.19142L32.9166 4.34557ZM28.6353 31.7871L27.6472 31.633L28.6353 31.7871ZM8.86017 34.2766L9.07818 33.3006L8.88082 33.2565L8.68184 33.2926L8.86017 34.2766ZM0.996967 30.8622L0.00891984 30.7081L0.996967 30.8622ZM8.24241 -0.116882C6.27133 -0.116882 4.59406 1.31901 4.29022 3.26652L6.26631 3.57482C6.41824 2.60106 7.25687 1.88312 8.24241 1.88312V-0.116882ZM10.1538 -0.116882H8.24241V1.88312H10.1538V-0.116882ZM10.1538 1.88312H12.6046V-0.116882H10.1538V1.88312ZM12.6046 1.88312H24.6152V-0.116882H12.6046V1.88312ZM24.6152 1.88312C24.692 1.88312 24.7655 1.89157 24.8354 1.90717L25.2714 -0.0447212C25.0593 -0.0920947 24.8396 -0.116882 24.6152 -0.116882V1.88312ZM25.5902 -0.116882C25.3472 -0.116882 25.1081 -0.0949805 24.8751 -0.0527493L25.2317 1.9152C25.3478 1.89416 25.4676 1.88312 25.5902 1.88312V-0.116882ZM29.9524 -0.116882H25.5902V1.88312H29.9524V-0.116882ZM33.9046 4.49972C34.2831 2.0741 32.4074 -0.116882 29.9524 -0.116882V1.88312C31.1799 1.88312 32.1177 2.97861 31.9285 4.19142L33.9046 4.49972ZM29.6233 31.9413L33.9046 4.49972L31.9285 4.19142L27.6472 31.633L29.6233 31.9413ZM25.6711 35.3247C27.6422 35.3247 29.3195 33.8888 29.6233 31.9413L27.6472 31.633C27.4953 32.6067 26.6567 33.3247 25.6711 33.3247V35.3247ZM23.7597 35.3247H25.6711V33.3247H23.7597V35.3247ZM23.7597 33.3247H21.3089V35.3247H23.7597V33.3247ZM21.3089 33.3247H9.29834V35.3247H21.3089V33.3247ZM9.29834 33.3247C9.22153 33.3247 9.14802 33.3162 9.07818 33.3006L8.64215 35.2525C8.85422 35.2999 9.07393 35.3247 9.29834 35.3247V33.3247ZM8.32331 35.3247C8.5663 35.3247 8.80544 35.3028 9.03849 35.2605L8.68184 33.2926C8.56577 33.3136 8.44598 33.3247 8.32331 33.3247V35.3247ZM3.96111 35.3247H8.32331V33.3247H3.96111V33.3247ZM0.00891984 30.7081C-0.369514 33.1337 1.50615 35.3247 3.96111 35.3247V33.3247C2.73363 33.3247 1.7958 32.2292 1.98501 31.0164L0.00891984 30.7081ZM4.29022 3.26652L0.00891984 30.7081L1.98501 31.0164L6.26631 3.57482L4.29022 3.26652Z" fill="white" fillOpacity="0.3" mask="url(#path-1-inside-1_48_1183)"/>
      </svg>
      
      {/* Šípka vo vnútri tlačidla */}
      <svg xmlns="http://www.w3.org/2000/svg" width="9" height="11" viewBox="0 0 9 11" fill="none" style={{ position: 'absolute', top: '11px', left: '13px' }}>
        <path d="M6.53194 6.15363L3.2053 8.81022C2.97537 8.99384 2.64108 8.97441 2.45975 8.76689L2.0185 8.26765C1.83497 8.06 1.87249 7.74366 2.10217 7.56212L4.46017 5.67907L2.57803 3.54958C2.3945 3.34193 2.43201 3.02559 2.6617 2.84405L3.2128 2.3983C3.44273 2.21468 3.77702 2.23411 3.95835 2.44163L6.61366 5.44589C6.79939 5.65367 6.76187 5.97001 6.53194 6.15363Z" fill="#1DB954"/>
      </svg>
    </Box>
    <BannerButtonText>
      ZOBRAZIŤ SEZÓNU
    </BannerButtonText>
  </BannerButton>
);

const ViewAllButton = ({ to }) => (
    <ViewAllLink to={to}>
    <ViewAllText>
      ZOBRAZIŤ VŠETKY SEZÓNY
    </ViewAllText>
    <Box sx={{ position: 'relative', width: '20px', height: '20px' }}>
      {/* Kruh */}
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ position: 'absolute' }}>
        <circle cx="10" cy="10" r="10" fill="#46456F"/>
      </svg>
      
      {/* Šípka vo vnútri kruhu */}
      <svg xmlns="http://www.w3.org/2000/svg" width="6" height="12" viewBox="0 0 6 12" fill="none" style={{ position: 'absolute', top: '4px', left: '8px' }}>
        <path d="M5.25703 6.39802L2.06953 9.58552C1.84922 9.80583 1.49297 9.80583 1.275 9.58552L0.745313 9.05583C0.525 8.83552 0.525 8.47927 0.745313 8.2613L3.00469 6.00193L0.745313 3.74255C0.525 3.52224 0.525 3.16599 0.745313 2.94802L1.27266 2.41365C1.49297 2.19333 1.84922 2.19333 2.06719 2.41365L5.25469 5.60115C5.47734 5.82146 5.47734 6.17771 5.25703 6.39802Z" fill="#9797B2"/>
      </svg>
    </Box>
  </ViewAllLink>
);

const ViewAllIcon = () => (
  <Box sx={{ position: 'relative', width: 20, height: 20 }}>
    <Box
      component="svg"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      sx={{ position: 'absolute' }}
    >
      <circle cx="10" cy="10" r="10" fill="#46456F"/>
    </Box>
    <Box
      component="svg"
      xmlns="http://www.w3.org/2000/svg"
      width="6"
      height="12"
      viewBox="0 0 6 12"
      fill="none"
      sx={{ position: 'absolute', top: '4px', left: '8px' }}
    >
      <path d="M5.25703 6.39802L2.06953 9.58552C1.84922 9.80583 1.49297 9.80583 1.275 9.58552L0.745313 9.05583C0.525 8.83552 0.525 8.47927 0.745313 8.2613L3.00469 6.00193L0.745313 3.74255C0.525 3.52224 0.525 3.16599 0.745313 2.94802L1.27266 2.41365C1.49297 2.19333 1.84922 2.19333 2.06719 2.41365L5.25469 5.60115C5.47734 5.82146 5.47734 6.17771 5.25703 6.39802Z" fill="#9797B2"/>
    </Box>
  </Box>
);

// Hlavný komponent
const HomeHero = () => {

    // State pre zobrazenie tlačidla na základe scrollu
    const [showButton, setShowButton] = useState(true);

    // Efekt pre sledovanie scrollu
    useEffect(() => {
      const handleScroll = () => {
        // Skryjeme tlačidlo, ak používateľ odscrolloval aspoň 300px
        setShowButton(window.scrollY < 300);
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);



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
      
      <ContentContainer>
        {/* Hero text content */}
        <WelcomeText>Welcome to</WelcomeText>
        <TiperligaText>
          TIPER<span>LIGA</span>
        </TiperligaText>
        <DescriptionText>
          Všetkým chcem ponúknuť tipovaciu ligu, kde vy sami riadite svoju súťaž. Môžete si vytvárať vlastné tímy, súťaže, či zápasy. Alebo sa môžete zapojiť do existujúcich sezón, ktoré vytvorili iní používatelia.
        </DescriptionText>
        
        {/* Current seasons section */}
        <SeasonsHeading>
          Aktuálne prebiehajúce sezóny
        </SeasonsHeading>


        <SeasonBannerContainer>
        <Grid container spacing={4}>
          {/* Banner 1 */}
          <Grid item xs={12} md={4}>
          <Box sx={{ position: 'relative' }}>
            <SeasonBanner bgcolor="#0095FF">
              <BannerSvgLeft />
              <ViewButton to="/seasons/2" />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <SeasonTitle>
                  Talianský Futbal 2025/26
                </SeasonTitle>
              </Box>
            </SeasonBanner>

            <Box
              component="img"
              src={martinezImg}
              alt="Salah"
              sx={{
                position: 'absolute',
                right: '0',
                bottom: '0',
                maxHeight: '260px', // Vyššia ako banner
                zIndex: 15,
                pointerEvents: 'none',
                transform: 'translateY(0)', // Upravte podľa potreby, aby presahoval
              }}
            />
          </Box>

          </Grid>

          
          {/* Banner 2 */}
          <Grid item xs={12} md={4}>
          <Box sx={{ position: 'relative' }}>
            <SeasonBanner bgcolor="#242426">
              <BannerSvgLeft />
              <ViewButton to="/seasons/1" />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <SeasonTitle>
                  Európske súťaže 2025/26
                </SeasonTitle>
              </Box>
            </SeasonBanner>

            <Box
              component="img"
              src={viniImg}
              alt="Salah"
              sx={{
                position: 'absolute',
                right: '0',
                bottom: '0',
                maxHeight: '260px', // Vyššia ako banner
                zIndex: 15,
                pointerEvents: 'none',
                transform: 'translateY(0)', // Upravte podľa potreby, aby presahoval
              }}
            />
          </Box>
          </Grid>
          
          {/* Banner 3 */}
          <Grid item xs={12} md={4}>
          <Box sx={{ position: 'relative' }}>
            <SeasonBanner bgcolor="#FF4800">
              <BannerSvgLeft />
              <ViewButton to="/seasons/23" />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <SeasonTitle>
                  PREMIER LEAGUE
                </SeasonTitle>
              </Box>
            </SeasonBanner>
            <Box
              component="img"
              src={salahImg}
              alt="Salah"
              sx={{
                position: 'absolute',
                right: '0',
                bottom: '0',
                maxHeight: '260px', // Vyššia ako banner
                zIndex: 15,
                pointerEvents: 'none',
                transform: 'translateY(0)', // Upravte podľa potreby, aby presahoval
              }}
            />
          </Box>

          </Grid>
        </Grid>
        
        
        {/* View all link */}
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <ViewAllButton to="/seasons/1" />
        </Box>

        </SeasonBannerContainer>

      </ContentContainer>


      {showButton && (
        <ScrollButton onClick={scrollToNextSection}>
          <ScrollText>Zistiť viac</ScrollText>
          <Box sx={{ 
            bgcolor: 'rgba(29, 185, 84, 0.3)', 
            borderRadius: '50%', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center'
          }}>
            <KeyboardArrowDown sx={{ 
              color: '#1DB954', 
              fontSize: '28px',
            }} />
          </Box>
        </ScrollButton>
      )}


    </HeroContainer>
  );
};

export default HomeHero;
// frontend/src/components/home/Home.js
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Container
} from '@mui/material';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupIcon from '@mui/icons-material/Group';

const Home = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <Box>
      {/* Hero sekcia */}
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          pt: 8,
          pb: 6,
          borderRadius: 2,
          mb: 6,
          textAlign: 'center'
        }}
      >
        <Container maxWidth="md">
          <Typography
            component="h1"
            variant="h2"
            gutterBottom
          >
            Vitajte v Tiperlige!
          </Typography>
          <Typography variant="h5" paragraph>
            Vytvorte si vlastnú tipovaciu ligu, súťažte s priateľmi a sledujte skóre v reálnom čase.
          </Typography>
          <Box sx={{ mt: 4 }}>
            {isAuthenticated ? (
              <Button
                variant="contained"
                color="secondary"
                size="large"
                component={RouterLink}
                to="/seasons"
                sx={{ mx: 1 }}
              >
                Prehliadať sezóny
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  component={RouterLink}
                  to="/register"
                  sx={{ mx: 1 }}
                >
                  Registrovať sa
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  size="large"
                  component={RouterLink}
                  to="/login"
                  sx={{ mx: 1 }}
                >
                  Prihlásiť sa
                </Button>
              </>
            )}
          </Box>
        </Container>
      </Box>
      
      {/* Funkcie sekcia */}
      <Container maxWidth="lg">
        <Typography
          component="h2"
          variant="h3"
          align="center"
          gutterBottom
        >
          Ako to funguje
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <SportsSoccerIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" component="h3" gutterBottom>
                  Vytvorte ligu
                </Typography>
                <Typography>
                  Vytvorte si vlastnú tipovaciu ligu, pridajte priateľov a začnite tipovať výsledky zápasov.
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center' }}>
                <Button component={RouterLink} to="/seasons/create">
                  Vytvoriť ligu
                </Button>
              </CardActions>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <GroupIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" component="h3" gutterBottom>
                  Súťažte
                </Typography>
                <Typography>
                  Tipujte výsledky zápasov a získavajte body za správne tipy. Súťažte s priateľmi o najlepšie skóre.
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center' }}>
                <Button component={RouterLink} to="/seasons">
                  Prehliadať sezóny
                </Button>
              </CardActions>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <EmojiEventsIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" component="h3" gutterBottom>
                  Sledujte rebríčky
                </Typography>
                <Typography>
                  Sledujte svoje skóre v rebríčkoch, získavajte achievementy a staňte sa najlepším tipérom.
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center' }}>
                <Button component={RouterLink} to="/leaderboards">
                  Prehliadať rebríčky
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Home;
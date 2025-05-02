// frontend/src/components/season/SeasonsList.js
import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Container, Typography, Box, Grid, Card, CardContent, 
  CardActions, Button, TextField, InputAdornment, IconButton,
  Chip, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, CircularProgress, Tabs, Tab, Paper
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getAllSeasons, joinSeason } from '../../services/seasonService';

// TabPanel komponent pre zobrazenie obsahu tabu
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`seasons-tabpanel-${index}`}
      aria-labelledby={`seasons-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SeasonsList = () => {
  // State pre záložky
  const [tabValue, setTabValue] = useState(0);
  
  // State pre zoznam sezón
  const [officialSeasons, setOfficialSeasons] = useState([]);
  const [communitySeasons, setCommunitySeasons] = useState([]);
  const [filteredSeasons, setFilteredSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State pre vyhľadávanie
  const [searchTerm, setSearchTerm] = useState('');
  
  // State pre dialóg na pridanie k sezóne
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningLoading, setJoiningLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  
  // Hook pre autentifikáciu
  const { isAuthenticated } = useAuth();
  
  // Načítanie sezón pri načítaní komponenty
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Načítanie všetkých sezón
        const allSeasons = await getAllSeasons();
        
        // Rozdelenie sezón podľa typu
        const official = allSeasons.filter(season => season.type === 'official');
        const community = allSeasons.filter(season => season.type === 'community');
        
        setOfficialSeasons(official);
        setCommunitySeasons(community);
        setFilteredSeasons(tabValue === 0 ? official : community);
      } catch (err) {
        console.error('Chyba pri načítavaní sezón:', err);
        setError('Nepodarilo sa načítať sezóny. Skúste to znova neskôr.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSeasons();
  }, []);
  
  // Handler pre zmenu tabu
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setFilteredSeasons(newValue === 0 ? officialSeasons : communitySeasons);
    setSearchTerm('');
  };
  
  // Handler pre vyhľadávanie
  const handleSearch = (event) => {
    const term = event.target.value.toLowerCase();
    setSearchTerm(term);
    
    const seasons = tabValue === 0 ? officialSeasons : communitySeasons;
    
    if (term.trim() === '') {
      setFilteredSeasons(seasons);
    } else {
      setFilteredSeasons(
        seasons.filter(season => 
          season.name.toLowerCase().includes(term) ||
          (season.description && season.description.toLowerCase().includes(term))
        )
      );
    }
  };
  
  // Handler pre otvorenie dialógu na pridanie k sezóne
  const handleOpenJoinDialog = () => {
    setJoinDialogOpen(true);
    setInviteCode('');
    setJoinError('');
  };
  
  // Handler pre zatvorenie dialógu na pridanie k sezóne
  const handleCloseJoinDialog = () => {
    setJoinDialogOpen(false);
  };
  
  // Handler pre pripojenie k sezóne
  const handleJoinSeason = async () => {
    if (!inviteCode.trim()) {
      setJoinError('Prosím, zadajte kód pre pripojenie.');
      return;
    }
    
    try {
      setJoiningLoading(true);
      setJoinError('');
      
      const result = await joinSeason(inviteCode);
      
      // Zatvorenie dialógu po úspešnom pripojení
      handleCloseJoinDialog();
      
      // Opätovné načítanie sezón pre aktualizáciu zoznamu
      const allSeasons = await getAllSeasons();
      const official = allSeasons.filter(season => season.type === 'official');
      const community = allSeasons.filter(season => season.type === 'community');
      
      setOfficialSeasons(official);
      setCommunitySeasons(community);
      setFilteredSeasons(tabValue === 0 ? official : community);
      
      // Zobraziť oznámenie o úspešnom pripojení (môžete pridať snackbar)
    } catch (err) {
      console.error('Chyba pri pripájaní k sezóne:', err);
      setJoinError(err.response?.data?.message || 'Nepodarilo sa pripojiť k sezóne. Skontrolujte kód a skúste to znova.');
    } finally {
      setJoiningLoading(false);
    }
  };
  
  // Rendering komponentu
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Sezóny
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <TextField
            placeholder="Vyhľadať sezónu..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={handleSearch}
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <Box>
            {isAuthenticated && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleOpenJoinDialog}
                sx={{ mr: 2 }}
              >
                Pripojiť sa ku sezóne
              </Button>
            )}
            
            {isAuthenticated && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                component={RouterLink}
                to="/seasons/create"
              >
                Vytvoriť sezónu
              </Button>
            )}
          </Box>
        </Box>
        
        <Paper sx={{ mb: 4 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="Oficiálne sezóny" id="seasons-tab-0" />
            <Tab label="Komunitné sezóny" id="seasons-tab-1" />
          </Tabs>
        </Paper>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ my: 4 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <TabPanel value={tabValue} index={tabValue}>
            {filteredSeasons.length === 0 ? (
              <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
                {searchTerm ? 'Neboli nájdené žiadne sezóny podľa zadaných kritérií.' : 'Zatiaľ nie sú k dispozícii žiadne sezóny.'}
              </Typography>
            ) : (
              <Grid container spacing={3}>
                {filteredSeasons.map((season) => (
                  <Grid item xs={12} sm={6} md={4} key={season.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {season.image && (
                        <Box
                          sx={{
                            height: 140,
                            backgroundImage: `url(${season.image})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Typography variant="h5" component="h2" gutterBottom>
                          {season.name}
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                          <Chip 
                            label={season.type === 'official' ? 'Oficiálna' : 'Komunitná'} 
                            color={season.type === 'official' ? 'primary' : 'default'}
                            size="small"
                            sx={{ mr: 1 }}
                          />
                          {!season.active && (
                            <Chip label="Neaktívna" color="error" size="small" />
                          )}
                        </Box>
                        
                        {season.description && (
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {season.description.length > 100
                              ? `${season.description.substring(0, 100)}...`
                              : season.description}
                          </Typography>
                        )}
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                          <Typography variant="body2">
                            Líg: {season.leaguesCount || 0}
                          </Typography>
                          <Typography variant="body2">
                            Hráčov: {season.participantsCount || 0}
                          </Typography>
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button size="small" component={RouterLink} to={`/seasons/${season.id}`}>
                          Zobraziť detail
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </TabPanel>
        )}
      </Box>
      
      {/* Dialóg pre pripojenie k sezóne */}
      <Dialog open={joinDialogOpen} onClose={handleCloseJoinDialog}>
        <DialogTitle>Pripojiť sa ku sezóne</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Zadajte kód pre pripojenie k sezóne.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Kód pre pripojenie"
            fullWidth
            variant="outlined"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            error={!!joinError}
            helperText={joinError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseJoinDialog}>Zrušiť</Button>
          <Button 
            onClick={handleJoinSeason} 
           variant="contained" 
           disabled={joiningLoading}
         >
           {joiningLoading ? <CircularProgress size={24} /> : 'Pripojiť'}
         </Button>
       </DialogActions>
     </Dialog>
   </Container>
 );
};

export default SeasonsList;
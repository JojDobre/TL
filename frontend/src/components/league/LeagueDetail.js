// frontend/src/components/league/LeagueDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { 
  Container, Typography, Box, Paper, Button, Chip, Divider,
  Card, CardContent, CardActions, Grid, CircularProgress,
  Alert, Tabs, Tab, List, ListItem, ListItemText, 
  IconButton, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, TextField
} from '@mui/material';
import { 
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getLeagueById, updateLeague, deleteLeague } from '../../services/leagueService';
import { getAllRounds } from '../../services/roundService';
import HeroSection from '../layout/HeroSection';


// TabPanel komponent pre zobrazenie obsahu tabu
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`league-tabpanel-${index}`}
      aria-labelledby={`league-tab-${index}`}
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


const LeagueDetail = () => {
  // Parameter z URL
  const { id } = useParams();
  
  // State pre záložky
  const [tabValue, setTabValue] = useState(0);
  
  // State pre detail ligy
  const [league, setLeague] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State pre dialóg na úpravu ligy
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    image: '',
    password: '',
    active: true,
    scoringSystem: {
      exactScore: 10,
      correctGoals: 1,
      correctWinner: 3,
      goalDifference: 2
    }
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  
  // State pre dialóg na vymazanie ligy
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Hook pre autentifikáciu
  const { user, isAuthenticated } = useAuth();
  
  // Načítanie detailu ligy a kôl pri načítaní komponenty
  useEffect(() => {
    const fetchLeagueDetail = async () => {
      try {
        setLoading(true);
        setError('');
        
        console.log('Fetching league with ID:', id);
        
        // Načítanie detailu ligy
        const response = await getLeagueById(id);
        console.log('League API response:', response);
        
        if (response) {
          setLeague(response);
          
          // Nastavenie dát pre formulár úpravy
          setEditFormData({
            name: response.name || '',
            description: response.description || '',
            image: response.image || '',
            password: '', // Heslo sa nevracia z API
            active: response.active !== undefined ? response.active : true,
            scoringSystem: response.scoringSystem || {
              exactScore: 10,
              correctGoals: 1,
              correctWinner: 3,
              goalDifference: 2
            }
          });
          
          // Načítanie kôl pre ligu
          try {
            console.log('Fetching rounds for league ID:', id);
            const roundsResponse = await getAllRounds({ leagueId: id });
            console.log('Rounds API response:', roundsResponse);
            
            if (roundsResponse) {
              setRounds(roundsResponse);
            } else {
              console.log('No rounds data in response');
              setRounds([]);
            }
          } catch (roundsError) {
            console.error('Error fetching rounds:', roundsError);
            setRounds([]);
          }
        } else {
          throw new Error('Invalid response format from server');
        }
      } catch (err) {
        console.error('Error fetching league detail:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Nepodarilo sa načítať detail ligy. Skúste to znova neskôr.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeagueDetail();
  }, [id]);
  
  // Handler pre zmenu tabu
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handler pre zmenu inputov vo formulári úpravy
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('scoringSystem.')) {
      // Pre bodovací systém
      const scoringField = name.split('.')[1];
      setEditFormData(prevData => ({
        ...prevData,
        scoringSystem: {
          ...prevData.scoringSystem,
          [scoringField]: parseInt(value, 10) || 0
        }
      }));
    } else {
      // Pre ostatné polia
      setEditFormData(prevData => ({
        ...prevData,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Vytvorenie subtitle pre hero sekciu
  const getHeroSubtitle = () => {
    if (!league || !league.Season) return '';
  
    const seasonName = league.Season.name || '';
    const participantsCount = league.Season.participantsCount || 0;
    const inviteCode = league.Season.inviteCode || '000000';
    
    return `HRÁČI: ${participantsCount}/100 | ID: #${inviteCode}`;
  };

  
  // Handler pre odoslanie formulára úpravy
  const handleEditLeague = async () => {
    try {
      setEditLoading(true);
      setEditError('');
      
      // Aktualizácia ligy
      const updatedLeague = await updateLeague(id, editFormData);
      
      // Aktualizácia dát v state
      setLeague(prevLeague => ({
        ...prevLeague,
        ...updatedLeague
      }));
      
      // Zatvorenie dialógu
      setEditDialogOpen(false);
    } catch (err) {
      console.error('Chyba pri aktualizácii ligy:', err);
      setEditError(err.response?.data?.message || 'Nepodarilo sa aktualizovať ligu. Skúste to znova neskôr.');
    } finally {
      setEditLoading(false);
    }
  };
  
  // Handler pre vymazanie ligy
  const handleDeleteLeague = async () => {
    try {
      setDeleteLoading(true);
      
      // Vymazanie ligy
      await deleteLeague(id);
      
      // Presmerovanie na detail sezóny
      if (league && league.Season) {
        // Môžete použiť navigate(`/seasons/${league.Season.id}`);
        window.location.href = `/seasons/${league.Season.id}`;
      } else {
        // Môžete použiť navigate('/seasons');
        window.location.href = '/seasons';
      }
    } catch (err) {
      console.error('Chyba pri vymazávaní ligy:', err);
      setError(err.response?.data?.message || 'Nepodarilo sa vymazať ligu. Skúste to znova neskôr.');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };
  
  // Kontrola, či používateľ má oprávnenie upravovať ligu
  const hasEditPermission = () => {
    if (!isAuthenticated || !league || !league.Season) return false;
    
    // Admin má vždy oprávnenie
    if (user.role === 'admin') return true;
    
    // Tvorca sezóny má oprávnenie
    if (league.Season.creatorId === user.id) return true;
    
    // Admin sezóny má oprávnenie (túto informáciu môžeme potrebovať načítať z API)
    // TODO: Implementovať kontrolu, či je používateľ admin sezóny
    
    return false;
  };
  
  // Rendering komponenty
  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ my: 4 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          color="primary"
          component={RouterLink}
          to="/seasons"
          sx={{ mt: 2 }}
        >
          Späť na zoznam sezón
        </Button>
      </Container>
    );
  }
  
  if (!league) {
    return (
      <Container maxWidth="lg">
        <Alert severity="warning" sx={{ my: 4 }}>
          Liga nebola nájdená alebo nemáte k nej prístup.
        </Alert>
        <Button
          variant="contained"
          color="primary"
          component={RouterLink}
          to="/seasons"
          sx={{ mt: 2 }}
        >
          Späť na zoznam sezón
        </Button>
      </Container>
    );
  }
  
  console.log('Rendering league:', league);
  console.log('Rendering rounds:', rounds);
  
  return (

<>
<HeroSection 
    title={league?.Season?.name || 'SEZÓNA'} 
    subtitle={getHeroSubtitle()}
    seasonType={league?.Season?.type || 'community'}
  />




    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            {league.name}
          </Typography>
          
          <Box>
            {hasEditPermission() && (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={() => setEditDialogOpen(true)}
                  sx={{ mr: 1 }}
                >
                  Upraviť
                </Button>
                
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Vymazať
                </Button>
              </>
            )}
          </Box>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Chip 
            label={league.type === 'official' ? 'Oficiálna' : 'Vlastná'} 
            color={league.type === 'official' ? 'primary' : 'default'}
            size="small"
            sx={{ mr: 1 }}
          />
          {!league.active && (
            <Chip label="Neaktívna" color="error" size="small" sx={{ mr: 1 }} />
          )}
          {league.password && (
            <Chip label="Chránená heslom" color="warning" size="small" sx={{ mr: 1 }} />
          )}
          {league.Season && (
            <Chip 
              label={`Sezóna: ${league.Season.name}`}
              variant="outlined"
              size="small"
              component={RouterLink}
              to={`/seasons/${league.Season.id}`}
              clickable
            />
          )}
        </Box>
        
        {league.image && (
          <Box 
            sx={{ 
              width: '100%', 
              height: 200, 
              backgroundImage: `url(${league.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: 1,
              mb: 3
            }}
          />
        )}
        
        {league.description && (
          <Typography variant="body1" paragraph>
            {league.description}
          </Typography>
        )}
        
        <Divider sx={{ my: 3 }} />
        
        <Paper sx={{ mb: 4 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="Kolá" id="league-tab-0" />
            <Tab label="Rebríček" id="league-tab-1" />
            <Tab label="Bodovací systém" id="league-tab-2" />
          </Tabs>
          
            {/* Tab pre kolá */}
            <TabPanel value={tabValue} index={0}>
            <Box sx={{ mb: 3 }}>
                {hasEditPermission() && (
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    component={RouterLink}
                    to={`/rounds/create?leagueId=${league.id}`}
                >
                    Vytvoriť kolo
                </Button>
                )}
            </Box>
            
            {console.log('Rendering rounds:', rounds)}
  
  {rounds.length === 0 ? (
    <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
      V tejto lige zatiaľ nie sú žiadne kolá.
    </Typography>
  ) : (
    <Grid container spacing={3}>
      {rounds.map((round) => (
        <Grid item xs={12} sm={6} md={4} key={round.id}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h6" component="h3" gutterBottom>
                {round.name}
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                {!round.active && (
                  <Chip label="Neaktívne" color="error" size="small" sx={{ mr: 1 }} />
                )}
                {new Date(round.endDate) < new Date() ? (
                  <Chip label="Uzavreté" color="default" size="small" />
                ) : new Date(round.startDate) > new Date() ? (
                  <Chip label="Pripravované" color="info" size="small" />
                ) : (
                  <Chip label="Aktívne" color="success" size="small" />
                )}
              </Box>
              
              {round.description && (
                <Typography variant="body2" color="text.secondary" paragraph>
                  {round.description.length > 80
                    ? `${round.description.substring(0, 80)}...`
                    : round.description}
                </Typography>
              )}
              
              <Typography variant="body2" sx={{ mt: 2 }}>
                Začiatok: {new Date(round.startDate).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                Koniec: {new Date(round.endDate).toLocaleString()}
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Typography variant="body2">
                  Zápasov: {round.matchesCount || 0}
                </Typography>
              </Box>
            </CardContent>
            <CardActions>
              <Button size="small" component={RouterLink} to={`/rounds/${round.id}`}>
                Zobraziť detail
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  )}
          </TabPanel>
          
          {/* Tab pre rebríček */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 4 }}>
              <TrophyIcon fontSize="large" sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h5">
                Rebríček ligy
              </Typography>
            </Box>
            
            {/* Tu bude implementovaný rebríček ligy */}
            <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
              Rebríček bude dostupný po prvých odohraných zápasoch.
            </Typography>
          </TabPanel>
          
          {/* Tab pre bodovací systém */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h5" gutterBottom>
              Bodovací systém
            </Typography>
            
            {league.scoringSystem ? (
              <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      +{league.scoringSystem.exactScore}
                    </Typography>
                    <Typography variant="body1">
                      Presný výsledok
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      +{league.scoringSystem.correctWinner}
                    </Typography>
                    <Typography variant="body1">
                      Správny víťaz
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      +{league.scoringSystem.correctGoals}
                    </Typography>
                    <Typography variant="body1">
                      Správny počet gólov
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      +{league.scoringSystem.goalDifference}
                    </Typography>
                    <Typography variant="body1">
                      Správny gólový rozdiel
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
                Pre túto ligu nie je definovaný bodovací systém.
              </Typography>
            )}
            
            {league.scoringLocked && (
              <Alert severity="info" sx={{ mt: 4 }}>
                Bodovací systém je uzamknutý a nemôže byť zmenený, pretože už bolo započaté prvé kolo.
              </Alert>
            )}
          </TabPanel>
        </Paper>
      </Paper>
      
      {/* Dialóg pre úpravu ligy */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upraviť ligu</DialogTitle>
        <DialogContent>
         {editError && <Alert severity="error" sx={{ mb: 3 }}>{editError}</Alert>}
         
         <TextField
           margin="normal"
           required
           fullWidth
           id="name"
           label="Názov ligy"
           name="name"
           value={editFormData.name}
           onChange={handleEditFormChange}
         />
         
         <TextField
           margin="normal"
           fullWidth
           multiline
           rows={3}
           id="description"
           label="Popis ligy"
           name="description"
           value={editFormData.description}
           onChange={handleEditFormChange}
         />
         
         <TextField
           margin="normal"
           fullWidth
           id="image"
           label="URL obrázka ligy"
           name="image"
           placeholder="https://example.com/image.jpg"
           value={editFormData.image}
           onChange={handleEditFormChange}
         />
         
         <TextField
           margin="normal"
           fullWidth
           id="password"
           label="Nové heslo pre ligu (voliteľné)"
           name="password"
           type="password"
           value={editFormData.password}
           onChange={handleEditFormChange}
           helperText="Nechajte prázdne, ak nechcete zmeniť heslo."
         />
         
         {!league.scoringLocked && (
           <>
             <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
               Bodovací systém
             </Typography>
             
             <Grid container spacing={2}>
               <Grid item xs={12} sm={6}>
                 <TextField
                   margin="normal"
                   fullWidth
                   id="scoringSystem.exactScore"
                   label="Body za presný výsledok"
                   name="scoringSystem.exactScore"
                   type="number"
                   InputProps={{
                     inputProps: { min: 0 },
                   }}
                   value={editFormData.scoringSystem.exactScore}
                   onChange={handleEditFormChange}
                 />
               </Grid>
               <Grid item xs={12} sm={6}>
                 <TextField
                   margin="normal"
                   fullWidth
                   id="scoringSystem.correctWinner"
                   label="Body za správneho víťaza"
                   name="scoringSystem.correctWinner"
                   type="number"
                   InputProps={{
                     inputProps: { min: 0 },
                   }}
                   value={editFormData.scoringSystem.correctWinner}
                   onChange={handleEditFormChange}
                 />
               </Grid>
               <Grid item xs={12} sm={6}>
                 <TextField
                   margin="normal"
                   fullWidth
                   id="scoringSystem.correctGoals"
                   label="Body za správny počet gólov"
                   name="scoringSystem.correctGoals"
                   type="number"
                   InputProps={{
                     inputProps: { min: 0 },
                   }}
                   value={editFormData.scoringSystem.correctGoals}
                   onChange={handleEditFormChange}
                 />
               </Grid>
               <Grid item xs={12} sm={6}>
                 <TextField
                   margin="normal"
                   fullWidth
                   id="scoringSystem.goalDifference"
                   label="Body za správny gólový rozdiel"
                   name="scoringSystem.goalDifference"
                   type="number"
                   InputProps={{
                     inputProps: { min: 0 },
                   }}
                   value={editFormData.scoringSystem.goalDifference}
                   onChange={handleEditFormChange}
                 />
               </Grid>
             </Grid>
           </>
         )}
       </DialogContent>
       <DialogActions>
         <Button onClick={() => setEditDialogOpen(false)}>Zrušiť</Button>
         <Button 
           onClick={handleEditLeague} 
           variant="contained" 
           disabled={editLoading}
         >
           {editLoading ? <CircularProgress size={24} /> : 'Uložiť zmeny'}
         </Button>
       </DialogActions>
     </Dialog>
     
     {/* Dialóg pre vymazanie ligy */}
     <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
       <DialogTitle>Vymazať ligu</DialogTitle>
       <DialogContent>
         <DialogContentText>
           Ste si istý, že chcete vymazať túto ligu? Táto akcia sa nedá vrátiť späť a všetky údaje o lige, vrátane kôl, zápasov a tipov budú natrvalo vymazané.
         </DialogContentText>
       </DialogContent>
       <DialogActions>
         <Button onClick={() => setDeleteDialogOpen(false)}>Zrušiť</Button>
         <Button 
           onClick={handleDeleteLeague} 
           variant="contained" 
           color="error"
           disabled={deleteLoading}
         >
           {deleteLoading ? <CircularProgress size={24} /> : 'Vymazať'}
         </Button>
       </DialogActions>
     </Dialog>
   </Container> </>
 );
};

export default LeagueDetail;
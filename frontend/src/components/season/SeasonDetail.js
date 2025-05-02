// frontend/src/components/season/SeasonDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { 
  Container, Typography, Box, Paper, Button, Chip, Divider,
  Card, CardContent, CardActions, Grid, CircularProgress,
  Alert, Tabs, Tab, List, ListItem, ListItemText, ListItemAvatar,
  Avatar, IconButton, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, TextField
} from '@mui/material';
import { 
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ContentCopy as CopyIcon, EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getSeasonById, updateSeason, deleteSeason } from '../../services/seasonService';
import { getAllLeagues } from '../../services/leagueService';
import axios from 'axios';


// TabPanel komponent pre zobrazenie obsahu tabu
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`season-tabpanel-${index}`}
      aria-labelledby={`season-tab-${index}`}
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

const SeasonDetail = () => {
  // Parameter z URL
  const { id } = useParams();
  
  // State pre záložky
  const [tabValue, setTabValue] = useState(0);
  
  // State pre detail sezóny
  const [season, setSeason] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State pre dialóg na kopírovanie kódu
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  
  // State pre dialóg na úpravu sezóny
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    image: '',
    rules: '',
    active: true
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  
  // State pre dialóg na vymazanie sezóny
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Hook pre autentifikáciu
  const { user, isAuthenticated } = useAuth();
  
  // Načítanie detailu sezóny a líg pri načítaní komponenty
  useEffect(() => {
    const fetchSeasonDetail = async () => {
        try {
          setLoading(true);
          setError('');
          
          console.log('Fetching season with ID:', id);
          
          // Načítanie detailu sezóny
          const response = await axios.get(`/api/seasons/${id}`);
          console.log('Season API response:', response.data);
          
          if (response.data && response.data.data) {
            setSeason(response.data.data);
            
            // Nastavenie dát pre formulár úpravy
            setEditFormData({
              name: response.data.data.name || '',
              description: response.data.data.description || '',
              image: response.data.data.image || '',
              rules: response.data.data.rules || '',
              active: response.data.data.active !== undefined ? response.data.data.active : true
            });
            
            // Načítanie líg pre sezónu
            try {
              const leaguesResponse = await axios.get(`/api/leagues?seasonId=${id}`);
              console.log('Leagues API response:', leaguesResponse.data);
              
              if (leaguesResponse.data && leaguesResponse.data.data) {
                setLeagues(leaguesResponse.data.data);
              } else {
                console.log('No leagues data in response');
                setLeagues([]);
              }
            } catch (leaguesError) {
              console.error('Error fetching leagues:', leaguesError);
              setLeagues([]);
            }
          } else {
            throw new Error('Invalid response format from server');
          }
        } catch (err) {
          console.error('Error fetching season detail:', err);
          const errorMessage = err.response?.data?.message || err.message || 'Nepodarilo sa načítať detail sezóny. Skúste to znova neskôr.';
          setError(errorMessage);
        } finally {
          setLoading(false);
        }
      };
      
      fetchSeasonDetail();
    }, [id]);
  
  // Handler pre zmenu tabu
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handler pre kopírovanie kódu pre pripojenie
  const handleCopyInviteCode = () => {
    if (season && season.inviteCode) {
      navigator.clipboard.writeText(season.inviteCode)
        .then(() => {
          // Zobraziť oznámenie o úspešnom skopírovaní (môžete pridať snackbar)
          setCopyDialogOpen(false);
        })
        .catch(err => {
          console.error('Chyba pri kopírovaní kódu:', err);
        });
    }
  };
  
  // Handler pre zmenu inputov vo formulári úpravy
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setEditFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handler pre odoslanie formulára úpravy
  const handleEditSeason = async () => {
    try {
      setEditLoading(true);
      setEditError('');
      
      // Aktualizácia sezóny
      const updatedSeason = await updateSeason(id, editFormData);
      
      // Aktualizácia dát v state
      setSeason(prevSeason => ({
        ...prevSeason,
        ...updatedSeason
      }));
      
      // Zatvorenie dialógu
      setEditDialogOpen(false);
    } catch (err) {
      console.error('Chyba pri aktualizácii sezóny:', err);
      setEditError(err.response?.data?.message || 'Nepodarilo sa aktualizovať sezónu. Skúste to znova neskôr.');
    } finally {
      setEditLoading(false);
    }
  };
  
  // Handler pre vymazanie sezóny
  const handleDeleteSeason = async () => {
    try {
      setDeleteLoading(true);
      
      // Vymazanie sezóny
      await deleteSeason(id);
      
      // Presmerovanie na zoznam sezón
      // Môžete použiť navigate('/seasons');
    } catch (err) {
      console.error('Chyba pri vymazávaní sezóny:', err);
      setError(err.response?.data?.message || 'Nepodarilo sa vymazať sezónu. Skúste to znova neskôr.');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };
  
  // Kontrola, či používateľ je tvorcom sezóny alebo admin
  const isCreatorOrAdmin = () => {
    if (!isAuthenticated || !season) return false;
    
    return season.creatorId === user.id || user.role === 'admin';
  };
  
  // Kontrola, či používateľ je účastníkom sezóny
  const isParticipant = () => {
    if (!isAuthenticated || !season || !season.participants) return false;
    
    return season.participants.some(participant => participant.id === user.id);
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
  
  if (!season) {
    return (
      <Container maxWidth="lg">
        <Alert severity="warning" sx={{ my: 4 }}>
          Sezóna nebola nájdená alebo nemáte k nej prístup.
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
  
  console.log('Rendering season:', season);
  console.log('Rendering leagues:', leagues);

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            {season.name}
          </Typography>
          
          <Box>
            {isCreatorOrAdmin() && (
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
            label={season.type === 'official' ? 'Oficiálna' : 'Komunitná'} 
            color={season.type === 'official' ? 'primary' : 'default'}
            size="small"
            sx={{ mr: 1 }}
          />
          {!season.active && (
            <Chip label="Neaktívna" color="error" size="small" sx={{ mr: 1 }} />
          )}
          {season.creator && (
            <Chip 
              label={`Vytvoril: ${season.creator.username}`} 
              variant="outlined"
              size="small"
            />
          )}
        </Box>
        
        {season.image && (
          <Box 
            sx={{ 
              width: '100%', 
              height: 200, 
              backgroundImage: `url(${season.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: 1,
              mb: 3
            }}
          />
        )}
        
        {season.description && (
          <Typography variant="body1" paragraph>
            {season.description}
          </Typography>
        )}
        
        {isAuthenticated && isParticipant() && (
          <Box sx={{ mt: 3, mb: 4, display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 2 }}>
              Kód pre pripojenie: <strong>{season.inviteCode}</strong>
            </Typography>
            
            <Button
              variant="outlined"
              size="small"
              startIcon={<CopyIcon />}
              onClick={() => setCopyDialogOpen(true)}
            >
              Kopírovať
            </Button>
          </Box>
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
            <Tab label="Ligy" id="season-tab-0" />
            <Tab label="Rebríček" id="season-tab-1" />
            <Tab label="Pravidlá" id="season-tab-2" />
            <Tab label="Hráči" id="season-tab-3" />
          </Tabs>
          
          {/* Tab pre ligy */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ mb: 3 }}>
              {isCreatorOrAdmin() && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  component={RouterLink}
                  to={`/leagues/create?seasonId=${season.id}`}
                >
                  Vytvoriť ligu
                </Button>
              )}
            </Box>
            
            {leagues.length === 0 ? (
              <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
                V tejto sezóne zatiaľ nie sú žiadne ligy.
              </Typography>
            ) : (
              <Grid container spacing={3}>
                {leagues.map((league) => (
                  <Grid item xs={12} sm={6} md={4} key={league.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {league.image && (
                        <Box
                          sx={{
                            height: 100,
                            backgroundImage: `url(${league.image})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" component="h3" gutterBottom>
                          {league.name}
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                          <Chip 
                            label={league.type === 'official' ? 'Oficiálna' : 'Vlastná'} 
                            color={league.type === 'official' ? 'primary' : 'default'}
                            size="small"
                            sx={{ mr: 1 }}
                          />
                          {!league.active && (
                            <Chip label="Neaktívna" color="error" size="small" />
                          )}
                        </Box>
                        
                        {league.description && (
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {league.description.length > 80
                              ? `${league.description.substring(0, 80)}...`
                              : league.description}
                          </Typography>
                        )}
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                          <Typography variant="body2">
                            Kolá: {league.roundsCount || 0}
                          </Typography>
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button size="small" component={RouterLink} to={`/leagues/${league.id}`}>
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
                Rebríček sezóny
              </Typography>
            </Box>
            
            {/* Tu bude implementovaný rebríček sezóny */}
            <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
              Rebríček bude dostupný po prvých odohraných zápasoch.
            </Typography>
          </TabPanel>
          
          {/* Tab pre pravidlá */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h5" gutterBottom>
              Pravidlá sezóny
            </Typography>
            
            {season.rules ? (
              <Typography variant="body1" component="div" sx={{ whiteSpace: 'pre-line' }}>
                {season.rules}
              </Typography>
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
                Pre túto sezónu nie sú definované žiadne pravidlá.
              </Typography>
            )}
          </TabPanel>
          
          {/* Tab pre hráčov */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="h5" gutterBottom>
              Hráči v sezóne
            </Typography>
            
            {season.participants && season.participants.length > 0 ? (
              <List>
                {season.participants.map((participant) => (
                  <ListItem key={participant.id}>
                    <ListItemAvatar>
                      <Avatar 
                        src={participant.profileImage}
                        alt={participant.username}
                      >
                        {participant.username.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <>
                          {participant.username}
                          {participant.UserSeason?.role === 'admin' && (
                            <Chip 
                              label="Admin" 
                              size="small" 
                              color="primary" 
                              sx={{ ml: 1 }}
                            />
                          )}
                        </>
                      }
                      secondary={`${participant.firstName || ''} ${participant.lastName || ''}`.trim()}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
                V tejto sezóne zatiaľ nie sú žiadni hráči.
              </Typography>
            )}
          </TabPanel>
        </Paper>
      </Paper>
      
      {/* Dialóg pre kopírovanie kódu pre pripojenie */}
      <Dialog open={copyDialogOpen} onClose={() => setCopyDialogOpen(false)}>
        <DialogTitle>Kód pre pripojenie k sezóne</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Zdieľajte tento kód s priateľmi, aby sa mohli pripojiť k vašej sezóne.
          </DialogContentText>
          <TextField
            margin="dense"
            fullWidth
            value={season.inviteCode}
            InputProps={{
              readOnly: true,
            }}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialogOpen(false)}>Zavrieť</Button>
          <Button onClick={handleCopyInviteCode} variant="contained">
            Kopírovať kód
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialóg pre úpravu sezóny */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upraviť sezónu</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 3 }}>{editError}</Alert>}
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label="Názov sezóny"
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
            label="Popis sezóny"
            name="description"
            value={editFormData.description}
            onChange={handleEditFormChange}
          />
          
          <TextField
            margin="normal"
            fullWidth
            id="image"
            label="URL obrázka sezóny"
            name="image"
            placeholder="https://example.com/image.jpg"
            value={editFormData.image}
            onChange={handleEditFormChange}
          />
          
          <TextField
            margin="normal"
            fullWidth
            multiline
            rows={4}
            id="rules"
            label="Pravidlá sezóny"
            name="rules"
            value={editFormData.rules}
            onChange={handleEditFormChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Zrušiť</Button>
          <Button 
            onClick={handleEditSeason} 
            variant="contained" 
            disabled={editLoading}
          >
            {editLoading ? <CircularProgress size={24} /> : 'Uložiť zmeny'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialóg pre vymazanie sezóny */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Vymazať sezónu</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Ste si istý, že chcete vymazať túto sezónu? Táto akcia sa nedá vrátiť späť a všetky údaje o sezóne, vrátane líg, kôl, zápasov a tipov budú natrvalo vymazané.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Zrušiť</Button>
          <Button 
            onClick={handleDeleteSeason} 
            variant="contained" 
            color="error"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={24} /> : 'Vymazať'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SeasonDetail;
// frontend/src/components/round/RoundDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { 
  Container, Typography, Box, Paper, Button, Chip, Divider,
  Card, CardContent, CardActions, Grid, CircularProgress,
  Alert, Tabs, Tab, IconButton, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem, Radio, RadioGroup, FormControlLabel
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Save as SaveIcon, Check as CheckIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getRoundById, updateRound, deleteRound } from '../../services/roundService';
import { getAllMatches } from '../../services/matchService';
import { getUserTips, createOrUpdateTip } from '../../services/tipService';

// TabPanel komponent pre zobrazenie obsahu tabu
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`round-tabpanel-${index}`}
      aria-labelledby={`round-tab-${index}`}
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

const RoundDetail = () => {
  // Parameter z URL
  const { id } = useParams();
  
  // State pre záložky
  const [tabValue, setTabValue] = useState(0);
  
  // State pre detail kola
  const [round, setRound] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

    // Nový stav pre tipy
    const [tips, setTips] = useState({});
    const [userTips, setUserTips] = useState([]);
    const [tipLoading, setTipLoading] = useState({});
    const [tipError, setTipError] = useState({});
    const [tipSuccess, setTipSuccess] = useState({});
  
  // State pre dialóg na úpravu kola
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(),
    active: true
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  
  // State pre dialóg na vymazanie kola
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Hook pre autentifikáciu
  const { user, isAuthenticated } = useAuth();
  
  // Načítanie detailu kola a zápasov pri načítaní komponenty
  useEffect(() => {

    const fetchUserTips = async () => {
        try {
          const tipsData = await getUserTips({ round: id });
          
          // Vytvorenie objektu, kde kľúč je matchId a hodnota je tip
          const tipsMap = {};
          tipsData.forEach(tip => {
            tipsMap[tip.matchId] = tip;
          });
          
          setUserTips(tipsData);
          setTips(tipsMap);
        } catch (err) {
          console.error('Chyba pri načítavaní tipov:', err);
        }
      };

    const fetchRoundDetail = async () => {
      try {
        setLoading(true);
        setError('');
        
        console.log('Fetching round with ID:', id);
        
        // Načítanie detailu kola
        const response = await getRoundById(id);
        console.log('Round API response:', response);
        
        if (response) {
          setRound(response);
          
          // Nastavenie dát pre formulár úpravy
          setEditFormData({
            name: response.name || '',
            description: response.description || '',
            startDate: new Date(response.startDate),
            endDate: new Date(response.endDate),
            active: response.active !== undefined ? response.active : true
          });
          
          // Načítanie zápasov pre kolo
          try {
            const matchesResponse = await getAllMatches({ roundId: id });
            console.log('Matches API response:', matchesResponse);
            
            if (matchesResponse) {
              setMatches(matchesResponse);
            } else {
              console.log('No matches data in response');
              setMatches([]);
            }
          } catch (matchesError) {
            console.error('Error fetching matches:', matchesError);
            setMatches([]);
          }
        } else {
          throw new Error('Invalid response format from server');
        }
      } catch (err) {
        console.error('Error fetching round detail:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Nepodarilo sa načítať detail kola. Skúste to znova neskôr.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoundDetail();
    fetchUserTips();
  }, [id]);
  
// Handler pre zmenu tipu
const handleTipChange = (matchId, field, value) => {
    setTips(prevTips => {
      const updatedTips = { ...prevTips };
      
      // Ak tip pre tento zápas ešte neexistuje, vytvoríme ho
      if (!updatedTips[matchId]) {
        updatedTips[matchId] = {
          matchId,
          homeScore: null,
          awayScore: null,
          winner: null
        };
      }
      
      // Aktualizácia hodnoty
      updatedTips[matchId][field] = value;
      
      // Ak sa zmení homeScore alebo awayScore, určíme víťaza
      if (field === 'homeScore' || field === 'awayScore') {
        const homeScore = field === 'homeScore' ? value : updatedTips[matchId].homeScore;
        const awayScore = field === 'awayScore' ? value : updatedTips[matchId].awayScore;
        
        if (homeScore !== null && awayScore !== null) {
          if (homeScore > awayScore) {
            updatedTips[matchId].winner = 'home';
          } else if (homeScore < awayScore) {
            updatedTips[matchId].winner = 'away';
          } else {
            updatedTips[matchId].winner = 'draw';
          }
        }
      }
      
      return updatedTips;
    });
  };
  
  // Handler pre uloženie tipu
  const handleSaveTip = async (matchId) => {
    // Kontrola, či je tip vyplnený
    if (!tips[matchId]) return;
    
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    
    // Nastavenie loadingu
    setTipLoading(prev => ({ ...prev, [matchId]: true }));
    setTipError(prev => ({ ...prev, [matchId]: null }));
    setTipSuccess(prev => ({ ...prev, [matchId]: null }));
    
    try {
      // Vytvorenie objektu s údajmi tipu
      const tipData = {
        matchId
      };
      
      // Pridanie údajov podľa typu tipovania
      if (match.tipType === 'exact_score') {
        tipData.homeScore = tips[matchId].homeScore;
        tipData.awayScore = tips[matchId].awayScore;
      } else {
        tipData.winner = tips[matchId].winner;
      }
      
      // Odoslanie tipu na server
      await createOrUpdateTip(tipData);
      
      // Nastavenie úspechu
      setTipSuccess(prev => ({ ...prev, [matchId]: 'Tip bol úspešne uložený.' }));
      
      // Po 3 sekundách skryjeme hlášku o úspechu
      setTimeout(() => {
        setTipSuccess(prev => ({ ...prev, [matchId]: null }));
      }, 3000);
    } catch (err) {
      console.error('Chyba pri ukladaní tipu:', err);
      setTipError(prev => ({ ...prev, [matchId]: err.response?.data?.message || 'Chyba pri ukladaní tipu.' }));
    } finally {
      setTipLoading(prev => ({ ...prev, [matchId]: false }));
    }
  };

  // Kontrola, či je možné tipovať
  const canSubmitTips = () => {
    if (!round) return false;
    
    const now = new Date();
    const endDate = new Date(round.endDate);
    
    return now <= endDate;
  };

  // Handler pre zmenu tabu
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handler pre zmenu inputov vo formulári úpravy
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setEditFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handler pre zmenu dátumov
  const handleDateChange = (name, date) => {
    setEditFormData(prevData => ({
      ...prevData,
      [name]: date
    }));
  };
  
  // Handler pre odoslanie formulára úpravy
  const handleEditRound = async () => {
    // Validácia dátumov
    if (editFormData.startDate >= editFormData.endDate) {
      setEditError('Dátum konca musí byť po dátume začiatku.');
      return;
    }
    
    try {
      setEditLoading(true);
      setEditError('');
      
      // Aktualizácia kola
      const updatedRound = await updateRound(id, editFormData);
      
      // Aktualizácia dát v state
      setRound(prevRound => ({
        ...prevRound,
        ...updatedRound
      }));
      
      // Zatvorenie dialógu
      setEditDialogOpen(false);
    } catch (err) {
      console.error('Chyba pri aktualizácii kola:', err);
      setEditError(err.response?.data?.message || 'Nepodarilo sa aktualizovať kolo. Skúste to znova neskôr.');
    } finally {
      setEditLoading(false);
    }
  };
  
  // Handler pre vymazanie kola
  const handleDeleteRound = async () => {
    try {
      setDeleteLoading(true);
      
      // Vymazanie kola
      await deleteRound(id);
      
      // Presmerovanie na detail ligy
      if (round && round.League) {
        // Môžete použiť navigate(`/leagues/${round.League.id}`);
        window.location.href = `/leagues/${round.League.id}`;
      } else {
        // Môžete použiť navigate('/seasons');
        window.location.href = '/seasons';
      }
    } catch (err) {
      console.error('Chyba pri vymazávaní kola:', err);
      setError(err.response?.data?.message || 'Nepodarilo sa vymazať kolo. Skúste to znova neskôr.');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };
  
  // Kontrola, či používateľ má oprávnenie upravovať kolo
  const hasEditPermission = () => {
    if (!isAuthenticated || !round || !round.League || !round.League.Season) return false;
    
    // Admin má vždy oprávnenie
    if (user.role === 'admin') return true;
    
    // Tvorca sezóny má oprávnenie
    if (round.League.Season.creatorId === user.id) return true;
    
    // Admin sezóny má oprávnenie (túto informáciu môžeme potrebovať načítať z API)
    // TODO: Implementovať kontrolu, či je používateľ admin sezóny
    
    return false;
  };
  
  // Kontrola stavu kola (či je aktívne, uzavreté alebo pripravované)
  const getRoundStatus = () => {
    if (!round) return null;
    
    const now = new Date();
    const startDate = new Date(round.startDate);
    const endDate = new Date(round.endDate);
    
    if (!round.active) {
      return { label: 'Neaktívne', color: 'error' };
    } else if (now < startDate) {
      return { label: 'Pripravované', color: 'info' };
    } else if (now > endDate) {
      return { label: 'Uzavreté', color: 'default' };
    } else {
      return { label: 'Aktívne', color: 'success' };
    }
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
  
  if (!round) {
    return (
      <Container maxWidth="lg">
        <Alert severity="warning" sx={{ my: 4 }}>
          Kolo nebolo nájdené alebo nemáte k nemu prístup.
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
  
  const roundStatus = getRoundStatus();
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="lg">
        <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1">
              {round.name}
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
            {roundStatus && (
              <Chip 
                label={roundStatus.label} 
                color={roundStatus.color}
                size="small"
                sx={{ mr: 1 }}
              />
            )}
            {round.League && (
              <Chip 
                label={`Liga: ${round.League.name}`}
                variant="outlined"
                size="small"
                component={RouterLink}
                to={`/leagues/${round.League.id}`}
                clickable
              />
            )}
          </Box>
          
          {round.description && (
            <Typography variant="body1" paragraph>
              {round.description}
            </Typography>
          )}
          
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Začiatok tipovania:
                </Typography>
                <Typography variant="body1">
                  {new Date(round.startDate).toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Koniec tipovania:
                </Typography>
                <Typography variant="body1">
                  {new Date(round.endDate).toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          <Paper sx={{ mb: 4 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="Zápasy" id="round-tab-0" />
              <Tab label="Moje tipy" id="round-tab-1" />
              <Tab label="Výsledky" id="round-tab-2" />
            </Tabs>
            
               {/* Tab pre zápasy */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ mb: 3 }}>
                {hasEditPermission() && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    component={RouterLink}
                    to={`/matches/create?roundId=${round.id}`}
                  >
                    Pridať zápasy
                  </Button>
                )}
              </Box>
              
              {matches.length === 0 ? (
                <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
                  V tomto kole zatiaľ nie sú žiadne zápasy.
                </Typography>
              ) : (
                <Grid container spacing={3}>
                  {matches.map((match) => (
                    <Grid item xs={12} sm={6} key={match.id}>
                      <Card sx={{ display: 'flex', flexDirection: 'column' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(match.matchTime).toLocaleString()}
                            </Typography>
                            <Chip 
                              label={match.status === 'scheduled' ? 'Plánovaný' : 
                                    match.status === 'in_progress' ? 'Prebieha' :
                                    match.status === 'finished' ? 'Ukončený' : 'Zrušený'}
                              color={match.status === 'scheduled' ? 'primary' : 
                                    match.status === 'in_progress' ? 'warning' :
                                    match.status === 'finished' ? 'success' : 'error'}
                              size="small"
                            />
                          </Box>
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                              <Box 
                                component="img"
                                src={match.homeTeam?.logo || '/placeholder-team.png'}
                                alt={match.homeTeam?.name}
                                sx={{ width: 60, height: 60, objectFit: 'contain', mb: 1 }}
                              />
                              <Typography variant="body1" align="center">
                                {match.homeTeam?.name || 'Domáci tím'}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20%' }}>
                              {match.status === 'finished' ? (
                                <Typography variant="h5" fontWeight="bold">
                                  {match.homeScore} : {match.awayScore}
                                </Typography>
                              ) : (
                                <Typography variant="h5" fontWeight="bold">
                                  VS
                                </Typography>
                              )}
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                              <Box 
                                component="img"
                                src={match.awayTeam?.logo || '/placeholder-team.png'}
                                alt={match.awayTeam?.name}
                                sx={{ width: 60, height: 60, objectFit: 'contain', mb: 1 }}
                              />
                              <Typography variant="body1" align="center">
                                {match.awayTeam?.name || 'Hosťujúci tím'}
                              </Typography>
                            </Box>
                          </Box>
                          
                          {/* Sekcia pre tipovanie */}
                          {isAuthenticated && canSubmitTips() && (
                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #eee' }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Môj tip:
                              </Typography>
                              
                              {match.tipType === 'exact_score' ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1 }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    InputProps={{ inputProps: { min: 0 } }}
                                    sx={{ width: 60 }}
                                    value={tips[match.id]?.homeScore !== null ? tips[match.id]?.homeScore : ''}
                                    onChange={(e) => handleTipChange(match.id, 'homeScore', e.target.value === '' ? null : parseInt(e.target.value))}
                                  />
                                  <Typography variant="h6" sx={{ mx: 2 }}>:</Typography>
                                  <TextField
                                    type="number"
                                    size="small"
                                    InputProps={{ inputProps: { min: 0 } }}
                                    sx={{ width: 60 }}
                                    value={tips[match.id]?.awayScore !== null ? tips[match.id]?.awayScore : ''}
                                    onChange={(e) => handleTipChange(match.id, 'awayScore', e.target.value === '' ? null : parseInt(e.target.value))}
                                  />
                                </Box>
                              ) : (
                                <RadioGroup
                                  row
                                  value={tips[match.id]?.winner || ''}
                                  onChange={(e) => handleTipChange(match.id, 'winner', e.target.value)}
                                  sx={{ justifyContent: 'center' }}
                                >
                                  <FormControlLabel 
                                    value="home" 
                                    control={<Radio size="small" />} 
                                    label={match.homeTeam?.name || 'Domáci'} 
                                  />
                                  <FormControlLabel 
                                    value="draw" 
                                    control={<Radio size="small" />} 
                                    label="Remíza" 
                                  />
                                  <FormControlLabel 
                                    value="away" 
                                    control={<Radio size="small" />} 
                                    label={match.awayTeam?.name || 'Hostia'} 
                                  />
                                </RadioGroup>
                              )}
                              
                              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                <Button
                                  variant="contained"
                                  color="primary"
                                  size="small"
                                  startIcon={tipSuccess[match.id] ? <CheckIcon /> : <SaveIcon />}
                                  onClick={() => handleSaveTip(match.id)}
                                  disabled={tipLoading[match.id]}
                                >
                                  {tipLoading[match.id] ? 
                                    <CircularProgress size={20} /> : 
                                    tipSuccess[match.id] ? 'Uložené' : 'Uložiť tip'}
                                </Button>
                              </Box>
                              
                              {tipError[match.id] && (
                                <Alert severity="error" sx={{ mt: 1, fontSize: '0.8rem' }}>
                                  {tipError[match.id]}
                                </Alert>
                              )}
                              
                              {tipSuccess[match.id] && (
                                <Alert severity="success" sx={{ mt: 1, fontSize: '0.8rem' }}>
                                  {tipSuccess[match.id]}
                                </Alert>
                              )}
                            </Box>
                          )}
                          
                          {/* Zobrazenie výsledku pre ukončené zápasy */}
                          {match.status === 'finished' && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
                              <Typography variant="subtitle2" align="center" gutterBottom>
                                Konečný výsledok
                              </Typography>
                              <Typography variant="h6" align="center" fontWeight="bold">
                                {match.homeScore} : {match.awayScore}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                        
                        {hasEditPermission() && (
                          <CardActions>
                            <Button 
                              size="small" 
                              component={RouterLink} 
                              to={`/matches/${match.id}/edit`}
                            >
                              Upraviť zápas
                            </Button>
                          </CardActions>
                        )}
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </TabPanel>
            
            {/* Tab pre moje tipy */}
            <TabPanel value={tabValue} index={1}>
              {isAuthenticated ? (
                userTips.length > 0 ? (
                  <Grid container spacing={3}>
                    {userTips.map(tip => (
                      <Grid item xs={12} sm={6} key={tip.id}>
                        <Card>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                {tip.Match?.matchTime ? new Date(tip.Match.matchTime).toLocaleString() : 'N/A'}
                              </Typography>
                              <Chip 
                                label={tip.submitted ? 'Odoslaný' : 'Rozpracovaný'}
                                color={tip.submitted ? 'success' : 'warning'}
                                size="small"
                              />
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ width: '40%', textAlign: 'center' }}>
                                {tip.Match?.homeTeam?.name || 'Domáci tím'}
                              </Typography>
                              
                              <Typography variant="body1" sx={{ width: '20%', textAlign: 'center', fontWeight: 'bold' }}>
                                VS
                              </Typography>
                              
                              <Typography variant="body2" sx={{ width: '40%', textAlign: 'center' }}>
                                {tip.Match?.awayTeam?.name || 'Hosťujúci tím'}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ mt: 2, textAlign: 'center' }}>
                              <Typography variant="subtitle2">
                                Váš tip:
                              </Typography>
                              
                              {tip.Match?.tipType === 'exact_score' ? (
                                <Typography variant="h6" fontWeight="bold">
                                  {tip.homeScore !== null && tip.awayScore !== null 
                                    ? `${tip.homeScore} : ${tip.awayScore}`
                                    : 'Nezadaný'
                                  }
                                </Typography>
                              ) : (
                                <Typography variant="body1">
                                  {tip.winner === 'home' 
                                    ? `Víťaz: ${tip.Match?.homeTeam?.name || 'Domáci'}`
                                    : tip.winner === 'away'
                                    ? `Víťaz: ${tip.Match?.awayTeam?.name || 'Hostia'}`
                                    : tip.winner === 'draw'
                                    ? 'Remíza'
                                    : 'Nezadaný'
                                  }
                                </Typography>
                              )}
                            </Box>
                            
                            {tip.Match?.status === 'finished' && (
                              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
                                <Typography variant="subtitle2" align="center">
                                  Konečný výsledok:
                                </Typography>
                                <Typography variant="h6" align="center" fontWeight="bold">
                                  {tip.Match.homeScore} : {tip.Match.awayScore}
                                </Typography>
                                <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                                  Získané body: <strong>{tip.points}</strong>
                                </Typography>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
                    Zatiaľ nemáte žiadne tipy pre toto kolo.
                  </Typography>
                )
              ) : (
                <Box sx={{ textAlign: 'center', my: 4 }}>
                  <Typography variant="body1" paragraph>
                    Pre zobrazenie vašich tipov sa musíte prihlásiť.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    component={RouterLink}
                    to="/login"
                  >
                    Prihlásiť sa
                  </Button>
                </Box>
              )}
            </TabPanel>
            
            {/* Tab pre výsledky */}
            <TabPanel value={tabValue} index={2}>
              <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
                Výsledky pre toto kolo sa zobrazia tu po ukončení zápasov.
              </Typography>
            </TabPanel>
          </Paper>
        </Paper>
        
        {/* Dialóg pre úpravu kola */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Upraviť kolo</DialogTitle>
          <DialogContent>
            {editError && <Alert severity="error" sx={{ mb: 3 }}>{editError}</Alert>}
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label="Názov kola"
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
              label="Popis kola"
              name="description"
              value={editFormData.description}
              onChange={handleEditFormChange}
            />
            
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="Začiatok tipovania *"
                  value={editFormData.startDate}
                  onChange={(newValue) => handleDateChange('startDate', newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="Koniec tipovania *"
                  value={editFormData.endDate}
                  onChange={(newValue) => handleDateChange('endDate', newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal'
                    }
                  }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Zrušiť</Button>
            <Button 
              onClick={handleEditRound} 
              variant="contained" 
              disabled={editLoading}
            >
              {editLoading ? <CircularProgress size={24} /> : 'Uložiť zmeny'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Dialóg pre vymazanie kola */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Vymazať kolo</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Ste si istý, že chcete vymazať toto kolo? Táto akcia sa nedá vrátiť späť a všetky údaje o kole, vrátane zápasov a tipov budú natrvalo vymazané.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Zrušiť</Button>
            <Button 
              onClick={handleDeleteRound} 
              variant="contained" 
              color="error"
              disabled={deleteLoading}
            >
              {deleteLoading ? <CircularProgress size={24} /> : 'Vymazať'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  );
};

export default RoundDetail;
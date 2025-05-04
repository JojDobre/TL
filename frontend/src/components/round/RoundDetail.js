// frontend/src/components/round/RoundDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { 
  Container, Typography, Box, Paper, Button, Chip, Divider,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, TextField,
  Grid, MenuItem, FormControl, InputLabel, Select
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getRoundById, updateRound, deleteRound } from '../../services/roundService';
import { getAllMatches, updateMatch } from '../../services/matchService';
import { getUserTips } from '../../services/tipService';
import MatchCard from '../match/MatchCard';
import EvaluateMatchDialog from '../match/EvaluateMatch';
import HeroSection from '../layout/HeroSection';



const RoundDetail = () => {
  // Parameter z URL
  const { id } = useParams();
  
  // State pre detail kola
  const [round, setRound] = useState(null);
  const [matches, setMatches] = useState([]);
  const [userTips, setUserTips] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
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

// Vytvorenie subtitle pre hero sekciu
const getHeroSubtitle = () => {
  if (!round || !round.League || !round.League.Season) return '';
  
  const participantsCount = round.League.Season.participantsCount || 0;
  const inviteCode = round.League.Season.inviteCode || '000000';
  
  return `HRÁČI: ${participantsCount}/100 | ID: #${inviteCode}`;
};

  // Pridané state pre dialóg vyhodnotenia zápasu
const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);
const [selectedMatch, setSelectedMatch] = useState(null);
const [evaluateFormData, setEvaluateFormData] = useState({
  homeScore: '',
  awayScore: '',
  status: 'finished'
});
const [evaluateLoading, setEvaluateLoading] = useState(false);
const [evaluateError, setEvaluateError] = useState('');

// Handler pre otvorenie dialógu pre vyhodnotenie zápasu
const handleOpenEvaluateDialog = (match) => {
  setSelectedMatch(match);
  setEvaluateFormData({
    homeScore: match.homeScore !== null ? match.homeScore : '',
    awayScore: match.awayScore !== null ? match.awayScore : '',
    status: match.status || 'finished'
  });
  setEvaluateError('');
  setEvaluateDialogOpen(true);
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
          // Zoradenie zápasov podľa dátumu
          const sortedMatches = [...matchesResponse].sort((a, b) => 
            new Date(a.matchTime) - new Date(b.matchTime)
          );
          
          setMatches(sortedMatches);
        } else {
          console.log('No matches data in response');
          setMatches([]);
        }
      } catch (matchesError) {
        console.error('Error fetching matches:', matchesError);
        setMatches([]);
      }
      
      // Načítanie tipov pre kolo (ak je užívateľ prihlásený)
      if (isAuthenticated) {
        try {
          const tipsResponse = await getUserTips({ roundId: id });
          
          // Vytvorenie mapy tipov podľa matchId
          const tipsMap = {};
          tipsResponse.forEach(tip => {
            tipsMap[tip.matchId] = tip;
          });
          
          setUserTips(tipsMap);
        } catch (tipsError) {
          console.error('Error fetching tips:', tipsError);
        }
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

// Načítanie detailu kola a zápasov pri načítaní komponenty
useEffect(() => {
  fetchRoundDetail();
}, [id, isAuthenticated]);


// Handler pre zatvorenie dialógu pre vyhodnotenie zápasu
const handleCloseEvaluateDialog = () => {
  setEvaluateDialogOpen(false);
  setSelectedMatch(null);
};

// Handler pre zmenu inputov vo formulári vyhodnotenia
const handleEvaluateFormChange = (e) => {
  const { name, value } = e.target;
  setEvaluateFormData(prevData => ({
    ...prevData,
    [name]: name === 'homeScore' || name === 'awayScore' 
      ? value === '' ? '' : parseInt(value, 10) || 0
      : value
  }));
};

// Handler pre odoslanie formulára vyhodnotenia
const handleEvaluateMatch = async () => {
  if (!selectedMatch) return;
  
  // Validácia formulára
  if (evaluateFormData.homeScore === '' || evaluateFormData.awayScore === '') {
    setEvaluateError('Vyplňte skóre pre oba tímy.');
    return;
  }
  
  try {
    setEvaluateLoading(true);
    setEvaluateError('');
    
    // Aktualizácia zápasu
    const updatedMatch = await updateMatch(selectedMatch.id, {
      homeScore: evaluateFormData.homeScore,
      awayScore: evaluateFormData.awayScore,
      status: evaluateFormData.status
    });
    
    // Aktualizácia zápasu v zozname
    setMatches(prevMatches => 
      prevMatches.map(match => 
        match.id === updatedMatch.id ? updatedMatch : match
      )
    );
    
    // Zatvorenie dialógu
    handleCloseEvaluateDialog();
    
    // Opätovné načítanie zápasov po vyhodnotení (pre aktualizáciu tipov a bodov)
    // Táto časť je voliteľná, závisí od implementácie backendu
    fetchRoundDetail();
  } catch (err) {
    console.error('Chyba pri vyhodnotení zápasu:', err);
    setEvaluateError(err.response?.data?.message || 'Nepodarilo sa vyhodnotiť zápas. Skúste to znova neskôr.');
  } finally {
    setEvaluateLoading(false);
  }
};



  
  // Načítanie detailu kola a zápasov pri načítaní komponenty
  useEffect(() => {
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
              // Zoradenie zápasov podľa dátumu
              const sortedMatches = [...matchesResponse].sort((a, b) => 
                new Date(a.matchTime) - new Date(b.matchTime)
              );
              
              setMatches(sortedMatches);
            } else {
              console.log('No matches data in response');
              setMatches([]);
            }
          } catch (matchesError) {
            console.error('Error fetching matches:', matchesError);
            setMatches([]);
          }
          
          // Načítanie tipov pre kolo (ak je užívateľ prihlásený)
          if (isAuthenticated) {
            try {
              const tipsResponse = await getUserTips({ roundId: id });
              
              // Vytvorenie mapy tipov podľa matchId
              const tipsMap = {};
              tipsResponse.forEach(tip => {
                tipsMap[tip.matchId] = tip;
              });
              
              setUserTips(tipsMap);
            } catch (tipsError) {
              console.error('Error fetching tips:', tipsError);
            }
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
  }, [id, isAuthenticated]);
  
  // Handler pre zmenu tipu
  const handleTipChange = (matchId, newTip) => {
    setUserTips(prevTips => ({
      ...prevTips,
      [matchId]: {
        ...prevTips[matchId],
        ...newTip,
        matchId
      }
    }));
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
  
  // Kontrola, či je možné tipovať
  const canSubmitTips = () => {
    if (!round) return false;
    
    const now = new Date();
    const endDate = new Date(round.endDate);
    
    return now <= endDate && round.active;
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
  const roundClosed = !canSubmitTips();
  
  return (
    <>
    <HeroSection 
      title={round.League?.Season?.name || 'SEZÓNA'} 
      subtitle={getHeroSubtitle()}
      seasonType={round.League?.Season?.type || 'community'}
    />

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
<Grid container spacing={3} justifyContent="center">
  {matches.map((match) => (
    <Grid item key={match.id}>
      <MatchCard 
        match={match}
        userTip={userTips[match.id]}
        onTipChange={handleTipChange}
        roundClosed={roundClosed}
        hasEditPermission={hasEditPermission()}
        onEvaluateMatch={handleOpenEvaluateDialog}
      />
    </Grid>
  ))}
</Grid>
          )}
        </Paper>


        // Pridaný dialóg pre vyhodnotenie zápasu
<Dialog open={evaluateDialogOpen} onClose={handleCloseEvaluateDialog} maxWidth="sm" fullWidth>
  <DialogTitle>
    {selectedMatch?.status === 'finished' ? 'Upraviť výsledok' : 'Zadať výsledok'}
  </DialogTitle>
  <DialogContent>
    {evaluateError && <Alert severity="error" sx={{ mb: 3 }}>{evaluateError}</Alert>}
    
    {selectedMatch && (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {selectedMatch.homeTeam?.name || 'Domáci'} vs {selectedMatch.awayTeam?.name || 'Hostia'}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
          <TextField
            label="Skóre domácich"
            name="homeScore"
            type="number"
            InputProps={{ inputProps: { min: 0 } }}
            value={evaluateFormData.homeScore}
            onChange={handleEvaluateFormChange}
            size="small"
            sx={{ width: 120 }}
          />
          <Typography variant="h6" sx={{ mx: 2 }}>:</Typography>
          <TextField
            label="Skóre hostí"
            name="awayScore"
            type="number"
            InputProps={{ inputProps: { min: 0 } }}
            value={evaluateFormData.awayScore}
            onChange={handleEvaluateFormChange}
            size="small"
            sx={{ width: 120 }}
          />
        </Box>
        
        <FormControl fullWidth margin="normal">
          <InputLabel id="match-status-label">Stav zápasu</InputLabel>
          <Select
            labelId="match-status-label"
            name="status"
            value={evaluateFormData.status}
            onChange={handleEvaluateFormChange}
            label="Stav zápasu"
          >
            <MenuItem value="scheduled">Plánovaný</MenuItem>
            <MenuItem value="in_progress">Prebieha</MenuItem>
            <MenuItem value="finished">Ukončený</MenuItem>
            <MenuItem value="canceled">Zrušený</MenuItem>
          </Select>
        </FormControl>
      </Box>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={handleCloseEvaluateDialog}>Zrušiť</Button>
    <Button 
      onClick={handleEvaluateMatch} 
      variant="contained" 
      color="primary"
      disabled={evaluateLoading}
    >
      {evaluateLoading ? <CircularProgress size={24} /> : 'Uložiť výsledok'}
    </Button>
  </DialogActions>
</Dialog>


        
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
    </LocalizationProvider></>
  );
};

export default RoundDetail;
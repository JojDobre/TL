// frontend/src/components/match/CreateMatches.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Container, Typography, Box, TextField, Button, 
  FormControl, InputLabel, Select, MenuItem,
  Paper, CircularProgress, Alert, Divider,
  Grid, IconButton, Card, CardContent, TableContainer,
  Table, TableHead, TableBody, TableRow, TableCell
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { createMatch } from '../../services/matchService';
import { getRoundById } from '../../services/roundService';
import { getAllTeams } from '../../services/teamService';

const CreateMatches = () => {
  // Získanie query parametra roundId z URL, ak existuje
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const roundId = queryParams.get('roundId');
  
  // State pre kolo
  const [round, setRound] = useState(null);
  const [roundLoading, setRoundLoading] = useState(false);
  
  // State pre tímy
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  
  // State pre zápasy
  const [matches, setMatches] = useState([
    {
      homeTeamId: '',
      awayTeamId: '',
      matchTime: new Date(new Date().setHours(new Date().getHours() + 1)),
      tipType: 'exact_score'
    }
  ]);
  
  // State pre chyby a načítanie
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Hook pre navigáciu
  const navigate = useNavigate();
  
  // Hook pre autentifikáciu
  const { user } = useAuth();
  
  // Načítanie kola a tímov pri načítaní komponenty
  useEffect(() => {
    if (!roundId) {
      setError('Nie je špecifikované kolo, pre ktoré sa majú vytvoriť zápasy.');
      return;
    }
    
    const fetchData = async () => {
      try {
        // Načítanie detailu kola
        setRoundLoading(true);
        const roundData = await getRoundById(roundId);
        setRound(roundData);
        
        // Načítanie tímov
        setTeamsLoading(true);
        const teamsData = await getAllTeams();
        setTeams(teamsData);
      } catch (err) {
        console.error('Chyba pri načítavaní dát:', err);
        setError('Nepodarilo sa načítať potrebné dáta. Skúste to znova neskôr.');
      } finally {
        setRoundLoading(false);
        setTeamsLoading(false);
      }
    };
    
    fetchData();
  }, [roundId]);
  
  // Handler pre pridanie nového prázdneho zápasu
  const handleAddMatch = () => {
    setMatches([
      ...matches,
      {
        homeTeamId: '',
        awayTeamId: '',
        matchTime: new Date(new Date().setHours(new Date().getHours() + 1)),
        tipType: 'exact_score'
      }
    ]);
  };
  
  // Handler pre odstránenie zápasu
  const handleRemoveMatch = (index) => {
    setMatches(matches.filter((_, i) => i !== index));
  };
  
  // Handler pre zmenu hodnôt zápasu
  const handleMatchChange = (index, field, value) => {
    setMatches(matches.map((match, i) => {
      if (i === index) {
        return {
          ...match,
          [field]: value
        };
      }
      return match;
    }));
  };
  
  // Handler pre odoslanie formulára
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Kontrola, či sú zadané všetky povinné polia
    let hasError = false;
    matches.forEach((match, index) => {
      if (!match.homeTeamId || !match.awayTeamId || !match.matchTime) {
        setError(`Zápas #${index + 1} nemá vyplnené všetky povinné polia.`);
        hasError = true;
      }
      
      if (match.homeTeamId === match.awayTeamId) {
        setError(`Zápas #${index + 1} má rovnaký tím ako domáci aj hosťujúci.`);
        hasError = true;
      }
    });
    
    if (hasError) {
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Postupné vytvorenie všetkých zápasov
      for (const match of matches) {
        await createMatch({
          ...match,
          roundId
        });
      }
      
      setSuccess(`Bolo úspešne vytvorených ${matches.length} zápasov.`);
      
      // Reset formulára
      setMatches([
        {
          homeTeamId: '',
          awayTeamId: '',
          matchTime: new Date(new Date().setHours(new Date().getHours() + 1)),
          tipType: 'exact_score'
        }
      ]);
    } catch (err) {
      console.error('Chyba pri vytváraní zápasov:', err);
      setError(err.response?.data?.message || 'Nepodarilo sa vytvoriť zápasy. Skúste to znova neskôr.');
    } finally {
      setLoading(false);
    }
  };
  
  // Ak nie je špecifikované kolo, zobraziť chybu
  if (!roundId) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          {error || 'Nie je špecifikované kolo, pre ktoré sa majú vytvoriť zápasy.'}
        </Alert>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Späť
        </Button>
      </Container>
    );
  }
  
  // Zobrazenie loadingu, kým sa načítavajú dáta
  if (roundLoading || teamsLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="lg">
        <Paper elevation={3} sx={{ p: 4, my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Pridanie zápasov pre kolo
          </Typography>
          
          {round && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6">
                Kolo: {round.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Začiatok tipovania: {new Date(round.startDate).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Koniec tipovania: {new Date(round.endDate).toLocaleString()}
              </Typography>
            </Box>
          )}
          
          <Divider sx={{ mb: 4 }} />
          
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
          
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Domáci tím</TableCell>
                    <TableCell>Hosťujúci tím</TableCell>
                    <TableCell>Čas zápasu</TableCell>
                    <TableCell>Typ tipovania</TableCell>
                    <TableCell width="50px"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matches.map((match, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <InputLabel id={`home-team-label-${index}`}>Domáci tím</InputLabel>
                          <Select
                            labelId={`home-team-label-${index}`}
                            id={`home-team-${index}`}
                            value={match.homeTeamId}
                            onChange={(e) => handleMatchChange(index, 'homeTeamId', e.target.value)}
                            label="Domáci tím"
                            required
                          >
                            {teams.map((team) => (
                              <MenuItem key={team.id} value={team.id}>
                                {team.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <InputLabel id={`away-team-label-${index}`}>Hosťujúci tím</InputLabel>
                          <Select
                            labelId={`away-team-label-${index}`}
                            id={`away-team-${index}`}
                            value={match.awayTeamId}
                            onChange={(e) => handleMatchChange(index, 'awayTeamId', e.target.value)}
                            label="Hosťujúci tím"
                            required
                          >
                            {teams.map((team) => (
                              <MenuItem key={team.id} value={team.id}>
                                {team.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <DateTimePicker
                          label="Čas zápasu"
                          value={match.matchTime}
                          onChange={(newValue) => handleMatchChange(index, 'matchTime', newValue)}
                          slotProps={{
                            textField: {
                              size: 'small',
                              fullWidth: true,
                              required: true
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <InputLabel id={`tip-type-label-${index}`}>Typ tipovania</InputLabel>
                          <Select
                            labelId={`tip-type-label-${index}`}
                            id={`tip-type-${index}`}
                            value={match.tipType}
                            onChange={(e) => handleMatchChange(index, 'tipType', e.target.value)}
                            label="Typ tipovania"
                          >
                            <MenuItem value="exact_score">Presný výsledok</MenuItem>
                            <MenuItem value="winner">Len víťaz</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell align="center">
                        {matches.length > 1 && (
                          <IconButton 
                            color="error"
                            onClick={() => handleRemoveMatch(index)}
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddMatch}
              >
                Pridať ďalší zápas
              </Button>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                onClick={() => navigate(-1)}
              >
                Zrušiť
              </Button>
              
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Vytvoriť zápasy'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default CreateMatches;
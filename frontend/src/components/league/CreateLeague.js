// frontend/src/components/league/CreateLeague.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Container, Typography, Box, TextField, Button, 
  FormControl, InputLabel, Select, MenuItem,
  Paper, CircularProgress, Alert, Divider,
  Grid, InputAdornment
} from '@mui/material';
import { createLeague } from '../../services/leagueService';
import { getAllSeasons } from '../../services/seasonService';

const CreateLeague = () => {
  // Získanie query parametra seasonId z URL, ak existuje
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preselectedSeasonId = queryParams.get('seasonId');
  
  // State pre formulár
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    type: 'custom',
    password: '',
    seasonId: preselectedSeasonId || '',
    scoringSystem: {
      exactScore: 10,
      correctGoals: 1,
      correctWinner: 3,
      goalDifference: 2
    }
  });
  
  // State pre sezóny
  const [seasons, setSeasons] = useState([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  
  // State pre chyby a načítanie
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  
  // Hook pre navigáciu
  const navigate = useNavigate();
  
  // Načítanie sezón pri načítaní komponenty
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        setSeasonsLoading(true);
        const seasonsData = await getAllSeasons();
        setSeasons(seasonsData);
      } catch (err) {
        console.error('Chyba pri načítavaní sezón:', err);
        setError('Nepodarilo sa načítať zoznam sezón. Skúste to znova neskôr.');
      } finally {
        setSeasonsLoading(false);
      }
    };
    
    fetchSeasons();
  }, []);
  
  // Handler pre zmenu inputov
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('scoringSystem.')) {
      // Pre bodovací systém
      const scoringField = name.split('.')[1];
      setFormData(prevData => ({
        ...prevData,
        scoringSystem: {
          ...prevData.scoringSystem,
          [scoringField]: parseInt(value, 10) || 0
        }
      }));
    } else {
      // Pre ostatné polia
      setFormData(prevData => ({
        ...prevData,
        [name]: value
      }));
    }
    
    // Vymazanie chyby pri zmene
    if (formErrors[name]) {
      setFormErrors(prevErrors => ({
        ...prevErrors,
        [name]: ''
      }));
    }
  };
  
  // Validácia formulára
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Názov ligy je povinný.';
    }
    
    if (!formData.seasonId) {
      errors.seasonId = 'Výber sezóny je povinný.';
    }
    
    if (formData.image && !/^(http|https):\/\/[^ "]+$/.test(formData.image)) {
      errors.image = 'Zadajte platnú URL adresu obrázka.';
    }
    
    setFormErrors(errors);
    
    return Object.keys(errors).length === 0;
  };
  
  // Handler pre odoslanie formulára
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validácia formulára
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Vytvorenie novej ligy
      const newLeague = await createLeague(formData);
      
      // Presmerovanie na detail vytvorenej ligy
      navigate(`/leagues/${newLeague.id}`);
    } catch (err) {
      console.error('Chyba pri vytváraní ligy:', err);
      setError(err.response?.data?.message || 'Nepodarilo sa vytvoriť ligu. Skúste to znova neskôr.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Vytvoriť novú ligu
        </Typography>
        
        <Divider sx={{ mb: 4 }} />
        
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label="Názov ligy"
            name="name"
            autoFocus
            value={formData.name}
            onChange={handleChange}
            error={!!formErrors.name}
            helperText={formErrors.name}
          />
          
          <TextField
            margin="normal"
            fullWidth
            multiline
            rows={3}
            id="description"
            label="Popis ligy"
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
          
          <TextField
            margin="normal"
            fullWidth
            id="image"
            label="URL obrázka ligy"
            name="image"
            placeholder="https://example.com/image.jpg"
            value={formData.image}
            onChange={handleChange}
            error={!!formErrors.image}
            helperText={formErrors.image}
          />
          
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="seasonId-label">Sezóna</InputLabel>
            <Select
              labelId="seasonId-label"
              id="seasonId"
              name="seasonId"
              value={formData.seasonId}
              onChange={handleChange}
              label="Sezóna"
              disabled={seasonsLoading || !!preselectedSeasonId}
              error={!!formErrors.seasonId}
            >
              {seasons.map((season) => (
                <MenuItem key={season.id} value={season.id}>
                  {season.name}
                </MenuItem>
              ))}
            </Select>
            {formErrors.seasonId && (
              <Typography color="error" variant="caption">
                {formErrors.seasonId}
              </Typography>
            )}
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="type-label">Typ ligy</InputLabel>
            <Select
              labelId="type-label"
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              label="Typ ligy"
            >
              <MenuItem value="custom">Vlastná</MenuItem>
              <MenuItem value="official" disabled>Oficiálna (len pre administrátorov)</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            margin="normal"
            fullWidth
            id="password"
            label="Heslo pre ligu (voliteľné)"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            helperText="Nechajte prázdne, ak nechcete chrániť ligu heslom."
          />
          
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
                  startAdornment: <InputAdornment position="start">+</InputAdornment>,
                }}
                value={formData.scoringSystem.exactScore}
                onChange={handleChange}
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
                  startAdornment: <InputAdornment position="start">+</InputAdornment>,
                }}
                value={formData.scoringSystem.correctWinner}
                onChange={handleChange}
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
                  startAdornment: <InputAdornment position="start">+</InputAdornment>,
                }}
                value={formData.scoringSystem.correctGoals}
                onChange={handleChange}
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
                  startAdornment: <InputAdornment position="start">+</InputAdornment>,
                }}
                value={formData.scoringSystem.goalDifference}
                onChange={handleChange}
              />
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
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
              {loading ? <CircularProgress size={24} /> : 'Vytvoriť ligu'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default CreateLeague;
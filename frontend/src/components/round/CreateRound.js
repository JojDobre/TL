// frontend/src/components/round/CreateRound.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Container, Typography, Box, TextField, Button, 
  FormControl, InputLabel, Select, MenuItem,
  Paper, CircularProgress, Alert, Divider,
  Grid
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createRound } from '../../services/roundService';
import { getAllLeagues } from '../../services/leagueService';

const CreateRound = () => {
  // Získanie query parametra leagueId z URL, ak existuje
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preselectedLeagueId = queryParams.get('leagueId');
  
  // State pre formulár
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leagueId: preselectedLeagueId || '',
    startDate: new Date(new Date().setHours(new Date().getHours() + 1)),
    endDate: new Date(new Date().setHours(new Date().getHours() + 24))
  });
  
  // State pre ligy
  const [leagues, setLeagues] = useState([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  
  // State pre chyby a načítanie
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  
  // Hook pre navigáciu
  const navigate = useNavigate();
  
  // Načítanie líg pri načítaní komponenty
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        setLeaguesLoading(true);
        const leaguesData = await getAllLeagues();
        setLeagues(leaguesData);
      } catch (err) {
        console.error('Chyba pri načítavaní líg:', err);
        setError('Nepodarilo sa načítať zoznam líg. Skúste to znova neskôr.');
      } finally {
        setLeaguesLoading(false);
      }
    };
    
    fetchLeagues();
  }, []);
  
  // Handler pre zmenu inputov
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
    
    // Vymazanie chyby pri zmene
    if (formErrors[name]) {
      setFormErrors(prevErrors => ({
        ...prevErrors,
        [name]: ''
      }));
    }
  };
  
  // Handler pre zmenu dátumov
  const handleDateChange = (name, date) => {
    setFormData(prevData => ({
      ...prevData,
      [name]: date
    }));
    
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
      errors.name = 'Názov kola je povinný.';
    }
    
    if (!formData.leagueId) {
      errors.leagueId = 'Výber ligy je povinný.';
    }
    
    if (!formData.startDate) {
      errors.startDate = 'Dátum začiatku je povinný.';
    }
    
    if (!formData.endDate) {
      errors.endDate = 'Dátum konca je povinný.';
    }
    
    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      errors.endDate = 'Dátum konca musí byť po dátume začiatku.';
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
      
      // Vytvorenie nového kola
      const newRound = await createRound(formData);
      
      // Presmerovanie na detail vytvoreného kola
      navigate(`/rounds/${newRound.id}`);
    } catch (err) {
      console.error('Chyba pri vytváraní kola:', err);
      setError(err.response?.data?.message || 'Nepodarilo sa vytvoriť kolo. Skúste to znova neskôr.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: 4, my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Vytvoriť nové kolo
          </Typography>
          
          <Divider sx={{ mb: 4 }} />
          
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label="Názov kola"
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
              label="Popis kola"
              name="description"
              value={formData.description}
              onChange={handleChange}
            />
            
            <FormControl fullWidth margin="normal" required>
              <InputLabel id="leagueId-label">Liga</InputLabel>
              <Select
                labelId="leagueId-label"
                id="leagueId"
                name="leagueId"
                value={formData.leagueId}
                onChange={handleChange}
                label="Liga"
                disabled={leaguesLoading || !!preselectedLeagueId}
                error={!!formErrors.leagueId}
              >
                {leagues.map((league) => (
                  <MenuItem key={league.id} value={league.id}>
                    {league.name}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.leagueId && (
                <Typography color="error" variant="caption">
                  {formErrors.leagueId}
                </Typography>
              )}
            </FormControl>
            
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="Začiatok tipovania *"
                  value={formData.startDate}
                  onChange={(newValue) => handleDateChange('startDate', newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal',
                      error: !!formErrors.startDate,
                      helperText: formErrors.startDate
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="Koniec tipovania *"
                  value={formData.endDate}
                  onChange={(newValue) => handleDateChange('endDate', newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal',
                      error: !!formErrors.endDate,
                      helperText: formErrors.endDate
                    }
                  }}
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
                {loading ? <CircularProgress size={24} /> : 'Vytvoriť kolo'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default CreateRound;
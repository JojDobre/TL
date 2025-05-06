// frontend/src/components/match/MatchResultForm.js
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  CircularProgress,
  Alert 
} from '@mui/material';
import { updateMatch } from '../../services/matchService';

const MatchResultForm = ({ match, onUpdate }) => {
  // State pre formulár
  const [formData, setFormData] = useState({
    homeScore: match.homeScore !== null ? match.homeScore : '',
    awayScore: match.awayScore !== null ? match.awayScore : '',
    status: match.status || 'scheduled'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Handler pre zmenu inputov
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Pre skóre akceptujme len čísla
    if ((name === 'homeScore' || name === 'awayScore') && value !== '') {
      const numberValue = parseInt(value, 10);
      if (isNaN(numberValue) || numberValue < 0) {
        return;
      }
    }
    
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };
  
  // Handler pre odoslanie formulára
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validácia formulára
    if (formData.status === 'finished' && (formData.homeScore === '' || formData.awayScore === '')) {
      setError('Pre ukončený zápas musíte zadať výsledok.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Príprava údajov na odoslanie
      const matchData = {
        ...formData,
        homeScore: formData.homeScore !== '' ? parseInt(formData.homeScore, 10) : null,
        awayScore: formData.awayScore !== '' ? parseInt(formData.awayScore, 10) : null
      };
      
      // Aktualizácia zápasu
      const updatedMatch = await updateMatch(match.id, matchData);
      
      setSuccess('Výsledok zápasu bol úspešne aktualizovaný.');
      
      // Volanie callback funkcie
      if (onUpdate) {
        onUpdate(updatedMatch);
      }
      
      // Po 3 sekundách skryjeme hlášku o úspechu
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Chyba pri aktualizácii zápasu:', err);
      setError(err.response?.data?.message || 'Chyba pri aktualizácii zápasu.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Aktualizácia výsledku
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <TextField
          type="number"
          name="homeScore"
          label="Skóre domácich"
          value={formData.homeScore}
          onChange={handleChange}
          size="small"
          InputProps={{ inputProps: { min: 0 } }}
          sx={{ width: 120, mr: 2 }}
        />
        
        <Typography variant="h6" sx={{ mx: 2 }}>:</Typography>
        
        <TextField
          type="number"
          name="awayScore"
          label="Skóre hostí"
          value={formData.awayScore}
          onChange={handleChange}
          size="small"
          InputProps={{ inputProps: { min: 0 } }}
          sx={{ width: 120, ml: 2 }}
        />
      </Box>
      
      <FormControl size="small" sx={{ mb: 2, width: 200 }}>
        <InputLabel id="status-label">Stav zápasu</InputLabel>
        <Select
          labelId="status-label"
          name="status"
          value={formData.status}
          onChange={handleChange}
          label="Stav zápasu"
        >
          <MenuItem value="scheduled">Plánovaný</MenuItem>
          <MenuItem value="in_progress">Prebieha</MenuItem>
          <MenuItem value="finished">Ukončený</MenuItem>
          <MenuItem value="canceled">Zrušený</MenuItem>
        </Select>
      </FormControl>
      
      <Box>
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          size="small"
        >
          {loading ? <CircularProgress size={24} /> : 'Uložiť výsledok'}
        </Button>
      </Box>
    </Box>
  );
};

export default MatchResultForm;
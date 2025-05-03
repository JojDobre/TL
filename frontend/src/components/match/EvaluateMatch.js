// frontend/src/components/match/EvaluateMatch.js
import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, FormControl, InputLabel, 
  Select, MenuItem, Box, Typography, CircularProgress,
  Alert, Grid
} from '@mui/material';
import { evaluateMatch } from '../../services/matchService';

const EvaluateMatchDialog = ({ open, onClose, match, onSuccess }) => {
  // State pre formulár
  const [formData, setFormData] = useState({
    homeScore: match?.homeScore !== undefined ? match.homeScore : 0,
    awayScore: match?.awayScore !== undefined ? match.awayScore : 0,
    status: match?.status || 'finished'
  });
  
  // State pre loading a chyby
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Handler pre zmenu inputov
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: name === 'homeScore' || name === 'awayScore' ? parseInt(value) : value
    }));
  };
  
  // Handler pre odoslanie formulára
  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Volanie API pre vyhodnotenie zápasu
      await evaluateMatch(match.id, formData);
      
      // Zatvorenie dialógu a volanie callback funkcie
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Chyba pri vyhodnotení zápasu:', err);
      setError(err.response?.data?.message || 'Nepodarilo sa vyhodnotiť zápas.');
    } finally {
      setLoading(false);
    }
  };
  
  if (!match) {
    return null;
  }
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Vyhodnotenie zápasu</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={5}>
              <Typography variant="body1" align="center">
                {match.homeTeam?.name || 'Domáci tím'}
              </Typography>
              {match.homeTeam?.logo && (
                <Box
                  component="img"
                  src={match.homeTeam.logo}
                  alt={match.homeTeam.name}
                  sx={{ width: 60, height: 60, display: 'block', mx: 'auto', my: 1 }}
                />
              )}
            </Grid>
            <Grid item xs={2}>
              <Typography variant="h6" align="center">vs</Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body1" align="center">
                {match.awayTeam?.name || 'Hosťujúci tím'}
              </Typography>
              {match.awayTeam?.logo && (
                <Box
                  component="img"
                  src={match.awayTeam.logo}
                  alt={match.awayTeam.name}
                  sx={{ width: 60, height: 60, display: 'block', mx: 'auto', my: 1 }}
                />
              )}
            </Grid>
          </Grid>
        </Box>
        
        <Box sx={{ mt: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={5}>
              <TextField
                fullWidth
                label="Skóre domácich"
                name="homeScore"
                type="number"
                value={formData.homeScore}
                onChange={handleChange}
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>
            <Grid item xs={2}>
              <Typography variant="h5" align="center">:</Typography>
            </Grid>
            <Grid item xs={5}>
              <TextField
                fullWidth
                label="Skóre hostí"
                name="awayScore"
                type="number"
                value={formData.awayScore}
                onChange={handleChange}
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>
          </Grid>
        </Box>
        
        <FormControl fullWidth sx={{ mt: 3 }}>
          <InputLabel id="status-label">Stav zápasu</InputLabel>
          <Select
            labelId="status-label"
            id="status"
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
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Po vyhodnotení zápasu ako ukončeného (status "Ukončený") sa automaticky vypočítajú body za tipy používateľov.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušiť</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Vyhodnotiť zápas'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EvaluateMatchDialog;
// frontend/src/components/season/CreateSeason.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Box, TextField, Button, 
  FormControl, InputLabel, Select, MenuItem,
  Paper, CircularProgress, Alert, Divider
} from '@mui/material';
import { createSeason } from '../../services/seasonService';

const CreateSeason = () => {
  // State pre formulár
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    type: 'community',
    rules: ''
  });
  
  // State pre chyby a načítanie
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  
  // Hook pre navigáciu
  const navigate = useNavigate();
  
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
  
  // Validácia formulára
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Názov sezóny je povinný.';
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
      
      // Vytvorenie novej sezóny
      const newSeason = await createSeason(formData);
      
      // Presmerovanie na detail vytvorenej sezóny
      navigate(`/seasons/${newSeason.id}`);
    } catch (err) {
      console.error('Chyba pri vytváraní sezóny:', err);
      setError(err.response?.data?.message || 'Nepodarilo sa vytvoriť sezónu. Skúste to znova neskôr.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Vytvoriť novú sezónu
        </Typography>
        
        <Divider sx={{ mb: 4 }} />
        
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label="Názov sezóny"
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
            label="Popis sezóny"
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
          
          <TextField
            margin="normal"
            fullWidth
            id="image"
            label="URL obrázka sezóny"
            name="image"
            placeholder="https://example.com/image.jpg"
            value={formData.image}
            onChange={handleChange}
            error={!!formErrors.image}
            helperText={formErrors.image}
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="type-label">Typ sezóny</InputLabel>
            <Select
              labelId="type-label"
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              label="Typ sezóny"
            >
              <MenuItem value="community">Komunitná</MenuItem>
              <MenuItem value="official" disabled>Oficiálna (len pre administrátorov)</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            margin="normal"
            fullWidth
            multiline
            rows={4}
            id="rules"
            label="Pravidlá sezóny"
            name="rules"
            value={formData.rules}
            onChange={handleChange}
          />
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/seasons')}
            >
              Zrušiť
            </Button>
            
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Vytvoriť sezónu'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default CreateSeason;
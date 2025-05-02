// frontend/src/components/auth/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Container, TextField, Button, Typography, 
  Box, Paper, CircularProgress, Alert 
} from '@mui/material';

const Login = () => {
  // State pre formulár
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Hook pre navigáciu a autentifikáciu
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Handler pre odoslanie formulára
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validácia formulára
    if (!email || !password) {
      setError('Prosím, vyplňte všetky polia.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Volanie funkcie pre prihlásenie z AuthContext
      const result = await login(email, password);
      
      if (result.success) {
        // Presmerovanie na domovskú stránku po úspešnom prihlásení
        navigate('/');
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Chyba pri prihlásení. Skúste to znova.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Prihlásenie
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Heslo"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Prihlásiť sa'}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2">
                Nemáte účet?{' '}
                <Link to="/register">
                  Registrovať sa
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
// frontend/src/components/auth/Register.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Container, TextField, Button, Typography, 
  Box, Paper, CircularProgress, Alert 
} from '@mui/material';

const Register = () => {
  // State pre formulár
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Hook pre navigáciu a autentifikáciu
  const navigate = useNavigate();
  const { register } = useAuth();
  
  // Handler pre zmenu inputov
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };
  
  // Handler pre odoslanie formulára
  const handleSubmit = async (e) => {
    e.preventDefault();
   
   // Validácia formulára
   if (!formData.username || !formData.email || !formData.password) {
     setError('Prosím, vyplňte všetky povinné polia.');
     return;
   }
   
   if (formData.password !== formData.confirmPassword) {
     setError('Heslá sa nezhodujú.');
     return;
   }
   
   try {
     setLoading(true);
     setError('');
     
     // Volanie funkcie pre registráciu z AuthContext
     const result = await register({
       username: formData.username,
       email: formData.email,
       password: formData.password,
       firstName: formData.firstName,
       lastName: formData.lastName
     });
     
     if (result.success) {
       // Presmerovanie na domovskú stránku po úspešnej registrácii
       navigate('/');
     } else {
       setError(result.message);
     }
   } catch (err) {
     setError('Chyba pri registrácii. Skúste to znova.');
   } finally {
     setLoading(false);
   }
 };
 
 return (
   <Container maxWidth="sm">
     <Box sx={{ mt: 8, mb: 4 }}>
       <Paper elevation={3} sx={{ p: 4 }}>
         <Typography variant="h4" component="h1" align="center" gutterBottom>
           Registrácia
         </Typography>
         
         {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
         
         <Box component="form" onSubmit={handleSubmit} noValidate>
           <TextField
             margin="normal"
             required
             fullWidth
             id="username"
             label="Používateľské meno"
             name="username"
             autoComplete="username"
             autoFocus
             value={formData.username}
             onChange={handleChange}
           />
           <TextField
             margin="normal"
             required
             fullWidth
             id="email"
             label="Email"
             name="email"
             autoComplete="email"
             value={formData.email}
             onChange={handleChange}
           />
           <TextField
             margin="normal"
             required
             fullWidth
             name="password"
             label="Heslo"
             type="password"
             id="password"
             autoComplete="new-password"
             value={formData.password}
             onChange={handleChange}
           />
           <TextField
             margin="normal"
             required
             fullWidth
             name="confirmPassword"
             label="Potvrďte heslo"
             type="password"
             id="confirmPassword"
             autoComplete="new-password"
             value={formData.confirmPassword}
             onChange={handleChange}
           />
           <TextField
             margin="normal"
             fullWidth
             name="firstName"
             label="Meno"
             id="firstName"
             autoComplete="given-name"
             value={formData.firstName}
             onChange={handleChange}
           />
           <TextField
             margin="normal"
             fullWidth
             name="lastName"
             label="Priezvisko"
             id="lastName"
             autoComplete="family-name"
             value={formData.lastName}
             onChange={handleChange}
           />
           <Button
             type="submit"
             fullWidth
             variant="contained"
             sx={{ mt: 3, mb: 2 }}
             disabled={loading}
           >
             {loading ? <CircularProgress size={24} /> : 'Registrovať sa'}
           </Button>
           <Box sx={{ textAlign: 'center' }}>
             <Typography variant="body2">
               Už máte účet?{' '}
               <Link to="/login">
                 Prihlásiť sa
               </Link>
             </Typography>
           </Box>
         </Box>
       </Paper>
     </Box>
   </Container>
 );
};

export default Register;
// frontend/src/components/auth/Profile.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Container, TextField, Button, Typography, 
  Box, Paper, CircularProgress, Alert, Tabs, Tab
} from '@mui/material';

// TabPanel komponent pre zobrazenie obsahu tabu
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
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

const Profile = () => {
  // State pre záložky
  const [tabValue, setTabValue] = useState(0);
  
  // State pre údaje profilu
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    profileImage: ''
  });
  
  // State pre zmenu hesla
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // State pre chyby a načítanie
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Hook pre autentifikáciu
  const { user, updateProfile, changePassword } = useAuth();
  
  // Inicializácia údajov profilu z používateľa
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        bio: user.bio || '',
        profileImage: user.profileImage || ''
      });
    }
  }, [user]);
  
  // Handler pre zmenu záložky
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handler pre zmenu údajov profilu
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };
  
  // Handler pre zmenu údajov hesla
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };
  
  // Handler pre aktualizáciu profilu
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setProfileLoading(true);
      setProfileError('');
      setProfileSuccess('');
      
      // Volanie funkcie pre aktualizáciu profilu z AuthContext
      const result = await updateProfile(profileData);
      
      if (result.success) {
        setProfileSuccess('Profil bol úspešne aktualizovaný.');
      } else {
        setProfileError(result.message);
      }
    } catch (err) {
      setProfileError('Chyba pri aktualizácii profilu. Skúste to znova.');
    } finally {
      setProfileLoading(false);
    }
  };
  
  // Handler pre zmenu hesla
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    // Validácia hesiel
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Nové heslá sa nezhodujú.');
      return;
    }
    
    try {
      setPasswordLoading(true);
      setPasswordError('');
      setPasswordSuccess('');
      
      // Volanie funkcie pre zmenu hesla z AuthContext
      const result = await changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      
      if (result.success) {
        setPasswordSuccess('Heslo bolo úspešne zmenené.');
        // Resetovanie formulára
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setPasswordError(result.message);
      }
    } catch (err) {
      setPasswordError('Chyba pri zmene hesla. Skúste to znova.');
    } finally {
      setPasswordLoading(false);
    }
  };
  
  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="profile tabs">
              <Tab label="Profil" id="profile-tab-0" />
              <Tab label="Zmena hesla" id="profile-tab-1" />
            </Tabs>
          </Box>
          
          {/* Profil tab */}
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h5" component="h2" gutterBottom>
              Aktualizácia profilu
            </Typography>
            
            {profileError && <Alert severity="error" sx={{ mb: 2 }}>{profileError}</Alert>}
            {profileSuccess && <Alert severity="success" sx={{ mb: 2 }}>{profileSuccess}</Alert>}
            
            <Box component="form" onSubmit={handleProfileSubmit} noValidate>
              <TextField
                margin="normal"
                fullWidth
                name="firstName"
                label="Meno"
                id="firstName"
                value={profileData.firstName}
                onChange={handleProfileChange}
              />
              <TextField
                margin="normal"
                fullWidth
                name="lastName"
                label="Priezvisko"
                id="lastName"
                value={profileData.lastName}
                onChange={handleProfileChange}
              />
              <TextField
                margin="normal"
                fullWidth
                name="bio"
                label="O mne"
                id="bio"
                multiline
                rows={4}
                value={profileData.bio}
                onChange={handleProfileChange}
              />
              <TextField
                margin="normal"
                fullWidth
                name="profileImage"
                label="URL profilového obrázka"
                id="profileImage"
                value={profileData.profileImage}
                onChange={handleProfileChange}
              />
              <Button
                type="submit"
                variant="contained"
                sx={{ mt: 3 }}
                disabled={profileLoading}
              >
                {profileLoading ? <CircularProgress size={24} /> : 'Aktualizovať profil'}
              </Button>
            </Box>
          </TabPanel>
          
          {/* Zmena hesla tab */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h5" component="h2" gutterBottom>
              Zmena hesla
            </Typography>
            
            {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}
            {passwordSuccess && <Alert severity="success" sx={{ mb: 2 }}>{passwordSuccess}</Alert>}
            
            <Box component="form" onSubmit={handlePasswordSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                name="currentPassword"
                label="Aktuálne heslo"
                type="password"
                id="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="newPassword"
                label="Nové heslo"
                type="password"
                id="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Potvrďte nové heslo"
                type="password"
                id="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
              />
              <Button
                type="submit"
                variant="contained"
                sx={{ mt: 3 }}
                disabled={passwordLoading}
              >
                {passwordLoading ? <CircularProgress size={24} /> : 'Zmeniť heslo'}
              </Button>
            </Box>
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
};

export default Profile;
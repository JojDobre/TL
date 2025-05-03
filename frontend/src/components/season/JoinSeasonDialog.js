// frontend/src/components/season/JoinSeasonDialog.js
// Nový komponent pre pripojenie k sezóne

import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, TextField, Button, CircularProgress, Alert
} from '@mui/material';
import { joinSeason } from '../../services/seasonService';

const JoinSeasonDialog = ({ open, onClose, onSuccess, initialCode = '' }) => {
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  
  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Prosím, zadajte kód pre pripojenie.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      await joinSeason(inviteCode, requiresPassword ? password : null);
      
      // Resetovanie stavu
      setInviteCode('');
      setPassword('');
      setRequiresPassword(false);
      
      // Zatvorenie dialógu a notifikácia o úspechu
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Chyba pri pripájaní k sezóne:', err);
      
      // Ak sezóna vyžaduje heslo
      if (err.response?.data?.requiresPassword) {
        setRequiresPassword(true);
        setError('Táto sezóna je chránená heslom. Prosím, zadajte heslo.');
      } else {
        setError(err.response?.data?.message || 'Nepodarilo sa pripojiť k sezóne. Skontrolujte kód a skúste to znova.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Pripojiť sa ku sezóne</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {requiresPassword 
            ? 'Táto sezóna je chránená heslom. Prosím, zadajte heslo.'
            : 'Zadajte kód pre pripojenie k sezóne.'}
        </DialogContentText>
        
        {error && <Alert severity="error" sx={{ mt: 2, mb: 2 }}>{error}</Alert>}
        
        {!requiresPassword ? (
          <TextField
            autoFocus
            margin="dense"
            label="Kód pre pripojenie"
            fullWidth
            variant="outlined"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
        ) : (
          <TextField
            autoFocus
            margin="dense"
            label="Heslo"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušiť</Button>
        <Button 
          onClick={handleJoin} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Pripojiť'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default JoinSeasonDialog;
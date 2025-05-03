// frontend/src/components/match/MatchCard.js
import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, 
  TextField, Button, Chip
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { createOrUpdateTip } from '../../services/tipService';
import { Link as RouterLink } from 'react-router-dom';

// Komponent pre kartu zápasu
const MatchCard = ({ 
  match, 
  userTip, 
  onTipChange, 
  roundClosed, 
  hasEditPermission, 
  onEvaluateMatch 
}) => {
  // State pre tip
  const [tip, setTip] = useState({
    homeScore: userTip?.homeScore !== undefined ? userTip.homeScore : '',
    awayScore: userTip?.awayScore !== undefined ? userTip.awayScore : '',
    winner: userTip?.winner || ''
  });
  
  // State pre ukladanie tipu
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Hook pre autentifikáciu
  const { isAuthenticated } = useAuth();
  
  // Aktualizácia stavu tipu, keď sa zmení userTip prop
  useEffect(() => {
    if (userTip) {
      setTip({
        homeScore: userTip.homeScore !== undefined ? userTip.homeScore : '',
        awayScore: userTip.awayScore !== undefined ? userTip.awayScore : '',
        winner: userTip.winner || ''
      });
    }
  }, [userTip]);

  // Handler pre zmenu hodnoty tipu
  const handleTipChange = async (field, value) => {
    // Aktualizácia lokálneho stavu
    const newTip = { ...tip, [field]: value };
    
    // Ak sa zmení homeScore alebo awayScore, určíme víťaza
    if (field === 'homeScore' || field === 'awayScore') {
      const homeScore = field === 'homeScore' ? value : tip.homeScore;
      const awayScore = field === 'awayScore' ? value : tip.awayScore;
      
      if (homeScore !== '' && awayScore !== '') {
        if (parseInt(homeScore) > parseInt(awayScore)) {
          newTip.winner = 'home';
        } else if (parseInt(homeScore) < parseInt(awayScore)) {
          newTip.winner = 'away';
        } else {
          newTip.winner = 'draw';
        }
      }
    }
    
    setTip(newTip);
    
    // Notifikácia o zmene tipu
    if (onTipChange) {
      onTipChange(match.id, newTip);
    }
    
    // Uloženie tipu na server
    try {
      setSaving(true);
      setSaveError(null);
      
      // Vytvorenie objektu s údajmi tipu
      const tipData = {
        matchId: match.id
      };
      
      // Pridanie údajov podľa typu tipovania
      if (match.tipType === 'exact_score') {
        tipData.homeScore = newTip.homeScore === '' ? null : parseInt(newTip.homeScore);
        tipData.awayScore = newTip.awayScore === '' ? null : parseInt(newTip.awayScore);
      } else {
        tipData.winner = newTip.winner;
      }
      
      // Odoslanie tipu na server
      await createOrUpdateTip(tipData);
      
      // Nastavenie úspechu
      setSaveSuccess(true);
      
      // Po 2 sekundách skryjeme hlášku o úspechu
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Chyba pri ukladaní tipu:', err);
      setSaveError(err.response?.data?.message || 'Chyba pri ukladaní tipu.');
    } finally {
      setSaving(false);
    }
  };

  // Určenie, či je možné tipovať
  const canTip = isAuthenticated && !roundClosed && match.status === 'scheduled';
  
  // Určenie, či je zápas vyhodnotený
  const isEvaluated = match.status === 'finished' && match.homeScore !== null && match.awayScore !== null;
  
  // Získanie správneho víťaza na základe výsledku
  const getMatchWinner = () => {
    if (!isEvaluated) return null;
    
    if (match.homeScore > match.awayScore) return 'home';
    if (match.homeScore < match.awayScore) return 'away';
    return 'draw';
  };
  
  // Určenie stavu tlačidla pre typ víťaza
  const getWinnerButtonStyle = (option) => {
    const matchWinner = getMatchWinner();
    
    // Pre nevyhodnotený zápas
    if (!isEvaluated) {
      if (tip.winner === option) {
        return {
          border: '2px solid black',
          backgroundColor: 'transparent',
          color: '#000'
        };
      }
      return {
        border: '1px solid #ddd',
        backgroundColor: 'transparent',
        color: '#000'
      };
    } 
    
    // Pre vyhodnotený zápas
    if (matchWinner === option) {
      // Správna odpoveď (zelené pozadie)
      if (userTip?.winner === option) {
        // Správny tip používateľa (zelený okraj)
        return {
          border: '2px solid #4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          color: '#000'
        };
      }
      // Používateľ netipoval túto možnosť, ale je správna
      return {
        border: '1px solid #4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        color: '#000'
      };
    } else if (userTip?.winner === option) {
      // Nesprávny tip používateľa (červený okraj)
      return {
        border: '2px solid #F44336',
        backgroundColor: 'transparent',
        color: '#000'
      };
    }
    
    // Ostatné možnosti
    return {
      border: '1px solid #ddd',
      backgroundColor: 'transparent',
      color: '#000'
    };
  };
  
  const getExactScoreInputStyle = (isHome) => {
    const field = isHome ? 'homeScore' : 'awayScore';
    const matchScore = isHome ? match.homeScore : match.awayScore;
    
    if (!isEvaluated) {
      return {
        width: 60,
        height: 40,
        border: tip[field] !== '' ? '2px solid black' : '1px solid #ddd',
        borderRadius: '4px',
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
      };
    }
    
    if (userTip && userTip[field] === matchScore) {
      // Správny tip
      return {
        width: 60,
        height: 40,
        border: '2px solid #4CAF50',
        borderRadius: '4px',
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
      };
    } else {
      // Nesprávny tip
      return {
        width: 60,
        height: 40,
        border: '2px solid #F44336',
        borderRadius: '4px',
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
      };
    }
  };
  
  return (
    <Card sx={{ 
      width: '450px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      overflow: 'visible',
      position: 'relative',
      height: '100%',
      margin: '0 auto'
    }}>
      <CardContent sx={{ p: 0, position: 'relative', height: '100%' }}>
        {/* Hlavička karty s logami a informáciami */}
        <Box sx={{ position: 'relative', height: '180px', pt: 2 }}>
          {/* Logo domáceho tímu */}
          <Box sx={{ 
            position: 'absolute', 
            left: '35px',
            top: '20px'
          }}>
            <Box 
              component="img"
              src={match.homeTeam?.logo || '/placeholder-team.png'}
              alt={match.homeTeam?.name}
              sx={{ 
                width: '80px', 
                height: '80px', 
                objectFit: 'contain'
              }}
            />
            <Typography 
              sx={{
                color: '#000',
                textAlign: 'center',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '14px',
                fontStyle: 'normal',
                fontWeight: 700,
                lineHeight: 'normal',
                mt: 1
              }}
            >
              {match.homeTeam?.name || 'Domáci tím'}
            </Typography>
          </Box>
          
          {/* Logo hosťujúceho tímu */}
          <Box sx={{ 
            position: 'absolute', 
            right: '35px',
            top: '20px'
          }}>
            <Box 
              component="img"
              src={match.awayTeam?.logo || '/placeholder-team.png'}
              alt={match.awayTeam?.name}
              sx={{ 
                width: '80px', 
                height: '80px', 
                objectFit: 'contain',
                textAlign: 'center',
              }}
            />
            <Typography 
              sx={{
                color: '#000',
                textAlign: 'center',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '14px',
                fontStyle: 'normal',
                fontWeight: 700,
                lineHeight: 'normal',
                mt: 1
              }}
            >
              {match.awayTeam?.name || 'Hosťujúci tím'}
            </Typography>
          </Box>
          
          {/* Informácie o zápase (Názov ligy, dátum/výsledok) - v strede medzi logami */}
          <Box sx={{ 
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            textAlign: 'center'
          }}>
            {/* Názov ligy */}
            <Typography 
              sx={{
                color: '#000',
                textAlign: 'center',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '11px',
                fontStyle: 'normal',
                fontWeight: 400,
                lineHeight: 'normal',
                marginTop: '20px'
              }}
            >
              {match.Round?.League?.name || 'Liga'}
            </Typography>
            
            {/* Dátum a čas zápasu alebo výsledok */}
            {isEvaluated ? (
              <Box>
                <Typography 
                  sx={{
                    color: '#000',
                    textAlign: 'center',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '22px',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    lineHeight: 'normal',
                    textTransform: 'uppercase',
                    marginTop: '5px'
                  }}
                >
                  {match.homeScore} : {match.awayScore}
                </Typography>
                {userTip && (
                  <Typography 
                    sx={{
                      color: '#000',
                      textAlign: 'center',
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: '11px',
                      fontStyle: 'normal',
                      fontWeight: 400,
                      lineHeight: 'normal',
                      mt: 0.5
                    }}
                  >
                    Body: {userTip?.points || 0}
                  </Typography>
                )}
              </Box>
            ) : (
              <Box>
                <Typography 
                  sx={{
                    color: '#000',
                    textAlign: 'center',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '11px',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    lineHeight: 'normal',
                    marginTop: '15px'
                  }}
                >
                  {new Date(match.matchTime).toLocaleDateString()}
                </Typography>
                <Typography 
                  sx={{
                    color: '#000',
                    textAlign: 'center',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '10px',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    lineHeight: 'normal',
                  }}
                >
                  {new Date(match.matchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            )}
            
            {/* Status tag */}
            <Box sx={{ mt: 1.5 }}>
              <Chip 
                label={isEvaluated ? "Vyhodnotený" : "Plánovaný"}
                sx={{ 
                  backgroundColor: isEvaluated ? '#4caf50' : '#2196f3', 
                  color: 'white',
                  fontSize: '0.75rem',
                  height: '24px'
                }}
                size="small"
              />
            </Box>
          </Box>
        </Box>
        
        {/* Tipovanie - nižšie pod hlavičkou */}
        <Box sx={{ p: 3, pt: 1 }}>
          {match.tipType === 'exact_score' ? (
            // Tipovanie presného výsledku
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              mb: 2 
            }}>
              <TextField
                type="number"
                size="small"
                InputProps={{ 
                  inputProps: { min: 0 },
                  sx: getExactScoreInputStyle(true)
                }}
                value={tip.homeScore}
                onChange={(e) => handleTipChange('homeScore', e.target.value)}
                disabled={!canTip}
              />
              <Typography variant="h6" sx={{ mx: 2, color: '#000' }}>:</Typography>
              <TextField
                type="number"
                size="small"
                InputProps={{ 
                  inputProps: { min: 0 },
                  sx: getExactScoreInputStyle(false)
                }}
                value={tip.awayScore}
                onChange={(e) => handleTipChange('awayScore', e.target.value)}
                disabled={!canTip}
              />
            </Box>
          ) : (
            // Tipovanie víťaza
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                mb: 2 
              }}
            >
              <Button
                variant="outlined"
                sx={{ 
                  width: '30%', 
                  height: 40,
                  textTransform: 'none',
                  fontFamily: 'Montserrat, sans-serif',
                  ...getWinnerButtonStyle('home'),
                  '&:hover': {
                    backgroundColor: canTip ? 'rgba(0, 0, 0, 0.04)' : undefined,
                    borderColor: canTip ? 'black' : undefined,
                    borderWidth: canTip && tip.winner !== 'home' ? '1px' : undefined
                  }
                }}
                onClick={() => canTip && handleTipChange('winner', 'home')}
                disabled={!canTip}
              >
                Domáci
              </Button>
              <Button
                variant="outlined"
                sx={{ 
                  width: '30%', 
                  height: 40,
                  textTransform: 'none',
                  fontFamily: 'Montserrat, sans-serif',
                  ...getWinnerButtonStyle('draw'),
                  '&:hover': {
                    backgroundColor: canTip ? 'rgba(0, 0, 0, 0.04)' : undefined,
                    borderColor: canTip ? 'black' : undefined,
                    borderWidth: canTip && tip.winner !== 'draw' ? '1px' : undefined
                  }
                }}
                onClick={() => canTip && handleTipChange('winner', 'draw')}
                disabled={!canTip}
              >
                Remíza
              </Button>
              <Button
                variant="outlined"
                sx={{ 
                  width: '30%', 
                  height: 40,
                  textTransform: 'none',
                  fontFamily: 'Montserrat, sans-serif',
                  ...getWinnerButtonStyle('away'),
                  '&:hover': {
                    backgroundColor: canTip ? 'rgba(0, 0, 0, 0.04)' : undefined,
                    borderColor: canTip ? 'black' : undefined,
                    borderWidth: canTip && tip.winner !== 'away' ? '1px' : undefined
                  }
                }}
                onClick={() => canTip && handleTipChange('winner', 'away')}
                disabled={!canTip}
              >
                Hostia
              </Button>
            </Box>
          )}
          
          {/* Tlačidlo pre vyhodnotenie zápasu - len pre adminov/správcov */}
          {hasEditPermission && (
            <Box sx={{ mt: 1, mb: 1, display: 'flex', justifyContent: 'center' }}>
              <Button
                size="small"
                color={match.status === 'finished' ? "info" : "primary"}
                variant={match.status === 'finished' ? "outlined" : "contained"}
                onClick={() => onEvaluateMatch(match)}
                startIcon={<EditIcon />}
                sx={{
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                {match.status === 'finished' ? 'UPRAVIŤ VÝSLEDOK' : 'ZADAŤ VÝSLEDOK'}
              </Button>
            </Box>
          )}
          
          {/* Link na detaily zápasu */}
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button 
              component={RouterLink}
              to={`/matches/${match.id}`}
              sx={{ 
                fontSize: '0.75rem', 
                color: '#2196f3',
                textTransform: 'none',
                padding: 0,
                minWidth: 'auto',
                fontFamily: 'Montserrat, sans-serif',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline'
                }
              }}
            >
              Podrobné štatistiky
            </Button>
          </Box>
          
          {/* Spätná väzba o ukladaní */}
          {saving && (
            <Typography 
              variant="caption" 
              color="text.secondary" 
              align="center" 
              sx={{ 
                display: 'block', 
                mt: 1,
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              Ukladá sa...
            </Typography>
          )}
          {saveSuccess && (
            <Typography 
              variant="caption" 
              color="success.main" 
              align="center" 
              sx={{ 
                display: 'block', 
                mt: 1,
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              Tip bol uložený
            </Typography>
          )}
          {saveError && (
            <Typography 
              variant="caption" 
              color="error" 
              align="center" 
              sx={{ 
                display: 'block', 
                mt: 1,
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {saveError}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default MatchCard;
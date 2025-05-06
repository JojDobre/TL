import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Avatar,
  Chip,
  CircularProgress
} from '@mui/material';

// Universálny komponent pre zobrazenie rebríčka
const Leaderboard = ({ data, loading, error, title }) => {
  // Zobrazenie načítavania
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Zobrazenie chyby
  if (error) {
    return (
      <Typography color="error" sx={{ my: 2 }}>
        {error}
      </Typography>
    );
  }

  // Ak nie sú žiadne dáta
  if (!data || data.length === 0) {
    return (
      <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
        Zatiaľ nie sú k dispozícii žiadne údaje pre rebríček.
      </Typography>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center" width="10%">#</TableCell>
              <TableCell>Hráč</TableCell>
              <TableCell align="center">Body</TableCell>
              <TableCell align="center">Úspešnosť</TableCell>
              <TableCell align="center">Správne Tipy</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((entry) => (
              <TableRow 
                key={entry.user.id}
                sx={{ 
                  backgroundColor: entry.rank <= 3 ? 'rgba(255, 215, 0, 0.05)' : 'inherit',
                  '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                }}
              >
                <TableCell align="center">
                  {entry.rank <= 3 ? (
                    <Chip 
                      label={entry.rank} 
                      color={
                        entry.rank === 1 ? 'primary' : 
                        entry.rank === 2 ? 'secondary' : 
                        'default'
                      }
                      size="small"
                    />
                  ) : (
                    entry.rank
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar 
                      src={entry.user.profileImage} 
                      alt={entry.user.username}
                      sx={{ mr: 2, width: 36, height: 36 }}
                    >
                      {entry.user.username ? entry.user.username.charAt(0).toUpperCase() : '?'}
                    </Avatar>
                    <Box>
                      <Typography variant="body1">
                        {entry.user.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.user.firstName || entry.user.lastName ? 
                          `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() : ''}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body1" fontWeight="bold">
                    {entry.totalPoints}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip 
                    label={`${entry.accuracy}%`}
                    color={
                      entry.accuracy >= 75 ? 'success' :
                      entry.accuracy >= 50 ? 'primary' :
                      entry.accuracy >= 25 ? 'warning' :
                      'error'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  {entry.correctPredictions} / {entry.tipsCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Leaderboard;
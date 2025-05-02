// frontend/src/services/tipService.js
import axios from 'axios';

// Získanie tipov používateľa pre konkrétny zápas
export const getUserTipForMatch = async (matchId) => {
  try {
    const response = await axios.get(`/api/tips/match/${matchId}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Získanie všetkých tipov používateľa
export const getUserTips = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (filters.roundId) queryParams.append('roundId', filters.roundId);
    
    const response = await axios.get(`/api/tips/user?${queryParams.toString()}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vytvorenie alebo aktualizácia tipu
export const createOrUpdateTip = async (tipData) => {
  try {
    const response = await axios.post('/api/tips', tipData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};
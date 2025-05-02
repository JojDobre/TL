// frontend/src/services/matchService.js
import axios from 'axios';

// Získanie všetkých zápasov
export const getAllMatches = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Pridanie parametrov do URL, ak sú poskytnuté
    if (filters.roundId) queryParams.append('roundId', filters.roundId);
    
    const response = await axios.get(`/api/matches?${queryParams.toString()}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Získanie detailu zápasu
export const getMatchById = async (id) => {
  try {
    const response = await axios.get(`/api/matches/${id}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vytvorenie nového zápasu
export const createMatch = async (matchData) => {
  try {
    const response = await axios.post('/api/matches', matchData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Aktualizácia zápasu
export const updateMatch = async (id, matchData) => {
  try {
    const response = await axios.put(`/api/matches/${id}`, matchData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vymazanie zápasu
export const deleteMatch = async (id) => {
  try {
    const response = await axios.delete(`/api/matches/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
// frontend/src/services/seasonService.js
import axios from 'axios';

// Získanie všetkých sezón
export const getAllSeasons = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Pridanie parametrov do URL, ak sú poskytnuté
    if (filters.type) queryParams.append('type', filters.type);
    
    const response = await axios.get(`/api/seasons?${queryParams.toString()}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Získanie detailu sezóny
export const getSeasonById = async (id) => {
  try {
    const response = await axios.get(`/api/seasons/${id}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vytvorenie novej sezóny
export const createSeason = async (seasonData) => {
  try {
    const response = await axios.post('/api/seasons', seasonData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Aktualizácia sezóny
export const updateSeason = async (id, seasonData) => {
  try {
    const response = await axios.put(`/api/seasons/${id}`, seasonData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vymazanie sezóny
export const deleteSeason = async (id) => {
  try {
    const response = await axios.delete(`/api/seasons/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Pripojenie k sezóne
export const joinSeason = async (inviteCode) => {
  try {
    const response = await axios.post('/api/seasons/join', { inviteCode });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Získanie rebríčka sezóny
export const getSeasonLeaderboard = async (id) => {
  try {
    const response = await axios.get(`/api/seasons/${id}/leaderboard`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};
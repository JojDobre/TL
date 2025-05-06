// frontend/src/services/roundService.js
import axios from 'axios';

// Získanie všetkých kôl
export const getAllRounds = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Pridanie parametrov do URL, ak sú poskytnuté
    if (filters.leagueId) queryParams.append('leagueId', filters.leagueId);
    
    const response = await axios.get(`/api/rounds?${queryParams.toString()}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Získanie rebríčka kola
export const getRoundLeaderboard = async (id) => {
  try {
    const response = await axios.get(`/api/rounds/${id}/leaderboard`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Získanie detailu kola
export const getRoundById = async (id) => {
  try {
    const response = await axios.get(`/api/rounds/${id}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vytvorenie nového kola
export const createRound = async (roundData) => {
  try {
    const response = await axios.post('/api/rounds', roundData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Aktualizácia kola
export const updateRound = async (id, roundData) => {
  try {
    const response = await axios.put(`/api/rounds/${id}`, roundData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vymazanie kola
export const deleteRound = async (id) => {
  try {
    const response = await axios.delete(`/api/rounds/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
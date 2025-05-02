// frontend/src/services/leagueService.js
import axios from 'axios';

// Získanie všetkých líg
export const getAllLeagues = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Pridanie parametrov do URL, ak sú poskytnuté
    if (filters.seasonId) queryParams.append('seasonId', filters.seasonId);
    if (filters.type) queryParams.append('type', filters.type);
    
    const response = await axios.get(`/api/leagues?${queryParams.toString()}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Získanie detailu ligy
export const getLeagueById = async (id) => {
  try {
    const response = await axios.get(`/api/leagues/${id}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vytvorenie novej ligy
export const createLeague = async (leagueData) => {
  try {
    const response = await axios.post('/api/leagues', leagueData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Aktualizácia ligy
export const updateLeague = async (id, leagueData) => {
  try {
    const response = await axios.put(`/api/leagues/${id}`, leagueData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vymazanie ligy
export const deleteLeague = async (id) => {
  try {
    const response = await axios.delete(`/api/leagues/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Získanie rebríčka ligy
export const getLeagueLeaderboard = async (id) => {
  try {
    const response = await axios.get(`/api/leagues/${id}/leaderboard`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};
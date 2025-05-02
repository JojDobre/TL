// frontend/src/services/teamService.js
import axios from 'axios';

// Získanie všetkých tímov
export const getAllTeams = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Pridanie parametrov do URL, ak sú poskytnuté
    if (filters.type) queryParams.append('type', filters.type);
    
    const response = await axios.get(`/api/teams?${queryParams.toString()}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Získanie detailu tímu
export const getTeamById = async (id) => {
  try {
    const response = await axios.get(`/api/teams/${id}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vytvorenie nového tímu
export const createTeam = async (teamData) => {
  try {
    const response = await axios.post('/api/teams', teamData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Aktualizácia tímu
export const updateTeam = async (id, teamData) => {
  try {
    const response = await axios.put(`/api/teams/${id}`, teamData);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

// Vymazanie tímu
export const deleteTeam = async (id) => {
  try {
    const response = await axios.delete(`/api/teams/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
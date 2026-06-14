// frontend/src/services/userService.js
//
// Volania na user endpointy backendu (/api/users). Všetky vyžadujú admin rolu.
// getAllUsers podporuje serverové stránkovanie, vyhľadávanie a filter.

import axios from 'axios';

// Zoznam užívateľov so stránkovaním/filtrom.
// params: { page, limit, search, role, status }
// vracia: { data: [...], pagination: { total, page, limit, pages } }
export const getAllUsers = async (params = {}) => {
  const res = await axios.get('/api/users', { params });
  return { data: res.data.data, pagination: res.data.pagination };
};

export const getUserById = async (id) => {
  const res = await axios.get('/api/users/' + id);
  return res.data.data;
};

// Úprava užívateľa (rola, stav, meno, e-mail...).
export const updateUser = async (id, data) => {
  const res = await axios.put('/api/users/' + id, data);
  return res.data.data;
};

// Reset hesla užívateľa adminom.
export const changeUserPassword = async (id, password) => {
  const res = await axios.put('/api/users/' + id + '/password', { password });
  return res.data;
};

export const deleteUser = async (id) => {
  const res = await axios.delete('/api/users/' + id);
  return res.data;
};

import axios from 'axios';

// In development, Vite proxies /api to the backend (see vite.config.js)
// In production, change this to your actual backend URL
export const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

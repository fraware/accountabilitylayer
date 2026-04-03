import axios from 'axios';
import type { paths } from '../types/api';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export type LoginSuccessBody =
  paths['/auth/login']['post']['responses']['200']['content']['application/json'];

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

export default api;

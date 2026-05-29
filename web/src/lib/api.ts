import axios, { type AxiosInstance } from 'axios';
import { store, clearSession } from '@/store';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: BASE,
  withCredentials: true, // send refresh cookie
});

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      store.dispatch(clearSession());
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  },
);

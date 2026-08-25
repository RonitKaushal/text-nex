import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import auth from '../utils/auth';
import { API_BASE_URL } from '../constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await auth.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error attaching auth token:', error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Do NOT auto-logout on 401. Expired licenses often return 401 from
    // /user/profile; clearing the session would wrongly show the Login page.
    // AuthContext decides: keep session + block services, or explicit logout.
    return Promise.reject(error);
  }
);

export default api;

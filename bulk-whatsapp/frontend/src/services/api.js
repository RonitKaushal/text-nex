import axios from 'axios'
import { shouldLogoutOnAuthError } from './userStorageKey'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.textnexus.in/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

async function clearAuthStorage() {
  if (window.electronAPI) {
    await window.electronAPI.clearToken();
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
  }
}

function redirectToLogin() {
  if (!window.location.hash.includes('/login')) {
    window.location.hash = '/login';
  }
}

api.interceptors.request.use(
  async (config) => {
    let token;
    try {
      if (window.electronAPI) {
        token = await window.electronAPI.getToken();
      } else {
        token = localStorage.getItem('token');
      }
    } catch (e) {
      console.error('Error fetching token:', e);
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    console.error('API Error:', status, message);

    if (error.config?.responseType === 'blob' && error.response?.data instanceof Blob) {
      return Promise.reject(error);
    }

    if (error.response && shouldLogoutOnAuthError(error)) {
      console.log('Session invalid — logging out');
      await clearAuthStorage();
      window.dispatchEvent(new CustomEvent('auth:logout'));
      redirectToLogin();
    }

    if (!error.response) {
      console.error('Network error or server is down');
    }

    return Promise.reject(error);
  }
);

export default api

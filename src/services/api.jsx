import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('di_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor.
// - Unwraps the response body so callers get { success, data, message } directly.
// - A 401 on an AUTHENTICATED request means the session expired → bounce to login.
//   But a 401 from an /auth/* call (login, OTP, reset…) is a failed attempt, NOT
//   an expired session — we must NOT redirect; the page surfaces err.message
//   (e.g. "Invalid email or password") instead.
// - Always rejects with the server's body ({ success:false, message }) when present,
//   so every caller can show a proper message via err.message.
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const url = error.config?.url || '';
    const isAuthCall = url.includes('/auth/');
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('di_token');
      localStorage.removeItem('di_user');
      window.location.href = '/';
    }
    const body = error.response?.data;
    // Guarantee an err.message even for network errors / empty bodies.
    if (body && typeof body === 'object' && !body.message) {
      body.message = error.response?.statusText || 'Request failed';
    }
    return Promise.reject(body || { message: error.message || 'Network error. Please try again.' });
  }
);

export default api;

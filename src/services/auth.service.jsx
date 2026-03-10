import api from './api';

/** POST /api/auth/login - { email, password } */
export const login = (credentials) => api.post('/auth/login', credentials);

/** POST /api/auth/register - { name, email, password, phone } */
export const register = (data) => api.post('/auth/register', data);

/** POST /api/auth/login-otp/request - { email } */
export const requestLoginOtp = (data) => api.post('/auth/login-otp/request', data);

/** POST /api/auth/login-otp/verify - { email, otp } */
export const verifyLoginOtp = (data) => api.post('/auth/login-otp/verify', data);

/** POST /api/auth/forgot-password/request-otp - { email } */
export const requestForgotPasswordOtp = (data) => api.post('/auth/forgot-password/request-otp', data);

/** POST /api/auth/forgot-password/reset - { email, otp, newPassword } */
export const resetPasswordWithOtp = (data) => api.post('/auth/forgot-password/reset', data);

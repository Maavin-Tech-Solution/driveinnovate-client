import api from './api';

/** GET /api/users/me */
export const getProfile = () => api.get('/users/me');

/**
 * PUT /api/users/me
 * Body: { name, phone }
 */
export const updateProfile = (data) => api.put('/users/me', data);

/**
 * PUT /api/users/me/password
 * Body: { currentPassword, newPassword }
 */
export const updatePassword = (data) => api.put('/users/me/password', data);

/**
 * PUT /api/users/me/notifications
 * Body: { emailNotifications, smsNotifications, marketingNotifications }
 */
export const updateNotifications = (data) => api.put('/users/me/notifications', data);

/**
 * POST /api/users/clients
 * Body: same as register payload
 */
export const createClient = (data) => api.post('/users/clients', data);

/** GET /api/users/clients — list direct child clients of the logged-in user */
export const getClients = () => api.get('/users/clients');

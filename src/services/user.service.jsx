import api from './api';

/** GET /api/users/me */
export const getProfile = () => api.get('/users/me');

/** GET /api/users/me/parent — dealer/parent contact info (for subscription gates) */
export const getParentContact = () => api.get('/users/me/parent');

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

/** GET /api/users/clients/:clientId — full detail for one client */
export const getClientDetail = (clientId) => api.get(`/users/clients/${clientId}`);

/** GET /api/users/client-tree — full recursive network tree */
export const getClientTree = () => api.get('/users/client-tree');

/**
 * POST /api/users/clients/:clientId/upgrade
 * Body: { plan: '3months' | '6months' | '1year' }
 */
export const upgradeClient = (clientId, plan) =>
  api.post(`/users/clients/${clientId}/upgrade`, { plan });

/**
 * POST /api/users/clients/:clientId/extend-trial
 * Body: { newExpiresAt: ISO string }
 */
export const extendClientTrial = (clientId, newExpiresAt) =>
  api.post(`/users/clients/${clientId}/extend-trial`, { newExpiresAt });

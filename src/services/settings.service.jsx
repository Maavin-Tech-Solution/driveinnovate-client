import api from './api';

/** GET /api/settings */
export const getSettings = () => api.get('/settings');

/** PUT /api/settings */
export const updateSettings = (data) => api.put('/settings', data);

/** POST /api/settings/reset */
export const resetSettings = () => api.post('/settings/reset');

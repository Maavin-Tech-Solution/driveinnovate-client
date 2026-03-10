import api from './api';

/** GET /api/activity?page=1&limit=20 */
export const getActivities = (params = {}) => api.get('/activity', { params });

import api from './api';

/** GET /api/dashboard/stats */
export const getDashboardStats = () => api.get('/dashboard/stats');

/** GET /api/dashboard/user-stats */
export const getDashboardUserStats = () => api.get('/dashboard/user-stats');

/** GET /api/dashboard/overspeed-vehicles?threshold=80 */
export const getOverspeedVehicles = (speedThreshold) => 
  api.get(`/dashboard/overspeed-vehicles?threshold=${speedThreshold}`);

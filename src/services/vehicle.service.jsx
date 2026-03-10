import api from './api';

/** GET /api/vehicles */
export const getVehicles = () => api.get('/vehicles');

/** GET /api/vehicles/:id */
export const getVehicleById = (id) => api.get(`/vehicles/${id}`);

/**
 * POST /api/vehicles
 * Body: { vehicleNumber, name, imei, deviceType, make, model, year }
 */
export const addVehicle = (data) => api.post('/vehicles', data);

/**
 * PUT /api/vehicles/:id
 * Body: { name, imei, deviceType, make, model, year, status }
 */
export const updateVehicle = (id, data) => api.put(`/vehicles/${id}`, data);

/** DELETE /api/vehicles/:id */
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}`);

/** GET /api/vehicles/:id/sync - Sync vehicle data from server (MySQL + MongoDB GPS) */
export const syncVehicleData = (id) => api.get(`/vehicles/${id}/sync`);

/** GET /api/vehicles/:id/location-player - Get location history for playback */
export const getLocationPlayerData = (id, from, to) => 
  api.get(`/vehicles/${id}/location-player`, { params: { from, to } });

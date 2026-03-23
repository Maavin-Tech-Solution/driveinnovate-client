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

// Sensor CRUD
export const getVehicleSensors = (id) => api.get(`/vehicles/${id}/sensors`);
export const createVehicleSensor = (id, data) => api.post(`/vehicles/${id}/sensors`, data);
export const updateVehicleSensor = (id, sensorId, data) => api.put(`/vehicles/${id}/sensors/${sensorId}`, data);
export const deleteVehicleSensor = (id, sensorId) => api.delete(`/vehicles/${id}/sensors/${sensorId}`);

// Vehicle Reports
export const getVehicleReportSummary      = (id, from, to) => api.get(`/vehicles/${id}/reports/summary`,       { params: { from, to } });
export const getVehicleReportDaily        = (id, from, to) => api.get(`/vehicles/${id}/reports/daily`,         { params: { from, to } });
export const getVehicleReportEngineHours  = (id, from, to, limit, offset) => api.get(`/vehicles/${id}/reports/engine-hours`,  { params: { from, to, limit, offset } });
export const getVehicleReportTrips        = (id, from, to, limit, offset) => api.get(`/vehicles/${id}/reports/trips`,         { params: { from, to, limit, offset } });
export const getVehicleReportFuelFillings = (id, from, to) => api.get(`/vehicles/${id}/reports/fuel-fillings`, { params: { from, to } });
export const exportVehicleReport          = (id, type, from, to) => api.get(`/vehicles/${id}/reports/export`,       { params: { type, from, to }, responseType: 'blob' });
export const exportVehicleReportExcel     = (id, from, to)       => api.get(`/vehicles/${id}/reports/export-xlsx`,  { params: { from, to },       responseType: 'blob' });
export const reprocessVehicleData         = (id, from, to) => api.post(`/vehicles/${id}/reports/reprocess`,    { from, to });

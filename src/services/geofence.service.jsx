import api from './api';

export const getGeofences     = ()               => api.get('/geofences');
export const getGeofenceById  = (id)             => api.get(`/geofences/${id}`);
export const createGeofence   = (data)           => api.post('/geofences', data);
export const updateGeofence   = (id, data)       => api.put(`/geofences/${id}`, data);
export const deleteGeofence   = (id)             => api.delete(`/geofences/${id}`);
export const toggleGeofence   = (id)             => api.patch(`/geofences/${id}/toggle`);

export const addAssignment    = (id, data)       => api.post(`/geofences/${id}/assignments`, data);
export const removeAssignment = (id, assignId)   => api.delete(`/geofences/${id}/assignments/${assignId}`);

export const getVehicleGeofences = (vehicleId)   => api.get(`/geofences/vehicle/${vehicleId}`);

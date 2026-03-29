import api from './api';

// Device Configs
export const getDeviceConfigs  = ()         => api.get('/master/device-configs');
export const createDeviceConfig = (data)    => api.post('/master/device-configs', data);
export const updateDeviceConfig = (id, data) => api.put(`/master/device-configs/${id}`, data);
export const deleteDeviceConfig = (id)      => api.delete(`/master/device-configs/${id}`);

// State Definitions (scoped to a device)
export const getStates    = (deviceId)        => api.get(`/master/device-configs/${deviceId}/states`);
export const createState  = (deviceId, data)  => api.post(`/master/device-configs/${deviceId}/states`, data);
export const updateState  = (stateId, data)   => api.put(`/master/states/${stateId}`, data);
export const deleteState  = (stateId)         => api.delete(`/master/states/${stateId}`);
export const resetStatesToDefaults = (deviceId) => api.post(`/master/device-configs/${deviceId}/reset-states`);

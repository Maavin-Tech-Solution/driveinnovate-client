import api from './api';

export const getAlerts     = ()           => api.get('/alerts');
export const createAlert   = (data)       => api.post('/alerts', data);
export const updateAlert   = (id, data)   => api.put(`/alerts/${id}`, data);
export const toggleAlert   = (id)         => api.patch(`/alerts/${id}/toggle`);
export const deleteAlert   = (id)         => api.delete(`/alerts/${id}`);

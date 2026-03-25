import api from './api';

export const createTicket = (formData) =>
  api.post('/support', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getTickets = (params = {}) => api.get('/support', { params });
export const getTicketById = (id) => api.get(`/support/${id}`);
export const updateTicketStatus = (id, data) => api.patch(`/support/${id}`, data);

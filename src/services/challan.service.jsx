import api from './api';

/** GET /api/challans */
export const getChallans = () => api.get('/challans');

/** GET /api/challans/:id */
export const getChallanById = (id) => api.get(`/challans/${id}`);

/**
 * POST /api/challans
 * Body: { vehicleId, challanNumber, amount, challanType, offense, challanDate, dueDate, location }
 */
export const createChallan = (data) => api.post('/challans', data);

/**
 * PUT /api/challans/:id
 * Body: { amount, challanType, offense, status, location }
 */
export const updateChallan = (id, data) => api.put(`/challans/${id}`, data);

/**
 * PUT /api/challans/:id/pay
 * Body: { transactionId }
 */
export const payChallan = (id, data) => api.put(`/challans/${id}/pay`, data);

/** DELETE /api/challans/:id */
export const deleteChallan = (id) => api.delete(`/challans/${id}`);

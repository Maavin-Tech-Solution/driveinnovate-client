import api from './api';

/** GET /api/rto */
export const getRtoDetails = () => api.get('/rto');

/** GET /api/rto/:vehicleId */
export const getRtoByVehicle = (vehicleId) => api.get(`/rto/${vehicleId}`);

/**
 * POST /api/rto
 * Body: { vehicleId, bodyType, insuranceExpiry, insuranceCompany, insurancePolicyNumber,
 *         roadTaxExpiry, fitnessExpiry, pollutionExpiry, nationalPermitExpiry,
 *         nationalPermitNumber, registrationExpiry, ownerName }
 */
export const createRtoDetail = (data) => api.post('/rto', data);

/**
 * PUT /api/rto/:vehicleId
 * Body: { bodyType, insuranceExpiry, ... }
 */
export const updateRtoDetail = (vehicleId, data) => api.put(`/rto/${vehicleId}`, data);

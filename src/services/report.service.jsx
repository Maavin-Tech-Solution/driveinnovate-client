import api from './api';

/**
 * Analyze and detect speed violations
 */
export const analyzeSpeedViolations = async (params) => {
  const response = await api.post('/reports/speed-violations/analyze', params);
  return response.data;
};

/**
 * Get speed violation report
 */
export const getSpeedViolationReport = async (filters) => {
  const response = await api.get('/reports/speed-violations', { params: filters });
  return response.data;
};

/**
 * Get vehicle violation summary
 */
export const getVehicleViolationSummary = async (filters) => {
  const response = await api.get('/reports/speed-violations/summary', { params: filters });
  return response.data;
};

/**
 * Acknowledge a violation
 */
export const acknowledgeViolation = async (id, notes) => {
  const response = await api.put(`/reports/speed-violations/${id}/acknowledge`, { notes });
  return response.data;
};

/**
 * Export speed violations to CSV
 */
export const exportSpeedViolations = (filters) => {
  const params = new URLSearchParams(filters).toString();
  const url = `${api.defaults.baseURL}/reports/speed-violations/export?${params}`;
  window.open(url, '_blank');
};

/**
 * Analyze and detect trips
 */
export const analyzeTrips = async (params) => {
  const response = await api.post('/reports/trips/analyze', params);
  return response.data;
};

/**
 * Get trip report
 */
export const getTripReport = async (filters) => {
  const response = await api.get('/reports/trips', { params: filters });
  return response.data;
};

/**
 * Export trips to CSV
 */
export const exportTrips = (filters) => {
  const params = new URLSearchParams(filters).toString();
  const url = `${api.defaults.baseURL}/reports/trips/export?${params}`;
  window.open(url, '_blank');
};

/**
 * Analyze and detect stops
 */
export const analyzeStops = async (params) => {
  const response = await api.post('/reports/stops/analyze', params);
  return response.data;
};

/**
 * Get stop report
 */
export const getStopReport = async (filters) => {
  const response = await api.get('/reports/stops', { params: filters });
  return response.data;
};

/**
 * Export stops to CSV
 */
export const exportStops = (filters) => {
  const params = new URLSearchParams(filters).toString();
  const url = `${api.defaults.baseURL}/reports/stops/export?${params}`;
  window.open(url, '_blank');
};

/**
 * Get engine hours report
 */
export const getEngineHoursReport = async (filters) => {
  const response = await api.get('/reports/engine-hours', { params: filters });
  return response.data;
};


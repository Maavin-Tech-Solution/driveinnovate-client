import api from './api';

/**
 * Download a report CSV through the AUTHENTICATED api client.
 *
 * These exports used to do `window.open(url)`, a raw browser navigation to the
 * API. That request carries no Authorization header, so `validateConsumer`
 * rejected it with 401 ("Authorization token is required") — the new tab just
 * asked for a token and no file was produced. Instead we fetch the CSV as a
 * blob (the request interceptor attaches the JWT) and trigger a client-side
 * download, exactly like the vehicle Excel export. Returns a promise so the
 * caller can show success/error only after the request actually resolves.
 */
const downloadReportCsv = async (path, filters, filename) => {
  // api's response interceptor returns response.data, so `blob` is the Blob.
  const blob = await api.get(path, { params: filters, responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const csvDateStamp = () => new Date().toISOString().slice(0, 10);

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
export const exportSpeedViolations = (filters) =>
  downloadReportCsv('/reports/speed-violations/export', filters, `speed_violations_${csvDateStamp()}.csv`);

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
export const exportTrips = (filters) =>
  downloadReportCsv('/reports/trips/export', filters, `trip_report_${csvDateStamp()}.csv`);

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
export const exportStops = (filters) =>
  downloadReportCsv('/reports/stops/export', filters, `stop_report_${csvDateStamp()}.csv`);

/**
 * Get engine hours report
 */
export const getEngineHoursReport = async (filters) => {
  const response = await api.get('/reports/engine-hours', { params: filters });
  return response.data;
};


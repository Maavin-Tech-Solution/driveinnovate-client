import api from './api';

/**
 * Create a shareable link token for a trip window.
 * POST /api/share
 * Body: { vehicleId, from, to }  (from/to = ISO datetime strings from trip.startTime / trip.endTime)
 */
export const createTripShare = (vehicleId, from, to) =>
  api.post('/share', { vehicleId, from, to });

/**
 * Fetch location data for a shared trip (public — no auth required).
 * GET /api/share/:token
 */
export const getShareData = (token) =>
  api.get(`/share/${token}`);

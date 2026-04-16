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

/**
 * Create a live-tracking share link.
 * POST /api/share/live
 * Body: { shareType: 'vehicle'|'group', vehicleId?, groupId?, expiresAt }
 *   expiresAt: ISO datetime string
 */
export const createLiveShare = (data) =>
  api.post('/share/live', data);

/**
 * Get live share metadata + current positions (public — no auth required).
 * GET /api/share/live/:token
 */
export const getLiveShareData = (token) =>
  api.get(`/share/live/${token}`);

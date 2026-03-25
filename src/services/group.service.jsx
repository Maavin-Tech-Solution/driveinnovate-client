import api from './api';

/** GET /api/groups — list all groups (with vehicles) */
export const getGroups = () => api.get('/groups');

/** GET /api/groups/:id — single group with vehicles */
export const getGroupById = (id) => api.get(`/groups/${id}`);

/** POST /api/groups — create a new group */
export const createGroup = (data) => api.post('/groups', data);

/** PUT /api/groups/:id — update a group */
export const updateGroup = (id, data) => api.put(`/groups/${id}`, data);

/** DELETE /api/groups/:id — delete a group */
export const deleteGroup = (id) => api.delete(`/groups/${id}`);

/** POST /api/groups/:id/vehicles — add vehicle to group */
export const addVehicleToGroup = (groupId, vehicleId) =>
  api.post(`/groups/${groupId}/vehicles`, { vehicleId });

/** DELETE /api/groups/:id/vehicles/:vehicleId — remove vehicle from group */
export const removeVehicleFromGroup = (groupId, vehicleId) =>
  api.delete(`/groups/${groupId}/vehicles/${vehicleId}`);

/** GET /api/groups/:id/report/summary?from=&to= — aggregate summary */
export const getGroupReportSummary = (id, from, to) =>
  api.get(`/groups/${id}/report/summary`, { params: { from, to } });

/** GET /api/groups/:id/report/trips?from=&to=&limit=&offset= — all trips */
export const getGroupReportTrips = (id, from, to, limit = 50, offset = 0) =>
  api.get(`/groups/${id}/report/trips`, { params: { from, to, limit, offset } });

/** GET /api/groups/:id/report/export-xlsx — download Excel report (returns blob) */
export const exportGroupReportExcel = (id, from, to) =>
  api.get(`/groups/${id}/report/export-xlsx`, { params: { from, to }, responseType: 'blob' });

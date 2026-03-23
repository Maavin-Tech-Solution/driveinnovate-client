import api from './api';

/** GET /api/groups — list all groups (with vehicles) */
export const getGroups = () => api.get('/groups');

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

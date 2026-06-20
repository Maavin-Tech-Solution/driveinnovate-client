import api from './api';

/** GET /api/teams — list the owner's teams (with vehicle/member counts) */
export const getTeams = () => api.get('/teams');

/** GET /api/teams/:id — team detail (assigned vehicles + members) */
export const getTeam = (id) => api.get(`/teams/${id}`);

/** POST /api/teams — create a team */
export const createTeam = (data) => api.post('/teams', data);

/** PATCH /api/teams/:id — rename / re-describe / set status */
export const updateTeam = (id, data) => api.patch(`/teams/${id}`, data);

/** DELETE /api/teams/:id */
export const deleteTeam = (id) => api.delete(`/teams/${id}`);

/** PUT /api/teams/:id/vehicles — replace the team's assigned vehicles */
export const setTeamVehicles = (id, vehicleIds) => api.put(`/teams/${id}/vehicles`, { vehicleIds });

/** GET /api/teams/assignable-vehicles — the owner's fleet (picker source) */
export const getAssignableVehicles = () => api.get('/teams/assignable-vehicles');

/** GET /api/teams/members — the owner's full member pool (with each member's teamIds) */
export const getOwnerMembers = () => api.get('/teams/members');

/** POST /api/teams/:id/vehicles/:vehicleId — add one vehicle to a team */
export const addTeamVehicle = (teamId, vehicleId) => api.post(`/teams/${teamId}/vehicles/${vehicleId}`);

/** DELETE /api/teams/:id/vehicles/:vehicleId — remove one vehicle from a team */
export const removeTeamVehicle = (teamId, vehicleId) => api.delete(`/teams/${teamId}/vehicles/${vehicleId}`);

/** POST /api/teams/:id/members/:userId — attach an EXISTING member to a team (multi-team) */
export const attachTeamMember = (teamId, userId) => api.post(`/teams/${teamId}/members/${userId}`);

/** POST /api/teams/:id/members — create a member login + attach to team */
export const addTeamMember = (id, data) => api.post(`/teams/${id}/members`, data);

/** DELETE /api/teams/:id/members/:userId — detach member from this team */
export const removeTeamMember = (id, userId) => api.delete(`/teams/${id}/members/${userId}`);

/** DELETE /api/teams/:id/members/:userId/account — revoke the member login entirely */
export const deleteTeamMember = (id, userId) => api.delete(`/teams/${id}/members/${userId}/account`);

/** PATCH /api/teams/:id/members/:userId/permissions — set a member's menu permissions */
export const setMemberPermissions = (id, userId, permissions) =>
  api.patch(`/teams/${id}/members/${userId}/permissions`, { permissions });

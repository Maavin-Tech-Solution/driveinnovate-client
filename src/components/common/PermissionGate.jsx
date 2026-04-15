import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps a route and redirects to /dashboard if the user lacks the required permission.
 *
 * Props:
 *   permission  — a key from user.permissions (e.g. 'canTrackVehicle')
 *   role        — 'dealer_or_papa' to restrict to non-client users
 */
const PermissionGate = ({ permission, role, children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;

  const isPapa = user.role === 'papa' || Number(user.parentId) === 0 || Number(user.parent_id) === 0;

  // Role gate: papa / dealer / any user with canAddClient permission
  if (role === 'dealer_or_papa') {
    const allowed = isPapa || user.role === 'dealer' || user.permissions?.canAddClient === true;
    if (!allowed) return <Navigate to="/dashboard" replace />;
  }

  // Permission gate
  if (permission) {
    // Papa has all permissions
    if (isPapa) return children;
    const allowed = user.permissions?.[permission] === true;
    if (!allowed) return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PermissionGate;

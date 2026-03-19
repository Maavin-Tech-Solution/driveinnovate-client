import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard',     label: 'Dashboard',      icon: '🏠' },
  { to: '/my-fleet',      label: 'Tracking',        icon: '🚗' },
  { to: '/add-vehicle',   label: 'Add Vehicle',     icon: '➕' },
  { to: '/add-client',    label: 'Add Client',      icon: '👥' },
  { to: '/rto-details',   label: 'RTO Details',     icon: '📋' },
  { to: '/challans',      label: 'Challans',        icon: '📄' },
  { to: '/reports',       label: 'Reports',         icon: '📊' },
  { to: '/vehicle-settings', label: 'Vehicle Settings', icon: '⚙️' },
  { to: '/profile',       label: 'Profile',         icon: '👤' },
  { to: '/user-activity', label: 'User Activity',   icon: '📈' },
];

const Sidebar = ({ collapsed }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={{
      width: collapsed ? '70px' : '260px',
      background: 'linear-gradient(180deg, #1e3a5f 0%, #0f2040 100%)',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      transition: 'width 0.2s',
      overflow: 'hidden',
    }}>
      {/* Brand */}
      <div style={{
        padding: collapsed ? '20px 0' : '24px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <span style={{ fontSize: '26px' }}>🚀</span>
        {!collapsed && (
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', letterSpacing: '0.5px' }}>
              DriveInnovate
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>Fleet Management</div>
          </div>
        )}
      </div>

      {/* User card */}
      {!collapsed && (
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '14px', flexShrink: 0,
          }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '12px 0' : '11px 20px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
              background: isActive ? 'rgba(37,99,235,0.45)' : 'transparent',
              borderLeft: isActive ? '3px solid #60a5fa' : '3px solid transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: '14px',
              transition: 'all 0.15s',
              cursor: 'pointer',
            })}
          >
            <span style={{ fontSize: '17px', flexShrink: 0 }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
        {/* Debug menu item for parent users */}
        {user && (user.parent_id === 0 || user.parentId === 0) && (
          <NavLink
            key="/debug"
            to="/debug"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '12px 0' : '11px 20px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
              background: isActive ? 'rgba(37,99,235,0.45)' : 'transparent',
              borderLeft: isActive ? '3px solid #60a5fa' : '3px solid transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: '14px',
              transition: 'all 0.15s',
              cursor: 'pointer',
            })}
          >
            <span style={{ fontSize: '17px', flexShrink: 0 }}>🐞</span>
            {!collapsed && <span>Debug</span>}
          </NavLink>
        )}
      </nav>

      {/* Logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 0' }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: collapsed ? '12px 0' : '11px 20px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'rgba(255,255,255,0.6)',
            background: 'transparent',
            border: 'none',
            width: '100%',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
        >
          <span style={{ fontSize: '17px' }}>🚪</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

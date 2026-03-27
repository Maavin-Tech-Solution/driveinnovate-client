import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Squares2X2Icon,
  MapIcon,
  PlusCircleIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  BugAntIcon,
  RectangleGroupIcon,
  BellAlertIcon,
  LifebuoyIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { to: '/dashboard',        label: 'Dashboard',    Icon: Squares2X2Icon },
  { to: '/my-fleet',         label: 'Tracking',     Icon: MapIcon },
  { to: '/groups',           label: 'Groups',       Icon: RectangleGroupIcon },
  { to: '/geofences',        label: 'Geofences',    Icon: MapPinIcon },
  { to: '/alerts',           label: 'Alerts',       Icon: BellAlertIcon },
  { to: '/support',          label: 'Support',      Icon: LifebuoyIcon },
  { to: '/add-vehicle',      label: 'Add Vehicle',  Icon: PlusCircleIcon },
  { to: '/add-client',       label: 'Add Client',   Icon: UserGroupIcon },
  { to: '/rto-details',      label: 'RTO Details',  Icon: ClipboardDocumentListIcon },
  { to: '/challans',         label: 'Challans',     Icon: ExclamationTriangleIcon },
  { to: '/reports',          label: 'Reports',      Icon: ChartBarIcon },
  { to: '/vehicle-settings', label: 'Settings',     Icon: Cog6ToothIcon },
  { to: '/profile',          label: 'Profile',      Icon: UserCircleIcon },
  { to: '/user-activity',    label: 'Activity',     Icon: ClockIcon },
];

/* Transport graphics SVG - decorative road/vehicle scene at bottom of sidebar */
const TransportGraphic = ({ collapsed }) => (
  <svg
    style={{ position: 'absolute', bottom: 64, left: 0, right: 0, width: '100%', height: '130px', pointerEvents: 'none', opacity: collapsed ? 0.08 : 0.1 }}
    viewBox="0 0 260 130"
    preserveAspectRatio="xMidYMax meet"
    xmlns="http://www.w3.org/2000/svg"
    fill="white"
  >
    {/* Road surface */}
    <rect x="0" y="90" width="260" height="40" opacity="0.35"/>
    {/* Road edge lines */}
    <rect x="0" y="90" width="260" height="2.5" opacity="0.7"/>
    <rect x="0" y="127" width="260" height="2.5" opacity="0.7"/>
    {/* Center dashes */}
    {[0,38,76,114,152,190,228].map(x => (
      <rect key={x} x={x} y="108" width="22" height="3" rx="1.5" opacity="0.75"/>
    ))}
    {/* Truck body */}
    <rect x="20" y="60" width="76" height="30" rx="4" opacity="0.9"/>
    {/* Truck cab */}
    <rect x="96" y="67" width="28" height="23" rx="3" opacity="0.9"/>
    {/* Truck cab window */}
    <rect x="101" y="71" width="18" height="11" rx="2" opacity="0.3"/>
    {/* Truck wheels */}
    <circle cx="38" cy="90" r="9"/>
    <circle cx="38" cy="90" r="4.5" fill="rgba(13,24,58,0.7)"/>
    <circle cx="80" cy="90" r="9"/>
    <circle cx="80" cy="90" r="4.5" fill="rgba(13,24,58,0.7)"/>
    <circle cx="114" cy="90" r="9"/>
    <circle cx="114" cy="90" r="4.5" fill="rgba(13,24,58,0.7)"/>
    {/* Car body */}
    <rect x="152" y="72" width="52" height="18" rx="4" opacity="0.85"/>
    {/* Car roof */}
    <rect x="160" y="63" width="32" height="11" rx="3" opacity="0.85"/>
    {/* Car windows */}
    <rect x="163" y="65" width="12" height="7" rx="1.5" opacity="0.3"/>
    <rect x="178" y="65" width="11" height="7" rx="1.5" opacity="0.3"/>
    {/* Car wheels */}
    <circle cx="165" cy="90" r="7.5"/>
    <circle cx="165" cy="90" r="3.5" fill="rgba(13,24,58,0.7)"/>
    <circle cx="196" cy="90" r="7.5"/>
    <circle cx="196" cy="90" r="3.5" fill="rgba(13,24,58,0.7)"/>
    {/* GPS/signal dots */}
    <circle cx="230" cy="25" r="4.5" opacity="0.5"/>
    <circle cx="230" cy="25" r="9" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2"/>
    <circle cx="230" cy="25" r="14" fill="none" stroke="white" strokeWidth="1" opacity="0.1"/>
    <circle cx="14" cy="35" r="3" opacity="0.3"/>
    <circle cx="14" cy="35" r="7" fill="none" stroke="white" strokeWidth="1" opacity="0.12"/>
    {/* Signal arc from truck */}
    <path d="M 67 44 Q 78 37 89 44" stroke="white" strokeWidth="2" fill="none" opacity="0.35" strokeLinecap="round"/>
    <path d="M 62 35 Q 78 25 94 35" stroke="white" strokeWidth="1.5" fill="none" opacity="0.2" strokeLinecap="round"/>
  </svg>
);

const NavItem = ({ item, collapsed }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '11px',
        padding: collapsed ? '12px 0' : '9px 14px',
        margin: collapsed ? '2px 0' : '2px 10px',
        borderRadius: '8px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: isActive ? '#1D4ED8' : hovered ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
        background: isActive ? '#FFFFFF' : hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
        fontWeight: isActive ? 700 : 500,
        fontSize: '13.5px',
        transition: 'color 0.15s, background 0.15s',
        cursor: 'pointer',
        textDecoration: 'none',
        boxShadow: isActive ? '0 2px 10px rgba(0,0,0,0.25)' : 'none',
        letterSpacing: isActive ? '-0.01em' : '0',
      })}
    >
      <item.Icon style={{ width: '18px', height: '18px', flexShrink: 0 }} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
};

const Sidebar = ({ collapsed }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [logoutHover, setLogoutHover] = useState(false);

  return (
    <aside style={{
      width: collapsed ? '62px' : '260px',
      background: 'var(--theme-sidebar-bg)',
      height: '100vh',
      position: 'fixed',
      top: 0, left: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      transition: 'width 0.22s ease',
      overflow: 'hidden',
      boxShadow: '3px 0 20px rgba(0,0,0,0.35)',
    }}>

      {/* Transport graphics */}
      <TransportGraphic collapsed={collapsed} />

      {/* Brand */}
      <div style={{
        padding: collapsed ? '0' : '0 18px',
        height: '64px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(59,130,246,0.5)',
        }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: '18px', lineHeight: 1, letterSpacing: '-1px' }}>D</span>
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '16px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>DriveInnovate</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>Fleet Management</div>
          </div>
        )}
      </div>

      {/* User info */}
      {!collapsed && (
        <div style={{
          padding: '13px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: '11px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
          background: 'rgba(255,255,255,0.05)',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '15px', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div style={{ color: '#FFFFFF', fontSize: '13.5px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'User'}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || ''}</div>
          </div>
        </div>
      )}

      {!collapsed && (
        <div style={{ padding: '10px 20px 4px', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          Navigation
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 1, paddingTop: collapsed ? '6px' : '0' }}>
        {navItems.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
        {user && (user.id === 1 || user.parent_id === 0 || user.parentId === 0) && (
          <NavItem item={{ to: '/debug', label: 'Debug', Icon: BugAntIcon }} collapsed={collapsed} />
        )}
      </nav>

      {/* Logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          title={collapsed ? 'Logout' : undefined}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: '11px',
            padding: collapsed ? '14px 0' : '12px 20px',
            margin: collapsed ? '4px 0' : '4px 10px',
            borderRadius: '8px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: logoutHover ? '#FCA5A5' : 'rgba(255,255,255,0.5)',
            background: logoutHover ? 'rgba(239,68,68,0.18)' : 'transparent',
            border: 'none', width: collapsed ? '100%' : 'calc(100% - 20px)', cursor: 'pointer',
            fontSize: '13.5px', fontWeight: 600,
            transition: 'color 0.15s, background 0.15s',
          }}
        >
          <ArrowRightOnRectangleIcon style={{ width: '18px', height: '18px', flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

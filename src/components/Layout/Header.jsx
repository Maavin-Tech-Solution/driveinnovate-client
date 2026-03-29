import React from 'react';
import { useLocation } from 'react-router-dom';
import { toISTDateString } from '../../utils/dateFormat';
import { Bars3Icon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import NotificationBell from '../common/NotificationBell';

const pageTitles = {
  '/dashboard':        { title: 'Dashboard',       subtitle: 'Fleet overview & live tracking' },
  '/my-fleet':         { title: 'My Fleet',         subtitle: 'All registered vehicles' },
  '/groups':           { title: 'Groups',           subtitle: 'Organize vehicles into monitored groups' },
  '/add-vehicle':      { title: 'Add Vehicle',      subtitle: 'Register a new vehicle' },
  '/add-client':       { title: 'Add Client',       subtitle: 'Register a new client' },
  '/my-clients':       { title: 'My Clients',       subtitle: 'Manage clients & permissions' },
  '/rto-details':      { title: 'RTO Details',      subtitle: 'Insurance, fitness & compliance' },
  '/challans':         { title: 'Challans',         subtitle: 'Traffic violations & penalties' },
  '/reports':          { title: 'Reports',          subtitle: 'Analytics & insights' },
  '/vehicle-settings': { title: 'Vehicle Settings', subtitle: 'Configure speed & alerts' },
  '/geofences':        { title: 'Geofences',         subtitle: 'Virtual boundaries for vehicles & groups' },
  '/alerts':           { title: 'Alerts',           subtitle: 'Real-time fleet monitoring rules' },
  '/notifications':    { title: 'Notifications',    subtitle: 'Alert history & inbox' },
  '/support':          { title: 'Support Center',   subtitle: 'Raise and track support tickets' },
  '/profile':          { title: 'Profile',          subtitle: 'Account settings & preferences' },
  '/user-activity':    { title: 'User Activity',    subtitle: 'Action logs & history' },
  '/master-settings':  { title: 'Master Settings',  subtitle: 'Device types & vehicle state definitions' },
};

const Header = ({ onToggleSidebar }) => {
  const location = useLocation();
  let meta = pageTitles[location.pathname];
  if (!meta && location.pathname.startsWith('/my-clients/')) {
    meta = { title: 'Client Detail', subtitle: 'View client profile & vehicles' };
  }
  meta = meta || { title: 'DriveInnovate', subtitle: '' };

  return (
    <header style={{
      height: '64px',
      background: 'var(--theme-sidebar-bg)',
      borderBottom: '1px solid rgba(255,255,255,0.10)',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '14px',
      paddingRight: '22px',
      gap: '14px',
      position: 'sticky',
      top: 0,
      zIndex: 5000,
      flexShrink: 0,
      boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
    }}>
      <button
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        style={{
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.18)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '7px', borderRadius: '8px',
          color: '#fff',
          transition: 'background 0.1s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
      >
        <Bars3Icon style={{ width: '21px', height: '21px' }} />
      </button>

      <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />

      <div>
        <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{meta.title}</div>
        {meta.subtitle && <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.65)', marginTop: '1px' }}>{meta.subtitle}</div>}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          fontSize: '12.5px', color: 'rgba(255,255,255,0.9)',
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.18)',
          padding: '5px 13px', borderRadius: '20px',
          fontWeight: 600,
        }}>
          <CalendarDaysIcon style={{ width: '13px', height: '13px' }} />
          {toISTDateString(new Date())}
        </div>
        <NotificationBell />
      </div>
    </header>
  );
};

export default Header;

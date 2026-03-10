import React from 'react';
import { useLocation } from 'react-router-dom';
import { toISTDateString } from '../../utils/dateFormat';

const pageTitles = {
  '/dashboard':     { title: 'Dashboard',     subtitle: 'Overview of your fleet' },
  '/my-fleet':      { title: 'My Fleet',       subtitle: 'All registered vehicles' },
  '/add-vehicle':   { title: 'Add Vehicle',    subtitle: 'Register a new vehicle' },
  '/rto-details':   { title: 'RTO Details',    subtitle: 'Insurance, fitness & compliance' },
  '/challans':      { title: 'Challans',       subtitle: 'Traffic violations & penalties' },
  '/vehicle-settings': { title: 'Vehicle Settings', subtitle: 'Configure speed ranges & alerts' },
  '/profile':       { title: 'Profile',        subtitle: 'Account settings & preferences' },
  '/user-activity': { title: 'User Activity',  subtitle: 'Action logs & history' },
};

const Header = ({ onToggleSidebar }) => {
  const location = useLocation();
  const meta = pageTitles[location.pathname] || { title: 'DriveInnovate', subtitle: '' };

  return (
    <header style={{
      height: '64px',
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '20px',
      paddingRight: '24px',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <button
        onClick={onToggleSidebar}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px',
        }}
        title="Toggle sidebar"
      >
        <span style={{ display: 'block', width: '20px', height: '2px', background: '#64748b', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '20px', height: '2px', background: '#64748b', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '20px', height: '2px', background: '#64748b', borderRadius: '1px' }} />
      </button>

      <div>
        <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>{meta.title}</h1>
        {meta.subtitle && (
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{meta.subtitle}</p>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          fontSize: '12px', color: '#64748b',
          background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px',
        }}>
          {toISTDateString(new Date())}
        </div>
      </div>
    </header>
  );
};

export default Header;

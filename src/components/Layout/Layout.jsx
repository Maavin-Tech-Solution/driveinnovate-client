import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = () => {
  // CLOSED by default (collapsed = true)
  const [collapsed, setCollapsed] = useState(true);
  const sidebarWidth = collapsed ? 62 : 260;

  useEffect(() => {
    const handler = () => setCollapsed(true);
    window.addEventListener('fleet:closeSidebar', handler);
    return () => window.removeEventListener('fleet:closeSidebar', handler);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FFFFFF' }}>
      <Sidebar collapsed={collapsed} />

      <div style={{
        marginLeft: `${sidebarWidth}px`,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-left 0.22s ease',
        minHeight: '100vh',
      }}>
        <Header onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main style={{ flex: 1, padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

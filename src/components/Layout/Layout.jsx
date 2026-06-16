import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = () => {
  // CLOSED by default (collapsed = true)
  const [collapsed, setCollapsed] = useState(true);
  const sidebarWidth = collapsed ? 109 : 260;

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
        minWidth: 0, // allow this column to shrink so wide children scroll internally
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-left 0.22s ease',
        height: '100vh',
      }}>
        <Header onToggleSidebar={() => setCollapsed((c) => !c)} />
        {/* Scroll vertically only — wide content (e.g. the fleet table) scrolls
            within its own .table-container, so toolbars/filters above the table
            stay fixed within the page width instead of scrolling sideways. */}
        <main style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getUnreadCount, getNotifications, markAsRead, markAllAsRead } from '../../services/notification.service';

const TYPE_META = {
  SPEED_EXCEEDED: { icon: '🏎️', color: '#dc2626' },
  NOT_MOVING:     { icon: '🅿️', color: '#d97706' },
  IDLE_ENGINE:    { icon: '⏸️', color: '#7c3aed' },
};

const fmtDate = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString('en-IN');
};

const POLL_INTERVAL = 30000; // 30 s

const NotificationBell = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const dropRef = useRef(null);    // wraps the portal dropdown div
  const bellRef = useRef(null);
  const pollRef = useRef(null);

  // Poll unread count
  const fetchCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      setCount(res.data?.count ?? 0);
    } catch { /* silent — don't disrupt UI */ }
  }, []);

  useEffect(() => {
    fetchCount();
    pollRef.current = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchCount]);

  // Fetch recent 8 notifications when dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoadingRecent(true);
    getNotifications({ page: 0, limit: 8 })
      .then(res => setRecent(res.data?.notifications || []))
      .catch(() => {})
      .finally(() => setLoadingRecent(false));
  }, [open]);

  // Close on outside click — must check both the bell wrapper and the portal dropdown
  const portalRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      const inBell = dropRef.current && dropRef.current.contains(e.target);
      const inPortal = portalRef.current && portalRef.current.contains(e.target);
      if (!inBell && !inPortal) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleRead = async (e, id) => {
    e.stopPropagation();
    try {
      await markAsRead(id);
      setRecent(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setCount(c => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      setRecent(prev => prev.map(n => ({ ...n, isRead: true })));
      setCount(0);
    } catch { /* silent */ }
  };

  const goToAll = () => { setOpen(false); navigate('/notifications'); };
  const goToAlerts = () => { setOpen(false); navigate('/alerts'); };

  const handleToggle = () => {
    if (!open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  const unreadInDropdown = recent.filter(n => !n.isRead).length;

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={handleToggle}
        title="Notifications"
        style={{
          position: 'relative',
          width: 38, height: 38,
          borderRadius: 10,
          background: open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.18)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {count > 0 && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            background: '#dc2626', color: '#fff',
            fontSize: 9, fontWeight: 800,
            minWidth: 16, height: 16, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            border: '2px solid var(--theme-sidebar-bg, #1e3a5f)',
            lineHeight: 1,
          }}>
            {count > 99 ? '99+' : count}
          </div>
        )}
      </button>

      {/* Dropdown — rendered as a portal into document.body so it escapes any stacking context */}
      {open && createPortal(
        <div ref={portalRef} style={{
          position: 'fixed', top: `${dropPos.top}px`, right: `${dropPos.right}px`,
          width: 380, maxWidth: '95vw',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)',
          border: '1px solid #e2e8f0',
          zIndex: 9999,
          overflow: 'hidden',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {/* Dropdown header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Notifications</div>
              {count > 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{count} unread</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {unreadInDropdown > 0 && (
                <button onClick={handleMarkAll}
                  style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, borderRadius: 6, fontFamily: 'inherit' }}>
                  ✓ All read
                </button>
              )}
              <button onClick={goToAlerts}
                style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, borderRadius: 6, fontFamily: 'inherit' }}>
                ⚙ Alerts
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loadingRecent ? (
              <div style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
            ) : recent.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>No notifications yet</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Configure alerts to get notified.</div>
              </div>
            ) : (
              recent.map(n => {
                const meta = TYPE_META[n.alertType] || { icon: '🔔', color: '#2563eb' };
                return (
                  <div key={n.id}
                    style={{ padding: '11px 16px', borderBottom: '1px solid #f8fafc', background: n.isRead ? '#fff' : '#eff6ff', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = n.isRead ? '#f8fafc' : '#dbeafe'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = n.isRead ? '#fff' : '#eff6ff'; }}
                    onClick={() => { setOpen(false); navigate('/notifications'); }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${meta.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, position: 'relative' }}>
                      {meta.icon}
                      {!n.isRead && <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: meta.color, border: '2px solid #eff6ff' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{fmtDate(n.triggeredAt)}</div>
                    </div>
                    {!n.isRead && (
                      <button onClick={e => handleRead(e, n.id)}
                        title="Mark as read"
                        style={{ width: 24, height: 24, border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', borderRadius: 5, fontSize: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                        ✓
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <button onClick={goToAll}
              style={{ width: '100%', padding: '8px', background: 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, borderRadius: 7, fontFamily: 'inherit' }}>
              View All Notifications →
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default NotificationBell;

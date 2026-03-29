import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from '../services/notification.service';

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_META = {
  SPEED_EXCEEDED: { icon: '🏎️', color: '#dc2626', label: 'Speed Exceeded' },
  NOT_MOVING:     { icon: '🅿️', color: '#d97706', label: 'Not Moving' },
  IDLE_ENGINE:    { icon: '⏸️', color: '#7c3aed', label: 'Engine Idle' },
};
const VEHICLE_ICON_MAP = { car:'🚗',suv:'🚙',truck:'🚛',bus:'🚌',bike:'🏍️',auto:'🛺',van:'🚐',ambulance:'🚑',pickup:'🛻' };
const PAGE_SIZE = 30;

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const now = new Date();
  const diffMs = now - dt;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return dt.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
};

const fmtFull = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, accent, sub }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{ width: 46, height: 46, borderRadius: 11, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: accent, marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

// ─── Notification Card ────────────────────────────────────────────────────────
const NotifCard = ({ n, onRead, onDelete }) => {
  const meta = TYPE_META[n.alertType] || { icon: '🔔', color: '#2563eb', label: n.alertType || 'Alert' };
  const vehicleEmoji = VEHICLE_ICON_MAP[n.vehicle?.vehicleIcon] || '🚗';

  return (
    <div style={{
      background: n.isRead ? '#fff' : '#eff6ff',
      border: `1px solid ${n.isRead ? '#e2e8f0' : '#bfdbfe'}`,
      borderTop: `3px solid ${n.isRead ? '#e2e8f0' : meta.color}`,
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', gap: 12, transition: 'all 0.2s',
      position: 'relative',
    }}>
      {/* Icon */}
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${meta.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, position: 'relative' }}>
        {meta.icon}
        {!n.isRead && (
          <div style={{ position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: '50%', background: meta.color, border: '2px solid #eff6ff' }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{n.title}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `${meta.color}14`, color: meta.color }}>{meta.label}</span>
          {!n.isRead && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: meta.color, color: '#fff' }}>NEW</span>}
        </div>

        <div style={{ fontSize: 12, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>{n.message}</div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#64748b' }}>
          {n.vehicle && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {vehicleEmoji} {n.vehicle.vehicleName || n.vehicle.vehicleNumber || `Vehicle #${n.vehicleId}`}
            </span>
          )}
          {n.metadata?.speed != null && (
            <span style={{ color: meta.color, fontWeight: 700 }}>🏎 {n.metadata.speed} km/h</span>
          )}
          {n.metadata?.lat && n.metadata?.lng && (
            <span>📍 {parseFloat(n.metadata.lat).toFixed(4)}, {parseFloat(n.metadata.lng).toFixed(4)}</span>
          )}
          <span>🕐 {fmtFull(n.triggeredAt)}</span>
          {n.emailSent && <span style={{ color: '#16a34a' }}>📧 Email sent</span>}
        </div>
        {n.alert?.name && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Rule: {n.alert.name}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
        {!n.isRead && (
          <button onClick={() => onRead(n.id)} title="Mark as read"
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', borderRadius: 7, fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
            ✓
          </button>
        )}
        <button onClick={() => onDelete(n.id)} title="Delete"
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', borderRadius: 7, fontSize: 12 }}>
          ✕
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState('ALL');
  const [filterRead, setFilterRead] = useState('ALL');

  const unreadCount  = notifications.filter(n => !n.isRead).length;
  const emailSentCount = notifications.filter(n => n.emailSent).length;

  const fetchData = useCallback(async (pg = 0) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: PAGE_SIZE };
      if (filterRead === 'UNREAD') params.unreadOnly = true;
      const res = await getNotifications(params);
      setNotifications(res.data?.notifications || []);
      setTotal(res.data?.total || 0);
      setPage(pg);
    } catch { toast.error('Failed to load notifications'); }
    finally { setLoading(false); }
  }, [filterRead]);

  useEffect(() => { fetchData(0); }, [fetchData]);

  const handleRead = async (id) => {
    try {
      await markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { toast.error('Failed to mark as read'); }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to mark all as read'); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(t => t - 1);
      toast.success('Notification deleted');
    } catch { toast.error('Failed to delete notification'); }
  };

  const filtered = filterType === 'ALL'
    ? notifications
    : notifications.filter(n => n.alertType === filterType);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Page title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Notifications</div>
          {unreadCount > 0 && (
            <span style={{ background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 800, minWidth: 20, height: 20, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAll}
            style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit' }}>
            ✓ Mark all read
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard icon="🔔" label="Total Notifications" value={total}         accent="#2563eb" />
        <StatCard icon="🔴" label="Unread"              value={unreadCount}   accent="#dc2626" sub={unreadCount > 0 ? 'Requires attention' : 'All caught up!'} />
        <StatCard icon="📧" label="Emails Sent"         value={emailSentCount} accent="#16a34a" />
        <StatCard icon="📄" label="This Page"           value={`${notifications.length} / ${total}`} accent="#7c3aed" sub={`Page ${page + 1} of ${Math.max(1, totalPages)}`} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', borderRadius: 7, padding: 3 }}>
          {[['ALL', 'All'], ['UNREAD', 'Unread']].map(([v, l]) => (
            <button key={v} onClick={() => { setFilterRead(v); fetchData(0); }}
              style={{ padding: '5px 14px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: filterRead === v ? 700 : 500, background: filterRead === v ? '#fff' : 'transparent', color: filterRead === v ? '#2563eb' : '#64748b', boxShadow: filterRead === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', fontFamily: 'inherit' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterType('ALL')}
            style={{ padding: '5px 12px', border: `1px solid ${filterType === 'ALL' ? '#7c3aed' : '#e2e8f0'}`, borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: filterType === 'ALL' ? 700 : 400, background: filterType === 'ALL' ? '#f5f3ff' : '#fff', color: filterType === 'ALL' ? '#7c3aed' : '#64748b', fontFamily: 'inherit' }}>
            All Types
          </button>
          {Object.entries(TYPE_META).map(([v, m]) => (
            <button key={v} onClick={() => setFilterType(v)}
              style={{ padding: '5px 12px', border: `1px solid ${filterType === v ? m.color : '#e2e8f0'}`, borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: filterType === v ? 700 : 400, background: filterType === v ? `${m.color}12` : '#fff', color: filterType === v ? m.color : '#64748b', fontFamily: 'inherit' }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span className="spinner" /> Loading notifications…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🔕</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', marginBottom: 6 }}>No notifications</div>
          <div style={{ fontSize: 13 }}>Notifications will appear here when alert conditions are met.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 12 }}>
          {filtered.map(n => (
            <NotifCard key={n.id} n={n} onRead={handleRead} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24 }}>
          <button onClick={() => fetchData(page - 1)} disabled={page === 0 || loading}
            style={{ padding: '7px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: page === 0 ? 0.5 : 1, fontWeight: 600 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Page {page + 1} / {totalPages}</span>
          <button onClick={() => fetchData(page + 1)} disabled={page >= totalPages - 1 || loading}
            style={{ padding: '7px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: page >= totalPages - 1 ? 0.5 : 1, fontWeight: 600 }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications;

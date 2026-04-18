import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardUserStats, getOverspeedVehicles, getNetworkStats } from '../services/dashboard.service';
import { getActivities } from '../services/activity.service';
import { getSettings } from '../services/settings.service';
import { useAuth } from '../context/AuthContext';
import {
  TruckIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ClockIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  UserPlusIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  BellAlertIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

// ── Utility ─────────────────────────────────────────────────────────────
const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
const fmtDateShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short' });
const fmtRelative = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── Stat card (colorful, clickable) ─────────────────────────────────────
const StatCard = ({ label, value, Icon, gradient, to, subtitle, trend }) => {
  const card = (
    <div style={{
      background: gradient,
      border: 'none',
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.10)',
      transition: 'transform 0.18s, box-shadow 0.18s',
      cursor: to ? 'pointer' : 'default',
      minHeight: 128,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(15,23,42,0.18)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.10)'; }}
    >
      {/* decorative icon bubble */}
      <div style={{ position: 'absolute', right: -18, top: -18, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 18, top: 18, width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
        <Icon style={{ width: 20, height: 20, color: '#fff' }} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase', letterSpacing: '0.08em', position: 'relative', zIndex: 1 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', position: 'relative', zIndex: 1 }}>{value}</div>
      {(subtitle || trend != null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', fontWeight: 600, position: 'relative', zIndex: 1 }}>
          {trend != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.18)', padding: '2px 7px', borderRadius: 10 }}>
              <ArrowTrendingUpIcon style={{ width: 12, height: 12, transform: trend < 0 ? 'rotate(180deg)' : 'none' }} />
              {Math.abs(trend)}%
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{card}</Link> : card;
};

// ── Mini horizontal progress bar ────────────────────────────────────────
const ProgressRow = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ fontWeight: 600, color: '#334155' }}>{label}</span>
        <span style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(value)} <span style={{ color: '#94A3B8', fontSize: 10, marginLeft: 3 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 8, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.6s' }} />
      </div>
    </div>
  );
};

// ── SVG bar chart (last N days) ─────────────────────────────────────────
const BarChart = ({ data, height = 160, accent = '#2563EB' }) => {
  const W = 100;
  const max = Math.max(1, ...data.map(d => d.value));
  const barW = W / data.length;
  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        {/* grid */}
        {[0.25, 0.5, 0.75].map(p => (
          <line key={p} x1="0" y1={height * p} x2={W} y2={height * p} stroke="#F1F5F9" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 28);
          const x = i * barW + barW * 0.18;
          const w = barW * 0.64;
          const y = height - 22 - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h || 0.5} fill={accent} rx="0.8" />
              <text x={i * barW + barW / 2} y={y - 2.5} fontSize="4" textAnchor="middle" fill="#64748B" fontWeight="700">{d.value || ''}</text>
              <text x={i * barW + barW / 2} y={height - 10} fontSize="4" textAnchor="middle" fill="#94A3B8">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ── Donut (fleet status) ────────────────────────────────────────────────
const Donut = ({ slices, size = 150 }) => {
  const total = slices.reduce((s, x) => s + (x.value || 0), 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {total > 0 && slices.map((s, i) => {
          const pct = (s.value || 0) / total;
          const length = c * pct;
          const dasharray = `${length} ${c - length}`;
          const dashoffset = -offset;
          offset += length;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={dasharray} strokeDashoffset={dashoffset} transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt" />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(total)}</div>
        <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const isNetworkUser = user?.role === 'papa' || user?.role === 'dealer' || Number(user?.parentId) === 0;

  const [stats, setStats] = useState(null);
  const [networkStats, setNetworkStats] = useState(null);
  const [overspeedVehicles, setOverspeedVehicles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tasks = [
      getDashboardUserStats().then(r => setStats(r.data)).catch(() => {}),
      getSettings().then(r => {
        const d = r.data?.success && r.data.data ? r.data.data : r.data;
        const threshold = d?.speedThreshold || 80;
        return getOverspeedVehicles(threshold).then(or => {
          const od = or.data?.success && or.data.data ? or.data.data : or.data;
          setOverspeedVehicles(Array.isArray(od) ? od : []);
        });
      }).catch(() => {}),
      getActivities({ page: 1, limit: 30 }).then(r => {
        const rows = r.data?.data?.activities || r.data?.activities || r.data?.data || r.data || [];
        setActivities(Array.isArray(rows) ? rows : []);
      }).catch(() => {}),
    ];
    if (isNetworkUser) {
      tasks.push(getNetworkStats().then(r => setNetworkStats(r.data)).catch(() => {}));
    }
    Promise.allSettled(tasks).finally(() => setLoading(false));
  }, [isNetworkUser]);

  // ── derived: fleet breakdown ──
  const active   = stats?.vehicleStatusWise?.active ?? 0;
  const inactive = stats?.vehicleStatusWise?.inactive ?? 0;
  const deleted  = stats?.vehicleStatusWise?.deleted ?? 0;
  const totalReg = stats?.registeredVehicles ?? (active + inactive + deleted);

  // ── derived: last-7-day activity buckets ──
  const weekActivity = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ date: d, label: fmtDay(d), value: 0 });
    }
    activities.forEach(a => {
      const t = new Date(a.createdAt || a.timestamp || a.date);
      if (!isFinite(t.getTime())) return;
      const idx = days.findIndex(d => {
        const next = new Date(d.date); next.setDate(next.getDate() + 1);
        return t >= d.date && t < next;
      });
      if (idx >= 0) days[idx].value += 1;
    });
    return days;
  }, [activities]);

  const weekTotal = weekActivity.reduce((s, d) => s + d.value, 0);
  const prevPeriodCount = activities.length - weekTotal;
  const weekTrend = prevPeriodCount > 0 ? Math.round(((weekTotal - prevPeriodCount) / prevPeriodCount) * 100) : null;

  const donutSlices = [
    { label: 'Active',   value: active,   color: '#059669' },
    { label: 'Inactive', value: inactive, color: '#D97706' },
    { label: 'Deleted',  value: deleted,  color: '#94A3B8' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', gap: 10, color: '#94A3B8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ width: 16, height: 16, border: '2px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Loading dashboard…
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '18px 20px 28px', background: '#F8FAFC', minHeight: 'calc(100vh - 60px)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ══ Header ══ */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            Here's what's happening across your fleet today.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/add-vehicle"  style={qaBtn('#2563EB')}><PlusIcon style={{ width: 15, height: 15 }} /> Add Vehicle</Link>
          {isNetworkUser && (
            <Link to="/add-client" style={qaBtn('#059669')}><UserPlusIcon style={{ width: 15, height: 15 }} /> Add Client</Link>
          )}
          <Link to="/reports"      style={qaBtn('#7C3AED')}><ChartBarIcon style={{ width: 15, height: 15 }} /> Reports</Link>
          <Link to="/challans"     style={qaBtn('#D97706')}><DocumentTextIcon style={{ width: 15, height: 15 }} /> Challans</Link>
          <Link to="/rto-details"  style={qaBtn('#0891B2')}><ClipboardDocumentCheckIcon style={{ width: 15, height: 15 }} /> RTO</Link>
        </div>
      </div>

      {/* ══ Hero stats grid ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginBottom: 18 }}>
        {isNetworkUser && (
          <StatCard
            label="Total Clients"
            value={fmtInt(networkStats?.totalClients)}
            Icon={UsersIcon}
            gradient="linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)"
            to="/my-clients"
            subtitle="in your network"
          />
        )}
        <StatCard
          label="Registered Vehicles"
          value={fmtInt(isNetworkUser ? networkStats?.totalVehicles : totalReg)}
          Icon={TruckIcon}
          gradient="linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)"
          to="/my-fleet"
          subtitle={isNetworkUser ? 'across network' : 'your fleet'}
        />
        <StatCard
          label="Active"
          value={fmtInt(isNetworkUser ? networkStats?.activeVehicles : active)}
          Icon={CheckCircleIcon}
          gradient="linear-gradient(135deg, #10B981 0%, #047857 100%)"
          to="/my-fleet"
          subtitle="currently tracked"
        />
        <StatCard
          label="Inactive"
          value={fmtInt(isNetworkUser ? networkStats?.inactiveVehicles : inactive)}
          Icon={XCircleIcon}
          gradient="linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)"
          to="/my-fleet"
          subtitle="not reporting"
        />
      </div>

      {/* ══ Secondary stats ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginBottom: 18 }}>
        <StatCard
          label="Pending Challans"
          value={fmtInt(stats?.pendingChallans)}
          Icon={DocumentTextIcon}
          gradient="linear-gradient(135deg, #F59E0B 0%, #B45309 100%)"
          to="/challans"
          subtitle="awaiting resolution"
        />
        <StatCard
          label="Upcoming Renewals"
          value={fmtInt(stats?.upcomingRenewals)}
          Icon={ClockIcon}
          gradient="linear-gradient(135deg, #A855F7 0%, #6B21A8 100%)"
          to="/rto-details"
          subtitle="within 30 days"
        />
        <StatCard
          label="Overspeed (24h)"
          value={fmtInt(overspeedVehicles.length)}
          Icon={BoltIcon}
          gradient="linear-gradient(135deg, #EF4444 0%, #991B1B 100%)"
          to="/reports"
          subtitle={overspeedVehicles.length ? 'alerts flagged' : 'all clear'}
        />
        <StatCard
          label="Activity (7d)"
          value={fmtInt(weekTotal)}
          Icon={ArrowTrendingUpIcon}
          gradient="linear-gradient(135deg, #06B6D4 0%, #0E7490 100%)"
          to="/user-activity"
          subtitle="events logged"
          trend={weekTrend}
        />
      </div>

      {/* ══ Middle row: fleet status donut + weekly chart ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 18 }}>

        {/* Fleet status breakdown */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheckIcon style={{ width: 16, height: 16, color: '#2563EB' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Fleet Status</div>
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{fmtInt(totalReg)} vehicles</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '16px 18px' }}>
            <Donut slices={donutSlices} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ProgressRow label="Active"   value={active}   total={totalReg} color="#059669" />
              <ProgressRow label="Inactive" value={inactive} total={totalReg} color="#D97706" />
              <ProgressRow label="Deleted"  value={deleted}  total={totalReg} color="#94A3B8" />
            </div>
          </div>
        </div>

        {/* 7-day activity chart */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChartBarIcon style={{ width: 16, height: 16, color: '#7C3AED' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Last 7 Days · Activity</div>
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{fmtInt(weekTotal)} events</span>
          </div>
          <div style={{ padding: '14px 16px 16px' }}>
            <BarChart data={weekActivity} accent="#7C3AED" />
          </div>
        </div>
      </div>

      {/* ══ Bottom row: overspeed list + recent activity ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>

        {/* Overspeed violators */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#EF4444' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Overspeed Violators (24h)</div>
            </div>
            <Link to="/reports" style={linkStyle}>View all →</Link>
          </div>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            {overspeedVehicles.length === 0 ? (
              <div style={{ padding: '36px 18px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                <CheckCircleIcon style={{ width: 30, height: 30, color: '#86EFAC', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, color: '#059669', marginBottom: 3 }}>All clear</div>
                <div style={{ fontSize: 12 }}>No overspeeding detected in the last 24 hours.</div>
              </div>
            ) : (
              overspeedVehicles.slice(0, 6).map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BoltIcon style={{ width: 16, height: 16, color: '#DC2626' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vehicleNumber || `Vehicle #${v.id}`}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                      {v.overspeedCount} violation{v.overspeedCount !== 1 ? 's' : ''} · {fmtRelative(v.lastOverspeedTime)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#DC2626', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{v.maxSpeed}</div>
                    <div style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>km/h</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BellAlertIcon style={{ width: 16, height: 16, color: '#0891B2' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Recent Activity</div>
            </div>
            <Link to="/activity" style={linkStyle}>View all →</Link>
          </div>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            {activities.length === 0 ? (
              <div style={{ padding: '36px 18px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                <ClockIcon style={{ width: 30, height: 30, color: '#CBD5E1', margin: '0 auto 8px' }} />
                <div>No activity yet.</div>
              </div>
            ) : (
              activities.slice(0, 8).map((a, i) => (
                <div key={a.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 18px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0891B2', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', lineHeight: 1.35 }}>{a.message || a.description || a.action || a.type || 'Activity'}</div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
                      {a.createdAt ? `${fmtDateShort(a.createdAt)} · ${fmtRelative(a.createdAt)}` : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── styles ──────────────────────────────────────────────────────────────
const panelStyle = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const panelHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 18px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC',
};
const linkStyle = { fontSize: 11, fontWeight: 700, color: '#2563EB', textDecoration: 'none' };
const qaBtn = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', borderRadius: 8,
  background: '#fff', border: `1px solid ${color}33`,
  color, fontSize: 12, fontWeight: 700, textDecoration: 'none',
  fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
});

export default Dashboard;

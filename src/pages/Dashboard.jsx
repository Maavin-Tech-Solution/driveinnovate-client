import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardUserStats, getOverspeedVehicles, getNetworkStats } from '../services/dashboard.service';
import { getActivities } from '../services/activity.service';
import { getSettings } from '../services/settings.service';
import { getVehicles } from '../services/vehicle.service';
import { getDeviceConfigs } from '../services/master.service';
import { classifyVehicleState } from '../utils/vehicleState';
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
// Default ids — must match VehicleSettings.jsx DEFAULT_DASH_CARDS.
const DEFAULT_DASH_CARDS = ['registered','active','overspeed','inactive','gps_active','challans','renewals'];

const readVisibleCards = () => {
  try {
    const raw = JSON.parse(localStorage.getItem('dashboard-visible-cards'));
    return Array.isArray(raw) ? raw : DEFAULT_DASH_CARDS;
  } catch {
    return DEFAULT_DASH_CARDS;
  }
};

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
      borderRadius: 5,
      padding: '26px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 22px rgba(15, 23, 42, 0.12)',
      transition: 'transform 0.18s, box-shadow 0.18s',
      cursor: to ? 'pointer' : 'default',
      minHeight: 168,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 32px rgba(15,23,42,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 22px rgba(15,23,42,0.12)'; }}
    >
      {/* decorative icon bubble */}
      <div style={{ position: 'absolute', right: -22, top: -22, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 20, top: 20, width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
        <Icon style={{ width: 24, height: 24, color: '#fff' }} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase', letterSpacing: '0.08em', position: 'relative', zIndex: 1 }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', position: 'relative', zIndex: 1, letterSpacing: '-0.02em' }}>{value}</div>
      {(subtitle || trend != null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'rgba(255,255,255,0.92)', fontWeight: 600, position: 'relative', zIndex: 1, marginTop: 2 }}>
          {trend != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 10 }}>
              <ArrowTrendingUpIcon style={{ width: 13, height: 13, transform: trend < 0 ? 'rotate(180deg)' : 'none' }} />
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

// ── Radar / spider chart (fleet health) ─────────────────────────────────
const Radar = ({ axes, size = 240, color = '#2563EB' }) => {
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 46;            // leave room for outer labels
  const n = axes.length || 1;
  const ang = i => (Math.PI * 2 * i) / n - Math.PI / 2; // start at top
  const pt = (i, r) => [cx + Math.cos(ang(i)) * R * r, cy + Math.sin(ang(i)) * R * r];
  const polyFor = r => axes.map((_, i) => pt(i, r).join(',')).join(' ');
  const clamp = v => Math.max(0.02, Math.min(1, v || 0));
  const dataPoly = axes.map((a, i) => pt(i, clamp(a.value)).join(',')).join(' ');
  const score = axes.length
    ? Math.round((axes.reduce((s, a) => s + Math.max(0, Math.min(1, a.value || 0)), 0) / axes.length) * 100)
    : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
      {[0.25, 0.5, 0.75, 1].map((r, i) => (
        <polygon key={i} points={polyFor(r)} fill="none" stroke="#E2E8F0" strokeWidth="1" />
      ))}
      {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E2E8F0" strokeWidth="1" />; })}
      <polygon points={dataPoly} fill={`${color}28`} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {axes.map((a, i) => { const [x, y] = pt(i, clamp(a.value)); return <circle key={i} cx={x} cy={y} r="3" fill={color} />; })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.2);
        const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
        return <text key={i} x={x} y={y} fontSize="9.5" fontWeight="700" fill="#475569" textAnchor={anchor} dominantBaseline="middle">{a.label}</text>;
      })}
      <text x={cx} y={cy - 3} fontSize="24" fontWeight="800" fill="#0F172A" textAnchor="middle">{score}</text>
      <text x={cx} y={cy + 13} fontSize="8" fontWeight="700" fill="#94A3B8" textAnchor="middle" letterSpacing="0.1em">HEALTH</text>
    </svg>
  );
};

// ── Legend row for donut panels ─────────────────────────────────────────
const LegendRow = ({ color, label, value, total }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, color: '#334155', fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(value)}</span>
      {total > 0 && <span style={{ color: '#94A3B8', fontSize: 10.5, fontWeight: 700, width: 34, textAlign: 'right' }}>{pct}%</span>}
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

  // ── Visible cards selection (from VehicleSettings) ──────────────────────
  const [visibleCards, setVisibleCards] = useState(readVisibleCards);
  useEffect(() => {
    const refresh = () => setVisibleCards(readVisibleCards());
    window.addEventListener('dashboard-cards-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('dashboard-cards-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // ── Live vehicle list — fetched on mount (needed for state counts and the
  //    "No GPS" section that lists never-reported vehicles). ────────────────
  const [vehicles, setVehicles] = useState([]);
  const [deviceStatesByType, setDeviceStatesByType] = useState({});
  useEffect(() => {
    Promise.allSettled([getVehicles(), getDeviceConfigs()]).then(([vRes, cRes]) => {
      if (vRes.status === 'fulfilled') {
        const data = vRes.value?.data;
        setVehicles(Array.isArray(data) ? data : []);
      }
      if (cRes.status === 'fulfilled') {
        const m = {};
        (cRes.value?.data || []).forEach(d => { if (d.states?.length) m[d.type] = d.states; });
        setDeviceStatesByType(m);
      }
    });
  }, []);

  // ── Computed state counts — canonical, mutually-exclusive states ────────
  // Same classifier MyFleet uses, so the two pages can never disagree.
  const stateCounts = useMemo(() => {
    const counts = {};
    if (!vehicles.length) return counts;
    vehicles.forEach(v => {
      const result = classifyVehicleState(v.deviceStatus, { vehicleId: v.id });
      const key = (result?.stateName || 'no_data').toLowerCase().replace(/\s+/g, '_');
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [vehicles]);

  // ── "No GPS" vehicles — not a single packet has ever arrived from the device.
  // (No GPS fix AND no server-recorded update timestamp.) ────────────────────
  const noGpsVehicles = useMemo(() => {
    // Matches the MyFleet "No Data" chip exactly so the dashboard count and the
    // /my-fleet?chip=nodata filtered list agree: no lastUpdate, no gps timestamp,
    // and no latitude — i.e. not a single packet has ever arrived.
    return vehicles.filter(v => {
      const g = v.deviceStatus?.gpsData || {};
      return !v.deviceStatus?.lastUpdate && !g.timestamp && (g.latitude ?? g.lat) == null;
    });
  }, [vehicles]);

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

  // ── derived: graph datasets for the redesigned dashboard ──
  const gpsActive = stats?.gpsActive ?? 0;
  const noGps     = Math.max(0, totalReg - gpsActive);
  const challans  = stats?.pendingChallans ?? 0;
  const renewals  = stats?.upcomingRenewals ?? 0;
  const issues    = Math.min(totalReg, challans + renewals);
  const clear     = Math.max(0, totalReg - issues);

  const ratio = (num, den) => (den > 0 ? Math.max(0, Math.min(1, num / den)) : 0);
  // Fleet-health radar — each axis normalised 0..1 (higher = healthier).
  const healthAxes = [
    { label: 'Active',       value: ratio(active, totalReg) },
    { label: 'GPS Coverage', value: ratio(gpsActive, totalReg) },
    { label: 'Renewals OK',  value: totalReg ? 1 - ratio(renewals, totalReg) : 0 },
    { label: 'Challan-Free', value: totalReg ? 1 - ratio(challans, totalReg) : 0 },
    { label: 'Activity',     value: Math.min(1, weekTotal / Math.max(8, totalReg)) },
  ];
  const connectivitySlices = [
    { label: 'Reporting GPS',    value: gpsActive, color: '#0EA5E9' },
    { label: 'No recent signal', value: noGps,     color: '#CBD5E1' },
  ];
  const complianceSlices = [
    { label: 'Clear',            value: clear,    color: '#16A34A' },
    { label: 'Pending Challans', value: challans, color: '#F59E0B' },
    { label: 'Renewals (30d)',   value: renewals, color: '#A855F7' },
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

      {/* ══ Stat grid — driven by visibleCards from VehicleSettings ══ */}
      {(() => {
        // Card registry — id ↔ render config. Order in CARD_DEFS_ORDER is the
        // display order; selection in visibleCards controls which actually render.
        const CARD_DEFS = {
          clients: {
            label: 'Total Clients', value: fmtInt(networkStats?.totalClients),
            Icon: UsersIcon, to: '/my-clients', subtitle: 'in your network',
            gradient: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
            requiresNetwork: true,
          },
          registered: {
            label: 'Registered Vehicles',
            value: fmtInt(isNetworkUser ? networkStats?.totalVehicles : totalReg),
            Icon: TruckIcon, to: '/my-fleet',
            subtitle: isNetworkUser ? 'across network' : 'your fleet',
            gradient: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
          },
          active: {
            label: 'Active',
            value: fmtInt(isNetworkUser ? networkStats?.activeVehicles : active),
            Icon: CheckCircleIcon, to: '/my-fleet', subtitle: 'currently tracked',
            gradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
          },
          inactive: {
            label: 'Inactive',
            value: fmtInt(isNetworkUser ? networkStats?.inactiveVehicles : inactive),
            Icon: XCircleIcon, to: '/my-fleet', subtitle: 'not reporting',
            gradient: 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)',
          },
          deleted: {
            label: 'Deleted', value: fmtInt(deleted),
            Icon: XCircleIcon, to: '/my-fleet', subtitle: 'soft-deleted',
            gradient: 'linear-gradient(135deg, #94A3B8 0%, #475569 100%)',
          },
          gps_active: {
            label: 'GPS Active', value: fmtInt(stats?.gpsActive),
            Icon: ShieldCheckIcon, to: '/my-fleet', subtitle: 'reporting GPS',
            gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)',
          },
          challans: {
            label: 'Pending Challans', value: fmtInt(stats?.pendingChallans),
            Icon: DocumentTextIcon, to: '/challans', subtitle: 'awaiting resolution',
            gradient: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
          },
          renewals: {
            label: 'Upcoming Renewals', value: fmtInt(stats?.upcomingRenewals),
            Icon: ClockIcon, to: '/rto-details', subtitle: 'within 30 days',
            gradient: 'linear-gradient(135deg, #A855F7 0%, #6B21A8 100%)',
          },
          overspeed: {
            label: 'Overspeed (24h)', value: fmtInt(overspeedVehicles.length),
            Icon: BoltIcon, to: '/reports',
            subtitle: overspeedVehicles.length ? 'alerts flagged' : 'all clear',
            gradient: 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)',
          },
          activity: {
            label: 'Activity (7d)', value: fmtInt(weekTotal),
            Icon: ArrowTrendingUpIcon, to: '/user-activity', subtitle: 'events logged',
            gradient: 'linear-gradient(135deg, #06B6D4 0%, #0E7490 100%)',
            trend: weekTrend,
          },
          // ── Live state cards (require vehicle list fetched above) ─────────
          state_offline: {
            label: 'Offline', value: fmtInt(stateCounts.offline || 0),
            Icon: ExclamationTriangleIcon, to: '/my-fleet', subtitle: 'no data ≥ 10 min',
            gradient: 'linear-gradient(135deg, #64748B 0%, #334155 100%)',
          },
          state_speeding: {
            label: 'Speeding', value: fmtInt(overspeedVehicles.length || 0),
            Icon: BoltIcon, to: '/my-fleet', subtitle: 'over threshold',
            gradient: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
          },
          state_running: {
            label: 'Running', value: fmtInt(stateCounts.running || 0),
            Icon: CheckCircleIcon, to: '/my-fleet', subtitle: 'in motion',
            gradient: 'linear-gradient(135deg, #16A34A 0%, #047857 100%)',
          },
          state_stopped: {
            label: 'Stopped', value: fmtInt(stateCounts.stopped || 0),
            Icon: XCircleIcon, to: '/my-fleet', subtitle: 'parked / engine off',
            gradient: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
          },
          state_nodata: {
            label: 'No Data', value: fmtInt(stateCounts.no_data || 0),
            Icon: ShieldCheckIcon, to: '/my-fleet', subtitle: 'never connected',
            gradient: 'linear-gradient(135deg, #64748B 0%, #94A3B8 100%)',
          },
        };

        // Render in the order the user saved (visibleCards), skipping
        // unknown ids and skipping clients-card for non-network users.
        const cards = visibleCards
          .map(id => CARD_DEFS[id] && { id, ...CARD_DEFS[id] })
          .filter(Boolean)
          .filter(c => !c.requiresNetwork || isNetworkUser);

        if (cards.length === 0) {
          return (
            <div style={{ padding: '20px 24px', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 12, color: '#64748B', fontSize: 13, marginBottom: 18, textAlign: 'center' }}>
              No dashboard cards selected. Open <strong>Settings → Vehicle Settings</strong> to enable them.
            </div>
          );
        }

        // Force at least 4 columns at desktop width. The clamp lets the grid
        // collapse to 2 / 1 columns on narrower viewports so cards stay legible
        // on tablets and phones.
        const gridCols = `repeat(auto-fit, minmax(clamp(180px, 24%, 260px), 1fr))`;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 18, marginBottom: 22 }}>
            {cards.map(c => (
              <StatCard
                key={c.id}
                label={c.label} value={c.value} Icon={c.Icon}
                gradient={c.gradient} to={c.to} subtitle={c.subtitle}
                trend={c.trend}
              />
            ))}
          </div>
        );
      })()}

      {/* ══ Row 1: Fleet-health radar + fleet-status donut ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14, marginBottom: 14 }}>

        {/* Fleet health — spider/radar */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowTrendingUpIcon style={{ width: 16, height: 16, color: '#2563EB' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Fleet Health</div>
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>across {healthAxes.length} dimensions</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 18px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Radar axes={healthAxes} color="#2563EB" />
            <div style={{ flex: 1, minWidth: 170, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {healthAxes.map(a => (
                <ProgressRow key={a.label} label={a.label} value={Math.round(a.value * 100)} total={100} color="#2563EB" />
              ))}
            </div>
          </div>
        </div>

        {/* Fleet status — donut */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheckIcon style={{ width: 16, height: 16, color: '#059669' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Fleet Status</div>
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{fmtInt(totalReg)} vehicles</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 18px' }}>
            <Donut slices={donutSlices} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <LegendRow color="#059669" label="Active"   value={active}   total={totalReg} />
              <LegendRow color="#D97706" label="Inactive" value={inactive} total={totalReg} />
              <LegendRow color="#94A3B8" label="Deleted"  value={deleted}  total={totalReg} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ Row 2: connectivity donut + compliance donut ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>

        {/* GPS connectivity — donut */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheckIcon style={{ width: 16, height: 16, color: '#0EA5E9' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>GPS Connectivity</div>
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{totalReg ? Math.round(ratio(gpsActive, totalReg) * 100) : 0}% reporting</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 18px' }}>
            <Donut slices={connectivitySlices} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <LegendRow color="#0EA5E9" label="Reporting GPS"     value={gpsActive} total={totalReg} />
              <LegendRow color="#CBD5E1" label="No recent signal"  value={noGps}     total={totalReg} />
            </div>
          </div>
        </div>

        {/* Compliance snapshot — donut */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DocumentTextIcon style={{ width: 16, height: 16, color: '#F59E0B' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Compliance</div>
            </div>
            <Link to="/challans" style={linkStyle}>Manage →</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 18px' }}>
            <Donut slices={complianceSlices} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <LegendRow color="#16A34A" label="Clear"            value={clear}    total={totalReg} />
              <LegendRow color="#F59E0B" label="Pending Challans" value={challans} total={totalReg} />
              <LegendRow color="#A855F7" label="Renewals (30d)"   value={renewals} total={totalReg} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ No GPS — devices that have never sent a single packet ══ */}
      {noGpsVehicles.length > 0 && (() => {
        const fleetTotal = vehicles.length || noGpsVehicles.length;
        const noGpsCount = noGpsVehicles.length;
        const reporting  = Math.max(0, fleetTotal - noGpsCount);
        const pct        = fleetTotal > 0 ? Math.round((noGpsCount / fleetTotal) * 100) : 0;
        const noGpsSlices = [
          { label: 'No GPS',    value: noGpsCount, color: '#94A3B8' },
          { label: 'Reporting', value: reporting,  color: '#0EA5E9' },
        ];
        return (
          <div style={{ ...panelStyle, marginTop: 14 }}>
            <div style={panelHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#94A3B8' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>No GPS</div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', background: '#E2E8F0', borderRadius: 20, padding: '2px 9px' }}>
                  {noGpsCount}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>not a single packet received</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 18px', flexWrap: 'wrap' }}>
              <Donut slices={noGpsSlices} />
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 34, fontWeight: 800, color: '#475569', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(noGpsCount)}</span>
                  <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>of {fmtInt(fleetTotal)} vehicles ({pct}%)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <LegendRow color="#94A3B8" label="No GPS — never reported" value={noGpsCount} total={fleetTotal} />
                  <LegendRow color="#0EA5E9" label="Reporting"               value={reporting}  total={fleetTotal} />
                </div>
                <div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.5 }}>
                  These devices have never reported — check installation, power and SIM connectivity.
                </div>
                <Link
                  to="/my-fleet?chip=nodata"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                    padding: '9px 16px', background: '#1B2A4A', color: '#fff', borderRadius: 8,
                    fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  <TruckIcon style={{ width: 15, height: 15 }} />
                  Track No GPS vehicles →
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
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

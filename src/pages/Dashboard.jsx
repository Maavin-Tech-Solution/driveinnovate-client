import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getDashboardUserStats, getOverspeedVehicles, getNetworkStats } from '../services/dashboard.service';
import { getVehicles } from '../services/vehicle.service';
import { getSettings } from '../services/settings.service';
import { useAuth } from '../context/AuthContext';
import {
  SignalIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  UserPlusIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  MapIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const INDIA_CENTER = [22.9734, 78.6569];

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const getVehicleCoordinates = (vehicle) => {
  if (vehicle.deviceStatus?.gpsData) {
    const lat = toNumber(vehicle.deviceStatus.gpsData.latitude ?? vehicle.deviceStatus.gpsData.lat);
    const lng = toNumber(vehicle.deviceStatus.gpsData.longitude ?? vehicle.deviceStatus.gpsData.lng);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  if (vehicle.gpsData) {
    const lat = toNumber(vehicle.gpsData.latitude ?? vehicle.gpsData.lat);
    const lng = toNumber(vehicle.gpsData.longitude ?? vehicle.gpsData.lng);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  return null;
};

const getVehicleStatus = (v, speedThreshold) => {
  const coords = getVehicleCoordinates(v);
  if (!coords) return 'no_gps';
  const ign = v.deviceStatus?.gpsData?.ignition ?? v.deviceStatus?.status?.ignition;
  const speed = v.deviceStatus?.gpsData?.speed ?? 0;
  if (speed > speedThreshold) return 'overspeed';
  if (ign === 1 || ign === true || speed > 2) return 'running';
  return 'stopped';
};

const STATUS_CONFIG = {
  all:       { label: 'All',       color: '#2563EB', bg: '#EFF6FF' },
  running:   { label: 'Running',   color: '#059669', bg: '#D1FAE5' },
  stopped:   { label: 'Stopped',   color: '#DC2626', bg: '#FEE2E2' },
  no_gps:    { label: 'No GPS',    color: '#D97706', bg: '#FEF3C7' },
  overspeed: { label: 'Overspeed', color: '#B91C1C', bg: '#FEE2E2' },
};

// Recenter map when center changes
const MapCenterer = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom() < 8 ? 8 : map.getZoom(), { duration: 0.8 });
  }, [center, map]);
  return null;
};

const Dashboard = () => {
  const { user } = useAuth();
  const isNetworkUser = user?.role === 'papa' || user?.role === 'dealer' || Number(user?.parentId) === 0;

  const [stats, setStats] = useState(null);
  const [networkStats, setNetworkStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speedThreshold, setSpeedThreshold] = useState(80);
  const [overspeedVehicles, setOverspeedVehicles] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapStyle, setMapStyle] = useState('roadmap');
  const [flyToCoords, setFlyToCoords] = useState(null);

  useEffect(() => {
    if (isNetworkUser) {
      getNetworkStats().then(res => setNetworkStats(res.data || null)).catch(() => {});
    }
  }, [isNetworkUser]);

  useEffect(() => {
    Promise.all([getDashboardUserStats(), getVehicles(), getSettings()])
      .then(([statsRes, vehiclesRes, settingsRes]) => {
        setStats(statsRes.data);
        setVehicles(vehiclesRes.data || []);
        let settingsData;
        if (settingsRes.data.success && settingsRes.data.data) settingsData = settingsRes.data.data;
        else if (settingsRes.data.speedThreshold !== undefined) settingsData = settingsRes.data;
        if (settingsData) {
          const threshold = settingsData.speedThreshold || 80;
          setSpeedThreshold(threshold);
          return getOverspeedVehicles(threshold);
        }
      })
      .then((overspeedRes) => {
        if (overspeedRes) {
          if (overspeedRes.data.success && overspeedRes.data.data) setOverspeedVehicles(overspeedRes.data.data);
          else if (Array.isArray(overspeedRes.data)) setOverspeedVehicles(overspeedRes.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activeVehicles = useMemo(
    () => vehicles.filter((v) => (v.status || '').toLowerCase() === 'active'),
    [vehicles]
  );

  // Enrich with coords and status
  const enrichedVehicles = useMemo(
    () => activeVehicles.map(v => ({
      ...v,
      coords: getVehicleCoordinates(v),
      _status: getVehicleStatus(v, speedThreshold),
    })),
    [activeVehicles, speedThreshold]
  );

  const counts = useMemo(() => {
    const c = { all: enrichedVehicles.length, running: 0, stopped: 0, no_gps: 0, overspeed: 0 };
    enrichedVehicles.forEach(v => { c[v._status] = (c[v._status] || 0) + 1; });
    return c;
  }, [enrichedVehicles]);

  // Apply status filter + search
  const filteredVehicles = useMemo(() => {
    let list = enrichedVehicles;
    if (statusFilter !== 'all') list = list.filter(v => v._status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        (v.vehicleNumber || '').toLowerCase().includes(q) ||
        (v.vehicleName || '').toLowerCase().includes(q) ||
        (v.imei || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrichedVehicles, statusFilter, search]);

  const mapVehicles = useMemo(() => filteredVehicles.filter(v => v.coords), [filteredVehicles]);

  const mapCenter = useMemo(() => {
    if (!mapVehicles.length) return INDIA_CENTER;
    const avgLat = mapVehicles.reduce((s, v) => s + v.coords.lat, 0) / mapVehicles.length;
    const avgLng = mapVehicles.reduce((s, v) => s + v.coords.lng, 0) / mapVehicles.length;
    return [avgLat, avgLng];
  }, [mapVehicles]);

  const MAP_TILES = {
    roadmap:   { url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', subdomains: '0123', label: 'Road' },
    satellite: { url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', subdomains: '0123', label: 'Satellite' },
    hybrid:    { url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', subdomains: '0123', label: 'Hybrid' },
    terrain:   { url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', subdomains: '0123', label: 'Terrain' },
  };

  const quickActions = [
    { to: '/add-vehicle', label: 'Add Vehicle',    Icon: PlusIcon,                   color: '#2563EB' },
    { to: '/add-client',  label: 'Add Client',     Icon: UserPlusIcon,               color: '#059669' },
    { to: '/rto-details', label: 'RTO',            Icon: ClipboardDocumentCheckIcon, color: '#7C3AED' },
    { to: '/challans',    label: 'Challans',       Icon: DocumentTextIcon,           color: '#D97706' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', gap: 10, color: '#94A3B8' }}>
        <div style={{ width: 16, height: 16, border: '2px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Loading dashboard...
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans', sans-serif", position: 'relative' }}>

      {/* ══ Top stat strip — compact horizontal scrolling cards ══ */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', overflowX: 'auto', flexShrink: 0 }}>
        {Object.entries(STATUS_CONFIG).map(([id, cfg]) => (
          <button
            key={id}
            onClick={() => setStatusFilter(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
              background: statusFilter === id ? cfg.color : cfg.bg,
              border: `1.5px solid ${statusFilter === id ? cfg.color : cfg.color + '40'}`,
              borderRadius: 8, cursor: 'pointer', minWidth: 110, flexShrink: 0,
              fontFamily: 'inherit', transition: 'all 0.15s',
              boxShadow: statusFilter === id ? `0 2px 8px ${cfg.color}40` : 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: statusFilter === id ? 'rgba(255,255,255,0.85)' : cfg.color, lineHeight: 1 }}>{cfg.label}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: statusFilter === id ? '#fff' : cfg.color, lineHeight: 1, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{counts[id] || 0}</span>
            </div>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94A3B8' }} />
          <input
            placeholder="Search vehicle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 12px 8px 32px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, outline: 'none', width: 200, fontFamily: 'inherit' }}
          />
        </div>

        {/* Map style selector */}
        <select
          value={mapStyle}
          onChange={e => setMapStyle(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit', cursor: 'pointer', background: '#fff' }}
        >
          {Object.entries(MAP_TILES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Toggle sidebar */}
        <button
          onClick={() => setSidebarOpen(p => !p)}
          title={sidebarOpen ? 'Hide vehicle list' : 'Show vehicle list'}
          style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, background: sidebarOpen ? '#EFF6FF' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {sidebarOpen ? <XMarkIcon style={{ width: 16, height: 16, color: '#2563EB' }} /> : <Bars3Icon style={{ width: 16, height: 16, color: '#64748B' }} />}
        </button>
      </div>

      {/* ══ Main content: map + optional sidebar ══ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <MapContainer
            center={mapCenter}
            zoom={5}
            style={{ position: 'absolute', inset: 0 }}
            scrollWheelZoom
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; Google Maps'
              url={MAP_TILES[mapStyle].url}
              subdomains={MAP_TILES[mapStyle].subdomains}
              maxZoom={20}
            />
            {flyToCoords && <MapCenterer center={flyToCoords} />}
            {mapVehicles.map((vehicle) => {
              const markerColor = vehicle._status === 'running' ? '#059669'
                : vehicle._status === 'overspeed' ? '#DC2626'
                : vehicle._status === 'stopped' ? '#ef4444'
                : '#94A3B8';
              const markerFill = vehicle._status === 'running' ? '#22c55e'
                : vehicle._status === 'overspeed' ? '#DC2626'
                : vehicle._status === 'stopped' ? '#f87171'
                : '#CBD5E1';
              const vName = vehicle.vehicleName || vehicle.vehicleNumber || `Vehicle #${vehicle.id}`;
              const speed = vehicle.deviceStatus?.gpsData?.speed ?? 0;
              return (
                <CircleMarker
                  key={vehicle.id}
                  center={[vehicle.coords.lat, vehicle.coords.lng]}
                  radius={vehicle._status === 'overspeed' ? 9 : 7}
                  pathOptions={{ color: markerColor, fillColor: markerFill, fillOpacity: 0.85, weight: 2 }}
                >
                  <Popup>
                    <div style={{ minWidth: 180, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 13, marginBottom: 4 }}>{vName}</div>
                      {vehicle.vehicleName && vehicle.vehicleNumber && (
                        <div style={{ color: '#64748B', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 }}>{vehicle.vehicleNumber}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: markerColor + '18', color: markerColor, border: `1px solid ${markerColor}35` }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: markerColor }} />
                          {STATUS_CONFIG[vehicle._status]?.label || vehicle._status}
                        </span>
                        {speed > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: speed > speedThreshold ? '#ef4444' : '#2563EB' }}>{speed} km/h</span>}
                      </div>
                      {vehicle.imei && (
                        <div style={{ color: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}>IMEI: {vehicle.imei}</div>
                      )}
                      <Link to="/my-fleet" style={{ display: 'inline-block', marginTop: 6, padding: '4px 10px', background: '#2563EB', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 5, textDecoration: 'none' }}>Track →</Link>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* ── Floating overlay: quick actions (top-right) ── */}
          <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 4, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {quickActions.map(a => (
              <Link key={a.to} to={a.to}
                title={a.label}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, textDecoration: 'none', color: a.color, fontSize: 11.5, fontWeight: 700, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = a.color + '10'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <a.Icon style={{ width: 14, height: 14, color: a.color, flexShrink: 0 }} />
                {a.label}
              </Link>
            ))}
          </div>

          {/* ── Floating overlay: result count (bottom-left) ── */}
          <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 500, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            Showing <span style={{ color: STATUS_CONFIG[statusFilter].color }}>{mapVehicles.length}</span> of {enrichedVehicles.length} vehicles
            {statusFilter !== 'all' && <button onClick={() => setStatusFilter('all')} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>clear filter</button>}
          </div>

          {/* ── Overspeed alert banner (top-left, if any) ── */}
          {overspeedVehicles.length > 0 && statusFilter !== 'overspeed' && (
            <button
              onClick={() => setStatusFilter('overspeed')}
              style={{ position: 'absolute', top: 14, left: 14, zIndex: 500, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#FEE2E2', border: '1.5px solid #DC2626', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#B91C1C', cursor: 'pointer', boxShadow: '0 2px 8px rgba(220,38,38,0.2)', fontFamily: 'inherit' }}
            >
              <ExclamationTriangleIcon style={{ width: 15, height: 15, color: '#DC2626' }} />
              {overspeedVehicles.length} Overspeed Alert{overspeedVehicles.length > 1 ? 's' : ''} (24h)
            </button>
          )}

          {/* ── No GPS empty state ── */}
          {mapVehicles.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '20px 28px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', textAlign: 'center', pointerEvents: 'auto' }}>
                <SignalIcon style={{ width: 36, height: 36, color: '#94A3B8', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 4 }}>No vehicles to display</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {statusFilter !== 'all' ? `No vehicles match "${STATUS_CONFIG[statusFilter].label}" filter` : 'No GPS locations available'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar: vehicle list ── */}
        {sidebarOpen && (
          <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {STATUS_CONFIG[statusFilter].label} Vehicles ({filteredVehicles.length})
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px 14px' }}>
              {filteredVehicles.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>No vehicles found</div>
              ) : (
                filteredVehicles.map(v => {
                  const cfg = STATUS_CONFIG[v._status];
                  const speed = v.deviceStatus?.gpsData?.speed ?? 0;
                  const vName = v.vehicleName || v.vehicleNumber || `Vehicle #${v.id}`;
                  return (
                    <div key={v.id}
                      onClick={() => v.coords && setFlyToCoords([v.coords.lat, v.coords.lng])}
                      style={{ padding: '9px 10px', marginBottom: 3, background: '#fff', border: '1px solid #F1F5F9', borderLeft: `3px solid ${cfg.color}`, borderRadius: 7, cursor: v.coords ? 'pointer' : 'default', transition: 'all 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vName}</div>
                          {v.vehicleNumber && v.vehicleName && (
                            <div style={{ fontSize: 9.5, color: '#94A3B8', fontFamily: 'monospace', marginTop: 1 }}>{v.vehicleNumber}</div>
                          )}
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.color}35`, flexShrink: 0 }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: cfg.color }} />
                          <span style={{ fontSize: 8.5, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        {speed > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: speed > speedThreshold ? '#ef4444' : '#2563EB' }}>{speed} km/h</span>
                        )}
                        {!v.coords && (
                          <span style={{ fontSize: 9, fontWeight: 600, color: '#D97706' }}>No GPS</span>
                        )}
                        <span style={{ flex: 1 }} />
                        {v.imei && (
                          <span style={{ fontSize: 8.5, color: '#94A3B8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{v.imei}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Sidebar footer: stats summary ── */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid #F1F5F9', background: '#FAFBFC', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div style={{ padding: '6px 8px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 5 }}>
                  <div style={{ fontSize: 8.5, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Fleet</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginTop: 2 }}>{stats?.registeredVehicles ?? '—'}</div>
                </div>
                <div style={{ padding: '6px 8px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 5 }}>
                  <div style={{ fontSize: 8.5, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Challans</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#D97706', lineHeight: 1, marginTop: 2 }}>{stats?.pendingChallans ?? 0}</div>
                </div>
                <div style={{ padding: '6px 8px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 5 }}>
                  <div style={{ fontSize: 8.5, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Renewals</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#7C3AED', lineHeight: 1, marginTop: 2 }}>{stats?.upcomingRenewals ?? 0}</div>
                </div>
                <div style={{ padding: '6px 8px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 5 }}>
                  <div style={{ fontSize: 8.5, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inactive</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#94A3B8', lineHeight: 1, marginTop: 2 }}>{stats?.vehicleStatusWise?.inactive ?? 0}</div>
                </div>
              </div>
              {isNetworkUser && networkStats && (
                <div style={{ padding: '8px 10px', background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)', borderRadius: 6, color: '#fff' }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8, marginBottom: 3 }}>Network</div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 700 }}>
                    <span>{networkStats.totalClients ?? '—'} clients</span>
                    <span>·</span>
                    <span>{networkStats.totalVehicles ?? '—'} vehicles</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import StatCard from '../components/common/StatCard';
import { getDashboardUserStats, getOverspeedVehicles } from '../services/dashboard.service';
import { getVehicles } from '../services/vehicle.service';
import { getSettings } from '../services/settings.service';
import { toISTString } from '../utils/dateFormat';
import {
  SignalIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  UserPlusIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ArrowRightIcon,
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
  const lat = toNumber(vehicle.latitude ?? vehicle.lat ?? vehicle.gpsLat);
  const lng = toNumber(vehicle.longitude ?? vehicle.lng ?? vehicle.gpsLng);
  if (lat !== null && lng !== null) return { lat, lng };
  const nLat = toNumber(vehicle.location?.latitude ?? vehicle.location?.lat);
  const nLng = toNumber(vehicle.location?.longitude ?? vehicle.location?.lng);
  if (nLat !== null && nLng !== null) return { lat: nLat, lng: nLng };
  return null;
};

/* ── Vehicle row with hover state ─────────────────── */
const VehicleRow = ({ vehicle, idx, overspeedVehicles, speedThreshold }) => {
  const [hovered, setHovered] = useState(false);
  const hasGps = !!getVehicleCoordinates(vehicle);
  const overspeedData = overspeedVehicles.find((ov) => ov.id === vehicle.id);
  const isOverspeed = !!overspeedData;
  const currentSpeed = vehicle.deviceStatus?.gpsData?.speed || vehicle.gpsData?.speed || 0;

  const rowBg = isOverspeed
    ? hovered ? '#FEE2E2' : '#FFF5F5'
    : hovered ? '#EFF6FF' : idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC';
  const leftBorder = isOverspeed
    ? '3px solid #DC2626'
    : hovered ? '3px solid #2563EB' : '3px solid transparent';

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: rowBg,
        borderBottom: idx % 2 === 0 ? '1px solid #F1F5F9' : '1px solid #EAECF0',
        borderLeft: leftBorder,
        transition: 'background 0.1s, border-left 0.1s',
        cursor: 'default',
      }}
    >
      {/* Vehicle # + IMEI */}
      <td style={{ padding: '10px 14px' }}>
        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '12.5px' }}>
          {vehicle.vehicleNumber || `#${vehicle.id}`}
        </div>
        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px', fontFamily: "'Roboto Mono', monospace" }}>
          {vehicle.imei || '—'}
        </div>
      </td>

      {/* GPS dot */}
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: hasGps ? '#10B981' : '#CBD5E1',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '11px', color: hasGps ? '#059669' : '#94A3B8', fontWeight: 600 }}>
            {hasGps ? 'Live' : 'None'}
          </span>
        </div>
      </td>

      {/* Speed */}
      <td style={{ padding: '10px 14px' }}>
        {hasGps && currentSpeed > 0 ? (
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: currentSpeed > speedThreshold ? '#DC2626' : '#059669',
            fontFamily: "'Roboto Mono', monospace",
          }}>
            {currentSpeed} <span style={{ fontWeight: 400, fontFamily: 'inherit' }}>km/h</span>
          </span>
        ) : (
          <span style={{ fontSize: '11px', color: '#CBD5E1' }}>—</span>
        )}
      </td>

      {/* 24h status */}
      <td style={{ padding: '10px 14px' }}>
        {isOverspeed && overspeedData ? (
          <div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              background: '#FEE2E2',
              color: '#DC2626',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '2px',
              letterSpacing: '0.02em',
            }}>
              ⚠ {overspeedData.maxSpeed} km/h
            </span>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
              {overspeedData.overspeedCount} violation{overspeedData.overspeedCount > 1 ? 's' : ''}
            </div>
          </div>
        ) : (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: '#D1FAE5',
            color: '#059669',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '2px',
          }}>
            ✓ Normal
          </span>
        )}
      </td>

      {/* Row actions */}
      <td style={{ padding: '10px 14px' }}>
        <div className="row-actions">
          <Link
            to="/my-fleet"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              fontWeight: 600,
              color: '#2563EB',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              padding: '3px 8px',
              borderRadius: '2px',
              textDecoration: 'none',
            }}
          >
            Track <ArrowRightIcon style={{ width: '10px', height: '10px' }} />
          </Link>
        </div>
      </td>
    </tr>
  );
};

/* ── Quick action card ─────────────────────────────── */
const QuickActionLink = ({ to, label, Icon, color, colorPale, colorBorder }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '11px 14px',
        background: hovered ? colorPale : '#F8FAFC',
        border: `1px solid ${hovered ? colorBorder : '#E2E8F0'}`,
        borderLeft: `3px solid ${hovered ? color : '#E2E8F0'}`,
        borderRadius: '2px',
        color: hovered ? color : '#334155',
        fontSize: '12.5px',
        fontWeight: 600,
        textDecoration: 'none',
        transition: 'all 0.1s',
      }}
    >
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '2px',
        background: hovered ? colorPale : '#FFFFFF',
        border: `1px solid ${hovered ? colorBorder : '#E2E8F0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.1s',
      }}>
        <Icon style={{ width: '14px', height: '14px', color: hovered ? color : '#64748B' }} />
      </div>
      <span style={{ flex: 1 }}>{label}</span>
      <ArrowRightIcon style={{ width: '13px', height: '13px', opacity: hovered ? 1 : 0.3, transition: 'opacity 0.1s' }} />
    </Link>
  );
};

// ─── All available dashboard stat cards ───────────────────────────────────────
const ALL_DASH_CARDS = [
  { id: 'registered',  title: 'Registered Vehicles', icon: '🚗', bgColor: '#dbeafe', defaultOn: true  },
  { id: 'active',      title: 'Active Vehicles',     icon: '✅', bgColor: '#d1fae5', defaultOn: true  },
  { id: 'overspeed',   title: 'Overspeed Alerts',    icon: '⚠️', bgColor: '#fee2e2', defaultOn: true  },
  { id: 'inactive',    title: 'Inactive Vehicles',   icon: '⏸️', bgColor: '#fef3c7', defaultOn: true  },
  { id: 'gps_active',  title: 'GPS Active',          icon: '📡', bgColor: '#ede9fe', defaultOn: true  },
  { id: 'challans',    title: 'Pending Challans',    icon: '📋', bgColor: '#fce7f3', defaultOn: true  },
  { id: 'renewals',    title: 'Upcoming Renewals',   icon: '📅', bgColor: '#fef9c3', defaultOn: true  },
  { id: 'deleted',     title: 'Deleted Vehicles',    icon: '🗑️', bgColor: '#f1f5f9', defaultOn: false },
];

const DEFAULT_DASH_CARDS = ALL_DASH_CARDS.filter((c) => c.defaultOn).map((c) => c.id);

function getVisibleDashCards() {
  try {
    const saved = localStorage.getItem('dashboard-visible-cards');
    return saved ? JSON.parse(saved) : DEFAULT_DASH_CARDS;
  } catch { return DEFAULT_DASH_CARDS; }
}

/* ── Dashboard ─────────────────────────────────────── */
const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speedThreshold, setSpeedThreshold] = useState(80);
  const [overspeedVehicles, setOverspeedVehicles] = useState([]);
  const [visibleCards, setVisibleCards] = useState(getVisibleDashCards);

  // Re-read visibility whenever settings may change (e.g. after navigating from Settings)
  useEffect(() => {
    const onFocus = () => setVisibleCards(getVisibleDashCards());
    window.addEventListener('focus', onFocus);
    window.addEventListener('dashboard-cards-updated', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('dashboard-cards-updated', onFocus);
    };
  }, []);

  useEffect(() => {
    Promise.all([getDashboardUserStats(), getVehicles(), getSettings()])
      .then(([statsRes, vehiclesRes, settingsRes]) => {
        setStats(statsRes.data);
        setVehicles(vehiclesRes.data || []);

        let settingsData;
        if (settingsRes.data.success && settingsRes.data.data) {
          settingsData = settingsRes.data.data;
        } else if (settingsRes.data.speedThreshold !== undefined) {
          settingsData = settingsRes.data;
        }

        if (settingsData) {
          const threshold = settingsData.speedThreshold || 80;
          setSpeedThreshold(threshold);
          return getOverspeedVehicles(threshold);
        }
      })
      .then((overspeedRes) => {
        if (overspeedRes) {
          if (overspeedRes.data.success && overspeedRes.data.data) {
            setOverspeedVehicles(overspeedRes.data.data);
          } else if (Array.isArray(overspeedRes.data)) {
            setOverspeedVehicles(overspeedRes.data);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const availableVehicles = useMemo(
    () => vehicles.filter((v) => (v.status || '').toLowerCase() === 'active'),
    [vehicles]
  );

  const mapVehicles = useMemo(
    () =>
      availableVehicles
        .map((v) => ({ ...v, coords: getVehicleCoordinates(v) }))
        .filter((v) => !!v.coords),
    [availableVehicles]
  );

  const mapCenter = useMemo(() => {
    if (!mapVehicles.length) return INDIA_CENTER;
    const avgLat = mapVehicles.reduce((s, v) => s + v.coords.lat, 0) / mapVehicles.length;
    const avgLng = mapVehicles.reduce((s, v) => s + v.coords.lng, 0) / mapVehicles.length;
    return [avgLat, avgLng];
  }, [mapVehicles]);

  const CARD_DATA = {
    registered: { value: stats?.registeredVehicles ?? '—',              change: 'Total fleet size' },
    active:     { value: stats?.vehicleStatusWise?.active ?? 0,         change: 'Operational status' },
    overspeed:  { value: overspeedVehicles.length,                      change: `Exceeded ${speedThreshold} km/h (24h)` },
    inactive:   { value: stats?.vehicleStatusWise?.inactive ?? 0,       change: 'Temporarily inactive' },
    gps_active: { value: mapVehicles.length,                            change: 'Live GPS signal' },
    challans:   { value: stats?.pendingChallans ?? 0,                   change: 'Awaiting payment' },
    renewals:   { value: stats?.upcomingRenewals ?? 0,                  change: 'Expiring within 30 days' },
    deleted:    { value: stats?.vehicleStatusWise?.deleted ?? 0,        change: 'Removed from fleet' },
  };

  const statCards = ALL_DASH_CARDS
    .filter((c) => visibleCards.includes(c.id))
    .map((c) => ({ ...c, ...CARD_DATA[c.id] }));

  const quickActions = [
    { to: '/add-vehicle', label: 'Add Vehicle',      Icon: PlusIcon,                   color: '#2563EB', colorPale: '#EFF6FF', colorBorder: '#BFDBFE' },
    { to: '/add-client',  label: 'Add Client',       Icon: UserPlusIcon,               color: '#059669', colorPale: '#D1FAE5', colorBorder: '#6EE7B7' },
    { to: '/rto-details', label: 'RTO Compliance',   Icon: ClipboardDocumentCheckIcon, color: '#7C3AED', colorPale: '#F5F3FF', colorBorder: '#C4B5FD' },
    { to: '/challans',    label: 'Pending Challans', Icon: DocumentTextIcon,           color: '#D97706', colorPale: '#FEF3C7', colorBorder: '#FCD34D' },
  ];

  return (
    <div style={{ minHeight: '100%' }}>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '7px 13px',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderLeft: '3px solid #2563EB',
            borderRadius: '2px',
          }}>
            <SignalIcon style={{ width: '14px', height: '14px', color: '#2563EB' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8' }}>
              {loading ? '…' : mapVehicles.length} GPS Active
            </span>
            {!loading && (
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>/ {availableVehicles.length}</span>
            )}
          </div>

          {!loading && overspeedVehicles.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '7px 13px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderLeft: '3px solid #DC2626',
              borderRadius: '2px',
            }}>
              <ExclamationTriangleIcon style={{ width: '14px', height: '14px', color: '#DC2626' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#B91C1C' }}>
                {overspeedVehicles.length} Overspeed Alert{overspeedVehicles.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
      </div>

      {loading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          color: '#94A3B8',
          fontSize: '13.5px',
          fontWeight: 500,
          gap: '10px',
        }}>
          <div style={{
            width: '16px', height: '16px', border: '2px solid #E2E8F0',
            borderTopColor: '#2563EB', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          Loading dashboard...
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : (
        <>
          {/* ── Stat cards ───────────────────────────── */}
          <div className="stat-cards-row" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {statCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>

          {/* ── Main grid ────────────────────────────── */}
          <div
            className="dashboard-main-grid"
            style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '14px' }}
          >
            {/* ── Map card ─────────────────────────── */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              {/* Map header */}
              <div style={{
                padding: '13px 16px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>Fleet Location Map</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                    Active vehicles with GPS coordinates
                  </div>
                </div>
                <span style={{
                  fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em',
                  color: '#2563EB', background: '#EFF6FF',
                  padding: '3px 8px', borderRadius: '2px',
                }}>
                  {mapVehicles.length} ON MAP
                </span>
              </div>

              {/* Map body */}
              {mapVehicles.length ? (
                <MapContainer
                  center={mapCenter}
                  zoom={5}
                  style={{ height: '400px', width: '100%' }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {mapVehicles.map((vehicle) => (
                    <CircleMarker
                      key={vehicle.id}
                      center={[vehicle.coords.lat, vehicle.coords.lng]}
                      radius={7}
                      pathOptions={{ color: '#1D4ED8', fillColor: '#3B82F6', fillOpacity: 0.85, weight: 2 }}
                    >
                      <Popup>
                        <div style={{ minWidth: '170px', fontFamily: "'Inter', sans-serif", fontSize: '12px' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px', marginBottom: '6px' }}>
                            {vehicle.vehicleNumber || `Vehicle #${vehicle.id}`}
                          </div>
                          <div style={{ color: '#64748B', marginBottom: '2px' }}>
                            Status: <strong>{(vehicle.status || 'active').toUpperCase()}</strong>
                          </div>
                          <div style={{ color: '#64748B', marginBottom: '2px' }}>
                            IMEI: <span style={{ fontFamily: 'monospace' }}>{vehicle.imei || '—'}</span>
                          </div>
                          <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '4px' }}>
                            {vehicle.coords.lat.toFixed(5)}, {vehicle.coords.lng.toFixed(5)}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              ) : (
                <div style={{
                  height: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: '#F8FAFC',
                }}>
                  <div style={{
                    width: '44px', height: '44px',
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SignalIcon style={{ width: '22px', height: '22px', color: '#2563EB' }} />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>No GPS locations</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', maxWidth: '270px', lineHeight: 1.5 }}>
                    Active vehicles are loaded but GPS coordinates are not yet available.
                  </div>
                </div>
              )}
            </div>

            {/* ── Right panel ──────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Vehicle table */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '2px',
                overflow: 'hidden',
                flex: 1,
              }}>
                {/* Table header */}
                <div style={{
                  padding: '13px 16px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>Active Vehicles</div>
                  <span style={{
                    fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em',
                    background: '#F1F5F9', color: '#475569',
                    padding: '3px 8px', borderRadius: '2px',
                  }}>
                    {availableVehicles.length} TOTAL
                  </span>
                </div>

                {/* Table body */}
                <div style={{ overflowY: 'auto', maxHeight: '330px' }}>
                  {availableVehicles.length ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--theme-table-body-font-size, 13px)' }}>
                      <thead>
                        <tr style={{ background: 'var(--theme-table-header-bg, #f8fafc)', borderBottom: '2px solid var(--theme-table-border, #e2e8f0)', position: 'sticky', top: 0, zIndex: 1 }}>
                          {['Vehicle', 'GPS', 'Speed', '24h Status', ''].map((h) => (
                            <th key={h} style={{
                              padding: '9px 14px',
                              textAlign: 'left',
                              fontWeight: 700,
                              color: 'var(--theme-table-header-text, #64748b)',
                              fontSize: 'var(--theme-table-header-font-size, 10px)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.07em',
                              whiteSpace: 'nowrap',
                              background: 'var(--theme-table-header-bg, #f8fafc)',
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {availableVehicles.map((vehicle, idx) => (
                          <VehicleRow
                            key={vehicle.id}
                            vehicle={vehicle}
                            idx={idx}
                            overspeedVehicles={overspeedVehicles}
                            speedThreshold={speedThreshold}
                          />
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94A3B8',
                      fontSize: '13px',
                    }}>
                      No active vehicles found.
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '2px',
                padding: '14px 16px',
              }}>
                <div style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: '#0F172A',
                  marginBottom: '10px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #F1F5F9',
                }}>
                  Quick Actions
                </div>
                <div className="quick-actions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {quickActions.map((a) => (
                    <QuickActionLink key={a.to} {...a} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

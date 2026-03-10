import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import StatCard from '../components/common/StatCard';
import { getDashboardUserStats, getOverspeedVehicles } from '../services/dashboard.service';
import { getVehicles } from '../services/vehicle.service';
import { getSettings } from '../services/settings.service';
import { toISTString } from '../utils/dateFormat';

const INDIA_CENTER = [22.9734, 78.6569];

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getVehicleCoordinates = (vehicle) => {
  // Check deviceStatus.gpsData from sync (new structure)
  if (vehicle.deviceStatus?.gpsData) {
    const deviceLat = toNumber(vehicle.deviceStatus.gpsData.latitude ?? vehicle.deviceStatus.gpsData.lat);
    const deviceLng = toNumber(vehicle.deviceStatus.gpsData.longitude ?? vehicle.deviceStatus.gpsData.lng);
    if (deviceLat !== null && deviceLng !== null) {
      return { lat: deviceLat, lng: deviceLng };
    }
  }
  
  // Check GPS data from MongoDB (old structure)
  if (vehicle.gpsData) {
    const gpsLat = toNumber(vehicle.gpsData.latitude ?? vehicle.gpsData.lat);
    const gpsLng = toNumber(vehicle.gpsData.longitude ?? vehicle.gpsData.lng);
    if (gpsLat !== null && gpsLng !== null) {
      return { lat: gpsLat, lng: gpsLng };
    }
  }

  // Check direct properties
  const directLat = toNumber(vehicle.latitude ?? vehicle.lat ?? vehicle.gpsLat);
  const directLng = toNumber(vehicle.longitude ?? vehicle.lng ?? vehicle.gpsLng);
  if (directLat !== null && directLng !== null) {
    return { lat: directLat, lng: directLng };
  }

  // Check nested location object
  const nestedLat = toNumber(vehicle.location?.latitude ?? vehicle.location?.lat);
  const nestedLng = toNumber(vehicle.location?.longitude ?? vehicle.location?.lng);
  if (nestedLat !== null && nestedLng !== null) {
    return { lat: nestedLat, lng: nestedLng };
  }

  return null;
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speedThreshold, setSpeedThreshold] = useState(80);
  const [overspeedVehicles, setOverspeedVehicles] = useState([]);

  useEffect(() => {
    Promise.all([getDashboardUserStats(), getVehicles(), getSettings()])
      .then(([statsRes, vehiclesRes, settingsRes]) => {
        setStats(statsRes.data);
        setVehicles(vehiclesRes.data || []);
        
        // Handle settings response - check if it has the wrapper or is direct data
        let settingsData;
        if (settingsRes.data.success && settingsRes.data.data) {
          settingsData = settingsRes.data.data;
        } else if (settingsRes.data.speedThreshold !== undefined) {
          settingsData = settingsRes.data;
        }
        
        if (settingsData) {
          const threshold = settingsData.speedThreshold || 80;
          setSpeedThreshold(threshold);
          
          // Fetch overspeed vehicles based on threshold
          return getOverspeedVehicles(threshold);
        }
      })
      .then((overspeedRes) => {
        if (overspeedRes) {
          // Handle overspeed response
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
    () => vehicles.filter((vehicle) => (vehicle.status || '').toLowerCase() === 'active'),
    [vehicles]
  );

  const mapVehicles = useMemo(
    () =>
      availableVehicles
        .map((vehicle) => ({ ...vehicle, coords: getVehicleCoordinates(vehicle) }))
        .filter((vehicle) => !!vehicle.coords),
    [availableVehicles]
  );

  const mapCenter = useMemo(() => {
    if (!mapVehicles.length) return INDIA_CENTER;
    const avgLat = mapVehicles.reduce((sum, vehicle) => sum + vehicle.coords.lat, 0) / mapVehicles.length;
    const avgLng = mapVehicles.reduce((sum, vehicle) => sum + vehicle.coords.lng, 0) / mapVehicles.length;
    return [avgLat, avgLng];
  }, [mapVehicles]);

  const statCards = [
    {
      title: 'Registered Vehicles',
      value: stats?.registeredVehicles ?? '—',
      icon: '🚗',
      bgColor: '#dbeafe',
      change: 'Total fleet size',
    },
    {
      title: 'Active Vehicles',
      value: stats?.vehicleStatusWise?.active ?? 0,
      icon: '✅',
      bgColor: '#d1fae5',
      change: 'Operational status',
    },
    {
      title: 'Overspeed Alerts (24h)',
      value: overspeedVehicles.length,
      icon: '⚠️',
      bgColor: '#fee2e2',
      change: `Exceeded ${speedThreshold} km/h in last 24 hours`,
    },
    {
      title: 'Inactive Vehicles',
      value: stats?.vehicleStatusWise?.inactive ?? 0,
      icon: '⏸️',
      bgColor: '#fef3c7',
      change: 'Temporarily inactive',
    },
  ];

  return (
    <div style={{ minHeight: '100%' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)',
          borderRadius: '16px',
          padding: '30px 30px',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-45px',
            right: '-45px',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-60px',
            right: '160px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: '18px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>Dashboard Overview</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', marginTop: '6px' }}>
              Monitor fleet health, live positions, and operational readiness at a glance.
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 12px',
                  borderRadius: '20px',
                }}
              >
                📡 Live Location View
              </span>
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 12px',
                  borderRadius: '20px',
                }}
              >
                🚛 Fleet Visibility
              </span>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.14)',
              borderRadius: '14px',
              padding: '14px 16px',
              minWidth: '200px',
              alignSelf: 'flex-start',
            }}
          >
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>Vehicles with GPS</div>
            <div style={{ fontSize: '30px', fontWeight: 800, color: '#fff', lineHeight: 1.1, marginTop: '4px' }}>
              {mapVehicles.length}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginTop: '4px' }}>
              Out of {availableVehicles.length} active vehicles
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>Loading dashboard...</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {statCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>🗺️ Fleet Location Map</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Showing active vehicles with available GPS coordinates
                </div>
              </div>

              {mapVehicles.length ? (
                <MapContainer
                  center={mapCenter}
                  zoom={5}
                  style={{ height: '420px', width: '100%' }}
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
                      radius={8}
                      pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.65, weight: 2 }}
                    >
                      <Popup>
                        <div style={{ minWidth: '180px' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>
                            {vehicle.vehicleNumber || `Vehicle #${vehicle.id}`}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Status: {(vehicle.status || 'active').toUpperCase()}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            IMEI: {vehicle.imei || '—'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Lat/Lng: {vehicle.coords.lat.toFixed(5)}, {vehicle.coords.lng.toFixed(5)}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              ) : (
                <div
                  style={{
                    height: '420px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '8px',
                    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                  }}
                >
                  <div style={{ fontSize: '34px' }}>📍</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>No GPS locations available</div>
                  <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', maxWidth: '360px' }}>
                    Active vehicles are loaded, but latitude/longitude fields are currently missing in their records.
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>🚛 Available Vehicles</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '2px' }}>
                  {availableVehicles.length ? (
                    availableVehicles.map((vehicle) => {
                      const hasGps = !!getVehicleCoordinates(vehicle);
                      const currentSpeed = vehicle.deviceStatus?.gpsData?.speed || vehicle.gpsData?.speed || 0;
                      
                      // Check if this vehicle exceeded speed in last 24 hours
                      const overspeedData = overspeedVehicles.find(ov => ov.id === vehicle.id);
                      const isOverspeed = !!overspeedData;
                      
                      return (
                        <div
                          key={vehicle.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '12px',
                            background: isOverspeed ? '#fef2f2' : '#fff',
                            borderLeft: isOverspeed ? '3px solid #ef4444' : '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                              {vehicle.vehicleNumber || `Vehicle #${vehicle.id}`}
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '20px',
                                  background: hasGps ? '#dcfce7' : '#fee2e2',
                                  color: hasGps ? '#15803d' : '#dc2626',
                                }}
                              >
                                {hasGps ? '📡' : '❌'}
                              </span>
                              {isOverspeed && overspeedData && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: '20px',
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                  }}
                                  title={`Max Speed: ${overspeedData.maxSpeed} km/h (Limit: ${speedThreshold} km/h)\nLast overspeed: ${toISTString(overspeedData.lastOverspeedTime)}\nTotal violations: ${overspeedData.overspeedCount}`}
                                >
                                  ⚠️ {overspeedData.maxSpeed} km/h
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            IMEI: {vehicle.imei || '—'}
                          </div>
                          {isOverspeed && overspeedData && (
                            <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: 600 }}>
                              ⚠️ {overspeedData.overspeedCount} violation{overspeedData.overspeedCount > 1 ? 's' : ''} in last 24h • Max: {overspeedData.maxSpeed} km/h
                            </div>
                          )}
                          {hasGps && currentSpeed > 0 && !isOverspeed && (
                            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', fontWeight: 600 }}>
                              ✓ Current: {currentSpeed} km/h • No violations in 24h
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>No active vehicles available.</div>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>📋 Quick Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Add a new vehicle', link: '/add-vehicle', icon: '➕' },
                    { label: 'Add a new client', link: '/add-client', icon: '👥' },
                    { label: 'View RTO compliance', link: '/rto-details', icon: '📋' },
                    { label: 'Check pending challans', link: '/challans', icon: '📄' },
                  ].map((action) => (
                    <Link
                      key={action.label}
                      to={action.link}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                        fontSize: '14px',
                        fontWeight: 500,
                        textDecoration: 'none',
                      }}
                    >
                      <span>{action.icon}</span>
                      {action.label}
                      <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>→</span>
                    </Link>
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

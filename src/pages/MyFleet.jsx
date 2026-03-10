import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getVehicles, deleteVehicle, updateVehicle, syncVehicleData } from '../services/vehicle.service';
import LocationPlayer from '../components/common/LocationPlayer';
import { toISTCompactDate, toISTString, toISTTimeString } from '../utils/dateFormat';

const statusBadge = { active: 'badge-success', inactive: 'badge-gray', deleted: 'badge-danger' };

const INDIA_CENTER = [22.9734, 78.6569];

// Vehicle icon emoji mapping
const VEHICLE_ICON_MAP = {
  car: '🚗',
  suv: '🚙',
  truck: '🚛',
  bus: '🚌',
  bike: '🏍️',
  auto: '🛺',
  van: '🚐',
  ambulance: '🚑',
};

// Map controller component to handle zoom/focus
const MapController = ({ focusedVehicle, mapVehicles }) => {
  const map = useMap();
  
  useEffect(() => {
    if (focusedVehicle && focusedVehicle.coords) {
      map.flyTo([focusedVehicle.coords.lat, focusedVehicle.coords.lng], 15, {
        duration: 0.8
      });
    } else if (mapVehicles.length > 0) {
      // Reset to show all vehicles
      const avgLat = mapVehicles.reduce((sum, v) => sum + v.coords.lat, 0) / mapVehicles.length;
      const avgLng = mapVehicles.reduce((sum, v) => sum + v.coords.lng, 0) / mapVehicles.length;
      map.flyTo([avgLat, avgLng], mapVehicles.length === 1 ? 13 : 6, {
        duration: 0.8
      });
    }
  }, [focusedVehicle, mapVehicles, map]);
  
  return null;
};

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

const EMPTY_FORM = {
  vehicleNumber: '',
  chasisNumber: '',
  engineNumber: '',
  imei: '',
  status: 'active',
  rtoData: false,
  challanData: false,
  serverIp: '',
  serverPort: '',
};

const MyFleet = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // GPS Sync Modal state
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingVehicleId, setSyncingVehicleId] = useState(null);

  // Location Player Modal state
  const [locationPlayerOpen, setLocationPlayerOpen] = useState(false);
  const [locationPlayerVehicle, setLocationPlayerVehicle] = useState(null);

  // Map interaction state
  const [hoveredVehicleId, setHoveredVehicleId] = useState(null);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [gpsFilter, setGpsFilter] = useState('all');
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Detail view state
  const [detailViewVehicle, setDetailViewVehicle] = useState(null);
  
  // Selection state
  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
  
  // Legend state
  const [legendMinimized, setLegendMinimized] = useState(false);
  
  // Map control state
  const [focusedVehicleId, setFocusedVehicleId] = useState(null);
  const mapRef = useRef(null);

  const fetchVehicles = () => {
    setLoading(true);
    getVehicles()
      .then((res) => {
        console.log('[MY_FLEET] Received vehicles data:', res.data);
        // Log device status for first vehicle to inspect structure
        if (res.data && res.data.length > 0) {
          console.log('[MY_FLEET] First vehicle deviceStatus:', res.data[0].deviceStatus);
        }
        setVehicles(res.data || []);
        setLastRefresh(new Date());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(fetchVehicles, []);
  
  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchVehicles, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this vehicle?')) return;
    try {
      await deleteVehicle(id);
      toast.success('Vehicle removed successfully');
      
      // Close detail view if the deleted vehicle is currently shown
      if (detailViewVehicle?.id === id) {
        setDetailViewVehicle(null);
      }
      
      fetchVehicles();
    } catch (err) {
      toast.error(err.message || 'Failed to delete vehicle');
    }
  };

  const handleSync = async (vehicle) => {
    setSyncing(true);
    setSyncingVehicleId(vehicle.id);
    try {
      const response = await syncVehicleData(vehicle.id);
      const syncedVehicle = response.data;
      
      // Update the vehicle in the list with synced data
      setVehicles(prevVehicles => 
        prevVehicles.map(v => v.id === syncedVehicle.id ? syncedVehicle : v)
      );
      
      // Update detail view if it's the same vehicle
      if (detailViewVehicle?.id === syncedVehicle.id) {
        setDetailViewVehicle(syncedVehicle);
      }
      
      setSelectedVehicle(syncedVehicle);
      setGpsModalOpen(true);
      toast.success('Vehicle data synced successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to sync vehicle data');
    } finally {
      setSyncing(false);
      setSyncingVehicleId(null);
    }
  };

  const showGpsData = (vehicle) => {
    setSelectedVehicle(vehicle);
    setGpsModalOpen(true);
  };

  const closeGpsModal = () => {
    setGpsModalOpen(false);
    setSelectedVehicle(null);
  };

  const openLocationPlayer = (vehicle) => {
    setLocationPlayerVehicle(vehicle);
    setLocationPlayerOpen(true);
  };

  const closeLocationPlayer = () => {
    setLocationPlayerOpen(false);
    setLocationPlayerVehicle(null);
  };

  const openEdit = (v) => {
    setEditVehicle(v);
    setEditForm({
      vehicleNumber: v.vehicleNumber || '',
      chasisNumber: v.chasisNumber || '',
      engineNumber: v.engineNumber || '',
      imei: v.imei || '',
      status: v.status || 'active',
      rtoData: !!v.rtoData,
      challanData: !!v.challanData,
      serverIp: v.serverIp || '',
      serverPort: v.serverPort || '',
    });
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setEditVehicle(null);
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...editForm };
      if (payload.vehicleNumber) payload.vehicleNumber = payload.vehicleNumber.toUpperCase();
      await updateVehicle(editVehicle.id, payload);
      toast.success('Vehicle updated successfully!');
      closeSidebar();
      fetchVehicles();
    } catch (err) {
      toast.error(err.message || 'Failed to update vehicle');
    } finally {
      setSaving(false);
    }
  };

  // Accordion state — all closed by default
  const [openSections, setOpenSections] = useState({});
  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      (v.vehicleNumber || '').toLowerCase().includes(q) ||
      (v.chasisNumber || '').toLowerCase().includes(q) ||
      (v.engineNumber || '').toLowerCase().includes(q) ||
      (v.imei || '').toLowerCase().includes(q)
    );
    
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    const hasGps = !!(v.gpsData || v.deviceStatus?.gpsData);
    const matchesGps = gpsFilter === 'all' || 
                      (gpsFilter === 'with-gps' && hasGps) ||
                      (gpsFilter === 'no-gps' && !hasGps);
    
    return matchesSearch && matchesStatus && matchesGps;
  });

  // Checkbox selection handlers (defined after filtered)
  const handleSelectVehicle = (vehicleId, event) => {
    event.stopPropagation(); // Prevent row click
    setSelectedVehicleIds(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  const handleSelectAll = (event) => {
    event.stopPropagation();
    if (selectedVehicleIds.length === filtered.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(filtered.map(v => v.id));
    }
  };

  const isAllSelected = filtered.length > 0 && selectedVehicleIds.length === filtered.length;
  const isSomeSelected = selectedVehicleIds.length > 0 && selectedVehicleIds.length < filtered.length;

  
  // Calculate statistics
  const stats = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === 'active').length;
    const withGps = vehicles.filter(v => v.gpsData || v.deviceStatus?.gpsData).length;
    const moving = vehicles.filter(v => {
      const gpsData = v.deviceStatus?.gpsData || v.gpsData;
      return gpsData && gpsData.speed > 0;
    }).length;
    const avgSpeed = vehicles.reduce((sum, v) => {
      const gpsData = v.deviceStatus?.gpsData || v.gpsData;
      return sum + (gpsData?.speed || 0);
    }, 0) / (withGps || 1);
    
    return { total, active, withGps, moving, avgSpeed: avgSpeed.toFixed(1) };
  }, [vehicles]);

  const mapVehicles = useMemo(
    () => {
      // Filter based on selection: if any vehicles are selected, show only selected ones
      const vehiclesToShow = selectedVehicleIds.length > 0 
        ? filtered.filter(v => selectedVehicleIds.includes(v.id))
        : filtered;
      
      return vehiclesToShow
        .map((vehicle) => ({ ...vehicle, coords: getVehicleCoordinates(vehicle) }))
        .filter((vehicle) => !!vehicle.coords);
    },
    [filtered, selectedVehicleIds]
  );

  const mapCenter = useMemo(() => {
    if (!mapVehicles.length) return INDIA_CENTER;
    const avgLat = mapVehicles.reduce((sum, vehicle) => sum + vehicle.coords.lat, 0) / mapVehicles.length;
    const avgLng = mapVehicles.reduce((sum, vehicle) => sum + vehicle.coords.lng, 0) / mapVehicles.length;
    return [avgLat, avgLng];
  }, [mapVehicles]);

  const fmt = (d) => toISTCompactDate(d);

  /* ── Sidebar styles ── */
  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000,
    opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'all' : 'none',
    transition: 'opacity 0.25s',
  };
  const sidebar = {
    position: 'fixed', top: 0, right: 0, height: '100vh', width: '440px',
    background: '#fff', zIndex: 1001, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
    transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
    display: 'flex', flexDirection: 'column',
  };
  const sectionHead = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 14px', background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: '7px', cursor: 'pointer', userSelect: 'none', marginTop: '10px',
  };
  const sectionHeadLabel = {
    fontSize: '12px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.07em',
  };
  const sectionBody = {
    border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 7px 7px',
    padding: '14px', marginBottom: '4px',
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '7px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fafafa',
  };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* ── GPS Data Modal ── */}
      {gpsModalOpen && selectedVehicle && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000 }} onClick={closeGpsModal} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#fff', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            zIndex: 2001, width: '90%', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e3a5f' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '18px', color: '#fff' }}>🔄 Synced Vehicle Data</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                  {selectedVehicle.vehicleNumber || `Vehicle ID #${selectedVehicle.id}`}
                </div>
              </div>
              <button onClick={closeGpsModal} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Vehicle Info */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🚗 Vehicle Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                  <div><strong style={{ fontSize: '12px', color: '#64748b' }}>Registration:</strong> <span style={{ fontSize: '14px', color: '#1e3a5f' }}>{selectedVehicle.vehicleNumber || '—'}</span></div>
                  <div><strong style={{ fontSize: '12px', color: '#64748b' }}>IMEI:</strong> <span style={{ fontSize: '14px', color: '#1e3a5f' }}>{selectedVehicle.imei || '—'}</span></div>
                  <div><strong style={{ fontSize: '12px', color: '#64748b' }}>Chassis:</strong> <span style={{ fontSize: '14px', color: '#1e3a5f' }}>{selectedVehicle.chasisNumber || '—'}</span></div>
                  <div><strong style={{ fontSize: '12px', color: '#64748b' }}>Engine:</strong> <span style={{ fontSize: '14px', color: '#1e3a5f' }}>{selectedVehicle.engineNumber || '—'}</span></div>
                  <div><strong style={{ fontSize: '12px', color: '#64748b' }}>Status:</strong> <span className={`badge ${statusBadge[selectedVehicle.status]}`}>{selectedVehicle.status}</span></div>
                </div>
              </div>

              {/* Device Info */}
              {(() => {
                const gpsData = selectedVehicle.deviceStatus?.gpsData || selectedVehicle.gpsData;
                return gpsData && (gpsData.deviceModel || gpsData.deviceId || gpsData.deviceType) && (
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📱 Device Information
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#faf5ff', padding: '16px', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                      {gpsData.deviceModel && (
                        <div><strong style={{ fontSize: '12px', color: '#7c3aed' }}>Device Model:</strong> <span style={{ fontSize: '14px', color: '#5b21b6' }}>{gpsData.deviceModel}</span></div>
                      )}
                      {gpsData.deviceId && (
                        <div><strong style={{ fontSize: '12px', color: '#7c3aed' }}>Device ID:</strong> <span style={{ fontSize: '14px', color: '#5b21b6', fontFamily: 'monospace' }}>{gpsData.deviceId}</span></div>
                      )}
                      {gpsData.deviceType && (
                        <div><strong style={{ fontSize: '12px', color: '#7c3aed' }}>Device Type:</strong> <span style={{ fontSize: '14px', color: '#5b21b6' }}>{gpsData.deviceType}</span></div>
                      )}
                      {gpsData.protocol && (
                        <div><strong style={{ fontSize: '12px', color: '#7c3aed' }}>Protocol:</strong> <span style={{ fontSize: '14px', color: '#5b21b6' }}>{gpsData.protocol}</span></div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* GPS Data */}
              {(selectedVehicle.gpsData || selectedVehicle.deviceStatus?.gpsData) ? (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📍 GPS Location Data
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    {(() => {
                      const gpsData = selectedVehicle.deviceStatus?.gpsData || selectedVehicle.gpsData;
                      return (
                        <>
                          {gpsData.latitude !== undefined ? (
                            <div><strong style={{ fontSize: '12px', color: '#16a34a' }}>Latitude:</strong> <span style={{ fontSize: '14px', color: '#166534', fontFamily: 'monospace' }}>{gpsData.latitude}</span></div>
                          ) : null}
                          {gpsData.longitude !== undefined ? (
                            <div><strong style={{ fontSize: '12px', color: '#16a34a' }}>Longitude:</strong> <span style={{ fontSize: '14px', color: '#166534', fontFamily: 'monospace' }}>{gpsData.longitude}</span></div>
                          ) : null}
                          {gpsData.speed !== undefined && (
                            <div><strong style={{ fontSize: '12px', color: '#16a34a' }}>Speed:</strong> <span style={{ fontSize: '14px', color: '#166534' }}>{gpsData.speed} km/h</span></div>
                          )}
                          {gpsData.altitude !== undefined && (
                            <div><strong style={{ fontSize: '12px', color: '#16a34a' }}>Altitude:</strong> <span style={{ fontSize: '14px', color: '#166534' }}>{gpsData.altitude} m</span></div>
                          )}
                          {gpsData.heading !== undefined && (
                            <div><strong style={{ fontSize: '12px', color: '#16a34a' }}>Heading:</strong> <span style={{ fontSize: '14px', color: '#166534' }}>{gpsData.heading}°</span></div>
                          )}
                          {gpsData.course !== undefined && (
                            <div><strong style={{ fontSize: '12px', color: '#16a34a' }}>Course:</strong> <span style={{ fontSize: '14px', color: '#166534' }}>{gpsData.course}°</span></div>
                          )}
                          {gpsData.satellites !== undefined && (
                            <div>
                              <strong style={{ fontSize: '12px', color: '#16a34a' }}>Satellites:</strong> 
                              <span style={{ 
                                fontSize: '14px', 
                                color: '#166534',
                                marginLeft: '4px',
                                padding: '2px 8px',
                                background: gpsData.satellites >= 4 ? '#dcfce7' : '#fee2e2',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                🛰️ {gpsData.satellites}
                              </span>
                            </div>
                          )}
                          {gpsData.gpsFixed !== undefined && (
                            <div>
                              <strong style={{ fontSize: '12px', color: '#16a34a' }}>GPS Fix:</strong>
                              <span style={{ 
                                fontSize: '14px', 
                                marginLeft: '8px',
                                padding: '3px 10px',
                                background: gpsData.gpsFixed ? '#86efac' : '#fca5a5',
                                color: gpsData.gpsFixed ? '#166534' : '#991b1b',
                                borderRadius: '6px',
                                fontWeight: 600
                              }}>
                                {gpsData.gpsFixed ? 'FIXED' : 'NO FIX'}
                              </span>
                            </div>
                          )}
                          {gpsData.accuracy !== undefined && (
                            <div><strong style={{ fontSize: '12px', color: '#16a34a' }}>Accuracy:</strong> <span style={{ fontSize: '14px', color: '#166534' }}>{gpsData.accuracy} m</span></div>
                          )}
                          {gpsData.timestamp && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <strong style={{ fontSize: '12px', color: '#16a34a' }}>Last Update:</strong> 
                              <span style={{ fontSize: '14px', color: '#166534', marginLeft: '8px' }}>{toISTString(gpsData.timestamp)}</span>
                            </div>
                          )}
                          {gpsData.gpsTime && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <strong style={{ fontSize: '12px', color: '#16a34a' }}>GPS Time:</strong> 
                              <span style={{ fontSize: '14px', color: '#166534', marginLeft: '8px' }}>{toISTString(gpsData.gpsTime)}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📡</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#991b1b', marginBottom: '6px' }}>No GPS Data Available</div>
                  <div style={{ fontSize: '13px', color: '#b91c1c' }}>
                    {selectedVehicle.imei ? 'No location data found for this IMEI in MongoDB' : 'This vehicle has no IMEI configured'}
                  </div>
                </div>
              )}

              {/* Device Status Section */}
              {selectedVehicle.deviceStatus && selectedVehicle.deviceStatus.status && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🔧 Device Status
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#fffbeb', padding: '16px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                    
                    {/* Ignition Status */}
                    {selectedVehicle.deviceStatus.status.ignition !== null && selectedVehicle.deviceStatus.status.ignition !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>🔑 Ignition:</strong>
                        <span style={{ 
                          fontSize: '14px', 
                          marginLeft: '8px',
                          padding: '3px 10px',
                          background: selectedVehicle.deviceStatus.status.ignition ? '#86efac' : '#fca5a5',
                          color: selectedVehicle.deviceStatus.status.ignition ? '#166534' : '#991b1b',
                          borderRadius: '6px',
                          fontWeight: 700
                        }}>
                          {selectedVehicle.deviceStatus.status.ignition ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    )}

                    {/* Battery Level */}
                    {selectedVehicle.deviceStatus.status.battery !== null && selectedVehicle.deviceStatus.status.battery !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>🔋 Battery:</strong>
                        <span style={{ 
                          fontSize: '14px', 
                          marginLeft: '8px',
                          padding: '3px 10px',
                          background: selectedVehicle.deviceStatus.status.battery > 20 ? '#dbeafe' : '#fee2e2',
                          color: selectedVehicle.deviceStatus.status.battery > 20 ? '#1e40af' : '#991b1b',
                          borderRadius: '6px',
                          fontWeight: 700
                        }}>
                          {selectedVehicle.deviceStatus.status.battery}%
                        </span>
                      </div>
                    )}

                    {/* External Voltage */}
                    {selectedVehicle.deviceStatus.status.voltage !== null && selectedVehicle.deviceStatus.status.voltage !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>⚡ Voltage:</strong>
                        <span style={{ fontSize: '14px', color: '#92400e', marginLeft: '4px', fontWeight: 600 }}>
                          {selectedVehicle.deviceStatus.status.voltage.toFixed(1)}V
                        </span>
                      </div>
                    )}

                    {/* GSM Signal */}
                    {selectedVehicle.deviceStatus.status.gsmSignal !== null && selectedVehicle.deviceStatus.status.gsmSignal !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>📶 Signal:</strong>
                        <span style={{ fontSize: '14px', marginLeft: '4px' }}>
                          {'▮'.repeat(Math.min(5, selectedVehicle.deviceStatus.status.gsmSignal))}
                          <span style={{ color: '#d1d5db' }}>{'▯'.repeat(Math.max(0, 5 - selectedVehicle.deviceStatus.status.gsmSignal))}</span>
                          <span style={{ fontSize: '12px', color: '#92400e', marginLeft: '4px' }}>({selectedVehicle.deviceStatus.status.gsmSignal}/5)</span>
                        </span>
                      </div>
                    )}

                    {/* Charging Status */}
                    {selectedVehicle.deviceStatus.status.charging !== null && selectedVehicle.deviceStatus.status.charging !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>🔌 Charging:</strong>
                        <span style={{ 
                          fontSize: '14px', 
                          marginLeft: '8px',
                          padding: '3px 10px',
                          background: selectedVehicle.deviceStatus.status.charging ? '#86efac' : '#e5e7eb',
                          color: selectedVehicle.deviceStatus.status.charging ? '#166534' : '#6b7280',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          {selectedVehicle.deviceStatus.status.charging ? 'YES' : 'NO'}
                        </span>
                      </div>
                    )}

                    {/* Defense Mode */}
                    {selectedVehicle.deviceStatus.status.defense !== null && selectedVehicle.deviceStatus.status.defense !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>🛡️ Defense:</strong>
                        <span style={{ 
                          fontSize: '14px', 
                          marginLeft: '8px',
                          padding: '3px 10px',
                          background: selectedVehicle.deviceStatus.status.defense ? '#fed7aa' : '#e5e7eb',
                          color: selectedVehicle.deviceStatus.status.defense ? '#9a3412' : '#6b7280',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          {selectedVehicle.deviceStatus.status.defense ? 'ARMED' : 'DISARMED'}
                        </span>
                      </div>
                    )}

                    {/* Oil/Fuel Circuit */}
                    {selectedVehicle.deviceStatus.status.oil !== null && selectedVehicle.deviceStatus.status.oil !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>⛽ Oil Circuit:</strong>
                        <span style={{ 
                          fontSize: '14px', 
                          marginLeft: '8px',
                          padding: '3px 10px',
                          background: selectedVehicle.deviceStatus.status.oil ? '#86efac' : '#fca5a5',
                          color: selectedVehicle.deviceStatus.status.oil ? '#166534' : '#991b1b',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          {selectedVehicle.deviceStatus.status.oil ? 'ON' : 'CUT'}
                        </span>
                      </div>
                    )}

                    {/* Electric Circuit */}
                    {selectedVehicle.deviceStatus.status.electric !== null && selectedVehicle.deviceStatus.status.electric !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>🔌 Electric:</strong>
                        <span style={{ 
                          fontSize: '14px', 
                          marginLeft: '8px',
                          padding: '3px 10px',
                          background: selectedVehicle.deviceStatus.status.electric ? '#86efac' : '#fca5a5',
                          color: selectedVehicle.deviceStatus.status.electric ? '#166534' : '#991b1b',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          {selectedVehicle.deviceStatus.status.electric ? 'ON' : 'CUT'}
                        </span>
                      </div>
                    )}

                    {/* Door Status */}
                    {selectedVehicle.deviceStatus.status.door !== null && selectedVehicle.deviceStatus.status.door !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>🚪 Door:</strong>
                        <span style={{ 
                          fontSize: '14px', 
                          marginLeft: '8px',
                          padding: '3px 10px',
                          background: selectedVehicle.deviceStatus.status.door ? '#fca5a5' : '#86efac',
                          color: selectedVehicle.deviceStatus.status.door ? '#991b1b' : '#166534',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          {selectedVehicle.deviceStatus.status.door ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                    )}

                    {/* GPS Tracking */}
                    {selectedVehicle.deviceStatus.status.gpsTracking !== null && selectedVehicle.deviceStatus.status.gpsTracking !== undefined && (
                      <div>
                        <strong style={{ fontSize: '12px', color: '#d97706' }}>🛰️ GPS Tracking:</strong>
                        <span style={{ 
                          fontSize: '14px', 
                          marginLeft: '8px',
                          padding: '3px 10px',
                          background: selectedVehicle.deviceStatus.status.gpsTracking ? '#86efac' : '#fca5a5',
                          color: selectedVehicle.deviceStatus.status.gpsTracking ? '#166534' : '#991b1b',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          {selectedVehicle.deviceStatus.status.gpsTracking ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Trip Information Section */}
              {selectedVehicle.deviceStatus && selectedVehicle.deviceStatus.trip && selectedVehicle.deviceStatus.trip.odometer !== null && selectedVehicle.deviceStatus.trip.odometer !== undefined && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🗺️ Trip Information
                  </h3>
                  <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <div>
                      <strong style={{ fontSize: '12px', color: '#1e40af' }}>📏 Total Odometer:</strong>
                      <span style={{ fontSize: '18px', color: '#1e3a8a', marginLeft: '8px', fontWeight: 700 }}>
                        {(selectedVehicle.deviceStatus.trip.odometer / 1000).toFixed(2)} km
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Alerts Section */}
              {selectedVehicle.deviceStatus && selectedVehicle.deviceStatus.alerts && selectedVehicle.deviceStatus.alerts.latestAlarm && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🚨 Active Alerts
                  </h3>
                  <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '2px solid #fca5a5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>🔔</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                          {selectedVehicle.deviceStatus.alerts.latestAlarm}
                        </div>
                        {selectedVehicle.deviceStatus.alerts.alarmTimestamp && (
                          <div style={{ fontSize: '12px', color: '#b91c1c' }}>
                            {toISTString(selectedVehicle.deviceStatus.alerts.alarmTimestamp)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right' }}>
              <button onClick={closeGpsModal} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Overlay ── */}
      <div style={overlay} onClick={closeSidebar} />

      {/* ── Edit Sidebar ── */}
      <div style={sidebar}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e3a5f' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>Edit Vehicle</div>
            {editVehicle && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', marginTop: '2px' }}>{editVehicle.vehicleNumber || `ID #${editVehicle.id}`}</div>}
          </div>
          <button onClick={closeSidebar} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleEditSubmit} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>

          {/* Accordion 1: Vehicle Identification */}
          <div style={sectionHead} onClick={() => toggleSection('identification')}>
            <span style={sectionHeadLabel}>🚗 Vehicle Identification</span>
            <span style={{ color: '#64748b', fontSize: '12px' }}>{openSections['identification'] ? '▲' : '▼'}</span>
          </div>
          {openSections['identification'] && (
            <div style={sectionBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <div style={{ gridColumn: '1 / -1', marginBottom: '12px' }}>
                  <label style={labelStyle}>Registration Number</label>
                  <input name="vehicleNumber" style={{ ...inputStyle, textTransform: 'uppercase' }} placeholder="e.g. MH12AB1234" value={editForm.vehicleNumber} onChange={handleEditChange} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Chassis Number</label>
                  <input name="chasisNumber" style={inputStyle} placeholder="e.g. MA3FJEB1S00100001" value={editForm.chasisNumber} onChange={handleEditChange} />
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <label style={labelStyle}>Engine Number</label>
                  <input name="engineNumber" style={inputStyle} placeholder="e.g. K10BN1234567" value={editForm.engineNumber} onChange={handleEditChange} />
                </div>
                <div style={{ gridColumn: '1 / -1', marginBottom: '4px' }}>
                  <label style={labelStyle}>IMEI Number</label>
                  <input name="imei" style={inputStyle} placeholder="15-digit IMEI" value={editForm.imei} onChange={handleEditChange} maxLength={20} />
                </div>
              </div>
            </div>
          )}

          {/* Accordion 2: Status */}
          <div style={sectionHead} onClick={() => toggleSection('status')}>
            <span style={sectionHeadLabel}>🔖 Status</span>
            <span style={{ color: '#64748b', fontSize: '12px' }}>{openSections['status'] ? '▲' : '▼'}</span>
          </div>
          {openSections['status'] && (
            <div style={sectionBody}>
              <label style={labelStyle}>Vehicle Status</label>
              <select name="status" style={inputStyle} value={editForm.status} onChange={handleEditChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          )}

          {/* Accordion 3: Data & Compliance */}
          <div style={sectionHead} onClick={() => toggleSection('compliance')}>
            <span style={sectionHeadLabel}>📋 Data &amp; Compliance</span>
            <span style={{ color: '#64748b', fontSize: '12px' }}>{openSections['compliance'] ? '▲' : '▼'}</span>
          </div>
          {openSections['compliance'] && (
            <div style={sectionBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  <input type="checkbox" name="rtoData" checked={editForm.rtoData} onChange={handleEditChange} style={{ width: '16px', height: '16px', accentColor: '#2563eb' }} />
                  <span><strong>RTO Data</strong> — Vehicle has RTO compliance data</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  <input type="checkbox" name="challanData" checked={editForm.challanData} onChange={handleEditChange} style={{ width: '16px', height: '16px', accentColor: '#2563eb' }} />
                  <span><strong>Challan Data</strong> — Vehicle has challan records</span>
                </label>
              </div>
            </div>
          )}

          {/* Accordion 4: GPS Tracker */}
          <div style={sectionHead} onClick={() => toggleSection('gps')}>
            <span style={sectionHeadLabel}>📡 GPS Tracker</span>
            <span style={{ color: '#64748b', fontSize: '12px' }}>{openSections['gps'] ? '▲' : '▼'}</span>
          </div>
          {openSections['gps'] && (
            <div style={sectionBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <div style={{ gridColumn: '1 / -1', marginBottom: '12px' }}>
                  <label style={labelStyle}>Server IP Address</label>
                  <input name="serverIp" style={inputStyle} placeholder="e.g. 103.21.58.200" value={editForm.serverIp} onChange={handleEditChange} />
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <label style={labelStyle}>Server Port</label>
                  <input name="serverPort" type="number" style={inputStyle} placeholder="e.g. 5023" value={editForm.serverPort} onChange={handleEditChange} min={1} max={65535} />
                </div>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '11px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : '✓ Save Changes'}
            </button>
            <button type="button" onClick={closeSidebar} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* ── Page ── */}
      <div className="page-header">
        <div>
          <h2 className="page-title">My Fleet</h2>
          <p className="page-subtitle">{stats.total} vehicles • {stats.active} active • {stats.withGps} with GPS • {stats.moving} moving</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn btn-outline"
            onClick={fetchVehicles}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: autoRefresh ? '#dcfce7' : '#fff' }}>
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
            />
            <span style={{ color: autoRefresh ? '#15803d' : '#64748b', fontWeight: 500 }}>Auto-refresh (30s)</span>
          </label>
          <Link to="/add-vehicle" className="btn btn-primary">
            ➕ Add Vehicle
          </Link>
        </div>
      </div>
      
      {/* Quick Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{stats.total}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Total Vehicles</div>
            </div>
            <div style={{ fontSize: '40px', opacity: 0.3 }}>🚗</div>
          </div>
        </div>
        
        <div className="card" style={{ padding: '16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{stats.active}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Active Vehicles</div>
            </div>
            <div style={{ fontSize: '40px', opacity: 0.3 }}>✅</div>
          </div>
        </div>
        
        <div className="card" style={{ padding: '16px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{stats.withGps}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>GPS Enabled</div>
            </div>
            <div style={{ fontSize: '40px', opacity: 0.3 }}>📡</div>
          </div>
        </div>
        
        <div className="card" style={{ padding: '16px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{stats.moving}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Moving Now</div>
            </div>
            <div style={{ fontSize: '40px', opacity: 0.3 }}>🚀</div>
          </div>
        </div>
        
        <div className="card" style={{ padding: '16px', background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{stats.avgSpeed}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Avg Speed (km/h)</div>
            </div>
            <div style={{ fontSize: '40px', opacity: 0.3 }}>⚡</div>
          </div>
        </div>
      </div>

      {/* ── Split View: Vehicle List (Left) and Map (Right) ── */}
      <div className="fleet-split-container" style={{ display: 'flex', gap: '20px', alignItems: 'stretch', maxWidth: '100%', overflow: 'hidden' }}>
        {/* Left: Vehicle List */}
        <div className="card" style={{ flex: '0 0 55%', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚗 Vehicle Fleet
              <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b', background: '#fff', padding: '2px 8px', borderRadius: '12px' }}>
                {filtered.length} vehicles
              </span>
            </h3>
            <div style={{ marginTop: '12px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search by vehicle number, IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <select 
                className="form-control" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="deleted">Deleted Only</option>
              </select>
              
              <select 
                className="form-control" 
                value={gpsFilter} 
                onChange={(e) => setGpsFilter(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="all">All GPS Status</option>
                <option value="with-gps">With GPS Only</option>
                <option value="no-gps">No GPS Only</option>
              </select>
            </div>
            
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Showing {filtered.length} of {vehicles.length} vehicles</span>
              {selectedVehicleIds.length > 0 && (
                <span style={{ 
                  background: '#3b82f6', 
                  color: '#fff', 
                  padding: '4px 10px', 
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  {selectedVehicleIds.length} selected
                </span>
              )}
            </div>
            
            {/* Bulk Actions Bar */}
            {selectedVehicleIds.length > 0 && (
              <div style={{ 
                marginTop: '12px', 
                padding: '10px 12px', 
                background: 'linear-gradient(135deg, #dbeafe 0%, #bae6fd 100%)', 
                borderLeft: '3px solid #3b82f6',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>
                  {selectedVehicleIds.length} vehicle{selectedVehicleIds.length > 1 ? 's' : ''} selected
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVehicleIds([]);
                    }}
                    style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      color: '#64748b',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                  <button 
                    onClick={handleSelectAll}
                    style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      color: '#3b82f6',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Info Banner */}
            {selectedVehicleIds.length === 0 && (
              <div style={{ 
                marginTop: '12px', 
                padding: '10px 12px', 
                background: 'linear-gradient(135deg, #dbeafe 0%, #f0f9ff 100%)', 
                borderLeft: '3px solid #3b82f6',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>💡</span>
                <span>Device status auto-loads (ignition, battery, voltage, alarms, odometer). Click <strong>🔄 Sync</strong> to refresh</span>
              </div>
            )}
          </div>

          {/* Vehicle List Container */}
          <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
            {loading ? (
              <div style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>Loading vehicles...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>🚗</div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>
                  {search || statusFilter !== 'all' || gpsFilter !== 'all' ? 'No vehicles match your filters.' : 'No vehicles registered yet.'}
                </div>
              </div>
            ) : detailViewVehicle ? (
              /* ═══ DETAIL VIEW ═══ */
              <div style={{ height: '100%', overflow: 'auto' }}>
                {/* Detail Header */}
                <div style={{ 
                  padding: '20px', 
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
                  borderBottom: '1px solid #e2e8f0',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10
                }}>
                  <button 
                    onClick={() => setDetailViewVehicle(null)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
                    onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                  >
                    ← Back to List
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#fff' }}>
                        {detailViewVehicle.vehicleNumber || `Vehicle #${detailViewVehicle.id}`}
                      </h2>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
                        IMEI: {detailViewVehicle.imei || 'N/A'}
                      </div>
                    </div>
                    <span className={`badge ${statusBadge[detailViewVehicle.status] || 'badge-gray'}`} style={{ fontSize: '12px' }}>
                      {detailViewVehicle.status}
                    </span>
                  </div>
                </div>

                {/* Detail Content */}
                <div style={{ padding: '20px' }}>
                  {/* Quick Actions */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                    gap: '12px',
                    marginBottom: '24px'
                  }}>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => handleSync(detailViewVehicle)} 
                      disabled={syncingVehicleId !== null}
                      style={{
                        padding: '12px',
                        fontSize: '13px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        background: syncingVehicleId === detailViewVehicle.id ? '#fef3c7' : '#f0f9ff',
                        borderColor: syncingVehicleId === detailViewVehicle.id ? '#fbbf24' : '#bae6fd',
                        borderRadius: '12px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{syncingVehicleId === detailViewVehicle.id ? '⏳' : '🔄'}</span>
                      <span>Sync Data</span>
                    </button>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => showGpsData(detailViewVehicle)}
                      style={{
                        padding: '12px',
                        fontSize: '13px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#f0fdf4',
                        borderColor: '#bbf7d0',
                        borderRadius: '12px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>📍</span>
                      <span>View Location</span>
                    </button>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => openLocationPlayer(detailViewVehicle)}
                      style={{
                        padding: '12px',
                        fontSize: '13px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#faf5ff',
                        borderColor: '#e9d5ff',
                        borderRadius: '12px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>🎬</span>
                      <span>History</span>
                    </button>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => openEdit(detailViewVehicle)}
                      style={{
                        padding: '12px',
                        fontSize: '13px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#fffbeb',
                        borderColor: '#fef3c7',
                        borderRadius: '12px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>✏️</span>
                      <span>Edit</span>
                    </button>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => handleDelete(detailViewVehicle.id)}
                      style={{
                        padding: '12px',
                        fontSize: '13px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#fef2f2',
                        borderColor: '#fecaca',
                        color: '#dc2626',
                        borderRadius: '12px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>🗑️</span>
                      <span>Delete</span>
                    </button>
                  </div>

                  {/* Live Status Grid */}
                  {(() => {
                    const timestamp = detailViewVehicle.deviceStatus?.lastUpdate || detailViewVehicle.deviceStatus?.gpsData?.timestamp || detailViewVehicle.gpsData?.timestamp;
                    const timeSince = timestamp ? Math.floor((new Date() - new Date(timestamp)) / 60000) : null;
                    const gpsData = detailViewVehicle.deviceStatus?.gpsData || detailViewVehicle.gpsData;
                    const status = detailViewVehicle.deviceStatus?.status;
                    
                    return (
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📊 Live Status
                        </h3>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                          gap: '12px'
                        }}>
                          {/* Speed */}
                          {gpsData?.speed !== undefined && (
                            <div style={{ 
                              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
                              padding: '16px', 
                              borderRadius: '12px',
                              border: '2px solid #86efac',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '10px', color: '#15803d', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Speed
                              </div>
                              <div style={{ fontSize: '32px', fontWeight: 700, color: '#15803d' }}>
                                {gpsData.speed}
                              </div>
                              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px', fontWeight: 600 }}>
                                KM/H
                              </div>
                            </div>
                          )}
                          
                          {/* Battery */}
                          {status?.battery !== null && status?.battery !== undefined && (
                            <div style={{ 
                              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                              padding: '16px', 
                              borderRadius: '12px',
                              border: '2px solid #93c5fd',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '10px', color: '#1e40af', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Battery
                              </div>
                              <div style={{ fontSize: '28px', marginBottom: '4px' }}>🔋</div>
                              <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af' }}>
                                {status.battery}%
                              </div>
                            </div>
                          )}
                          
                          {/* Voltage */}
                          {status?.voltage !== null && status?.voltage !== undefined && (
                            <div style={{ 
                              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', 
                              padding: '16px', 
                              borderRadius: '12px',
                              border: '2px solid #fde047',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '10px', color: '#92400e', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Voltage
                              </div>
                              <div style={{ fontSize: '28px', marginBottom: '4px' }}>⚡</div>
                              <div style={{ fontSize: '20px', fontWeight: 700, color: '#92400e' }}>
                                {status.voltage.toFixed(1)}V
                              </div>
                            </div>
                          )}
                          
                          {/* Ignition */}
                          {status?.ignition !== null && status?.ignition !== undefined && (
                            <div style={{ 
                              background: status.ignition ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                              padding: '16px', 
                              borderRadius: '12px',
                              border: `2px solid ${status.ignition ? '#86efac' : '#fca5a5'}`,
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '10px', color: status.ignition ? '#15803d' : '#dc2626', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Ignition
                              </div>
                              <div style={{ fontSize: '28px', marginBottom: '4px' }}>🔑</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: status.ignition ? '#15803d' : '#dc2626' }}>
                                {status.ignition ? 'ON' : 'OFF'}
                              </div>
                            </div>
                          )}
                          
                          {/* Satellites */}
                          {gpsData?.satellites !== undefined && (
                            <div style={{ 
                              background: gpsData.satellites >= 4 ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                              padding: '16px', 
                              borderRadius: '12px',
                              border: `2px solid ${gpsData.satellites >= 4 ? '#86efac' : '#fca5a5'}`,
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '10px', color: gpsData.satellites >= 4 ? '#15803d' : '#dc2626', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Satellites
                              </div>
                              <div style={{ fontSize: '28px', marginBottom: '4px' }}>🛰️</div>
                              <div style={{ fontSize: '20px', fontWeight: 700, color: gpsData.satellites >= 4 ? '#15803d' : '#dc2626' }}>
                                {gpsData.satellites}
                              </div>
                            </div>
                          )}
                          
                          {/* GSM Signal */}
                          {status?.gsmSignal !== null && status?.gsmSignal !== undefined && (
                            <div style={{ 
                              background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', 
                              padding: '16px', 
                              borderRadius: '12px',
                              border: '2px solid #c4b5fd',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '10px', color: '#7c3aed', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                GSM Signal
                              </div>
                              <div style={{ fontSize: '28px', marginBottom: '4px' }}>📶</div>
                              <div style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed' }}>
                                {status.gsmSignal}/5
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Last Update */}
                        {timeSince !== null && (
                          <div style={{ 
                            marginTop: '16px', 
                            padding: '12px 16px', 
                            background: '#f8fafc', 
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>⏱️</span>
                            <span>Last updated: <strong style={{ color: '#1e3a5f' }}>
                              {timeSince === 0 ? 'Just now' :
                               timeSince < 60 ? `${timeSince} minutes ago` :
                               timeSince < 1440 ? `${Math.floor(timeSince/60)} hours ago` :
                               `${Math.floor(timeSince/1440)} days ago`}
                            </strong></span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Vehicle Information */}
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🚗 Vehicle Information
                    </h3>
                    <div style={{ 
                      background: '#f8fafc', 
                      borderRadius: '12px', 
                      padding: '20px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#64748b' }}>Registration:</div>
                        <div style={{ color: '#1e3a5f' }}>{detailViewVehicle.vehicleNumber || '—'}</div>
                        
                        <div style={{ fontWeight: 600, color: '#64748b' }}>Chassis Number:</div>
                        <div style={{ color: '#1e3a5f', fontFamily: 'monospace', fontSize: '13px' }}>{detailViewVehicle.chasisNumber || '—'}</div>
                        
                        <div style={{ fontWeight: 600, color: '#64748b' }}>Engine Number:</div>
                        <div style={{ color: '#1e3a5f', fontFamily: 'monospace', fontSize: '13px' }}>{detailViewVehicle.engineNumber || '—'}</div>
                        
                        <div style={{ fontWeight: 600, color: '#64748b' }}>IMEI:</div>
                        <div style={{ color: '#1e3a5f', fontFamily: 'monospace', fontSize: '13px' }}>{detailViewVehicle.imei || '—'}</div>
                        
                        <div style={{ fontWeight: 600, color: '#64748b' }}>Status:</div>
                        <div><span className={`badge ${statusBadge[detailViewVehicle.status]}`}>{detailViewVehicle.status}</span></div>
                        
                        {detailViewVehicle.serverIp && (
                          <>
                            <div style={{ fontWeight: 600, color: '#64748b' }}>Server:</div>
                            <div style={{ color: '#1e3a5f', fontFamily: 'monospace', fontSize: '13px' }}>
                              {detailViewVehicle.serverIp}:{detailViewVehicle.serverPort || '—'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Device Status Details */}
                  {detailViewVehicle.deviceStatus && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📱 Device Status Details
                      </h3>
                      <div style={{ 
                        background: '#faf5ff', 
                        borderRadius: '12px', 
                        padding: '20px',
                        border: '1px solid #e9d5ff'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                          {detailViewVehicle.deviceStatus.status?.defense !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#7c3aed' }}>Defense Mode:</div>
                              <div style={{ color: '#5b21b6' }}>{detailViewVehicle.deviceStatus.status.defense ? '✅ Active' : '❌ Inactive'}</div>
                            </>
                          )}
                          
                          {detailViewVehicle.deviceStatus.status?.oil !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#7c3aed' }}>Oil Circuit:</div>
                              <div style={{ color: '#5b21b6' }}>{detailViewVehicle.deviceStatus.status.oil ? '✅ Connected' : '❌ Cut'}</div>
                            </>
                          )}
                          
                          {detailViewVehicle.deviceStatus.status?.electric !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#7c3aed' }}>Electric Circuit:</div>
                              <div style={{ color: '#5b21b6' }}>{detailViewVehicle.deviceStatus.status.electric ? '✅ Connected' : '❌ Cut'}</div>
                            </>
                          )}
                          
                          {detailViewVehicle.deviceStatus.status?.door !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#7c3aed' }}>Door Status:</div>
                              <div style={{ color: '#5b21b6' }}>{detailViewVehicle.deviceStatus.status.door ? '🚪 Open' : '🔒 Closed'}</div>
                            </>
                          )}
                          
                          {detailViewVehicle.deviceStatus.status?.charging !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#7c3aed' }}>Charging:</div>
                              <div style={{ color: '#5b21b6' }}>{detailViewVehicle.deviceStatus.status.charging ? '🔌 Yes' : '🔋 No'}</div>
                            </>
                          )}
                          
                          {detailViewVehicle.deviceStatus.trip?.odometer !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#7c3aed' }}>Odometer:</div>
                              <div style={{ color: '#5b21b6', fontFamily: 'monospace' }}>{detailViewVehicle.deviceStatus.trip.odometer} km</div>
                            </>
                          )}
                          
                          {detailViewVehicle.deviceStatus.alerts?.latestAlarm && (
                            <>
                              <div style={{ fontWeight: 600, color: '#dc2626' }}>⚠️ Latest Alarm:</div>
                              <div style={{ color: '#dc2626', fontWeight: 600 }}>{detailViewVehicle.deviceStatus.alerts.latestAlarm}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FMB125 - Fuel Monitoring */}
                  {detailViewVehicle.deviceStatus?.fuel && (
                    detailViewVehicle.deviceStatus.fuel.level !== null || detailViewVehicle.deviceStatus.fuel.used !== null || detailViewVehicle.deviceStatus.fuel.rate !== null
                  ) && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ⛽ Fuel Monitoring
                      </h3>
                      <div style={{ 
                        background: '#fefce8', 
                        borderRadius: '12px', 
                        padding: '20px',
                        border: '1px solid #fde68a'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                          {detailViewVehicle.deviceStatus.fuel.level !== null && detailViewVehicle.deviceStatus.fuel.level !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#a16207' }}>Fuel Level:</div>
                              <div style={{ color: '#854d0e', fontWeight: 600 }}>
                                <span style={{
                                  padding: '2px 10px',
                                  borderRadius: '6px',
                                  background: detailViewVehicle.deviceStatus.fuel.level > 20 ? '#dcfce7' : '#fee2e2',
                                  color: detailViewVehicle.deviceStatus.fuel.level > 20 ? '#166534' : '#dc2626',
                                }}>
                                  {detailViewVehicle.deviceStatus.fuel.level}%
                                </span>
                              </div>
                            </>
                          )}
                          {detailViewVehicle.deviceStatus.fuel.used !== null && detailViewVehicle.deviceStatus.fuel.used !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#a16207' }}>Fuel Used:</div>
                              <div style={{ color: '#854d0e', fontFamily: 'monospace' }}>{detailViewVehicle.deviceStatus.fuel.used} L</div>
                            </>
                          )}
                          {detailViewVehicle.deviceStatus.fuel.rate !== null && detailViewVehicle.deviceStatus.fuel.rate !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#a16207' }}>Fuel Rate:</div>
                              <div style={{ color: '#854d0e', fontFamily: 'monospace' }}>{detailViewVehicle.deviceStatus.fuel.rate} L/h</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FMB125 - Engine Data */}
                  {detailViewVehicle.deviceStatus?.engine && (
                    detailViewVehicle.deviceStatus.engine.speed !== null || detailViewVehicle.deviceStatus.engine.temperature !== null || detailViewVehicle.deviceStatus.engine.load !== null
                  ) && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🔧 Engine Data
                      </h3>
                      <div style={{ 
                        background: '#f0f9ff', 
                        borderRadius: '12px', 
                        padding: '20px',
                        border: '1px solid #bae6fd'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                          {detailViewVehicle.deviceStatus.engine.speed !== null && detailViewVehicle.deviceStatus.engine.speed !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#0369a1' }}>Engine RPM:</div>
                              <div style={{ color: '#0c4a6e', fontFamily: 'monospace', fontWeight: 600 }}>{detailViewVehicle.deviceStatus.engine.speed} RPM</div>
                            </>
                          )}
                          {detailViewVehicle.deviceStatus.engine.temperature !== null && detailViewVehicle.deviceStatus.engine.temperature !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#0369a1' }}>Engine Temp:</div>
                              <div style={{ color: detailViewVehicle.deviceStatus.engine.temperature > 100 ? '#dc2626' : '#0c4a6e', fontFamily: 'monospace', fontWeight: 600 }}>
                                {detailViewVehicle.deviceStatus.engine.temperature}°C
                              </div>
                            </>
                          )}
                          {detailViewVehicle.deviceStatus.engine.load !== null && detailViewVehicle.deviceStatus.engine.load !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#0369a1' }}>Engine Load:</div>
                              <div style={{ color: '#0c4a6e', fontFamily: 'monospace' }}>{detailViewVehicle.deviceStatus.engine.load}%</div>
                            </>
                          )}
                          {detailViewVehicle.deviceStatus.engine.hours !== null && detailViewVehicle.deviceStatus.engine.hours !== undefined && (
                            <>
                              <div style={{ fontWeight: 600, color: '#0369a1' }}>Engine Hours:</div>
                              <div style={{ color: '#0c4a6e', fontFamily: 'monospace' }}>{detailViewVehicle.deviceStatus.engine.hours} hrs</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FMB125 - Driver Info */}
                  {detailViewVehicle.deviceStatus?.driver && (
                    detailViewVehicle.deviceStatus.driver.iButtonId || detailViewVehicle.deviceStatus.driver.name
                  ) && (
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        👤 Driver Information
                      </h3>
                      <div style={{ 
                        background: '#fdf4ff', 
                        borderRadius: '12px', 
                        padding: '20px',
                        border: '1px solid #f0abfc'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                          {detailViewVehicle.deviceStatus.driver.name && (
                            <>
                              <div style={{ fontWeight: 600, color: '#a21caf' }}>Driver Name:</div>
                              <div style={{ color: '#86198f', fontWeight: 600 }}>{detailViewVehicle.deviceStatus.driver.name}</div>
                            </>
                          )}
                          {detailViewVehicle.deviceStatus.driver.iButtonId && (
                            <>
                              <div style={{ fontWeight: 600, color: '#a21caf' }}>iButton ID:</div>
                              <div style={{ color: '#86198f', fontFamily: 'monospace', fontSize: '13px' }}>{detailViewVehicle.deviceStatus.driver.iButtonId}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ═══ LIST VIEW ═══ */
              <div>
                {filtered.map((v) => {
                  const timestamp = v.deviceStatus?.lastUpdate || v.deviceStatus?.gpsData?.timestamp || v.gpsData?.timestamp;
                  const timeSince = timestamp ? Math.floor((new Date() - new Date(timestamp)) / 60000) : null;
                  const gpsData = v.deviceStatus?.gpsData || v.gpsData;
                  const status = v.deviceStatus?.status;
                  
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        setDetailViewVehicle(v);
                        setFocusedVehicleId(v.id);
                      }}
                      onMouseEnter={() => {
                        setHoveredVehicleId(v.id);
                        if (v.coords && v.coords.lat && v.coords.lng) {
                          setFocusedVehicleId(v.id);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredVehicleId(null);
                        setFocusedVehicleId(null);
                      }}
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e2e8f0',
                        background: hoveredVehicleId === v.id ? '#f8fafc' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        position: 'relative'
                      }}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedVehicleIds.includes(v.id)}
                        onChange={(e) => handleSelectVehicle(v.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          flexShrink: 0,
                          accentColor: '#3b82f6'
                        }}
                      />
                      
                      {/* Vehicle Icon/Number */}
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '14px',
                        background: '#fff',
                        border: '2px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                      }}>
                        <span style={{ fontSize: '28px', lineHeight: 1 }}>
                          {VEHICLE_ICON_MAP[v.vehicleIcon] || VEHICLE_ICON_MAP['car']}
                        </span>
                        {status?.ignition && (
                          <div style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: '#10b981',
                            border: '2px solid #fff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                          }} />
                        )}
                      </div>
                      
                      {/* Vehicle Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e3a5f' }}>
                            {v.vehicleNumber || '—'}
                          </span>
                          <span className={`badge ${statusBadge[v.status] || 'badge-gray'}`} style={{ fontSize: '10px' }}>
                            {v.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {v.imei || 'No IMEI'} 
                          {gpsData?.speed !== undefined && (
                            <span style={{ marginLeft: '12px', color: gpsData.speed > 0 ? '#15803d' : '#64748b', fontWeight: 500 }}>
                              • {gpsData.speed} km/h
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Quick Stats */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                        {/* GPS Status */}
                        {(gpsData?.latitude && gpsData?.longitude) ? (
                          <div style={{ 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#15803d',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            📍 GPS
                          </div>
                        ) : (
                          <div style={{ 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            📍 No GPS
                          </div>
                        )}
                        
                        {/* Ignition Status */}
                        {status?.ignition !== null && status?.ignition !== undefined && (
                          <div style={{ 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            background: status.ignition ? '#dcfce7' : '#f8fafc',
                            border: `1px solid ${status.ignition ? '#86efac' : '#e2e8f0'}`,
                            fontSize: '11px',
                            fontWeight: 600,
                            color: status.ignition ? '#15803d' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            🔑 {status.ignition ? 'ON' : 'OFF'}
                          </div>
                        )}
                        
                        {/* Battery */}
                        {status?.battery !== null && status?.battery !== undefined && (
                          <div style={{ 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            background: status.battery > 20 ? '#eff6ff' : '#fee2e2',
                            border: `1px solid ${status.battery > 20 ? '#bfdbfe' : '#fecaca'}`,
                            fontSize: '11px',
                            fontWeight: 600,
                            color: status.battery > 20 ? '#1e40af' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            🔋 {status.battery}%
                          </div>
                        )}

                        {/* FMB125 - Fuel Level */}
                        {v.deviceStatus?.fuel?.level !== null && v.deviceStatus?.fuel?.level !== undefined && (
                          <div style={{ 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            background: v.deviceStatus.fuel.level > 20 ? '#fefce8' : '#fee2e2',
                            border: `1px solid ${v.deviceStatus.fuel.level > 20 ? '#fde68a' : '#fecaca'}`,
                            fontSize: '11px',
                            fontWeight: 600,
                            color: v.deviceStatus.fuel.level > 20 ? '#a16207' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ⛽ {v.deviceStatus.fuel.level}%
                          </div>
                        )}

                        {/* FMB125 - Engine RPM */}
                        {v.deviceStatus?.engine?.speed !== null && v.deviceStatus?.engine?.speed !== undefined && (
                          <div style={{ 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            background: '#faf5ff',
                            border: '1px solid #e9d5ff',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#7c3aed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            🔧 {v.deviceStatus.engine.speed} RPM
                          </div>
                        )}
                        
                        {/* Satellites */}
                        {gpsData?.satellites !== undefined && (
                          <div style={{ 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            background: gpsData.satellites >= 4 ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${gpsData.satellites >= 4 ? '#bbf7d0' : '#fecaca'}`,
                            fontSize: '11px',
                            fontWeight: 600,
                            color: gpsData.satellites >= 4 ? '#15803d' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            🛰️ {gpsData.satellites}
                          </div>
                        )}
                        
                        {/* Last Update */}
                        {timeSince !== null && (
                          <div style={{ 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            fontSize: '11px', 
                            color: timeSince < 5 ? '#15803d' : timeSince < 60 ? '#f59e0b' : '#94a3b8',
                            fontWeight: 600
                          }}>
                            {timeSince === 0 ? 'Now' :
                             timeSince < 60 ? `${timeSince}m` :
                             timeSince < 1440 ? `${Math.floor(timeSince/60)}h` :
                             `${Math.floor(timeSince/1440)}d`}
                          </div>
                        )}
                      </div>
                      
                      {/* Chevron */}
                      <div style={{ fontSize: '18px', color: '#cbd5e1', flexShrink: 0 }}>
                        →
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Map Section */}
        <div className="card" style={{ flex: '0 0 calc(45% - 10px)', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>🗺️ Live Fleet Tracking</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
              {mapVehicles.length > 0 ? (
                <>
                  <span style={{ fontWeight: 600 }}>{mapVehicles.length}</span> vehicles tracked • 
                  <span style={{ fontWeight: 600 }}>{mapVehicles.filter(v => v.gpsData?.speed > 0).length}</span> moving
                </>
              ) : 'No GPS data available'}
            </p>
          </div>
          <div style={{ flex: 1, minHeight: '600px', position: 'relative', background: '#f8fafc' }}>
            {mapVehicles.length > 0 ? (
              <>
                <MapContainer
                  center={mapCenter}
                  zoom={mapVehicles.length === 1 ? 13 : 6}
                  style={{ height: '100%', width: '100%' }}
                >
                  <MapController 
                    focusedVehicle={mapVehicles.find(v => v.id === focusedVehicleId)} 
                    mapVehicles={mapVehicles} 
                  />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {mapVehicles.map((vehicle) => {
                    const isHovered = hoveredVehicleId === vehicle.id;
                    // Use deviceStatus ignition if available, fallback to gpsData speed
                    const gpsData = vehicle.deviceStatus?.gpsData || vehicle.gpsData;
                    const isIgnitionOn = vehicle.deviceStatus?.status?.ignition ?? (gpsData?.speed > 0);
                    const markerColor = isHovered ? '#dc2626' : (isIgnitionOn ? '#10b981' : '#2563eb');
                    return (
                      <CircleMarker
                      key={vehicle.id}
                      center={[vehicle.coords.lat, vehicle.coords.lng]}
                      radius={isHovered ? 12 : 8}
                      fillColor={markerColor}
                      color="#fff"
                      weight={isHovered ? 3 : 2}
                      opacity={1}
                      fillOpacity={isHovered ? 1 : 0.8}
                    >
                      <Popup>
                        <div style={{ minWidth: '220px' }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: '#1e3a5f' }}>
                            {vehicle.vehicleNumber || `Vehicle #${vehicle.id}`}
                          </div>
                          {vehicle.imei && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                              <strong>IMEI:</strong> {vehicle.imei}
                            </div>
                          )}
                          {(() => {
                            const gpsData = vehicle.deviceStatus?.gpsData || vehicle.gpsData;
                            return gpsData && (
                              <>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                                  <strong>Lat:</strong> {gpsData.latitude?.toFixed(6)}, <strong>Lng:</strong> {gpsData.longitude?.toFixed(6)}
                                </div>
                                {gpsData.speed !== undefined && (
                                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                                    <strong>Speed:</strong> {gpsData.speed} km/h
                                  </div>
                                )}
                                {gpsData.deviceModel && (
                                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                                    <strong>Device:</strong> {gpsData.deviceModel}
                                  </div>
                                )}
                                {gpsData.satellites !== undefined && (
                                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                                    <strong>Satellites:</strong> {gpsData.satellites}
                                  </div>
                                )}
                                {gpsData.timestamp && (
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                                    {toISTString(gpsData.timestamp)}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          
                          {/* Device Status in Popup */}
                          {vehicle.deviceStatus?.status && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                                Device Status:
                              </div>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {vehicle.deviceStatus.status.ignition !== null && vehicle.deviceStatus.status.ignition !== undefined && (
                                  <span style={{ 
                                    fontSize: '10px', 
                                    padding: '2px 5px', 
                                    borderRadius: '3px',
                                    background: vehicle.deviceStatus.status.ignition ? '#dcfce7' : '#fee2e2',
                                    color: vehicle.deviceStatus.status.ignition ? '#15803d' : '#dc2626',
                                    fontWeight: 600
                                  }}>
                                    🔑{vehicle.deviceStatus.status.ignition ? 'ON' : 'OFF'}
                                  </span>
                                )}
                                {vehicle.deviceStatus.status.battery !== null && vehicle.deviceStatus.status.battery !== undefined && (
                                  <span style={{ 
                                    fontSize: '10px', 
                                    padding: '2px 5px', 
                                    borderRadius: '3px',
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    fontWeight: 600
                                  }}>
                                    🔋{vehicle.deviceStatus.status.battery}%
                                  </span>
                                )}
                                {vehicle.deviceStatus.status.voltage !== null && vehicle.deviceStatus.status.voltage !== undefined && (
                                  <span style={{ 
                                    fontSize: '10px', 
                                    padding: '2px 5px', 
                                    borderRadius: '3px',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    fontWeight: 600
                                  }}>
                                    ⚡{vehicle.deviceStatus.status.voltage.toFixed(1)}V
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
              
              {/* Floating Legend */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: legendMinimized ? '12px' : '16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                zIndex: 1000,
                minWidth: legendMinimized ? '180px' : '240px',
                border: '1px solid rgba(230, 230, 230, 0.8)',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a5f', marginBottom: legendMinimized ? 0 : '12px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🗺️ Map Legend</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 400, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px' }}>LIVE</span>
                    <button
                      onClick={() => setLegendMinimized(!legendMinimized)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '2px',
                        lineHeight: 1,
                        color: '#64748b',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#1e3a5f'}
                      onMouseLeave={(e) => e.target.style.color = '#64748b'}
                      title={legendMinimized ? 'Expand legend' : 'Collapse legend'}
                    >
                      {legendMinimized ? '⊕' : '⊖'}
                    </button>
                  </div>
                </div>
                {!legendMinimized && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '4px' }}>Vehicle Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#10b981', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}></div>
                    <span style={{ color: '#475569' }}>Moving</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#2563eb', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)' }}></div>
                    <span style={{ color: '#475569' }}>Stationary</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#dc2626', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)' }}></div>
                    <span style={{ color: '#475569' }}>Hovered</span>
                  </div>
                  
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '8px' }}>Speed Indicator</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #10b981, #059669)' }}></div>
                        <span style={{ color: '#475569' }}>Moving</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '8px', borderRadius: '4px', background: '#cbd5e1' }}></div>
                        <span style={{ color: '#475569' }}>Stationary</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '8px', fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>
                    👆 Hover over vehicles to highlight on map
                  </div>
                  
                  <div style={{ marginTop: '6px', fontSize: '10px', color: '#cbd5e1', textAlign: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                    Last updated: {toISTTimeString(lastRefresh)}
                  </div>
                </div>
                )}
              </div>
            </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', textAlign: 'center', padding: '40px' }}>
                <div>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>🗺️</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No GPS Data Available</div>
                  <div style={{ fontSize: '14px' }}>Add GPS coordinates to your vehicles to see them on the map</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Location Player Modal */}
      {locationPlayerOpen && locationPlayerVehicle && (
        <LocationPlayer 
          vehicle={locationPlayerVehicle} 
          onClose={closeLocationPlayer}
        />
      )}
    </div>
  );
};

export default MyFleet;

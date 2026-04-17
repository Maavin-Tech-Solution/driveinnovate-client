// Haversine formula for distance between two lat/lng points in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { toast } from 'react-toastify';
import { getLocationPlayerData, getVehicleReportTrips } from '../../services/vehicle.service';
import { getSettings } from '../../services/settings.service';
import { toISTString, toISTTimeString } from '../../utils/dateFormat';
import SpeedChart from './SpeedChart';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const FitBounds = ({ locations }) => {
  const map = useMap();
  useEffect(() => {
    if (locations?.length > 0) {
      map.fitBounds(locations.map(l => [l.latitude, l.longitude]), { padding: [40, 40] });
    }
  }, [locations, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const MapPan = ({ center }) => {
  const map = useMap();
  useEffect(() => { if (center?.[0] && center?.[1]) map.panTo(center, { animate: true, duration: 0.5 }); }, [center, map]);
  return null;
};

const formatDTL = (d) => {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  const h  = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${dy}T${h}:${mi}`;
};

const fmtDuration = (ms) => {
  if (!ms || ms < 0) return '—';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
};

// ─── Marker icons ─────────────────────────────────────────────────────────────
const makeCurrentIcon = (speed) => {
  const color = speed > 80 ? '#dc2626' : speed > 40 ? '#f59e0b' : speed > 5 ? '#2563eb' : '#64748b';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;background:${color};border-radius:50%;
      border:3px solid #fff;box-shadow:0 0 0 2px ${color}88,0 2px 8px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [16, 16], iconAnchor: [8, 8],
  });
};

const startIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const endIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// ─── LocationPlayer ───────────────────────────────────────────────────────────
const LocationPlayer = ({ vehicle, onClose, initialFrom, initialTo }) => {
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [locations, setLocations]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [totalRecords, setTotalRecords]   = useState(0);
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const [showStats, setShowStats]   = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showDatePop, setShowDatePop] = useState(false);
  const [speedRanges, setSpeedRanges] = useState([
    { min: 0,   max: 10,  color: '#64748b', label: 'Idle'      },
    { min: 10,  max: 40,  color: '#22c55e', label: 'Slow'      },
    { min: 40,  max: 80,  color: '#f59e0b', label: 'Normal'    },
    { min: 80,  max: 120, color: '#ef4444', label: 'Fast'      },
    { min: 120, max: 999, color: '#dc2626', label: 'Overspeed' },
  ]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [tripCount, setTripCount]   = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const timerRef    = useRef(null);
  const autoFetched = useRef(false);
  const popRef      = useRef(null);

  // Load user speed ranges
  useEffect(() => {
    getSettings().then(r => {
      if (r.data?.data?.speedRanges) setSpeedRanges(r.data.data.speedRanges);
    }).catch(() => {});
  }, []);

  // Init date range from props or last 24h
  useEffect(() => {
    if (initialFrom && initialTo) {
      setFromDate(formatDTL(new Date(initialFrom)));
      setToDate(formatDTL(new Date(initialTo)));
      autoFetched.current = true; // will trigger fetch below once state is set
    } else {
      const now  = new Date();
      const prev = new Date(now.getTime() - 24 * 3600 * 1000);
      setFromDate(formatDTL(prev));
      setToDate(formatDTL(now));
      setShowDatePop(true); // no pre-set range — show date picker immediately
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fetch once after dates are set from initialFrom/initialTo
  useEffect(() => {
    if (autoFetched.current && fromDate && toDate) {
      autoFetched.current = false;
      handleFetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  // Close date popover on outside click
  useEffect(() => {
    if (!showDatePop) return;
    const handler = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setShowDatePop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDatePop]);

  const handleFetchData = async () => {
    if (!fromDate || !toDate) { toast.error('Select from and to dates'); return; }
    setLoading(true);
    try {
      const from = new Date(fromDate).toISOString();
      const to   = new Date(toDate).toISOString();
      const res  = await getLocationPlayerData(vehicle.id, from, to);
      const data = res.data || res;
      const list = data.locations || [];

      if (list.length > 0) {
        let dist = 0;
        for (let i = 1; i < list.length; i++) {
          dist += haversineDistance(list[i-1].latitude, list[i-1].longitude, list[i].latitude, list[i].longitude);
        }
        setTotalDistance(dist);
        setLocations(list);
        setTotalRecords(data.totalRecords || list.length);
        setCurrentIndex(0);
        setHoveredIndex(null);
        setIsPlaying(false);
        setShowDatePop(false);
        toast.success(`${list.length} points loaded`);

        // Fetch trip count for badge
        getVehicleReportTrips(vehicle.id, from, to, 1, 0)
          .then(r => setTripCount(r?.data?.total ?? r?.total ?? null))
          .catch(() => setTripCount(null));
      } else {
        setLocations([]); setTotalDistance(0); setTotalRecords(0); setTripCount(null);
        toast.info('No location data for this period');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load location data');
      setLocations([]); setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  // Playback timer
  useEffect(() => {
    if (isPlaying && locations.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= locations.length - 1) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, locations, playbackSpeed]);

  const togglePlay = () => {
    if (currentIndex >= locations.length - 1) setCurrentIndex(0);
    setIsPlaying(p => !p);
  };
  const resetPlay = () => { setCurrentIndex(0); setIsPlaying(false); };
  const step = (delta) => { setIsPlaying(false); setCurrentIndex(i => Math.max(0, Math.min(locations.length - 1, i + delta))); };

  const getSpeedColor = (speed) => {
    const r = speedRanges.find(r => speed >= r.min && speed < r.max);
    return r ? r.color : '#3b82f6';
  };

  // Path segments colored by speed
  const pathSegments = (() => {
    const segs = [];
    const src = (isPlaying || currentIndex > 0) ? locations.slice(0, currentIndex + 1) : locations;
    for (let i = 0; i < src.length - 1; i++) {
      segs.push({
        positions: [[src[i].latitude, src[i].longitude], [src[i+1].latitude, src[i+1].longitude]],
        color: getSpeedColor(src[i].speed || 0),
        key: `s${i}`,
      });
    }
    return segs;
  })();

  const activeIdx     = hoveredIndex ?? currentIndex;
  const currentLoc    = locations[activeIdx];
  const mapCenter     = currentLoc ? [currentLoc.latitude, currentLoc.longitude] : [22.9734, 78.6569];
  const currentSpeed  = currentLoc?.speed || 0;
  const durationMs    = locations.length > 1
    ? new Date(locations[locations.length - 1].timestamp) - new Date(locations[0].timestamp)
    : 0;
  const avgSpeed = locations.length > 0
    ? (locations.reduce((s, l) => s + (l.speed || 0), 0) / locations.length).toFixed(1)
    : 0;
  const maxSpeed = locations.length > 0
    ? Math.max(...locations.map(l => l.speed || 0))
    : 0;

  const modalStyle = {
    position: 'fixed',
    inset: isFullscreen ? 0 : undefined,
    top:    isFullscreen ? 0 : '50%',
    left:   isFullscreen ? 0 : '50%',
    transform: isFullscreen ? 'none' : 'translate(-50%,-50%)',
    width:  isFullscreen ? '100vw' : '95vw',
    maxWidth: isFullscreen ? 'none' : '1300px',
    height: isFullscreen ? '100dvh' : '90dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    borderRadius: isFullscreen ? 0 : 14,
    boxShadow: isFullscreen ? 'none' : '0 24px 80px rgba(0,0,0,0.45)',
    zIndex: 9999,
    overflow: 'hidden',
    fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9998, backdropFilter: 'blur(2px)' }}
      />

      <div style={modalStyle}>
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0, height: 52, display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 10,
          background: 'linear-gradient(135deg,#1e40af 0%,#4f46e5 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{ fontSize: 18 }}>🎬</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {vehicle.vehicleName || vehicle.vehicleNumber || `Vehicle #${vehicle.id}`}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
              {vehicle.imei ? `IMEI: ${vehicle.imei}` : vehicle.deviceType || 'Location Player'}
            </div>
          </div>

          {/* Date range pill — click to open picker */}
          <div ref={popRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDatePop(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 11px',
                background: showDatePop ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              📅 {fromDate ? fromDate.slice(0, 10) : '—'} → {toDate ? toDate.slice(0, 10) : '—'}
            </button>

            {/* Date picker popover */}
            {showDatePop && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                border: '1px solid #e2e8f0', padding: 14, width: 360, zIndex: 10,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Range</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>FROM</label>
                    <input type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)}
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>TO</label>
                    <input type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)}
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowDatePop(false)}
                    style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 7, background: '#f9fafb', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleFetchData} disabled={loading}
                    style={{ padding: '6px 16px', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                    {loading ? 'Loading…' : 'Fetch Data'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen toggle */}
          <button onClick={() => setIsFullscreen(p => !p)}
            style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: 15, display: 'flex' }}>
            {isFullscreen ? '⤓' : '⛶'}
          </button>

          {/* Close */}
          <button onClick={onClose}
            style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>

        {/* ── MAP ─────────────────────────────────────────────────────────── */}
        {/* CRITICAL: flex:1 1 0 + minHeight:0 so it shrinks and yields space to chart/controls */}
        <div style={{ flex: '1 1 0', minHeight: 0, position: 'relative', background: '#f1f5f9' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2000, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'lp-spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Loading location data…</span>
            </div>
          )}

          {locations.length === 0 && !loading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 52 }}>🗺️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>No Location Data</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Click the date range above to select a time period.</div>
              <button onClick={() => setShowDatePop(true)}
                style={{ padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
                📅 Pick Date Range
              </button>
            </div>
          ) : (
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} key="lp-map">
              <TileLayer
                url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                attribution='&copy; Google Maps'
                subdomains="0123"
                maxZoom={20}
              />
              <FitBounds locations={locations} />
              <MapPan center={isPlaying ? mapCenter : null} />

              {pathSegments.map(seg => (
                <Polyline key={seg.key} positions={seg.positions} color={seg.color} weight={4} opacity={0.85} />
              ))}

              {locations.length > 0 && (
                <Marker position={[locations[0].latitude, locations[0].longitude]} icon={startIcon}>
                  <Popup><b>Start</b><br />{toISTString(locations[0].timestamp)}</Popup>
                </Marker>
              )}
              {locations.length > 1 && (
                <Marker position={[locations[locations.length-1].latitude, locations[locations.length-1].longitude]} icon={endIcon}>
                  <Popup><b>End</b><br />{toISTString(locations[locations.length-1].timestamp)}</Popup>
                </Marker>
              )}
              {currentLoc && (
                <Marker position={[currentLoc.latitude, currentLoc.longitude]} icon={makeCurrentIcon(currentSpeed)}>
                  <Popup>
                    <b>Current</b><br />
                    {toISTTimeString(currentLoc.timestamp)}<br />
                    Speed: {currentSpeed} km/h
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          )}

          {/* Stats overlay (top-right) */}
          {currentLoc && locations.length > 0 && (
            <div style={{
              position: 'absolute', top: 10, right: 10, zIndex: 1000,
              background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(6px)',
              borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid #e2e8f0', overflow: 'hidden',
              transition: 'width 0.2s',
              width: showStats ? 220 : 36,
            }}>
              <button onClick={() => setShowStats(p => !p)}
                style={{ position: 'absolute', top: 7, right: 7, width: 22, height: 22, background: '#2563eb', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                {showStats ? '−' : '＋'}
              </button>
              {showStats && (
                <div style={{ padding: '10px 13px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Position</div>
                  <StRow label="Time"    value={toISTTimeString(currentLoc.timestamp)} />
                  <StRow label="Speed"   value={`${currentSpeed} km/h`} accent={currentSpeed > 80 ? '#dc2626' : currentSpeed > 5 ? '#2563eb' : '#64748b'} />
                  <StRow label="Sat"     value={currentLoc.satellites || '—'} />
                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 8, paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trip Summary</div>
                    <StRow label="Points"   value={`${totalRecords}`} />
                    <StRow label="Distance" value={`${totalDistance.toFixed(1)} km`} />
                    <StRow label="Duration" value={fmtDuration(durationMs)} />
                    <StRow label="Avg Spd"  value={`${avgSpeed} km/h`} />
                    <StRow label="Max Spd"  value={`${maxSpeed} km/h`} accent={maxSpeed > 80 ? '#dc2626' : undefined} />
                    {tripCount !== null && <StRow label="Trips" value={String(tripCount)} accent="#2563eb" />}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legend overlay (bottom-left) */}
          <div style={{
            position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
            background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(6px)',
            borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            border: '1px solid #e2e8f0', overflow: 'hidden',
            transition: 'width 0.2s',
            width: showLegend ? 180 : 36,
          }}>
            <button onClick={() => setShowLegend(p => !p)}
              style={{ position: 'absolute', top: 7, right: 7, width: 22, height: 22, background: '#2563eb', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              {showLegend ? '−' : '🎨'}
            </button>
            {showLegend && (
              <div style={{ padding: '10px 13px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Speed Key</div>
                {speedRanges.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 20, height: 4, background: r.color, borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', flex: 1 }}>{r.label}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{r.min}–{r.max}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── SPEED CHART ─────────────────────────────────────────────────── */}
        {/* flexShrink:0 ensures this is always the SAME height regardless of map size */}
        {locations.length > 1 && (
          <div style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', background: '#fff', minHeight: 0 }}>
            <SpeedChart
              locations={locations}
              currentIndex={currentIndex}
              onHover={setHoveredIndex}
              onLeave={() => setHoveredIndex(null)}
              dark={false}
            />
          </div>
        )}

        {/* ── CONTROLS ────────────────────────────────────────────────────── */}
        {locations.length > 0 && (
          <div style={{
            flexShrink: 0,
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '8px 16px 10px',
          }}>
            {/* Progress info row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                {currentIndex + 1} / {locations.length}
              </span>
              {currentLoc && (
                <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>
                  {toISTString(currentLoc.timestamp)}
                </span>
              )}
              <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 700 }}>
                {totalDistance.toFixed(2)} km
              </span>
              {tripCount !== null && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                  background: tripCount === 0 ? '#f1f5f9' : '#eff6ff',
                  color: tripCount === 0 ? '#94a3b8' : '#2563eb',
                  border: `1px solid ${tripCount === 0 ? '#e2e8f0' : '#bfdbfe'}`,
                }}>
                  {tripCount === 0 ? 'No trips' : `${tripCount} trip${tripCount > 1 ? 's' : ''}`}
                </span>
              )}
              <div style={{ flex: 1 }} />
              {/* Speed x selector */}
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#64748b', marginRight: 3 }}>Speed:</span>
                {[1, 2, 4, 8].map(s => (
                  <button key={s} onClick={() => setPlaybackSpeed(s)}
                    style={{
                      padding: '3px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: playbackSpeed === s ? '#2563eb' : '#fff',
                      color: playbackSpeed === s ? '#fff' : '#374151',
                      border: `1px solid ${playbackSpeed === s ? '#2563eb' : '#d1d5db'}`,
                    }}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            {/* Slider */}
            <input
              type="range" min={0} max={locations.length - 1} value={currentIndex}
              onChange={e => { setIsPlaying(false); setCurrentIndex(Number(e.target.value)); }}
              style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer', marginBottom: 5 }}
            />

            {/* Playback buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
              <button onClick={resetPlay}
                style={ctrlBtn('#f1f5f9', '#374151')}>⏮</button>
              <button onClick={() => step(-10)}
                style={ctrlBtn('#f1f5f9', '#374151')}>−10</button>
              <button onClick={togglePlay}
                style={{ ...ctrlBtn('#2563eb', '#fff'), padding: '8px 24px', fontSize: 15, fontWeight: 700 }}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button onClick={() => step(10)}
                style={ctrlBtn('#f1f5f9', '#374151')}>+10</button>
              <button onClick={() => setCurrentIndex(locations.length - 1)}
                style={ctrlBtn('#f1f5f9', '#374151')}>⏭</button>
            </div>
          </div>
        )}
      </div>

      {/* Spin animation */}
      <style>{`@keyframes lp-spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
};

// Small helpers
const StRow = ({ label, value, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
    <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
    <span style={{ fontSize: 11, fontWeight: 700, color: accent || '#1e293b' }}>{value}</span>
  </div>
);

const ctrlBtn = (bg, color) => ({
  padding: '7px 12px', background: bg, color,
  border: `1px solid ${bg === '#f1f5f9' ? '#d1d5db' : bg}`,
  borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
});

export default LocationPlayer;

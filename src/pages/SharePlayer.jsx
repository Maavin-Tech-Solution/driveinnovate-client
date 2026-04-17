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
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { getShareData } from '../services/share.service';
import { toISTString } from '../utils/dateFormat';
import SpeedChart from '../components/common/SpeedChart';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const VEHICLE_ICON_MAP = { car:'🚗',suv:'🚙',truck:'🚛',bus:'🚌',bike:'🏍️',auto:'🛺',van:'🚐',ambulance:'🚑',pickup:'🛻',minibus:'🚌',schoolbus:'🚍',tractor:'🚜',crane:'🏗️',jcb:'🏗️',dumper:'🚚',earthmover:'🚜',tanker:'⛽',container:'🚛',fire:'🚒',police:'🚔',sweeper:'🚛',tipper:'🚚' };

const SPEED_RANGES = [
  { min: 0, max: 10, color: '#22c55e', label: 'Idle' },
  { min: 10, max: 40, color: '#3b82f6', label: 'Slow' },
  { min: 40, max: 80, color: '#f59e0b', label: 'Normal' },
  { min: 80, max: 120, color: '#ef4444', label: 'Fast' },
  { min: 120, max: 999, color: '#dc2626', label: 'Overspeed' },
];

const getColorForSpeed = (speed) => {
  const range = SPEED_RANGES.find(r => speed >= r.min && speed < r.max);
  return range ? range.color : '#3b82f6';
};

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const FitBounds = ({ locations }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (locations && locations.length > 0 && !fitted.current) {
      fitted.current = true;
      const bounds = locations.map(loc => [loc.latitude, loc.longitude]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);
  return null;
};

const SharePlayer = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [locations, setLocations] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [totalDistance, setTotalDistance] = useState(0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showStats, setShowStats] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const playbackTimerRef = useRef(null);

  // Fetch share data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getShareData(token);
        const d = res.data || res;
        setVehicle(d.vehicle);
        setFrom(d.from);
        setTo(d.to);
        const locs = d.locations || [];
        let dist = 0;
        for (let i = 1; i < locs.length; i++) {
          dist += haversineDistance(locs[i-1].latitude, locs[i-1].longitude, locs[i].latitude, locs[i].longitude);
        }
        setTotalDistance(dist);
        setLocations(locs);
      } catch (e) {
        setError(e.message || 'Failed to load shared trip');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  // Playback
  useEffect(() => {
    if (isPlaying && locations.length > 0) {
      playbackTimerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= locations.length - 1) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      clearInterval(playbackTimerRef.current);
    }
    return () => clearInterval(playbackTimerRef.current);
  }, [isPlaying, locations, playbackSpeed]);

  const togglePlay = () => {
    if (currentIndex >= locations.length - 1) setCurrentIndex(0);
    setIsPlaying(p => !p);
  };

  const activeIndex = hoveredIndex ?? currentIndex;
  const currentLocation = locations[activeIndex];
  const mapCenter = currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : [22.9734, 78.6569];

  const displayLocations = isPlaying || currentIndex > 0
    ? locations.slice(0, currentIndex + 1)
    : locations;

  const pathSegments = [];
  for (let i = 0; i < displayLocations.length - 1; i++) {
    pathSegments.push({
      positions: [[displayLocations[i].latitude, displayLocations[i].longitude], [displayLocations[i+1].latitude, displayLocations[i+1].longitude]],
      color: getColorForSpeed(displayLocations[i].speed || 0),
      key: `seg-${i}`,
    });
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 15, color: '#64748b', fontFamily: 'sans-serif' }}>Loading shared trip…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>🔗</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontFamily: 'sans-serif' }}>Link Not Found</div>
        <div style={{ fontSize: 14, color: '#64748b', fontFamily: 'sans-serif' }}>{error}</div>
        <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'sans-serif', marginTop: 8 }}>This link may have expired or is invalid.</div>
      </div>
    );
  }

  const vehicleEmoji = VEHICLE_ICON_MAP[vehicle?.vehicleIcon] || '🚗';
  const vehicleLabel = vehicle?.vehicleName || vehicle?.vehicleNumber || 'Vehicle';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#0f172a' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: 28 }}>{vehicleEmoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
            {vehicleLabel}
            {vehicle?.vehicleName && vehicle?.vehicleNumber && (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginLeft: 10, fontFamily: 'monospace' }}>
                {vehicle.vehicleNumber}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
            🎬 Shared Trip &nbsp;•&nbsp; {fmtDate(from)} → {fmtDate(to)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Points</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{locations.length.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Distance</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{totalDistance.toFixed(1)} km</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 6 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Powered by</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>DriveInnovate</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {locations.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: '#94a3b8', background: '#f8fafc' }}>
            <div style={{ fontSize: 48 }}>📍</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No location data available</div>
          </div>
        ) : (
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              attribution='&copy; Google Maps'
              subdomains="0123"
              maxZoom={20}
            />
            <FitBounds locations={locations} />
            <MapUpdater center={mapCenter} />

            {pathSegments.map(seg => (
              <Polyline key={seg.key} positions={seg.positions} color={seg.color} weight={4} opacity={0.85} />
            ))}

            {/* Start marker */}
            <Marker position={[locations[0].latitude, locations[0].longitude]}
              icon={L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] })}>
              <Popup><strong>Start</strong><br />{toISTString(locations[0].timestamp)}</Popup>
            </Marker>

            {/* End marker */}
            {locations.length > 1 && (
              <Marker position={[locations[locations.length-1].latitude, locations[locations.length-1].longitude]}
                icon={L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] })}>
                <Popup><strong>End</strong><br />{toISTString(locations[locations.length-1].timestamp)}</Popup>
              </Marker>
            )}

            {/* Current position marker */}
            {currentLocation && (
              <Marker position={[currentLocation.latitude, currentLocation.longitude]}>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{vehicleLabel}</strong>
                    <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                      <div><strong>Time:</strong> {toISTString(currentLocation.timestamp)}</div>
                      <div><strong>Speed:</strong> {currentLocation.speed || 0} km/h</div>
                      <div><strong>Satellites:</strong> {currentLocation.satellites || 'N/A'}</div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        )}

        {/* Stats panel */}
        {currentLocation && locations.length > 0 && (
          <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.97)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000, fontSize: 12, maxWidth: showStats ? 240 : 44, overflow: 'hidden', transition: 'max-width 0.3s ease' }}>
            <button onClick={() => setShowStats(p => !p)} style={{ position: 'absolute', top: 10, right: 10, background: '#2563eb', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              {showStats ? '✕' : 'ℹ'}
            </button>
            {showStats && (
              <div style={{ padding: '12px 14px', paddingRight: 40 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10 }}>Live Stats</div>
                {[
                  { label: 'Speed', value: `${currentLocation.speed || 0} km/h`, color: getColorForSpeed(currentLocation.speed || 0) },
                  { label: 'Progress', value: `${currentIndex + 1} / ${locations.length}` },
                  { label: 'Time', value: toISTString(currentLocation.timestamp)?.split(' ')[1] || '' },
                  { label: 'Lat', value: currentLocation.latitude?.toFixed(5) },
                  { label: 'Lng', value: currentLocation.longitude?.toFixed(5) },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: s.color || '#0f172a', fontFamily: 'monospace' }}>{s.value}</span>
                  </div>
                ))}
                {/* Speed legend */}
                <div style={{ marginTop: 10, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  {SPEED_RANGES.map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                      <span style={{ color: '#64748b', fontSize: 11 }}>{r.label} ({r.min}–{r.max === 999 ? '∞' : r.max} km/h)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Playback controls */}
        {locations.length > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(6px)', zIndex: 1000, padding: '12px 20px' }}>
            {/* Slider */}
            <input
              type="range"
              min={0}
              max={locations.length - 1}
              value={currentIndex}
              onChange={e => { setCurrentIndex(parseInt(e.target.value, 10)); setIsPlaying(false); }}
              style={{ width: '100%', marginBottom: 10, accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Play/Pause */}
              <button onClick={togglePlay} style={{ width: 40, height: 40, borderRadius: '50%', background: isPlaying ? '#ef4444' : '#22c55e', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              {/* Reset */}
              <button onClick={() => { setCurrentIndex(0); setIsPlaying(false); }} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ⟳
              </button>
              {/* Speed selector */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 4, 8].map(s => (
                  <button key={s} onClick={() => setPlaybackSpeed(s)}
                    style={{ padding: '4px 10px', borderRadius: 4, background: playbackSpeed === s ? '#2563eb' : 'rgba(255,255,255,0.1)', border: `1px solid ${playbackSpeed === s ? '#2563eb' : 'rgba(255,255,255,0.2)'}`, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {s}×
                  </button>
                ))}
              </div>
              {/* Position info */}
              <div style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                {currentLocation && toISTString(currentLocation.timestamp)}
              </div>
              {/* Speed badge */}
              {currentLocation && (
                <div style={{ background: getColorForSpeed(currentLocation.speed || 0), padding: '4px 12px', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {currentLocation.speed || 0} km/h
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Speed vs Time chart (dark, below map) */}
      {locations.length > 1 && (
        <SpeedChart
          locations={locations}
          currentIndex={currentIndex}
          onHover={setHoveredIndex}
          onLeave={() => setHoveredIndex(null)}
          dark={true}
        />
      )}
    </div>
  );
};

export default SharePlayer;

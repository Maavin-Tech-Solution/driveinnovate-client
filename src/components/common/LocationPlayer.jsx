// Haversine formula for distance between two lat/lng points in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { toast } from 'react-toastify';
import { getLocationPlayerData } from '../../services/vehicle.service';
import { getSettings } from '../../services/settings.service';
import { toISTString, toISTTimeString } from '../../utils/dateFormat';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to update map center when location changes
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

// Component to fit bounds when locations are first loaded
const FitBounds = ({ locations }) => {
  const map = useMap();
  useEffect(() => {
    if (locations && locations.length > 0) {
      const bounds = locations.map(loc => [loc.latitude, loc.longitude]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);
  return null;
};

const LocationPlayer = ({ vehicle, onClose }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
  const [totalRecords, setTotalRecords] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(true);
  const [speedRanges, setSpeedRanges] = useState([
    { min: 0, max: 10, color: '#22c55e', label: 'Idle' },
    { min: 10, max: 40, color: '#3b82f6', label: 'Slow' },
    { min: 40, max: 80, color: '#f59e0b', label: 'Normal' },
    { min: 80, max: 120, color: '#ef4444', label: 'Fast' },
    { min: 120, max: 999, color: '#dc2626', label: 'Overspeed' },
  ]);
  const [showLegend, setShowLegend] = useState(true);
  const [totalDistance, setTotalDistance] = useState(0);
  const playbackTimerRef = useRef(null);

  // Fetch user settings for speed ranges
  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        const res = await getSettings();
        if (res.data.success && res.data.data.speedRanges) {
          setSpeedRanges(res.data.data.speedRanges);
        }
      } catch (error) {
        console.warn('Failed to load user settings, using defaults');
      }
    };
    fetchUserSettings();
  }, []);

  // Set default date range (last 24 hours)
  useEffect(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    setToDate(formatDateTimeLocal(now));
    setFromDate(formatDateTimeLocal(yesterday));
  }, []);

  // Debug: Monitor locations state changes
  useEffect(() => {
    console.log('🔄 Locations state changed:', {
      count: locations.length,
      firstLocation: locations[0],
      lastLocation: locations[locations.length - 1]
    });
  }, [locations]);

  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleFetchData = async () => {
    if (!fromDate || !toDate) {
      toast.error('Please select both from and to dates');
      return;
    }

    setLoading(true);
    try {
      const fromISO = new Date(fromDate).toISOString();
      const toISO = new Date(toDate).toISOString();
      
      const response = await getLocationPlayerData(vehicle.id, fromISO, toISO);
      console.log('=== LOCATION PLAYER DEBUG ===');
      console.log('1. Raw API Response:', response);
      console.log('2. response.data:', response.data);
      console.log('3. response.success:', response.success);
      
      // After axios interceptor extracts response.data:
      // response = {success: true, data: {vehicle, locations, totalRecords}}
      // So response.data = {vehicle, locations, totalRecords}
      const actualData = response.data || response;
      console.log('4. actualData:', actualData);
      
      const locationsList = actualData.locations || [];
      console.log('5. locationsList:', locationsList);
      console.log('6. locationsList.length:', locationsList.length);
      console.log('7. locationsList[0]:', locationsList[0]);
      
      if (locationsList.length > 0) {
        // Calculate total distance
        let dist = 0;
        for (let i = 1; i < locationsList.length; i++) {
          dist += haversineDistance(
            locationsList[i - 1].latitude,
            locationsList[i - 1].longitude,
            locationsList[i].latitude,
            locationsList[i].longitude
          );
        }
        setTotalDistance(dist);
        setLocations(locationsList);
        setTotalRecords(actualData.totalRecords || locationsList.length);
        setCurrentIndex(0);
        setShowDatePicker(false); // Auto-hide date picker after loading
        toast.success(`Loaded ${locationsList.length} location points`);
      } else {
        setTotalDistance(0);
        setLocations([]);
        setTotalRecords(0);
      }
      console.log('=== END DEBUG ===');
    } catch (error) {
      console.error('Location Player Error:', error);
      toast.error(error.message || 'Failed to fetch location data');
      setLocations([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  // Playback controls
  useEffect(() => {
    if (isPlaying && locations.length > 0) {
      const interval = 1000 / playbackSpeed; // Speed up playback
      playbackTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= locations.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, locations, playbackSpeed]);

  const togglePlayPause = () => {
    if (currentIndex >= locations.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e) => {
    const index = parseInt(e.target.value, 10);
    setCurrentIndex(index);
    setIsPlaying(false);
  };

  const resetPlayback = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  // Helper to get color based on speed
  const getColorForSpeed = (speed) => {
    const range = speedRanges.find(r => speed >= r.min && speed < r.max);
    return range ? range.color : '#3b82f6'; // Default blue
  };

  // Create colored path segments
  const createColoredSegments = () => {
    const segments = [];
    const displayLocations = isPlaying || currentIndex > 0 
      ? locations.slice(0, currentIndex + 1)
      : locations;

    for (let i = 0; i < displayLocations.length - 1; i++) {
      const loc1 = displayLocations[i];
      const loc2 = displayLocations[i + 1];
      const speed = loc1.speed || 0;
      const color = getColorForSpeed(speed);

      segments.push({
        positions: [[loc1.latitude, loc1.longitude], [loc2.latitude, loc2.longitude]],
        color,
        speed,
        key: `segment-${i}`
      });
    }

    return segments;
  };

  // Get current location and path
  const currentLocation = locations[currentIndex];
  // Show full path initially, then progressive path during playback
  const pathCoordinates = isPlaying || currentIndex > 0 
    ? locations.slice(0, currentIndex + 1).map(loc => [loc.latitude, loc.longitude])
    : locations.map(loc => [loc.latitude, loc.longitude]);
  const pathSegments = createColoredSegments();
  const mapCenter = currentLocation ? [currentLocation.latitude, currentLocation.longitude] : [22.9734, 78.6569];

  console.log('🎨 RENDER - Component state:', {
    locationsCount: locations.length,
    currentIndex,
    hasCurrentLocation: !!currentLocation,
    mapCenter,
    shouldShowMap: locations.length > 0,
    pathCoordinatesLength: pathCoordinates.length,
    controlsVisible: locations.length > 0
  });

  return (
    <>
      {/* Overlay */}
      <div 
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000 }} 
        onClick={onClose} 
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', 
        top: isFullscreen ? 0 : '50%', 
        left: isFullscreen ? 0 : '50%', 
        transform: isFullscreen ? 'none' : 'translate(-50%, -50%)',
        background: '#fff', 
        borderRadius: isFullscreen ? 0 : '12px', 
        boxShadow: isFullscreen ? 'none' : '0 20px 60px rgba(0,0,0,0.4)',
        zIndex: 2001, 
        width: isFullscreen ? '100vw' : '95%', 
        maxWidth: isFullscreen ? 'none' : '1200px', 
        height: isFullscreen ? '100vh' : '90vh', 
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid #e2e8f0', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '20px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🎬</span> Location Player
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
              {vehicle.vehicleNumber || `Vehicle #${vehicle.id}`} {vehicle.imei && `• IMEI: ${vehicle.imei}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              style={{ 
                background: 'rgba(255,255,255,0.2)', 
                border: 'none', 
                color: '#fff', 
                fontSize: '20px', 
                cursor: 'pointer', 
                lineHeight: 1,
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? '⤓' : '⛶'}
            </button>
            <button 
              onClick={onClose} 
              style={{ 
                background: 'rgba(255,255,255,0.2)', 
                border: 'none', 
                color: '#fff', 
                fontSize: '24px', 
                cursor: 'pointer', 
                lineHeight: 1,
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Date Range Selector - Collapsible */}
        {showDatePicker && (
          <div style={{ 
            padding: '16px 24px', 
            background: '#f8fafc', 
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                From Date & Time
              </label>
              <input 
                type="datetime-local" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 10px', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '6px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                To Date & Time
              </label>
              <input 
                type="datetime-local" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 10px', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '6px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
            <button 
              onClick={handleFetchData}
              disabled={loading}
              style={{ 
                padding: '8px 20px', 
                background: loading ? '#94a3b8' : '#2563eb', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                transition: 'background 0.2s',
                minWidth: '100px'
              }}
            >
              {loading ? 'Loading...' : 'Fetch Data'}
            </button>
          </div>
        )}

        {/* Date Picker Toggle Button (when hidden) */}
        {!showDatePicker && locations.length > 0 && (
          <div style={{
            padding: '8px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setShowDatePicker(true)}
              style={{
                padding: '6px 16px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#64748b',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📅 Change Date Range
            </button>
          </div>
        )}

        {/* Map Container */}
        {locations.length > 0 ? (
          <div style={{ flex: '1 1 0', position: 'relative', minHeight: '300px', maxHeight: '100%', overflow: 'hidden' }}>
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
              key="location-player-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Fit bounds to show all points initially */}
              <FitBounds locations={locations} />
              
              {/* Update map center when location changes during playback */}
              <MapUpdater center={mapCenter} />
              
              {/* Draw colored path segments */}
              {pathSegments.map((segment) => (
                <Polyline
                  key={segment.key}
                  positions={segment.positions}
                  color={segment.color}
                  weight={4}
                  opacity={0.8}
                />
              ))}

              {/* Current position marker */}
              {currentLocation && (
                <Marker position={[currentLocation.latitude, currentLocation.longitude]}>
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                        {vehicle.vehicleNumber || `Vehicle #${vehicle.id}`}
                      </strong>
                      <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                        <div><strong>Time:</strong> {toISTString(currentLocation.timestamp)}</div>
                        <div><strong>Speed:</strong> {currentLocation.speed || 0} km/h</div>
                        <div><strong>Satellites:</strong> {currentLocation.satellites || 'N/A'}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Start marker */}
              {locations.length > 0 && (
                <Marker 
                  position={[locations[0].latitude, locations[0].longitude]}
                  icon={L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                  })}
                >
                  <Popup>
                    <strong>Start Point</strong><br/>
                    {toISTString(locations[0].timestamp)}
                  </Popup>
                </Marker>
              )}

              {/* End marker */}
              {locations.length > 1 && (
                <Marker 
                  position={[locations[locations.length - 1].latitude, locations[locations.length - 1].longitude]}
                  icon={L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                  })}
                >
                  <Popup>
                    <strong>End Point</strong><br/>
                    {toISTString(locations[locations.length - 1].timestamp)}
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            {/* Stats & Info Panel Overlay */}
            {currentLocation && (
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.97)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
                fontSize: '12px',
                maxWidth: showStats ? '280px' : '44px',
                transition: 'max-width 0.3s ease',
                overflow: 'hidden'
              }}>
                {/* Toggle Button */}
                <button
                  onClick={() => setShowStats(!showStats)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: '#2563eb',
                    border: 'none',
                    color: '#fff',
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                  title={showStats ? 'Hide Stats' : 'Show Stats'}
                >
                  {showStats ? '−' : '+'}
                </button>

                {showStats && (
                  <div style={{ padding: '12px 16px' }}>
                    {/* Current Position */}
                    <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '13px', color: '#1e3a5f' }}>
                        Current Position
                      </div>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <div><strong>Time:</strong> {toISTTimeString(currentLocation.timestamp)}</div>
                        <div><strong>Speed:</strong> <span style={{ color: currentLocation.speed > 0 ? '#16a34a' : '#64748b', fontWeight: 600 }}>{currentLocation.speed || 0} km/h</span></div>
                        <div><strong>Satellites:</strong> {currentLocation.satellites || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '13px', color: '#1e3a5f' }}>
                        Trip Summary
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Points:</span>
                          <span style={{ fontWeight: 600 }}>{totalRecords}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Duration:</span>
                          <span style={{ fontWeight: 600 }}>
                            {locations.length > 1 ? 
                              `${Math.round((new Date(locations[locations.length - 1].timestamp) - new Date(locations[0].timestamp)) / 1000 / 60)} min` 
                              : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Avg Speed:</span>
                          <span style={{ fontWeight: 600 }}>
                            {(locations.reduce((sum, loc) => sum + (loc.speed || 0), 0) / locations.length).toFixed(1)} km/h
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Max Speed:</span>
                          <span style={{ fontWeight: 600, color: '#16a34a' }}>
                            {Math.max(...locations.map(loc => loc.speed || 0))} km/h
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Speed Color Legend */}
            {speedRanges.length > 0 && (
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                background: 'rgba(255,255,255,0.97)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
                maxWidth: showLegend ? '220px' : '44px',
                transition: 'max-width 0.3s ease',
                overflow: 'hidden'
              }}>
                {/* Toggle Button */}
                <button
                  onClick={() => setShowLegend(!showLegend)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: '#2563eb',
                    border: 'none',
                    color: '#fff',
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                  title={showLegend ? 'Hide Legend' : 'Show Legend'}
                >
                  {showLegend ? '−' : '🎨'}
                </button>

                {showLegend && (
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '13px', color: '#1e3a5f' }}>
                      Speed Ranges
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {speedRanges.map((range, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px'
                          }}
                        >
                          <div
                            style={{
                              width: '20px',
                              height: '4px',
                              background: range.color,
                              borderRadius: '2px',
                              flexShrink: 0
                            }}
                          />
                          <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '11px' }}>
                            {range.label}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '10px', marginLeft: 'auto' }}>
                            {range.min}-{range.max} km/h
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : !loading ? (
          /* Empty State */
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '60px',
            background: '#f8fafc'
          }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🗺️</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#1e3a5f', marginBottom: '8px' }}>
                No Location Data
              </div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>
                Select a date range and click "Fetch Data" to load vehicle location history
              </div>
            </div>
          </div>
        ) : null}

        {/* Video Controls */}
        {locations.length > 0 && (
          <div style={{ 
            padding: '12px 24px', 
            borderTop: '1px solid #e2e8f0', 
            background: '#fff',
            flexShrink: 0,
            overflowY: 'auto'
          }}>
            {/* Distance Covered */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8,
              fontSize: 14,
              color: '#2563eb',
              fontWeight: 600,
            }}>
              <span>Distance Covered:</span>
              <span>{totalDistance.toFixed(2)} km</span>
            </div>
            {/* ...existing code... */}
            {/* Timeline info */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '8px',
              fontSize: '11px',
              color: '#64748b'
            }}>
              <span>
                Point {currentIndex + 1} of {locations.length}
              </span>
              <span>
                {currentLocation && toISTString(currentLocation.timestamp)}
              </span>
            </div>

            {/* Timeline Slider */}
            <input 
              type="range" 
              min="0" 
              max={locations.length - 1} 
              value={currentIndex}
              onChange={handleSliderChange}
              style={{ 
                width: '100%', 
                marginBottom: '12px',
                accentColor: '#2563eb',
                cursor: 'pointer'
              }}
            />

            {/* Control Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <button 
                onClick={resetPlayback}
                style={{
                  padding: '10px 16px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'all 0.2s'
                }}
                title="Reset to start"
              >
                ⏮️
              </button>

              <button 
                onClick={togglePlayPause}
                disabled={currentIndex >= locations.length - 1 && !isPlaying}
                style={{
                  padding: '12px 32px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  opacity: (currentIndex >= locations.length - 1 && !isPlaying) ? 0.5 : 1
                }}
              >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>

              {/* Speed Control */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b', marginRight: '4px' }}>Speed:</span>
                {[1, 2, 4, 8].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    style={{
                      padding: '8px 12px',
                      background: playbackSpeed === speed ? '#2563eb' : '#f1f5f9',
                      color: playbackSpeed === speed ? '#fff' : '#334155',
                      border: '1px solid',
                      borderColor: playbackSpeed === speed ? '#2563eb' : '#cbd5e1',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LocationPlayer;

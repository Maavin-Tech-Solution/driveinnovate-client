/**
 * LiveShareView — public page for viewing a live-tracking share link.
 * Route: /live/:token   (no auth required)
 *
 * Polls GET /api/share/live/:token every 5 seconds to get current positions.
 * Works for both single-vehicle and vehicle-group shares.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLiveShareData } from '../services/share.service';

const VEHICLE_ICON_MAP = {
  car: '🚗', suv: '🚙', truck: '🚛', bus: '🚌', bike: '🏍️', auto: '🛺',
  van: '🚐', ambulance: '🚑', pickup: '🛻', motorcycle: '🏍️', minibus: '🚌',
  schoolbus: '🚍', tractor: '🚜', crane: '🏗️', jcb: '🏗️',
  dumper: '🚚', earthmover: '🚜', tanker: '⛽', container: '🚛',
  fire: '🚒', police: '🚔', sweeper: '🚛', tipper: '🚚',
};

const INDIA_CENTER = [22.9734, 78.6569];

const makeIcon = (pos) => {
  const running = pos.engineOn;
  const bg = running ? '#16a34a' : '#dc2626';
  const emoji = VEHICLE_ICON_MAP[pos.vehicleIcon] || '🚗';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:40px;height:40px;background:${bg};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3);">${emoji}</div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${bg};margin-top:-1px;"></div>
    </div>`,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
  });
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const fmtExpiry = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
};

export default function LiveShareView() {
  const { token } = useParams();
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState(null);
  const [lastPoll, setLastPoll] = useState(null);
  const mapRef = useRef(null);
  const fittedRef = useRef(false);

  const fetchData = async () => {
    try {
      const r = await getLiveShareData(token);
      setShareData(r.data);
      setError(null);
      setLastPoll(new Date());
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to load share data');
    }
  };

  // Initial fetch + 5-second poll
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit map bounds to all vehicle positions on first data load
  useEffect(() => {
    if (!shareData || fittedRef.current) return;
    const positions = (shareData.positions || []).filter(p => p.lat && p.lng);
    if (!positions.length || !mapRef.current) return;
    fittedRef.current = true;
    if (positions.length === 1) {
      mapRef.current.setView([positions[0].lat, positions[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [shareData]);

  // ── Error / Expired state ───────────────────────────────────────────────────
  if (error) {
    const expired = error.toLowerCase().includes('expir');
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif", background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 20px' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>{expired ? '⏰' : '🔗'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>{expired ? 'Link Expired' : 'Link Not Found'}</div>
          <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>{error}</div>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!shareData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif", background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'lsv-spin 0.75s linear infinite', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 14, color: '#64748B', fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif" }}>Loading live tracking…</div>
          <style>{`@keyframes lsv-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const { info, positions, expiresAt } = shareData;
  const mapPositions = (positions || []).filter(p => p.lat && p.lng);
  const runningCount = (positions || []).filter(p => p.engineOn).length;
  const stoppedCount = (positions || []).length - runningCount;

  const isExpired = new Date() > new Date(expiresAt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif", background: '#0F172A' }}>
      <style>{`@keyframes lsv-spin { to { transform: rotate(360deg); } } @keyframes lsv-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }`}</style>

      {/* ── Top bar ── */}
      <div style={{ flexShrink: 0, background: '#0F172A', borderBottom: '1px solid #1E293B', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📍</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', lineHeight: 1.1 }}>Live Tracking</div>
            <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1 }}>Powered by DriveInnovate</div>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: '#1E293B', flexShrink: 0 }} />

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {info.type === 'vehicle'
              ? (info.vehicleName || info.vehicleNumber || 'Vehicle')
              : `${info.groupName || 'Group'} (${positions?.length || 0} vehicles)`}
          </div>
          {info.type === 'vehicle' && info.vehicleName && info.vehicleNumber && (
            <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace' }}>{info.vehicleNumber}</div>
          )}
        </div>

        {/* Stats */}
        {positions?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{runningCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{stoppedCount}</span>
            </div>
          </div>
        )}

        {/* Expiry / live indicator */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: isExpired ? '#7f1d1d' : '#14532d', border: `1px solid ${isExpired ? '#991b1b' : '#166534'}` }}>
          {!isExpired && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'lsv-pulse 2s infinite' }} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: isExpired ? '#fca5a5' : '#86efac' }}>
            {isExpired ? 'Expired' : `Live · ends ${fmtExpiry(expiresAt)}`}
          </span>
        </div>

        {/* Last update */}
        {lastPoll && (
          <div style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>Updated {fmtTime(lastPoll)}</div>
        )}
      </div>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={INDIA_CENTER}
          zoom={5}
          style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
          scrollWheelZoom
          ref={mapRef}
          zoomControl
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={20}
          />

          {mapPositions.map(pos => (
            <Marker key={pos.id} position={[pos.lat, pos.lng]} icon={makeIcon(pos)}>
              <Tooltip direction="top" offset={[0, -48]} permanent={false}>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", minWidth: 160 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', marginBottom: 4 }}>
                    {pos.vehicleName || pos.vehicleNumber || `Vehicle ${pos.id}`}
                  </div>
                  {pos.vehicleName && pos.vehicleNumber && (
                    <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace', marginBottom: 4 }}>{pos.vehicleNumber}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: pos.engineOn ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{pos.engineOn ? '🟢 Running' : '🔴 Stopped'}</span>
                    {pos.speed > 0 && <span style={{ color: '#64748B' }}>🚀 {Math.round(pos.speed)} km/h</span>}
                  </div>
                  {pos.lastPacketTime && (
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Last seen: {fmtTime(pos.lastPacketTime)}</div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>

        {/* Vehicle list overlay (for group shares with multiple vehicles) */}
        {info.type === 'group' && positions?.length > 1 && (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: '40vh', overflowY: 'auto', minWidth: 220 }}>
            <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{info.groupName} · {positions.length} vehicles</div>
            </div>
            {positions.map(pos => (
              <div key={pos.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #F8FAFC' }}>
                <span style={{ fontSize: 16 }}>{VEHICLE_ICON_MAP[pos.vehicleIcon] || '🚗'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.vehicleName || pos.vehicleNumber || `Vehicle ${pos.id}`}</div>
                  {pos.speed > 0 && <div style={{ fontSize: 10, color: '#64748B' }}>{Math.round(pos.speed)} km/h</div>}
                </div>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: pos.engineOn ? '#22c55e' : '#ef4444', flexShrink: 0, boxShadow: pos.engineOn ? '0 0 5px #22c55e' : 'none' }} />
              </div>
            ))}
          </div>
        )}

        {/* No-GPS notice */}
        {mapPositions.length === 0 && (
          <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 18px', fontSize: 13, color: '#64748B', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
            📡 Waiting for GPS data…
          </div>
        )}
      </div>
    </div>
  );
}

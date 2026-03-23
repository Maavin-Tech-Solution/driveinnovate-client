import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  getVehicles, deleteVehicle, updateVehicle, syncVehicleData,
  getVehicleSensors, createVehicleSensor, updateVehicleSensor, deleteVehicleSensor,
  getVehicleReportSummary, getVehicleReportDaily, getVehicleReportEngineHours,
  getVehicleReportTrips, getVehicleReportFuelFillings, exportVehicleReportExcel, reprocessVehicleData,
} from '../services/vehicle.service';
import { getGroups, createGroup, updateGroup, deleteGroup, addVehicleToGroup, removeVehicleFromGroup } from '../services/group.service';
import LocationPlayer from '../components/common/LocationPlayer';
import { getISTToday, getISTDaysAgo } from '../utils/dateFormat';

// ─── Constants ────────────────────────────────────────────────────────────────
const INDIA_CENTER = [22.9734, 78.6569];
const VEHICLE_ICON_MAP = { car: '🚗', suv: '🚙', truck: '🚛', bus: '🚌', bike: '🏍️', auto: '🛺', van: '🚐', ambulance: '🚑' };
const REPORT_PAGE_SIZE = 20;
const GROUP_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const DEVICE_TYPES = ['GT06', 'GT06N', 'FMB125', 'FMB130', 'FMB920', 'FMB140', 'WeTrack2', 'TK103'];
const VEHICLE_ICONS = ['car', 'suv', 'truck', 'bus', 'bike', 'auto', 'van', 'ambulance'];
const SENSOR_TYPES = ['number', 'boolean', 'text'];
const PANEL_W = 280;
const DETAIL_W = 400;
const HUD_H = 52;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  primary: '#3b82f6', primaryDark: '#2563eb', primaryBg: '#eff6ff',
  success: '#16a34a', successBg: '#f0fdf4', successLight: '#22c55e',
  danger: '#dc2626', dangerBg: '#fef2f2', dangerLight: '#ef4444',
  warning: '#d97706', warningBg: '#fffbeb',
  purple: '#7c3aed', purpleBg: '#f5f3ff',
  teal: '#0891b2', tealBg: '#ecfeff',
  text: '#0f172a', textSub: '#374151', textMuted: '#6b7280', textLight: '#9ca3af',
  border: '#e5e7eb', borderLight: '#f3f4f6',
  surface: '#f9fafb', white: '#ffffff',
  // dark HUD palette
  hud: '#07090f', hudL: '#0d1117', hudLL: '#161b27', hudLLL: '#1e2738',
  hudT: '#e2e8f0', hudM: '#64748b', hudA: '#3b82f6',
};

// ─── CSS Animations (injected once) ──────────────────────────────────────────
const HUD_CSS = `
  .fv-run { animation: fv-pulse-g 2s ease-out infinite; }
  .fv-stop { animation: fv-pulse-r 3.5s ease-out infinite; }
  .fv-sel { animation: none !important; box-shadow: 0 0 0 3px #fff, 0 0 0 5px #3b82f6, 0 6px 24px rgba(59,130,246,0.55) !important; transform: scale(1.18) !important; transform-origin: center bottom !important; }
  @keyframes fv-pulse-g {
    0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.75), 0 2px 10px rgba(0,0,0,0.55); }
    65%  { box-shadow: 0 0 0 8px rgba(34,197,94,0), 0 2px 10px rgba(0,0,0,0.55); }
    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0), 0 2px 10px rgba(0,0,0,0.55); }
  }
  @keyframes fv-pulse-r {
    0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.55), 0 2px 10px rgba(0,0,0,0.55); }
    65%  { box-shadow: 0 0 0 5px rgba(239,68,68,0), 0 2px 10px rgba(0,0,0,0.55); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0), 0 2px 10px rgba(0,0,0,0.55); }
  }
  .fv-card:hover { background: rgba(30,39,56,0.98) !important; }
  .fv-tab-btn:hover { background: rgba(59,130,246,0.1) !important; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const getVehicleCoords = (v) => {
  if (v.deviceStatus?.gpsData) {
    const lat = toNumber(v.deviceStatus.gpsData.latitude ?? v.deviceStatus.gpsData.lat);
    const lng = toNumber(v.deviceStatus.gpsData.longitude ?? v.deviceStatus.gpsData.lng);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  if (v.gpsData) {
    const lat = toNumber(v.gpsData.latitude ?? v.gpsData.lat);
    const lng = toNumber(v.gpsData.longitude ?? v.gpsData.lng);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  const lat = toNumber(v.latitude ?? v.lat ?? v.gpsLat);
  const lng = toNumber(v.longitude ?? v.lng ?? v.gpsLng);
  if (lat !== null && lng !== null) return { lat, lng };
  return null;
};

const getIgnition = (v) => v.deviceStatus?.status?.ignition ?? null;
const vehicleDisplayName = (v) => v.vehicleName || v.vehicleNumber || `Vehicle #${v.id}`;

// ─── Map Marker Icon (animated pill) ─────────────────────────────────────────
const makeVehicleIcon = (vehicle, isSelected) => {
  const ign = getIgnition(vehicle);
  const bg = ign === true ? '#15803d' : ign === false ? '#b91c1c' : '#374151';
  const cls = isSelected ? 'fv-sel' : ign === true ? 'fv-run' : 'fv-stop';
  const label = (vehicle.vehicleNumber || vehicle.vehicleName || `#${vehicle.id}`).toUpperCase();
  const w = Math.max(62, label.length * 7.4 + 24);
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;display:inline-block;">
      <div class="${cls}" style="background:${bg};color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.07em;white-space:nowrap;border:1.5px solid rgba(255,255,255,0.4);cursor:pointer;">
        ${label}
      </div>
      <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg};"></div>
    </div>`,
    iconSize: [w, 30],
    iconAnchor: [w / 2, 36],
  });
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Ic = ({ n, size = 14, color = 'currentColor', sw = 1.75 }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0, display: 'block' } };
  const I = {
    pin:      <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></>,
    cpu:      <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></>,
    activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
    droplet:  <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>,
    route:    <><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/><circle cx="18" cy="5" r="3"/></>,
    map:      <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
    chart:    <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    radio:    <><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/></>,
    edit:     <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
    play:     <polygon points="5 3 19 12 5 21 5 3"/>,
    refresh:  <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></>,
    download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    search:   <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    layers:   <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    gear:     <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    battery:  <><rect x="2" y="7" width="16" height="10" rx="2"/><line x1="22" y1="11" x2="22" y2="13"/></>,
    zap:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    info:     <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    save:     <><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
    menu:     <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    chevD:    <polyline points="6 9 12 15 18 9"/>,
    chevUp:   <polyline points="18 15 12 9 6 15"/>,
  };
  return <svg {...p}>{I[n] ?? null}</svg>;
};

// ─── Style helpers ────────────────────────────────────────────────────────────
const btn = (bg, disabled) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', background: disabled ? '#e5e7eb' : bg,
  color: disabled ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.75 : 1, flexShrink: 0,
});
const inp = { width: '100%', padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none', color: C.text, background: C.white };
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };

// ─── MapController ────────────────────────────────────────────────────────────
const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 15, { duration: 1 }); }, [center, map]);
  return null;
};

// ─── Vehicle Hover Tooltip ────────────────────────────────────────────────────
const VehicleTooltip = ({ vehicle }) => {
  const ign = getIgnition(vehicle);
  const gps = vehicle.deviceStatus?.gpsData;
  const fuel = vehicle.deviceStatus?.fuel;
  const status = vehicle.deviceStatus?.status;
  const engine = vehicle.deviceStatus?.engine;
  const trip = vehicle.deviceStatus?.trip;
  const coords = getVehicleCoords(vehicle);
  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', minWidth: 200 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>{vehicleDisplayName(vehicle)}</div>
      {vehicle.vehicleName && vehicle.vehicleNumber && (
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, fontFamily: 'monospace' }}>{vehicle.vehicleNumber}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ign === true ? '#16a34a' : ign === false ? '#dc2626' : '#9ca3af', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: ign === true ? '#16a34a' : ign === false ? '#dc2626' : '#6b7280' }}>
          {ign === true ? 'Engine Running' : ign === false ? 'Engine Off' : 'Status Unknown'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
        {gps?.speed !== undefined && <><span style={{ color: '#6b7280' }}>Speed</span><span style={{ fontWeight: 700 }}>{gps.speed} km/h</span></>}
        {fuel?.level !== undefined && <><span style={{ color: '#6b7280' }}>Fuel</span><span style={{ fontWeight: 700, color: fuel.level < 20 ? '#dc2626' : '#0f172a' }}>{Math.round(fuel.level)}%</span></>}
        {status?.battery !== undefined && <><span style={{ color: '#6b7280' }}>Battery</span><span style={{ fontWeight: 700 }}>{status.battery}%</span></>}
        {status?.voltage !== undefined && <><span style={{ color: '#6b7280' }}>Voltage</span><span style={{ fontWeight: 700 }}>{status.voltage} V</span></>}
        {engine?.speed !== undefined && <><span style={{ color: '#6b7280' }}>RPM</span><span style={{ fontWeight: 700 }}>{engine.speed}</span></>}
        {trip?.odometer !== undefined && <><span style={{ color: '#6b7280' }}>Odometer</span><span style={{ fontWeight: 700 }}>{Number(trip.odometer).toFixed(1)} km</span></>}
        {gps?.satellites !== undefined && <><span style={{ color: '#6b7280' }}>Satellites</span><span style={{ fontWeight: 700 }}>{gps.satellites}</span></>}
        {status?.gsmSignal !== undefined && <><span style={{ color: '#6b7280' }}>GSM</span><span style={{ fontWeight: 700 }}>{status.gsmSignal}</span></>}
      </div>
      {coords && (
        <div style={{ marginTop: 8, padding: '6px 8px', background: '#f8fafc', borderRadius: 6, fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>
      )}
      {vehicle.deviceType && <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>{vehicle.deviceType} · {vehicle.imei}</div>}
      {gps?.timestamp && <div style={{ marginTop: 4, fontSize: 10, color: '#9ca3af' }}>Updated {new Date(gps.timestamp).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'short' })}</div>}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const MyFleet = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', color: '#3b82f6' });
  const [editingGroup, setEditingGroup] = useState(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [showManageVehicles, setShowManageVehicles] = useState(null);

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');

  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [sensors, setSensors] = useState([]);
  const [loadingSensors, setLoadingSensors] = useState(false);
  const [sensorForm, setSensorForm] = useState({ name: '', type: 'number', unit: '', mappedParameter: '', description: '', visible: true });
  const [editingSensor, setEditingSensor] = useState(null);
  const [showSensorForm, setShowSensorForm] = useState(false);
  const [savingSensor, setSavingSensor] = useState(false);

  const today = getISTToday();
  const weekAgo = getISTDaysAgo(7);
  const [reportTab, setReportTab] = useState('summary');
  const [reportFrom, setReportFrom] = useState(weekAgo);
  const [reportTo, setReportTo] = useState(today);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPage, setReportPage] = useState(0);
  const [reportExporting, setReportExporting] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerVehicle, setPlayerVehicle] = useState(null);
  const [playerFrom, setPlayerFrom] = useState(null);
  const [playerTo, setPlayerTo] = useState(null);

  const [mapCenter, setMapCenter] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // inject CSS animations
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'fleet-hud-css';
    el.textContent = HUD_CSS;
    document.head.appendChild(el);
    return () => document.getElementById('fleet-hud-css')?.remove();
  }, []);

  // ─── Fetching ───────────────────────────────────────────────────────────────
  const fetchVehicles = () => {
    setLoading(true);
    getVehicles().then(r => setVehicles(r.data || [])).catch(console.error).finally(() => setLoading(false));
  };
  const fetchGroups = () => {
    getGroups().then(r => setGroups(r.data?.data || [])).catch(() => {});
  };
  useEffect(() => { fetchVehicles(); fetchGroups(); }, []);

  useEffect(() => {
    if (!selectedVehicle) { setSensors([]); return; }
    setLoadingSensors(true);
    getVehicleSensors(selectedVehicle.id)
      .then(r => setSensors(r.data || []))
      .catch(() => setSensors([]))
      .finally(() => setLoadingSensors(false));
  }, [selectedVehicle?.id]);

  useEffect(() => {
    if (!selectedVehicle || activeTab !== 'reports') return;
    fetchReport(selectedVehicle.id, reportTab, reportFrom, reportTo, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id, activeTab, reportTab]);

  useEffect(() => {
    if (!selectedVehicle || activeTab !== 'trips') return;
    fetchReport(selectedVehicle.id, 'trips', reportFrom, reportTo, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id, activeTab]);

  const fetchReport = async (vehicleId, tab, from, to, page = 0) => {
    setReportLoading(true); setReportData(null);
    try {
      const off = page * REPORT_PAGE_SIZE;
      let res;
      if (tab === 'summary')          res = await getVehicleReportSummary(vehicleId, from, to);
      else if (tab === 'daily')       res = await getVehicleReportDaily(vehicleId, from, to);
      else if (tab === 'engineHours') res = await getVehicleReportEngineHours(vehicleId, from, to, REPORT_PAGE_SIZE, off);
      else if (tab === 'trips')       res = await getVehicleReportTrips(vehicleId, from, to, REPORT_PAGE_SIZE, off);
      else if (tab === 'fuelFillings') res = await getVehicleReportFuelFillings(vehicleId, from, to);
      setReportData(res?.data?.data ?? res?.data);
    } catch { toast.error('Failed to load report'); }
    finally { setReportLoading(false); }
  };

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleSync = async (v) => {
    setSyncing(true); setSyncingId(v.id);
    try {
      const r = await syncVehicleData(v.id);
      const u = r.data;
      setVehicles(p => p.map(x => x.id === u.id ? u : x));
      if (selectedVehicle?.id === u.id) setSelectedVehicle(u);
      toast.success('Synced!');
    } catch (e) { toast.error('Sync failed: ' + (e.message || 'error')); }
    finally { setSyncing(false); setSyncingId(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this vehicle from your fleet?')) return;
    try {
      await deleteVehicle(id);
      toast.success('Vehicle removed');
      if (selectedVehicle?.id === id) setSelectedVehicle(null);
      fetchVehicles();
    } catch (e) { toast.error(e.message || 'Delete failed'); }
  };

  const selectVehicle = (v) => {
    setSelectedVehicle(v);
    setActiveTab('overview');
    setReportData(null);
    const coords = getVehicleCoords(v);
    if (coords) setMapCenter([coords.lat, coords.lng]);
    setEditForm({
      vehicleNumber: v.vehicleNumber || '', vehicleName: v.vehicleName || '',
      chasisNumber: v.chasisNumber || '', engineNumber: v.engineNumber || '',
      imei: v.imei || '', deviceName: v.deviceName || '', deviceType: v.deviceType || '',
      serverIp: v.serverIp || '', serverPort: v.serverPort || '',
      vehicleIcon: v.vehicleIcon || 'car', status: v.status || 'active',
      idleThreshold: v.idleThreshold || 5, fuelFillThreshold: v.fuelFillThreshold || 5,
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      const r = await updateVehicle(selectedVehicle.id, editForm);
      const u = r.data?.data || r.data;
      setVehicles(p => p.map(x => x.id === u.id ? { ...x, ...u } : x));
      setSelectedVehicle(p => ({ ...p, ...u }));
      toast.success('Vehicle updated');
    } catch (e) { toast.error(e.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const openSensorForm = (sensor = null) => {
    setEditingSensor(sensor);
    setSensorForm(sensor
      ? { name: sensor.name, type: sensor.type, unit: sensor.unit || '', mappedParameter: sensor.mappedParameter || '', description: sensor.description || '', visible: sensor.visible !== false }
      : { name: '', type: 'number', unit: '', mappedParameter: '', description: '', visible: true });
    setShowSensorForm(true);
  };

  const handleSaveSensor = async () => {
    if (!selectedVehicle || !sensorForm.name) return;
    setSavingSensor(true);
    try {
      if (editingSensor) await updateVehicleSensor(selectedVehicle.id, editingSensor.id, sensorForm);
      else await createVehicleSensor(selectedVehicle.id, sensorForm);
      const r = await getVehicleSensors(selectedVehicle.id);
      setSensors(r.data || []); setShowSensorForm(false);
      toast.success(editingSensor ? 'Sensor updated' : 'Sensor added');
    } catch (e) { toast.error(e.message || 'Save failed'); }
    finally { setSavingSensor(false); }
  };

  const handleDeleteSensor = async (sid) => {
    if (!window.confirm('Delete this sensor?')) return;
    try {
      await deleteVehicleSensor(selectedVehicle.id, sid);
      setSensors(p => p.filter(s => s.id !== sid));
      toast.success('Sensor deleted');
    } catch (e) { toast.error(e.message || 'Delete failed'); }
  };

  const handleExport = async () => {
    if (!selectedVehicle) return;
    setReportExporting(true);
    try {
      const blob = await exportVehicleReportExcel(selectedVehicle.id, reportFrom, reportTo);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url; a.download = `report_${selectedVehicle.vehicleNumber || selectedVehicle.id}_${reportFrom}_${reportTo}.xlsx`;
      a.click(); window.URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
    finally { setReportExporting(false); }
  };

  const handleReprocess = async () => {
    if (!selectedVehicle) return;
    if (!window.confirm(`Reprocess data for ${vehicleDisplayName(selectedVehicle)}?`)) return;
    setReprocessing(true);
    try {
      const r = await reprocessVehicleData(selectedVehicle.id, reportFrom, reportTo);
      toast.success(`Reprocessed ${r.data?.data?.processed ?? 0} packets`);
      fetchReport(selectedVehicle.id, reportTab, reportFrom, reportTo, reportPage);
    } catch { toast.error('Reprocess failed'); }
    finally { setReprocessing(false); }
  };

  const openCreateGroup = () => { setEditingGroup(null); setGroupForm({ name: '', description: '', color: '#3b82f6' }); setShowGroupModal(true); };
  const openEditGroup = (g) => { setEditingGroup(g); setGroupForm({ name: g.name, description: g.description || '', color: g.color || '#3b82f6' }); setShowGroupModal(true); };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return toast.error('Group name required');
    setSavingGroup(true);
    try {
      if (editingGroup) { await updateGroup(editingGroup.id, groupForm); toast.success('Group updated'); }
      else { await createGroup(groupForm); toast.success('Group created'); }
      fetchGroups(); setShowGroupModal(false);
    } catch (e) { toast.error(e.message || 'Save failed'); }
    finally { setSavingGroup(false); }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Delete this group?')) return;
    try { await deleteGroup(id); if (selectedGroupId === id) setSelectedGroupId(null); fetchGroups(); toast.success('Group deleted'); }
    catch (e) { toast.error(e.message || 'Delete failed'); }
  };

  const handleToggleVehicleInGroup = async (groupId, vehicleId, inGroup) => {
    try { inGroup ? await removeVehicleFromGroup(groupId, vehicleId) : await addVehicleToGroup(groupId, vehicleId); fetchGroups(); }
    catch (e) { toast.error(e.message || 'Failed'); }
  };

  const openPlayer = (v, from = null, to = null) => { setPlayerVehicle(v); setPlayerFrom(from); setPlayerTo(to); setPlayerOpen(true); };

  // ─── Derived ────────────────────────────────────────────────────────────────
  const filteredVehicles = useMemo(() => {
    let list = vehicles;
    if (selectedGroupId) {
      const grp = groups.find(g => g.id === selectedGroupId);
      const ids = new Set((grp?.vehicles || []).map(v => v.id));
      list = list.filter(v => ids.has(v.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v => (v.vehicleNumber || '').toLowerCase().includes(q) || (v.vehicleName || '').toLowerCase().includes(q) || (v.imei || '').toLowerCase().includes(q));
    }
    return list;
  }, [vehicles, groups, selectedGroupId, search]);

  const mapVehicles = useMemo(() => filteredVehicles.map(v => ({ ...v, coords: getVehicleCoords(v) })).filter(v => v.coords), [filteredVehicles]);
  const runningCount = vehicles.filter(v => getIgnition(v) === true).length;
  const stoppedCount = vehicles.filter(v => getIgnition(v) === false).length;
  const noGpsCount   = vehicles.filter(v => !getVehicleCoords(v)).length;

  // panel z-index shorthand
  const panelBg = 'rgba(7,9,15,0.93)';
  const panelBorder = '1px solid rgba(59,130,246,0.18)';

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0, overflow: 'hidden', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>

      {/* ══════ MAP BACKGROUND (dark tiles) ══════ */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <MapContainer center={INDIA_CENTER} zoom={5} style={{ height: '100%', width: '100%' }} scrollWheelZoom zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={20}
          />
          {mapCenter && <MapController center={mapCenter} />}
          {mapVehicles.map(v => {
            const isSel = selectedVehicle?.id === v.id;
            return (
              <Marker
                key={`${v.id}-${isSel}`}
                position={[v.coords.lat, v.coords.lng]}
                icon={makeVehicleIcon(v, isSel)}
                eventHandlers={{ click: () => selectVehicle(v) }}
              >
                <Tooltip direction="top" offset={[0, -38]}>
                  <VehicleTooltip vehicle={v} />
                </Tooltip>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* ══════ TOP HUD BAR ══════ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: HUD_H, zIndex: 500,
        background: 'rgba(7,9,15,0.94)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(59,130,246,0.2)',
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
      }}>
        {/* Panel toggle */}
        <button onClick={() => setPanelOpen(o => !o)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: C.hudM, padding: '6px 8px', borderRadius: 7, display: 'flex', alignItems: 'center' }}>
          <Ic n="menu" size={15} color={C.hudM} />
        </button>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ic n="map" size={14} color="#fff" sw={2} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.hudT, letterSpacing: '-0.2px' }}>FleetView</span>
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

        {/* Stat chips */}
        <HudChip value={vehicles.length} label="Total" dot="#64748b" />
        <HudChip value={runningCount} label="Running" dot="#22c55e" />
        <HudChip value={stoppedCount} label="Stopped" dot="#ef4444" />
        {noGpsCount > 0 && <HudChip value={noGpsCount} label="No GPS" dot="#f59e0b" />}

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Ic n="search" size={13} color={C.hudM} />
          </span>
          <input
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: C.hudT, fontSize: 13, padding: '6px 10px 6px 30px', outline: 'none', width: 180 }}
            placeholder="Search vehicles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button onClick={fetchVehicles} disabled={loading}
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: loading ? 'not-allowed' : 'pointer', color: C.hudM, padding: '6px 11px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <Ic n="refresh" size={12} color={C.hudM} /> Refresh
        </button>
        <Link to="/add-vehicle"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: C.primary, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
          <Ic n="plus" size={12} /> Add Vehicle
        </Link>
      </div>

      {/* ══════ LEFT PANEL (vehicle list) ══════ */}
      <div style={{
        position: 'absolute', left: 0, top: HUD_H, bottom: 0, width: PANEL_W, zIndex: 400,
        background: panelBg, backdropFilter: 'blur(14px)',
        borderRight: panelBorder,
        display: 'flex', flexDirection: 'column',
        transform: panelOpen ? 'translateX(0)' : `translateX(-${PANEL_W}px)`,
        transition: 'transform 0.25s ease',
      }}>

        {/* Groups section */}
        <div style={{ padding: '10px 12px 8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.hudM, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Ic n="layers" size={10} color={C.hudM} /> Groups
            </span>
            <button onClick={openCreateGroup}
              style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', borderRadius: 5, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Ic n="plus" size={11} color="#60a5fa" />
            </button>
          </div>

          <DarkItem active={selectedGroupId === null} onClick={() => setSelectedGroupId(null)}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: selectedGroupId === null ? 700 : 500, color: C.hudT }}>All Vehicles</span>
            <span style={{ fontSize: 10, color: C.hudM, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px' }}>{vehicles.length}</span>
          </DarkItem>
          {groups.map(g => (
            <DarkItem key={g.id} active={selectedGroupId === g.id} onClick={() => setSelectedGroupId(g.id)}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.color || C.primary, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: selectedGroupId === g.id ? 700 : 500, color: C.hudT }}>{g.name}</span>
              <span style={{ fontSize: 10, color: C.hudM, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px' }}>{g.vehicles?.length || 0}</span>
              <div style={{ display: 'flex', gap: 1 }}>
                {[['gear', () => setShowManageVehicles(g.id)], ['edit', () => openEditGroup(g)], ['x', () => handleDeleteGroup(g.id)]].map(([icon, action], i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); action(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', borderRadius: 4 }}>
                    <Ic n={icon} size={11} color={icon === 'x' ? '#f87171' : C.hudM} />
                  </button>
                ))}
              </div>
            </DarkItem>
          ))}
        </div>

        <div style={{ height: 1, background: 'rgba(59,130,246,0.12)', margin: '0 12px' }} />

        {/* Vehicle cards */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.hudM, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 2px 8px' }}>
            Vehicles ({filteredVehicles.length})
          </div>
          {loading && <div style={{ padding: '20px 0', textAlign: 'center', color: C.hudM, fontSize: 13 }}>Loading…</div>}
          {filteredVehicles.map(v => {
            const ign = getIgnition(v);
            const isSel = selectedVehicle?.id === v.id;
            const fuel = v.deviceStatus?.fuel?.level;
            const speed = v.deviceStatus?.gpsData?.speed;
            const hasGps = !!getVehicleCoords(v);
            const statusColor = ign === true ? '#22c55e' : ign === false ? '#ef4444' : '#475569';
            const statusLabel = ign === true ? 'Running' : ign === false ? 'Stopped' : 'Unknown';
            return (
              <div key={v.id}
                className="fv-card"
                onClick={() => selectVehicle(v)}
                style={{
                  padding: '10px 11px', marginBottom: 6, borderRadius: 10, cursor: 'pointer',
                  background: isSel ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSel ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.07)'}`,
                  borderLeft: `3px solid ${statusColor}`,
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{VEHICLE_ICON_MAP[v.vehicleIcon] || '🚗'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.hudT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {vehicleDisplayName(v)}
                    </div>
                    {v.vehicleName && v.vehicleNumber && (
                      <div style={{ fontSize: 10, color: C.hudM, fontFamily: 'monospace', marginTop: 1 }}>{v.vehicleNumber}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                    <span style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {fuel !== undefined && fuel !== null ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, fuel))}%`, height: '100%', borderRadius: 2, background: fuel > 30 ? '#22c55e' : fuel > 15 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.hudM, minWidth: 28, textAlign: 'right' }}>{Math.round(fuel)}%</span>
                    </div>
                  ) : <div style={{ flex: 1 }} />}
                  {speed !== undefined && <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600, flexShrink: 0 }}>{speed} km/h</span>}
                  {!hasGps && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>NO GPS</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════ RIGHT DETAIL PANEL ══════ */}
      <div style={{
        position: 'absolute', right: 0, top: HUD_H, bottom: 0, width: DETAIL_W, zIndex: 400,
        background: panelBg, backdropFilter: 'blur(14px)',
        borderLeft: panelBorder,
        display: 'flex', flexDirection: 'column',
        transform: selectedVehicle ? 'translateX(0)' : `translateX(${DETAIL_W}px)`,
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {selectedVehicle && (
          <>
            {/* Vehicle Header */}
            <div style={{ padding: '12px 14px 10px', flexShrink: 0, borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {VEHICLE_ICON_MAP[selectedVehicle.vehicleIcon] || '🚗'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.hudT }}>{vehicleDisplayName(selectedVehicle)}</span>
                    <DarkStatusPill on={getIgnition(selectedVehicle)} />
                    {selectedVehicle.deviceType && (
                      <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.2)', color: '#60a5fa', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{selectedVehicle.deviceType}</span>
                    )}
                  </div>
                  {selectedVehicle.vehicleName && selectedVehicle.vehicleNumber && (
                    <div style={{ fontSize: 11, color: C.hudM, marginTop: 2, fontFamily: 'monospace' }}>{selectedVehicle.vehicleNumber}</div>
                  )}
                </div>
                <button onClick={() => setSelectedVehicle(null)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', color: C.hudM, flexShrink: 0 }}>
                  <Ic n="x" size={13} color={C.hudM} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={() => handleSync(selectedVehicle)} disabled={syncing && syncingId === selectedVehicle.id}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px', background: 'rgba(8,145,178,0.25)', border: '1px solid rgba(8,145,178,0.4)', color: '#22d3ee', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  <Ic n="refresh" size={12} color="#22d3ee" /> Sync
                </button>
                <button onClick={() => openPlayer(selectedVehicle)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px', background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  <Ic n="play" size={12} color="#a78bfa" /> Play Route
                </button>
                <button onClick={() => handleDelete(selectedVehicle.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.35)', color: '#f87171', borderRadius: 7, cursor: 'pointer' }}>
                  <Ic n="trash" size={13} color="#f87171" />
                </button>
              </div>
            </div>

            {/* Dark Tab Bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(59,130,246,0.15)', flexShrink: 0, overflowX: 'auto', background: 'rgba(0,0,0,0.2)' }}>
              {[
                { id: 'overview', label: 'Overview', icon: 'activity' },
                { id: 'trips',    label: 'Trips',    icon: 'route' },
                { id: 'reports',  label: 'Reports',  icon: 'chart' },
                { id: 'sensors',  label: 'Sensors',  icon: 'radio' },
                { id: 'edit',     label: 'Edit',     icon: 'edit' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="fv-tab-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '9px 13px',
                    border: 'none', background: activeTab === tab.id ? 'rgba(37,99,235,0.2)' : 'none',
                    cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    color: activeTab === tab.id ? '#60a5fa' : C.hudM,
                    borderBottom: `2px solid ${activeTab === tab.id ? '#3b82f6' : 'transparent'}`,
                  }}>
                  <Ic n={tab.icon} size={12} color={activeTab === tab.id ? '#60a5fa' : C.hudM} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content (light background for readability) */}
            <div style={{ flex: 1, overflow: 'auto', background: C.surface }}>
              <div style={{ padding: 14 }}>
                {activeTab === 'overview' && <OverviewTab vehicle={selectedVehicle} />}
                {activeTab === 'trips' && (
                  <TripsTab vehicle={selectedVehicle} reportFrom={reportFrom} reportTo={reportTo}
                    reportData={reportData} reportLoading={reportLoading} reportPage={reportPage}
                    setReportFrom={setReportFrom} setReportTo={setReportTo} setReportPage={setReportPage}
                    fetchReport={fetchReport} openPlayer={openPlayer} />
                )}
                {activeTab === 'reports' && (
                  <ReportsTab vehicle={selectedVehicle} reportTab={reportTab} setReportTab={setReportTab}
                    reportFrom={reportFrom} reportTo={reportTo} setReportFrom={setReportFrom} setReportTo={setReportTo}
                    reportData={reportData} reportLoading={reportLoading} reportPage={reportPage} setReportPage={setReportPage}
                    reportExporting={reportExporting} reprocessing={reprocessing}
                    fetchReport={fetchReport} handleExport={handleExport} handleReprocess={handleReprocess} />
                )}
                {activeTab === 'sensors' && (
                  <SensorsTab vehicle={selectedVehicle} sensors={sensors} loadingSensors={loadingSensors}
                    showSensorForm={showSensorForm} sensorForm={sensorForm} editingSensor={editingSensor}
                    savingSensor={savingSensor} setSensorForm={setSensorForm} setShowSensorForm={setShowSensorForm}
                    openSensorForm={openSensorForm} handleSaveSensor={handleSaveSensor} handleDeleteSensor={handleDeleteSensor} />
                )}
                {activeTab === 'edit' && (
                  <EditTab editForm={editForm} setEditForm={setEditForm} saving={saving} handleSaveEdit={handleSaveEdit} />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════ BOTTOM-LEFT LEGEND ══════ */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: panelOpen ? PANEL_W + 12 : 12,
        zIndex: 10,
        transition: 'left 0.25s ease',
        background: 'rgba(7,9,15,0.88)', backdropFilter: 'blur(10px)',
        borderRadius: 10, padding: '8px 14px', display: 'flex', gap: 14,
        border: '1px solid rgba(59,130,246,0.15)',
      }}>
        <LegendDot color="#22c55e" label={`${runningCount} Running`} />
        <LegendDot color="#ef4444" label={`${stoppedCount} Stopped`} />
        <LegendDot color="#475569" label={`${mapVehicles.length} on map`} />
      </div>

      {/* ══════ MODALS ══════ */}
      {showGroupModal && (
        <Modal title={editingGroup ? 'Edit Group' : 'New Group'} onClose={() => setShowGroupModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={lbl}>Group Name *</label><input style={inp} placeholder="e.g. North Zone" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} /></div>
            <div><label style={lbl}>Description</label><input style={inp} placeholder="Optional" value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} /></div>
            <div>
              <label style={lbl}>Colour</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {GROUP_COLORS.map(c => (
                  <button key={c} onClick={() => setGroupForm({ ...groupForm, color: c })}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: groupForm.color === c ? `3px solid #0f172a` : '3px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
              <button onClick={() => setShowGroupModal(false)} style={{ ...btn('#6b7280'), background: C.surface, color: C.textSub, border: `1px solid ${C.border}` }}>Cancel</button>
              <button onClick={handleSaveGroup} disabled={savingGroup} style={btn(C.primary, savingGroup)}>{savingGroup ? 'Saving…' : editingGroup ? 'Save Changes' : 'Create Group'}</button>
            </div>
          </div>
        </Modal>
      )}

      {showManageVehicles && (
        <Modal title={`Manage Vehicles — "${groups.find(g => g.id === showManageVehicles)?.name || ''}"`} onClose={() => setShowManageVehicles(null)}>
          <div style={{ maxHeight: 380, overflow: 'auto' }}>
            {vehicles.map(v => {
              const grp = groups.find(g => g.id === showManageVehicles);
              const inGroup = (grp?.vehicles || []).some(gv => gv.id === v.id);
              return (
                <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', cursor: 'pointer', borderBottom: `1px solid ${C.borderLight}` }}>
                  <input type="checkbox" checked={inGroup} onChange={() => handleToggleVehicleInGroup(showManageVehicles, v.id, inGroup)} style={{ width: 16, height: 16, accentColor: C.primary }} />
                  <span style={{ fontSize: 18 }}>{VEHICLE_ICON_MAP[v.vehicleIcon] || '🚗'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{vehicleDisplayName(v)}</div>
                    {v.vehicleNumber && v.vehicleName && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{v.vehicleNumber}</div>}
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ marginTop: 14, textAlign: 'right' }}>
            <button onClick={() => setShowManageVehicles(null)} style={btn(C.primary)}>Done</button>
          </div>
        </Modal>
      )}

      {playerOpen && playerVehicle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '95vw', height: '90vh', background: C.white, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            <LocationPlayer vehicle={playerVehicle} onClose={() => setPlayerOpen(false)} initialFrom={playerFrom} initialTo={playerTo} />
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Dark Panel Primitives
// ══════════════════════════════════════════════════════════════════════════════

const DarkItem = ({ active, onClick, children }) => (
  <div onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
      background: active ? 'rgba(37,99,235,0.2)' : 'transparent',
      border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : 'transparent'}`,
    }}>
    {children}
  </div>
);

const DarkStatusPill = ({ on }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: on === true ? 'rgba(22,163,74,0.25)' : on === false ? 'rgba(220,38,38,0.2)' : 'rgba(71,85,105,0.3)',
    color: on === true ? '#4ade80' : on === false ? '#f87171' : '#94a3b8',
  }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: on === true ? '#22c55e' : on === false ? '#ef4444' : '#64748b' }} />
    {on === true ? 'Running' : on === false ? 'Stopped' : 'Unknown'}
  </span>
);

const HudChip = ({ value, label, dot }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
    <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{value}</span>
    <span style={{ fontSize: 11, color: '#475569' }}>{label}</span>
  </div>
);

const LegendDot = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
    <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>{label}</span>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// Shared UI Primitives (light theme for tab content)
// ══════════════════════════════════════════════════════════════════════════════

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ background: C.white, borderRadius: 14, padding: 24, width: 440, maxWidth: '95vw', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</span>
        <button onClick={onClose} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 8px', cursor: 'pointer', display: 'flex', color: C.textMuted }}><Ic n="x" size={14} /></button>
      </div>
      {children}
    </div>
  </div>
);

const InfoRow = ({ label, value, accent, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.borderLight}` }}>
    <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: accent || C.text, fontFamily: mono ? 'monospace' : 'inherit' }}>{value ?? '—'}</span>
  </div>
);

const SectionCard = ({ icon, title, children, style }) => (
  <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', ...style }}>
    {title && (
      <div style={{ padding: '9px 14px', background: C.surface, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon && <Ic n={icon} size={13} color={C.primary} />}
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
      </div>
    )}
    <div style={{ padding: '10px 14px' }}>{children}</div>
  </div>
);

const StatCard = ({ label, value, color = C.primary, icon }) => (
  <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 16px', borderLeft: `4px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{value}</div>
      </div>
      {icon && <Ic n={icon} size={18} color={color} sw={1.5} />}
    </div>
  </div>
);

const Empty = ({ msg }) => (
  <div style={{ textAlign: 'center', padding: '28px 20px', color: C.textLight, background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13 }}>{msg}</div>
);

// ══════════════════════════════════════════════════════════════════════════════
// Overview Tab
// ══════════════════════════════════════════════════════════════════════════════
const OverviewTab = ({ vehicle }) => {
  const ds = vehicle.deviceStatus;
  const gps = ds?.gpsData;
  const status = ds?.status;
  const fuel = ds?.fuel;
  const engine = ds?.engine;
  const trip = ds?.trip;
  const driver = ds?.driver;
  const alerts = ds?.alerts;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionCard icon="pin" title="GPS & Location">
        <InfoRow label="Latitude"    value={gps?.latitude?.toFixed(6)} mono />
        <InfoRow label="Longitude"   value={gps?.longitude?.toFixed(6)} mono />
        <InfoRow label="Speed"       value={gps?.speed !== undefined ? `${gps.speed} km/h` : null} />
        <InfoRow label="Satellites"  value={gps?.satellites} />
        <InfoRow label="Altitude"    value={gps?.altitude !== undefined ? `${gps.altitude} m` : null} />
        <InfoRow label="Last Update" value={gps?.timestamp ? new Date(gps.timestamp).toLocaleString('en-IN') : null} />
      </SectionCard>
      <SectionCard icon="cpu" title="Device Status">
        <InfoRow label="Ignition"   value={status?.ignition === true ? 'ON' : status?.ignition === false ? 'OFF' : null}
          accent={status?.ignition === true ? C.success : status?.ignition === false ? C.danger : undefined} />
        <InfoRow label="Movement"   value={status?.movement === true ? 'Moving' : status?.movement === false ? 'Stationary' : null} />
        <InfoRow label="Battery"    value={status?.battery != null ? `${status.battery}%` : null} />
        <InfoRow label="Voltage"    value={status?.voltage != null ? `${status.voltage} V` : null} />
        <InfoRow label="GSM Signal" value={status?.gsmSignal != null ? `${status.gsmSignal}` : null} />
        {ds?.deviceType !== 'FMB125' && <InfoRow label="Oil Cut" value={status?.oil !== undefined ? (status.oil ? 'Active' : 'Normal') : null} />}
      </SectionCard>
      {(fuel || engine) && (
        <SectionCard icon="droplet" title="Fuel & Engine">
          {fuel?.level != null && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>Fuel Level</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: fuel.level < 20 ? C.danger : C.success }}>{Math.round(fuel.level)}%</span>
              </div>
              <div style={{ height: 8, background: C.borderLight, borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, fuel.level))}%`, background: fuel.level < 20 ? C.danger : fuel.level < 40 ? C.warning : C.success, borderRadius: 4 }} />
              </div>
            </div>
          )}
          <InfoRow label="Fuel Used"    value={fuel?.used != null ? `${fuel.used} L` : null} />
          <InfoRow label="Fuel Rate"    value={fuel?.rate != null ? `${fuel.rate} L/h` : null} />
          <InfoRow label="Engine RPM"   value={engine?.speed != null ? `${engine.speed} RPM` : null} />
          <InfoRow label="Engine Temp"  value={engine?.temperature != null ? `${engine.temperature} °C` : null} />
          <InfoRow label="Engine Load"  value={engine?.load != null ? `${engine.load}%` : null} />
          <InfoRow label="Engine Hours" value={engine?.hours != null ? `${engine.hours} h` : null} />
        </SectionCard>
      )}
      <SectionCard icon="route" title="Trip Info">
        <InfoRow label="Odometer"      value={trip?.odometer != null ? `${Number(trip.odometer).toFixed(1)} km` : null} />
        <InfoRow label="Trip Odometer" value={trip?.tripOdometer != null ? `${Number(trip.tripOdometer).toFixed(1)} km` : null} />
        {driver?.name && <InfoRow label="Driver" value={driver.name} />}
        {driver?.iButtonId && <InfoRow label="iButton ID" value={driver.iButtonId} />}
        {alerts?.latestAlarm && <InfoRow label="Last Alarm" value={alerts.latestAlarm} accent={C.danger} />}
      </SectionCard>
      <SectionCard icon="gear" title="Device Config">
        <InfoRow label="Device Name" value={vehicle.deviceName} />
        <InfoRow label="Device Type" value={vehicle.deviceType} />
        <InfoRow label="Server IP"   value={vehicle.serverIp} mono />
        <InfoRow label="Server Port" value={vehicle.serverPort} mono />
        <InfoRow label="IMEI"        value={vehicle.imei} mono />
      </SectionCard>
      <SectionCard icon="info" title="Vehicle Info">
        <InfoRow label="Registration" value={vehicle.vehicleNumber} mono />
        <InfoRow label="Name"         value={vehicle.vehicleName} />
        <InfoRow label="Chassis No."  value={vehicle.chasisNumber} />
        <InfoRow label="Engine No."   value={vehicle.engineNumber} />
        <InfoRow label="Idle Threshold" value={vehicle.idleThreshold ? `${vehicle.idleThreshold} min` : null} />
        <InfoRow label="Fuel Threshold" value={vehicle.fuelFillThreshold ? `${vehicle.fuelFillThreshold}%` : null} />
      </SectionCard>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Trips Tab
// ══════════════════════════════════════════════════════════════════════════════
const TripsTab = ({ vehicle, reportFrom, reportTo, reportData, reportLoading, reportPage, setReportFrom, setReportTo, setReportPage, fetchReport, openPlayer }) => {
  const trips = Array.isArray(reportData?.rows) ? reportData.rows : [];
  const total = reportData?.total ?? trips.length;
  const handleLoad = () => { setReportPage(0); fetchReport(vehicle.id, 'trips', reportFrom, reportTo, 0); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', flexWrap: 'wrap' }}>
        <Ic n="calendar" size={14} color={C.textMuted} />
        <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ ...inp, width: 'auto', padding: '5px 8px' }} />
        <span style={{ color: C.textLight }}>to</span>
        <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ ...inp, width: 'auto', padding: '5px 8px' }} />
        <button onClick={handleLoad} style={btn(C.primary)}>Load</button>
        {trips.length > 0 && <span style={{ fontSize: 12, color: C.textMuted }}>{total} trip{total !== 1 ? 's' : ''}</span>}
      </div>
      {reportLoading && <div style={{ textAlign: 'center', padding: 28, color: C.textMuted }}>Loading trips…</div>}
      {!reportLoading && !reportData && <Empty msg='Select a date range and click "Load".' />}
      {!reportLoading && reportData && trips.length === 0 && <Empty msg="No trips found for this period." />}
      {trips.map((trip, idx) => {
        const start = trip.beginning;
        const end = trip.end;
        return (
          <div key={idx} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: C.primaryBg, color: C.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              {trip.no || reportPage * REPORT_PAGE_SIZE + idx + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                {start ? new Date(start).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                {end && <span style={{ color: C.textMuted, fontWeight: 400 }}> → {new Date(end).toLocaleString('en-IN', { timeStyle: 'short' })}</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: C.textSub }}>
                {trip.mileage !== undefined && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Ic n="route" size={10} color={C.textLight} /> {Number(trip.mileage || 0).toFixed(2)} km</span>}
                {trip.duration && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Ic n="clock" size={10} color={C.textLight} /> {trip.duration}</span>}
                {trip.avgSpeed !== undefined && <span>Avg {parseFloat(trip.avgSpeed || 0).toFixed(1)} km/h</span>}
                {trip.consFls !== undefined && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Ic n="droplet" size={10} color={C.textLight} /> {Number(trip.consFls || 0).toFixed(2)} L</span>}
              </div>
            </div>
            <button onClick={() => openPlayer(vehicle, start, end)} disabled={!start} style={{ ...btn(C.purple, !start), padding: '5px 10px', fontSize: 11 }}>
              <Ic n="play" size={11} /> Play
            </button>
          </div>
        );
      })}
      {total > REPORT_PAGE_SIZE && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button disabled={reportPage === 0} onClick={() => { setReportPage(reportPage - 1); fetchReport(vehicle.id, 'trips', reportFrom, reportTo, reportPage - 1); }}
            style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.white, cursor: reportPage === 0 ? 'not-allowed' : 'pointer', fontSize: 12, color: C.textSub }}>← Prev</button>
          <span style={{ padding: '5px 10px', fontSize: 12, color: C.textMuted }}>Page {reportPage + 1} of {Math.ceil(total / REPORT_PAGE_SIZE)}</span>
          <button disabled={(reportPage + 1) * REPORT_PAGE_SIZE >= total} onClick={() => { setReportPage(reportPage + 1); fetchReport(vehicle.id, 'trips', reportFrom, reportTo, reportPage + 1); }}
            style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textSub }}>Next →</button>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Reports Tab
// ══════════════════════════════════════════════════════════════════════════════
const ReportsTab = ({ vehicle, reportTab, setReportTab, reportFrom, reportTo, setReportFrom, setReportTo, reportData, reportLoading, reportPage, setReportPage, reportExporting, reprocessing, fetchReport, handleExport, handleReprocess }) => {
  const TABS = [
    { id: 'summary',      label: 'Summary',    icon: 'chart' },
    { id: 'daily',        label: 'Daily',       icon: 'calendar' },
    { id: 'engineHours',  label: 'Engine Hrs',  icon: 'clock' },
    { id: 'trips',        label: 'Trips',       icon: 'route' },
    { id: 'fuelFillings', label: 'Fuel Fills',  icon: 'droplet' },
  ];
  const handleLoad = () => { setReportPage(0); fetchReport(vehicle.id, reportTab, reportFrom, reportTo, 0); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ ...inp, width: 'auto', padding: '5px 8px' }} />
        <span style={{ color: C.textLight, fontSize: 12 }}>to</span>
        <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ ...inp, width: 'auto', padding: '5px 8px' }} />
        <button onClick={handleLoad} style={btn(C.primary)}>Load</button>
        <div style={{ flex: 1 }} />
        <button onClick={handleExport} disabled={reportExporting} style={btn('#059669', reportExporting)}>
          <Ic n="download" size={12} /> {reportExporting ? 'Exporting…' : 'Excel'}
        </button>
        <button onClick={handleReprocess} disabled={reprocessing} style={btn('#d97706', reprocessing)}>
          <Ic n="refresh" size={12} /> {reprocessing ? '…' : 'Reprocess'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setReportTab(t.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: reportTab === t.id ? 700 : 500, border: `1px solid ${reportTab === t.id ? C.primary : C.border}`, background: reportTab === t.id ? C.primaryBg : C.white, color: reportTab === t.id ? C.primaryDark : C.textSub }}>
            <Ic n={t.icon} size={11} color={reportTab === t.id ? C.primary : '#9ca3af'} /> {t.label}
          </button>
        ))}
      </div>
      {reportLoading && <div style={{ textAlign: 'center', padding: 24, color: C.textMuted }}>Loading report…</div>}
      {!reportLoading && !reportData && <Empty msg="Select a date range and click Load." />}
      {!reportLoading && reportData && <ReportData type={reportTab} data={reportData} vehicle={vehicle} reportPage={reportPage} setReportPage={setReportPage} reportFrom={reportFrom} reportTo={reportTo} fetchReport={fetchReport} />}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Report Data
// ══════════════════════════════════════════════════════════════════════════════
const ReportData = ({ type, data, vehicle, reportPage, setReportPage, reportFrom, reportTo, fetchReport }) => {
  if (type === 'summary') {
    const s = data;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        <StatCard label="Total Distance"  value={`${Number(s.mileage || 0).toFixed(1)} km`}               color={C.primary}  icon="route" />
        <StatCard label="Engine Hours"    value={s.engineHours || '—'}                                     color={C.teal}     icon="clock" />
        <StatCard label="Fuel Consumed"   value={`${Number(s.consumedByFls || 0).toFixed(1)} L`}           color={C.warning}  icon="droplet" />
        <StatCard label="Total Trips"     value={String(s.tripsCount ?? 0)}                                 color={C.purple}   icon="route" />
        <StatCard label="Max Speed"       value={`${Math.round(s.maxSpeedInTrips || 0)} km/h`}             color={C.danger}   icon="zap" />
        <StatCard label="Avg Speed"       value={`${parseFloat(s.avgSpeedInTrips || 0).toFixed(1)} km/h`}  color="#0891b2"    icon="activity" />
        <StatCard label="Parking Time"    value={s.parkingTime || '—'}                                     color="#6b7280"    icon="clock" />
        <StatCard label="Parking Stops"   value={String(s.parkingsCount ?? 0)}                             color="#6b7280"    icon="info" />
        <StatCard label="Fuel Fills"      value={String(s.totalFillings ?? 0)}                             color={C.success}  icon="droplet" />
        <StatCard label="Fuel Filled"     value={`${Number(s.totalFilled || 0).toFixed(1)}%`}             color={C.success}  icon="battery" />
      </div>
    );
  }
  if (type === 'daily') {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return (
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 500 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              {['Date','Distance','Eng Hrs','Fuel (L)','km/L','Parking'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.textMuted, borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? C.white : '#fafafa' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600, color: C.text }}>{row.date}</td>
                <td style={{ padding: '7px 10px', color: C.textSub }}>{Number(row.distance || 0).toFixed(1)} km</td>
                <td style={{ padding: '7px 10px', color: C.textSub }}>{row.engineHours || '—'}</td>
                <td style={{ padding: '7px 10px', color: C.textSub }}>{Number(row.consFls || 0).toFixed(2)}</td>
                <td style={{ padding: '7px 10px', color: C.textSub }}>{row.kmpl ?? '—'}</td>
                <td style={{ padding: '7px 10px', color: C.textSub }}>{row.parkingDuration || '—'} ({row.parkingCount || 0})</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: C.textLight }}>No data for this period</td></tr>}
            {rows.length > 0 && data.totals && (
              <tr style={{ background: C.primaryBg, fontWeight: 700 }}>
                <td style={{ padding: '7px 10px', color: C.primaryDark }}>Total</td>
                <td style={{ padding: '7px 10px' }}>{Number(data.totals.distance || 0).toFixed(1)} km</td>
                <td style={{ padding: '7px 10px' }}>{data.totals.engineHours || '—'}</td>
                <td style={{ padding: '7px 10px' }}>{Number(data.totals.consFls || 0).toFixed(2)}</td>
                <td style={{ padding: '7px 10px' }}>—</td>
                <td style={{ padding: '7px 10px' }}>{data.totals.parkingDuration || '—'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
  if (type === 'engineHours') {
    const sessions = Array.isArray(data?.rows) ? data.rows : [];
    const total = data?.total ?? sessions.length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {sessions.map((s, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 9, border: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: C.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.teal, flexShrink: 0 }}>
              {s.no || reportPage * REPORT_PAGE_SIZE + i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                {s.beginning ? new Date(s.beginning).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                {s.end && <span style={{ color: C.textMuted, fontWeight: 400 }}> → {new Date(s.end).toLocaleString('en-IN', { timeStyle: 'short' })}</span>}
              </div>
              <div style={{ fontSize: 11, color: C.textSub, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 3 }}>
                <span><Ic n="clock" size={10} color={C.textLight} /> {s.engineHours || '—'}</span>
                <span><Ic n="route" size={10} color={C.textLight} /> {Number(s.mileage || 0).toFixed(1)} km</span>
                <span><Ic n="droplet" size={10} color={C.textLight} /> {Number(s.consFls || 0).toFixed(2)} L</span>
              </div>
            </div>
          </div>
        ))}
        {sessions.length === 0 && <Empty msg="No engine sessions found." />}
        {total > REPORT_PAGE_SIZE && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button disabled={reportPage === 0} onClick={() => { setReportPage(reportPage - 1); fetchReport(vehicle.id, 'engineHours', reportFrom, reportTo, reportPage - 1); }} style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textSub }}>← Prev</button>
            <span style={{ padding: '5px 10px', fontSize: 12, color: C.textMuted }}>Page {reportPage + 1}</span>
            <button disabled={(reportPage + 1) * REPORT_PAGE_SIZE >= total} onClick={() => { setReportPage(reportPage + 1); fetchReport(vehicle.id, 'engineHours', reportFrom, reportTo, reportPage + 1); }} style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textSub }}>Next →</button>
          </div>
        )}
      </div>
    );
  }
  if (type === 'trips') {
    const trips = Array.isArray(data?.rows) ? data.rows : [];
    return (
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 480 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              {['#','Start','End','Distance','Duration','Fuel'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.textMuted, borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trips.map((trip, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? C.white : '#fafafa' }}>
                <td style={{ padding: '7px 10px', color: C.textMuted, fontWeight: 600 }}>{trip.no || i + 1}</td>
                <td style={{ padding: '7px 10px', fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{trip.beginning ? new Date(trip.beginning).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                <td style={{ padding: '7px 10px', color: C.textSub, whiteSpace: 'nowrap' }}>{trip.end ? new Date(trip.end).toLocaleString('en-IN', { timeStyle: 'short' }) : '—'}</td>
                <td style={{ padding: '7px 10px', color: C.textSub }}>{Number(trip.mileage || 0).toFixed(2)} km</td>
                <td style={{ padding: '7px 10px', color: C.textSub }}>{trip.duration || '—'}</td>
                <td style={{ padding: '7px 10px', color: C.textSub }}>{trip.consFls ? Number(trip.consFls).toFixed(2) : '—'}</td>
              </tr>
            ))}
            {trips.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: C.textLight }}>No trips found</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }
  if (type === 'fuelFillings') {
    const events = Array.isArray(data?.rows) ? data.rows : [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {events.map((ev, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 9, border: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ic n="droplet" size={14} color={C.success} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{ev.time ? new Date(ev.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</div>
              <div style={{ fontSize: 11, color: C.textSub, marginTop: 3, display: 'flex', gap: 10 }}>
                <span>{ev.fuelBefore}% → {ev.fuelAfter}%</span>
                <span style={{ color: C.success, fontWeight: 700 }}>+{ev.filled}% added</span>
              </div>
              {ev.location && ev.location !== '—' && <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>{ev.location}</div>}
            </div>
          </div>
        ))}
        {events.length === 0 && <Empty msg="No fuel fill events found." />}
      </div>
    );
  }
  return null;
};

// ══════════════════════════════════════════════════════════════════════════════
// Sensors Tab
// ══════════════════════════════════════════════════════════════════════════════
const SensorsTab = ({ vehicle, sensors, loadingSensors, showSensorForm, sensorForm, editingSensor, savingSensor, setSensorForm, setShowSensorForm, openSensorForm, handleSaveSensor, handleDeleteSensor }) => {
  const io = vehicle.deviceStatus?.gpsData?.ioElements || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.keys(io).length > 0 && (
        <SectionCard icon="radio" title="Live Device Data">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 7 }}>
            {Object.entries(io).slice(0, 24).map(([k, v]) => (
              <div key={k} style={{ background: C.surface, borderRadius: 7, padding: '7px 9px', border: `1px solid ${C.borderLight}` }}>
                <div style={{ fontSize: 9, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}` }}>
        <div style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Custom Sensors ({sensors.length})</span>
          <button onClick={() => openSensorForm(null)} style={btn(C.primary)}><Ic n="plus" size={12} /> Add</button>
        </div>
        {showSensorForm && (
          <div style={{ padding: 12, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
              <div><label style={lbl}>Name *</label><input style={inp} value={sensorForm.name} onChange={e => setSensorForm({ ...sensorForm, name: e.target.value })} placeholder="e.g. Temperature" /></div>
              <div><label style={lbl}>Type</label><select style={inp} value={sensorForm.type} onChange={e => setSensorForm({ ...sensorForm, type: e.target.value })}>{SENSOR_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label style={lbl}>Unit</label><input style={inp} value={sensorForm.unit} onChange={e => setSensorForm({ ...sensorForm, unit: e.target.value })} placeholder="e.g. °C" /></div>
              <div><label style={lbl}>Mapped Param</label><input style={inp} value={sensorForm.mappedParameter} onChange={e => setSensorForm({ ...sensorForm, mappedParameter: e.target.value })} placeholder="e.g. io_69" /></div>
            </div>
            <div style={{ marginBottom: 9 }}><label style={lbl}>Description</label><input style={inp} value={sensorForm.description} onChange={e => setSensorForm({ ...sensorForm, description: e.target.value })} placeholder="Optional" /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, color: C.textSub, cursor: 'pointer' }}>
                <input type="checkbox" checked={sensorForm.visible} onChange={e => setSensorForm({ ...sensorForm, visible: e.target.checked })} style={{ accentColor: C.primary }} /> Visible
              </label>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowSensorForm(false)} style={{ padding: '5px 11px', border: `1px solid ${C.border}`, borderRadius: 7, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textSub }}>Cancel</button>
              <button onClick={handleSaveSensor} disabled={savingSensor || !sensorForm.name} style={btn(C.primary, savingSensor || !sensorForm.name)}>{savingSensor ? 'Saving…' : editingSensor ? 'Update' : 'Add'}</button>
            </div>
          </div>
        )}
        {loadingSensors && <div style={{ padding: 18, textAlign: 'center', color: C.textLight }}>Loading…</div>}
        {!loadingSensors && sensors.length === 0 && !showSensorForm && <div style={{ padding: 20, textAlign: 'center', color: C.textLight, fontSize: 12 }}>No sensors configured.</div>}
        {sensors.map(s => {
          const live = s.mappedParameter ? io[s.mappedParameter] : undefined;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.visible !== false ? C.success : C.textLight, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{s.name}</span>
                  {s.unit && <span style={{ fontSize: 10, color: C.textMuted, background: C.surface, borderRadius: 4, padding: '1px 5px', border: `1px solid ${C.borderLight}` }}>{s.unit}</span>}
                  {live !== undefined && <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, background: C.primaryBg, borderRadius: 4, padding: '1px 7px' }}>{String(live)}</span>}
                </div>
                <div style={{ fontSize: 10, color: C.textLight, marginTop: 1 }}>{[s.mappedParameter, s.type, s.description].filter(Boolean).join(' · ')}</div>
              </div>
              <button onClick={() => openSensorForm(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><Ic n="edit" size={12} color={C.textMuted} /></button>
              <button onClick={() => handleDeleteSensor(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><Ic n="trash" size={12} color={C.danger} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Edit Tab
// ══════════════════════════════════════════════════════════════════════════════
const EditTab = ({ editForm, setEditForm, saving, handleSaveEdit }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ic n="info" size={12} color={C.primary} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vehicle Identity</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>Vehicle Name</label><input style={inp} value={editForm.vehicleName || ''} onChange={e => setEditForm({ ...editForm, vehicleName: e.target.value })} /></div>
        <div><label style={lbl}>Registration Number</label><input style={{ ...inp, textTransform: 'uppercase', fontFamily: 'monospace' }} value={editForm.vehicleNumber || ''} onChange={e => setEditForm({ ...editForm, vehicleNumber: e.target.value })} /></div>
        <div><label style={lbl}>Chassis Number</label><input style={inp} value={editForm.chasisNumber || ''} onChange={e => setEditForm({ ...editForm, chasisNumber: e.target.value })} /></div>
        <div><label style={lbl}>Engine Number</label><input style={inp} value={editForm.engineNumber || ''} onChange={e => setEditForm({ ...editForm, engineNumber: e.target.value })} /></div>
        <div><label style={lbl}>Status</label><select style={inp} value={editForm.status || 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        <div>
          <label style={lbl}>Vehicle Icon</label>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {VEHICLE_ICONS.map(ic => (
              <button key={ic} onClick={() => setEditForm({ ...editForm, vehicleIcon: ic })}
                style={{ width: 38, height: 38, borderRadius: 8, border: `2px solid ${editForm.vehicleIcon === ic ? C.primary : C.border}`, background: editForm.vehicleIcon === ic ? C.primaryBg : C.white, fontSize: 18, cursor: 'pointer' }}>
                {VEHICLE_ICON_MAP[ic]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ic n="cpu" size={12} color={C.primary} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GPS Device</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>IMEI</label><input style={{ ...inp, fontFamily: 'monospace' }} value={editForm.imei || ''} onChange={e => setEditForm({ ...editForm, imei: e.target.value })} /></div>
        <div><label style={lbl}>Device Name</label><input style={inp} value={editForm.deviceName || ''} onChange={e => setEditForm({ ...editForm, deviceName: e.target.value })} /></div>
        <div><label style={lbl}>Device Type</label><select style={inp} value={editForm.deviceType || ''} onChange={e => setEditForm({ ...editForm, deviceType: e.target.value })}><option value="">Select…</option>{DEVICE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <div><label style={lbl}>Server IP</label><input style={{ ...inp, fontFamily: 'monospace' }} value={editForm.serverIp || ''} onChange={e => setEditForm({ ...editForm, serverIp: e.target.value })} placeholder="192.168.1.1" /></div>
          <div><label style={lbl}>Port</label><input style={{ ...inp, fontFamily: 'monospace' }} type="number" value={editForm.serverPort || ''} onChange={e => setEditForm({ ...editForm, serverPort: e.target.value })} placeholder="5001" /></div>
        </div>
      </div>
    </div>

    <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ic n="gear" size={12} color={C.primary} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Thresholds</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={lbl}>Idle Threshold (minutes)</label>
          <input style={inp} type="number" min={1} max={60} value={editForm.idleThreshold || 5} onChange={e => setEditForm({ ...editForm, idleThreshold: Number(e.target.value) })} />
        </div>
        <div>
          <label style={lbl}>Fuel Fill Threshold (%)</label>
          <input style={inp} type="number" min={1} max={50} value={editForm.fuelFillThreshold || 5} onChange={e => setEditForm({ ...editForm, fuelFillThreshold: Number(e.target.value) })} />
        </div>
      </div>
    </div>

    <button onClick={handleSaveEdit} disabled={saving}
      style={{ ...btn(C.primary, saving), justifyContent: 'center', padding: '11px', width: '100%', borderRadius: 10, fontSize: 14 }}>
      <Ic n="save" size={14} /> {saving ? 'Saving…' : 'Save Changes'}
    </button>
  </div>
);

export default MyFleet;

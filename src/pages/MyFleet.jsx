import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.Default.css';
import L from 'leaflet';
import {
  getVehicles, deleteVehicle, updateVehicle, syncVehicleData,
  getVehicleSensors, createVehicleSensor, updateVehicleSensor, deleteVehicleSensor,
  getVehicleReportSummary, getVehicleReportDaily, getVehicleReportEngineHours,
  getVehicleReportTrips, getVehicleReportFuelFillings, getVehicleReportFuel, exportVehicleReportExcel,
  downloadRawPacketsExcel, reprocessVehicleData,
  getCustomFields, createCustomField, updateCustomField, deleteCustomField,
} from '../services/vehicle.service';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getClientTree } from '../services/user.service';
import { getVehicleState } from '../utils/vehicleState';
import {
  pushPosition, clearBuffers, getInterpolated, isMoving, getLatest,
  DISPLAY_LAG_MS,
} from '../utils/positionBuffer';
import { getDeviceConfigs, getSystemSettings } from '../services/master.service';
import { getGroups, createGroup, updateGroup, deleteGroup, addVehicleToGroup, removeVehicleFromGroup } from '../services/group.service';
import { createTripShare, createLiveShare } from '../services/share.service';
import LocationPlayer from '../components/common/LocationPlayer';
import BottomSheet from '../components/common/BottomSheet';
import { getISTToday, getISTDaysAgo, getISTNow, getISTDaysAgoDatetime } from '../utils/dateFormat';

// ─── Constants ────────────────────────────────────────────────────────────────
const INDIA_CENTER = [22.9734, 78.6569];
const VEHICLE_ICON_MAP = {
  car: '🚗', suv: '🚙', truck: '🚛', bus: '🚌', bike: '🏍️', auto: '🛺',
  van: '🚐', ambulance: '🚑', pickup: '🛻', motorcycle: '🏍️', minibus: '🚌',
  schoolbus: '🚍', tractor: '🚜', crane: '🏗️', jcb: '🏗️',
  dumper: '🚚', earthmover: '🚜', tanker: '⛽', container: '🚛',
  fire: '🚒', police: '🚔', sweeper: '🚛', tipper: '🚚',
  // Construction / specialty equipment — emoji coverage is thin so many
  // share a best-fit emoji and rely on the text label for differentiation.
  excavator: '🚜', mixer: '🛻', concretepump: '🏗️', paver: '🛣️',
  fury: '🚚', ajax: '🛻', roadroller: '🚧', wheelloader: '🚜',
  watertanker: '💧', garbagevan: '🗑️', mortuaryvan: '⚰️',
};
const REPORT_PAGE_SIZE = 20;
const GROUP_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const DEVICE_TYPES = ['GT06', 'GT06N', 'FMB125', 'FMB130', 'FMB920', 'FMB140', 'AIS140', 'WeTrack2', 'TK103'];
const VEHICLE_ICONS = [
  'car','suv','truck','bus','bike','auto','van','ambulance',
  'pickup','minibus','schoolbus','tractor','crane','jcb',
  'dumper','earthmover','tanker','container','fire','police','sweeper','tipper',
  'excavator','mixer','concretepump','paver','fury','ajax','roadroller',
  'wheelloader','watertanker','garbagevan','mortuaryvan',
];
const VEHICLE_ICON_LABELS = {
  car: 'Car', suv: 'SUV', truck: 'Truck', bus: 'Bus', bike: 'Bike', auto: 'Auto',
  van: 'Van', ambulance: 'Ambulance', pickup: 'Pickup', motorcycle: 'Motorcycle',
  minibus: 'Minibus', schoolbus: 'School Bus', tractor: 'Tractor', crane: 'Crane',
  jcb: 'JCB', dumper: 'Dumper', earthmover: 'Earth Mover', tanker: 'Tanker',
  container: 'Container', fire: 'Fire', police: 'Police', sweeper: 'Sweeper',
  tipper: 'Tipper', excavator: 'Excavator', mixer: 'Transit Mixer',
  concretepump: 'Concrete Pump', paver: 'Paver', fury: 'Fury', ajax: 'Ajax',
  roadroller: 'Road Roller', wheelloader: 'Wheel Loader',
  watertanker: 'Water Tanker', garbagevan: 'Garbage Van', mortuaryvan: 'Mortuary Van',
};
const SENSOR_TYPES = ['number', 'boolean', 'text'];
// Map-view sidebar width. Was 260; doubled to give the vehicle list room
// to display name + reg + status + metrics legibly without truncation.
const PANEL_W = 540;
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
  .fv-stop {}
  .fv-sel { animation: none !important; box-shadow: 0 0 0 3px #fff, 0 0 0 5px #2563eb, 0 6px 24px rgba(37,99,235,0.45) !important; transform: scale(1.18) !important; transform-origin: center bottom !important; }
  .fv-tooltip.leaflet-tooltip { padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; border-radius: 10px !important; pointer-events: auto !important; }
  .fv-tooltip.leaflet-tooltip::before { display: none !important; }
  .fv-tooltip > div { border-radius: 10px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06); }
  @keyframes fv-pulse-g {
    0%   { box-shadow: 0 0 0 0 rgba(22,163,74,0.7), 0 2px 8px rgba(0,0,0,0.4); }
    65%  { box-shadow: 0 0 0 9px rgba(22,163,74,0), 0 2px 8px rgba(0,0,0,0.4); }
    100% { box-shadow: 0 0 0 0 rgba(22,163,74,0), 0 2px 8px rgba(0,0,0,0.4); }
  }
  /* Vehicle card in sidebar — modern feel: soft elevation on rest, lift on hover */
  .fv-card {
    transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.02);
  }
  .fv-card:hover {
    background: #F8FAFC !important;
    border-color: #94A3B8 !important;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04) !important;
    transform: translateY(-1px);
  }
  /* Modern button hover for top HUD */
  .fv-hud-btn { transition: background 0.15s, color 0.15s, box-shadow 0.15s; }
  .fv-hud-btn:hover { background: #F1F5F9 !important; color: #0F172A !important; }
  /* Sidebar inner-glow at top of cards list */
  .fv-sidebar-shade {
    background: linear-gradient(to bottom, rgba(15,23,42,0.04), transparent);
    height: 8px; flex-shrink: 0;
  }
  /* Tab buttons */
  .fv-tab-btn { transition: color 0.15s, background 0.15s; }
  .fv-tab-btn:hover { background: #EFF6FF !important; color: #2563EB !important; }
  /* Action buttons in detail panel */
  .fv-action-btn { transition: filter 0.12s, box-shadow 0.12s; }
  .fv-action-btn:hover { filter: brightness(0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important; }
  /* Group pill filter */
  .fv-grp-pill { transition: all 0.15s; }
  .fv-grp-pill:hover { background: #EFF6FF !important; border-color: #93C5FD !important; color: #2563EB !important; }
  /* Table view cells */
  .ft-cell { transition: background 0.1s; border-right: 1px solid #F1F5F9; }
  .ft-cell:last-child { border-right: none; }
  .ft-cell:hover { background: #EFF6FF !important; }
  /* Metric card in detail header */
  .fv-metric:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
  .fv-metric { transition: transform 0.15s, box-shadow 0.15s; }
  /* Form field — themed, smooth focus, hover accent */
  .fv-input {
    width: 100%; box-sizing: border-box;
    padding: 11px 14px; border: 1px solid #CBD5E1; border-radius: 0;
    font-size: 14px; font-weight: 500; outline: none; font-family: inherit;
    background: #FFFFFF; color: #0F172A;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .fv-input::placeholder { color: #94A3B8; font-weight: 400; }
  .fv-input:hover { border-color: #94A3B8; }
  .fv-input:focus {
    border-color: #2563EB;
    box-shadow: inset 0 0 0 1px #2563EB, 0 0 0 3px rgba(37,99,235,0.15);
  }
  .fv-input:disabled, .fv-input[readonly] { background: #F8FAFC; color: #64748B; cursor: not-allowed; }
  .fv-input.fv-mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 0.04em; }
  /* Field label */
  .fv-label {
    display: block; font-size: 11.5px; font-weight: 800; color: #475569;
    margin-bottom: 7px; text-transform: uppercase; letter-spacing: 0.07em;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Flatten client tree for the client picker (mirrors AddVehicle / MyClients logic)
const flattenTree = (nodes, depth = 0, parentPath = []) => {
  const out = [];
  for (const n of (nodes || [])) {
    const path = [...parentPath, n.name];
    out.push({ ...n, depth, path });
    if (n.children?.length) out.push(...flattenTree(n.children, depth + 1, path));
  }
  return out;
};

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

const getIgnition  = (v) => v.deviceStatus?.status?.ignition ?? null;
const getSpeed     = (v) => Number(v.deviceStatus?.gpsData?.speed || v.deviceStatus?.gpsData?.spd || 0);

// Evaluates vehicle state via DB-defined conditions; falls back to ignition-based logic
const getVState = (v, statesMap) => {
  const states = statesMap?.[v.deviceType?.toUpperCase()];
  if (states?.length) {
    const result = getVehicleState(v.deviceStatus, states);
    if (result) return result;
  }
  const ign = getIgnition(v);
  if (ign === true)  return { stateName: 'Running',  stateColor: '#059669', stateIcon: '🟢' };
  if (ign === false) return { stateName: 'Stopped',  stateColor: '#ef4444', stateIcon: '🔴' };
  return { stateName: 'Unknown', stateColor: '#94a3b8', stateIcon: '' };
};
const vehicleDisplayName = (v) => v.vehicleName || v.vehicleNumber || `Vehicle #${v.id}`;

// ─── Configurable fleet stat chips ───────────────────────────────────────────
const ALL_FLEET_CHIPS = [
  { id: 'total',     label: 'Total',         dot: '#64748b', gradient: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)', shadow: '0 4px 14px rgba(37,99,235,0.28)',  icon: '🚗' },
  { id: 'running',   label: 'Running',        dot: '#22c55e', gradient: 'linear-gradient(135deg, #047857 0%, #10B981 100%)', shadow: '0 4px 14px rgba(5,150,105,0.28)',   icon: '🟢' },
  { id: 'stopped',   label: 'Stopped',        dot: '#ef4444', gradient: 'linear-gradient(135deg, #B91C1C 0%, #EF4444 100%)', shadow: '0 4px 14px rgba(220,38,38,0.28)',   icon: '🔴' },
  { id: 'no_gps',    label: 'No GPS',         dot: '#f59e0b', gradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)', shadow: '0 4px 14px rgba(217,119,6,0.28)',   icon: '📡' },
  { id: 'idle',      label: 'Idle',           dot: '#8b5cf6', gradient: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)', shadow: '0 4px 14px rgba(109,40,217,0.28)',  icon: '⏸️' },
  { id: 'overspeed', label: 'Overspeed',      dot: '#dc2626', gradient: 'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)', shadow: '0 4px 14px rgba(153,27,27,0.28)',   icon: '🏎️' },
];
const DEFAULT_FLEET_CHIPS = ['total', 'running', 'stopped', 'no_gps'];

function getVisibleFleetChips() {
  try {
    const saved = localStorage.getItem('myfleet-visible-chips');
    return saved ? JSON.parse(saved) : DEFAULT_FLEET_CHIPS;
  } catch { return DEFAULT_FLEET_CHIPS; }
}

// ─── Map tile URL from saved preference ──────────────────────────────────────
const MAP_TILES = {
  roadmap:   'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  light:     'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  osm:       'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  terrain:   'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  hybrid:    'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
};
// Migrate old 'voyager' preference to 'roadmap'
const getMapTileUrl = () => {
  let style = localStorage.getItem('mapStyle') || 'roadmap';
  if (style === 'voyager') { style = 'roadmap'; localStorage.setItem('mapStyle', 'roadmap'); }
  return MAP_TILES[style] || MAP_TILES.roadmap;
};
const getMapSubdomains = () => {
  const style = localStorage.getItem('mapStyle') || 'roadmap';
  return ['roadmap', 'terrain', 'satellite', 'hybrid'].includes(style) ? '0123' : 'abcd';
};

// ─── Map Marker Icon ──────────────────────────────────────────────────────────
// Accepts an optional stateColor so it can reflect DB-defined vehicle states
const makeVehicleIcon = (vehicle, isSelected, stateColor) => {
  const ign   = getIgnition(vehicle);
  const bg    = stateColor || (ign === true ? '#16a34a' : ign === false ? '#dc2626' : '#475569');
  const cls   = isSelected ? 'fv-sel' : ign === true ? 'fv-run' : 'fv-stop';
  const emoji = VEHICLE_ICON_MAP[vehicle.vehicleIcon] || '🚗';
  const size  = isSelected ? 46 : 38;
  const fs    = isSelected ? 24 : 20;
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div class="${cls}" style="width:${size}px;height:${size}px;background:${bg};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${fs}px;border:2.5px solid #fff;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.28),0 1px 3px rgba(0,0,0,0.18);">
        ${emoji}
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${bg};margin-top:-1px;"></div>
    </div>`,
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
  });
};

// ─── Cluster Icon ────────────────────────────────────────────────────────────
const createClusterCustomIcon = (cluster) => {
  const count = cluster.getChildCount();
  const size  = count < 10 ? 40 : count < 50 ? 46 : 52;
  const fs    = count < 10 ? 15 : count < 50 ? 13 : 11;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:linear-gradient(135deg,#1D4ED8,#3B82F6);
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:800;font-size:${fs}px;
      border:3px solid #fff;
      box-shadow:0 4px 14px rgba(37,99,235,0.45),0 2px 4px rgba(0,0,0,0.15);
      font-family:'Plus Jakarta Sans',sans-serif;
      letter-spacing:-0.5px;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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
    share:    <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
    copy:     <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>,
    users:    <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
    link:     <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
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

// ─── MapController — flies to a position once (on vehicle click) ─────────────
const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 15, { duration: 1 }); }, [center, map]);
  return null;
};

// ─── SmoothMotionController — RAF-driven marker animation + edge auto-pan ────
// Walks the registered marker refs every animation frame, computes each
// vehicle's interpolated position from the buffer (displayTime = now - lag),
// and calls marker.setLatLng() directly. This bypasses React re-rendering for
// the position update — only icon/tooltip changes still go through React.
//
// For the currently-selected vehicle, also re-centres the map when the marker
// drifts within 20 % of any edge — debounced to once per 600 ms so user pan
// gestures aren't constantly fighting auto-pan.
const SmoothMotionController = ({ markerRefs, selectedId }) => {
  const map = useMap();

  useEffect(() => {
    let rafId;
    let lastPanAt = 0;
    // Below this zoom MarkerClusterGroup hides individual markers (clustering
    // is disabled at zoom 14 in our setup), so animating positions is just CPU
    // overhead that nobody can see — and worse, it churns cluster layout.
    const ANIMATE_AT_ZOOM = 14;

    const tick = () => {
      // Cheap zoom check on every frame — getZoom() is a property read.
      if (map.getZoom() < ANIMATE_AT_ZOOM) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const displayTime = Date.now() - DISPLAY_LAG_MS;

      markerRefs.current.forEach((markerRef, vehicleId) => {
        const m = markerRef?.current;
        if (!m) return;

        let pos;
        if (isMoving(vehicleId)) {
          pos = getInterpolated(vehicleId, displayTime);
        } else {
          // Stationary vehicles: snap to latest, no animation. Skip if the
          // marker is already at the latest position (avoids redundant
          // setLatLng → cluster-layout work for hundreds of parked cars).
          const latest = getLatest(vehicleId);
          if (!latest) return;
          const cur = m.getLatLng();
          if (Math.abs(cur.lat - latest.lat) < 1e-7 && Math.abs(cur.lng - latest.lng) < 1e-7) return;
          pos = { lat: latest.lat, lng: latest.lng };
        }
        if (!pos) return;

        m.setLatLng([pos.lat, pos.lng]);

        // Selected-vehicle edge auto-pan
        if (selectedId && vehicleId === selectedId) {
          const now = performance.now();
          if (now - lastPanAt > 600) {
            const latlng = L.latLng(pos.lat, pos.lng);
            const b   = map.getBounds();
            const ne  = b.getNorthEast();
            const sw  = b.getSouthWest();
            const pad = 0.2;
            const inner = L.latLngBounds(
              [sw.lat + (ne.lat - sw.lat) * pad, sw.lng + (ne.lng - sw.lng) * pad],
              [ne.lat - (ne.lat - sw.lat) * pad, ne.lng - (ne.lng - sw.lng) * pad],
            );
            if (!inner.contains(latlng)) {
              map.panTo(latlng, { animate: true, duration: 0.5 });
              lastPanAt = now;
            }
          }
        }
      });

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [map, selectedId, markerRefs]);

  return null;
};

// ─── FocusBoundsController — fits the map to a set of pinned vehicles ────────
// Fires once when `bounds` reference changes. Ignored when only 0–1 vehicles
// are pinned (single-vehicle tracking is handled by SmoothMotionController).
const FocusBoundsController = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (!bounds || bounds.length < 2) return;
    const b = L.latLngBounds(bounds);
    map.fitBounds(b, { padding: [48, 48], maxZoom: 15, animate: true });
  }, [bounds, map]);
  return null;
};

// ─── SmoothMarker — registers its Leaflet marker ref into a shared map so
// SmoothMotionController can drive position updates via setLatLng() at 60 Hz.
//
// We capture the initial position into a ref (`initialPos`) and pass it
// unchanged for the marker's lifetime. The live poll keeps updating
// vehicles[].deviceStatus.gpsData (which the sidebar / cards read), so the
// `position` prop changes on every poll — but if we forwarded that to the
// underlying Leaflet Marker, React-Leaflet would call setLatLng() and snap
// the marker to "now", undoing RAF's smoother lagged-interpolated position.
// Passing the stable initial value keeps RAF as the sole driver of motion.
//
// The marker key includes selection + state, so when those flip, this
// component unmounts and a fresh one captures a new initialPos — RAF picks
// up from there within one frame.
const SmoothMarker = ({ vehicleId, markerRefs, position, icon, eventHandlers, children }) => {
  const initialPos = useRef(position);
  const markerRef = useRef(null);

  // Register / unregister this marker so the RAF controller can find it.
  useEffect(() => {
    if (!markerRefs || vehicleId == null) return;
    markerRefs.current.set(vehicleId, markerRef);
    return () => { markerRefs.current.delete(vehicleId); };
  }, [vehicleId, markerRefs]);

  return (
    <Marker ref={markerRef} position={initialPos.current} icon={icon} eventHandlers={eventHandlers}>
      {children}
    </Marker>
  );
};

// ─── MapResizer: invalidates map size so tiles load after container renders ───
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    // Immediate invalidate for initial render
    setTimeout(() => map.invalidateSize(), 0);
    // ResizeObserver handles sidebar toggle / window resize
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
};

// ─── Vehicle Hover Tooltip ────────────────────────────────────────────────────
const VehicleTooltip = ({ vehicle }) => {
  const ign    = getIgnition(vehicle);
  const gps    = vehicle.deviceStatus?.gpsData;
  const fuel   = vehicle.deviceStatus?.fuel;
  const status = vehicle.deviceStatus?.status;
  const engine = vehicle.deviceStatus?.engine;
  const trip   = vehicle.deviceStatus?.trip;
  const coords = getVehicleCoords(vehicle);

  const ignColor = ign === true ? '#059669' : ign === false ? '#DC2626' : '#94A3B8';
  const ignBg    = ign === true ? '#D1FAE5' : ign === false ? '#FEF2F2' : '#F1F5F9';
  const ignLabel = ign === true ? 'Engine Running' : ign === false ? 'Engine Off' : 'Unknown';

  const TRow = ({ label, value, valueColor }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: valueColor || '#0F172A' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif", width: 240, padding: 0 }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', borderRadius: '8px 8px 0 0', padding: '12px 14px', borderBottom: `3px solid ${ignColor}`, marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: ignBg, border: `1.5px solid ${ignColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {VEHICLE_ICON_MAP[vehicle.vehicleIcon] || '🚗'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicleDisplayName(vehicle)}</div>
            {vehicle.vehicleName && vehicle.vehicleNumber && (
              <div style={{ fontSize: 10.5, color: '#64748B', fontFamily: 'monospace', marginTop: 2 }}>{vehicle.vehicleNumber}</div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: ignBg, borderRadius: 20, padding: '3px 10px', border: `1px solid ${ignColor}30` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ignColor, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: ignColor }}>{ignLabel}</span>
        </div>
      </div>

      {/* Data rows */}
      <div style={{ padding: '8px 14px', background: '#FFFFFF' }}>
        {gps?.speed !== undefined && <TRow label="Speed" value={`${gps.speed} km/h`} valueColor={gps.speed > 80 ? '#DC2626' : '#0F172A'} />}
        {fuel?.level !== undefined && <TRow label="Fuel" value={`${Math.round(fuel.level)}%`} valueColor={fuel.level < 20 ? '#DC2626' : fuel.level < 40 ? '#D97706' : '#059669'} />}
        {status?.battery !== undefined && <TRow label="Battery" value={`${status.battery}%`} valueColor={status.battery < 20 ? '#DC2626' : '#0F172A'} />}
        {status?.voltage !== undefined && <TRow label="Voltage" value={`${status.voltage} V`} />}
        {gps?.satellites !== undefined && <TRow label="Satellites" value={gps.satellites} valueColor={gps.satellites < 4 ? '#D97706' : '#059669'} />}
        {status?.gsmSignal !== undefined && <TRow label="GSM Signal" value={status.gsmSignal} />}
        {trip?.odometer !== undefined && <TRow label="Odometer" value={`${Number(trip.odometer).toFixed(1)} km`} />}
        {engine?.speed !== undefined && <TRow label="RPM" value={engine.speed} />}
      </div>

      {/* Footer */}
      {(coords || vehicle.deviceType || gps?.timestamp) && (
        <div style={{ padding: '8px 14px', background: '#F8FAFC', borderRadius: '0 0 8px 8px', borderTop: '1px solid #E2E8F0' }}>
          {coords && <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginBottom: 2 }}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>}
          {vehicle.deviceType && <div style={{ fontSize: 10, color: '#94A3B8' }}>{vehicle.deviceType}{vehicle.imei ? ` · ${vehicle.imei}` : ''}</div>}
          {gps?.timestamp && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Updated: {new Date(gps.timestamp).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'short' })}</div>}
        </div>
      )}
    </div>
  );
};

// ─── Column Definitions ───────────────────────────────────────────────────────
const COL_DEFS = {
  vehicle:    { label: 'Vehicle',     icon: 'map',      ic: '#3b82f6' },
  regNo:      { label: 'Vehicle No.', icon: 'info',     ic: '#64748b' },
  imei:       { label: 'IMEI',        icon: 'cpu',      ic: '#7c3aed' },
  status:     { label: 'Status',      icon: 'activity', ic: '#16a34a' },
  speed:      { label: 'Speed',       icon: 'chart',    ic: '#2563eb' },
  fuel:       { label: 'Fuel',        icon: 'droplet',  ic: '#0891b2' },
  battery:    { label: 'Battery',     icon: 'battery',  ic: '#059669' },
  voltage:    { label: 'Voltage',     icon: 'zap',      ic: '#d97706' },
  gsm:        { label: 'GSM Signal',  icon: 'radio',    ic: '#0891b2' },
  satellites: { label: 'Satellites',  icon: 'radio',    ic: '#4f46e5' },
  odometer:   { label: 'Odometer',    icon: 'route',    ic: '#059669' },
  gps:        { label: 'GPS',         icon: 'pin',      ic: '#ef4444' },
  lastUpdate: { label: 'Last Update', icon: 'clock',    ic: '#475569' },
  actions:    { label: 'Actions',     icon: 'gear',     ic: '#6b7280' },
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

  const [deviceStatesByType, setDeviceStatesByType] = useState({});

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [trackedVehicleId, setTrackedVehicleId] = useState(null);
  const [trackedPosition, setTrackedPosition] = useState(null);
  // Multi-select: vehicles the user has pinned to track simultaneously on the
  // map. When ≥2 are pinned, FocusBoundsController fits the map to all of them.
  const [focusedIds, setFocusedIds] = useState(() => new Set());

  // Refs to every Leaflet marker on the map, keyed by vehicleId. Populated by
  // SmoothMarker on mount and consumed by SmoothMotionController's RAF loop
  // to drive position updates without re-rendering React.
  const markerRefs = useRef(new Map());

  // Bottom-sheet peek state for the vehicle-detail panel on the map view.
  // 'half' on first selection — covers half the screen, plenty of room for tabs.
  const [detailSheetPeek, setDetailSheetPeek] = useState('half');
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(new Set(['Running', 'Stopped', 'Unknown']));
  const [chipFilter, setChipFilter] = useState(null); // null = all, or chip id string
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [colOrder, setColOrder] = useState(['vehicle','regNo','imei','status','speed','fuel','battery','voltage','gsm','satellites','odometer','gps','lastUpdate','actions']);
  const [visibleChips, setVisibleChips] = useState(getVisibleFleetChips);
  const [visibleCols, setVisibleCols] = useState(new Set(['vehicle','regNo','imei','status','speed','fuel','battery','voltage','gsm','satellites','odometer','gps','lastUpdate','actions']));
  const [dragSrcCol, setDragSrcCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [sensors, setSensors] = useState([]);
  const [loadingSensors, setLoadingSensors] = useState(false);
  const [sensorForm, setSensorForm] = useState({ name: '', type: 'number', unit: '', mappedParameter: '', description: '', visible: true });
  const [editingSensor, setEditingSensor] = useState(null);
  const [showSensorForm, setShowSensorForm] = useState(false);
  const [savingSensor, setSavingSensor] = useState(false);

  // Custom fields state
  const [customFields, setCustomFields] = useState([]);
  const [loadingCustomFields, setLoadingCustomFields] = useState(false);
  const [cfForm, setCfForm] = useState({ fieldName: '', fieldValue: '' });
  const [showCfForm, setShowCfForm] = useState(false);
  const [editingCf, setEditingCf] = useState(null);
  const [savingCf, setSavingCf] = useState(false);

  const [reportTab, setReportTab] = useState('summary');
  const [reportFrom, setReportFrom] = useState(getISTDaysAgoDatetime(7));
  const [reportTo, setReportTo] = useState(getISTNow());
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPage, setReportPage] = useState(0);
  const [reportExporting, setReportExporting] = useState(false);
  const [packetsDownloading, setPacketsDownloading] = useState(false);
  const [viewMode, setViewMode] = useState('map');

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerVehicle, setPlayerVehicle] = useState(null);
  const [playerFrom, setPlayerFrom] = useState(null);
  const [playerTo, setPlayerTo] = useState(null);

  const [mapCenter, setMapCenter] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { vehicleId, vehicleName, phrase }
  const [deleteTyped, setDeleteTyped] = useState('');
  const [imeiEditConfirm, setImeiEditConfirm] = useState(null); // { vehicleId, newImei, oldImei, phrase }
  const [imeiTyped, setImeiTyped] = useState('');
  const [savingImei, setSavingImei] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [drawerVehicle, setDrawerVehicle] = useState(null);
  const [drawerEditForm, setDrawerEditForm] = useState({});
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview');

  // Increments every 30 s to force state re-evaluation (lastSeenSeconds) even when
  // no live-position poll updates arrive (e.g. all vehicles offline).
  const [stateTick, setStateTick] = useState(0);

  // ── Auth + client picker (papa/dealer only) ──────────────────────────────
  const { user } = useAuth();
  const isPapaOrDealer = user?.role === 'papa' || Number(user?.parentId) === 0 || user?.role === 'dealer' || user?.permissions?.canAddClient === true;
  const [viewClientId, setViewClientId] = useState(null);   // null = own fleet
  const [clientNodes, setClientNodes] = useState([]);        // flattened tree
  const [cpOpen, setCpOpen] = useState(false);
  const [cpSearch, setCpSearch] = useState('');
  const cpRef = useRef(null);

  // ── Platform feature flag ────────────────────────────────────────────────
  const [liveShareEnabled, setLiveShareEnabled] = useState(false);

  // ── Live share modal ─────────────────────────────────────────────────────
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);      // {type, id, name, icon}
  const [shareExpiryMode, setShareExpiryMode] = useState('hours');  // 'hours' | 'custom'
  const [shareHours, setShareHours] = useState('24');
  const [shareCustomTime, setShareCustomTime] = useState('');
  const [sharingLive, setSharingLive] = useState(false);
  const [liveShareResult, setLiveShareResult] = useState(null);

  // ── Load platform feature flags on mount ────────────────────────────────
  useEffect(() => {
    getSystemSettings()
      .then(res => setLiveShareEnabled(Boolean(res.data?.liveShareEnabled)))
      .catch(() => {/* silently ignore — share buttons stay hidden */});
  }, []);

  // inject CSS animations
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'fleet-hud-css';
    el.textContent = HUD_CSS;
    document.head.appendChild(el);
    return () => document.getElementById('fleet-hud-css')?.remove();
  }, []);

  // 30-second tick so lastSeenSeconds re-evaluates even when poll returns nothing
  useEffect(() => {
    const id = setInterval(() => setStateTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Re-read chip visibility when settings change
  useEffect(() => {
    const refresh = () => setVisibleChips(getVisibleFleetChips());
    window.addEventListener('focus', refresh);
    window.addEventListener('fleet-chips-updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('fleet-chips-updated', refresh);
    };
  }, []);

  // ─── Fetching ───────────────────────────────────────────────────────────────
  const fetchVehicles = () => {
    setLoading(true);
    getVehicles(viewClientId || undefined).then(r => setVehicles(r.data || [])).catch(console.error).finally(() => setLoading(false));
  };
  const fetchGroups = () => {
    getGroups().then(r => setGroups(r.data || [])).catch(() => {});
  };

  // Load vehicles, device state configs, and groups. Use allSettled so that a
  // permission error on device-configs (non-papa users) never blanks the vehicle list.
  // Re-runs when viewClientId changes so switching client reloads the fleet.
  useEffect(() => {
    setLoading(true);
    // Reset the smooth-motion buffers so we don't keep interpolating with the
    // previous client's stale samples after a fleet switch.
    clearBuffers();
    Promise.allSettled([getVehicles(viewClientId || undefined), getDeviceConfigs(), getGroups()])
      .then(([vResult, cResult, gResult]) => {
        const m = {};
        if (cResult.status === 'fulfilled') {
          (cResult.value.data || []).forEach(d => { if (d.states?.length) m[d.type] = d.states; });
        }
        setDeviceStatesByType(m);
        setVehicles(vResult.status === 'fulfilled' ? (vResult.value.data || []) : []);
        setGroups(gResult.status === 'fulfilled' ? (gResult.value.data || []) : []);
        if (vResult.status === 'rejected') console.error('Failed to load vehicles:', vResult.reason);
      })
      .finally(() => setLoading(false));
  }, [viewClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Live-position auto-refresh (5 s, differential, pauses when tab hidden) ──
  // Restarts when viewClientId changes so the poll tracks the right fleet.
  useEffect(() => {
    // Track the latest packet time we've seen so the server only returns changed vehicles
    let lastSince = null;
    const effectClientId = viewClientId; // captured at effect-run time

    const poll = async () => {
      // Skip when tab is not visible — saves requests, battery, CPU
      if (document.visibilityState === 'hidden') return;
      try {
        const params = [];
        if (effectClientId) params.push(`clientId=${effectClientId}`);
        if (lastSince) params.push(`since=${encodeURIComponent(lastSince)}`);
        const url = `/vehicles/live-positions${params.length ? '?' + params.join('&') : ''}`;
        const res = await api.get(url);
        const positions = Array.isArray(res.data) ? res.data : [];
        // Empty means nothing changed since last poll — skip re-render entirely
        if (!positions.length) return;

        // Advance the cursor to the max packet time in this batch
        const maxTime = positions.reduce((m, p) => {
          if (!p.lastPacketTime) return m;
          return m === null || new Date(p.lastPacketTime) > new Date(m) ? p.lastPacketTime : m;
        }, lastSince);
        if (maxTime) lastSince = maxTime;

        // Push every position with valid lat/lng into the per-vehicle buffer
        // so the smooth-animation RAF loop has packets to interpolate between.
        positions.forEach(p => {
          if (p.lat != null && p.lng != null) {
            pushPosition(p.id, {
              packetTime: p.lastPacketTime ? new Date(p.lastPacketTime).getTime() : Date.now(),
              lat:   p.lat,
              lng:   p.lng,
              speed: p.speed || 0,
            });
          }
        });

        setVehicles(prev => prev.map(v => {
          const p = positions.find(x => x.id === v.id);
          if (!p) return v; // unchanged — keep existing reference (no re-render for this vehicle)
          return {
            ...v,
            deviceStatus: {
              ...v.deviceStatus,
              status: { ...(v.deviceStatus?.status || {}), ignition: p.engineOn },
              gpsData: {
                ...(v.deviceStatus?.gpsData || {}),
                latitude: p.lat, longitude: p.lng, speed: p.speed, timestamp: p.lastPacketTime,
              },
              lastUpdate: p.lastPacketTime,
            },
          };
        }));
      } catch (_) { /* silently ignore poll errors */ }
    };

    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [viewClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load client tree for picker (papa/dealer only) ───────────────────────
  useEffect(() => {
    if (!isPapaOrDealer) return;
    getClientTree().then(r => setClientNodes(flattenTree(r.data || []))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close client picker on outside click ─────────────────────────────────
  useEffect(() => {
    if (!cpOpen) return;
    const handler = (e) => { if (cpRef.current && !cpRef.current.contains(e.target)) setCpOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cpOpen]);

  // Keep selectedVehicle and drawerVehicle in sync with the live vehicles list.
  // The live poll updates `vehicles` but not these derived states, causing the
  // detail panel to show stale ignition/speed data while the list is already updated.
  useEffect(() => {
    setSelectedVehicle(sel => {
      if (!sel) return sel;
      const latest = vehicles.find(v => v.id === sel.id);
      return latest ?? sel;
    });
    setDrawerVehicle(dv => {
      if (!dv) return dv;
      const latest = vehicles.find(v => v.id === dv.id);
      return latest ?? dv;
    });
  }, [vehicles]); // eslint-disable-line react-hooks/exhaustive-deps

  // SmoothMotionController reads the selected vehicle's interpolated position
  // straight from the buffer; trackedPosition / trackedVehicleId state is kept
  // for reference but no longer needs the per-poll mirror that lived here.

  useEffect(() => {
    if (!selectedVehicle) { setSensors([]); setCustomFields([]); return; }
    setLoadingSensors(true);
    getVehicleSensors(selectedVehicle.id)
      .then(r => setSensors(r.data || []))
      .catch(() => setSensors([]))
      .finally(() => setLoadingSensors(false));
    setLoadingCustomFields(true);
    getCustomFields(selectedVehicle.id)
      .then(r => setCustomFields(r.data?.data || r.data || []))
      .catch(() => setCustomFields([]))
      .finally(() => setLoadingCustomFields(false));
  }, [selectedVehicle?.id]);

  useEffect(() => {
    if (!selectedVehicle || activeTab !== 'reports') return;
    fetchReport(selectedVehicle.id, reportTab, reportFrom, reportTo, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id, activeTab, reportTab, reportFrom, reportTo]);

  useEffect(() => {
    if (!selectedVehicle || activeTab !== 'trips') return;
    fetchReport(selectedVehicle.id, 'trips', reportFrom, reportTo, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id, activeTab, reportFrom, reportTo]);

  // Close dropdowns on outside click
  useEffect(() => {
    const close = () => { setShowStatusDrop(false); setShowColPicker(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

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
      else if (tab === 'fuel')         res = await getVehicleReportFuel(vehicleId, from, to);
      setReportData(res?.data?.data ?? res?.data);
    } catch { toast.error('Failed to load report'); }
    finally { setReportLoading(false); }
  };

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleSync = async (v, silent = false) => {
    setSyncing(true); setSyncingId(v.id);
    try {
      const r = await syncVehicleData(v.id);
      const u = r.data;
      setVehicles(p => p.map(x => x.id === u.id ? u : x));
      if (selectedVehicle?.id === u.id) setSelectedVehicle(u);
      if (!silent) toast.success('Synced!');
    } catch (e) {
      if (!silent) toast.error('Sync failed: ' + (e.message || 'error'));
    } finally { setSyncing(false); setSyncingId(null); }
  };

  // Auto-sync comprehensive status (battery, voltage, fuel, satellites) when the right
  // detail panel opens for a new vehicle — eliminates the need to click Sync manually.
  const prevSyncedVehicleId = useRef(null);
  useEffect(() => {
    if (!selectedVehicle) return;
    if (prevSyncedVehicleId.current === selectedVehicle.id) return;
    prevSyncedVehicleId.current = selectedVehicle.id;
    handleSync(selectedVehicle, true); // silent — no toast spam on every click
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id]);

  const CONFIRM_WORDS = ['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india','juliet','kilo','lima','mike','november','oscar','papa','quebec','romeo','sierra','tango'];
  const handleDelete = (id) => {
    const v = vehicles.find(x => x.id === id);
    const w1 = CONFIRM_WORDS[Math.floor(Math.random() * CONFIRM_WORDS.length)];
    const w2 = CONFIRM_WORDS[Math.floor(Math.random() * CONFIRM_WORDS.length)];
    setDeleteConfirm({ vehicleId: id, vehicleName: vehicleDisplayName(v || { id }), phrase: `${w1}-${w2}` });
    setDeleteTyped('');
  };
  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteVehicle(deleteConfirm.vehicleId);
      toast.success('Vehicle removed');
      if (selectedVehicle?.id === deleteConfirm.vehicleId) setSelectedVehicle(null);
      setDeleteConfirm(null);
      fetchVehicles();
    } catch (e) { toast.error(e.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const selectVehicle = (v) => {
    setSelectedVehicle(v);
    setTrackedVehicleId(v.id);
    setActiveTab('overview');
    setReportData(null);
    const coords = getVehicleCoords(v);
    if (coords) setMapCenter([coords.lat, coords.lng]);
    setEditForm({
      vehicleNumber: v.vehicleNumber || '', vehicleName: v.vehicleName || '',
      chasisNumber: v.chasisNumber || '', engineNumber: v.engineNumber || '',
      imei: v.imei || '', sim1: v.sim1 || '', sim2: v.sim2 || '',
      deviceName: v.deviceName || '', deviceType: v.deviceType || '',
      serverIp: v.serverIp || '', serverPort: v.serverPort || '',
      vehicleIcon: v.vehicleIcon || 'car', status: v.status || 'active',
      idleThreshold: v.idleThreshold || 5, fuelFillThreshold: v.fuelFillThreshold || 5,
      fuelSupported: !!v.fuelSupported,
      fuelTankCapacity: v.fuelTankCapacity || '',
    });
  };

  const requestImeiEdit = (newImei) => {
    if (!selectedVehicle) return;
    const clean = (newImei || '').trim();
    if (!clean) { toast.error('IMEI cannot be empty'); return; }
    if (clean === (selectedVehicle.imei || '')) { toast.info?.('IMEI unchanged'); return; }
    const w1 = CONFIRM_WORDS[Math.floor(Math.random() * CONFIRM_WORDS.length)];
    const w2 = CONFIRM_WORDS[Math.floor(Math.random() * CONFIRM_WORDS.length)];
    setImeiEditConfirm({
      vehicleId: selectedVehicle.id,
      newImei: clean,
      oldImei: selectedVehicle.imei || '',
      phrase: `${w1}-${w2}`,
    });
    setImeiTyped('');
  };

  const executeImeiEdit = async () => {
    if (!imeiEditConfirm) return;
    setSavingImei(true);
    try {
      const r = await updateVehicle(imeiEditConfirm.vehicleId, { imei: imeiEditConfirm.newImei });
      const u = r.data?.data || r.data;
      setVehicles(p => p.map(x => x.id === u.id ? { ...x, ...u } : x));
      setSelectedVehicle(p => p ? { ...p, ...u } : p);
      setEditForm(f => ({ ...f, imei: u.imei || imeiEditConfirm.newImei }));
      toast.success('IMEI updated');
      setImeiEditConfirm(null);
    } catch (e) { toast.error(e.message || 'IMEI update failed'); }
    finally { setSavingImei(false); }
  };

  const handleSaveEdit = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      // IMEI is edited via a dedicated phrase-confirmation flow — strip from generic save.
      const { imei: _ignoredImei, ...payload } = editForm;
      // Tank capacity: "" from an empty input → null; otherwise coerce to int.
      if (payload.fuelTankCapacity === '' || payload.fuelTankCapacity == null) {
        payload.fuelTankCapacity = null;
      } else {
        payload.fuelTankCapacity = parseInt(payload.fuelTankCapacity, 10) || null;
      }
      if (payload.fuelSupported && !payload.fuelTankCapacity) {
        toast.error('Tank capacity is required when fuel sensor is enabled.');
        setSaving(false);
        return;
      }
      const r = await updateVehicle(selectedVehicle.id, payload);
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

  // Custom field handlers
  const openCfForm = (cf = null) => {
    if (cf) { setEditingCf(cf); setCfForm({ fieldName: cf.fieldName, fieldValue: cf.fieldValue || '' }); }
    else { setEditingCf(null); setCfForm({ fieldName: '', fieldValue: '' }); }
    setShowCfForm(true);
  };
  const handleSaveCf = async () => {
    if (!selectedVehicle || !cfForm.fieldName.trim()) return;
    setSavingCf(true);
    try {
      if (editingCf) await updateCustomField(selectedVehicle.id, editingCf.id, cfForm);
      else await createCustomField(selectedVehicle.id, cfForm);
      const r = await getCustomFields(selectedVehicle.id);
      setCustomFields(r.data?.data || r.data || []);
      setShowCfForm(false);
      toast.success(editingCf ? 'Field updated' : 'Field added');
    } catch (e) { toast.error(e.message || 'Save failed'); }
    finally { setSavingCf(false); }
  };
  const handleDeleteCf = async (cfId) => {
    if (!window.confirm('Delete this custom field?')) return;
    try {
      await deleteCustomField(selectedVehicle.id, cfId);
      setCustomFields(p => p.filter(f => f.id !== cfId));
      toast.success('Field deleted');
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

  const handleDownloadPackets = async () => {
    if (!selectedVehicle) return;
    setPacketsDownloading(true);
    try {
      const resp = await downloadRawPacketsExcel(selectedVehicle.id, reportFrom, reportTo);
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `packets_${selectedVehicle.vehicleNumber || selectedVehicle.id}_${reportFrom.slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Packet download failed'); }
    finally { setPacketsDownloading(false); }
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

  const openShareModal = (type, id, name, icon = 'car') => {
    setShareTarget({ type, id, name, icon });
    setShareExpiryMode('hours');
    setShareHours('24');
    setShareCustomTime('');
    setLiveShareResult(null);
    setShowShareModal(true);
  };

  const handleCreateLiveShare = async () => {
    if (!shareTarget) return;
    let expiresAt;
    if (shareExpiryMode === 'hours') {
      expiresAt = new Date(Date.now() + Number(shareHours) * 3600000).toISOString();
    } else {
      if (!shareCustomTime) return toast.error('Please select an expiry date/time');
      expiresAt = new Date(shareCustomTime).toISOString();
      if (isNaN(new Date(shareCustomTime).getTime())) return toast.error('Invalid date/time');
    }
    setSharingLive(true);
    try {
      const payload = shareTarget.type === 'vehicle'
        ? { shareType: 'vehicle', vehicleId: shareTarget.id, expiresAt }
        : { shareType: 'group',   groupId:   shareTarget.id, expiresAt };
      const r = await createLiveShare(payload);
      setLiveShareResult({ token: r.data.token, expiresAt: r.data.expiresAt });
    } catch (e) { toast.error(e.message || 'Failed to create share link'); }
    finally { setSharingLive(false); }
  };

  const openDrawer = (v, e) => {
    e.stopPropagation();
    selectVehicle(v);   // initialises editForm, sensors, activeTab='overview'
    setDrawerVehicle(v);
  };

  const handleDrawerSave = async () => {
    if (!drawerVehicle) return;
    setDrawerSaving(true);
    try {
      const r = await updateVehicle(drawerVehicle.id, drawerEditForm);
      const u = r.data?.data || r.data;
      setVehicles(p => p.map(x => x.id === u.id ? { ...x, ...u } : x));
      setDrawerVehicle(p => ({ ...p, ...u }));
      toast.success('Vehicle updated');
    } catch (e) { toast.error(e.message || 'Update failed'); }
    finally { setDrawerSaving(false); }
  };

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
    if (statusFilter.size < 3) {
      list = list.filter(v => statusFilter.has(getVState(v, deviceStatesByType).stateName));
    }
    // Chip filter — stat card / HudChip click filtering. Supports:
    //   'total'                → no filter
    //   'no_gps' / 'overspeed' → virtual (computed from deviceStatus)
    //   'state:<stateName>'    → matches configured state from Master Settings
    if (chipFilter) {
      const _fleetSpeedThresh = parseInt(localStorage.getItem('fleet-speed-threshold') || '80');
      list = list.filter(v => {
        if (chipFilter === 'no_gps')    return !getVehicleCoords(v);
        if (chipFilter === 'overspeed') return (v.deviceStatus?.gpsData?.speed ?? 0) > _fleetSpeedThresh;
        if (chipFilter === 'total')     return true;
        if (chipFilter.startsWith('state:')) {
          return getVState(v, deviceStatesByType).stateName === chipFilter.slice(6);
        }
        return true;
      });
    }
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const getSortVal = (v) => {
          switch (sortCol) {
            case 'vehicle':    return vehicleDisplayName(v).toLowerCase();
            case 'regNo':      return (v.vehicleNumber || '').toLowerCase();
            case 'imei':       return (v.imei || '').toLowerCase();
            case 'status':     { const s = getVState(v, deviceStatesByType).stateName; return s === 'Running' ? 0 : s === 'Stopped' ? 1 : 2; }
            case 'speed':      return v.deviceStatus?.gpsData?.speed ?? -1;
            case 'fuel':       return v.deviceStatus?.fuel?.level ?? v.deviceStatus?.fuel?.llsLevel ?? -1;
            case 'battery':    return v.deviceStatus?.status?.battery ?? -1;
            case 'voltage':    return v.deviceStatus?.status?.voltage ?? -1;
            case 'gsm':        return v.deviceStatus?.status?.gsmSignal ?? -1;
            case 'satellites': return v.deviceStatus?.gpsData?.satellites ?? -1;
            case 'odometer':   return v.deviceStatus?.trip?.odometer ?? -1;
            case 'gps':        return getVehicleCoords(v) ? 0 : 1;
            case 'lastUpdate': return v.deviceStatus?.gpsData?.timestamp ? new Date(v.deviceStatus.gpsData.timestamp).getTime() : -1;
            default: return 0;
          }
        };
        const va = getSortVal(a), vb = getSortVal(b);
        if (va < vb) return -dir;
        if (va > vb) return dir;
        return 0;
      });
    }
    return list;
  }, [vehicles, groups, selectedGroupId, search, statusFilter, chipFilter, sortCol, sortDir, deviceStatesByType, stateTick]);

  const mapVehicles = useMemo(() => filteredVehicles.map(v => ({ ...v, coords: getVehicleCoords(v) })).filter(v => v.coords), [filteredVehicles]);

  // Lat/lng pairs for the pinned set — drives FocusBoundsController.
  // Re-computed whenever the pinned IDs change or vehicles refresh (live poll),
  // so the map stays fitted as each vehicle moves.
  const focusedBounds = useMemo(() => {
    if (focusedIds.size < 2) return null;
    return mapVehicles
      .filter(v => focusedIds.has(v.id))
      .map(v => [v.coords.lat, v.coords.lng]);
  }, [mapVehicles, focusedIds]);

  const toggleFocus = (id) => {
    setFocusedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // Scope the chip counts to the selected group so the top status cards follow
  // the vehicle list as the user filters by group. Search text and the chip
  // filter itself are intentionally NOT applied here — search is a "find one"
  // filter (counts shouldn't collapse on keystrokes) and applying the chip
  // filter would create a feedback loop (click Running → only Running visible
  // → every other count drops to 0).
  const chipScopedVehicles = (() => {
    if (!selectedGroupId) return vehicles;
    const grp = groups.find(g => g.id === selectedGroupId);
    const ids = new Set((grp?.vehicles || []).map(v => v.id));
    return vehicles.filter(v => ids.has(v.id));
  })();

  const runningCount   = chipScopedVehicles.filter(v => getVState(v, deviceStatesByType).stateName === 'Running').length;
  const stoppedCount   = chipScopedVehicles.filter(v => getVState(v, deviceStatesByType).stateName === 'Stopped').length;
  const noGpsCount     = chipScopedVehicles.filter(v => !getVehicleCoords(v)).length;
  const fleetSpeedThresh = parseInt(localStorage.getItem('fleet-speed-threshold') || '80');
  const overspeedCount = chipScopedVehicles.filter(v => getSpeed(v) > fleetSpeedThresh).length;

  // Build the chip list dynamically from Master-Settings state definitions so
  // every configured state (e.g. "No Signal", "Idle", "Parked") gets its own
  // card — even when zero vehicles are currently in that state. Virtual chips
  // (Total / No GPS / Overspeed) are always appended. Each chip's id is
  // either a virtual name or `state:<stateName>` so chipFilter can route back.
  const stateChipMeta = new Map();
  Object.values(deviceStatesByType).forEach(states => {
    (states || []).forEach(s => {
      if (!s?.stateName || stateChipMeta.has(s.stateName)) return;
      stateChipMeta.set(s.stateName, {
        color: s.stateColor || '#64748b',
        icon:  s.stateIcon  || '•',
        priority: s.priority ?? 100,
      });
    });
  });
  const stateChipList = Array.from(stateChipMeta.entries())
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([name, meta]) => ({
      id:       `state:${name}`,
      label:    name,
      dot:      meta.color,
      gradient: `linear-gradient(135deg, ${meta.color} 0%, ${meta.color} 100%)`,
      shadow:   '0 4px 14px rgba(15,23,42,0.18)',
      icon:     meta.icon,
      stateName: name,
    }));
  // Skip virtual No GPS / Overspeed chips if a configured state with the same
  // name already exists — otherwise the user sees duplicates. The configured
  // state wins because it carries the user's intended conditions.
  const configuredLabels = new Set(stateChipList.map(c => c.label.toLowerCase().replace(/\s+/g, '')));
  const fleetChips = [
    { id: 'total', label: 'Total', dot: '#64748b', gradient: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)', shadow: '0 4px 14px rgba(37,99,235,0.28)', icon: '🚗' },
    ...stateChipList,
    ...(configuredLabels.has('nogps') ? [] : [{ id: 'no_gps',    label: 'No GPS',    dot: '#f59e0b', gradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)', shadow: '0 4px 14px rgba(217,119,6,0.28)', icon: '📡' }]),
    ...(configuredLabels.has('overspeed') ? [] : [{ id: 'overspeed', label: 'Overspeed', dot: '#dc2626', gradient: 'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)', shadow: '0 4px 14px rgba(153,27,27,0.28)', icon: '🏎️' }]),
  ];
  const CHIP_COUNTS = {
    total:     chipScopedVehicles.length,
    no_gps:    noGpsCount,
    overspeed: overspeedCount,
  };
  stateChipList.forEach(c => {
    CHIP_COUNTS[c.id] = chipScopedVehicles.filter(v => getVState(v, deviceStatesByType).stateName === c.stateName).length;
  });

  // panel z-index shorthand
  const panelBg = '#FFFFFF';
  const panelBorder = '1px solid #E2E8F0';

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  /* ══════ TABLE VIEW ══════ */
  if (viewMode === 'table') {
    return (
      <div style={{ minHeight: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Stat cards — driven by fleetChips (dynamic from Master-Settings states) */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {fleetChips.map(c => (
            <div key={c.id} onClick={() => setChipFilter(chipFilter === c.id ? null : c.id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', background: c.gradient, borderRadius: 0, boxShadow: chipFilter === c.id ? `0 0 0 3px #fff, ${c.shadow}` : c.shadow, minWidth: '145px', position: 'relative', overflow: 'hidden', flex: '0 0 auto', cursor: 'pointer', opacity: chipFilter && chipFilter !== c.id ? 0.55 : 1, transition: 'all 0.15s', transform: chipFilter === c.id ? 'scale(1.03)' : 'none' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '40%', background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.06) 100%)', pointerEvents: 'none' }} />
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>{c.label}</div>
                <div style={{ fontSize: '34px', fontWeight: 800, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{CHIP_COUNTS[c.id]}</div>
              </div>
              <div style={{ width: '38px', height: '38px', borderRadius: 0, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, backdropFilter: 'blur(4px)', position: 'relative' }}>{c.icon}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '15px', pointerEvents: 'none' }}>⌕</span>
            <input
              className="form-control"
              style={{ paddingLeft: '32px', width: '200px' }}
              placeholder="Search vehicles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Client Picker — papa / dealer only: switch whose fleet is displayed (shared with map view) */}
          {isPapaOrDealer && clientNodes.length > 0 && (
            <div ref={cpRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setCpOpen(o => !o)}
                title="Switch client fleet"
                className="btn btn-outline"
                style={{ gap: 6, background: viewClientId ? '#EFF6FF' : '#fff', borderColor: viewClientId ? '#93C5FD' : undefined, color: viewClientId ? '#2563EB' : '#475569', fontWeight: 600, maxWidth: 220, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <Ic n="users" size={13} color={viewClientId ? '#2563EB' : '#64748B'} />
                {viewClientId
                  ? (clientNodes.find(n => n.id === viewClientId)?.name || 'Client')
                  : 'My Fleet'}
                {viewClientId && (
                  <span
                    onClick={e => { e.stopPropagation(); setViewClientId(null); setCpOpen(false); }}
                    title="Back to my fleet"
                    style={{ marginLeft: 2, cursor: 'pointer', color: '#94A3B8', lineHeight: 1 }}>✕</span>
                )}
                <Ic n={cpOpen ? 'chevUp' : 'chevD'} size={11} color="#94A3B8" />
              </button>

              {cpOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, width: 280, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.13)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 19, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <Ic n="search" size={12} color="#94A3B8" />
                    </span>
                    <input
                      autoFocus
                      value={cpSearch}
                      onChange={e => setCpSearch(e.target.value)}
                      placeholder="Search clients…"
                      style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <button
                      onClick={() => { setViewClientId(null); setCpOpen(false); setCpSearch(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 12px', border: 'none', background: viewClientId === null ? '#EFF6FF' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: viewClientId === null ? '#2563EB' : '#374151', textAlign: 'left' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>👤</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>My Fleet</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>Your own vehicles</div>
                      </div>
                      {viewClientId === null && <span style={{ fontSize: 10, background: '#2563EB', color: '#fff', padding: '1px 7px', borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>Active</span>}
                    </button>

                    {clientNodes
                      .filter(n => !cpSearch.trim() || n.name?.toLowerCase().includes(cpSearch.toLowerCase()) || n.email?.toLowerCase().includes(cpSearch.toLowerCase()))
                      .map(n => {
                        const avatarColors = [
                          ['#1D4ED8','#3B82F6'], ['#047857','#10B981'], ['#7C3AED','#8B5CF6'],
                          ['#B45309','#F59E0B'], ['#B91C1C','#EF4444'], ['#0E7490','#06B6D4'],
                        ];
                        const [from, to] = avatarColors[n.depth % avatarColors.length];
                        const breadcrumb = n.path?.slice(0, -1).join(' › ');
                        return (
                          <button key={n.id}
                            onClick={() => { setViewClientId(n.id); setCpOpen(false); setCpSearch(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: `8px 12px 8px ${12 + n.depth * 12}px`, border: 'none', background: viewClientId === n.id ? '#EFF6FF' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: viewClientId === n.id ? '#2563EB' : '#374151', textAlign: 'left', borderTop: '1px solid #F8FAFC' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${from},${to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase' }}>{(n.name || '?')[0]}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {breadcrumb && <div style={{ fontSize: 9, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>{breadcrumb}</div>}
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</div>
                              {n.email && <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.email}</div>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              {n.depth > 0 && <span style={{ fontSize: 9, background: '#F1F5F9', color: '#64748B', padding: '1px 5px', borderRadius: 20, fontWeight: 700 }}>L{n.depth}</span>}
                              {viewClientId === n.id && <span style={{ fontSize: 10, background: '#2563EB', color: '#fff', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>Active</span>}
                            </div>
                          </button>
                        );
                      })
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status filter */}
          <div style={{ position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
            <button
              className="btn btn-outline"
              onClick={() => { setShowStatusDrop(p => !p); setShowColPicker(false); }}
              style={{ gap: '5px' }}
            >
              ● Status
              {statusFilter.size < 3 && <span style={{ background: '#2563EB', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '11px', fontWeight: 700 }}>{statusFilter.size}</span>}
            </button>
            {showStatusDrop && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '160px' }}>
                {[
                  { label: 'Running', color: '#059669' },
                  { label: 'Stopped', color: '#dc2626' },
                  { label: 'Unknown', color: '#94a3b8' },
                ].map(({ label, color }) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <input type="checkbox" checked={statusFilter.has(label)}
                      onChange={() => setStatusFilter(prev => {
                        const next = new Set(prev);
                        if (next.has(label)) { if (next.size > 1) next.delete(label); }
                        else next.add(label);
                        return next;
                      })} />
                    <span style={{ color, fontWeight: 600, fontSize: '13px' }}>● {label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8' }}>
                      {vehicles.filter(v => getVState(v, deviceStatesByType).stateName === label).length}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Column picker */}
          <div style={{ position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
            <button
              className="btn btn-outline"
              onClick={() => { setShowColPicker(p => !p); setShowStatusDrop(false); }}
            >
              ⊞ Columns
            </button>
            {showColPicker && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '180px' }}>
                {colOrder.filter(k => k !== 'actions').map(key => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', cursor: 'pointer', borderRadius: '4px', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <input type="checkbox" checked={visibleCols.has(key)}
                      onChange={() => setVisibleCols(prev => {
                        const next = new Set(prev);
                        if (next.has(key)) { if (next.size > 1) next.delete(key); }
                        else next.add(key);
                        return next;
                      })} />
                    <span style={{ fontSize: '13px', color: '#374151' }}>{COL_DEFS[key].label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Groups filter — custom-styled dropdown (native chevron hidden,
              colored dot for the active group, SVG caret on the right). */}
          {groups.length > 0 && (() => {
            const activeGroup = groups.find(g => g.id === selectedGroupId);
            const accent = activeGroup?.color || '#3B82F6';
            return (
              <>
                <div style={{ width: '1px', height: '20px', background: '#E2E8F0' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Group</span>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  {/* Leading color dot — shows the active group's color at a glance */}
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    width: 8, height: 8, borderRadius: '50%',
                    background: activeGroup ? accent : '#94A3B8',
                    pointerEvents: 'none', flexShrink: 0,
                  }} />
                  <select
                    title="Filter by vehicle group"
                    value={selectedGroupId ?? ''}
                    onChange={e => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                    style={{
                      appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                      padding: '6px 30px 6px 26px',
                      height: 32,
                      border: `1px solid ${activeGroup ? accent + '80' : '#E2E8F0'}`,
                      borderRadius: 8,
                      background: activeGroup ? accent + '0D' : '#FFFFFF',
                      color: '#0F172A',
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      minWidth: 210,
                      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                      outline: 'none',
                      transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}22`; }}
                    onBlur={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'; }}>
                    <option value="">All groups ({vehicles.length})</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.vehicles?.length || 0})</option>
                    ))}
                  </select>
                  {/* Custom chevron */}
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} aria-hidden="true">
                    <path d="M1 3.5 L5 7.5 L9 3.5" stroke={activeGroup ? accent : '#64748B'} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </>
            );
          })()}

          <button onClick={fetchVehicles} disabled={loading} className="btn btn-outline">↺ Refresh</button>
          <div className="view-toggle">
            <button className="view-toggle-btn active">☰ Table</button>
            <button className="view-toggle-btn inactive" onClick={() => setViewMode('map')}>⊞ Map</button>
          </div>

          <div style={{ flex: 1 }} />
          <Link to="/add-vehicle" className="btn btn-primary">+ Add Vehicle</Link>
        </div>

        {/* Sensor table */}
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ width: '18px', height: '18px', border: '2px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
              Loading fleet data…
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px' }}>No vehicles found.</div>
          ) : (
            <div className="table-container" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {colOrder.filter(k => visibleCols.has(k)).map(key => {
                      const h = COL_DEFS[key];
                      const isSorting = sortCol === key;
                      const isDragOver = dragOverCol === key;
                      return (
                        <th key={key}
                          draggable={key !== 'actions'}
                          onDragStart={() => setDragSrcCol(key)}
                          onDragOver={e => { e.preventDefault(); if (key !== 'actions') setDragOverCol(key); }}
                          onDrop={() => {
                            if (dragSrcCol && dragSrcCol !== key && key !== 'actions') {
                              setColOrder(prev => {
                                const next = [...prev];
                                const fi = next.indexOf(dragSrcCol);
                                const ti = next.indexOf(key);
                                next.splice(fi, 1);
                                next.splice(ti, 0, dragSrcCol);
                                return next;
                              });
                            }
                            setDragOverCol(null); setDragSrcCol(null);
                          }}
                          onDragEnd={() => { setDragSrcCol(null); setDragOverCol(null); }}
                          onClick={() => {
                            if (key === 'actions') return;
                            if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                            else { setSortCol(key); setSortDir('asc'); }
                          }}
                          style={{
                            cursor: key === 'actions' ? 'default' : 'pointer',
                            userSelect: 'none',
                            opacity: isDragOver ? 0.7 : 1,
                            borderLeft: isDragOver ? '2px solid rgba(255,255,255,0.6)' : undefined,
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {key !== 'actions' && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', cursor: 'grab', marginRight: '1px' }}>⣿</span>}
                            <Ic n={h.icon} size={11} color="rgba(255,255,255,0.6)" sw={2} />
                            {h.label}
                            {isSorting && <span style={{ color: '#93C5FD', fontSize: '10px', fontWeight: 700 }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
                            {!isSorting && key !== 'actions' && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}> ↕</span>}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v) => {
                    const ign        = getIgnition(v);
                    const gps        = v.deviceStatus?.gpsData;
                    const fuelObj    = v.deviceStatus?.fuel;
                    const statusObj  = v.deviceStatus?.status;
                    const tripObj    = v.deviceStatus?.trip;
                    const coords     = getVehicleCoords(v);

                    const speed      = gps?.speed;
                    const fuelLevel  = fuelObj?.level;
                    const battery    = statusObj?.battery;
                    const voltage    = statusObj?.voltage;
                    const gsmSignal  = statusObj?.gsmSignal;
                    const satellites = gps?.satellites;
                    const odometer   = tripObj?.odometer;
                    const lastUpdate = gps?.timestamp;

                    const vs          = getVState(v, deviceStatesByType);
                    const statusColor = vs.stateColor;
                    const statusLabel = vs.stateName;

                    const cells = {
                      vehicle: (
                        <td key="vehicle">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>{VEHICLE_ICON_MAP[v.vehicleIcon] || '🚗'}</span>
                            <span style={{ fontWeight: 600, color: '#1e3a5f', whiteSpace: 'nowrap' }}>{vehicleDisplayName(v)}</span>
                          </div>
                        </td>
                      ),
                      regNo: (
                        <td key="regNo">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span onClick={e => openDrawer(v, e)} title="Click to view/edit"
                              style={{ fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                              {v.vehicleNumber || '—'}
                            </span>
                            {v.vehicleNumber && (
                              <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(v.vehicleNumber); toast.success('Copied!', { autoClose: 1200 }); }}
                                title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', color: '#CBD5E1', lineHeight: 1, borderRadius: '3px', flexShrink: 0 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#2563EB'}
                                onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}>⧉</button>
                            )}
                          </div>
                        </td>
                      ),
                      imei: (
                        <td key="imei">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span onClick={e => openDrawer(v, e)} title="Click to view/edit"
                              style={{ color: '#64748b', fontFamily: 'monospace', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                              {v.imei || '—'}
                            </span>
                            {v.imei && (
                              <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(v.imei); toast.success('Copied!', { autoClose: 1200 }); }}
                                title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', color: '#CBD5E1', lineHeight: 1, borderRadius: '3px', flexShrink: 0 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#2563EB'}
                                onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}>⧉</button>
                            )}
                          </div>
                        </td>
                      ),
                      status: (
                        <td key="status">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: statusColor }}>{statusLabel}</span>
                          </div>
                        </td>
                      ),
                      speed: (
                        <td key="speed">
                          {speed !== undefined && speed !== null ? (
                            <div>
                              <span style={{ fontWeight: 700, color: speed > 80 ? '#dc2626' : '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>
                                {speed} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '11px' }}>km/h</span>
                              </span>
                              {speed > 80 && <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, marginTop: '1px', letterSpacing: '0.04em' }}>OVER LIMIT</div>}
                            </div>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      ),
                      fuel: (
                        <td key="fuel">
                          {fuelLevel !== undefined && fuelLevel !== null ? (
                            <div>
                              <span style={{ fontWeight: 700, color: fuelLevel < 20 ? '#dc2626' : fuelLevel < 40 ? '#d97706' : '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                {Math.round(fuelLevel)}<span style={{ fontWeight: 400, color: '#64748b', fontSize: '11px' }}>%</span>
                              </span>
                              <div style={{ width: '48px', height: '3px', background: '#e2e8f0', borderRadius: '2px', marginTop: '3px' }}>
                                <div style={{ width: `${Math.min(100, Math.max(0, fuelLevel))}%`, height: '100%', borderRadius: '2px', background: fuelLevel < 20 ? '#dc2626' : fuelLevel < 40 ? '#d97706' : '#059669' }} />
                              </div>
                            </div>
                          ) : fuelObj?.llsLevel != null ? (
                            <span style={{ color: '#7c3aed', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {fuelObj.llsLevel}<span style={{ fontWeight: 400, color: '#64748b', fontSize: '11px' }}> mm</span>
                              <span style={{ display: 'block', fontSize: '10px', color: '#7c3aed', fontWeight: 700 }}>LLS</span>
                            </span>
                          ) : fuelObj?.ulLevel != null ? (
                            <span style={{ color: '#0284c7', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {fuelObj.ulLevel.toFixed(1)}<span style={{ fontWeight: 400, color: '#64748b', fontSize: '11px' }}> mm</span>
                              <span style={{ display: 'block', fontSize: '10px', color: '#0284c7', fontWeight: 700 }}>UL202</span>
                            </span>
                          ) : fuelObj?.sensorVoltage != null ? (
                            <span style={{ color: '#d97706', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {(fuelObj.sensorVoltage / 1000).toFixed(2)}<span style={{ fontWeight: 400, color: '#64748b', fontSize: '11px' }}> V</span>
                              <span style={{ display: 'block', fontSize: '10px', color: '#d97706', fontWeight: 700 }}>ANALOG</span>
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      ),
                      battery: (
                        <td key="battery">
                          {battery !== undefined && battery !== null ? (
                            <span style={{ fontWeight: 600, color: battery < 20 ? '#dc2626' : '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>
                              {battery}<span style={{ fontWeight: 400, color: '#64748b', fontSize: '11px' }}>%</span>
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      ),
                      voltage: (
                        <td key="voltage">
                          {voltage !== undefined && voltage !== null ? (
                            <span style={{ fontWeight: 600, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>
                              {voltage}<span style={{ fontWeight: 400, color: '#64748b', fontSize: '11px' }}> V</span>
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      ),
                      gsm: (
                        <td key="gsm">
                          {gsmSignal !== undefined && gsmSignal !== null ? (
                            <span style={{ fontWeight: 600, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>{gsmSignal}</span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      ),
                      satellites: (
                        <td key="satellites">
                          {satellites !== undefined && satellites !== null ? (
                            <span style={{ fontWeight: 600, color: satellites < 4 ? '#d97706' : '#059669', fontVariantNumeric: 'tabular-nums' }}>{satellites}</span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      ),
                      odometer: (
                        <td key="odometer">
                          {odometer !== undefined && odometer !== null ? (
                            <span style={{ fontWeight: 600, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>
                              {Number(odometer).toFixed(1)}<span style={{ fontWeight: 400, color: '#64748b', fontSize: '11px' }}> km</span>
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      ),
                      gps: (
                        <td key="gps">
                          {coords ? (
                            <span
                              title={`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`}
                              style={{ fontSize: '18px', cursor: 'default', lineHeight: 1 }}
                            >📍</span>
                          ) : (
                            <span title="No GPS" style={{ color: '#94a3b8', fontSize: '16px', lineHeight: 1 }}>○</span>
                          )}
                        </td>
                      ),
                      lastUpdate: (
                        <td key="lastUpdate" style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                          {lastUpdate ? new Date(lastUpdate).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'short' }) : '—'}
                        </td>
                      ),
                      actions: (
                        <td key="actions" className="ft-cell row-actions-cell" onClick={e => e.stopPropagation()}>
                          <div className="row-actions" style={{ opacity: 1 }}>
                            <button className="btn btn-sm btn-primary" onClick={e => openDrawer(v, e)}>
                              ✏️
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => handleSync(v)} disabled={syncing && syncingId === v.id}>
                              {syncing && syncingId === v.id ? '…' : '↻'}
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => { setViewMode('map'); selectVehicle(v); }} style={{ color: '#059669', borderColor: '#A7F3D0' }}>
                              ⊞
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(v.id)}>
                              ✕
                            </button>
                          </div>
                        </td>
                      ),
                    };

                    return (
                      <tr
                        key={v.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => selectVehicle(v)}
                      >
                        {colOrder.filter(k => visibleCols.has(k)).map(k => cells[k])}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Vehicle Detail Modal ──────────────────────────────────────── */}
        {drawerVehicle && (() => {
          const dv       = drawerVehicle;
          const ign      = getIgnition(dv);
          const gps      = dv.deviceStatus?.gpsData;
          const dst      = dv.deviceStatus?.status;
          const dfuel    = dv.deviceStatus?.fuel;
          const dvs      = getVState(dv, deviceStatesByType);
          const ignColor = dvs.stateColor;
          const ignBg    = ign === true ? '#f0fdf4' : ign === false ? '#fef2f2' : '#f8fafc';
          const ignLabel = dvs.stateName;
          const statItems = [
            gps?.speed      != null && { icon: '🏎️', label: 'Speed',      val: String(gps.speed),              unit: 'km/h', accent: gps.speed > 80 ? '#dc2626' : '#2563eb' },
            dfuel?.level    != null && { icon: '⛽',  label: 'Fuel',       val: String(Math.round(dfuel.level)), unit: '%',    accent: dfuel.level < 20 ? '#dc2626' : dfuel.level < 40 ? '#d97706' : '#16a34a' },
            dst?.battery    != null && { icon: '🔋',  label: 'Battery',    val: String(dst.battery),             unit: '%',    accent: dst.battery < 20 ? '#dc2626' : '#7c3aed' },
            dst?.voltage    != null && { icon: '⚡',  label: 'Voltage',    val: String(dst.voltage),             unit: 'V',    accent: '#d97706' },
            gps?.satellites != null && { icon: '🛰️', label: 'Satellites', val: String(gps.satellites),          unit: '',     accent: gps.satellites < 4 ? '#d97706' : '#059669' },
            dst?.gsmSignal  != null && { icon: '📶', label: 'GSM',        val: String(dst.gsmSignal),            unit: '',     accent: '#0891b2' },
          ].filter(Boolean);
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDrawerVehicle(null)}>
              <style>{`@keyframes modalIn { from { opacity: 0; transform: scale(0.97) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} />

              <div
                style={{ position: 'relative', zIndex: 1, width: '92vw', maxWidth: '980px', height: '86vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.07)', animation: 'modalIn 0.22s cubic-bezier(0.22,1,0.36,1)', fontFamily: "'Plus Jakarta Sans',sans-serif", overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>

                {/* ── Top header bar ── */}
                <div style={{ background: '#FFFFFF', borderBottom: `3px solid ${ignColor}`, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: ignColor + '12', border: `1.5px solid ${ignColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {VEHICLE_ICON_MAP[dv.vehicleIcon] || '🚗'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dv.vehicleName || dv.vehicleNumber || 'Vehicle'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, flexWrap: 'wrap' }}>
                      {dv.vehicleName && dv.vehicleNumber && <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', fontFamily: 'monospace' }}>{dv.vehicleNumber}</span>}
                      {dv.imei && <span style={{ fontSize: 10.5, color: '#94A3B8', fontFamily: 'monospace' }}>IMEI: {dv.imei}</span>}
                      {dv.deviceType && <span title="GPS device type" style={{ fontSize: 9.5, background: '#EFF6FF', color: '#2563EB', padding: '1px 8px', borderRadius: 20, fontWeight: 700, border: '1px solid #BFDBFE' }}>{dv.deviceType}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span title={`Vehicle state: ${ignLabel}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ignBg, color: ignColor, border: `1.5px solid ${ignColor}35` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ignColor, boxShadow: ign === true ? `0 0 5px ${ignColor}` : 'none' }} />
                      {ignLabel}
                    </span>
                    <button onClick={() => setDrawerVehicle(null)} title="Close vehicle details"
                      style={{ width: 32, height: 32, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ic n="x" size={14} color="#94A3B8" />
                    </button>
                  </div>
                </div>

                {/* ── Two-column body ── */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

                  {/* ── Left panel ── */}
                  <div style={{ width: 256, borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', background: '#f8fafc', flexShrink: 0, overflowY: 'auto' }}>

                    {/* Live data grid */}
                    <div style={{ padding: '16px 14px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Live Data</div>
                      {statItems.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {statItems.map((s, i) => (
                            <div key={i} style={{ background: '#fff', border: '1px solid #E2E8F0', borderTop: `3px solid ${s.accent}`, padding: '9px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                                <span style={{ fontSize: 11 }}>{s.icon}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                              </div>
                              <div style={{ fontSize: 19, fontWeight: 800, color: s.accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                                {s.val}<span style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8', marginLeft: 1 }}>{s.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ background: '#fff', border: '1px solid #E2E8F0', padding: '18px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>No live data</div>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div style={{ padding: '0 14px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Actions</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                        {[
                          { label: syncing && syncingId === dv.id ? 'Syncing…' : 'Sync Device Data', icon: 'refresh', color: '#0891B2', bg: '#ECFEFF', onClick: () => handleSync(dv), disabled: syncing && syncingId === dv.id },
                          { label: 'Play Route',    icon: 'play',    color: '#7C3AED', bg: '#F5F3FF', onClick: () => openPlayer(dv) },
                          ...(liveShareEnabled && (isPapaOrDealer || user?.permissions?.canShareLiveLocation) ? [
                            { label: 'Share Live',  icon: 'share',   color: '#2563EB', bg: '#EFF6FF', onClick: () => openShareModal('vehicle', dv.id, vehicleDisplayName(dv), dv.vehicleIcon) },
                          ] : []),
                          { label: 'View on Map',   icon: 'map',     color: '#059669', bg: '#F0FDF4', onClick: () => { setDrawerVehicle(null); setViewMode('map'); selectVehicle(dv); } },
                          { label: 'Remove Vehicle',icon: 'trash',   color: '#DC2626', bg: '#FEF2F2', onClick: () => { setDrawerVehicle(null); handleDelete(dv.id); } },
                        ].map(a => (
                          <button key={a.label} onClick={a.onClick} disabled={a.disabled}
                            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', background: '#fff', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: a.disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: a.color, fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.1s', opacity: a.disabled ? 0.6 : 1 }}
                            onMouseEnter={e => { if (!a.disabled) e.currentTarget.style.background = a.bg; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
                            <Ic n={a.icon} size={14} color={a.color} />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Device info */}
                    <div style={{ padding: '0 14px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Device Info</div>
                      <div style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
                        {[
                          ['Type',   dv.deviceType || '—'],
                          ['IMEI',   dv.imei || '—'],
                          ['Server', dv.serverIp ? `${dv.serverIp}:${dv.serverPort}` : '—'],
                          ['Name',   dv.deviceName || '—'],
                        ].map(([k, v], i, arr) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>{k}</span>
                            <span style={{ fontSize: 11, color: '#334155', fontWeight: 600, fontFamily: 'monospace', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Right panel: tabs + content ── */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                    {/* Tab bar */}
                    <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', background: '#f8fafc', flexShrink: 0, overflowX: 'auto' }}>
                      {[
                        { id: 'overview', label: 'Overview', icon: 'activity' },
                        { id: 'trips',    label: 'Trips',    icon: 'route'    },
                        { id: 'reports',  label: 'Reports',  icon: 'chart'    },
                        { id: 'sensors',  label: 'Sensors',  icon: 'radio'    },
                        { id: 'edit',     label: 'Edit',     icon: 'edit'     },
                      ].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                          className="fv-tab-btn"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 18px', border: 'none', background: activeTab === t.id ? '#FFFFFF' : 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? '#2563EB' : '#64748B', borderBottom: `2px solid ${activeTab === t.id ? '#2563EB' : 'transparent'}`, marginBottom: -2, fontFamily: 'inherit', transition: 'color 0.15s' }}>
                          <Ic n={t.icon} size={13} color={activeTab === t.id ? '#2563EB' : '#94A3B8'} />
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
                      <div style={{ padding: 22 }}>
                        {activeTab === 'overview' && <OverviewTab vehicle={dv} />}
                        {activeTab === 'trips' && (
                          <TripsTab vehicle={dv} reportFrom={reportFrom} reportTo={reportTo}
                            reportData={reportData} reportLoading={reportLoading} reportPage={reportPage}
                            setReportFrom={setReportFrom} setReportTo={setReportTo} setReportPage={setReportPage}
                            fetchReport={fetchReport} openPlayer={openPlayer} />
                        )}
                        {activeTab === 'reports' && (
                          <ReportsTab vehicle={dv} reportTab={reportTab} setReportTab={setReportTab}
                            reportFrom={reportFrom} reportTo={reportTo} setReportFrom={setReportFrom} setReportTo={setReportTo}
                            reportData={reportData} reportLoading={reportLoading} reportPage={reportPage} setReportPage={setReportPage}
                            reportExporting={reportExporting} packetsDownloading={packetsDownloading}
                            fetchReport={fetchReport} handleExport={handleExport} handleDownloadPackets={handleDownloadPackets} />
                        )}
                        {activeTab === 'sensors' && (
                          <SensorsTab vehicle={dv} sensors={sensors} loadingSensors={loadingSensors}
                            showSensorForm={showSensorForm} sensorForm={sensorForm} editingSensor={editingSensor}
                            savingSensor={savingSensor} setSensorForm={setSensorForm} setShowSensorForm={setShowSensorForm}
                            openSensorForm={openSensorForm} handleSaveSensor={handleSaveSensor} handleDeleteSensor={handleDeleteSensor} />
                        )}
                        {activeTab === 'edit' && (
                          <EditTab editForm={editForm} setEditForm={setEditForm} saving={saving} handleSaveEdit={handleSaveEdit} currentImei={selectedVehicle?.imei || ''} onRequestImeiEdit={requestImeiEdit} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Live Share Modal — table view */}
      {showShareModal && shareTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 7100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowShareModal(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', zIndex: 1, background: '#fff', borderRadius: 16, width: 420, maxWidth: '95vw', boxShadow: '0 24px 80px rgba(0,0,0,0.24)', fontFamily: "'Plus Jakarta Sans',sans-serif", overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {shareTarget.type === 'vehicle' ? (VEHICLE_ICON_MAP[shareTarget.icon] || '🚗') : '📦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Share Live Tracking</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{shareTarget.name}</div>
              </div>
              <button onClick={() => setShowShareModal(false)} style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ic n="x" size={14} color="#fff" />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              {!liveShareResult ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Link Expires</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {[['hours', 'Duration'], ['custom', 'Specific Time']].map(([mode, label]) => (
                        <button key={mode} onClick={() => setShareExpiryMode(mode)}
                          style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1.5px solid ${shareExpiryMode === mode ? '#2563EB' : '#E2E8F0'}`, background: shareExpiryMode === mode ? '#EFF6FF' : '#F8FAFC', color: shareExpiryMode === mode ? '#2563EB' : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {shareExpiryMode === 'hours' ? (
                      <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {[['1','1h'],['2','2h'],['4','4h'],['8','8h'],['12','12h'],['24','1 day'],['48','2 days'],['72','3 days']].map(([h, label]) => (
                            <button key={h} onClick={() => setShareHours(h)}
                              style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${shareHours === h ? '#2563EB' : '#E2E8F0'}`, background: shareHours === h ? '#2563EB' : '#fff', color: shareHours === h ? '#fff' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, fontSize: 12, color: '#64748B', border: '1px solid #E2E8F0' }}>
                          Expires: <strong style={{ color: '#374151' }}>{new Date(Date.now() + Number(shareHours) * 3600000).toLocaleString()}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>Pick a specific date and time</div>
                        <input type="datetime-local" value={shareCustomTime} onChange={e => setShareCustomTime(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                          style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </>
                    )}
                  </div>
                  <button onClick={handleCreateLiveShare} disabled={sharingLive}
                    style={{ width: '100%', padding: '11px', background: sharingLive ? '#93C5FD' : 'linear-gradient(135deg,#1D4ED8,#3B82F6)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: sharingLive ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', marginTop: 4 }}>
                    {sharingLive ? 'Generating…' : <><Ic n="link" size={14} color="#fff" /> Generate Share Link</>}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F0FDF4', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 10px' }}>✓</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Link Ready!</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Expires: {new Date(liveShareResult.expiresAt).toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#F8FAFC', borderRadius: 9, border: '1px solid #E2E8F0', padding: '10px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Ic n="link" size={13} color="#64748B" />
                    <span style={{ flex: 1, fontSize: 11.5, color: '#374151', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {`${window.location.origin}/live/${liveShareResult.token}`}
                    </span>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/live/${liveShareResult.token}`); toast.success('Link copied!'); }}
                      style={{ flexShrink: 0, padding: '5px 10px', background: '#2563EB', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
                      <Ic n="copy" size={11} color="#fff" /> Copy
                    </button>
                  </div>
                  <button onClick={() => setLiveShareResult(null)}
                    style={{ width: '100%', padding: '9px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 9, color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Generate Another Link
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  /* ══════ MAP VIEW ══════ */
  return (
    // Flex-column container: HUD bar on top, content row below.
    // The content row uses flex so the map takes the real remaining space
    // between panels instead of being covered by absolute overlays.
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', margin: '-24px', width: 'calc(100% + 48px)', fontFamily: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>

      {/* ══════ TOP HUD BAR ══════ */}
      <div style={{
        flexShrink: 0, height: HUD_H, zIndex: 1000, position: 'relative',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
        boxShadow: '0 1px 0 rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)',
      }}>
        {/* Panel toggle */}
        <button
          title={panelOpen ? 'Hide vehicle list' : 'Show vehicle list'}
          onClick={() => setPanelOpen(o => !o)}
          className="fv-hud-btn"
          style={{
            background: panelOpen ? 'linear-gradient(135deg,#EFF6FF,#DBEAFE)' : 'transparent',
            border: `1px solid ${panelOpen ? '#93C5FD' : '#E2E8F0'}`,
            cursor: 'pointer', color: panelOpen ? '#1D4ED8' : '#64748B',
            padding: '7px 9px', borderRadius: 0, display: 'flex', alignItems: 'center',
            flexShrink: 0, boxShadow: panelOpen ? '0 1px 4px rgba(37,99,235,0.15)' : 'none',
          }}>
          <Ic n="menu" size={16} color={panelOpen ? '#1D4ED8' : '#475569'} />
        </button>

        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 0,
            background: 'linear-gradient(135deg,#1E40AF 0%,#3B82F6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(30,64,175,0.40), inset 0 1px 0 rgba(255,255,255,0.16)',
          }}>
            <Ic n="map" size={15} color="#fff" sw={2.2} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.4px', lineHeight: 1.1 }}>FleetView</div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, lineHeight: 1, letterSpacing: '0.04em' }}>LIVE TRACKING</div>
          </div>
        </div>

        <div style={{ width: 1, height: 26, background: '#E2E8F0', margin: '0 4px', flexShrink: 0 }} />

        {/* Client Picker — papa / dealer only: switch whose fleet is displayed */}
        {isPapaOrDealer && clientNodes.length > 0 && (
          <div ref={cpRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setCpOpen(o => !o)}
              title="Switch client fleet"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: viewClientId ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${viewClientId ? '#93C5FD' : '#E2E8F0'}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: viewClientId ? '#2563EB' : '#475569', fontFamily: 'inherit', maxWidth: 180, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              <Ic n="users" size={13} color={viewClientId ? '#2563EB' : '#64748B'} />
              {viewClientId
                ? (clientNodes.find(n => n.id === viewClientId)?.name || 'Client')
                : 'My Fleet'}
              {viewClientId && (
                <span
                  onClick={e => { e.stopPropagation(); setViewClientId(null); setCpOpen(false); }}
                  title="Back to my fleet"
                  style={{ marginLeft: 2, cursor: 'pointer', color: '#94A3B8', lineHeight: 1 }}>✕</span>
              )}
              <Ic n={cpOpen ? 'chevUp' : 'chevD'} size={11} color="#94A3B8" />
            </button>

            {cpOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, width: 280, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.13)', overflow: 'hidden' }}>
                {/* Search */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 19, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <Ic n="search" size={12} color="#94A3B8" />
                  </span>
                  <input
                    autoFocus
                    value={cpSearch}
                    onChange={e => setCpSearch(e.target.value)}
                    placeholder="Search clients…"
                    style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                {/* List */}
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {/* "My Fleet" option */}
                  <button
                    onClick={() => { setViewClientId(null); setCpOpen(false); setCpSearch(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 12px', border: 'none', background: viewClientId === null ? '#EFF6FF' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: viewClientId === null ? '#2563EB' : '#374151', textAlign: 'left' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>👤</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>My Fleet</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>Your own vehicles</div>
                    </div>
                    {viewClientId === null && <span style={{ fontSize: 10, background: '#2563EB', color: '#fff', padding: '1px 7px', borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>Active</span>}
                  </button>

                  {clientNodes
                    .filter(n => !cpSearch.trim() || n.name?.toLowerCase().includes(cpSearch.toLowerCase()) || n.email?.toLowerCase().includes(cpSearch.toLowerCase()))
                    .map(n => {
                      const avatarColors = [
                        ['#1D4ED8','#3B82F6'], ['#047857','#10B981'], ['#7C3AED','#8B5CF6'],
                        ['#B45309','#F59E0B'], ['#B91C1C','#EF4444'], ['#0E7490','#06B6D4'],
                      ];
                      const [from, to] = avatarColors[n.depth % avatarColors.length];
                      const breadcrumb = n.path?.slice(0, -1).join(' › ');
                      return (
                        <button key={n.id}
                          onClick={() => { setViewClientId(n.id); setCpOpen(false); setCpSearch(''); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: `8px 12px 8px ${12 + n.depth * 12}px`, border: 'none', background: viewClientId === n.id ? '#EFF6FF' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: viewClientId === n.id ? '#2563EB' : '#374151', textAlign: 'left', borderTop: '1px solid #F8FAFC' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${from},${to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase' }}>{(n.name || '?')[0]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {breadcrumb && <div style={{ fontSize: 9, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>{breadcrumb}</div>}
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</div>
                            {n.email && <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.email}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            {n.depth > 0 && <span style={{ fontSize: 9, background: '#F1F5F9', color: '#64748B', padding: '1px 5px', borderRadius: 20, fontWeight: 700 }}>L{n.depth}</span>}
                            {viewClientId === n.id && <span style={{ fontSize: 10, background: '#2563EB', color: '#fff', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>Active</span>}
                          </div>
                        </button>
                      );
                    })
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stat chips — driven by fleetChips (dynamic from Master-Settings states) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflowX: 'auto', minWidth: 0 }}>
          {fleetChips.map(c => (
            <HudChip key={c.id} value={CHIP_COUNTS[c.id]} label={c.label} dot={c.dot} active={chipFilter === c.id} onClick={() => setChipFilter(chipFilter === c.id ? null : c.id)} />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Refresh */}
        <button
          title="Refresh fleet data"
          onClick={fetchVehicles}
          disabled={loading}
          className="fv-hud-btn"
          style={{
            background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 0,
            cursor: loading ? 'not-allowed' : 'pointer', color: '#475569',
            padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}>
          <Ic n="refresh" size={14} color={loading ? '#CBD5E1' : '#475569'} />
        </button>

        {/* Table view */}
        <button
          title="Switch to table view"
          onClick={() => setViewMode('table')}
          className="fv-hud-btn"
          style={{
            background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 0,
            cursor: 'pointer', color: '#374151', padding: '7px 13px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0,
            letterSpacing: '0.02em',
          }}>
          <Ic n="layers" size={14} color="#475569" /> TABLE
        </button>

        {/* Add Vehicle */}
        <Link
          to="/add-vehicle"
          title="Register a new vehicle with GPS device"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 16px',
            background: 'linear-gradient(135deg,#1E40AF 0%,#3B82F6 100%)',
            color: '#fff', borderRadius: 0, fontSize: 12, fontWeight: 800,
            textDecoration: 'none', letterSpacing: '0.04em', flexShrink: 0,
            boxShadow: '0 2px 10px rgba(30,64,175,0.36), inset 0 1px 0 rgba(255,255,255,0.14)',
          }}>
          <Ic n="plus" size={14} color="#fff" /> ADD VEHICLE
        </Link>
      </div>

      {/* ══════ CONTENT ROW: left panel + map + right panel ══════ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

      {/* ── LEFT PANEL — vehicle list sidebar (modern slate-tinted) ── */}
      <div style={{
        flexShrink: 0,
        width: panelOpen ? PANEL_W : 0,
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        background: '#F8FAFC',
        borderRight: '1px solid #E2E8F0',
        boxShadow: 'inset -1px 0 0 rgba(15,23,42,0.04)',
        display: 'flex',
        flexDirection: 'column',
      }}>
      {/* Inner fixed-width wrapper so content doesn't reflow during transition */}
      <div style={{ width: PANEL_W, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Search + group filter — translucent header with depth */}
        <div style={{ padding: '14px 14px 12px', flexShrink: 0, borderBottom: '1px solid #E2E8F0', background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)', boxShadow: '0 1px 0 rgba(15,23,42,0.04)' }}>
          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: groups.length > 0 ? 10 : 0 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <Ic n="search" size={16} color="#94A3B8" />
            </span>
            <input
              title="Filter vehicles by name, number plate or IMEI"
              className="fv-input"
              style={{ paddingLeft: 38, fontSize: 14 }}
              placeholder="Search by name, number or IMEI…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Group filter — pills when 0–1 groups exist, dropdown when multiple */}
          {groups.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                title="Filter by vehicle group"
                value={selectedGroupId ?? ''}
                onChange={e => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                style={{ flex: 1, minWidth: 0, background: '#FFFFFF', border: `1px solid ${selectedGroupId ? (groups.find(g => g.id === selectedGroupId)?.color || '#3B82F6') : '#E2E8F0'}`, borderRadius: 7, color: '#0F172A', fontSize: 12, fontWeight: 600, padding: '6px 10px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="">All groups ({vehicles.length})</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {liveShareEnabled && selectedGroupId && (isPapaOrDealer || user?.permissions?.canShareLiveLocation) && (
                <button
                  title={`Share live tracking for selected group`}
                  onClick={() => { const g = groups.find(x => x.id === selectedGroupId); if (g) openShareModal('group', g.id, g.name); }}
                  style={{ flexShrink: 0, padding: '6px 8px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', lineHeight: 1 }}>
                  <Ic n="share" size={11} color="#64748B" />
                </button>
              )}
            </div>
          ) : groups.length === 1 ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                title="Show all vehicles"
                onClick={() => setSelectedGroupId(null)}
                className="fv-grp-pill"
                style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 20, border: `1px solid ${selectedGroupId === null ? '#3B82F6' : '#E2E8F0'}`, background: selectedGroupId === null ? '#2563EB' : '#FFFFFF', color: selectedGroupId === null ? '#fff' : '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                All {vehicles.length}
              </button>
              {groups.map(g => (
                <button
                  key={g.id}
                  title={`Filter to "${g.name}" group`}
                  onClick={() => setSelectedGroupId(selectedGroupId === g.id ? null : g.id)}
                  className="fv-grp-pill"
                  style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 20, border: `1px solid ${selectedGroupId === g.id ? (g.color || '#3B82F6') : '#E2E8F0'}`, background: selectedGroupId === g.id ? (g.color || '#3B82F6') + '18' : '#FFFFFF', color: selectedGroupId === g.id ? (g.color || '#2563EB') : '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: g.color || '#3B82F6', flexShrink: 0 }} />
                  {g.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Vehicle count + multi-select controls */}
        <div style={{ padding: '10px 16px 9px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', background: '#F1F5F9' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''}
          </span>
          {focusedIds.size > 0 && (
            <button
              onClick={() => setFocusedIds(new Set())}
              title="Clear multi-select"
              style={{ background: '#2563EB', border: 'none', color: '#FFFFFF', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 0, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}>
              {focusedIds.size} SELECTED · CLEAR
            </button>
          )}
        </div>

        {/* Vehicle cards list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 10px 24px', background: '#F1F5F9' }}>
          {loading && (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{ width: 20, height: 20, border: '2px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Loading vehicles…</div>
            </div>
          )}
          {!loading && filteredVehicles.length === 0 && (
            <div style={{ padding: '36px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>No vehicles found</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Try adjusting your search or group filter</div>
            </div>
          )}
          {filteredVehicles.map(v => {
            const isSel      = selectedVehicle?.id === v.id;
            const fuel       = v.deviceStatus?.fuel?.level;
            const speed      = v.deviceStatus?.gpsData?.speed;
            const battery    = v.deviceStatus?.status?.battery;
            const lvs        = getVState(v, deviceStatesByType);
            const stColor    = lvs.stateColor;
            const stLabel    = lvs.stateName;
            const lastTs     = v.deviceStatus?.gpsData?.timestamp || v.deviceStatus?.lastUpdate;
            const minsAgo    = lastTs ? Math.round((Date.now() - new Date(lastTs).getTime()) / 60000) : null;
            const ageLabel   = minsAgo === null ? null : minsAgo < 2 ? 'Live' : minsAgo < 60 ? `${minsAgo}m` : minsAgo < 1440 ? `${Math.floor(minsAgo/60)}h` : `${Math.floor(minsAgo/1440)}d`;
            const ageColor   = minsAgo === null ? '#94A3B8' : minsAgo < 5 ? '#16a34a' : minsAgo < 30 ? '#d97706' : '#ef4444';
            const hasCoords  = !!getVehicleCoords(v);
            const ign        = getIgnition(v);
            return (
              <div key={v.id}
                onClick={() => selectVehicle(v)}
                title={`${vehicleDisplayName(v)} — click to view details and locate on map`}
                className="fv-card"
                style={{
                  padding: '14px 16px 13px', cursor: 'pointer', borderRadius: 0, marginBottom: 8,
                  background: isSel ? 'linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)' : '#FFFFFF',
                  border: `1px solid ${isSel ? '#93C5FD' : '#E2E8F0'}`,
                  borderLeft: `4px solid ${isSel ? '#2563EB' : stColor}`,
                  boxShadow: isSel
                    ? '0 6px 18px rgba(37,99,235,0.18), 0 1px 3px rgba(15,23,42,0.06), 0 0 0 1px rgba(37,99,235,0.10)'
                    : '0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.02)',
                }}>
                {/* Row 1: checkbox + icon + name + reg + status pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    title="Track on map (multi-select)"
                    checked={focusedIds.has(v.id)}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleFocus(v.id)}
                    style={{ flexShrink: 0, width: 18, height: 18, accentColor: '#2563EB', cursor: 'pointer', margin: 0 }}
                  />
                  <div style={{
                    width: 50, height: 50, borderRadius: 0,
                    background: `linear-gradient(135deg, ${stColor} 0%, ${stColor}D9 100%)`,
                    color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, flexShrink: 0,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 6px ${stColor}38`,
                  }}>
                    {VEHICLE_ICON_MAP[v.vehicleIcon] || '🚗'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                        {vehicleDisplayName(v)}
                      </span>
                      {ageLabel && (
                        <span style={{
                          fontSize: 10, color: '#FFFFFF', fontWeight: 800, flexShrink: 0,
                          background: `linear-gradient(135deg,${ageColor} 0%,${ageColor}CC 100%)`,
                          padding: '2px 9px', borderRadius: 0, letterSpacing: '0.05em',
                          boxShadow: `0 1px 4px ${ageColor}44`,
                        }}>{ageLabel.toUpperCase()}</span>
                      )}
                    </div>
                    {v.vehicleNumber && v.vehicleName && (
                      <div style={{ fontSize: 13, color: '#475569', fontFamily: 'monospace', fontWeight: 600, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vehicleNumber}</div>
                    )}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    padding: '6px 12px', borderRadius: 0,
                    background: `linear-gradient(135deg, ${stColor} 0%, ${stColor}E0 100%)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.20), 0 1px 2px ${stColor}40`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFFFFF', flexShrink: 0, boxShadow: ign === true ? '0 0 6px #FFFFFF' : 'none' }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.06em' }}>{stLabel.toUpperCase()}</span>
                  </div>
                </div>

                {/* Row 2: metrics strip — dark-slate card with colored left border tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 0, marginTop: 12, marginLeft: 30, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  {/* Speed */}
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 10px', borderLeft: `3px solid ${speed != null && speed > 80 ? '#ef4444' : speed != null && speed > 5 ? '#2563EB' : '#CBD5E1'}` }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Speed</span>
                    {speed != null ? (
                      <span style={{ fontSize: 17, fontWeight: 800, color: speed > 80 ? '#ef4444' : speed > 5 ? '#2563EB' : '#0F172A', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, marginTop: 2 }}>
                        {speed}<span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', marginLeft: 2 }}>km/h</span>
                      </span>
                    ) : !hasCoords ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginTop: 2 }}>NO GPS</span>
                    ) : <span style={{ fontSize: 17, fontWeight: 800, color: '#94A3B8', marginTop: 2 }}>—</span>}
                  </div>
                  {/* Ignition */}
                  {ign !== null && (
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 10px', borderLeft: `3px solid ${ign ? '#16a34a' : '#94A3B8'}` }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ignition</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: ign ? '#16a34a' : '#475569', marginTop: 4 }}>{ign ? 'ON' : 'OFF'}</span>
                    </div>
                  )}
                  {/* Battery */}
                  {battery != null && (
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 10px', borderLeft: `3px solid ${battery < 20 ? '#ef4444' : '#7C3AED'}` }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Battery</span>
                      <span style={{ fontSize: 17, fontWeight: 800, color: battery < 20 ? '#ef4444' : '#0F172A', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, marginTop: 2 }}>
                        {Math.round(battery)}<span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8' }}>%</span>
                      </span>
                    </div>
                  )}
                  {/* Fuel */}
                  {fuel != null && (
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 10px', borderLeft: `3px solid ${fuel < 20 ? '#ef4444' : fuel < 40 ? '#f59e0b' : '#16a34a'}` }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Fuel</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: fuel < 20 ? '#ef4444' : '#0F172A', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                          {Math.round(fuel)}<span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8' }}>%</span>
                        </span>
                        <span style={{ flex: 1, minWidth: 24, height: 4, background: '#F1F5F9', overflow: 'hidden', display: 'inline-block' }}>
                          <span style={{ width: `${Math.max(0, Math.min(100, fuel))}%`, height: '100%', display: 'block', background: fuel > 30 ? '#22c55e' : fuel > 15 ? '#f59e0b' : '#ef4444' }} />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>{/* /vehicle cards */}
      </div>{/* /inner wrapper */}
      </div>{/* /outer left panel */}

      {/* ── MAP AREA — flex:1, takes remaining space between panels ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
        <MapContainer center={INDIA_CENTER} zoom={5} style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }} scrollWheelZoom zoomControl={false}>
          <TileLayer
            url={getMapTileUrl()}
            attribution='&copy; Google Maps'
            subdomains={getMapSubdomains()}
            maxZoom={20}
          />
          <MapResizer />
          {mapCenter && focusedIds.size < 2 && <MapController center={mapCenter} />}
          {focusedIds.size < 2 && (
            <SmoothMotionController
              markerRefs={markerRefs}
              selectedId={selectedVehicle?.id || null}
            />
          )}
          <FocusBoundsController bounds={focusedBounds} />
          <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterCustomIcon} maxClusterRadius={60} showCoverageOnHover={false} spiderfyOnMaxZoom={true} disableClusteringAtZoom={14}>
            {mapVehicles.map(v => {
              const isSel = selectedVehicle?.id === v.id;
              const vState = getVState(v, deviceStatesByType);
              return (
                <SmoothMarker
                  key={`${v.id}-${isSel}-${vState.stateName}`}
                  vehicleId={v.id}
                  markerRefs={markerRefs}
                  position={[v.coords.lat, v.coords.lng]}
                  icon={makeVehicleIcon(v, isSel, vState.stateColor)}
                  eventHandlers={{ click: () => selectVehicle(v) }}
                >
                  <Tooltip direction="auto" className="fv-tooltip" interactive={true}><VehicleTooltip vehicle={v} /></Tooltip>
                </SmoothMarker>
              );
            })}
          </MarkerClusterGroup>
        </MapContainer>

        {/* Legend — glassmorphic, squared to match design system */}
        <div style={{
          position: 'absolute', bottom: 18, left: 14, zIndex: 10,
          background: 'rgba(15,23,42,0.72)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 0,
          padding: '8px 16px',
          display: 'flex', gap: 14, alignItems: 'center',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <LegendDot color="#22c55e" label={`${runningCount} Running`} dark />
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.14)' }} />
          <LegendDot color="#ef4444" label={`${stoppedCount} Stopped`} dark />
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.14)' }} />
          <LegendDot color="#94A3B8" label={`${mapVehicles.length} on map`} dark />
        </div>
      </div>{/* /map area */}

      {/* ── DETAIL BOTTOM SHEET (replaces the old right-side drawer) ─────── */}
      {/* Peek states: collapsed (110 px strip), half (50vh), full (100vh).  */}
      {/* Drag the handle pill to resize, or click the ⌐ ◐ ◼ buttons.       */}
      <BottomSheet
        open={!!selectedVehicle}
        peek={detailSheetPeek}
        onPeekChange={setDetailSheetPeek}
        onClose={() => setSelectedVehicle(null)}
        accentColor={selectedVehicle ? getVState(selectedVehicle, deviceStatesByType).stateColor : '#2563EB'}
      >
        {selectedVehicle && (() => {
          const sv      = selectedVehicle;
          const gps     = sv.deviceStatus?.gpsData;
          const dst     = sv.deviceStatus?.status;
          const dfuel   = sv.deviceStatus?.fuel;
          const dvs     = getVState(sv, deviceStatesByType);
          const stColor = dvs.stateColor;
          const stLabel = dvs.stateName;
          const ign     = getIgnition(sv);
          const lastTs  = gps?.timestamp || sv.deviceStatus?.lastUpdate;
          const minsAgo = lastTs ? Math.round((Date.now() - new Date(lastTs).getTime()) / 60000) : null;
          const ageStr  = minsAgo === null ? null : minsAgo < 2 ? 'Live now' : minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.floor(minsAgo/60)}h ago` : `${Math.floor(minsAgo/1440)}d ago`;
          const ageColor = minsAgo === null ? '#94a3b8' : minsAgo < 5 ? '#16a34a' : minsAgo < 30 ? '#d97706' : '#ef4444';
          const liveStats = [
            gps?.speed      != null && { label: 'Speed',      val: `${gps.speed}`,              unit: 'km/h', accent: gps.speed > 80 ? '#ef4444' : '#2563EB'  },
            dfuel?.level    != null && { label: 'Fuel',       val: `${Math.round(dfuel.level)}`, unit: '%',    accent: dfuel.level < 20 ? '#ef4444' : dfuel.level < 40 ? '#f59e0b' : '#16a34a' },
            dst?.battery    != null && { label: 'Battery',    val: `${dst.battery}`,             unit: '%',    accent: dst.battery < 20 ? '#ef4444' : '#7c3aed' },
            dst?.voltage    != null && { label: 'Voltage',    val: `${dst.voltage}`,             unit: 'V',    accent: '#d97706' },
            gps?.satellites != null && { label: 'Satellites', val: `${gps.satellites}`,          unit: '',     accent: gps.satellites < 4 ? '#f59e0b' : '#059669' },
            dst?.gsmSignal  != null && { label: 'GSM',        val: `${dst.gsmSignal}`,           unit: '',     accent: '#0891b2' },
          ].filter(Boolean);

          return (
            <>
              {/* ── Panel Header (horizontal, full-width) ──────────────── */}
              <div style={{ background: '#FFFFFF', borderBottom: `4px solid ${stColor}`, padding: '16px 20px', flexShrink: 0 }}>

                {/* Top row: identity (left) | status+age (mid) | actions (right) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>

                  {/* Identity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 240, flex: '0 1 auto' }}>
                    <div style={{ width: 56, height: 56, background: stColor, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                      {VEHICLE_ICON_MAP[sv.vehicleIcon] || '🚗'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                        {vehicleDisplayName(sv)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                        {sv.vehicleName && sv.vehicleNumber && (
                          <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>{sv.vehicleNumber}</span>
                        )}
                        {sv.deviceType && (
                          <span title="GPS device type installed in this vehicle" style={{ fontSize: 10, background: '#1D4ED8', color: '#FFFFFF', padding: '2px 8px', fontWeight: 700, letterSpacing: '0.04em' }}>{sv.deviceType}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status + age */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
                    <span title={`Current vehicle state: ${stLabel}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px',
                                   fontSize: 13, fontWeight: 700, background: stColor, color: '#FFFFFF',
                                   border: 'none', borderRadius: 0, letterSpacing: '0.02em' }}>
                      <span style={{ width: 8, height: 8, background: '#FFFFFF', boxShadow: ign === true ? `0 0 6px #FFFFFF` : 'none' }} />
                      {stLabel.toUpperCase()}
                    </span>
                    {ageStr && (
                      <span title="Time since last GPS packet was received"
                            style={{ fontSize: 12, color: '#FFFFFF', background: ageColor, padding: '7px 12px',
                                     fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.02em' }}>
                        <Ic n="clock" size={12} color="#FFFFFF" /> {ageStr.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Spacer pushes actions to the right */}
                  <div style={{ flex: 1 }} />

                  {/* Action buttons (pillars on the right) */}
                  <div style={{ display: 'flex', gap: 0 }}>
                    <button
                      title="Sync — pull the latest GPS position and sensor data from the server right now"
                      onClick={() => handleSync(sv)}
                      disabled={syncing && syncingId === sv.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                               padding: '11px 18px', background: '#0D9488', border: 'none', color: '#FFFFFF',
                               borderRadius: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                      <Ic n="refresh" size={14} color="#FFFFFF" /> SYNC
                    </button>
                    <button
                      title="Route Playback — replay this vehicle's historical path on the map"
                      onClick={() => openPlayer(sv)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                               padding: '11px 18px', background: '#7C3AED', border: 'none', color: '#FFFFFF',
                               borderRadius: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                      <Ic n="play" size={14} color="#FFFFFF" /> PLAYBACK
                    </button>
                    {liveShareEnabled && (isPapaOrDealer || user?.permissions?.canShareLiveLocation) && (
                      <button
                        title="Share live tracking — generate a public URL for real-time position"
                        onClick={() => openShareModal('vehicle', sv.id, vehicleDisplayName(sv), sv.vehicleIcon)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                 padding: '11px 18px', background: '#2563EB', border: 'none', color: '#FFFFFF',
                                 borderRadius: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                        <Ic n="share" size={14} color="#FFFFFF" /> SHARE
                      </button>
                    )}
                    <button
                      title="Delete this vehicle and all its tracking data"
                      onClick={() => handleDelete(sv.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px',
                               background: '#DC2626', border: 'none', color: '#FFFFFF', borderRadius: 0, cursor: 'pointer' }}>
                      <Ic n="trash" size={15} color="#FFFFFF" />
                    </button>
                  </div>
                </div>

                {/* Live stats — color-filled cards, large numerals, white text */}
                {liveStats.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 0, marginTop: 16 }}>
                    {liveStats.map((s, i) => (
                      <div key={i}
                           title={`Live ${s.label.toLowerCase()} reading from device`}
                           style={{ background: s.accent, color: '#FFFFFF', padding: '14px 16px', borderRadius: 0, display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', overflow: 'hidden', cursor: 'default' }}>
                        <div style={{ position: 'absolute', right: -10, top: -10, width: 60, height: 60, background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em', position: 'relative', zIndex: 1 }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}>
                          {s.val}
                          {s.unit && <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>{s.unit}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom fields — user-defined name:value pairs */}
                {(customFields.length > 0 || showCfForm) && (
                  <div style={{ marginTop: 14, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Custom Fields</span>
                      <button onClick={() => openCfForm(null)} style={{ background: '#2563EB', border: 'none', borderRadius: 0, cursor: 'pointer', padding: '5px 10px', display: 'flex', color: '#FFFFFF', fontSize: 11, fontWeight: 700, gap: 4, alignItems: 'center' }}><Ic n="plus" size={11} color="#FFFFFF" /> ADD</button>
                    </div>
                    {showCfForm && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'stretch' }}>
                        <input style={{ width: 220, padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 0, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} value={cfForm.fieldName} onChange={e => setCfForm({ ...cfForm, fieldName: e.target.value })} placeholder="Field name" />
                        <input style={{ width: 220, padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 0, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} value={cfForm.fieldValue} onChange={e => setCfForm({ ...cfForm, fieldValue: e.target.value })} placeholder="Value" />
                        <button onClick={handleSaveCf} disabled={savingCf || !cfForm.fieldName.trim()} style={{ padding: '8px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 0, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: savingCf || !cfForm.fieldName.trim() ? 0.5 : 1 }}>{savingCf ? '…' : editingCf ? 'SAVE' : 'ADD'}</button>
                        <button onClick={() => setShowCfForm(false)} style={{ padding: '8px 12px', background: '#F1F5F9', border: 'none', borderRadius: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Ic n="x" size={13} color="#475569" /></button>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {customFields.map(cf => (
                        <div key={cf.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#F1F5F9', border: 'none', borderRadius: 0, fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: '#475569' }}>{cf.fieldName}:</span>
                          <span style={{ color: '#0F172A', fontWeight: 600 }}>{cf.fieldValue || '—'}</span>
                          <button onClick={() => openCfForm(cf)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, display: 'flex' }}><Ic n="edit" size={10} color="#475569" /></button>
                          <button onClick={() => handleDeleteCf(cf.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, display: 'flex' }}><Ic n="x" size={10} color="#DC2626" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {customFields.length === 0 && !showCfForm && (
                  <button onClick={() => openCfForm(null)} style={{ marginTop: 12, background: '#FFFFFF', border: '1px dashed #94A3B8', borderRadius: 0, padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: '#475569', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Ic n="plus" size={12} color="#475569" /> ADD CUSTOM FIELD
                  </button>
                )}
              </div>

              {/* ── Tab Bar ── */}
              <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', flexShrink: 0, overflowX: 'auto', background: '#F8FAFC' }}>
                {[
                  { id: 'overview', label: 'OVERVIEW', icon: 'activity', hint: 'Live GPS position, engine status and device telemetry' },
                  { id: 'trips',    label: 'TRIPS',    icon: 'route',    hint: 'View individual trip history with distance and duration' },
                  { id: 'reports',  label: 'REPORTS',  icon: 'chart',    hint: 'Daily, engine-hours and fuel reports with export' },
                  { id: 'sensors',  label: 'SENSORS',  icon: 'radio',    hint: 'Custom sensor channels configured for this vehicle' },
                  { id: 'edit',     label: 'EDIT',     icon: 'edit',     hint: 'Edit vehicle name, icon and thresholds' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    title={tab.hint}
                    className="fv-tab-btn"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '14px 22px',
                      border: 'none', borderRadius: 0,
                      background: activeTab === tab.id ? stColor : 'transparent',
                      cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13,
                      fontWeight: 700, letterSpacing: '0.05em',
                      color: activeTab === tab.id ? '#FFFFFF' : '#64748B',
                      fontFamily: 'inherit', flexShrink: 0, transition: 'background 0.15s, color 0.15s',
                    }}>
                    <Ic n={tab.icon} size={13} color={activeTab === tab.id ? '#FFFFFF' : '#9CA3AF'} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Tab Content — full width, no center cap ── */}
              <div style={{ flex: 1, overflow: 'auto', background: C.surface }}>
                <div style={{ padding: 22 }}>
                  {activeTab === 'overview' && <OverviewTab vehicle={sv} />}
                  {activeTab === 'trips' && (
                    <TripsTab vehicle={sv} reportFrom={reportFrom} reportTo={reportTo}
                      reportData={reportData} reportLoading={reportLoading} reportPage={reportPage}
                      setReportFrom={setReportFrom} setReportTo={setReportTo} setReportPage={setReportPage}
                      fetchReport={fetchReport} openPlayer={openPlayer} />
                  )}
                  {activeTab === 'reports' && (
                    <ReportsTab vehicle={sv} reportTab={reportTab} setReportTab={setReportTab}
                      reportFrom={reportFrom} reportTo={reportTo} setReportFrom={setReportFrom} setReportTo={setReportTo}
                      reportData={reportData} reportLoading={reportLoading} reportPage={reportPage} setReportPage={setReportPage}
                      reportExporting={reportExporting} packetsDownloading={packetsDownloading}
                      fetchReport={fetchReport} handleExport={handleExport} handleDownloadPackets={handleDownloadPackets} />
                  )}
                  {activeTab === 'sensors' && (
                    <SensorsTab vehicle={sv} sensors={sensors} loadingSensors={loadingSensors}
                      showSensorForm={showSensorForm} sensorForm={sensorForm} editingSensor={editingSensor}
                      savingSensor={savingSensor} setSensorForm={setSensorForm} setShowSensorForm={setShowSensorForm}
                      openSensorForm={openSensorForm} handleSaveSensor={handleSaveSensor} handleDeleteSensor={handleDeleteSensor} />
                  )}
                  {activeTab === 'edit' && (
                    <EditTab editForm={editForm} setEditForm={setEditForm} saving={saving} handleSaveEdit={handleSaveEdit} currentImei={selectedVehicle?.imei || ''} onRequestImeiEdit={requestImeiEdit} />
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </BottomSheet>

      </div>{/* /content row */}

      {/* ══════ DELETE CONFIRMATION MODAL ══════ */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 7200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !deleting && setDeleteConfirm(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', zIndex: 1, background: '#fff', borderRadius: 14, width: 420, maxWidth: '95vw', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', fontFamily: "'Plus Jakarta Sans',sans-serif", overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'linear-gradient(135deg,#B91C1C,#DC2626)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                <Ic n="trash" size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Delete Vehicle</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{deleteConfirm.vehicleName}</div>
              </div>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ic n="x" size={14} color="#fff" />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>This action cannot be undone.</div>
                <div style={{ fontSize: 11, color: '#B91C1C', lineHeight: 1.5 }}>This will permanently delete the vehicle and all associated tracking data, trips, sensors, and custom fields.</div>
              </div>
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
                To confirm, type <strong style={{ background: '#FEF3C7', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 13, color: '#92400E', letterSpacing: '0.05em' }}>{deleteConfirm.phrase}</strong> below:
              </div>
              <input
                autoFocus
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.05em', transition: 'border-color 0.15s', borderColor: deleteTyped === deleteConfirm.phrase ? '#22c55e' : deleteTyped.length > 0 ? '#f59e0b' : '#E2E8F0' }}
                placeholder={deleteConfirm.phrase}
                value={deleteTyped}
                onChange={e => setDeleteTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && deleteTyped === deleteConfirm.phrase) executeDelete(); }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setDeleteConfirm(null)} disabled={deleting} style={{ flex: 1, padding: '10px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748B', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={executeDelete} disabled={deleteTyped !== deleteConfirm.phrase || deleting} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: deleteTyped === deleteConfirm.phrase ? '#DC2626' : '#FCA5A5', cursor: deleteTyped === deleteConfirm.phrase ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  {deleting ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ IMEI CHANGE CONFIRMATION MODAL ══════ */}
      {imeiEditConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 7200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !savingImei && setImeiEditConfirm(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', zIndex: 1, background: '#fff', borderRadius: 14, width: 460, maxWidth: '95vw', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', fontFamily: "'Plus Jakarta Sans',sans-serif", overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'linear-gradient(135deg,#B45309,#D97706)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ic n="radio" size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Change IMEI</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Rebind vehicle to a different GPS device</div>
              </div>
              <button onClick={() => setImeiEditConfirm(null)} disabled={savingImei} style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ic n="x" size={14} color="#fff" />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E', marginBottom: 6 }}>This will reassign the vehicle to a new tracking device.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '4px 10px', fontSize: 11, color: '#78350F' }}>
                  <div style={{ fontWeight: 700 }}>From:</div>
                  <div style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{imeiEditConfirm.oldImei || '— (none)'}</div>
                  <div style={{ fontWeight: 700 }}>To:</div>
                  <div style={{ fontFamily: 'monospace', letterSpacing: '0.05em', color: '#B45309', fontWeight: 700 }}>{imeiEditConfirm.newImei}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
                To confirm, type <strong style={{ background: '#FEF3C7', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 13, color: '#92400E', letterSpacing: '0.05em' }}>{imeiEditConfirm.phrase}</strong> below:
              </div>
              <input
                autoFocus
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.05em', transition: 'border-color 0.15s', borderColor: imeiTyped === imeiEditConfirm.phrase ? '#22c55e' : imeiTyped.length > 0 ? '#f59e0b' : '#E2E8F0' }}
                placeholder={imeiEditConfirm.phrase}
                value={imeiTyped}
                onChange={e => setImeiTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && imeiTyped === imeiEditConfirm.phrase) executeImeiEdit(); }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setImeiEditConfirm(null)} disabled={savingImei} style={{ flex: 1, padding: '10px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748B', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={executeImeiEdit} disabled={imeiTyped !== imeiEditConfirm.phrase || savingImei} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: imeiTyped === imeiEditConfirm.phrase ? '#D97706' : '#FCD34D', cursor: imeiTyped === imeiEditConfirm.phrase ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  {savingImei ? 'Updating…' : 'Update IMEI'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODALS (fixed — work anywhere in DOM) ══════ */}
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
        <LocationPlayer vehicle={playerVehicle} onClose={() => setPlayerOpen(false)} initialFrom={playerFrom} initialTo={playerTo} />
      )}

      {/* ── Live Share Modal ── */}
      {showShareModal && shareTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 7100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowShareModal(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', zIndex: 1, background: '#fff', borderRadius: 16, width: 420, maxWidth: '95vw', boxShadow: '0 24px 80px rgba(0,0,0,0.24)', fontFamily: "'Plus Jakarta Sans',sans-serif", overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {shareTarget.type === 'vehicle' ? (VEHICLE_ICON_MAP[shareTarget.icon] || '🚗') : '📦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Share Live Tracking</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{shareTarget.name}</div>
              </div>
              <button onClick={() => setShowShareModal(false)}
                style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ic n="x" size={14} color="#fff" />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {!liveShareResult ? (
                <>
                  {/* Expiry mode tabs */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Link Expires</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {[['hours', 'Duration'], ['custom', 'Specific Time']].map(([mode, label]) => (
                        <button key={mode} onClick={() => setShareExpiryMode(mode)}
                          style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1.5px solid ${shareExpiryMode === mode ? '#2563EB' : '#E2E8F0'}`, background: shareExpiryMode === mode ? '#EFF6FF' : '#F8FAFC', color: shareExpiryMode === mode ? '#2563EB' : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {shareExpiryMode === 'hours' ? (
                      <>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>How long should the link stay active?</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {[['1', '1 hour'], ['2', '2 hours'], ['4', '4 hours'], ['8', '8 hours'], ['12', '12 hours'], ['24', '1 day'], ['48', '2 days'], ['72', '3 days']].map(([h, label]) => (
                            <button key={h} onClick={() => setShareHours(h)}
                              style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${shareHours === h ? '#2563EB' : '#E2E8F0'}`, background: shareHours === h ? '#2563EB' : '#fff', color: shareHours === h ? '#fff' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <div style={{ marginTop: 10, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, fontSize: 12, color: '#64748B', border: '1px solid #E2E8F0' }}>
                          Expires: <strong style={{ color: '#374151' }}>{new Date(Date.now() + Number(shareHours) * 3600000).toLocaleString()}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>Pick a specific date and time</div>
                        <input
                          type="datetime-local"
                          value={shareCustomTime}
                          onChange={e => setShareCustomTime(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                          style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#374151' }}
                        />
                      </>
                    )}
                  </div>

                  {/* Info banner */}
                  <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 18, border: '1px solid #BFDBFE' }}>
                    <Ic n="info" size={15} color="#2563EB" />
                    <div style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>
                      Anyone with this link can view live vehicle positions — no login required. The link stops working after it expires.
                    </div>
                  </div>

                  <button onClick={handleCreateLiveShare} disabled={sharingLive}
                    style={{ width: '100%', padding: '11px', background: sharingLive ? '#93C5FD' : 'linear-gradient(135deg,#1D4ED8,#3B82F6)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: sharingLive ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                    {sharingLive ? (
                      <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} /> Generating…</>
                    ) : (
                      <><Ic n="link" size={14} color="#fff" /> Generate Share Link</>
                    )}
                  </button>
                </>
              ) : (
                /* ── Share result ── */
                <>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F0FDF4', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 10px' }}>✓</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Link Ready!</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                      Expires: {new Date(liveShareResult.expiresAt).toLocaleString()}
                    </div>
                  </div>

                  {/* URL display */}
                  <div style={{ background: '#F8FAFC', borderRadius: 9, border: '1px solid #E2E8F0', padding: '10px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Ic n="link" size={13} color="#64748B" />
                    <span style={{ flex: 1, fontSize: 11.5, color: '#374151', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {`${window.location.origin}/live/${liveShareResult.token}`}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/live/${liveShareResult.token}`);
                        toast.success('Link copied!');
                      }}
                      style={{ flexShrink: 0, padding: '5px 10px', background: '#2563EB', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
                      <Ic n="copy" size={11} color="#fff" /> Copy
                    </button>
                  </div>

                  <button onClick={() => setLiveShareResult(null)}
                    style={{ width: '100%', padding: '9px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 9, color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Generate Another Link
                  </button>
                </>
              )}
            </div>
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
      display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
      background: active ? '#EFF6FF' : 'transparent',
      border: `1px solid ${active ? '#BFDBFE' : 'transparent'}`,
    }}>
    {children}
  </div>
);

const DarkStatusPill = ({ vs }) => {
  const color = vs?.stateColor || '#94A3B8';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + '22', color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {vs?.stateIcon ? <span>{vs.stateIcon}</span> : null}
      {vs?.stateName || 'Unknown'}
    </span>
  );
};

const HudChip = ({ value, label, dot, active, onClick }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '6px 14px',
    background: `linear-gradient(135deg, ${dot} 0%, ${dot}CC 100%)`,
    border: 'none',
    borderRadius: 0,
    cursor: 'pointer',
    opacity: active ? 1 : 0.78,
    boxShadow: active
      ? `0 0 0 2px #fff, 0 4px 14px ${dot}55, inset 0 1px 0 rgba(255,255,255,0.22)`
      : `inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 3px ${dot}30`,
    transition: 'opacity 0.15s, box-shadow 0.15s, transform 0.15s',
    flexShrink: 0,
    transform: active ? 'translateY(-1px)' : 'none',
  }}>
    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</span>
    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.90)', fontWeight: 700, letterSpacing: '0.03em' }}>{label}</span>
  </div>
);

const LegendDot = ({ color, label, dark }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
    <span style={{
      width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0,
      boxShadow: `0 0 6px ${color}88`,
    }} />
    <span style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.88)' : '#475569', fontWeight: 700, letterSpacing: '0.02em' }}>{label}</span>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// Shared UI Primitives (light theme for tab content)
// ══════════════════════════════════════════════════════════════════════════════

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 7000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.borderLight}`, gap: 12 }}>
    <span style={{ fontSize: 13, color: C.textSub, fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 700, color: accent || C.text, fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right' }}>{value ?? '—'}</span>
  </div>
);

// "No-box" section — content flows in the page, with just a colored heading
// row separating sections. No card background, no surrounding border.
const SectionCard = ({ icon, title, children, style }) => (
  <div style={{ ...style }}>
    {title && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 0 9px 0', borderBottom: `2px solid ${C.primary}`, marginBottom: 14 }}>
        {icon && <Ic n={icon} size={15} color={C.primary} />}
        <span style={{ fontSize: 13, fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
      </div>
    )}
    <div>{children}</div>
  </div>
);

// Color-filled stat card (matches the dashboard / live-stats look). The whole
// box is the brand color so the value stands out at a glance.
const StatCard = ({ label, value, color = C.primary, icon }) => (
  <div style={{ background: color, borderRadius: 0, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: 92 }}>
    <div style={{ position: 'absolute', right: -18, top: -18, width: 90, height: 90, background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.05, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
    {icon && (
      <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <Ic n={icon} size={20} color="#FFFFFF" sw={1.6} />
      </div>
    )}
  </div>
);

const Empty = ({ msg }) => (
  <div style={{ textAlign: 'center', padding: '36px 20px', color: C.textLight, background: C.white, borderRadius: 0, border: '1px dashed #CBD5E1', fontSize: 14, fontWeight: 600 }}>{msg}</div>
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
  const cellInfo = ds?.cellInfo;
  return (
    // Multi-column grid: cards lay out 2/3/4 across at wider widths so the
    // panel stops looking like a single very-tall column. minmax(280px, 1fr)
    // keeps each card readable at narrower peeks.
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, alignItems: 'start' }}>
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
        <InfoRow label="Battery"    value={status?.battery != null ? (ds?.deviceType === 'AIS140' ? `${status.battery} V` : `${status.battery}%`) : null} />
        <InfoRow label="Voltage"    value={status?.voltage != null ? `${status.voltage} V` : null} />
        <InfoRow label="GSM Signal" value={status?.gsmSignal != null ? `${status.gsmSignal}` : null} />
        {/* AIS-140: emergency panic button state */}
        {ds?.deviceType === 'AIS140' && (
          <InfoRow
            label="Emergency"
            value={status?.emergency === true ? 'ACTIVE 🆘' : status?.emergency === false ? 'Normal' : null}
            accent={status?.emergency === true ? '#7C3AED' : undefined}
          />
        )}
        {/* AIS-140: tamper alert */}
        {ds?.deviceType === 'AIS140' && (
          <InfoRow
            label="Tamper"
            value={status?.tamper === true ? 'ALERT ⚠️' : status?.tamper === false ? 'Normal' : null}
            accent={status?.tamper === true ? '#DC2626' : undefined}
          />
        )}
        {/* Oil Cut — GT06 specific flag, not applicable to FMB/AIS140 */}
        {!['FMB125', 'FMB920', 'AIS140'].includes(ds?.deviceType) && (
          <InfoRow label="Oil Cut" value={status?.oil !== undefined ? (status.oil ? 'Active' : 'Normal') : null} />
        )}
      </SectionCard>
      {(fuel || engine) && (
        <SectionCard icon="droplet" title="Fuel & Engine">
          {fuel?.level != null ? (
            // CAN bus fuel level — percentage gauge
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>CAN Fuel Level</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: fuel.level < 20 ? C.danger : C.success }}>{Math.round(fuel.level)}%</span>
              </div>
              <div style={{ height: 8, background: C.borderLight, borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, fuel.level))}%`, background: fuel.level < 20 ? C.danger : fuel.level < 40 ? C.warning : C.success, borderRadius: 4 }} />
              </div>
            </div>
          ) : fuel?.llsLevel != null ? (
            // LLS sensor fuel level — raw mm
            <InfoRow label="LLS Fuel Level" value={`${fuel.llsLevel} mm`} accent={C.primary} />
          ) : fuel?.ulLevel != null ? (
            // Ultrasonic sensor fuel level — mm
            <InfoRow label="UL202 Fuel Level" value={`${fuel.ulLevel.toFixed(1)} mm`} accent={C.primary} />
          ) : fuel?.sensorVoltage != null ? (
            // Analog resistive sensor — raw voltage
            <InfoRow label="Fuel Sensor (Analog)" value={`${(fuel.sensorVoltage / 1000).toFixed(3)} V (${fuel.sensorVoltage} mV)`} accent={C.warning} />
          ) : null}
          {fuel?.llsLevel1 != null && <InfoRow label="LLS 1" value={`${fuel.llsLevel1} mm`} />}
          {fuel?.llsLevel2 != null && <InfoRow label="LLS 2" value={`${fuel.llsLevel2} mm`} />}
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
      {/* AIS-140 cell tower info */}
      {ds?.deviceType === 'AIS140' && cellInfo && (
        <SectionCard icon="signal" title="Cell Tower">
          <InfoRow label="Operator" value={cellInfo.operator} />
          <InfoRow label="MCC"      value={cellInfo.mcc} mono />
          <InfoRow label="MNC"      value={cellInfo.mnc} mono />
          <InfoRow label="LAC"      value={cellInfo.lac} mono />
          <InfoRow label="Cell ID"  value={cellInfo.cellId} mono />
        </SectionCard>
      )}
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
  const { user } = useAuth();
  const trips = Array.isArray(reportData?.rows) ? reportData.rows : [];
  const total = reportData?.total ?? trips.length;
  const handleLoad = () => { setReportPage(0); fetchReport(vehicle.id, 'trips', reportFrom, reportTo, 0); };
  const [sharingIdx, setSharingIdx] = useState(null);
  const [reprocessing, setReprocessing] = useState(false);
  const handleReprocess = async () => {
    if (!reportFrom || !reportTo) { toast.error('Select a date range first'); return; }
    if (!window.confirm(`Reprocess trips for ${reportFrom} to ${reportTo}? This will delete existing trips in this range and rebuild from raw GPS packets.`)) return;
    setReprocessing(true);
    try {
      const res = await reprocessVehicleData(vehicle.id, reportFrom, reportTo);
      toast.success(`Reprocessed: ${res.data?.processed || 0} packets, ${res.data?.tripsCreated || 0} trips created`);
      handleLoad();
    } catch (err) { toast.error(err?.response?.data?.message || 'Reprocess failed'); }
    finally { setReprocessing(false); }
  };
  const handleShareTrip = async (trip, idx) => {
    setSharingIdx(idx);
    try {
      const res = await createTripShare(vehicle.id, trip.beginning, trip.end);
      const token = res.data?.token;
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard!');
    } catch { toast.error('Failed to create share link'); }
    finally { setSharingIdx(null); }
  };
  const inpSq = { ...inp, borderRadius: 0, fontSize: 14, padding: '8px 12px' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar — flat row, no card box */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '0 0 12px 0', borderBottom: `2px solid ${C.primary}` }}>
        <Ic n="calendar" size={16} color={C.primary} />
        <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ ...inpSq, width: 'auto' }} />
        <span style={{ color: C.textLight, fontSize: 13, fontWeight: 600 }}>to</span>
        <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ ...inpSq, width: 'auto' }} />
        <button onClick={handleLoad} style={{ ...btn(C.primary), borderRadius: 0, padding: '9px 18px', fontSize: 13, letterSpacing: '0.04em' }}>LOAD</button>
        {trips.length > 0 && <span style={{ fontSize: 13, color: C.textSub, fontWeight: 700 }}>{total} TRIP{total !== 1 ? 'S' : ''}</span>}
        {user?.role === 'papa' && (
          <>
            <div style={{ flex: 1 }} />
            <button onClick={handleReprocess} disabled={reprocessing} style={{ ...btn('#dc2626', reprocessing), borderRadius: 0, padding: '9px 16px', fontSize: 13, letterSpacing: '0.04em' }}>
              <Ic n="refresh" size={13} /> {reprocessing ? 'REPROCESSING…' : 'REPROCESS'}
            </button>
          </>
        )}
      </div>

      {reportLoading && <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, fontSize: 14, fontWeight: 600 }}>Loading trips…</div>}
      {!reportLoading && !reportData && <Empty msg='Select a date range and click "LOAD".' />}
      {!reportLoading && reportData && trips.length === 0 && <Empty msg="No trips found for this period." />}

      {/* Trip rows — bottom-divider only, no surrounding box */}
      {trips.length > 0 && (
        <div>
          {trips.map((trip, idx) => {
            const start = trip.beginning;
            const end   = trip.end;
            return (
              <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                <div style={{ width: 40, height: 40, background: C.primary, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0, borderRadius: 0 }}>
                  {trip.no || reportPage * REPORT_PAGE_SIZE + idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {start ? new Date(start).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      {end && trip.status !== 'in_progress' && <span style={{ color: C.textMuted, fontWeight: 500 }}> → {new Date(end).toLocaleString('en-IN', { timeStyle: 'short' })}</span>}
                    </span>
                    {trip.status === 'in_progress' && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 0, background: '#16A34A', color: '#FFFFFF', letterSpacing: '0.05em' }}>
                        LIVE
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: C.textSub, fontWeight: 600 }}>
                    {trip.mileage !== undefined && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="route" size={13} color={C.primary} /> <strong style={{ color: C.text }}>{Number(trip.mileage || 0).toFixed(2)}</strong> km</span>}
                    {trip.duration && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="clock" size={13} color={C.primary} /> {trip.duration}</span>}
                    {trip.avgSpeed !== undefined && <span>Avg <strong style={{ color: C.text }}>{parseFloat(trip.avgSpeed || 0).toFixed(1)}</strong> km/h</span>}
                    {trip.consFls !== undefined && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="droplet" size={13} color={C.primary} /> <strong style={{ color: C.text }}>{Number(trip.consFls || 0).toFixed(2)}</strong> L</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                  <button onClick={() => openPlayer(vehicle, start, end)} disabled={!start} style={{ ...btn(C.purple, !start), borderRadius: 0, padding: '8px 14px', fontSize: 12, letterSpacing: '0.04em' }}>
                    <Ic n="play" size={12} /> PLAY
                  </button>
                  <button onClick={() => handleShareTrip(trip, idx)} disabled={!start || sharingIdx === idx} style={{ ...btn('#059669', !start || sharingIdx === idx), borderRadius: 0, padding: '8px 14px', fontSize: 12, letterSpacing: '0.04em' }}>
                    🔗 {sharingIdx === idx ? '…' : 'SHARE'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > REPORT_PAGE_SIZE && (
        <div style={{ display: 'flex', gap: 0, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
          <button disabled={reportPage === 0} onClick={() => { setReportPage(reportPage - 1); fetchReport(vehicle.id, 'trips', reportFrom, reportTo, reportPage - 1); }}
            style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 0, background: C.white, cursor: reportPage === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}>← PREV</button>
          <span style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, color: C.textSub }}>Page {reportPage + 1} of {Math.ceil(total / REPORT_PAGE_SIZE)}</span>
          <button disabled={(reportPage + 1) * REPORT_PAGE_SIZE >= total} onClick={() => { setReportPage(reportPage + 1); fetchReport(vehicle.id, 'trips', reportFrom, reportTo, reportPage + 1); }}
            style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 0, background: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}>NEXT →</button>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Reports Tab
// ══════════════════════════════════════════════════════════════════════════════
const ReportsTab = ({ vehicle, reportTab, setReportTab, reportFrom, reportTo, setReportFrom, setReportTo, reportData, reportLoading, reportPage, setReportPage, reportExporting, packetsDownloading, fetchReport, handleExport, handleDownloadPackets }) => {
  const TABS = [
    { id: 'summary',      label: 'Summary',    icon: 'chart' },
    { id: 'daily',        label: 'Daily',       icon: 'calendar' },
    { id: 'engineHours',  label: 'Engine Hrs',  icon: 'clock' },
    { id: 'fuelFillings', label: 'Fuel Fills',  icon: 'droplet' },
    { id: 'fuel',         label: 'Fuel',        icon: 'droplet' },
  ];
  const handleLoad = () => { setReportPage(0); fetchReport(vehicle.id, reportTab, reportFrom, reportTo, 0); };
  const inpSq = { ...inp, borderRadius: 0, fontSize: 14, padding: '8px 12px' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar — flat, no card box */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '0 0 12px 0', borderBottom: `2px solid ${C.primary}` }}>
        <input type="datetime-local" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ ...inpSq, width: 'auto' }} />
        <span style={{ color: C.textLight, fontSize: 13, fontWeight: 600 }}>to</span>
        <input type="datetime-local" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ ...inpSq, width: 'auto' }} />
        <button onClick={handleLoad} style={{ ...btn(C.primary), borderRadius: 0, padding: '9px 18px', fontSize: 13, letterSpacing: '0.04em' }}>LOAD</button>
        <div style={{ flex: 1 }} />
        <button onClick={handleExport} disabled={reportExporting} style={{ ...btn('#059669', reportExporting), borderRadius: 0, padding: '9px 16px', fontSize: 13, letterSpacing: '0.04em' }}>
          <Ic n="download" size={13} /> {reportExporting ? 'EXPORTING…' : 'EXCEL'}
        </button>
        <button onClick={handleDownloadPackets} disabled={packetsDownloading} style={{ ...btn('#6366f1', packetsDownloading), borderRadius: 0, padding: '9px 16px', fontSize: 13, letterSpacing: '0.04em' }}>
          <Ic n="download" size={13} /> {packetsDownloading ? '…' : 'PACKETS'}
        </button>
      </div>

      {/* Sub-tab strip — square buttons, color-fill on active */}
      <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setReportTab(t.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', border: 'none', background: reportTab === t.id ? C.primary : '#F1F5F9', color: reportTab === t.id ? '#FFFFFF' : C.textSub }}>
            <Ic n={t.icon} size={13} color={reportTab === t.id ? '#FFFFFF' : '#9ca3af'} /> {t.label.toUpperCase()}
          </button>
        ))}
      </div>
      {reportLoading && <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, fontSize: 14, fontWeight: 600 }}>Loading report…</div>}
      {!reportLoading && !reportData && <Empty msg="Select a date range and click LOAD." />}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 0 }}>
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
      <div style={{ borderRadius: 0, border: `1px solid ${C.border}`, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--theme-table-body-font-size, 11px)', minWidth: 500 }}>
          <thead>
            <tr style={{ background: 'var(--theme-table-header-bg, #f8fafc)' }}>
              {['Date','Distance','Eng Hrs','Fuel (L)','km/L','Parking'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', borderBottom: `1px solid var(--theme-table-border, #e2e8f0)`, fontSize: 'var(--theme-table-header-font-size, 10px)', textTransform: 'uppercase', whiteSpace: 'nowrap', background: 'var(--theme-table-header-bg, #f8fafc)' }}>{h}</th>
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
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sessions.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.borderLight}` }}>
            <div style={{ width: 40, height: 40, borderRadius: 0, background: C.teal, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
              {s.no || reportPage * REPORT_PAGE_SIZE + i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                {s.beginning ? new Date(s.beginning).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                {s.end && <span style={{ color: C.textMuted, fontWeight: 500 }}> → {new Date(s.end).toLocaleString('en-IN', { timeStyle: 'short' })}</span>}
              </div>
              <div style={{ fontSize: 13, color: C.textSub, display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 5, fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="clock" size={13} color={C.teal} /> {s.engineHours || '—'}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="route" size={13} color={C.primary} /> <strong style={{ color: C.text }}>{Number(s.mileage || 0).toFixed(1)}</strong> km</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="droplet" size={13} color={C.warning} /> <strong style={{ color: C.text }}>{Number(s.consFls || 0).toFixed(2)}</strong> L</span>
              </div>
            </div>
          </div>
        ))}
        {sessions.length === 0 && <Empty msg="No engine sessions found." />}
        {total > REPORT_PAGE_SIZE && (
          <div style={{ display: 'flex', gap: 0, justifyContent: 'center', marginTop: 14 }}>
            <button disabled={reportPage === 0} onClick={() => { setReportPage(reportPage - 1); fetchReport(vehicle.id, 'engineHours', reportFrom, reportTo, reportPage - 1); }} style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 0, background: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}>← PREV</button>
            <span style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, color: C.textSub }}>Page {reportPage + 1}</span>
            <button disabled={(reportPage + 1) * REPORT_PAGE_SIZE >= total} onClick={() => { setReportPage(reportPage + 1); fetchReport(vehicle.id, 'engineHours', reportFrom, reportTo, reportPage + 1); }} style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 0, background: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub }}>NEXT →</button>
          </div>
        )}
      </div>
    );
  }
  if (type === 'trips') {
    const trips = Array.isArray(data?.rows) ? data.rows : [];
    return (
      <div style={{ borderRadius: 0, border: `1px solid ${C.border}`, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--theme-table-body-font-size, 11px)', minWidth: 480 }}>
          <thead>
            <tr style={{ background: 'var(--theme-table-header-bg, #f8fafc)' }}>
              {['#','Start','End','Distance','Duration','Fuel'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', borderBottom: `1px solid var(--theme-table-border, #e2e8f0)`, fontSize: 'var(--theme-table-header-font-size, 10px)', textTransform: 'uppercase', whiteSpace: 'nowrap', background: 'var(--theme-table-header-bg, #f8fafc)' }}>{h}</th>
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
      <div>
        {events.map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.borderLike || C.borderLight}` }}>
            <div style={{ width: 40, height: 40, borderRadius: 0, background: C.success, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ic n="droplet" size={18} color="#FFFFFF" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ev.time ? new Date(ev.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</div>
              <div style={{ fontSize: 13, color: C.textSub, marginTop: 5, display: 'flex', gap: 14, fontWeight: 600 }}>
                <span><strong style={{ color: C.text }}>{ev.fuelBefore}%</strong> → <strong style={{ color: C.text }}>{ev.fuelAfter}%</strong></span>
                <span style={{ color: C.success, fontWeight: 800 }}>+{ev.filled}% ADDED</span>
              </div>
              {ev.location && ev.location !== '—' && <div style={{ fontSize: 12, color: C.textLight, marginTop: 3 }}>{ev.location}</div>}
            </div>
          </div>
        ))}
        {events.length === 0 && <Empty msg="No fuel fill events found." />}
      </div>
    );
  }
  if (type === 'fuel') {
    return <FuelReportView data={data} />;
  }
  return null;
};

// ══════════════════════════════════════════════════════════════════════════════
// Fuel report — summary row + SVG line chart + readings table
// ══════════════════════════════════════════════════════════════════════════════
const FuelReportView = ({ data }) => {
  if (!data) return null;
  if (data.supported === false) {
    return (
      <div style={{ background: '#FEF3C7', borderLeft: '4px solid #F59E0B', borderRadius: 0, padding: '16px 20px', color: '#92400E' }}>
        <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fuel sensor not configured</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{data.message || 'Enable "Fuel sensor wired" in Edit Vehicle and set the tank capacity to use this report.'}</div>
      </div>
    );
  }

  const readings = Array.isArray(data.readings) ? data.readings : [];
  const s = data.summary || {};
  const tank = data.tankCapacity;

  // Color-filled stat boxes — match the dashboard / live-stats pattern.
  const stat = (label, val, unit = '', color = C.primary) => (
    <div style={{ flex: 1, minWidth: 140, background: color, color: '#FFFFFF', borderRadius: 0, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -10, top: -10, width: 60, height: 60, background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em', position: 'relative', zIndex: 1 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginTop: 4, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, letterSpacing: '-0.01em', position: 'relative', zIndex: 1 }}>
        {val == null ? '—' : typeof val === 'number' ? val.toFixed(val < 10 ? 2 : 1) : val}
        {val != null && unit && <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary cards — color filled */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 0 }}>
        {stat('Readings', s.count, '', '#475569')}
        {stat('Start', s.startL ?? s.startPct, s.startL != null ? 'L' : '%', C.primary)}
        {stat('End',   s.endL   ?? s.endPct,   s.endL   != null ? 'L' : '%', C.primary)}
        {stat('Min',   tank ? (s.minPct * tank / 100) : s.minPct, tank ? 'L' : '%', '#DC2626')}
        {stat('Max',   tank ? (s.maxPct * tank / 100) : s.maxPct, tank ? 'L' : '%', '#16A34A')}
        {stat('Filled',  s.totalFillL ?? s.totalFill, s.totalFillL != null ? 'L' : '%', '#059669')}
        {stat('Drained', s.totalDropL ?? s.totalDrop, s.totalDropL != null ? 'L' : '%', '#D97706')}
      </div>

      {/* Chart */}
      <FuelLineChart readings={readings} tankCapacity={tank} />

      {/* Table */}
      {readings.length > 0 ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: C.surface, zIndex: 1 }}>
                <tr>
                  <th style={thSt}>#</th>
                  <th style={thSt}>Time</th>
                  <th style={thSt}>Level %</th>
                  {tank ? <th style={thSt}>Level (L)</th> : null}
                  <th style={thSt}>Ignition</th>
                  <th style={thSt}>Speed</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={tdSt}>{i + 1}</td>
                    <td style={tdSt}>{new Date(r.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                    <td style={tdSt}>{Number(r.levelPct).toFixed(1)}%</td>
                    {tank ? <td style={tdSt}>{r.levelL != null ? Number(r.levelL).toFixed(1) : '—'}</td> : null}
                    <td style={tdSt}>{r.ignition === true ? 'ON' : r.ignition === false ? 'OFF' : '—'}</td>
                    <td style={tdSt}>{r.speed != null ? `${r.speed} km/h` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Empty msg="No fuel readings in the selected range." />
      )}
    </div>
  );
};

const thSt = { textAlign: 'left', padding: '8px 10px', fontWeight: 700, fontSize: 11, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.04em' };
const tdSt = { padding: '8px 10px', color: C.text, fontVariantNumeric: 'tabular-nums' };

// Inline SVG line chart — no external chart dep. X axis is time, Y axis is
// fuel %. Hover on the chart body to read the nearest sample.
const FuelLineChart = ({ readings, tankCapacity }) => {
  const [hoverIdx, setHoverIdx] = useState(null);
  if (!readings || readings.length < 2) {
    return (
      <div style={{ background: C.surface, border: `1px dashed #CBD5E1`, borderRadius: 0, padding: 28, textAlign: 'center', color: C.textLight, fontSize: 13, fontWeight: 600 }}>
        Need at least 2 readings to plot a chart.
      </div>
    );
  }

  const W = 760, H = 220;
  const PAD = { top: 14, right: 14, bottom: 26, left: 42 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  const t0 = new Date(readings[0].timestamp).getTime();
  const t1 = new Date(readings[readings.length - 1].timestamp).getTime();
  const tSpan = Math.max(1, t1 - t0);

  const xOf = (ts) => PAD.left + ((new Date(ts).getTime() - t0) / tSpan) * innerW;
  const yOf = (pct) => PAD.top  + (1 - Math.max(0, Math.min(100, pct)) / 100) * innerH;

  const pts = readings.map(r => `${xOf(r.timestamp).toFixed(1)},${yOf(r.levelPct).toFixed(1)}`).join(' ');
  const areaPath = `M ${xOf(readings[0].timestamp).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L ${pts.replace(/ /g, ' L ')} L ${xOf(readings[readings.length-1].timestamp).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  // Y ticks at 0, 25, 50, 75, 100 %
  const yTicks = [0, 25, 50, 75, 100];
  // X ticks — 4 evenly spaced samples
  const xTickCount = 4;
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) =>
    new Date(t0 + (tSpan * i) / xTickCount)
  );

  const fmtTick = (d) => d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    // Find nearest reading
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < readings.length; i++) {
      const d = Math.abs(xOf(readings[i].timestamp) * rect.width / W - xPx);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    setHoverIdx(best);
  };

  const hovered = hoverIdx != null ? readings[hoverIdx] : null;

  return (
    <div style={{ borderRadius: 0, padding: '0 0 6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fuel Level vs Time</div>
        {hovered && (
          <div style={{ fontSize: 11, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
            {new Date(hovered.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
            {' · '}
            <strong>{hovered.levelPct.toFixed(1)}%</strong>
            {tankCapacity ? ` (${(hovered.levelPct * tankCapacity / 100).toFixed(1)} L)` : ''}
            {hovered.ignition != null && ` · IGN ${hovered.ignition ? 'ON' : 'OFF'}`}
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none"
           onMouseMove={handleMove}
           onMouseLeave={() => setHoverIdx(null)}
           style={{ display: 'block', cursor: 'crosshair' }}>
        {/* Y grid + ticks */}
        {yTicks.map(t => {
          const y = yOf(t);
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{t}%</text>
            </g>
          );
        })}
        {/* X ticks */}
        {xTicks.map((d, i) => {
          const x = xOf(d);
          return (
            <text key={i} x={x} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {fmtTick(d)}
            </text>
          );
        })}
        {/* Filled area */}
        <path d={areaPath} fill="#3b82f620" />
        {/* Line */}
        <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {/* Hover crosshair + dot */}
        {hovered && (
          <>
            <line x1={xOf(hovered.timestamp)} x2={xOf(hovered.timestamp)} y1={PAD.top} y2={PAD.top + innerH} stroke="#94a3b8" strokeDasharray="3,3" strokeWidth="1" />
            <circle cx={xOf(hovered.timestamp)} cy={yOf(hovered.levelPct)} r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Sensors Tab
// ══════════════════════════════════════════════════════════════════════════════
const SensorsTab = ({ vehicle, sensors, loadingSensors, showSensorForm, sensorForm, editingSensor, savingSensor, setSensorForm, setShowSensorForm, openSensorForm, handleSaveSensor, handleDeleteSensor }) => {
  const io = vehicle.deviceStatus?.gpsData?.ioElements || {};
  const gps = vehicle.deviceStatus?.gpsData || {};
  const dst = vehicle.deviceStatus?.status || {};
  const dfuel = vehicle.deviceStatus?.fuel || {};

  // Build flat list of all available device attributes for dropdown
  const availableAttrs = useMemo(() => {
    const attrs = [];
    // GPS-level attributes
    const gpsKeys = ['speed', 'latitude', 'longitude', 'altitude', 'satellites', 'course', 'heading', 'hdop'];
    gpsKeys.forEach(k => { if (gps[k] != null) attrs.push({ key: k, label: k, value: gps[k], group: 'GPS' }); });
    // Status attributes
    Object.entries(dst).forEach(([k, v]) => { if (v != null && typeof v !== 'object') attrs.push({ key: `status.${k}`, label: k, value: v, group: 'Status' }); });
    // Fuel attributes
    Object.entries(dfuel).forEach(([k, v]) => { if (v != null && typeof v !== 'object') attrs.push({ key: `fuel.${k}`, label: k, value: v, group: 'Fuel' }); });
    // IO elements
    Object.entries(io).forEach(([k, v]) => {
      const val = typeof v === 'object' && v !== null ? v.value : v;
      attrs.push({ key: k, label: k, value: val, group: 'IO' });
    });
    return attrs;
  }, [gps, dst, dfuel, io]);

  // Resolve live value for a mapped parameter
  const resolveLive = (param) => {
    if (!param) return undefined;
    if (param.startsWith('status.')) return dst[param.slice(7)];
    if (param.startsWith('fuel.')) return dfuel[param.slice(5)];
    if (['speed','latitude','longitude','altitude','satellites','course','heading','hdop'].includes(param)) return gps[param];
    const raw = io[param];
    return raw !== undefined ? (typeof raw === 'object' && raw !== null ? raw.value : raw) : undefined;
  };

  const inpSq = { ...inp, borderRadius: 0, fontSize: 14, padding: '10px 14px' };
  const lblBig = { ...lbl, fontSize: 12, marginBottom: 6 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── Configured sensors ─────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'space-between', padding: '0 0 9px 0', borderBottom: `2px solid ${C.primary}`, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Ic n="radio" size={15} color={C.primary} />
            <span style={{ fontSize: 13, fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sensors ({sensors.length})</span>
          </div>
          <button onClick={() => openSensorForm(null)} style={{ ...btn(C.primary), borderRadius: 0, padding: '8px 16px', fontSize: 13, letterSpacing: '0.04em' }}>
            <Ic n="plus" size={13} /> ADD SENSOR
          </button>
        </div>

        {showSensorForm && (
          <div style={{ marginBottom: 16, padding: '14px 16px', background: C.surface, borderLeft: `4px solid ${C.primary}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lblBig}>Device Attribute *</label>
                <select style={inpSq} value={sensorForm.mappedParameter || ''} onChange={e => {
                  const attr = availableAttrs.find(a => a.key === e.target.value);
                  setSensorForm({ ...sensorForm, mappedParameter: e.target.value, name: sensorForm.name || (attr ? attr.label : '') });
                }}>
                  <option value="">Select attribute…</option>
                  {['GPS', 'Status', 'Fuel', 'IO'].map(group => {
                    const items = availableAttrs.filter(a => a.group === group);
                    return items.length > 0 ? (
                      <optgroup key={group} label={group}>
                        {items.map(a => (
                          <option key={a.key} value={a.key}>{a.label} ({String(a.value)})</option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
              </div>
              <div>
                <label style={lblBig}>Friendly Name *</label>
                <input style={inpSq} value={sensorForm.name} onChange={e => setSensorForm({ ...sensorForm, name: e.target.value })} placeholder="e.g. Ignition, Temperature" />
              </div>
              <div>
                <label style={lblBig}>Unit</label>
                <input style={inpSq} value={sensorForm.unit} onChange={e => setSensorForm({ ...sensorForm, unit: e.target.value })} placeholder="e.g. °C, km/h" />
              </div>
              <div>
                <label style={lblBig}>Type</label>
                <select style={inpSq} value={sensorForm.type} onChange={e => setSensorForm({ ...sensorForm, type: e.target.value })}>{SENSOR_TYPES.map(t => <option key={t}>{t}</option>)}</select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 0, alignItems: 'center', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSensorForm(false)} style={{ padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 0, background: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSub, letterSpacing: '0.04em' }}>CANCEL</button>
              <button onClick={handleSaveSensor} disabled={savingSensor || !sensorForm.name || !sensorForm.mappedParameter} style={{ ...btn(C.primary, savingSensor || !sensorForm.name || !sensorForm.mappedParameter), borderRadius: 0, padding: '9px 18px', fontSize: 13, letterSpacing: '0.04em' }}>{savingSensor ? 'SAVING…' : editingSensor ? 'UPDATE' : 'ADD'}</button>
            </div>
          </div>
        )}

        {loadingSensors && <div style={{ padding: 24, textAlign: 'center', color: C.textLight, fontSize: 14, fontWeight: 600 }}>Loading…</div>}
        {!loadingSensors && sensors.length === 0 && !showSensorForm && (
          <div style={{ padding: '32px 20px', textAlign: 'center', border: '1px dashed #CBD5E1' }}>
            <div style={{ fontSize: 14, color: C.textSub, marginBottom: 4, fontWeight: 700 }}>No sensors configured yet.</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Click "ADD SENSOR" to map a device attribute to a friendly name.</div>
          </div>
        )}

        {sensors.length > 0 && (
          // Color-filled tiles for each sensor (matches the live-stats row aesthetic).
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 0 }}>
            {sensors.map(s => {
              const live = resolveLive(s.mappedParameter);
              const fill = live !== undefined ? C.primary : '#94A3B8';
              return (
                <div key={s.id} style={{ background: fill, color: '#FFFFFF', padding: '14px 16px', position: 'relative', minHeight: 88 }}>
                  <div style={{ position: 'absolute', right: -10, top: -10, width: 60, height: 60, background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 38, position: 'relative', zIndex: 1 }}>{s.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, letterSpacing: '-0.01em', position: 'relative', zIndex: 1 }}>
                    {live !== undefined ? String(live) : '—'}
                    {s.unit && <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>{s.unit}</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.70)', marginTop: 4, fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>{s.mappedParameter}</div>
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 2, zIndex: 2 }}>
                    <button onClick={() => openSensorForm(s)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><Ic n="edit" size={12} color="#FFFFFF" /></button>
                    <button onClick={() => handleDeleteSensor(s.id)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><Ic n="trash" size={12} color="#FFFFFF" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Raw device data ─────────────────────────────────────────── */}
      {Object.keys(io).length > 0 && (
        <SectionCard icon="radio" title="Raw Device Data">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 0 }}>
            {Object.entries(io).slice(0, 30).map(([k, v]) => {
              const label = typeof v === 'object' && v !== null ? (v.name || k) : k;
              const val   = typeof v === 'object' && v !== null ? v.value : v;
              return (
                <div key={k} style={{ background: C.surface, borderRadius: 0, padding: '10px 12px', borderRight: `1px solid ${C.borderLight}`, borderBottom: `1px solid ${C.borderLight}` }}>
                  <div style={{ fontSize: 10.5, color: C.textLight, fontFamily: 'monospace', marginBottom: 4, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{String(val ?? '—')}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Edit Tab
// ══════════════════════════════════════════════════════════════════════════════
const EditTab = ({ editForm, setEditForm, saving, handleSaveEdit, currentImei = '', onRequestImeiEdit }) => {
  const [imeiUnlocked, setImeiUnlocked] = useState(false);
  const [imeiDraft, setImeiDraft] = useState(currentImei);

  useEffect(() => {
    setImeiDraft(currentImei);
    setImeiUnlocked(false);
  }, [currentImei]);

  // ── Single unified grid ────────────────────────────────────────────────
  // All sections share one CSS grid that spans the full width of the bottom
  // sheet. Section headings are full-row separators (gridColumn: 1 / -1) so
  // fields from different sections still line up to the same column count.
  // No outer cards, no boxes — fields read as a single dense form.
  const fullRow   = { gridColumn: '1 / -1' };
  const sectionHd = (icon, title) => (
    <div style={{ ...fullRow, display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 9px 0', borderBottom: `2px solid ${C.primary}`, marginTop: 6 }}>
      <Ic n={icon} size={15} color={C.primary} />
      <span style={{ fontSize: 13, fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 18, rowGap: 16, alignItems: 'start' }}>

      {/* ── Vehicle Identity ────────────────────────────────────────────── */}
      {sectionHd('info', 'Vehicle Identity')}

      <div>
        <label className="fv-label">Vehicle Name</label>
        <input className="fv-input" value={editForm.vehicleName || ''} onChange={e => setEditForm({ ...editForm, vehicleName: e.target.value })} placeholder="My Vehicle" />
      </div>
      <div>
        <label className="fv-label">Registration Number</label>
        <input className="fv-input fv-mono" style={{ textTransform: 'uppercase' }} value={editForm.vehicleNumber || ''} onChange={e => setEditForm({ ...editForm, vehicleNumber: e.target.value })} placeholder="DL01AB1234" />
      </div>
      <div>
        <label className="fv-label">Chassis Number</label>
        <input className="fv-input" value={editForm.chasisNumber || ''} onChange={e => setEditForm({ ...editForm, chasisNumber: e.target.value })} />
      </div>
      <div>
        <label className="fv-label">Engine Number</label>
        <input className="fv-input" value={editForm.engineNumber || ''} onChange={e => setEditForm({ ...editForm, engineNumber: e.target.value })} />
      </div>
      <div>
        <label className="fv-label">Status</label>
        <select className="fv-input" value={editForm.status || 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Icon picker fills the row */}
      <div style={fullRow}>
        <label className="fv-label">Vehicle Icon</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {VEHICLE_ICONS.map(ic => (
            <button key={ic} type="button" title={VEHICLE_ICON_LABELS[ic] || ic}
              onClick={() => setEditForm({ ...editForm, vehicleIcon: ic })}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '8px 5px', width: 84, borderRadius: 0,
                border: `2px solid ${editForm.vehicleIcon === ic ? C.primary : '#CBD5E1'}`,
                background: editForm.vehicleIcon === ic ? C.primary : '#FFFFFF',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'border-color 0.15s, background 0.15s',
              }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{VEHICLE_ICON_MAP[ic]}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: editForm.vehicleIcon === ic ? '#FFFFFF' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {VEHICLE_ICON_LABELS[ic] || ic}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Device & SIMs ───────────────────────────────────────────────── */}
      {sectionHd('radio', 'Device & SIMs')}

      <div style={fullRow}>
        <label className="fv-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>IMEI Number</span>
          {!imeiUnlocked ? (
            <button type="button" onClick={() => setImeiUnlocked(true)}
              style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: '3px 10px', borderRadius: 0, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}>
              🔒 UNLOCK TO EDIT
            </button>
          ) : (
            <button type="button" onClick={() => { setImeiUnlocked(false); setImeiDraft(currentImei); }}
              style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '3px 10px', borderRadius: 0, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}>
              CANCEL
            </button>
          )}
        </label>
        <input
          className="fv-input fv-mono"
          value={imeiDraft || ''}
          onChange={e => setImeiDraft(e.target.value)}
          readOnly={!imeiUnlocked}
          maxLength={20}
          placeholder="Device IMEI"
        />
        {imeiUnlocked && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => onRequestImeiEdit?.(imeiDraft)}
              disabled={!imeiDraft.trim() || imeiDraft.trim() === currentImei}
              style={{ padding: '10px 18px', border: 'none', borderRadius: 0,
                background: (!imeiDraft.trim() || imeiDraft.trim() === currentImei) ? '#FCA5A5' : '#DC2626',
                color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                cursor: (!imeiDraft.trim() || imeiDraft.trim() === currentImei) ? 'not-allowed' : 'pointer' }}>
              CHANGE IMEI…
            </button>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
          Changing IMEI rebinds the vehicle to a different GPS device. A confirmation phrase will be required.
        </div>
      </div>

      <div>
        <label className="fv-label">SIM 1 <span style={{ color: '#94a3b8', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span></label>
        <input className="fv-input fv-mono" value={editForm.sim1 || ''} onChange={e => setEditForm({ ...editForm, sim1: e.target.value })} maxLength={20} placeholder="e.g. 9876543210" />
      </div>
      <div>
        <label className="fv-label">SIM 2 <span style={{ color: '#94a3b8', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span></label>
        <input className="fv-input fv-mono" value={editForm.sim2 || ''} onChange={e => setEditForm({ ...editForm, sim2: e.target.value })} maxLength={20} placeholder="e.g. 9876543211" />
      </div>

      {/* ── Fuel Sensor ────────────────────────────────────────────────── */}
      {sectionHd('gear', 'Fuel Sensor')}

      <div style={fullRow}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: C.text }}>
          <input
            type="checkbox"
            checked={!!editForm.fuelSupported}
            onChange={e => setEditForm({ ...editForm, fuelSupported: e.target.checked, fuelTankCapacity: e.target.checked ? editForm.fuelTankCapacity : '' })}
            style={{ width: 18, height: 18, accentColor: C.primary, cursor: 'pointer' }}
          />
          Fuel sensor wired
        </label>
        <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, marginTop: 6 }}>
          Enable only for FMB devices with an LLS or CAN fuel sensor. AIS140 and GT06 devices do not support fuel sensors.
        </div>
      </div>
      {editForm.fuelSupported && (
        <div>
          <label className="fv-label">Tank Capacity (litres) <span style={{ color: '#dc2626', textTransform: 'none', letterSpacing: 0 }}>*</span></label>
          <input className="fv-input" type="number" min={1} max={10000}
            value={editForm.fuelTankCapacity || ''}
            onChange={e => setEditForm({ ...editForm, fuelTankCapacity: e.target.value })}
            placeholder="e.g. 60" />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>
            Used to convert fuel % → litres for reports and theft alerts.
          </div>
        </div>
      )}

      {/* ── Thresholds ─────────────────────────────────────────────────── */}
      {sectionHd('gear', 'Thresholds')}

      <div>
        <label className="fv-label">Idle Threshold (minutes)</label>
        <input className="fv-input" type="number" min={1} max={60}
          value={editForm.idleThreshold || 5}
          onChange={e => setEditForm({ ...editForm, idleThreshold: Number(e.target.value) })} />
      </div>
      <div>
        <label className="fv-label">Fuel Fill Threshold (%)</label>
        <input className="fv-input" type="number" min={1} max={50}
          value={editForm.fuelFillThreshold || 5}
          onChange={e => setEditForm({ ...editForm, fuelFillThreshold: Number(e.target.value) })} />
      </div>

      {/* ── Save (full row, large) ─────────────────────────────────────── */}
      <div style={{ ...fullRow, display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
        <button onClick={handleSaveEdit} disabled={saving}
          style={{ ...btn(C.primary, saving), justifyContent: 'center', padding: '13px 36px', borderRadius: 0, fontSize: 14, letterSpacing: '0.05em', minWidth: 240 }}>
          <Ic n="save" size={15} /> {saving ? 'SAVING…' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  );
};

export default MyFleet;

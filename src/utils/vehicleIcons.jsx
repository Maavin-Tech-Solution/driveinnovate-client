/**
 * Central vehicle icon registry.
 *
 * Icons: Microsoft Fluent Emoji 3D (MIT licence)
 * CDN:   https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/
 *
 * Single source of truth — all pages import from here.
 * To swap icons: update ICON_3D map and/or VehicleIcon below.
 */

import React, { useState } from 'react';

// ─── 3D icon CDN map ─────────────────────────────────────────────────────────
const CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

const ICON_3D = {
  car:          `${CDN}/Automobile/3D/automobile_3d.png`,
  suv:          `${CDN}/Sport%20Utility%20Vehicle/3D/sport_utility_vehicle_3d.png`,
  pickup:       `${CDN}/Pickup%20Truck/3D/pickup_truck_3d.png`,
  van:          `${CDN}/Minibus/3D/minibus_3d.png`,
  minibus:      `${CDN}/Minibus/3D/minibus_3d.png`,
  bus:          `${CDN}/Bus/3D/bus_3d.png`,
  schoolbus:    `${CDN}/Bus/3D/bus_3d.png`,
  truck:        `${CDN}/Articulated%20Lorry/3D/articulated_lorry_3d.png`,
  container:    `${CDN}/Articulated%20Lorry/3D/articulated_lorry_3d.png`,
  tanker:       `${CDN}/Articulated%20Lorry/3D/articulated_lorry_3d.png`,
  watertanker:  `${CDN}/Delivery%20Truck/3D/delivery_truck_3d.png`,
  tipper:       `${CDN}/Delivery%20Truck/3D/delivery_truck_3d.png`,
  dumper:       `${CDN}/Delivery%20Truck/3D/delivery_truck_3d.png`,
  sweeper:      `${CDN}/Delivery%20Truck/3D/delivery_truck_3d.png`,
  garbagevan:   `${CDN}/Delivery%20Truck/3D/delivery_truck_3d.png`,
  tractor:      `${CDN}/Tractor/3D/tractor_3d.png`,
  earthmover:   `${CDN}/Tractor/3D/tractor_3d.png`,
  wheelloader:  `${CDN}/Tractor/3D/tractor_3d.png`,
  jcb:          `${CDN}/Building%20Construction/3D/building_construction_3d.png`,
  excavator:    `${CDN}/Building%20Construction/3D/building_construction_3d.png`,
  crane:        `${CDN}/Building%20Construction/3D/building_construction_3d.png`,
  concretepump: `${CDN}/Building%20Construction/3D/building_construction_3d.png`,
  paver:        `${CDN}/Building%20Construction/3D/building_construction_3d.png`,
  roadroller:   `${CDN}/Building%20Construction/3D/building_construction_3d.png`,
  mixer:        `${CDN}/Pickup%20Truck/3D/pickup_truck_3d.png`,
  bike:         `${CDN}/Motorcycle/3D/motorcycle_3d.png`,
  motorcycle:   `${CDN}/Motorcycle/3D/motorcycle_3d.png`,
  auto:         `${CDN}/Auto%20Rickshaw/3D/auto_rickshaw_3d.png`,
  ambulance:    `${CDN}/Ambulance/3D/ambulance_3d.png`,
  mortuaryvan:  `${CDN}/Ambulance/3D/ambulance_3d.png`,
  fire:         `${CDN}/Fire%20Engine/3D/fire_engine_3d.png`,
  police:       `${CDN}/Police%20Car/3D/police_car_3d.png`,
  fury:         `${CDN}/Delivery%20Truck/3D/delivery_truck_3d.png`,
  ajax:         `${CDN}/Delivery%20Truck/3D/delivery_truck_3d.png`,
};

const DEFAULT_3D = `${CDN}/Automobile/3D/automobile_3d.png`;

// ─── Canonical vehicle type list ─────────────────────────────────────────────
export const VEHICLE_ICONS = [
  'car', 'suv', 'pickup', 'van', 'minibus', 'bus', 'schoolbus',
  'truck', 'container', 'tanker', 'watertanker', 'tipper', 'dumper',
  'tractor', 'earthmover', 'jcb', 'excavator', 'crane', 'wheelloader',
  'roadroller', 'paver', 'mixer', 'concretepump', 'sweeper',
  'bike', 'motorcycle', 'auto',
  'ambulance', 'fire', 'police', 'mortuaryvan', 'garbagevan',
  'fury', 'ajax',
];

// ─── Human-readable labels ────────────────────────────────────────────────────
export const VEHICLE_ICON_LABELS = {
  car:          'Car',
  suv:          'SUV',
  pickup:       'Pickup',
  van:          'Van',
  minibus:      'Minibus',
  bus:          'Bus',
  schoolbus:    'School Bus',
  truck:        'Truck',
  container:    'Container',
  tanker:       'Tanker',
  watertanker:  'Water Tanker',
  tipper:       'Tipper',
  dumper:       'Dumper',
  tractor:      'Tractor',
  earthmover:   'Earth Mover',
  jcb:          'JCB',
  excavator:    'Excavator',
  crane:        'Crane',
  wheelloader:  'Wheel Loader',
  roadroller:   'Road Roller',
  paver:        'Paver',
  mixer:        'Transit Mixer',
  concretepump: 'Concrete Pump',
  sweeper:      'Sweeper',
  bike:         'Bike',
  motorcycle:   'Motorcycle',
  auto:         'Auto',
  ambulance:    'Ambulance',
  fire:         'Fire Engine',
  police:       'Police',
  mortuaryvan:  'Mortuary Van',
  garbagevan:   'Garbage Van',
  fury:         'Fury',
  ajax:         'Ajax',
};

// ─── VehicleIcon component ────────────────────────────────────────────────────
// Renders the Fluent Emoji 3D PNG. Falls back to a colored initial badge
// if the CDN image fails to load (offline / slow network).
export const VehicleIcon = ({ type, color = '#3B82F6', size = 40 }) => {
  const src = ICON_3D[type] || DEFAULT_3D;
  const [err, setErr] = useState(false);

  if (err) {
    const label = VEHICLE_ICON_LABELS[type] || 'V';
    const initials = label.slice(0, 2).toUpperCase();
    return (
      <div style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.22),
        background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontWeight: 800,
        fontSize: Math.round(size * 0.36), color: '#FFFFFF',
        letterSpacing: '-0.03em', userSelect: 'none',
        boxShadow: `0 2px 8px ${color}55`,
      }}>
        {initials}
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.22)) drop-shadow(0 1px 3px rgba(0,0,0,0.14))',
      userSelect: 'none',
    }}>
      <img
        src={src}
        alt={VEHICLE_ICON_LABELS[type] || type}
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={() => setErr(true)}
      />
    </div>
  );
};

// ─── Map marker HTML ──────────────────────────────────────────────────────────
// Returns an HTML string for Leaflet L.divIcon.
// Layout: 3D vehicle icon on top + coloured circle badge + arrow pin pointing
// to the exact GPS coordinate.  The iconAnchor is at the pin tip.
export function vehicleMarkerHtml(type, color = '#3B82F6', size = 44, isSelected = false) {
  const src   = ICON_3D[type] || DEFAULT_3D;
  const badge = isSelected ? size + 8 : size;
  const imgSz = Math.round(badge * 0.78);
  const pinH  = 10;
  const border = isSelected ? 3 : 2;
  // Half-widths of the CSS triangle that forms the location pin
  const triHalf = Math.round(badge * 0.22);

  // The coloured circle is always rendered immediately (CSS only, no network).
  // The 3D image loads on top — if CDN is slow the circle is the fallback.
  return [
    `<div style="display:flex;flex-direction:column;align-items:center;width:${badge}px;">`,
      `<div style="`,
        `width:${badge}px;height:${badge}px;`,
        `border-radius:50%;`,
        `background:${color};`,           // solid colour always visible immediately
        `border:${border}px solid rgba(255,255,255,0.9);`,
        `box-shadow:0 2px 8px rgba(0,0,0,0.35);`,
        `display:flex;align-items:center;justify-content:center;`,
        `overflow:hidden;`,
        `position:relative;`,
      `">`,
        // Gloss overlay — pure CSS, instant
        `<div style="position:absolute;inset:0;border-radius:50%;`,
          `background:radial-gradient(circle at 38% 32%,rgba(255,255,255,0.42),transparent 62%);`,
          `pointer-events:none;"></div>`,
        // 3D icon image — loads async; hidden on error, circle stays visible
        `<img src="${src}"`,
          ` width="${imgSz}" height="${imgSz}"`,
          ` style="object-fit:contain;display:block;position:relative;z-index:1;pointer-events:none;"`,
          ` onerror="this.style.display='none'"`,
        `/>`,
      `</div>`,
      // Location pin triangle
      `<div style="`,
        `width:0;height:0;`,
        `border-left:${triHalf}px solid transparent;`,
        `border-right:${triHalf}px solid transparent;`,
        `border-top:${pinH}px solid ${color};`,
        `filter:drop-shadow(0 2px 2px rgba(0,0,0,0.25));`,
        `margin-top:-1px;`,
      `"></div>`,
    `</div>`,
  ].join('');
}

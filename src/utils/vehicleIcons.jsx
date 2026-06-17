/**
 * Central vehicle icon registry.
 *
 * Icons: self-contained inline SVG (no network dependency).
 *
 * Single source of truth — all pages import from here.
 * To add/adjust shapes: update GLYPH_OF / DRAW below.
 */

import React from 'react';

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

// ─── Self-contained inline-SVG vehicle glyphs ────────────────────────────────
// Modern, filled two-tone silhouettes drawn in a shared 64×38 viewBox.
// No network dependency — they always render, scale crisply and accept any
// accent colour. `body` = accent colour, glass = light tint, wheels = dark.

// Maps every vehicle type onto one of the base glyph shapes below.
const GLYPH_OF = {
  car: 'car', suv: 'suv', pickup: 'pickup',
  van: 'van', minibus: 'van',
  bus: 'bus', schoolbus: 'bus',
  truck: 'truck', container: 'truck',
  tanker: 'tanker', watertanker: 'tanker',
  tipper: 'dumper', dumper: 'dumper',
  garbagevan: 'delivery', sweeper: 'delivery', fury: 'delivery', ajax: 'delivery',
  tractor: 'tractor', earthmover: 'tractor', wheelloader: 'tractor',
  jcb: 'excavator', excavator: 'excavator',
  crane: 'crane', concretepump: 'crane', paver: 'crane',
  roadroller: 'roller',
  mixer: 'mixer',
  bike: 'bike', motorcycle: 'bike',
  auto: 'auto',
  ambulance: 'ambulance', mortuaryvan: 'ambulance',
  fire: 'fire', police: 'police',
};

const GLASS = '#E0F2FE';
const TIRE = '#1F2937';
const HUB = '#9CA3AF';

// Wheel: dark tyre + light hub.
const W = (x, r = 5, cy = 28) =>
  `<circle cx="${x}" cy="${cy}" r="${r + 1.3}" fill="#0F172A"/>` +
  `<circle cx="${x}" cy="${cy}" r="${r}" fill="${TIRE}"/>` +
  `<circle cx="${x}" cy="${cy}" r="${(r * 0.42).toFixed(1)}" fill="${HUB}"/>`;

// Each glyph returns inner-SVG markup for the given accent colour.
const DRAW = {
  car: (c) =>
    `<path d="M3.5 27 L3.5 22 Q3.5 20.2 5.4 19.9 L18 18.5 L24.5 10.8 Q25.6 9.5 27.5 9.5 L38.5 9.5 Q40.3 9.5 41.4 11 L46 18 L58 20 Q60.5 20.5 60.5 23.2 L60.5 26 Q60.5 27 59.4 27 Z" fill="${c}"/>` +
    `<path d="M27 11.3 L38 11.3 Q38.8 11.3 39.3 12 L42.6 17.4 L24.4 17.4 Z" fill="${GLASS}"/>` +
    W(20) + W(45),
  suv: (c) =>
    `<path d="M3.5 27 L3.5 21 Q3.5 19.4 5.4 19.1 L17 18 L19 10.2 Q19.4 8.4 21.5 8.4 L40 8.4 Q42 8.4 42.6 10.2 L45 18 L58 19.6 Q60.5 20.1 60.5 22.8 L60.5 26 Q60.5 27 59.4 27 Z" fill="${c}"/>` +
    `<path d="M22 10.4 L30 10.4 L30 16.4 L21 16.4 Z" fill="${GLASS}"/>` +
    `<path d="M31.4 10.4 L39.5 10.4 L41.2 16.4 L31.4 16.4 Z" fill="${GLASS}"/>` +
    W(19) + W(46),
  pickup: (c) =>
    `<path d="M3.5 27 L3.5 20.5 Q3.5 19.2 5.2 18.9 L12.5 18 L14.6 10.6 Q15 8.8 17 8.8 L26 8.8 Q28 8.8 28.4 10.7 L30 16.2 L60.5 16.2 L60.5 18 L60.5 26 Q60.5 27 59.4 27 Z" fill="${c}"/>` +
    `<path d="M17 10.8 L26 10.8 L27.4 15.5 L15.6 15.5 Z" fill="${GLASS}"/>` +
    W(18) + W(47),
  van: (c) =>
    `<path d="M3.5 27 L3.5 10.5 Q3.5 8.6 5.6 8.6 L40 8.6 Q42.5 8.6 44 10.4 L52 18 L58 19.4 Q60.5 19.9 60.5 22.6 L60.5 26 Q60.5 27 59.4 27 Z" fill="${c}"/>` +
    `<path d="M44.5 11.6 Q45.6 11.5 46.3 12.4 L50.6 17.6 L43 17.6 L43 11.8 Z" fill="${GLASS}"/>` +
    `<path d="M8 11 L20 11 L20 17 L8 17 Z" fill="${GLASS}"/>` +
    W(16) + W(48),
  bus: (c) =>
    `<path d="M3.5 27 Q3.5 7.5 8 7.5 L57 7.5 Q60.5 7.5 60.5 11 L60.5 26 Q60.5 27 59.4 27 L4.6 27 Q3.5 27 3.5 26 Z" fill="${c}"/>` +
    `<path d="M8 11.5 L56 11.5 L56 16.5 L8 16.5 Z" fill="${GLASS}"/>` +
    W(16) + W(48),
  truck: (c) =>
    `<path d="M22 27 L22 7 Q22 6.4 22.6 6.4 L59.4 6.4 Q60.5 6.4 60.5 7.5 L60.5 27 Z" fill="${c}"/>` +
    `<path d="M3.5 27 L3.5 12 Q3.5 10.4 5.4 10.4 L13 10.4 L16.5 14.6 L20 14.6 L20 27 Z" fill="${c}"/>` +
    `<path d="M6 12.2 L12.4 12.2 L15 15.2 L6 15.2 Z" fill="${GLASS}"/>` +
    W(13) + W(42) + W(53),
  delivery: (c) =>
    `<path d="M21 27 L21 7.5 Q21 6.6 21.9 6.6 L59.6 6.6 Q60.5 6.6 60.5 7.5 L60.5 27 Z" fill="${c}"/>` +
    `<path d="M3.5 27 L3.5 15 Q3.5 13.8 4.8 13.6 L12 12.8 L14.2 9.4 Q14.7 8.4 16 8.4 L21 8.4 L21 27 Z" fill="${c}"/>` +
    `<path d="M15.6 10.4 L20 10.4 L20 14 L13.8 14 Z" fill="${GLASS}"/>` +
    W(16) + W(47),
  dumper: (c) =>
    `<path d="M3.5 27 L3.5 21 Q3.5 19.8 4.8 19.6 L60 19.6 Q60.5 19.6 60.5 20.6 L60.5 26 Q60.5 27 59.4 27 Z" fill="${c}"/>` +
    `<path d="M4 20 L4 12.5 Q4 11 5.6 11 L13 11 L16 15 L19 15 L19 20 Z" fill="${c}"/>` +
    `<path d="M20 19 L24 9 Q24.3 8 25.4 8.2 L57 13 L58 19 Z" fill="${c}"/>` +
    `<path d="M6.5 12.5 L12.6 12.5 L15 15 L6.5 15 Z" fill="${GLASS}"/>` +
    W(13) + W(34) + W(50),
  tanker: (c) =>
    `<path d="M27 9 L54 9 Q60.5 9 60.5 16 Q60.5 23 54 23 L27 23 Q20 23 20 16 Q20 9 27 9 Z" fill="${c}"/>` +
    `<path d="M3.5 27 L3.5 13 Q3.5 11 5.6 11 L13 11 L16 15 L19 15 L19 27 Z" fill="${c}"/>` +
    `<path d="M6 12.4 L12.4 12.4 L15 15 L6 15 Z" fill="${GLASS}"/>` +
    W(13) + W(40) + W(52),
  tractor: (c) =>
    `<path d="M6 25 L7.8 14.5 Q8.1 13 9.8 13 L22 13 L25 8.2 Q25.6 7 27.2 7 L33 7 Q34.8 7 35.4 8.8 L37.6 14.5 L41 16.5 L41 25 Z" fill="${c}"/>` +
    `<path d="M25.6 9 L33.2 9 L34.6 13 L23.4 13 Z" fill="${GLASS}"/>` +
    W(14, 3.6, 29) + W(46, 9, 25),
  excavator: (c) =>
    `<path d="M4 28.5 Q4 26 6.5 26 L41 26 Q43.5 26 43.5 28.5 Q43.5 31 41 31 L6.5 31 Q4 31 4 28.5 Z" fill="${TIRE}"/>` +
    `<path d="M13 26 L13 13 Q13 11 15 11 L27 11 Q29 11 29 13 L29 26 Z" fill="${c}"/>` +
    `<path d="M16 13 L26 13 L26 18 L16 18 Z" fill="${GLASS}"/>` +
    `<path d="M29 15 L45 8 L48.5 11 L33 19 Z" fill="${c}"/>` +
    `<path d="M45.5 9.5 L50 18 L46.5 19.5 L42.5 12 Z" fill="${c}"/>` +
    `<path d="M45 17 L54 18.5 L52 24 L45.5 22 Z" fill="${TIRE}"/>`,
  crane: (c) =>
    `<path d="M3.5 27 L3.5 19.5 Q3.5 18.3 4.8 18.1 L56 18.1 Q60.5 18.1 60.5 22 L60.5 26 Q60.5 27 59.4 27 Z" fill="${c}"/>` +
    `<path d="M5 18.5 L5 12.5 Q5 11 6.6 11 L14 11 L16.5 14.5 L16.5 18.5 Z" fill="${c}"/>` +
    `<path d="M7 12.6 L13.4 12.6 L15.4 15.2 L7 15.2 Z" fill="${GLASS}"/>` +
    `<path d="M22 18 L55 5.5 L57.5 9 L24.5 21 Z" fill="${c}"/>` +
    W(14) + W(30) + W(48),
  roller: (c) =>
    `<path d="M20 25 L21.5 12.5 Q21.7 11 23.4 11 L40 11 Q41.8 11 42.2 12.7 L44 21 L48 24 L20 24 Z" fill="${c}"/>` +
    `<path d="M24 12.6 L38 12.6 L39.4 17 L24 17 Z" fill="${GLASS}"/>` +
    W(14, 9, 24) + W(47, 5),
  mixer: (c) =>
    `<path d="M3.5 27 L3.5 20.5 Q3.5 19.3 4.8 19.1 L60 19.1 Q60.5 19.1 60.5 20.1 L60.5 26 Q60.5 27 59.4 27 Z" fill="${c}"/>` +
    `<path d="M4.5 19.5 L4.5 12.5 Q4.5 11 6.1 11 L13 11 L16 15 L18 15 L18 19.5 Z" fill="${c}"/>` +
    `<path d="M6.5 12.6 L12.4 12.6 L14.6 15 L6.5 15 Z" fill="${GLASS}"/>` +
    `<path d="M20 19 L25 9.5 Q26 7.8 28.4 8.2 L50 11.5 Q54.5 12.2 53.5 16.5 L52 19 Z" fill="${c}"/>` +
    W(14) + W(40) + W(52),
  bike: (c) =>
    `<path d="M22 12.5 L33 12.5 Q34 12.5 34.5 13.4 L36 16.5 L44 16.5 L41 13.5 L46.5 13.5 L49 18.5 L46.5 20 L42 16.5 L31 16.5 L26 22 L22.5 20 L27 14.5 L21 14.5 Q20 14.5 20 13.5 Q20 12.5 22 12.5 Z" fill="${c}"/>` +
    `<path d="M44 11 L50 11 L50 12.6 L45.5 12.6 Z" fill="${c}"/>` +
    W(15, 7) + W(49, 7),
  auto: (c) =>
    `<path d="M9 26 Q9 9 24 9 Q39 9 38 19 L38 26 Z" fill="${c}"/>` +
    `<path d="M14 12.5 L33 12.5 L33 18 L14 18 Z" fill="${GLASS}"/>` +
    W(12, 4) + W(33, 5),
  ambulance: (c) =>
    `<path d="M3.5 27 L3.5 10.5 Q3.5 8.8 5.4 8.8 L41 8.8 Q43.3 8.8 44.7 10.6 L52 18 L58 19.2 Q60.5 19.7 60.5 22.4 L60.5 26 Q60.5 27 59.4 27 Z" fill="${c}"/>` +
    `<path d="M45 11.8 Q45.9 11.7 46.5 12.5 L50.6 17.4 L43.5 17.4 L43.5 11.9 Z" fill="${GLASS}"/>` +
    `<rect x="18" y="11.5" width="13" height="11" rx="1.5" fill="#FFFFFF"/>` +
    `<path d="M23 13.5 L26 13.5 L26 19.5 L23 19.5 Z M20.5 15.4 L28.5 15.4 L28.5 17.6 L20.5 17.6 Z" fill="#DC2626"/>` +
    W(15) + W(47),
  fire: (c) =>
    `<path d="M21 27 L21 9 Q21 8.1 21.9 8.1 L59.6 8.1 Q60.5 8.1 60.5 9 L60.5 27 Z" fill="${c}"/>` +
    `<path d="M3.5 27 L3.5 15 Q3.5 13.8 4.8 13.6 L12 12.8 L14.2 9.4 Q14.7 8.4 16 8.4 L21 8.4 L21 27 Z" fill="${c}"/>` +
    `<path d="M15.6 10.4 L20 10.4 L20 14 L13.8 14 Z" fill="${GLASS}"/>` +
    `<rect x="23" y="5" width="34" height="2.6" rx="1.3" fill="#FBBF24"/>` +
    `<path d="M27 5 L27 7.6 M33 5 L33 7.6 M39 5 L39 7.6 M45 5 L45 7.6 M51 5 L51 7.6" stroke="#FBBF24" stroke-width="1.4"/>` +
    W(16) + W(47),
  police: (c) =>
    DRAW.car(c) +
    `<path d="M27 6.4 L32 6.4 L32 9.4 L27 9.4 Z" fill="#DC2626"/>` +
    `<path d="M32 6.4 L37 6.4 L37 9.4 L32 9.4 Z" fill="#2563EB"/>`,
};

const glyphMarkup = (type, color) => (DRAW[GLYPH_OF[type] || 'car'] || DRAW.car)(color);

// ─── VehicleIcon component ────────────────────────────────────────────────────
// Renders a self-contained inline-SVG vehicle glyph. Accepts either `type`
// or `icon` (legacy call sites pass `icon`) for the vehicle category.
export const VehicleIcon = ({ type, icon, color = '#3B82F6', size = 40 }) => {
  const key = type || icon || 'car';
  return (
    <svg
      width={size}
      height={Math.round((size * 38) / 64)}
      viewBox="0 0 64 38"
      role="img"
      aria-label={VEHICLE_ICON_LABELS[key] || key}
      style={{
        flexShrink: 0, display: 'block', overflow: 'visible',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))', userSelect: 'none',
      }}
      dangerouslySetInnerHTML={{ __html: glyphMarkup(key, color) }}
    />
  );
};

// ─── Map marker HTML ──────────────────────────────────────────────────────────
// Returns an HTML string for Leaflet L.divIcon.
// Layout: inline-SVG vehicle glyph on top + coloured circle badge + arrow pin
// pointing to the exact GPS coordinate.  The iconAnchor is at the pin tip.
export function vehicleMarkerHtml(type, color = '#3B82F6', size = 44, isSelected = false) {
  const badge = isSelected ? size + 8 : size;
  const imgW  = Math.round(badge * 0.78);
  const imgH  = Math.round((imgW * 38) / 64);
  const pinH  = 10;
  const border = isSelected ? 3 : 2;
  // Half-widths of the CSS triangle that forms the location pin
  const triHalf = Math.round(badge * 0.22);

  // Coloured circle + inline white vehicle glyph — pure CSS/SVG, no network.
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
        // Inline white vehicle glyph
        `<svg width="${imgW}" height="${imgH}" viewBox="0 0 64 38"`,
          ` style="display:block;position:relative;z-index:1;pointer-events:none;`,
          `filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35));">`,
          glyphMarkup(type, '#FFFFFF'),
        `</svg>`,
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

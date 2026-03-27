import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapContainer, TileLayer, Circle, Polygon, Marker, Popup,
  useMapEvents, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-toastify';
import {
  getGeofences, createGeofence, updateGeofence, deleteGeofence,
  toggleGeofence, addAssignment, removeAssignment,
} from '../services/geofence.service';
import { getVehicles } from '../services/vehicle.service';
import { getGroups } from '../services/group.service';

// Fix Leaflet default icon (Vite bundler issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const INDIA_CENTER = [22.9734, 78.6569];

const GEO_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

// ── Style helpers ─────────────────────────────────────────────────────────────

const btnStyle = (bg, color, extra = {}) => ({
  padding: '5px 11px', fontSize: 11, fontWeight: 500, border: 'none',
  borderRadius: 6, cursor: 'pointer', background: bg, color, ...extra,
});

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e2e8f0', borderRadius: 6,
  background: '#fff', color: '#0f172a', boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};

const selectStyle = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1px solid #e2e8f0', borderRadius: 6,
  background: '#fff', color: '#374151', boxSizing: 'border-box',
};

const formatMeters = (m) => {
  const n = parseFloat(m);
  if (!n) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(2).replace(/\.?0+$/, '')} km` : `${n} m`;
};

// ── Map utility components ────────────────────────────────────────────────────

function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function FlyTo({ coords, onDone }) {
  const map = useMap();
  useEffect(() => {
    if (coords) { map.flyTo([coords.lat, coords.lng], 14); onDone?.(); }
  }, [coords]); // eslint-disable-line
  return null;
}

function DrawClickHandler({ drawType, onCircleClick, onPolyClick }) {
  useMapEvents({
    click(e) {
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (drawType === 'CIRCULAR') onCircleClick(pt);
      else onPolyClick(pt);
    },
  });
  return null;
}

// ── Geofence shapes on overview map ──────────────────────────────────────────

function GeoShape({ geo, highlighted, onMouseOver, onMouseOut, onClick }) {
  const color  = geo.color || '#3b82f6';
  const weight = highlighted ? 3 : 2;
  const fillOpacity = highlighted ? 0.35 : 0.15;
  const opts = { color, fillColor: color, fillOpacity, weight, opacity: geo.isActive ? 1 : 0.4 };
  const events = { mouseover: onMouseOver, mouseout: onMouseOut, click: onClick };

  if (geo.type === 'CIRCULAR' && geo.centerLat && geo.centerLng) {
    return (
      <Circle
        center={[parseFloat(geo.centerLat), parseFloat(geo.centerLng)]}
        radius={parseFloat(geo.radiusMeters)}
        pathOptions={opts}
        eventHandlers={events}
      >
        <Popup><strong>{geo.name}</strong><br />{formatMeters(geo.radiusMeters)} radius</Popup>
      </Circle>
    );
  }
  if (geo.type === 'POLYGON' && geo.coordinates?.length >= 3) {
    return (
      <Polygon
        positions={geo.coordinates.map(p => [p.lat, p.lng])}
        pathOptions={opts}
        eventHandlers={events}
      >
        <Popup><strong>{geo.name}</strong><br />{geo.coordinates.length} vertices</Popup>
      </Polygon>
    );
  }
  return null;
}

// ── Assignment row ────────────────────────────────────────────────────────────

function AssignmentRow({ a, onRemove }) {
  const label = a.scope === 'VEHICLE'
    ? (a.vehicle?.vehicleNumber || a.vehicle?.vehicleName || `Vehicle #${a.vehicleId}`)
    : (a.group?.name || `Group #${a.groupId}`);
  const alerts = [a.alertOnEntry && 'entry', a.alertOnExit && 'exit'].filter(Boolean).join(' + ') || 'no alerts';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
        background: a.scope === 'VEHICLE' ? '#dbeafe' : '#ede9fe',
        color: a.scope === 'VEHICLE' ? '#1d4ed8' : '#6d28d9',
      }}>
        {a.scope === 'VEHICLE' ? '🚗' : '👥'} {a.scope}
      </span>
      <span style={{ fontSize: 12, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{alerts}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ── Geofence card ─────────────────────────────────────────────────────────────

function GeofenceCard({ geo, expanded, highlighted, vehicles, groups, onExpand, onEdit, onToggle, onDelete, onAddAssignment, onRemoveAssignment }) {
  const [form, setForm] = useState({ scope: 'VEHICLE', vehicleId: '', groupId: '', alertOnEntry: true, alertOnExit: true });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (form.scope === 'VEHICLE' && !form.vehicleId) { toast.error('Select a vehicle'); return; }
    if (form.scope === 'GROUP' && !form.groupId) { toast.error('Select a group'); return; }
    setSaving(true);
    await onAddAssignment(form);
    setSaving(false);
    setForm({ scope: 'VEHICLE', vehicleId: '', groupId: '', alertOnEntry: true, alertOnExit: true });
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 10, marginBottom: 10, overflow: 'hidden',
      boxShadow: highlighted
        ? '0 0 0 2px #2563eb, 0 2px 10px rgba(0,0,0,.12)'
        : '0 1px 4px rgba(0,0,0,.08)',
      borderTop: `3px solid ${geo.color || '#3b82f6'}`,
      transition: 'box-shadow 0.15s',
    }}>
      <div style={{ padding: '13px 15px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', flex: 1 }}>{geo.name}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
            background: geo.type === 'CIRCULAR' ? '#dbeafe' : '#ede9fe',
            color: geo.type === 'CIRCULAR' ? '#1d4ed8' : '#6d28d9',
          }}>
            {geo.type === 'CIRCULAR' ? '⭕ Circular' : '🔷 Polygon'}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
            background: geo.isActive ? '#dcfce7' : '#fef2f2',
            color: geo.isActive ? '#16a34a' : '#dc2626',
          }}>
            {geo.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Details */}
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 5 }}>
          {geo.type === 'CIRCULAR'
            ? `Radius: ${formatMeters(geo.radiusMeters)}`
            : `${geo.coordinates?.length || 0} vertices`}
          {' · '}
          {(geo.assignments || []).length} assignment{(geo.assignments || []).length !== 1 ? 's' : ''}
          {geo.description && <span> · {geo.description}</span>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <button onClick={onExpand} style={btnStyle('#f1f5f9', '#334155')}>
            {expanded ? '▲' : '▼'} Assignments ({(geo.assignments || []).length})
          </button>
          <button onClick={onEdit} style={btnStyle('#eff6ff', '#1d4ed8')}>Edit</button>
          <button onClick={onToggle} style={btnStyle(geo.isActive ? '#fef2f2' : '#f0fdf4', geo.isActive ? '#dc2626' : '#16a34a')}>
            {geo.isActive ? 'Disable' : 'Enable'}
          </button>
          <button onClick={onDelete} style={btnStyle('#fef2f2', '#dc2626')}>Delete</button>
        </div>
      </div>

      {/* Assignments panel */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '13px 15px', background: '#f8fafc' }}>
          {(geo.assignments || []).length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              {geo.assignments.map(a => (
                <AssignmentRow key={a.id} a={a} onRemove={() => onRemoveAssignment(a.id)} />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>No assignments yet.</p>
          )}

          {/* Add assignment */}
          <div style={{ background: '#fff', borderRadius: 8, padding: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Add Assignment</div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {['VEHICLE', 'GROUP'].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, scope: s, vehicleId: '', groupId: '' }))} style={{
                  padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
                  border: '1px solid #e2e8f0',
                  background: form.scope === s ? '#2563eb' : '#f8fafc',
                  color: form.scope === s ? '#fff' : '#475569',
                  fontWeight: form.scope === s ? 600 : 400,
                }}>
                  {s === 'VEHICLE' ? '🚗 Vehicle' : '👥 Group'}
                </button>
              ))}
            </div>

            {form.scope === 'VEHICLE' ? (
              <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} style={selectStyle}>
                <option value="">Select vehicle...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.vehicleNumber || v.vehicleName || `Vehicle #${v.id}`}</option>
                ))}
              </select>
            ) : (
              <select value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} style={selectStyle}>
                <option value="">Select group...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}

            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {[['alertOnEntry', 'Alert on entry'], ['alertOnExit', 'Alert on exit']].map(([key, lbl]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 4, fontSize: 12, color: '#374151' }}>
                  <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                  {lbl}
                </label>
              ))}
            </div>

            <button onClick={handleAdd} disabled={saving} style={{
              marginTop: 10, padding: '7px 16px', fontSize: 12, fontWeight: 600,
              background: saving ? '#93c5fd' : '#2563eb', color: '#fff',
              border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Draw modal ────────────────────────────────────────────────────────────────

function DrawModal({ mode, editTarget, vehicles, groups, onSave, onClose }) {
  const [fName, setFName] = useState(editTarget?.name || '');
  const [fDesc, setFDesc] = useState(editTarget?.description || '');
  const [fType, setFType] = useState(editTarget?.type || 'CIRCULAR');
  const [fColor, setFColor] = useState(editTarget?.color || '#3b82f6');

  const [drawCenter, setDrawCenter] = useState(() =>
    editTarget?.type === 'CIRCULAR'
      ? { lat: parseFloat(editTarget.centerLat), lng: parseFloat(editTarget.centerLng) }
      : null
  );
  const [drawRadius, setDrawRadius] = useState(() =>
    editTarget?.type === 'CIRCULAR' ? parseFloat(editTarget.radiusMeters) : 500
  );
  const [drawPoints, setDrawPoints] = useState(() =>
    editTarget?.type === 'POLYGON' ? (editTarget.coordinates || []) : []
  );

  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [locLoading, setLocLoading] = useState(false);
  const [flyCoords, setFlyCoords] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const modalMapRef = useRef(null);

  // Assignments to create after save
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [assignScope, setAssignScope] = useState('VEHICLE');
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignGroupId, setAssignGroupId] = useState('');
  const [assignEntry, setAssignEntry] = useState(true);
  const [assignExit, setAssignExit] = useState(true);

  // Geocoding with debounce
  useEffect(() => {
    if (!locQuery || locQuery.length < 3) { setLocResults([]); return; }
    const t = setTimeout(async () => {
      setLocLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locQuery)}&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        setLocResults(await res.json());
      } catch { /* ignore */ } finally { setLocLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [locQuery]);

  const switchType = (t) => {
    setFType(t);
    setDrawCenter(null);
    setDrawRadius(500);
    setDrawPoints([]);
    setMapKey(k => k + 1); // remount map so it recenters
  };

  const handleSave = async () => {
    if (!fName.trim()) { toast.error('Name is required'); return; }
    if (fType === 'CIRCULAR' && !drawCenter) { toast.error('Click on the map to set the center point'); return; }
    if (fType === 'POLYGON' && drawPoints.length < 3) { toast.error('Place at least 3 points on the map'); return; }
    setSaving(true);
    try {
      await onSave({
        name: fName.trim(), description: fDesc.trim(), type: fType, color: fColor,
        ...(fType === 'CIRCULAR'
          ? { centerLat: drawCenter.lat, centerLng: drawCenter.lng, radiusMeters: drawRadius }
          : { coordinates: drawPoints }),
      }, pendingAssignments);
    } finally { setSaving(false); }
  };

  const initialCenter = drawCenter
    ? [drawCenter.lat, drawCenter.lng]
    : drawPoints.length ? [drawPoints[0].lat, drawPoints[0].lng]
    : INDIA_CENTER;
  const initialZoom = (drawCenter || drawPoints.length) ? 13 : 5;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 1100, height: '88vh', maxHeight: 700, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '15px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--theme-header-bg)', color: '#fff', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {mode === 'edit' ? 'Edit Geofence' : 'Create Geofence'}
          </h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Map */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer key={mapKey} center={initialCenter} zoom={initialZoom} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              <MapController mapRef={modalMapRef} />
              <DrawClickHandler
                drawType={fType}
                onCircleClick={(pt) => setDrawCenter(pt)}
                onPolyClick={(pt) => setDrawPoints(prev => [...prev, pt])}
              />
              {flyCoords && <FlyTo coords={flyCoords} onDone={() => setFlyCoords(null)} />}

              {fType === 'CIRCULAR' && drawCenter && (
                <>
                  <Circle
                    center={[drawCenter.lat, drawCenter.lng]}
                    radius={drawRadius}
                    pathOptions={{ color: fColor, fillColor: fColor, fillOpacity: 0.2, weight: 2 }}
                  />
                  <Marker position={[drawCenter.lat, drawCenter.lng]} />
                </>
              )}

              {fType === 'POLYGON' && (
                <>
                  {drawPoints.length >= 2 && (
                    <Polygon
                      positions={drawPoints.map(p => [p.lat, p.lng])}
                      pathOptions={{ color: fColor, fillColor: fColor, fillOpacity: 0.2, weight: 2 }}
                    />
                  )}
                  {drawPoints.map((p, i) => (
                    <Marker key={i} position={[p.lat, p.lng]} />
                  ))}
                </>
              )}
            </MapContainer>

            {/* Map overlay hint */}
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 1000,
              background: 'rgba(255,255,255,0.93)', borderRadius: 8,
              padding: '8px 14px', fontSize: 12, color: '#334155',
              boxShadow: '0 2px 8px rgba(0,0,0,.15)', maxWidth: 280, pointerEvents: 'none',
            }}>
              {fType === 'CIRCULAR'
                ? drawCenter
                  ? '✅ Center set. Adjust radius using the slider →'
                  : '📍 Click anywhere on the map to set the center'
                : drawPoints.length < 3
                  ? `🖊️ Click to place boundary points (${drawPoints.length}/3 minimum)`
                  : `✅ ${drawPoints.length} points placed. Add more or save.`}
            </div>

            {/* Polygon undo/clear */}
            {fType === 'POLYGON' && drawPoints.length > 0 && (
              <div style={{ position: 'absolute', bottom: 16, left: 12, zIndex: 1000, display: 'flex', gap: 6 }}>
                <button onClick={() => setDrawPoints(p => p.slice(0, -1))} style={{ padding: '6px 12px', fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}>↩ Undo</button>
                <button onClick={() => setDrawPoints([])} style={{ padding: '6px 12px', fontSize: 12, background: '#fff', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#dc2626', boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}>✕ Clear</button>
              </div>
            )}
          </div>

          {/* Form panel */}
          <div style={{ width: 300, borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '18px 18px 16px', gap: 14 }}>

            {/* Type */}
            <div>
              <div style={labelStyle}>Type</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['CIRCULAR', '⭕ Circular'], ['POLYGON', '🔷 Polygon']].map(([val, lbl]) => (
                  <button key={val} onClick={() => switchType(val)} style={{
                    flex: 1, padding: 9, fontSize: 12, fontWeight: 600,
                    border: `2px solid ${fType === val ? '#2563eb' : '#e2e8f0'}`,
                    background: fType === val ? '#eff6ff' : '#fff',
                    color: fType === val ? '#1d4ed8' : '#64748b',
                    borderRadius: 8, cursor: 'pointer',
                  }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label style={labelStyle}>Name *</label>
              <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Office Boundary" style={inputStyle} />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Optional..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {/* Circular: location search + radius */}
            {fType === 'CIRCULAR' && (
              <>
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>Search Location</label>
                  <input value={locQuery} onChange={e => setLocQuery(e.target.value)} placeholder="City, area, landmark..." style={inputStyle} />
                  {locLoading && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Searching...</div>}
                  {locResults.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.15)', width: '100%', top: '100%', maxHeight: 200, overflowY: 'auto' }}>
                      {locResults.map((r, i) => (
                        <div key={i} onClick={() => {
                          const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
                          setDrawCenter({ lat, lng });
                          setFlyCoords({ lat, lng });
                          setLocResults([]);
                          setLocQuery(r.display_name.split(',')[0]);
                        }} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 11, color: '#374151', borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          📍 {r.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Radius: <strong>{formatMeters(drawRadius)}</strong></label>
                  <input type="range" min={50} max={50000} step={50} value={drawRadius} onChange={e => setDrawRadius(parseInt(e.target.value))} style={{ width: '100%', marginTop: 4 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                    <span>50 m</span><span>50 km</span>
                  </div>
                </div>
              </>
            )}

            {/* Polygon instructions */}
            {fType === 'POLYGON' && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#475569' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>How to draw</div>
                <ol style={{ paddingLeft: 16, margin: 0, lineHeight: 1.9 }}>
                  <li>Click on map to place points</li>
                  <li>Minimum 3 points required</li>
                  <li>Use Undo to remove last point</li>
                </ol>
                <div style={{ marginTop: 8, fontWeight: 600, color: drawPoints.length >= 3 ? '#16a34a' : '#dc2626', fontSize: 12 }}>
                  {drawPoints.length} point{drawPoints.length !== 1 ? 's' : ''} {drawPoints.length >= 3 ? '✓ ready to save' : `(${3 - drawPoints.length} more needed)`}
                </div>
              </div>
            )}

            {/* Color swatches */}
            <div>
              <label style={labelStyle}>Boundary Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {GEO_COLORS.map(c => (
                  <button key={c} onClick={() => setFColor(c)} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', outline: fColor === c ? `3px solid ${c}` : '2px solid transparent',
                    outlineOffset: 2,
                  }} />
                ))}
              </div>
            </div>

            {/* Assign to vehicles / groups */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
              <label style={labelStyle}>Assign To</label>

              {/* Existing assignments (edit mode) */}
              {(editTarget?.assignments || []).length > 0 && (
                <div style={{ marginBottom: 8, padding: '6px 8px', background: '#f8fafc', borderRadius: 6, fontSize: 11, color: '#475569' }}>
                  <span style={{ fontWeight: 600 }}>Already assigned: </span>
                  {editTarget.assignments.map(a =>
                    a.scope === 'VEHICLE'
                      ? (a.vehicle?.vehicleNumber || a.vehicle?.vehicleName || `V#${a.vehicleId}`)
                      : (a.group?.name || `G#${a.groupId}`)
                  ).join(', ')}
                </div>
              )}

              {/* Pending (new) assignments */}
              {pendingAssignments.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {pendingAssignments.map((a, i) => {
                    const lbl = a.scope === 'VEHICLE'
                      ? (vehicles.find(v => String(v.id) === String(a.vehicleId))?.vehicleNumber || `Vehicle #${a.vehicleId}`)
                      : (groups.find(g => String(g.id) === String(a.groupId))?.name || `Group #${a.groupId}`);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                          background: a.scope === 'VEHICLE' ? '#dbeafe' : '#ede9fe',
                          color: a.scope === 'VEHICLE' ? '#1d4ed8' : '#6d28d9',
                        }}>
                          {a.scope === 'VEHICLE' ? '🚗' : '👥'}
                        </span>
                        <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{lbl}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
                          {[a.alertOnEntry && 'in', a.alertOnExit && 'out'].filter(Boolean).join('+')}
                        </span>
                        <button onClick={() => setPendingAssignments(p => p.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Scope tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {['VEHICLE', 'GROUP'].map(s => (
                  <button key={s} onClick={() => { setAssignScope(s); setAssignVehicleId(''); setAssignGroupId(''); }} style={{
                    padding: '4px 12px', fontSize: 11, borderRadius: 20, cursor: 'pointer',
                    border: '1px solid #e2e8f0',
                    background: assignScope === s ? '#2563eb' : '#f8fafc',
                    color: assignScope === s ? '#fff' : '#475569',
                    fontWeight: assignScope === s ? 600 : 400,
                  }}>
                    {s === 'VEHICLE' ? '🚗 Vehicle' : '👥 Group'}
                  </button>
                ))}
              </div>

              {/* Dropdown */}
              {assignScope === 'VEHICLE' ? (
                <select value={assignVehicleId} onChange={e => setAssignVehicleId(e.target.value)} style={selectStyle}>
                  <option value="">Select vehicle...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicleNumber || v.vehicleName || `Vehicle #${v.id}`}</option>
                  ))}
                </select>
              ) : (
                <select value={assignGroupId} onChange={e => setAssignGroupId(e.target.value)} style={selectStyle}>
                  <option value="">Select group...</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}

              {/* Alert toggles */}
              <div style={{ display: 'flex', gap: 14, margin: '7px 0 8px' }}>
                {[['Entry alert', assignEntry, setAssignEntry], ['Exit alert', assignExit, setAssignExit]].map(([lbl, val, setter]) => (
                  <label key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} />
                    {lbl}
                  </label>
                ))}
              </div>

              <button onClick={() => {
                const id = assignScope === 'VEHICLE' ? assignVehicleId : assignGroupId;
                if (!id) { toast.error(`Select a ${assignScope.toLowerCase()}`); return; }
                const dupe = pendingAssignments.some(a =>
                  a.scope === assignScope &&
                  (assignScope === 'VEHICLE' ? String(a.vehicleId) === String(id) : String(a.groupId) === String(id))
                );
                if (dupe) { toast.error('Already in the list'); return; }
                setPendingAssignments(prev => [...prev, {
                  scope: assignScope,
                  ...(assignScope === 'VEHICLE' ? { vehicleId: id } : { groupId: id }),
                  alertOnEntry: assignEntry,
                  alertOnExit: assignExit,
                }]);
                setAssignVehicleId('');
                setAssignGroupId('');
              }} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}>
                + Add to list
              </button>
            </div>

            {/* Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', fontSize: 13, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px', fontSize: 13, fontWeight: 700, background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create Geofence'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderTop: `4px solid ${color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, minWidth: 150 }}>
      <div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{value}</div>
      </div>
      <div style={{ fontSize: 30 }}>{icon}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Geofence() {
  const [geofences, setGeofences] = useState([]);
  const [vehicles, setVehicles]   = useState([]);
  const [groups, setGroups]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [modal, setModal]         = useState(null); // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const overviewMapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [gRes, vRes, grRes] = await Promise.allSettled([
        getGeofences(), getVehicles(), getGroups(),
      ]);
      if (gRes.status === 'fulfilled') setGeofences(gRes.value.data.data || []);
      if (vRes.status === 'fulfilled') setVehicles(vRes.value.data.data || []);
      if (grRes.status === 'fulfilled') setGroups(grRes.value.data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flyToGeo = useCallback((geo) => {
    if (!overviewMapRef.current) return;
    if (geo.type === 'CIRCULAR' && geo.centerLat) {
      overviewMapRef.current.flyTo([parseFloat(geo.centerLat), parseFloat(geo.centerLng)], 14);
    } else if (geo.coordinates?.length) {
      const bounds = L.latLngBounds(geo.coordinates.map(p => [p.lat, p.lng]));
      overviewMapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, []);

  const openCreate = () => { setEditTarget(null); setModal('create'); };
  const openEdit   = (geo) => { setEditTarget(geo); setModal('edit'); };
  const closeModal = () => { setModal(null); setEditTarget(null); };

  const handleSave = async (payload, pendingAssignments = []) => {
    try {
      let geoId;
      if (modal === 'edit') {
        await updateGeofence(editTarget.id, payload);
        geoId = editTarget.id;
        toast.success('Geofence updated');
      } else {
        const res = await createGeofence(payload);
        geoId = res.data.data?.id;
        toast.success('Geofence created');
      }
      // Create any assignments added in the modal
      if (pendingAssignments.length > 0 && geoId) {
        await Promise.allSettled(
          pendingAssignments.map(a =>
            addAssignment(geoId, {
              scope: a.scope,
              ...(a.scope === 'VEHICLE' ? { vehicleId: parseInt(a.vehicleId) } : { groupId: parseInt(a.groupId) }),
              alertOnEntry: a.alertOnEntry,
              alertOnExit: a.alertOnExit,
            })
          )
        );
      }
      closeModal();
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save');
      throw e;
    }
  };

  const handleToggle = async (geo) => {
    try {
      await toggleGeofence(geo.id);
      setGeofences(prev => prev.map(g => g.id === geo.id ? { ...g, isActive: !g.isActive } : g));
      toast.success(`Geofence ${geo.isActive ? 'disabled' : 'enabled'}`);
    } catch { toast.error('Failed to toggle'); }
  };

  const handleDelete = async (geo) => {
    if (!window.confirm(`Delete "${geo.name}"? This cannot be undone.`)) return;
    try {
      await deleteGeofence(geo.id);
      setGeofences(prev => prev.filter(g => g.id !== geo.id));
      toast.success('Geofence deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleAddAssignment = async (geoId, form) => {
    try {
      await addAssignment(geoId, {
        scope: form.scope,
        ...(form.scope === 'VEHICLE' ? { vehicleId: parseInt(form.vehicleId) } : { groupId: parseInt(form.groupId) }),
        alertOnEntry: form.alertOnEntry,
        alertOnExit: form.alertOnExit,
      });
      toast.success('Assignment added');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add assignment'); throw e; }
  };

  const handleRemoveAssignment = async (geoId, assignId) => {
    try {
      await removeAssignment(geoId, assignId);
      toast.success('Removed');
      load();
    } catch { toast.error('Failed to remove'); }
  };

  const filtered = geofences.filter(g => {
    if (filter === 'active')   return g.isActive;
    if (filter === 'inactive') return !g.isActive;
    if (filter === 'circular') return g.type === 'CIRCULAR';
    if (filter === 'polygon')  return g.type === 'POLYGON';
    return true;
  });

  const stats = {
    total:    geofences.length,
    active:   geofences.filter(g => g.isActive).length,
    circular: geofences.filter(g => g.type === 'CIRCULAR').length,
    polygon:  geofences.filter(g => g.type === 'POLYGON').length,
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>

      {/* Hero */}
      <div style={{ background: 'var(--theme-header-bg)', padding: '28px 28px 24px', color: '#fff', flexShrink: 0 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Geofences</h1>
        <p style={{ margin: '5px 0 20px', opacity: 0.8, fontSize: 14 }}>
          Define virtual boundaries — circular zones or custom polygons — for vehicles and groups
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <StatCard label="Total"    value={stats.total}    icon="📍" color="#3b82f6" />
          <StatCard label="Active"   value={stats.active}   icon="✅" color="#10b981" />
          <StatCard label="Circular" value={stats.circular} icon="⭕" color="#f59e0b" />
          <StatCard label="Polygon"  value={stats.polygon}  icon="🔷" color="#8b5cf6" />
        </div>
      </div>

      {/* Split layout */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, height: 'calc(100vh - 230px)' }}>

        {/* Left: list */}
        <div style={{ width: 400, flexShrink: 0, background: '#f8fafc', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Controls */}
          <div style={{ padding: '14px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            <button onClick={openCreate} style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginBottom: 10, fontSize: 14 }}>
              + New Geofence
            </button>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {[['all','All'], ['active','Active'], ['inactive','Inactive'], ['circular','Circular'], ['polygon','Polygon']].map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v)} style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer',
                  border: '1px solid #e2e8f0',
                  background: filter === v ? '#2563eb' : '#f8fafc',
                  color: filter === v ? '#fff' : '#475569',
                  fontWeight: filter === v ? 600 : 400,
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px 16px' }}>
                <div style={{ fontSize: 44 }}>📍</div>
                <div style={{ fontWeight: 600, marginTop: 12 }}>No geofences yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Click "+ New Geofence" to get started</div>
              </div>
            ) : filtered.map(geo => (
              <GeofenceCard
                key={geo.id}
                geo={geo}
                expanded={expandedId === geo.id}
                highlighted={highlightId === geo.id}
                vehicles={vehicles}
                groups={groups}
                onExpand={() => {
                  const next = expandedId === geo.id ? null : geo.id;
                  setExpandedId(next);
                  if (next) { setHighlightId(geo.id); flyToGeo(geo); }
                }}
                onEdit={() => openEdit(geo)}
                onToggle={() => handleToggle(geo)}
                onDelete={() => handleDelete(geo)}
                onAddAssignment={(form) => handleAddAssignment(geo.id, form)}
                onRemoveAssignment={(aid) => handleRemoveAssignment(geo.id, aid)}
              />
            ))}
          </div>
        </div>

        {/* Right: overview map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={INDIA_CENTER} zoom={5} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>' />
            <MapController mapRef={overviewMapRef} />
            {geofences.map(geo => (
              <GeoShape
                key={geo.id}
                geo={geo}
                highlighted={highlightId === geo.id}
                onMouseOver={() => setHighlightId(geo.id)}
                onMouseOut={() => setHighlightId(null)}
                onClick={() => {
                  setHighlightId(geo.id);
                  setExpandedId(geo.id);
                  flyToGeo(geo);
                }}
              />
            ))}
          </MapContainer>

          {geofences.length === 0 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(255,255,255,0.92)', padding: '20px 32px', borderRadius: 12, textAlign: 'center', pointerEvents: 'none', zIndex: 1000 }}>
              <div style={{ fontSize: 36 }}>🗺️</div>
              <div style={{ fontWeight: 600, color: '#475569', marginTop: 8 }}>Create a geofence to see it here</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <DrawModal
          mode={modal}
          editTarget={editTarget}
          vehicles={vehicles}
          groups={groups}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

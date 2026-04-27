import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getSettings, updateSettings, resetSettings } from '../services/settings.service';
import { applyTheme } from '../utils/theme';

// ─── Widget definitions (must match Dashboard.jsx + MyFleet.jsx) ─────────────
// Card ids prefixed with "state_" are computed from live vehicle state and
// require the dashboard to fetch the vehicles list. See Dashboard.jsx.
const ALL_DASH_CARDS_DEF = [
  // Registry / status counts (server-aggregated)
  { id: 'clients',     title: 'Total Clients',       icon: '👥' },
  { id: 'registered',  title: 'Registered Vehicles', icon: '🚗' },
  { id: 'active',      title: 'Active Vehicles',     icon: '✅' },
  { id: 'inactive',    title: 'Inactive Vehicles',   icon: '⏸️' },
  { id: 'deleted',     title: 'Deleted Vehicles',    icon: '🗑️' },
  { id: 'gps_active',  title: 'GPS Active',          icon: '📡' },
  { id: 'overspeed',   title: 'Overspeed Alerts',    icon: '⚠️' },
  { id: 'challans',    title: 'Pending Challans',    icon: '📋' },
  { id: 'renewals',    title: 'Upcoming Renewals',   icon: '📅' },
  { id: 'activity',    title: 'Activity (7d)',       icon: '📈' },
  // Fleet-state cards — counts derived live from vehicle state evaluator
  { id: 'state_offline',  title: 'Offline (state)',   icon: '📵' },
  { id: 'state_speeding', title: 'Speeding (state)',  icon: '🏎️' },
  { id: 'state_running',  title: 'Running (state)',   icon: '🟢' },
  { id: 'state_idle',     title: 'Idle (state)',      icon: '⏸️' },
  { id: 'state_stopped',  title: 'Stopped (state)',   icon: '🔴' },
  { id: 'state_online',   title: 'Online (state)',    icon: '🌐' },
];
const DEFAULT_DASH_CARDS   = ['registered','active','overspeed','inactive','gps_active','challans','renewals'];

const ALL_FLEET_CHIPS_DEF = [
  { id: 'total',     label: 'Total',     icon: '🚗', dot: '#64748b' },
  { id: 'running',   label: 'Running',   icon: '🟢', dot: '#22c55e' },
  { id: 'stopped',   label: 'Stopped',   icon: '🔴', dot: '#ef4444' },
  { id: 'no_gps',    label: 'No GPS',    icon: '📡', dot: '#f59e0b' },
  { id: 'idle',      label: 'Idle',      icon: '⏸️', dot: '#8b5cf6' },
  { id: 'overspeed', label: 'Overspeed', icon: '🏎️', dot: '#dc2626' },
];
const DEFAULT_FLEET_CHIPS = ['total','running','stopped','no_gps'];

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
  borderRadius: '8px', fontSize: '14px', color: '#1e293b',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const fieldStyle = { marginBottom: '18px' };

const VehicleSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [speedRanges, setSpeedRanges] = useState([]);
  const [speedThreshold, setSpeedThreshold] = useState(80);
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('mapStyle') || 'voyager');
  const [sidebarTheme,        setSidebarTheme]        = useState(() => localStorage.getItem('theme-sidebar')                || 'navy');
  const [tableHeaderFontSize, setTableHeaderFontSize] = useState(() => localStorage.getItem('theme-table-header-font-size') || '11px');
  const [tableBodyFontSize,   setTableBodyFontSize]   = useState(() => localStorage.getItem('theme-table-body-font-size')   || '14px');
  const [btnFrom, setBtnFrom] = useState(() => localStorage.getItem('theme-btn-from') || '#1D4ED8');
  const [btnTo,   setBtnTo]   = useState(() => localStorage.getItem('theme-btn-to')   || '#3B82F6');
  const [dashCards, setDashCards] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dashboard-visible-cards')) || DEFAULT_DASH_CARDS; }
    catch { return DEFAULT_DASH_CARDS; }
  });
  const [fleetChips, setFleetChips] = useState(() => {
    try { return JSON.parse(localStorage.getItem('myfleet-visible-chips')) || DEFAULT_FLEET_CHIPS; }
    catch { return DEFAULT_FLEET_CHIPS; }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await getSettings();
      
      // Handle response - check if it has the wrapper or is direct data
      let settingsData;
      if (res.data.success && res.data.data) {
        // Wrapped response: { success: true, data: {...} }
        settingsData = res.data.data;
      } else if (res.data.speedRanges !== undefined) {
        // Direct response: { id: 1, speedRanges: [...], ... }
        settingsData = res.data;
      } else {
        throw new Error('Invalid response format');
      }
      
      setSpeedRanges(settingsData.speedRanges || []);
      setSpeedThreshold(settingsData.speedThreshold || 80);
    } catch (error) {
      toast.error('Failed to load settings');
      console.error('Settings fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validate ranges
      for (let i = 0; i < speedRanges.length; i++) {
        const range = speedRanges[i];
        if (!range.label || !range.color || range.min === '' || range.max === '') {
          toast.error(`Range ${i + 1}: All fields are required`);
          return;
        }
        if (range.min >= range.max) {
          toast.error(`Range ${i + 1}: Min must be less than Max`);
          return;
        }
      }
      
      localStorage.setItem('mapStyle', mapStyle);
      localStorage.setItem('theme-sidebar',                sidebarTheme);
      localStorage.setItem('theme-table-header-font-size', tableHeaderFontSize);
      localStorage.setItem('theme-table-body-font-size',   tableBodyFontSize);
      localStorage.setItem('theme-btn-from', btnFrom);
      localStorage.setItem('theme-btn-to',   btnTo);
      localStorage.setItem('dashboard-visible-cards', JSON.stringify(dashCards));
      localStorage.setItem('myfleet-visible-chips',   JSON.stringify(fleetChips));
      window.dispatchEvent(new Event('dashboard-cards-updated'));
      window.dispatchEvent(new Event('fleet-chips-updated'));
      applyTheme();
      const res = await updateSettings({ speedRanges, speedThreshold });
      if (res.data.success) {
        toast.success('Settings saved successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset to default settings?')) return;
    
    try {
      setSaving(true);
      const res = await resetSettings();
      
      // Handle response - check if it has the wrapper or is direct data
      let settingsData;
      if (res.data.success && res.data.data) {
        settingsData = res.data.data;
      } else if (res.data.speedRanges !== undefined) {
        settingsData = res.data;
      } else {
        throw new Error('Invalid response format');
      }
      
      setSpeedRanges(settingsData.speedRanges || []);
      setSpeedThreshold(settingsData.speedThreshold || 80);
      setMapStyle('voyager');              localStorage.setItem('mapStyle', 'voyager');
      setSidebarTheme('navy');             localStorage.setItem('theme-sidebar', 'navy');
      setTableHeaderFontSize('11px');      localStorage.setItem('theme-table-header-font-size', '11px');
      setTableBodyFontSize('14px');        localStorage.setItem('theme-table-body-font-size', '14px');
      setBtnFrom('#1D4ED8');               localStorage.setItem('theme-btn-from', '#1D4ED8');
      setBtnTo('#3B82F6');                 localStorage.setItem('theme-btn-to', '#3B82F6');
      setDashCards(DEFAULT_DASH_CARDS);    localStorage.setItem('dashboard-visible-cards', JSON.stringify(DEFAULT_DASH_CARDS));
      setFleetChips(DEFAULT_FLEET_CHIPS);  localStorage.setItem('myfleet-visible-chips',   JSON.stringify(DEFAULT_FLEET_CHIPS));
      applyTheme();
      toast.success('Settings reset to defaults');
    } catch (error) {
      toast.error('Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  const addRange = () => {
    setSpeedRanges([
      ...speedRanges,
      { min: 0, max: 10, color: '#3b82f6', label: 'New Range' },
    ]);
  };

  const removeRange = (index) => {
    setSpeedRanges(speedRanges.filter((_, i) => i !== index));
  };

  const updateRange = (index, field, value) => {
    const updated = [...speedRanges];
    updated[index][field] = field === 'min' || field === 'max' ? Number(value) : value;
    setSpeedRanges(updated);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
        <div style={{ marginTop: '16px', color: '#64748b' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%' }}>
      {/* ── Main Content ── */}
      <div style={{ display: 'grid', gap: '20px' }}>
        
        {/* ── Theme & Appearance Card ── */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#f3e8ff', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🎨</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Theme & Appearance</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Customize sidebar, table sizes, and button colors</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Sidebar color */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={labelStyle}>Sidebar Color</label>
                <button onClick={() => setSidebarTheme('navy')}
                  style={{ fontSize: '11px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ↺ Default
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { key: 'navy',   label: 'Navy',   color: '#1A2F6B' },
                  { key: 'slate',  label: 'Slate',  color: '#1E293B' },
                  { key: 'noir',   label: 'Noir',   color: '#18181B' },
                  { key: 'indigo', label: 'Indigo', color: '#312E81' },
                  { key: 'ocean',  label: 'Ocean',  color: '#1D4ED8' },
                  { key: 'violet', label: 'Violet', color: '#6D28D9' },
                  { key: 'forest', label: 'Forest', color: '#14532D' },
                  { key: 'teal',   label: 'Teal',   color: '#0D9488' },
                  { key: 'sky',    label: 'Sky',    color: '#0284C7' },
                  { key: 'rose',   label: 'Rose',   color: '#BE185D' },
                  { key: 'amber',  label: 'Amber',  color: '#92400E' },
                  { key: 'gray',   label: 'Gray',   color: '#475569' },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setSidebarTheme(opt.key)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', border: `2px solid ${sidebarTheme === opt.key ? '#2563eb' : '#e2e8f0'}`, background: sidebarTheme === opt.key ? '#eff6ff' : '#f8fafc', cursor: 'pointer', minWidth: '60px', boxShadow: sidebarTheme === opt.key ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none', transition: 'all 0.15s' }}>
                    <div style={{ width: '40px', height: '26px', borderRadius: '6px', background: opt.color, border: '1px solid rgba(0,0,0,0.12)', boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15)` }} />
                    <span style={{ fontSize: '10px', fontWeight: 600, color: sidebarTheme === opt.key ? '#2563eb' : '#64748b' }}>{opt.label}</span>
                    {sidebarTheme === opt.key && <span style={{ fontSize: '9px', color: '#2563eb', fontWeight: 700 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Table font sizes — ONLY configurable table setting */}
            <div>
              <label style={{ ...labelStyle, marginBottom: '14px' }}>Table Font Sizes</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {[
                  { label: 'Header Font Size', val: tableHeaderFontSize, set: setTableHeaderFontSize, dflt: '11px', desc: 'Column header text size', opts: ['10px','11px','12px','13px','14px'] },
                  { label: 'Body Font Size',   val: tableBodyFontSize,   set: setTableBodyFontSize,   dflt: '14px', desc: 'Table row data text size', opts: ['12px','13px','14px','15px','16px'] },
                ].map(item => (
                  <div key={item.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{item.label}</div>
                      <button onClick={() => item.set(item.dflt)}
                        style={{ fontSize: '10px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        ↺ Default
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>{item.desc}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.opts.map(sz => (
                        <button key={sz} onClick={() => item.set(sz)}
                          style={{ padding: '5px 12px', borderRadius: '6px', border: `1.5px solid ${item.val === sz ? '#2563eb' : '#e2e8f0'}`, background: item.val === sz ? '#eff6ff' : '#fff', color: item.val === sz ? '#2563eb' : '#64748b', fontSize: sz, fontWeight: item.val === sz ? 700 : 500, cursor: 'pointer', transition: 'all 0.12s' }}>
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Button Gradient */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <label style={labelStyle}>Button Gradient</label>
                <button onClick={() => { setBtnFrom('#1D4ED8'); setBtnTo('#3B82F6'); }}
                  style={{ fontSize: '11px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ↺ Default
                </button>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {[
                    { label: 'Start Color', val: btnFrom, set: setBtnFrom },
                    { label: 'End Color',   val: btnTo,   set: setBtnTo   },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="color" value={item.val} onChange={e => item.set(e.target.value)} style={{ width: '36px', height: '36px', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', padding: '2px' }} />
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>{item.val}</span>
                      </div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</div>
                    <button style={{ background: `linear-gradient(135deg, ${btnFrom} 0%, ${btnTo} 100%)`, color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 20px', fontWeight: 700, fontSize: '13px', cursor: 'default', boxShadow: '0 2px 8px rgba(37,99,235,0.22)' }}>
                      + Add Vehicle
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Ocean Blue ⭐', from: '#1D4ED8', to: '#3B82F6' },
                    { label: 'Forest',       from: '#047857', to: '#10B981' },
                    { label: 'Violet',       from: '#5B21B6', to: '#8B5CF6' },
                    { label: 'Sunset',       from: '#B91C1C', to: '#F97316' },
                    { label: 'Midnight',     from: '#0F172A', to: '#334155' },
                    { label: 'Rose',         from: '#9D174D', to: '#EC4899' },
                  ].map(p => (
                    <button key={p.label} onClick={() => { setBtnFrom(p.from); setBtnTo(p.to); }}
                      style={{ background: `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`, color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Map Settings Card ── */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: '#dbeafe', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🗺️</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Map Display Settings</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Choose map style for tracking and fleet view</div>
                </div>
              </div>
              <button onClick={() => setMapStyle('voyager')}
                style={{ fontSize: '11px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                ↺ Default
              </button>
            </div>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {[
                { id: 'roadmap',  label: 'Roadmap',      desc: 'Google Maps',       preview: 'linear-gradient(135deg,#e8f4f8 0%,#b8d4e8 50%,#7ab3d4 100%)',  badge: '⭐ Default' },
                { id: 'light',    label: 'Light',         desc: 'Clean minimal',     preview: 'linear-gradient(135deg,#f5f5f5 0%,#e8e8e8 50%,#d0d0d0 100%)',  badge: '' },
                { id: 'osm',      label: 'Street Map',    desc: 'OpenStreetMap',     preview: 'linear-gradient(135deg,#f0ebe0 0%,#ddd 50%,#c8c8b8 100%)',     badge: '' },
                { id: 'terrain',  label: 'Terrain',       desc: 'Google Terrain',    preview: 'linear-gradient(135deg,#d4e8c8 0%,#a8c890 50%,#78a060 100%)',  badge: '🏔️' },
                { id: 'dark',     label: 'Dark',          desc: 'Night mode',        preview: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)',  badge: '🌙' },
                { id: 'satellite',label: 'Satellite',     desc: 'Google Satellite',  preview: 'linear-gradient(135deg,#1a3a1a 0%,#2d5a27 50%,#4a7c42 100%)', badge: '🛰️' },
                { id: 'hybrid',   label: 'Hybrid',        desc: 'Satellite + Labels',preview: 'linear-gradient(135deg,#1a3a2e 0%,#2d4a37 50%,#3a6c52 100%)', badge: '🗺️' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMapStyle(opt.id)}
                  style={{
                    border: `2px solid ${mapStyle === opt.id ? '#2563eb' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: '#fff',
                    padding: 0,
                    textAlign: 'left',
                    boxShadow: mapStyle === opt.id ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ height: '70px', background: opt.preview, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {opt.badge && <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '11px', background: 'rgba(0,0,0,0.4)', color: '#fff', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>{opt.badge}</span>}
                    {mapStyle === opt.id && (
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 800 }}>✓</div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', margin: '12px 0 0' }}>Map style is saved locally and applies immediately to the Tracking page.</p>
          </div>
        </div>

        {/* ── Speed Alert Threshold Card ── */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: '#fee2e2', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🚨</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Speed Alert Threshold</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Set maximum speed limit for overspeed alerts</div>
                </div>
              </div>
              <button onClick={() => setSpeedThreshold(80)}
                style={{ fontSize: '11px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                ↺ Default (80)
              </button>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Maximum Speed Limit (km/h)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="number"
                  value={speedThreshold}
                  onChange={(e) => setSpeedThreshold(Number(e.target.value))}
                  style={{ ...inputStyle, width: '140px', fontSize: '16px', fontWeight: 600 }}
                  min="0"
                  max="300"
                />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>km/h</span>
                <div
                  style={{
                    padding: '6px 14px',
                    background: speedThreshold > 100 ? '#fee2e2' : '#fef3c7',
                    color: speedThreshold > 100 ? '#dc2626' : '#f59e0b',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {speedThreshold > 100 ? '⚠️ High Speed Limit' : '✓ Normal Range'}
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'block' }}>
                Vehicles exceeding this speed will show overspeed alerts on dashboard
              </span>
            </div>
          </div>
        </div>

        {/* ── Speed Range Color Coding Card ── */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: '#dbeafe', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🎨</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Speed Range Color Coding</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Define speed ranges with colors for path visualization</div>
                </div>
              </div>
              <button onClick={addRange} className="btn btn-primary btn-sm">
                ➕ Add Range
              </button>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {speedRanges.map((range, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px 110px 80px 40px',
                    gap: '12px',
                    alignItems: 'end',
                    padding: '16px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {/* Label */}
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Range Label</label>
                    <input
                      type="text"
                      value={range.label}
                      onChange={(e) => updateRange(index, 'label', e.target.value)}
                      style={inputStyle}
                      placeholder="e.g., Normal"
                    />
                  </div>

                  {/* Min Speed */}
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Min (km/h)</label>
                    <input
                      type="number"
                      value={range.min}
                      onChange={(e) => updateRange(index, 'min', e.target.value)}
                      style={inputStyle}
                      min="0"
                    />
                  </div>

                  {/* Max Speed */}
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Max (km/h)</label>
                    <input
                      type="number"
                      value={range.max}
                      onChange={(e) => updateRange(index, 'max', e.target.value)}
                      style={inputStyle}
                      min="0"
                    />
                  </div>

                  {/* Color */}
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Color</label>
                    <input
                      type="color"
                      value={range.color}
                      onChange={(e) => updateRange(index, 'color', e.target.value)}
                      style={{
                        width: '100%',
                        height: '42px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: range.color,
                      }}
                    />
                  </div>

                  {/* Remove Button */}
                  <div style={{ marginBottom: '18px' }}>
                    <button
                      onClick={() => removeRange(index)}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        padding: '10px',
                        fontSize: '16px',
                        width: '42px',
                        height: '42px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                      title="Remove range"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}

              {speedRanges.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px', 
                  color: '#94a3b8',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>No speed ranges defined</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Click "Add Range" to create your first speed range</div>
                </div>
              )}
            </div>

            {/* Preview */}
            {speedRanges.length > 0 && (
              <div style={{ marginTop: '20px', padding: '16px', background: '#f1f5f9', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🎨 Color Preview
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {speedRanges.map((range, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        background: '#fff',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: range.color,
                          border: '2px solid #fff',
                          boxShadow: '0 0 0 1px #e2e8f0',
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                        {range.label}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        ({range.min}-{range.max} km/h)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Widget Visibility Card ── */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#fef9c3', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>📊</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Dashboard & Fleet Widgets</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Choose which stat cards appear on Dashboard and My Fleet pages</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

            {/* Dashboard Cards column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={labelStyle}>Dashboard Cards</label>
                <button onClick={() => setDashCards(ALL_DASH_CARDS_DEF.map(c => c.id))}
                  style={{ fontSize: '11px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Select All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ALL_DASH_CARDS_DEF.map(card => {
                  const on = dashCards.includes(card.id);
                  return (
                    <label key={card.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${on ? '#2563eb' : '#e2e8f0'}`, background: on ? '#eff6ff' : '#f8fafc', transition: 'all 0.12s', userSelect: 'none' }}>
                      <input type="checkbox" checked={on} onChange={e => setDashCards(e.target.checked ? [...dashCards, card.id] : dashCards.filter(id => id !== card.id))}
                        style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer' }} />
                      <span style={{ fontSize: '15px' }}>{card.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: on ? '#1d4ed8' : '#475569', flex: 1 }}>{card.title}</span>
                      {on && <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '1px 6px', borderRadius: '4px' }}>ON</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Fleet Chips column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={labelStyle}>My Fleet Stat Cards</label>
                <button onClick={() => setFleetChips(ALL_FLEET_CHIPS_DEF.map(c => c.id))}
                  style={{ fontSize: '11px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Select All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ALL_FLEET_CHIPS_DEF.map(chip => {
                  const on = fleetChips.includes(chip.id);
                  return (
                    <label key={chip.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${on ? '#2563eb' : '#e2e8f0'}`, background: on ? '#eff6ff' : '#f8fafc', transition: 'all 0.12s', userSelect: 'none' }}>
                      <input type="checkbox" checked={on} onChange={e => setFleetChips(e.target.checked ? [...fleetChips, chip.id] : fleetChips.filter(id => id !== chip.id))}
                        style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer' }} />
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: chip.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: '15px' }}>{chip.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: on ? '#1d4ed8' : '#475569', flex: 1 }}>{chip.label}</span>
                      {on && <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '1px 6px', borderRadius: '4px' }}>ON</span>}
                    </label>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={handleReset} disabled={saving} className="btn btn-outline">
            🔄 Reset All to Defaults
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? '💾 Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleSettings;

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getSettings, updateSettings, resetSettings } from '../services/settings.service';
import { applyTheme } from '../utils/theme';
import MenuManager from './MenuManager';

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
  // Fleet-state cards — counts derived live from the canonical state model
  // (Running / Stopped / Offline / No Data — mutually exclusive).
  { id: 'state_offline',  title: 'Offline (state)',   icon: '⚫' },
  { id: 'state_speeding', title: 'Speeding (state)',  icon: '🏎️' },
  { id: 'state_running',  title: 'Running (state)',   icon: '🟢' },
  { id: 'state_stopped',  title: 'Stopped (state)',   icon: '🔴' },
  { id: 'state_nodata',   title: 'No Data (state)',   icon: '📵' },
];
const DEFAULT_DASH_CARDS   = ['registered','active','overspeed','inactive','gps_active','challans','renewals'];

const ALL_FLEET_CHIPS_DEF = [
  { id: 'total',     label: 'Total',     icon: '🚗', dot: '#64748b' },
  { id: 'running',   label: 'Running',   icon: '🟢', dot: '#22c55e' },
  { id: 'stopped',   label: 'Stopped',   icon: '🔴', dot: '#ef4444' },
  { id: 'offline',   label: 'Offline',   icon: '⚫', dot: '#6b7280' },
  { id: 'nodata',    label: 'No Data',   icon: '📵', dot: '#94a3b8' },
  { id: 'overspeed', label: 'Overspeed', icon: '🏎️', dot: '#dc2626' },
];
const DEFAULT_FLEET_CHIPS = ['total','running','stopped','offline','nodata'];

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
  const [mapStyle,    setMapStyle]    = useState(() => localStorage.getItem('mapStyle')     || 'voyager');
  const [focusZoom,   setFocusZoom]   = useState(() => parseInt(localStorage.getItem('mapFocusZoom') || '13', 10));
  // sidebarTheme stores a hex colour (migrates legacy key → hex on first load)
  const [sidebarTheme, setSidebarTheme] = useState(() => {
    const stored = localStorage.getItem('theme-sidebar') || 'navy';
    if (stored.startsWith('#')) return stored;
    const PRESETS = { navy:'#1A2F6B', slate:'#1E293B', noir:'#18181B', indigo:'#312E81', ocean:'#1D4ED8', violet:'#6D28D9', forest:'#14532D', teal:'#0D9488', sky:'#0284C7', rose:'#BE185D', amber:'#92400E', gray:'#475569' };
    return PRESETS[stored] || '#1A2F6B';
  });
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
      
      localStorage.setItem('mapStyle',     mapStyle);
      localStorage.setItem('mapFocusZoom', String(focusZoom));
      localStorage.setItem('theme-sidebar', sidebarTheme);
      // Apply immediately so the sidebar updates without page reload
      document.documentElement.style.setProperty('--theme-sidebar-bg', sidebarTheme);
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
      setFocusZoom(13);                    localStorage.setItem('mapFocusZoom', '13');
      setSidebarTheme('#1A2F6B');           localStorage.setItem('theme-sidebar', '#1A2F6B'); document.documentElement.style.setProperty('--theme-sidebar-bg', '#1A2F6B');
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

        {/* ── Sidebar Menu Manager ── */}
        <MenuManager />

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

            {/* App Theme Color */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>App Theme Color</label>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Applies to sidebar, header strip, and action buttons</div>
                </div>
                <button onClick={() => { setSidebarTheme('#1A2F6B'); document.documentElement.style.setProperty('--theme-sidebar-bg', '#1A2F6B'); }}
                  style={{ fontSize: '11px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ↺ Reset
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Color picker — large, prominent */}
                <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="color"
                    value={sidebarTheme}
                    onChange={e => {
                      setSidebarTheme(e.target.value);
                      document.documentElement.style.setProperty('--theme-sidebar-bg', e.target.value);
                    }}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                  <div style={{
                    width: 72, height: 72, borderRadius: '12px', background: sidebarTheme,
                    border: '3px solid #fff', boxShadow: '0 0 0 1px #e2e8f0, 0 4px 14px rgba(0,0,0,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.1s',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
                      <circle cx="13.5" cy="6.5" r="0.5" fill="rgba(255,255,255,0.7)"/><circle cx="17.5" cy="10.5" r="0.5" fill="rgba(255,255,255,0.7)"/><circle cx="8.5" cy="7.5" r="0.5" fill="rgba(255,255,255,0.7)"/><circle cx="6.5" cy="12.5" r="0.5" fill="rgba(255,255,255,0.7)"/>
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                    </svg>
                  </div>
                </label>

                {/* Hex input + preview */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Hex Color</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      value={sidebarTheme}
                      onChange={e => {
                        const v = e.target.value;
                        setSidebarTheme(v);
                        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                          document.documentElement.style.setProperty('--theme-sidebar-bg', v);
                        }
                      }}
                      maxLength={7}
                      placeholder="#1A2F6B"
                      style={{ width: '110px', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, color: '#1e293b', outline: 'none', letterSpacing: '0.05em' }}
                      onFocus={e => e.target.style.borderColor = '#2563eb'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                    <label style={{ cursor: 'pointer' }}>
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(sidebarTheme) ? sidebarTheme : '#1A2F6B'}
                        onChange={e => {
                          setSidebarTheme(e.target.value);
                          document.documentElement.style.setProperty('--theme-sidebar-bg', e.target.value);
                        }}
                        style={{ width: 36, height: 36, padding: 2, borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', background: 'none' }}
                      />
                    </label>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>Click the swatch or type any hex code</div>
                </div>

                {/* Live sidebar preview */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Preview</div>
                  <div style={{ width: 80, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ background: sidebarTheme, padding: '8px 10px 24px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {[0.8, 0.5, 0.5, 0.5].map((op, i) => (
                        <div key={i} style={{ height: 5, borderRadius: 3, background: `rgba(255,255,255,${op})`, width: i === 0 ? '70%' : `${50 + i * 10}%` }} />
                      ))}
                    </div>
                    <div style={{ background: '#f8fafc', padding: '4px 6px', display: 'flex', gap: 4 }}>
                      {[sidebarTheme, '#94a3b8', '#94a3b8'].map((c, i) => (
                        <div key={i} style={{ height: 4, borderRadius: 2, background: c, flex: i === 0 ? '1.5' : '1' }} />
                      ))}
                    </div>
                  </div>
                </div>
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
                { id: 'voyager',  label: 'Voyager',      desc: 'Carto — Recommended', preview: 'linear-gradient(135deg,#e8f4f8 0%,#c5dff0 50%,#9ec5e0 100%)',  badge: '⭐ Default' },
                { id: 'light',    label: 'Light',         desc: 'Carto minimal',      preview: 'linear-gradient(135deg,#f5f5f5 0%,#e8e8e8 50%,#d0d0d0 100%)',  badge: '' },
                { id: 'dark',     label: 'Dark',          desc: 'Night mode',         preview: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)',  badge: '🌙' },
                { id: 'osm',      label: 'Street Map',    desc: 'OpenStreetMap',      preview: 'linear-gradient(135deg,#f0ebe0 0%,#ddd 50%,#c8c8b8 100%)',     badge: '' },
                { id: 'satellite',label: 'Satellite',     desc: 'Google Satellite',   preview: 'linear-gradient(135deg,#1a3a1a 0%,#2d5a27 50%,#4a7c42 100%)',  badge: '🛰️' },
                { id: 'hybrid',   label: 'Hybrid',        desc: 'Satellite + Labels', preview: 'linear-gradient(135deg,#1a3a2e 0%,#2d4a37 50%,#3a6c52 100%)',  badge: '🗺️' },
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

            {/* Focus Zoom */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Vehicle Click Zoom Level</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>How far in the map zooms when you click a vehicle</div>
                </div>
                <button onClick={() => setFocusZoom(13)}
                  style={{ fontSize: '11px', color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ↺ Default (13)
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <input type="range" min={8} max={18} step={1} value={focusZoom}
                  onChange={e => setFocusZoom(parseInt(e.target.value, 10))}
                  style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52, background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 8, padding: '4px 0' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{focusZoom}</span>
                  <span style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
                    {focusZoom <= 10 ? 'Country' : focusZoom <= 12 ? 'City' : focusZoom <= 14 ? 'District' : focusZoom <= 16 ? 'Street' : 'Building'}
                  </span>
                </div>
              </div>
            </div>
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

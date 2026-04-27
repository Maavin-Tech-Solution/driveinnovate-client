import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { getAlerts, createAlert, updateAlert, toggleAlert, deleteAlert } from '../services/alert.service';
import { getVehicles } from '../services/vehicle.service';
import { getGroups } from '../services/group.service';

// ─── Constants ────────────────────────────────────────────────────────────────
const ALERT_TYPES = [
  { value: 'SPEED_EXCEEDED', label: 'Speed Exceeded',      icon: '🏎️', color: '#dc2626', desc: 'Triggers when vehicle speed exceeds the threshold (km/h)' },
  { value: 'NOT_MOVING',     label: 'Vehicle Not Moving',  icon: '🅿️', color: '#d97706', desc: 'Triggers when vehicle speed stays at 0 for longer than the threshold (minutes)' },
  { value: 'IDLE_ENGINE',    label: 'Engine Idle',         icon: '⏸️', color: '#7c3aed', desc: 'Triggers when engine is ON but vehicle speed is 0 for longer than threshold (minutes)' },
  { value: 'FUEL_THEFT',     label: 'Fuel Theft',          icon: '🛢️', color: '#059669', desc: 'Triggers when fuel drops by at least the threshold (litres) within the window (minutes). FMB devices only; vehicle must have fuel sensor enabled and a tank capacity configured.' },
];

const SCOPES = [
  { value: 'ALL',     label: 'All My Vehicles',  icon: '🚘' },
  { value: 'GROUP',   label: 'Vehicle Group',    icon: '📦' },
  { value: 'VEHICLE', label: 'Specific Vehicle', icon: '🚗' },
];

const TYPE_META = Object.fromEntries(ALERT_TYPES.map(t => [t.value, t]));

const thresholdLabel = (type) => ({
  SPEED_EXCEEDED: 'Speed Limit (km/h)',
  NOT_MOVING:     'Duration (minutes)',
  IDLE_ENGINE:    'Duration (minutes)',
  FUEL_THEFT:     'Minimum Drop (litres)',
}[type] || 'Threshold');

const thresholdPlaceholder = (type) => ({
  SPEED_EXCEEDED: 'e.g. 80',
  NOT_MOVING:     'e.g. 10',
  IDLE_ENGINE:    'e.g. 30',
  FUEL_THEFT:     'e.g. 10',
}[type] || '');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, size = 14, color = 'currentColor', sw = 1.75 }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0, display: 'block' } };
  const I = {
    plus:    <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    edit:    <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:   <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
    x:       <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    bell:    <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
    info:    <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    mail:    <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    check:   <polyline points="20 6 9 17 4 12"/>,
    clock:   <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  };
  return <svg {...p}>{I[n] ?? null}</svg>;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, accent }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: accent, marginTop: 1, fontWeight: 600 }}>{sub}</div>}
    </div>
  </div>
);

// ─── Alert Form Modal ─────────────────────────────────────────────────────────
const AlertForm = ({ initial, vehicles, groups, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: '', description: '', type: 'SPEED_EXCEEDED', scope: 'ALL',
    vehicleId: '', groupId: '', threshold: '', windowMinutes: '', cooldownMinutes: '30',
    notifyEmails: '', isActive: true,
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedType = TYPE_META[form.type] || ALERT_TYPES[0];

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Alert name is required');
    if (!form.threshold || isNaN(form.threshold)) return toast.error('Valid threshold is required');
    if (form.type === 'FUEL_THEFT' && (!form.windowMinutes || isNaN(form.windowMinutes))) {
      return toast.error('Drop window (minutes) is required for fuel-theft alerts');
    }
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', borderRadius: 6 };
  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: '#fff', width: 560, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', borderRadius: 12, boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: 'var(--theme-sidebar-bg)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔔</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{initial ? 'Edit Alert' : 'Create New Alert'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
            <Ic n="x" size={14} color="#fff" />
          </button>
        </div>

        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Name + Description row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Alert Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Highway Speed Alert" style={inp} />
            </div>
            <div>
              <label style={lbl}>Description</label>
              <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description" style={inp} />
            </div>
          </div>

          {/* Alert Type */}
          <div>
            <label style={lbl}>Alert Type *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {ALERT_TYPES.map(t => (
                <button key={t.value} onClick={() => set('type', t.value)}
                  style={{ padding: '12px 8px', border: `2px solid ${form.type === t.value ? t.color : '#e2e8f0'}`, borderRadius: 10, background: form.type === t.value ? `${t.color}12` : '#f8fafc', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 24, marginBottom: 5 }}>{t.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: form.type === t.value ? t.color : '#475569' }}>{t.label}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              ℹ️ {selectedType.desc}
            </div>
          </div>

          {/* Threshold + Cooldown row */}
          <div style={{ display: 'grid', gridTemplateColumns: form.type === 'FUEL_THEFT' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>{thresholdLabel(form.type)} *</label>
              <input type="number" min="0" value={form.threshold} onChange={e => set('threshold', e.target.value)}
                placeholder={thresholdPlaceholder(form.type)} style={inp} />
            </div>
            {form.type === 'FUEL_THEFT' && (
              <div>
                <label style={lbl}>Within (minutes) *</label>
                <input type="number" min="1" value={form.windowMinutes || ''} onChange={e => set('windowMinutes', e.target.value)}
                  placeholder="e.g. 5" style={inp} />
              </div>
            )}
            <div>
              <label style={lbl}>Cooldown (minutes)</label>
              <input type="number" min="1" value={form.cooldownMinutes} onChange={e => set('cooldownMinutes', e.target.value)} placeholder="30" style={inp} />
            </div>
          </div>

          {/* Scope */}
          <div>
            <label style={lbl}>Apply To *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {SCOPES.map(s => (
                <button key={s.value} onClick={() => set('scope', s.value)}
                  style={{ padding: '10px 8px', border: `2px solid ${form.scope === s.value ? '#2563eb' : '#e2e8f0'}`, borderRadius: 9, background: form.scope === s.value ? '#eff6ff' : '#f8fafc', cursor: 'pointer', fontSize: 12, fontWeight: form.scope === s.value ? 700 : 500, color: form.scope === s.value ? '#2563eb' : '#64748b', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, marginBottom: 3 }}>{s.icon}</div>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle / Group selector */}
          {form.scope === 'VEHICLE' && (
            <div>
              <label style={lbl}>Vehicle *</label>
              <select value={form.vehicleId} onChange={e => set('vehicleId', e.target.value)} style={inp}>
                <option value="">— Select vehicle —</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleName || v.vehicleNumber} {v.vehicleName && v.vehicleNumber ? `(${v.vehicleNumber})` : ''}</option>)}
              </select>
            </div>
          )}
          {form.scope === 'GROUP' && (
            <div>
              <label style={lbl}>Group *</label>
              <select value={form.groupId} onChange={e => set('groupId', e.target.value)} style={inp}>
                <option value="">— Select group —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.vehicles?.length || 0} vehicles)</option>)}
              </select>
            </div>
          )}

          {/* Extra emails */}
          <div>
            <label style={lbl}>Additional Notification Emails</label>
            <input value={form.notifyEmails} onChange={e => set('notifyEmails', e.target.value)}
              placeholder="extra@company.com, manager@company.com" style={inp} />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Comma-separated. Default stakeholder emails are always notified.</div>
          </div>

          {/* Active toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: form.isActive ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${form.isActive ? '#bbf7d0' : '#e2e8f0'}` }}>
            <button onClick={() => set('isActive', !form.isActive)}
              style={{ width: 44, height: 26, borderRadius: 13, border: 'none', background: form.isActive ? '#22c55e' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: form.isActive ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
            </button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Alert {form.isActive ? 'Active' : 'Paused'}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{form.isActive ? 'This alert will be monitored in real-time.' : 'Alert is paused and will not trigger.'}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', borderRadius: 8, fontWeight: 600 }}>Cancel</button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ padding: '10px 24px', background: saving ? '#94a3b8' : 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8 }}>
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Alert'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Alert Card ───────────────────────────────────────────────────────────────
const AlertCard = ({ alert, onEdit, onToggle, onDelete }) => {
  const meta = TYPE_META[alert.type] || {};
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: `3px solid ${meta.color || '#2563eb'}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: `${meta.color || '#2563eb'}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
          {meta.icon || '🔔'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{alert.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: `${meta.color || '#2563eb'}14`, color: meta.color || '#2563eb' }}>{meta.label || alert.type}</span>
          </div>
          {alert.description && <div style={{ fontSize: 12, color: '#64748b' }}>{alert.description}</div>}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button onClick={() => onToggle(alert)} title={alert.isActive ? 'Pause' : 'Enable'}
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', background: alert.isActive ? '#f0fdf4' : '#f8fafc', cursor: 'pointer', borderRadius: 7, fontSize: 13 }}>
            {alert.isActive ? '⏸' : '▶'}
          </button>
          <button onClick={() => onEdit(alert)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', borderRadius: 7 }}>
            <Ic n="edit" size={13} color="#64748b" />
          </button>
          <button onClick={() => onDelete(alert)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', borderRadius: 7 }}>
            <Ic n="trash" size={13} color="#dc2626" />
          </button>
        </div>
      </div>

      {/* Details row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
        <span style={{ fontSize: 12, color: '#374151' }}>
          <strong>Threshold:</strong> {
            alert.type === 'SPEED_EXCEEDED' ? `${alert.threshold} km/h` :
            alert.type === 'FUEL_THEFT'     ? `${alert.threshold} L in ${alert.windowMinutes || '?'} min` :
            `${alert.threshold} min`
          }
        </span>
        <span style={{ color: '#cbd5e1' }}>|</span>
        <span style={{ fontSize: 12, color: '#374151' }}>
          <strong>Scope:</strong> {alert.scope === 'VEHICLE' ? (alert.vehicle?.vehicleNumber || `Vehicle #${alert.vehicleId}`) : alert.scope === 'GROUP' ? `Group #${alert.groupId}` : 'All Vehicles'}
        </span>
        <span style={{ color: '#cbd5e1' }}>|</span>
        <span style={{ fontSize: 12, color: '#374151' }}><strong>Cooldown:</strong> {alert.cooldownMinutes}m</span>
        {alert.lastTriggeredAt && (
          <>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ic n="clock" size={11} color="#94a3b8" /> {fmtDate(alert.lastTriggeredAt)}
            </span>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: alert.isActive ? '#dcfce7' : '#f1f5f9', color: alert.isActive ? '#16a34a' : '#94a3b8' }}>
          {alert.isActive ? '● Active' : '○ Paused'}
        </span>
        {alert.notifyEmails && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7c3aed' }}>
            <Ic n="mail" size={11} color="#7c3aed" /> {alert.notifyEmails.split(',').length} extra email(s)
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [aRes, vRes, gRes] = await Promise.all([getAlerts(), getVehicles(), getGroups()]);
      setAlerts(aRes.data || []);
      setVehicles(vRes.data || []);
      setGroups(gRes.data || []);
    } catch { toast.error('Failed to load alerts'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setEditingAlert(null); setShowForm(true); };
  const openEdit   = (a) => { setEditingAlert(a); setShowForm(true); };

  const handleSave = async (form) => {
    try {
      if (editingAlert) {
        await updateAlert(editingAlert.id, form);
        toast.success('Alert updated');
      } else {
        await createAlert(form);
        toast.success('Alert created');
      }
      setShowForm(false);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || e.message || 'Save failed'); throw e; }
  };

  const handleToggle = async (alert) => {
    try {
      await toggleAlert(alert.id);
      toast.success(`Alert ${alert.isActive ? 'paused' : 'enabled'}`);
      fetchAll();
    } catch { toast.error('Failed to update alert'); }
  };

  const handleDelete = async (alert) => {
    if (!window.confirm(`Delete alert "${alert.name}"?`)) return;
    try {
      await deleteAlert(alert.id);
      toast.success('Alert deleted');
      fetchAll();
    } catch { toast.error('Failed to delete alert'); }
  };

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filterType !== 'ALL' && a.type !== filterType) return false;
      if (filterStatus === 'ACTIVE' && !a.isActive) return false;
      if (filterStatus === 'PAUSED' && a.isActive) return false;
      return true;
    });
  }, [alerts, filterType, filterStatus]);

  const activeCount  = alerts.filter(a => a.isActive).length;
  const pausedCount  = alerts.filter(a => !a.isActive).length;
  const lastFired    = alerts.reduce((latest, a) => {
    if (!a.lastTriggeredAt) return latest;
    if (!latest || new Date(a.lastTriggeredAt) > new Date(latest)) return a.lastTriggeredAt;
    return latest;
  }, null);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Page title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Fleet Alerts</div>
        <button onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, borderRadius: 8, boxShadow: '0 1px 4px rgba(37,99,235,0.3)' }}>
          <Ic n="plus" size={14} color="#fff" /> New Alert
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard icon="🔔" label="Total Alerts"   value={alerts.length}  accent="#2563eb" />
        <StatCard icon="🟢" label="Active Alerts"  value={activeCount}    accent="#16a34a" sub={activeCount > 0 ? 'Monitoring in real-time' : 'None active'} />
        <StatCard icon="⏸️" label="Paused Alerts"  value={pausedCount}    accent="#94a3b8" sub={pausedCount > 0 ? 'Will not trigger' : 'None paused'} />
        <StatCard icon="⚡" label="Last Triggered" value={lastFired ? fmtDate(lastFired) : 'Never'} accent="#d97706" />
      </div>

      {/* Filters + type chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', borderRadius: 7, padding: 3 }}>
          {[['ALL', `All (${alerts.length})`], ['ACTIVE', 'Active'], ['PAUSED', 'Paused']].map(([s, l]) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '5px 14px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: filterStatus === s ? 700 : 500, background: filterStatus === s ? '#fff' : 'transparent', color: filterStatus === s ? '#2563eb' : '#64748b', boxShadow: filterStatus === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontFamily: 'inherit' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterType('ALL')}
            style={{ padding: '5px 12px', border: `1px solid ${filterType === 'ALL' ? '#7c3aed' : '#e2e8f0'}`, borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: filterType === 'ALL' ? 700 : 400, background: filterType === 'ALL' ? '#f5f3ff' : '#fff', color: filterType === 'ALL' ? '#7c3aed' : '#64748b', fontFamily: 'inherit' }}>
            All Types
          </button>
          {ALERT_TYPES.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              style={{ padding: '5px 12px', border: `1px solid ${filterType === t.value ? t.color : '#e2e8f0'}`, borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: filterType === t.value ? 700 : 400, background: filterType === t.value ? `${t.color}12` : '#fff', color: filterType === t.value ? t.color : '#64748b', fontFamily: 'inherit' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span className="spinner" /> Loading alerts…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🔔</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', marginBottom: 6 }}>No alerts configured</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Create an alert to start monitoring your fleet in real-time.</div>
          <button onClick={openCreate} style={{ padding: '10px 24px', background: 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit' }}>
            + Create First Alert
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
          {filtered.map(a => (
            <AlertCard key={a.id} alert={a} onEdit={openEdit} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* How alerts work */}
      <div style={{ marginTop: 28, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ic n="info" size={15} color="#2563eb" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>How alerts work</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0 }}>
          {[
            { icon: '🏎️', title: 'Speed Exceeded', body: 'Fires immediately when current speed exceeds the configured threshold km/h. Respects cooldown to prevent spam.' },
            { icon: '🅿️', title: 'Not Moving',     body: 'Fires when speed stays at 0 for longer than the threshold minutes. Automatically clears when the vehicle moves.' },
            { icon: '⏸️', title: 'Engine Idle',    body: 'Fires when ignition is ON but vehicle speed is 0 for longer than threshold minutes. Useful for fuel monitoring.' },
            { icon: '📧', title: 'Email Alerts',   body: 'All stakeholder emails configured in the server .env are notified, plus any extra emails you add per alert.' },
          ].map((c, i) => (
            <div key={c.title} style={{ padding: '16px 20px', borderRight: i < 3 ? '1px solid #f1f5f9' : 'none', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{c.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <AlertForm
          initial={editingAlert}
          vehicles={vehicles}
          groups={groups}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default Alerts;

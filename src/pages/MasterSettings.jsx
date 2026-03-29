import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  getDeviceConfigs, createDeviceConfig, updateDeviceConfig, deleteDeviceConfig,
  getStates, createState, updateState, deleteState, resetStatesToDefaults,
} from '../services/master.service';

// ── Style helpers ────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid #e2e8f0', borderRadius: 6,
  background: '#fff', color: '#0f172a', boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};

const selectStyle = {
  ...inputStyle, cursor: 'pointer',
};

const btnPrimary = {
  padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none',
  borderRadius: 6, cursor: 'pointer', background: '#2563eb', color: '#fff',
};

const btnDanger = {
  padding: '5px 10px', fontSize: 11, fontWeight: 500, border: 'none',
  borderRadius: 5, cursor: 'pointer', background: '#fee2e2', color: '#dc2626',
};

const btnSecondary = {
  padding: '5px 10px', fontSize: 11, fontWeight: 500,
  border: '1px solid #e2e8f0', borderRadius: 5,
  cursor: 'pointer', background: '#f8fafc', color: '#334155',
};

const card = {
  background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
  padding: '16px 18px', marginBottom: 14,
};

// ── Field / operator options ─────────────────────────────────────────────────

const FIELD_OPTIONS = [
  { value: 'ignition',       label: 'Ignition (on/off)' },
  { value: 'movement',       label: 'Movement' },
  { value: 'speed',          label: 'Speed (km/h)' },
  { value: 'battery',        label: 'Battery (%)' },
  { value: 'gsmSignal',      label: 'GSM Signal' },
  { value: 'satellites',     label: 'Satellites' },
  { value: 'hasLocation',    label: 'Has GPS Location' },
  { value: 'lastSeenSeconds', label: 'Last Packet Received' },
];

const OPERATOR_OPTIONS = [
  { value: 'eq',  label: '= equals' },
  { value: 'neq', label: '≠ not equals' },
  { value: 'gt',  label: '> greater than' },
  { value: 'lt',  label: '< less than' },
  { value: 'gte', label: '≥ greater or equal' },
  { value: 'lte', label: '≤ less or equal' },
  { value: 'exists',    label: 'exists' },
  { value: 'notexists', label: 'not exists' },
];

const BOOLEAN_FIELDS    = ['ignition', 'movement', 'hasLocation'];
const NO_VALUE_OPS      = ['exists', 'notexists'];
const LAST_SEEN_FIELD   = 'lastSeenSeconds';

const LAST_SEEN_PRESETS = [
  { label: '2 min',   value: 120 },
  { label: '5 min',   value: 300 },
  { label: '10 min',  value: 600 },
  { label: '15 min',  value: 900 },
  { label: '20 min',  value: 1200 },
  { label: '30 min',  value: 1800 },
  { label: '45 min',  value: 2700 },
  { label: '1 hour',  value: 3600 },
  { label: '2 hours', value: 7200 },
  { label: '6 hours', value: 21600 },
  { label: '12 hours',value: 43200 },
  { label: '24 hours',value: 86400 },
];

// ── Empty form helpers ───────────────────────────────────────────────────────

const emptyDevice = () => ({ name: '', type: '', serverIp: '', serverPort: '', mongoCollection: '' });
const emptyState  = () => ({
  stateName: '', stateColor: '#3b82f6', stateIcon: '', priority: 50,
  conditionLogic: 'AND', conditions: [], isDefault: false,
});
const emptyCondition = () => ({ field: 'ignition', operator: 'eq', value: true });

// ── Sub-component: Condition row ─────────────────────────────────────────────

function ConditionRow({ cond, index, onChange, onRemove }) {
  const isBool      = BOOLEAN_FIELDS.includes(cond.field);
  const isLastSeen  = cond.field === LAST_SEEN_FIELD;
  const noValue     = NO_VALUE_OPS.includes(cond.operator);

  const handleField = (field) => {
    let defaultVal;
    if (BOOLEAN_FIELDS.includes(field)) defaultVal = true;
    else if (field === LAST_SEEN_FIELD) defaultVal = 300;
    else defaultVal = 0;
    onChange(index, { ...cond, field, value: defaultVal });
  };

  const handleValue = (raw) => {
    let val;
    if (isBool) {
      val = raw === 'true';
    } else {
      val = raw === '' ? '' : Number(raw);
    }
    onChange(index, { ...cond, value: val });
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
      <select
        value={cond.field}
        onChange={e => handleField(e.target.value)}
        style={{ ...selectStyle, flex: 2 }}
      >
        {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select
        value={cond.operator}
        onChange={e => onChange(index, { ...cond, operator: e.target.value })}
        style={{ ...selectStyle, flex: 1.5 }}
      >
        {OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {!noValue && (
        isBool ? (
          <select
            value={String(cond.value)}
            onChange={e => handleValue(e.target.value)}
            style={{ ...selectStyle, flex: 1 }}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : isLastSeen ? (
          <select
            value={cond.value}
            onChange={e => handleValue(e.target.value)}
            style={{ ...selectStyle, flex: 1 }}
          >
            {LAST_SEEN_PRESETS.map(p => (
              <option key={p.value} value={p.value}>{p.label} ago</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            value={cond.value}
            onChange={e => handleValue(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
        )
      )}

      <button onClick={() => onRemove(index)} style={{ ...btnDanger, flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ── Sub-component: State form (create / edit) ─────────────────────────────────

function StateForm({ initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial ?? emptyState());

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const addCondition  = () => setForm(f => ({ ...f, conditions: [...f.conditions, emptyCondition()] }));
  const removeCondition = (i) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const changeCondition = (i, updated) =>
    setForm(f => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? updated : c) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.stateName.trim()) { toast.error('State name is required'); return; }
    onSave({ ...form, priority: Number(form.priority) });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>State Name *</label>
          <input style={inputStyle} value={form.stateName} onChange={e => set('stateName', e.target.value)} placeholder="e.g. Running" />
        </div>
        <div>
          <label style={labelStyle}>Icon (emoji)</label>
          <input style={inputStyle} value={form.stateIcon} onChange={e => set('stateIcon', e.target.value)} placeholder="🟢" />
        </div>
        <div>
          <label style={labelStyle}>Color</label>
          <input type="color" value={form.stateColor} onChange={e => set('stateColor', e.target.value)}
            style={{ width: '100%', height: 36, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
        </div>
        <div>
          <label style={labelStyle}>Priority</label>
          <input type="number" style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)} min={1} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Condition Logic</label>
          <select value={form.conditionLogic} onChange={e => set('conditionLogic', e.target.value)} style={{ ...selectStyle, width: 80 }}>
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} />
          <label htmlFor="isDefault" style={{ fontSize: 12, color: '#374151', cursor: 'pointer' }}>
            Fallback / Default state (matches when no other state does)
          </label>
        </div>
      </div>

      {/* Conditions */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Conditions</span>
          <button type="button" onClick={addCondition} style={{ ...btnSecondary, fontSize: 11 }}>+ Add Condition</button>
        </div>
        {form.conditions.length === 0 && (
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
            No conditions — this state will always match (useful for fallback).
          </p>
        )}
        {form.conditions.map((c, i) => (
          <ConditionRow key={i} cond={c} index={i} onChange={changeCondition} onRemove={removeCondition} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={btnPrimary} disabled={loading}>
          {loading ? 'Saving…' : 'Save State'}
        </button>
        <button type="button" onClick={onCancel} style={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MasterSettings() {
  const [devices, setDevices]           = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [states, setStates]             = useState([]);

  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice]   = useState(null);
  const [deviceForm, setDeviceForm]         = useState(emptyDevice());

  const [showStateForm, setShowStateForm]   = useState(false);
  const [editingState, setEditingState]     = useState(null);

  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingStates,  setLoadingStates]  = useState(false);
  const [savingDevice,   setSavingDevice]   = useState(false);
  const [savingState,    setSavingState]    = useState(false);
  const [resettingStates, setResettingStates] = useState(false);

  // ── Load devices on mount ────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const res = await getDeviceConfigs();
      const list = res.data || [];
      setDevices(list);
      if (!selectedDevice && list.length > 0) {
        setSelectedDevice(list[0]);
      }
    } catch {
      toast.error('Failed to load device configs');
    } finally {
      setLoadingDevices(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadDevices(); }, [loadDevices]);

  // ── Load states when selected device changes ────────────────────────────
  useEffect(() => {
    if (!selectedDevice) return;
    setLoadingStates(true);
    getStates(selectedDevice.id)
      .then(res => setStates(res.data || []))
      .catch(() => toast.error('Failed to load states'))
      .finally(() => setLoadingStates(false));
  }, [selectedDevice]);

  // ── Device CRUD ──────────────────────────────────────────────────────────
  const openNewDevice = () => {
    setDeviceForm(emptyDevice());
    setEditingDevice(null);
    setShowDeviceForm(true);
  };

  const openEditDevice = (d) => {
    setDeviceForm({ name: d.name, type: d.type, serverIp: d.serverIp || '', serverPort: d.serverPort || '', mongoCollection: d.mongoCollection });
    setEditingDevice(d);
    setShowDeviceForm(true);
  };

  const handleSaveDevice = async (e) => {
    e.preventDefault();
    if (!deviceForm.name || !deviceForm.type || !deviceForm.mongoCollection) {
      toast.error('Name, type, and collection are required');
      return;
    }
    setSavingDevice(true);
    try {
      if (editingDevice) {
        await updateDeviceConfig(editingDevice.id, deviceForm);
        toast.success('Device updated');
      } else {
        await createDeviceConfig(deviceForm);
        toast.success('Device created');
      }
      setShowDeviceForm(false);
      await loadDevices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save device');
    } finally {
      setSavingDevice(false);
    }
  };

  const handleDeleteDevice = async (d) => {
    if (!window.confirm(`Delete device "${d.name}"? All its state definitions will also be removed.`)) return;
    try {
      await deleteDeviceConfig(d.id);
      toast.success('Device deleted');
      if (selectedDevice?.id === d.id) setSelectedDevice(null);
      await loadDevices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete device');
    }
  };

  // ── State CRUD ───────────────────────────────────────────────────────────
  const openNewState = () => {
    setEditingState(null);
    setShowStateForm(true);
  };

  const openEditState = (s) => {
    setEditingState(s);
    setShowStateForm(true);
  };

  const handleSaveState = async (formData) => {
    if (!selectedDevice) return;
    setSavingState(true);
    try {
      if (editingState) {
        await updateState(editingState.id, formData);
        toast.success('State updated');
      } else {
        await createState(selectedDevice.id, formData);
        toast.success('State created');
      }
      setShowStateForm(false);
      setEditingState(null);
      const res = await getStates(selectedDevice.id);
      setStates(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save state');
    } finally {
      setSavingState(false);
    }
  };

  const handleResetStates = async () => {
    if (!selectedDevice?.isBuiltIn) return;
    if (!window.confirm(`Reset all states for "${selectedDevice.name}" to built-in defaults? This cannot be undone.`)) return;
    setResettingStates(true);
    try {
      const res = await resetStatesToDefaults(selectedDevice.id);
      setStates(res.data || []);
      toast.success('States reset to defaults');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset states');
    } finally {
      setResettingStates(false);
    }
  };

  const handleDeleteState = async (s) => {
    if (!window.confirm(`Delete state "${s.stateName}"?`)) return;
    try {
      await deleteState(s.id);
      toast.success('State deleted');
      const res = await getStates(selectedDevice.id);
      setStates(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete state');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>

      {/* ── Left: Device list ─────────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Device Types</h3>
          <button onClick={openNewDevice} style={{ ...btnPrimary, padding: '5px 12px', fontSize: 12 }}>+ Add</button>
        </div>

        {loadingDevices ? (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading…</p>
        ) : (
          devices.map(d => (
            <div
              key={d.id}
              onClick={() => { setSelectedDevice(d); setShowStateForm(false); setEditingState(null); }}
              style={{
                ...card,
                cursor: 'pointer',
                border: selectedDevice?.id === d.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                padding: '12px 14px',
                marginBottom: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Type: <b>{d.type}</b>
                    {d.isBuiltIn && (
                      <span style={{ marginLeft: 6, fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                        Built-in
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{d.mongoCollection}</div>
                  {d.serverPort && (
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Port: {d.serverPort}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button style={btnSecondary} onClick={() => openEditDevice(d)}>Edit</button>
                  {!d.isBuiltIn && (
                    <button style={btnDanger} onClick={() => handleDeleteDevice(d)}>Del</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Device form */}
        {showDeviceForm && (
          <div style={{ ...card, background: '#f0f9ff', border: '1px solid #bae6fd', padding: '14px 16px', marginBottom: 0 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#0369a1' }}>
              {editingDevice ? 'Edit Device' : 'New Device'}
            </h4>
            <form onSubmit={handleSaveDevice}>
              {[
                { key: 'name',            label: 'Display Name *',      placeholder: 'GT06 GPS Tracker' },
                { key: 'type',            label: 'Type Code *',          placeholder: 'GT06', disabled: !!editingDevice },
                { key: 'serverIp',        label: 'Server IP',            placeholder: '0.0.0.0' },
                { key: 'serverPort',      label: 'Server Port',          placeholder: '9000', type: 'number' },
                { key: 'mongoCollection', label: 'MongoDB Collection *',  placeholder: 'gt06locations' },
              ].map(({ key, label, placeholder, disabled, type }) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    style={{ ...inputStyle, background: disabled ? '#f1f5f9' : '#fff' }}
                    type={type || 'text'}
                    placeholder={placeholder}
                    value={deviceForm[key]}
                    disabled={disabled}
                    onChange={e => setDeviceForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button type="submit" style={{ ...btnPrimary, fontSize: 12, padding: '6px 12px' }} disabled={savingDevice}>
                  {savingDevice ? 'Saving…' : 'Save'}
                </button>
                <button type="button" style={btnSecondary} onClick={() => setShowDeviceForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Right: State definitions ──────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {!selectedDevice ? (
          <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 40, textAlign: 'center' }}>
            Select a device type on the left to manage its state definitions.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  State Definitions — {selectedDevice.name}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                  States are evaluated in priority order (lowest number first). First match wins.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedDevice.isBuiltIn && (
                  <button
                    onClick={handleResetStates}
                    disabled={resettingStates}
                    style={{ ...btnSecondary, fontSize: 12, padding: '6px 14px', color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    {resettingStates ? 'Resetting…' : '↺ Reset to Defaults'}
                  </button>
                )}
                <button onClick={openNewState} style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12 }}>
                  + Add State
                </button>
              </div>
            </div>

            {/* State form */}
            {showStateForm && (
              <div style={{ ...card, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#166534' }}>
                  {editingState ? `Edit State — ${editingState.stateName}` : 'New State'}
                </h4>
                <StateForm
                  key={editingState?.id ?? 'new'}
                  initial={editingState ? {
                    stateName: editingState.stateName,
                    stateColor: editingState.stateColor,
                    stateIcon: editingState.stateIcon || '',
                    priority: editingState.priority,
                    conditionLogic: editingState.conditionLogic,
                    conditions: editingState.conditions,
                    isDefault: editingState.isDefault,
                  } : emptyState()}
                  onSave={handleSaveState}
                  onCancel={() => { setShowStateForm(false); setEditingState(null); }}
                  loading={savingState}
                />
              </div>
            )}

            {/* State list */}
            {loadingStates ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading states…</p>
            ) : states.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>No states defined yet. Click "+ Add State" to create one.</p>
            ) : (
              [...states].sort((a, b) => a.priority - b.priority).map(s => (
                <div key={s.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Priority badge */}
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#64748b', flexShrink: 0,
                      }}>
                        {s.priority}
                      </div>
                      {/* Color dot */}
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: s.stateColor, flexShrink: 0,
                        border: '2px solid #e2e8f0',
                      }} />
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                          {s.stateIcon && <span style={{ marginRight: 5 }}>{s.stateIcon}</span>}
                          {s.stateName}
                        </span>
                        {s.isDefault && (
                          <span style={{ marginLeft: 8, fontSize: 11, background: '#fef9c3', color: '#854d0e', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
                            Default
                          </span>
                        )}
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {s.conditions?.length > 0 ? (
                            <>
                              <span style={{ fontWeight: 600, color: '#475569' }}>{s.conditionLogic}</span>
                              {' '}of {s.conditions.length} condition{s.conditions.length > 1 ? 's' : ''}:&nbsp;
                              {s.conditions.map((c, i) => {
                                const fieldLabel = FIELD_OPTIONS.find(f => f.value === c.field)?.label || c.field;
                                const opLabel    = OPERATOR_OPTIONS.find(o => o.value === c.operator)?.label || c.operator;
                                return (
                                  <span key={i}>
                                    {i > 0 && <span style={{ color: '#94a3b8' }}> · </span>}
                                    <code style={{ fontSize: 11, background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>
                                      {fieldLabel} {opLabel} {NO_VALUE_OPS.includes(c.operator) ? '' : String(c.value)}
                                    </code>
                                  </span>
                                );
                              })}
                            </>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>No conditions (always matches)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button style={btnSecondary} onClick={() => openEditState(s)}>Edit</button>
                      <button style={btnDanger} onClick={() => handleDeleteState(s)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

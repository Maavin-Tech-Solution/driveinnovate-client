import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MagnifyingGlassIcon,
  ChevronRightIcon,
  XMarkIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { addVehicle } from '../services/vehicle.service';
import { getClientTree } from '../services/user.service';
import { getDeviceConfigs } from '../services/master.service';
import { useAuth } from '../context/AuthContext';

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

/** Flatten tree with depth + breadcrumb path, matching MyClients logic */
const flattenTree = (nodes, depth = 0, parentPath = []) => {
  const result = [];
  for (const node of nodes) {
    const path = [...parentPath, node.name];
    result.push({ ...node, depth, path });
    if (node.children?.length) result.push(...flattenTree(node.children, depth + 1, path));
  }
  return result;
};

// ─── Client picker dropdown (mirrors MyClients search UI) ────────────────────
const ClientPicker = ({ clients, value, onChange }) => {
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState(false);
  const wrapRef               = useRef(null);
  const inputRef              = useRef(null);

  const selected = clients.find(c => String(c.id) === String(value));

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q        = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.meta?.companyName?.toLowerCase().includes(q)
      )
    : clients;

  const handleSelect = (client) => {
    onChange(client ? String(client.id) : '');
    setSearch('');
    setOpen(false);
  };

  const avatarBg = (depth) =>
    depth === 0
      ? 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)'
      : depth === 1
        ? 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)'
        : 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)';

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Input row */}
      <div
        style={{
          display: 'flex', alignItems: 'center',
          border: `1px solid ${open ? '#3B82F6' : '#e2e8f0'}`,
          borderRadius: '8px', background: '#fff', overflow: 'hidden',
          boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <MagnifyingGlassIcon style={{ width: '15px', height: '15px', color: '#9CA3AF', flexShrink: 0, marginLeft: '11px' }} />
        {selected && !open ? (
          /* Show selected client name when closed */
          <div style={{ flex: 1, padding: '10px 8px', fontSize: '14px', color: '#1e293b', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected.name}
            {selected.email && <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '6px', fontSize: '12px' }}>{selected.email}</span>}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            placeholder={selected ? selected.name : 'Search by name or email…'}
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            style={{
              flex: 1, border: 'none', outline: 'none', padding: '10px 8px',
              fontSize: '14px', color: '#1e293b', background: 'transparent',
            }}
          />
        )}
        {/* Clear / chevron button */}
        {selected ? (
          <button
            type="button"
            title="Clear selection"
            onClick={e => { e.stopPropagation(); handleSelect(null); }}
            style={{ background: 'none', border: 'none', padding: '8px 10px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
          >
            <XMarkIcon style={{ width: '14px', height: '14px' }} />
          </button>
        ) : (
          <span style={{ padding: '8px 10px', color: '#94a3b8', fontSize: '11px', pointerEvents: 'none' }}>▾</span>
        )}
      </div>

      {/* Dropdown list */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 400,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: '300px', overflowY: 'auto',
        }}>
          {/* "Assign to myself" option */}
          <div
            style={{
              padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9',
              background: !value ? '#EFF6FF' : '#fff',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = !value ? '#EFF6FF' : '#fff'; }}
            onClick={() => handleSelect(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, background: 'linear-gradient(135deg, #64748b, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '13px' }}>
                Me
              </div>
              <span style={{ fontWeight: 600, fontSize: '13.5px', color: '#0F172A' }}>Assign to myself</span>
              {!value && <span style={{ marginLeft: 'auto', fontSize: '10px', background: '#DBEAFE', color: '#1D4ED8', padding: '2px 7px', borderRadius: '10px', fontWeight: 700 }}>Selected</span>}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '14px', color: '#9CA3AF', fontSize: '13px', textAlign: 'center' }}>
              No clients found for "{search}"
            </div>
          ) : (
            filtered.map(c => {
              const isSelected = String(c.id) === String(value);
              return (
                <div
                  key={c.id}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9',
                    background: isSelected ? '#EFF6FF' : '#fff',
                    transition: 'background 0.1s',
                    paddingLeft: 14 + c.depth * 20,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#EFF6FF' : '#fff'; }}
                  onClick={() => handleSelect(c)}
                >
                  {/* Breadcrumb path for nested clients */}
                  {c.path.length > 1 && (
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
                      {c.path.slice(0, -1).map((p, i) => (
                        <React.Fragment key={i}>
                          <span>{p}</span>
                          <ChevronRightIcon style={{ width: '9px', height: '9px', flexShrink: 0 }} />
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    {/* Avatar */}
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, background: avatarBg(c.depth), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '13px' }}>
                      {c.name?.charAt(0)?.toUpperCase() || 'C'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{c.name}</span>
                        {c.depth > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#6366F1', background: '#EEF2FF', padding: '1px 6px', borderRadius: '20px' }}>L{c.depth + 1}</span>
                        )}
                        {isSelected && <span style={{ fontSize: '10px', background: '#DBEAFE', color: '#1D4ED8', padding: '1px 7px', borderRadius: '10px', fontWeight: 700 }}>Selected</span>}
                      </div>
                      {c.email && <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '1px' }}>{c.email}</div>}
                      {c.meta?.companyName && <div style={{ fontSize: '11px', color: '#94A3B8' }}>{c.meta.companyName}</div>}
                    </div>
                    {c.vehicleCount != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#2563EB', fontWeight: 600, flexShrink: 0 }}>
                        <TruckIcon style={{ width: '11px', height: '11px' }} />
                        {c.vehicleCount}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const AddVehicle = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'papa' || user?.role === 'dealer';

  const [form, setForm] = useState({
    vehicleNumber: '',
    vehicleName: '',
    chasisNumber: '',
    engineNumber: '',
    imei: '',
    deviceType: '',
    serverIp: '',
    serverPort: '',
    vehicleIcon: 'car',
  });
  const [forClientId, setForClientId]   = useState('');
  const [clients, setClients]           = useState([]);
  const [deviceConfigs, setDeviceConfigs] = useState([]);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    getClientTree()
      .then(r => setClients(flattenTree(r.data || [])))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    getDeviceConfigs()
      .then(r => setDeviceConfigs(r.data || []))
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'deviceType') {
      const cfg = deviceConfigs.find(c => c.type === value);
      setForm(prev => ({
        ...prev,
        deviceType: value,
        serverIp:   cfg?.serverIp   || '',
        serverPort: cfg?.serverPort ? String(cfg.serverPort) : '',
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.vehicleNumber) payload.vehicleNumber = payload.vehicleNumber.toUpperCase();
      if (forClientId) payload.forClientId = Number(forClientId);
      await addVehicle(payload);
      toast.success('Vehicle registered successfully!');
      navigate('/my-fleet');
    } catch (err) {
      toast.error(err.message || 'Failed to register vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ vehicleNumber: '', vehicleName: '', chasisNumber: '', engineNumber: '', imei: '', deviceType: '', serverIp: '', serverPort: '', vehicleIcon: 'car' });
    setForClientId('');
  };

  const selectedConfig     = deviceConfigs.find(c => c.type === form.deviceType);
  const serverFieldsLocked = !!selectedConfig;

  return (
    <div style={{ minHeight: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>

        {/* ── Form Card ── */}
        <div style={{ background: '#fff', borderRadius: '2px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {/* Section: Vehicle Identification */}
          <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ background: '#dbeafe', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🪪</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Vehicle Identification</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Registration, chassis & engine details</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ padding: '20px 24px' }}>

              {/* ── Assign to Client (papa / dealer only) ── */}
              {isAdmin && clients.length > 0 && (
                <div style={{ ...fieldStyle, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 16px' }}>
                  <label style={{ ...labelStyle, color: '#1d4ed8', marginBottom: '8px' }}>Assign to Client</label>
                  <ClientPicker
                    clients={clients}
                    value={forClientId}
                    onChange={setForClientId}
                  />
                  <span style={{ fontSize: '11px', color: '#3b82f6', marginTop: '6px', display: 'block' }}>
                    Leave blank to add to your own fleet
                  </span>
                </div>
              )}

              <div style={fieldStyle}>
                <label style={labelStyle}>Registration Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  name="vehicleNumber"
                  style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 600, fontSize: '15px', letterSpacing: '0.05em' }}
                  placeholder=""
                  value={form.vehicleNumber}
                  onChange={handleChange}
                  required
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Enter exactly as printed on the RC book</span>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Vehicle Name <span style={{ fontSize: '10px', fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(optional)</span></label>
                <input
                  name="vehicleName"
                  style={inputStyle}
                  placeholder="e.g. Company Truck, Office Cab"
                  value={form.vehicleName}
                  onChange={handleChange}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>A friendly display name shown in fleet view</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Chassis Number</label>
                  <input name="chasisNumber" style={inputStyle} placeholder="" value={form.chasisNumber} onChange={handleChange} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Engine Number</label>
                  <input name="engineNumber" style={inputStyle} placeholder="" value={form.engineNumber} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* Section divider: Device Configuration */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <span style={{ background: '#fef3c7', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>⚙️</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Device Configuration</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Tracking device details and server connection settings</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>IMEI Number of Device</label>
                  <input
                    name="imei"
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '15px', letterSpacing: '0.08em' }}
                    placeholder=""
                    value={form.imei}
                    onChange={handleChange}
                    maxLength={20}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Device Type</label>
                  <select name="deviceType" style={{ ...inputStyle, cursor: 'pointer' }} value={form.deviceType} onChange={handleChange}>
                    <option value="">Select Device Type</option>
                    <option value="GT06">GT06</option>
                    <option value="GT06N">GT06N</option>
                    <option value="FMB125">FMB125</option>
                    <option value="FMB920">FMB920</option>
                    <option value="FMB130">FMB130</option>
                    <option value="AIS140">AIS140 (VLTD)</option>
                    <option value="WeTrack2">WeTrack2</option>
                    <option value="TK103">TK103</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0 18px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Server IP / Domain
                    {serverFieldsLocked && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '1px 6px', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>Auto</span>}
                  </label>
                  <input
                    name="serverIp"
                    style={{ ...inputStyle, fontFamily: 'monospace', background: serverFieldsLocked ? '#f8fafc' : '#fff', color: serverFieldsLocked ? '#475569' : '#1e293b', cursor: serverFieldsLocked ? 'default' : 'text' }}
                    placeholder="e.g. 103.21.58.192"
                    value={form.serverIp}
                    onChange={handleChange}
                    readOnly={serverFieldsLocked}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Port
                    {serverFieldsLocked && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '1px 6px', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>Auto</span>}
                  </label>
                  <input
                    name="serverPort"
                    type="number"
                    style={{ ...inputStyle, fontFamily: 'monospace', background: serverFieldsLocked ? '#f8fafc' : '#fff', color: serverFieldsLocked ? '#475569' : '#1e293b', cursor: serverFieldsLocked ? 'default' : 'text' }}
                    placeholder="e.g. 5023"
                    value={form.serverPort}
                    onChange={handleChange}
                    readOnly={serverFieldsLocked}
                  />
                </div>
              </div>
              {serverFieldsLocked && (
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '-12px', marginBottom: '18px' }}>
                  Auto-filled from device type — configure in Master Settings
                </div>
              )}
            </div>

            {/* Section divider: Vehicle Icon */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <span style={{ background: '#ede9fe', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🎨</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Vehicle Icon</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Choose an icon to represent this vehicle on the map</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { value: 'car',       emoji: '🚗', label: 'Car' },
                  { value: 'suv',       emoji: '🚙', label: 'SUV' },
                  { value: 'truck',     emoji: '🚛', label: 'Truck' },
                  { value: 'bus',       emoji: '🚌', label: 'Bus' },
                  { value: 'bike',      emoji: '🏍️', label: 'Bike' },
                  { value: 'auto',      emoji: '🛺', label: 'Auto' },
                  { value: 'van',       emoji: '🚐', label: 'Van' },
                  { value: 'ambulance', emoji: '🚑', label: 'Ambulance' },
                ].map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, vehicleIcon: value })}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                      border: form.vehicleIcon === value ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: form.vehicleIcon === value ? '#eff6ff' : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{emoji}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: form.vehicleIcon === value ? '#2563eb' : '#94a3b8' }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={loading || !form.vehicleNumber}
                style={{
                  flex: 1, padding: '12px', background: (!form.vehicleNumber || loading) ? '#93c5fd' : '#2563eb',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontWeight: 700, fontSize: '14px', cursor: (!form.vehicleNumber || loading) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? '⏳ Registering...' : '✅ Register Vehicle'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  padding: '12px 20px', background: '#f8fafc', color: '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: '10px',
                  fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                }}
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Field checklist */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
              📋 Field Status
            </div>
            {[
              { key: 'vehicleNumber', label: 'Registration Number', required: true },
              { key: 'vehicleName',   label: 'Vehicle Name',        required: false },
              { key: 'chasisNumber',  label: 'Chassis Number',      required: false },
              { key: 'engineNumber',  label: 'Engine Number',       required: false },
              { key: 'imei',         label: 'IMEI Number',         required: false },
              { key: 'deviceType',   label: 'Device Type',         required: false },
              { key: 'serverIp',     label: 'Server IP',           required: false },
              { key: 'serverPort',   label: 'Port',                required: false },
              { key: 'vehicleIcon',  label: 'Vehicle Icon',        required: false },
            ].map(({ key, label, required }) => {
              const done = !!form[key];
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>{done ? '✅' : '⬜'}</span>
                    <span style={{ fontSize: '13px', color: done ? '#1e293b' : '#94a3b8', fontWeight: done ? 600 : 400 }}>{label}</span>
                  </div>
                  {required && !done && (
                    <span style={{ fontSize: '10px', background: '#fee2e2', color: '#dc2626', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>Required</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tips */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
              💡 Where to Find These
            </div>
            {[
              { icon: '🪪', title: 'Reg. Number', desc: 'Front/rear number plate & RC book cover page' },
              { icon: '🔩', title: 'Chassis No.', desc: 'RC book & stamped on the vehicle chassis frame' },
              { icon: '⚙️', title: 'Engine No.',  desc: 'RC book & engraved on the engine block' },
              { icon: '📡', title: 'IMEI',        desc: 'Printed on the GPS device label or box' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Info banner */}
          <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: '14px', border: '1px solid #bfdbfe', padding: '18px 20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', marginBottom: '6px' }}>ℹ️ After Registration</div>
            <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.7 }}>
              The vehicle will appear in <strong>My Fleet</strong> immediately. You can then assign RTO data, check challans, and configure GPS tracker settings from the fleet page.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddVehicle;

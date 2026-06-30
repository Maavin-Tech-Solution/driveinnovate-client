import React, { useEffect, useRef, useState } from 'react';
import { VehicleIcon, VEHICLE_ICONS, VEHICLE_ICON_LABELS } from '../utils/vehicleIcons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MagnifyingGlassIcon,
  ChevronRightIcon,
  XMarkIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { addVehicle } from '../services/vehicle.service';
import { createCustomField } from '../services/vehicle.service';
import { getClientTree } from '../services/user.service';
import { useAuth } from '../context/AuthContext';
import { getMyWallet, getNetworkWallets, formatVehicles } from '../services/billing.service';
import { getSystemSettings } from '../services/master.service';
import { DEVICE_TYPE_OPTIONS, portForDeviceType, PORT_LABELS } from '../utils/deviceTypes';

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
    branch: '',
    imei: '',
    sim1: '',
    sim2: '',
    deviceType: '',
    serverIp: 'd.maavitrack.com',
    serverPort: '',
    vehicleIcon: 'car',
  });
  const [forClientId, setForClientId]   = useState('');
  const [clients, setClients]           = useState([]);
  const [loading, setLoading]           = useState(false);

  // ── Prepaid token billing ────────────────────────────────────────────────
  // Adding a vehicle spends 1 token of the chosen type; validity depends on type.
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [billingSettings, setBillingSettings] = useState({ testPeriodDays: 30, gracePeriodDays: 15 });
  const [tokenType, setTokenType]           = useState('PAID');
  const [myWallet, setMyWallet]             = useState(null);   // { balancePaid, balanceTesting, balanceGrace }
  const [netWallets, setNetWallets]         = useState([]);     // [{id, balancePaid,...}] best-effort

  // The wallet that pays = the vehicle owner (self, or the assigned client).
  const effectiveClientId = forClientId ? Number(forClientId) : user?.id;
  // Tokens only apply when the module is on AND the owning client is prepaid.
  const targetIsPrepaid = forClientId
    ? (clients.find(c => String(c.id) === String(forClientId))?.billingType === 'prepaid')
    : (user?.billingType === 'prepaid');
  const showBilling = billingEnabled && targetIsPrepaid;
  const targetWallet = effectiveClientId === user?.id ? myWallet : netWallets.find(w => w.id === effectiveClientId);
  const balKey = { PAID: 'balancePaid', TESTING: 'balanceTesting', GRACE: 'balanceGrace' }[tokenType];
  const typeBalance = targetWallet ? Number(targetWallet[balKey] ?? 0) : null;
  const insufficient = showBilling && typeBalance != null && typeBalance < 1;
  const durationLabel = tokenType === 'TESTING'
    ? `${billingSettings.testPeriodDays} days (test)`
    : tokenType === 'GRACE'
      ? `${billingSettings.gracePeriodDays} days (grace)`
      : '1 year (+ grace)';

  // Custom fields — collected locally and saved after vehicle creation
  const [pendingCf, setPendingCf]       = useState([]);   // [{ fieldName, fieldValue }]
  const [cfName,  setCfName]            = useState('');
  const [cfValue, setCfValue]           = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    getClientTree()
      .then(r => setClients(flattenTree(r.data || [])))
      .catch(() => {});
  }, [isAdmin]);

  // Is the prepaid billing module turned on? + my per-type balances + (admin) clients' balances.
  useEffect(() => {
    getSystemSettings().then(r => {
      setBillingEnabled(!!r.data?.billingEnabled);
      setBillingSettings({ testPeriodDays: r.data?.testPeriodDays ?? 30, gracePeriodDays: r.data?.gracePeriodDays ?? 15 });
    }).catch(() => {});
    getMyWallet().then(r => setMyWallet(r.data || null)).catch(() => {});
    if (isAdmin) getNetworkWallets().then(r => setNetWallets(r.data || [])).catch(() => {});
  }, [isAdmin]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Device type fully determines the port — it is auto-filled and not editable.
    if (name === 'deviceType') {
      setForm(prev => ({
        ...prev,
        deviceType: value,
        serverPort: portForDeviceType(value),
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const addCfRow = () => {
    if (!cfName.trim()) return;
    setPendingCf(prev => [...prev, { fieldName: cfName.trim(), fieldValue: cfValue.trim() }]);
    setCfName(''); setCfValue('');
  };

  const removeCfRow = (idx) => setPendingCf(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.vehicleNumber) payload.vehicleNumber = payload.vehicleNumber.toUpperCase();
      if (forClientId) payload.forClientId = Number(forClientId);
      // Token deduction is enforced server-side; send the chosen type when it applies.
      if (showBilling) payload.tokenType = tokenType;
      const res = await addVehicle(payload);
      const newId = res?.data?.id || res?.data?.vehicle?.id;
      // Save custom fields if any were added, using the new vehicle's id
      if (newId && pendingCf.length > 0) {
        await Promise.all(pendingCf.map(cf => createCustomField(newId, cf).catch(() => {})));
      }
      const expiry = res?.data?.subscriptionExpiresAt;
      toast.success(showBilling && expiry
        ? `Vehicle registered — 1 vehicle used, valid till ${new Date(expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`
        : 'Vehicle registered successfully!');
      navigate('/my-fleet');
    } catch (err) {
      if (err.code === 'INSUFFICIENT_FUNDS') {
        toast.error('No vehicle tokens left in the wallet. Ask your dealer to recharge it.');
      } else {
        toast.error(err.message || 'Failed to register vehicle');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ vehicleNumber: '', vehicleName: '', chasisNumber: '', engineNumber: '', branch: '', imei: '', sim1: '', sim2: '', deviceType: '', serverIp: 'd.maavitrack.com', serverPort: '', vehicleIcon: 'car' });
    setForClientId('');
    setPendingCf([]); setCfName(''); setCfValue('');
  };


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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Vehicle Name <span style={{ fontSize: '10px', fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(optional)</span></label>
                  <input name="vehicleName" style={inputStyle} placeholder="e.g. Company Truck, Office Cab" value={form.vehicleName} onChange={handleChange} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Branch <span style={{ fontSize: '10px', fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(optional)</span></label>
                  <input name="branch" style={inputStyle} placeholder="e.g. Delhi, North Zone" value={form.branch} onChange={handleChange} />
                </div>
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
                  <label style={labelStyle}>IMEI Number of Device <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    name="imei"
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '15px', letterSpacing: '0.08em' }}
                    placeholder=""
                    value={form.imei}
                    onChange={handleChange}
                    maxLength={20}
                    required
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Device Type <span style={{ color: '#ef4444' }}>*</span></label>
                  <select name="deviceType" style={{ ...inputStyle, cursor: 'pointer' }} value={form.deviceType} onChange={handleChange} required>
                    <option value="">Select Device Type</option>
                    {DEVICE_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Server IP / Domain
                    <span style={{ marginLeft: '6px', fontSize: '10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '1px 6px', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>Fixed</span>
                  </label>
                  <input
                    name="serverIp"
                    style={{ ...inputStyle, fontFamily: 'monospace', background: '#f8fafc', color: '#475569', cursor: 'not-allowed' }}
                    value={form.serverIp}
                    readOnly
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Port <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ marginLeft: '6px', fontSize: '10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '1px 6px', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>Auto</span>
                  </label>
                  <input
                    name="serverPort"
                    style={{ ...inputStyle, fontFamily: 'monospace', background: '#f8fafc', color: '#475569', cursor: 'not-allowed' }}
                    value={form.serverPort ? (PORT_LABELS[form.serverPort] || form.serverPort) : ''}
                    placeholder={form.deviceType ? 'No port for this device type' : 'Select a device type first'}
                    readOnly
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Set automatically from the device type</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>SIM 1 Number </label>
                  <input
                    name="sim1"
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '14px', letterSpacing: '0.05em' }}
                    placeholder="e.g. 9876543210"
                    value={form.sim1}
                    onChange={handleChange}
                    maxLength={20}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>SIM 2 Number </label>
                  <input
                    name="sim2"
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '14px', letterSpacing: '0.05em' }}
                    placeholder="e.g. 9876543211"
                    value={form.sim2}
                    onChange={handleChange}
                    maxLength={20}
                  />
                </div>
              </div>
            </div>

            {/* Section: Custom Fields */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <span style={{ background: '#f0fdf4', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🏷️</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Custom Fields</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Add any extra details you want to track (owner, depot, route, etc.)</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '0 24px 20px' }}>
              {/* Existing rows */}
              {pendingCf.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {pendingCf.map((cf, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <span style={{ fontWeight: 700, color: '#475569', fontSize: 13 }}>{cf.fieldName}:</span>
                      <span style={{ color: '#0f172a', fontSize: 13, flex: 1 }}>{cf.fieldValue || '—'}</span>
                      <button type="button" onClick={() => removeCfRow(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Add row */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" placeholder="Field name (e.g. Route)"
                  value={cfName} onChange={e => setCfName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCfRow())}
                  style={{ ...inputStyle, flex: '0 0 40%' }}
                />
                <input
                  type="text" placeholder="Value (e.g. Delhi–Jaipur)"
                  value={cfValue} onChange={e => setCfValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCfRow())}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" onClick={addCfRow} disabled={!cfName.trim()}
                  style={{ flexShrink: 0, padding: '10px 16px', background: cfName.trim() ? '#2563eb' : '#e2e8f0', color: cfName.trim() ? '#fff' : '#94a3b8', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: cfName.trim() ? 'pointer' : 'not-allowed' }}>
                  + Add
                </button>
              </div>
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
                {VEHICLE_ICONS.map(value => (
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
                    <VehicleIcon type={value} color={form.vehicleIcon === value ? "#2563EB" : "#94A3B8"} size={28} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: form.vehicleIcon === value ? "#2563eb" : "#94a3b8" }}>{VEHICLE_ICON_LABELS[value] || value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={loading || !form.vehicleNumber || !form.imei || !form.deviceType || !form.serverPort || insufficient}
                style={{
                  flex: 1, padding: '12px', background: (!form.vehicleNumber || !form.imei || !form.deviceType || !form.serverPort || loading || insufficient) ? '#93c5fd' : '#2563eb',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontWeight: 700, fontSize: '14px', cursor: (!form.vehicleNumber || loading || insufficient) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? '⏳ Registering...' : insufficient ? '🚗 No vehicles left' : showBilling ? '✅ Register & use 1 vehicle' : '✅ Register Vehicle'}
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

          {/* Prepaid billing — token cost (prepaid clients only) */}
          {showBilling && (
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #bfdbfe', padding: '20px 22px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                🚗 Subscription
              </div>

              <label style={labelStyle}>Token type</label>
              <select value={tokenType} onChange={e => setTokenType(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
                <option value="PAID">Paid — 1 year</option>
                <option value="TESTING">Testing — {billingSettings.testPeriodDays} days</option>
                <option value="GRACE">Grace — {billingSettings.gracePeriodDays} days</option>
              </select>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 800, color: '#0f172a' }}>
                  <span>Cost</span><span>1 {tokenType.toLowerCase()} token</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Billed-till will be set to {durationLabel} from today.</div>
              </div>

              <div style={{ marginTop: 12, fontSize: 12.5, display: 'flex', justifyContent: 'space-between', color: typeBalance != null && insufficient ? '#dc2626' : '#15803d' }}>
                <span style={{ color: '#64748b' }}>{effectiveClientId === user?.id ? 'Your' : "Client's"} {tokenType.toLowerCase()} tokens</span>
                <strong>{typeBalance != null ? formatVehicles(typeBalance) : '—'}</strong>
              </div>
              {insufficient && (
                <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#b91c1c' }}>
                  No {tokenType.toLowerCase()} tokens left. {effectiveClientId === user?.id ? 'Ask your dealer to recharge your wallet.' : "Recharge the client's wallet from the Wallet page first."}
                </div>
              )}
            </div>
          )}

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
              { key: 'imei',         label: 'IMEI Number',         required: true  },
              { key: 'sim1',         label: 'SIM 1 Number',        required: false },
              { key: 'sim2',         label: 'SIM 2 Number',        required: false },
              { key: 'deviceType',   label: 'Device Type',         required: true  },
              { key: 'serverIp',     label: 'Server IP',           required: false },
              { key: 'serverPort',   label: 'Port',                required: true  },
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

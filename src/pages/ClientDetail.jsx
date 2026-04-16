import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { upgradeClient, extendClientTrial } from '../services/user.service';
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  TruckIcon,
  UsersIcon,
  PencilSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

/* ─── Permission modal (reused logic) ─────────────────────────────────── */
const PERMISSION_LABELS = [
  { key: 'canAddVehicle',        label: 'Add Vehicle' },
  { key: 'canTrackVehicle',      label: 'Track Vehicle' },
  { key: 'canViewFleet',         label: 'View Fleet List' },
  { key: 'canAddClient',         label: 'Add Client' },
  { key: 'canManageGroups',      label: 'Manage Groups' },
  { key: 'canManageGeofences',   label: 'Manage Geofences' },
  { key: 'canViewTrips',         label: 'View Trips' },
  { key: 'canShareTrip',         label: 'Share Trip' },
  { key: 'canShareLiveLocation', label: 'Share Live Location' },
  { key: 'canViewReports',       label: 'View Reports' },
  { key: 'canDownloadReports',   label: 'Download Reports' },
  { key: 'canSetAlerts',         label: 'Set Alerts' },
  { key: 'canViewRTO',           label: 'View RTO Details' },
  { key: 'canViewChallans',      label: 'View Challans' },
  { key: 'canViewNotifications', label: 'View Notifications' },
];

const PermissionModal = ({ client, onClose, onSaved }) => {
  const [perms, setPerms] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/permissions/${client.id}`)
      .then(r => setPerms(r.data.permissions))
      .catch(() => toast.error('Failed to load permissions'));
  }, [client.id]);

  const toggle = (key) => setPerms(p => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/permissions/${client.id}`, perms);
      toast.success('Permissions saved');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#1e2a3a', borderRadius: '14px', padding: '28px 32px', width: '480px', maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '17px' }}>Edit Permissions</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '2px' }}>{client.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>×</button>
        </div>
        {!perms ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '20px' }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
              {PERMISSION_LABELS.map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', background: perms[key] ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${perms[key] ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, border: `2px solid ${perms[key] ? '#3B82F6' : 'rgba(255,255,255,0.3)'}`, background: perms[key] ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {perms[key] && <CheckIcon style={{ width: '11px', height: '11px', color: '#fff' }} />}
                  </div>
                  <input type="checkbox" checked={!!perms[key]} onChange={() => toggle(key)} style={{ display: 'none' }} />
                  <span style={{ color: perms[key] ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: '12.5px', fontWeight: perms[key] ? 600 : 400 }}>{label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13.5px' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save Permissions'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── Status badge ─────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => (
  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: status === 'active' ? '#dcfce7' : '#fee2e2', color: status === 'active' ? '#16a34a' : '#dc2626' }}>
    {status === 'active' ? 'Active' : 'Inactive'}
  </span>
);

/* ─── Account type badge ───────────────────────────────────────────────── */
const ACCOUNT_TYPE_STYLES = {
  trial:    { bg: '#fef9c3', color: '#854d0e', label: 'Trial' },
  billable: { bg: '#dcfce7', color: '#166534', label: 'Billable' },
  demo:     { bg: '#ede9fe', color: '#5b21b6', label: 'Demo' },
  master:   { bg: '#dbeafe', color: '#1e40af', label: 'Master' },
};
const AccountTypeBadge = ({ type }) => {
  const s = ACCOUNT_TYPE_STYLES[type] || ACCOUNT_TYPE_STYLES.trial;
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};

/* ─── Upgrade / Extend-trial modal ─────────────────────────────────────── */
const PLAN_OPTIONS = [
  { value: '3months', label: '3 Months',  desc: '90 days subscription per vehicle' },
  { value: '6months', label: '6 Months',  desc: '180 days subscription per vehicle' },
  { value: '1year',   label: '1 Year',    desc: '365 days subscription per vehicle' },
];

const UpgradeModal = ({ client, onClose, onDone }) => {
  const [mode, setMode] = useState('upgrade'); // 'upgrade' | 'extend'
  const [plan, setPlan] = useState('3months');
  const [extendDate, setExtendDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Default extend date to 30 days from now
  useEffect(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setExtendDate(d.toISOString().slice(0, 10));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'upgrade') {
        await upgradeClient(client.id, plan);
        toast.success('Account upgraded to Billable');
      } else {
        await extendClientTrial(client.id, new Date(extendDate).toISOString());
        toast.success('Trial period extended');
      }
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#111827' }}>Manage Account</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{client.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {client.accountType !== 'billable' && (
            <button
              onClick={() => setMode('upgrade')}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `2px solid ${mode === 'upgrade' ? '#2563eb' : '#e5e7eb'}`, background: mode === 'upgrade' ? '#eff6ff' : '#fafafa', color: mode === 'upgrade' ? '#1d4ed8' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Upgrade to Billable
            </button>
          )}
          {client.accountType === 'trial' && (
            <button
              onClick={() => setMode('extend')}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `2px solid ${mode === 'extend' ? '#d97706' : '#e5e7eb'}`, background: mode === 'extend' ? '#fffbeb' : '#fafafa', color: mode === 'extend' ? '#92400e' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Extend Trial
            </button>
          )}
        </div>

        {mode === 'upgrade' ? (
          <>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              Select a plan. Subscription expiry will be set on all active vehicles under this account from today.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {PLAN_OPTIONS.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, border: `2px solid ${plan === opt.value ? '#2563eb' : '#e5e7eb'}`, background: plan === opt.value ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
                  <input type="radio" name="plan" value={opt.value} checked={plan === opt.value} onChange={() => setPlan(opt.value)} style={{ accentColor: '#2563eb' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: plan === opt.value ? '#1d4ed8' : '#111827' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              Set a new trial expiry date. The account can login until this date.
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>New Expiry Date *</label>
              <input
                type="date"
                value={extendDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setExtendDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#111827', boxSizing: 'border-box' }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: mode === 'upgrade' ? '#2563eb' : '#d97706', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : mode === 'upgrade' ? 'Upgrade to Billable' : 'Extend Trial'}
          </button>
        </div>
      </div>
    </div>
  );
};

const VehicleIcon = ({ type }) => {
  const icons = { truck: '🚛', car: '🚗', bike: '🏍️', bus: '🚌', auto: '🛺' };
  return <span style={{ fontSize: '16px' }}>{icons[type] || '🚗'}</span>;
};

/* ─── Main component ───────────────────────────────────────────────────── */
const ClientDetail = () => {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'papa' || Number(user?.parentId) === 0 || user?.role === 'dealer';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingPerms, setEditingPerms] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/clients/${clientId}`);
      setData(res.data);
    } catch (err) {
      toast.error(err?.message || 'Failed to load client details');
      navigate('/my-clients');
    } finally {
      setLoading(false);
    }
  }, [clientId, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
      <div className="spinner" />
    </div>
  );

  if (!data) return null;
  const { client, subClients, vehicles, stats } = data;
  const meta = client.meta || {};

  return (
    <div style={{ maxWidth: '960px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Back */}
      <button onClick={() => navigate('/my-clients')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600, marginBottom: '20px', padding: 0 }}>
        <ArrowLeftIcon style={{ width: '16px', height: '16px' }} /> Back to Clients
      </button>

      {/* Profile header */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '26px', flexShrink: 0 }}>
          {client.name?.charAt(0)?.toUpperCase() || 'C'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>{client.name}</div>
            <StatusBadge status={client.status} />
            <AccountTypeBadge type={client.accountType || 'trial'} />
            {client.accountType === 'trial' && client.trialExpiresAt && (
              <span style={{ fontSize: '11px', color: new Date(client.trialExpiresAt) < new Date() ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                {new Date(client.trialExpiresAt) < new Date()
                  ? 'Expired'
                  : `Trial expires ${new Date(client.trialExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </span>
            )}
          </div>
          {meta.companyName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13.5px', color: '#6b7280', marginTop: '4px' }}>
              <BuildingOfficeIcon style={{ width: '14px', height: '14px' }} />{meta.companyName}
              {meta.businessCategory && <span style={{ color: '#d1d5db' }}>·</span>}
              {meta.businessCategory && <span>{meta.businessCategory}</span>}
            </div>
          )}
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#374151' }}>
              <EnvelopeIcon style={{ width: '13px', height: '13px', color: '#9ca3af' }} />{client.email}
            </div>
            {client.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#374151' }}>
                <PhoneIcon style={{ width: '13px', height: '13px', color: '#9ca3af' }} />{client.phone}
              </div>
            )}
            {(meta.city || meta.state) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#374151' }}>
                <MapPinIcon style={{ width: '13px', height: '13px', color: '#9ca3af' }} />
                {[meta.address, meta.city, meta.state, meta.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {canManage && (client.accountType === 'trial' || client.accountType === 'demo' || !client.accountType) && (
            <button onClick={() => setShowUpgrade(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Manage Account
            </button>
          )}
          <button onClick={() => setEditingPerms(client)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
            <PencilSquareIcon style={{ width: '15px', height: '15px' }} />Permissions
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Sub-Clients', value: stats.subClientCount, icon: '👥', color: '#3B82F6', bg: '#EFF6FF' },
          { label: 'Direct Vehicles', value: stats.vehicleCount, icon: '🚗', color: '#059669', bg: '#D1FAE5' },
          { label: 'Network Vehicles', value: stats.networkVehicleCount, icon: '🌐', color: '#7C3AED', bg: '#F5F3FF' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-clients */}
      {subClients.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', marginBottom: '24px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UsersIcon style={{ width: '17px', height: '17px', color: '#3B82F6' }} />
            <span style={{ fontWeight: 700, fontSize: '14.5px', color: '#111827' }}>Sub-Clients</span>
            <span style={{ fontSize: '12px', color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: '20px', marginLeft: '4px' }}>{subClients.length}</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
            {subClients.map(sc => (
              <Link key={sc.id} to={`/my-clients/${sc.id}`} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                borderRadius: '10px', border: '1px solid #f3f4f6', background: '#fafafa',
                textDecoration: 'none', transition: 'background 0.12s, border-color 0.12s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#f3f4f6'; }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '14px', flexShrink: 0 }}>
                  {sc.name?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{sc.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{sc.email}</div>
                  {sc.meta?.companyName && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{sc.meta.companyName}</div>}
                </div>
                <StatusBadge status={sc.status} />
                <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 600, background: '#EFF6FF', padding: '3px 10px', borderRadius: '20px', flexShrink: 0 }}>
                  {sc.vehicleCount} vehicle{sc.vehicleCount !== 1 ? 's' : ''}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Vehicles */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TruckIcon style={{ width: '17px', height: '17px', color: '#059669' }} />
          <span style={{ fontWeight: 700, fontSize: '14.5px', color: '#111827' }}>Registered Vehicles</span>
          <span style={{ fontSize: '12px', color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: '20px', marginLeft: '4px' }}>{vehicles.length}</span>
        </div>

        {vehicles.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '13.5px' }}>
            No vehicles registered for this client yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Vehicle', 'IMEI', 'Device', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v, i) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <VehicleIcon type={v.vehicleIcon} />
                        <div>
                          <div style={{ fontWeight: 700, color: '#111827' }}>{v.vehicleNumber || `#${v.id}`}</div>
                          {v.vehicleName && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{v.vehicleName}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#6b7280', fontFamily: 'monospace', fontSize: '12px' }}>{v.imei || '—'}</td>
                    <td style={{ padding: '11px 16px', color: '#6b7280' }}>{v.deviceType || '—'}</td>
                    <td style={{ padding: '11px 16px' }}><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingPerms && (
        <PermissionModal client={editingPerms} onClose={() => setEditingPerms(null)} onSaved={load} />
      )}

      {showUpgrade && (
        <UpgradeModal client={client} onClose={() => setShowUpgrade(false)} onDone={load} />
      )}
    </div>
  );
};

export default ClientDetail;

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';
import { UserGroupIcon, PencilSquareIcon, CheckIcon, XMarkIcon, BuildingOfficeIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const PERMISSION_LABELS = [
  { key: 'canAddVehicle',        label: 'Add Vehicle' },
  { key: 'canTrackVehicle',      label: 'Track Vehicle (Map)' },
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#1e2a3a', borderRadius: '14px', padding: '28px 32px',
        width: '480px', maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '17px' }}>Edit Permissions</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '2px' }}>{client.name} — {client.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}>
            <XMarkIcon style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {!perms ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
              {PERMISSION_LABELS.map(({ key, label }) => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                  padding: '10px 12px', borderRadius: '8px',
                  background: perms[key] ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${perms[key] ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'background 0.15s, border-color 0.15s',
                }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                    border: `2px solid ${perms[key] ? '#3B82F6' : 'rgba(255,255,255,0.3)'}`,
                    background: perms[key] ? '#3B82F6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}>
                    {perms[key] && <CheckIcon style={{ width: '11px', height: '11px', color: '#fff' }} />}
                  </div>
                  <input type="checkbox" checked={!!perms[key]} onChange={() => toggle(key)} style={{ display: 'none' }} />
                  <span style={{ color: perms[key] ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: '12.5px', fontWeight: perms[key] ? 600 : 400 }}>{label}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{
                padding: '9px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13.5px',
              }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{
                padding: '9px 20px', borderRadius: '8px', border: 'none',
                background: '#3B82F6', color: '#fff', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600,
                opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Saving…' : 'Save Permissions'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const MyClients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/clients');
      setClients(res.data || []);
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.meta?.companyName?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      )
    : clients;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '380px' }}>
          <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', fontSize: '15px' }}>⌕</span>
          <input
            type="text"
            placeholder="Search by name, email, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: '32px', paddingRight: '12px',
              height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px',
              fontSize: '13.5px', outline: 'none', background: '#fff', color: '#111827',
              boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {filtered.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
        </div>
      </div>

      {clients.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
        }}>
          <UserGroupIcon style={{ width: '48px', height: '48px', color: '#d1d5db', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>No clients yet</div>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>Add your first client to manage their access and permissions.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>No results for "{search}"</div>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>Try a different name, email, or company.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filtered.map(client => (
            <div key={client.id}
              onClick={() => navigate(`/my-clients/${client.id}`)}
              style={{
                background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
                padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: '18px',
              }}>
                {client.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>{client.name}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{client.email}</div>
                {client.meta?.companyName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>
                    <BuildingOfficeIcon style={{ width: '13px', height: '13px' }} />
                    {client.meta.companyName}
                  </div>
                )}
              </div>

              <div style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                background: client.status === 'active' ? '#dcfce7' : '#fee2e2',
                color: client.status === 'active' ? '#16a34a' : '#dc2626',
              }}>
                {client.status === 'active' ? 'Active' : 'Inactive'}
              </div>

              <button
                onClick={e => { e.stopPropagation(); setEditing(client); }}
                title="Edit permissions"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px',
                  border: '1px solid #e5e7eb', background: '#f9fafb',
                  color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; }}
              >
                <PencilSquareIcon style={{ width: '15px', height: '15px' }} />
                Permissions
              </button>

              <ChevronRightIcon style={{ width: '18px', height: '18px', color: '#9ca3af', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PermissionModal
          client={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default MyClients;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import { getClientTree } from '../services/user.service';
import {
  UserGroupIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

// ─── Permission keys / labels ────────────────────────────────────────────────
const PERMISSION_LABELS = [
  { key: 'canAddVehicle',        label: 'Add Vehicle' },
  { key: 'canTrackVehicle',      label: 'Track Vehicle' },
  { key: 'canViewFleet',         label: 'View Fleet' },
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
  { key: 'canViewNotifications', label: 'Notifications' },
];

// ─── Permission Modal ─────────────────────────────────────────────────────────
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
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#1e2a3a', borderRadius: '14px', padding: '28px 32px', width: '500px', maxWidth: '95vw', maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '17px' }}>Edit Permissions</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '2px' }}>
              {client.name} — {client.email}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}>
            <XMarkIcon style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {!perms ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '20px' }}>Loading…</div>
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
                  <span style={{ color: perms[key] ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: '12.5px', fontWeight: perms[key] ? 600 : 400 }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13.5px' }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten the tree into a list with path metadata for search */
const flattenTree = (nodes, parentPath = []) => {
  const result = [];
  for (const node of nodes) {
    const path = [...parentPath, node.name];
    result.push({ ...node, path });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, path));
    }
  }
  return result;
};

/** Count all nodes in the tree */
const countNodes = (nodes) =>
  nodes.reduce((s, n) => s + 1 + countNodes(n.children || []), 0);

// ─── Single tree node row ─────────────────────────────────────────────────────
const ClientNode = ({ node, depth, onPermissions, onNavigate }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children?.length > 0;
  const indent = depth * 28;

  return (
    <>
      {/* Row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '11px 16px 11px ' + (16 + indent) + 'px',
          borderBottom: '1px solid #F1F5F9',
          background: depth === 0 ? '#FFFFFF' : depth === 1 ? '#FAFBFD' : '#F5F7FA',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; }}
        onMouseLeave={e => { e.currentTarget.style.background = depth === 0 ? '#FFFFFF' : depth === 1 ? '#FAFBFD' : '#F5F7FA'; }}
        onClick={() => onNavigate(node.id)}
      >
        {/* Expand / collapse toggle */}
        <div
          style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: hasChildren ? 'pointer' : 'default' }}
          onClick={e => { e.stopPropagation(); if (hasChildren) setExpanded(v => !v); }}
        >
          {hasChildren
            ? expanded
              ? <ChevronDownIcon style={{ width: '14px', height: '14px', color: '#64748B' }} />
              : <ChevronRightIcon style={{ width: '14px', height: '14px', color: '#64748B' }} />
            : <span style={{ width: '14px', display: 'inline-block' }} />
          }
        </div>

        {/* Avatar */}
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
          background: depth === 0
            ? 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)'
            : depth === 1
              ? 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)'
              : 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '16px',
        }}>
          {node.name?.charAt(0)?.toUpperCase() || 'C'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '260px' }}>
              {node.name}
            </span>
            {/* Depth badge shows who they're under */}
            {depth > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#6366F1', background: '#EEF2FF', padding: '1px 7px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                L{depth + 1}
              </span>
            )}
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '1px 8px', borderRadius: '20px',
              background: node.status === 'active' ? '#DCFCE7' : '#FEE2E2',
              color: node.status === 'active' ? '#15803D' : '#DC2626',
            }}>
              {node.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>{node.email}</span>
            {node.phone && <span>· {node.phone}</span>}
            {node.meta?.companyName && <span>· {node.meta.companyName}</span>}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Vehicles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '4px 10px' }} title="Vehicles directly under this client">
            <TruckIcon style={{ width: '13px', height: '13px', color: '#2563EB' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB' }}>{node.vehicleCount}</span>
          </div>
          {/* Sub-clients */}
          {node.children?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '6px', padding: '4px 10px' }} title="Direct sub-clients">
              <UsersIcon style={{ width: '13px', height: '13px', color: '#7C3AED' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#7C3AED' }}>{node.children.length}</span>
            </div>
          )}
          {/* Network total vehicles (if has children) */}
          {node.networkVehicleCount > node.vehicleCount && (
            <div style={{ fontSize: '11px', color: '#6B7280', whiteSpace: 'nowrap' }} title="Total vehicles across full sub-network">
              {node.networkVehicleCount} total
            </div>
          )}
        </div>

        {/* Permissions button */}
        <button
          onClick={e => { e.stopPropagation(); onPermissions(node); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '7px',
            border: '1px solid #E2E8F0', background: '#F8FAFC',
            color: '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
            flexShrink: 0, transition: 'background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; }}
        >
          Permissions
        </button>
      </div>

      {/* Children (indented) */}
      {expanded && hasChildren && node.children.map(child => (
        <ClientNode
          key={child.id}
          node={child}
          depth={depth + 1}
          onPermissions={onPermissions}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
};

// ─── Search dropdown item ─────────────────────────────────────────────────────
const SearchItem = ({ node, onSelect }) => (
  <div
    style={{
      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9',
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; }}
    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
    onClick={() => onSelect(node)}
  >
    {/* Breadcrumb path */}
    {node.path.length > 1 && (
      <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
        {node.path.slice(0, -1).map((p, i) => (
          <React.Fragment key={i}>
            <span>{p}</span>
            <ChevronRightIcon style={{ width: '10px', height: '10px', flexShrink: 0 }} />
          </React.Fragment>
        ))}
      </div>
    )}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>{node.name}</span>
      <span style={{ fontSize: '11px', color: '#6B7280' }}>{node.email}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#2563EB', fontWeight: 600 }}>
        <TruckIcon style={{ width: '11px', height: '11px' }} />
        {node.vehicleCount} vehicle{node.vehicleCount !== 1 ? 's' : ''}
      </span>
    </div>
    {node.meta?.companyName && (
      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>{node.meta.companyName}</div>
    )}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────
const MyClients = () => {
  const navigate = useNavigate();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getClientTree();
      setTree(res.data || []);
    } catch {
      toast.error('Failed to load client network');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Flatten for search
  const flat = flattenTree(tree);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? flat.filter(n =>
        n.name?.toLowerCase().includes(q) ||
        n.email?.toLowerCase().includes(q) ||
        n.phone?.includes(q) ||
        n.meta?.companyName?.toLowerCase().includes(q)
      )
    : [];

  const totalClients = countNodes(tree);

  // Summary stats
  const totalVehicles = tree.reduce((s, n) => s + (n.networkVehicleCount || 0), 0);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#6B7280' }}>
      Loading client network…
    </div>
  );

  return (
    <div>
      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>

        {/* Search with tree dropdown */}
        <div ref={searchRef} style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '420px' }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9CA3AF', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by name, email, company…"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
            onFocus={() => { if (search) setShowDrop(true); }}
            style={{
              width: '100%', paddingLeft: '34px', paddingRight: '12px',
              height: '38px', border: '1px solid #E5E7EB', borderRadius: '8px',
              fontSize: '13.5px', outline: 'none', background: '#fff', color: '#111827',
              boxSizing: 'border-box',
            }}
            onFocusCapture={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
          />
          {/* Dropdown */}
          {showDrop && q && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200,
              maxHeight: '320px', overflowY: 'auto',
            }}>
              {filtered.length === 0
                ? <div style={{ padding: '14px', color: '#9CA3AF', fontSize: '13px', textAlign: 'center' }}>No results for "{q}"</div>
                : filtered.map(n => (
                    <SearchItem
                      key={n.id}
                      node={n}
                      onSelect={node => { setSearch(''); setShowDrop(false); navigate(`/my-clients/${node.id}`); }}
                    />
                  ))
              }
            </div>
          )}
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '7px', padding: '6px 12px' }}>
            <UsersIcon style={{ width: '14px', height: '14px', color: '#2563EB' }} />
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1D4ED8' }}>{totalClients} Client{totalClients !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '7px', padding: '6px 12px' }}>
            <TruckIcon style={{ width: '14px', height: '14px', color: '#16A34A' }} />
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#15803D' }}>{totalVehicles} Vehicle{totalVehicles !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* ── Network tree ── */}
      {tree.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
          <UserGroupIcon style={{ width: '48px', height: '48px', color: '#D1D5DB', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>No clients yet</div>
          <div style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
            Add your first client to start building your network.
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Tree header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1, paddingLeft: '52px' }}>Client</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', width: '120px', textAlign: 'center' }}>Vehicles</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', width: '100px', textAlign: 'center' }}>Actions</span>
          </div>

          {/* Tree rows */}
          {tree.map(node => (
            <ClientNode
              key={node.id}
              node={node}
              depth={0}
              onPermissions={setEditing}
              onNavigate={id => navigate(`/my-clients/${id}`)}
            />
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

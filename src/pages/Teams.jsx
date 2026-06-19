import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  getTeams, getTeam, createTeam, deleteTeam,
  setTeamVehicles, getAssignableVehicles,
  addTeamMember, removeTeamMember, deleteTeamMember, setMemberPermissions,
} from '../services/team.service';

// Permissions an owner can grant a team member (subset of the full set that makes
// sense for a restricted login). These map 1:1 to the sidebar menu gating.
const MEMBER_PERMISSIONS = [
  { key: 'canViewFleet',       label: 'View Fleet List' },
  { key: 'canTrackVehicle',    label: 'Live Tracking' },
  { key: 'canViewTrips',       label: 'View Trips' },
  { key: 'canViewReports',     label: 'View Reports' },
  { key: 'canDownloadReports', label: 'Download Reports' },
  { key: 'canViewNotifications', label: 'Notifications' },
  { key: 'canSetAlerts',       label: 'Alerts' },
  { key: 'canManageGeofences', label: 'Geofences' },
];

const card = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 };
const btn = (bg, fg = '#fff') => ({ background: bg, color: fg, border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' });
const input = { width: '100%', padding: '9px 11px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [activeId, setActiveId] = useState(null);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const res = await getTeams();
      // api's response interceptor already returns the body { success, data }.
      setTeams(res.data || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeams(); }, []);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return toast.warn('Team name is required');
    try {
      await createTeam(createForm);
      toast.success('Team created');
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
      loadTeams();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create team');
    }
  };

  const handleDelete = async (team) => {
    if (!window.confirm(`Delete team "${team.name}"? Members lose access to its vehicles.`)) return;
    try {
      await deleteTeam(team.id);
      toast.success('Team deleted');
      loadTeams();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete team');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0F172A' }}>Teams</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
            Group vehicles and give members a login that only sees those vehicles.
          </p>
        </div>
        <button style={btn('#1D4ED8')} onClick={() => setShowCreate(true)}>+ Create Team</button>
      </div>

      {loading ? (
        <div style={{ color: '#64748B', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : teams.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#64748B', padding: 48 }}>
          No teams yet. Create one to start assigning vehicles and members.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {teams.map(t => (
            <div key={t.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>{t.name}</h3>
                <button style={{ ...btn('transparent', '#EF4444'), padding: 4 }} title="Delete" onClick={() => handleDelete(t)}>✕</button>
              </div>
              {t.description && <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>{t.description}</p>}
              <div style={{ display: 'flex', gap: 14, margin: '12px 0', color: '#475569', fontSize: 13 }}>
                <span>🚚 {t.vehicleCount} vehicles</span>
                <span>👤 {t.memberCount} members</span>
              </div>
              <button style={{ ...btn('#F1F5F9', '#1D4ED8'), width: '100%' }} onClick={() => setActiveId(t.id)}>Manage</button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div style={overlay} onClick={() => setShowCreate(false)}>
          <div style={{ ...card, width: 420, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Create Team</h2>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Name</label>
            <input style={{ ...input, margin: '4px 0 12px' }} value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Zone Drivers" autoFocus />
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Description (optional)</label>
            <input style={{ ...input, margin: '4px 0 16px' }} value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btn('#F1F5F9', '#334155')} onClick={() => setShowCreate(false)}>Cancel</button>
              <button style={btn('#1D4ED8')} onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}

      {activeId && (
        <TeamDetail teamId={activeId} onClose={() => { setActiveId(null); loadTeams(); }} />
      )}
    </div>
  );
}

// ── Team detail: vehicle assignment + member management ──────────────────────
function TeamDetail({ teamId, onClose }) {
  const [team, setTeam] = useState(null);
  const [assignable, setAssignable] = useState([]);
  const [selectedVeh, setSelectedVeh] = useState(new Set());
  const [savingVeh, setSavingVeh] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', phone: '', password: '' });

  const load = async () => {
    try {
      const [t, av] = await Promise.all([getTeam(teamId), getAssignableVehicles()]);
      setTeam(t.data || null);
      setAssignable(av.data || []);
      setSelectedVeh(new Set((t.data?.vehicles || []).map(v => v.id)));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load team');
      onClose();
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [teamId]);

  const toggleVeh = (id) => setSelectedVeh(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const saveVehicles = async () => {
    setSavingVeh(true);
    try {
      await setTeamVehicles(teamId, [...selectedVeh]);
      toast.success('Vehicles updated');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save vehicles');
    } finally {
      setSavingVeh(false);
    }
  };

  const handleAddMember = async () => {
    const { name, email, password } = memberForm;
    if (!name.trim() || !email.trim() || !password) return toast.warn('Name, email and password are required');
    try {
      await addTeamMember(teamId, memberForm);
      toast.success('Member added');
      setShowAdd(false);
      setMemberForm({ name: '', email: '', phone: '', password: '' });
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add member');
    }
  };

  const togglePerm = async (member, key, value) => {
    try {
      const current = member.permissions || {};
      const next = { ...Object.fromEntries(MEMBER_PERMISSIONS.map(p => [p.key, !!current[p.key]])), [key]: value };
      await setMemberPermissions(teamId, member.id, next);
      setTeam(t => ({
        ...t,
        members: t.members.map(m => m.id === member.id
          ? { ...m, permissions: { ...(m.permissions || {}), [key]: value } } : m),
      }));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update permission');
    }
  };

  const removeMember = async (m, revoke) => {
    const msg = revoke
      ? `Revoke ${m.name}'s login entirely? They will no longer be able to sign in.`
      : `Remove ${m.name} from this team?`;
    if (!window.confirm(msg)) return;
    try {
      revoke ? await deleteTeamMember(teamId, m.id) : await removeTeamMember(teamId, m.id);
      toast.success(revoke ? 'Member revoked' : 'Member removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to remove member');
    }
  };

  const vehDirty = useMemo(() => {
    const orig = new Set((team?.vehicles || []).map(v => v.id));
    if (orig.size !== selectedVeh.size) return true;
    for (const id of selectedVeh) if (!orig.has(id)) return true;
    return false;
  }, [team, selectedVeh]);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...card, width: 920, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{team?.name || 'Team'}</h2>
          <button style={btn('#F1F5F9', '#334155')} onClick={onClose}>Close</button>
        </div>

        {!team ? <div style={{ padding: 30, color: '#64748B' }}>Loading…</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {/* Vehicles */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Vehicles ({selectedVeh.size})</h3>
                <button style={{ ...btn('#1D4ED8'), opacity: vehDirty ? 1 : 0.5 }} disabled={!vehDirty || savingVeh} onClick={saveVehicles}>
                  {savingVeh ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, maxHeight: 360, overflow: 'auto' }}>
                {assignable.length === 0 && <div style={{ padding: 14, color: '#94A3B8', fontSize: 13 }}>No vehicles in your fleet.</div>}
                {assignable.map(v => (
                  <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={selectedVeh.has(v.id)} onChange={() => toggleVeh(v.id)} />
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{v.vehicleNumber || `#${v.id}`}</span>
                    {v.vehicleName && <span style={{ color: '#64748B' }}>· {v.vehicleName}</span>}
                    <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 11 }}>{v.deviceType}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Members */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Members ({team.members?.length || 0})</h3>
                <button style={btn('#1D4ED8')} onClick={() => setShowAdd(s => !s)}>{showAdd ? 'Cancel' : '+ Add Member'}</button>
              </div>

              {showAdd && (
                <div style={{ ...card, marginBottom: 10, background: '#F8FAFC' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input style={input} placeholder="Name" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} />
                    <input style={input} placeholder="Phone" value={memberForm.phone} onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))} />
                    <input style={input} placeholder="Email" value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} />
                    <input style={input} placeholder="Password" type="password" value={memberForm.password} onChange={e => setMemberForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                  <button style={{ ...btn('#16A34A'), width: '100%' }} onClick={handleAddMember}>Create Member</button>
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94A3B8' }}>Defaults to Fleet + Tracking + Trips + Reports; adjust below after adding.</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflow: 'auto' }}>
                {(team.members || []).length === 0 && <div style={{ color: '#94A3B8', fontSize: 13, padding: 8 }}>No members yet.</div>}
                {(team.members || []).map(m => (
                  <div key={m.id} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>
                          {m.name}{' '}
                          {m.status !== 'active' && <span style={{ fontSize: 10, color: '#B45309', background: '#FEF3C7', padding: '1px 6px', borderRadius: 4 }}>{m.status}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{m.email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...btn('#F1F5F9', '#475569'), padding: '5px 8px', fontSize: 11 }} onClick={() => removeMember(m, false)}>Remove</button>
                        <button style={{ ...btn('#FEE2E2', '#B91C1C'), padding: '5px 8px', fontSize: 11 }} onClick={() => removeMember(m, true)}>Revoke</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {MEMBER_PERMISSIONS.map(p => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569' }}>
                          <input type="checkbox" checked={!!m.permissions?.[p.key]} onChange={e => togglePerm(m, p.key, e.target.checked)} />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

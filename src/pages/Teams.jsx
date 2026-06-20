import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { VehicleIcon } from '../utils/vehicleIcons';
import {
  getTeams, getTeam, createTeam, updateTeam, deleteTeam,
  getAssignableVehicles, getOwnerMembers,
  addTeamVehicle, removeTeamVehicle,
  addTeamMember, attachTeamMember, removeTeamMember, deleteTeamMember, setMemberPermissions,
} from '../services/team.service';

// Inline icon set (same glyphs as the Groups page).
const Ic = ({ n, size = 14, color = 'currentColor', sw = 1.75 }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0, display: 'block' } };
  const I = {
    plus:  <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    edit:  <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" /></>,
    x:     <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
    truck: <><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
    search:<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    plusc: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>,
    key:   <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>,
  };
  return <svg {...p}>{I[n] ?? null}</svg>;
};

const MEMBER_PERMISSIONS = [
  { key: 'canViewFleet',         label: 'Fleet List' },
  { key: 'canTrackVehicle',      label: 'Live Tracking' },
  { key: 'canViewTrips',         label: 'Trips' },
  { key: 'canViewReports',       label: 'Reports' },
  { key: 'canDownloadReports',   label: 'Download Reports' },
  { key: 'canViewNotifications', label: 'Notifications' },
  { key: 'canSetAlerts',         label: 'Alerts' },
  { key: 'canManageGeofences',   label: 'Geofences' },
];

const colLabel = { fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 };
const emptyBox = { border: '1px solid #E2E8F0', padding: '28px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13, background: '#f8fafc' };
const searchWrap = { position: 'relative', marginBottom: 8 };
const searchInput = { width: '100%', padding: '8px 10px 8px 32px', border: '1px solid #E2E8F0', borderRadius: 0, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
const pill = (bg, fg) => ({ background: bg, color: fg, padding: '4px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 });

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assignable, setAssignable] = useState([]);
  const [members, setMembers] = useState([]); // owner pool: {id,name,email,status,permissions,teamIds}

  const [tab, setTab] = useState('vehicles');
  const [vehSearch, setVehSearch] = useState('');
  const [memSearch, setMemSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const [showCreateMember, setShowCreateMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [permFor, setPermFor] = useState(null); // member id whose permission row is open

  const loadTeams = async () => {
    try {
      const r = await getTeams();
      const list = r.data || [];
      setTeams(list);
      // Auto-select the first team so the right panel isn't blank on open.
      setSelectedId(prev => prev ?? (list[0]?.id ?? null));
    }
    catch (e) { toast.error(e.message || 'Failed to load teams'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadTeams(); }, []);

  const loadDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const [t, av, mp] = await Promise.all([getTeam(id), getAssignableVehicles(), getOwnerMembers()]);
      setDetail(t.data || null);
      setAssignable(av.data || []);
      setMembers(mp.data || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load team');
    } finally { setLoadingDetail(false); }
  };
  useEffect(() => { if (selectedId) { setTab('vehicles'); setPermFor(null); loadDetail(selectedId); } }, [selectedId]);

  const refresh = async () => { await Promise.all([loadDetail(selectedId), loadTeams()]); };

  // ── team CRUD ──
  const openCreate = () => { setEditing(null); setForm({ name: '', description: '' }); setShowForm(true); };
  const openEdit = () => { setEditing(detail); setForm({ name: detail.name, description: detail.description || '' }); setShowForm(true); };
  const saveTeam = async () => {
    if (!form.name.trim()) return toast.warn('Team name is required');
    try {
      if (editing) { await updateTeam(editing.id, form); toast.success('Team updated'); }
      else { const r = await createTeam(form); toast.success('Team created'); setSelectedId(r.data?.id); }
      setShowForm(false); await loadTeams(); if (editing) loadDetail(editing.id);
    } catch (e) { toast.error(e.message || 'Failed to save team'); }
  };
  const removeTeam = async () => {
    if (!window.confirm(`Delete team "${detail.name}"? Members lose access to its vehicles.`)) return;
    try { await deleteTeam(detail.id); toast.success('Team deleted'); setSelectedId(null); setDetail(null); loadTeams(); }
    catch (e) { toast.error(e.message || 'Failed to delete team'); }
  };

  // ── vehicles ──
  const teamVehIds = useMemo(() => new Set((detail?.vehicles || []).map(v => v.id)), [detail]);
  const addableVeh = useMemo(() => {
    const q = vehSearch.trim().toLowerCase();
    return assignable.filter(v => !teamVehIds.has(v.id) &&
      (!q || (v.vehicleNumber || '').toLowerCase().includes(q) || (v.vehicleName || '').toLowerCase().includes(q)));
  }, [assignable, teamVehIds, vehSearch]);

  const toggleVeh = async (vehicleId, add) => {
    try { add ? await addTeamVehicle(selectedId, vehicleId) : await removeTeamVehicle(selectedId, vehicleId); await refresh(); }
    catch (e) { toast.error(e.message || 'Failed'); }
  };

  // ── members ──
  const inTeam = useMemo(() => members.filter(m => (m.teamIds || []).includes(Number(selectedId))), [members, selectedId]);
  const addableMem = useMemo(() => {
    const q = memSearch.trim().toLowerCase();
    return members.filter(m => !(m.teamIds || []).includes(Number(selectedId)) &&
      (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)));
  }, [members, selectedId, memSearch]);

  const toggleMem = async (userId, attach) => {
    try { attach ? await attachTeamMember(selectedId, userId) : await removeTeamMember(selectedId, userId); await refresh(); }
    catch (e) { toast.error(e.message || 'Failed'); }
  };
  const revokeMem = async (m) => {
    if (!window.confirm(`Revoke ${m.name}'s login entirely? They will be removed from all teams and cannot sign in.`)) return;
    try { await deleteTeamMember(selectedId, m.id); toast.success('Member revoked'); await refresh(); }
    catch (e) { toast.error(e.message || 'Failed'); }
  };
  const createMember = async () => {
    const { name, email, password } = memberForm;
    if (!name.trim() || !email.trim() || !password) return toast.warn('Name, email and password are required');
    try {
      await addTeamMember(selectedId, memberForm);
      toast.success('Member created & added');
      setShowCreateMember(false); setMemberForm({ name: '', email: '', phone: '', password: '' });
      await refresh();
    } catch (e) { toast.error(e.message || 'Failed to create member'); }
  };
  const togglePerm = async (m, key, value) => {
    const next = { ...Object.fromEntries(MEMBER_PERMISSIONS.map(p => [p.key, !!m.permissions?.[p.key]])), [key]: value };
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, permissions: { ...(x.permissions || {}), [key]: value } } : x));
    try { await setMemberPermissions(selectedId, m.id, next); }
    catch (e) { toast.error(e.message || 'Failed to update permission'); refresh(); }
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f8fafc' }}>
      {/* Left: team list */}
      <div style={{ width: 280, borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Teams</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{teams.length} team{teams.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
            <Ic n="plus" size={12} color="#fff" />New
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Loading…</div>
          ) : teams.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
              No teams yet.<br />Create your first team to get started.
            </div>
          ) : teams.map(t => {
            const active = selectedId === t.id;
            return (
              <div key={t.id} onClick={() => setSelectedId(t.id)}
                style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: active ? '#EFF6FF' : '#fff', borderLeft: `3px solid ${active ? '#2563EB' : '#E2E8F0'}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#2563EB' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: '#94A3B8' }}>
                  <span>{t.vehicleCount} vehicles</span><span>·</span><span>{t.memberCount} members</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 48 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Select a team to manage</div>
            <div style={{ fontSize: 13 }}>or create one using the button on the left</div>
          </div>
        ) : loadingDetail || !detail ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            <div style={{ background: 'var(--theme-sidebar-bg)', padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ic n="users" size={20} color="#fff" sw={1.5} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{detail.name}</div>
                {detail.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{detail.description}</div>}
              </div>
              <button onClick={openEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                <Ic n="edit" size={12} color="#fff" />Edit
              </button>
              <button onClick={removeTeam} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.4)', color: '#FCA5A5', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                <Ic n="trash" size={12} color="#FCA5A5" />Delete
              </button>
            </div>

            <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', background: '#f8fafc' }}>
              {[{ id: 'vehicles', label: `Vehicles (${detail.vehicles?.length || 0})`, icon: 'truck' },
                { id: 'members', label: `Members (${inTeam.length})`, icon: 'users' }].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', border: 'none', background: tab === t.id ? '#fff' : 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? '#2563EB' : '#64748B', borderBottom: `2px solid ${tab === t.id ? '#2563EB' : 'transparent'}`, marginBottom: -2, fontFamily: 'inherit' }}>
                  <Ic n={t.icon} size={13} color={tab === t.id ? '#2563EB' : '#94A3B8'} />{t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
              {/* VEHICLES */}
              {tab === 'vehicles' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
                  <div>
                    <div style={colLabel}>In this team ({detail.vehicles?.length || 0})</div>
                    {(detail.vehicles || []).length === 0 ? <div style={emptyBox}>No vehicles yet.<br />Add from the right.</div> : (
                      <div style={{ border: '1px solid #E2E8F0' }}>
                        {detail.vehicles.map((v, i) => (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < detail.vehicles.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                            <VehicleIcon type={v.vehicleIcon} color="#64748B" size={26} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{v.vehicleName || v.vehicleNumber || `#${v.id}`}</div>
                              {v.vehicleName && v.vehicleNumber && <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{v.vehicleNumber}</div>}
                            </div>
                            <button onClick={() => toggleVeh(v.id, false)} style={pill('#FEF2F2', '#DC2626')}><Ic n="x" size={10} color="#DC2626" />Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={colLabel}>Add vehicles</div>
                    <div style={searchWrap}>
                      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}><Ic n="search" size={14} color="#94A3B8" /></span>
                      <input style={searchInput} placeholder="Search vehicles…" value={vehSearch} onChange={e => setVehSearch(e.target.value)} />
                    </div>
                    <div style={{ border: '1px solid #E2E8F0', maxHeight: 420, overflow: 'auto' }}>
                      {addableVeh.length === 0 ? <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>No vehicles to add.</div> :
                        addableVeh.map((v, i) => (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < addableVeh.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                            <VehicleIcon type={v.vehicleIcon} color="#94A3B8" size={26} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{v.vehicleName || v.vehicleNumber || `#${v.id}`}</div>
                              {v.vehicleName && v.vehicleNumber && <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{v.vehicleNumber}</div>}
                            </div>
                            <button onClick={() => toggleVeh(v.id, true)} style={pill('#EFF6FF', '#2563EB')}><Ic n="plus" size={10} color="#2563EB" />Add</button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MEMBERS */}
              {tab === 'members' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
                  <div>
                    <div style={colLabel}>In this team ({inTeam.length})</div>
                    {inTeam.length === 0 ? <div style={emptyBox}>No members yet.<br />Add from the right, or create one.</div> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {inTeam.map(m => (
                          <div key={m.id} style={{ border: '1px solid #E2E8F0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                                  {m.name}{m.status !== 'active' && <span style={{ fontSize: 10, color: '#B45309', background: '#FEF3C7', padding: '1px 6px', marginLeft: 6 }}>{m.status}</span>}
                                </div>
                                <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.email} · {(m.teamIds || []).length} team{(m.teamIds || []).length !== 1 ? 's' : ''}</div>
                              </div>
                              <button onClick={() => setPermFor(permFor === m.id ? null : m.id)} title="Permissions" style={pill('#F1F5F9', '#475569')}><Ic n="key" size={10} color="#475569" />Menu</button>
                              <button onClick={() => toggleMem(m.id, false)} style={pill('#FEF2F2', '#DC2626')}><Ic n="x" size={10} color="#DC2626" />Remove</button>
                              <button onClick={() => revokeMem(m)} title="Revoke login" style={pill('#FEE2E2', '#B91C1C')}>Revoke</button>
                            </div>
                            {permFor === m.id && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 14px', borderTop: '1px solid #F1F5F9', background: '#f8fafc' }}>
                                {MEMBER_PERMISSIONS.map(p => (
                                  <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569' }}>
                                    <input type="checkbox" checked={!!m.permissions?.[p.key]} onChange={e => togglePerm(m, p.key, e.target.checked)} />{p.label}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ ...colLabel, margin: 0 }}>Add members</div>
                      <button onClick={() => setShowCreateMember(s => !s)} style={pill('var(--theme-sidebar-bg)', '#fff')}><Ic n="plusc" size={11} color="#fff" />{showCreateMember ? 'Cancel' : 'Create'}</button>
                    </div>

                    {showCreateMember && (
                      <div style={{ border: '1px solid #E2E8F0', padding: 12, marginBottom: 10, background: '#f8fafc' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <input style={searchInput} placeholder="Name" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} />
                          <input style={searchInput} placeholder="Phone" value={memberForm.phone} onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))} />
                          <input style={searchInput} placeholder="Email" value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} />
                          <input style={searchInput} type="password" placeholder="Password" value={memberForm.password} onChange={e => setMemberForm(f => ({ ...f, password: e.target.value }))} />
                        </div>
                        <button onClick={createMember} style={{ ...pill('#16A34A', '#fff'), justifyContent: 'center', width: '100%', padding: '9px' }}>Create & Add to team</button>
                      </div>
                    )}

                    <div style={searchWrap}>
                      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}><Ic n="search" size={14} color="#94A3B8" /></span>
                      <input style={searchInput} placeholder="Search members…" value={memSearch} onChange={e => setMemSearch(e.target.value)} />
                    </div>
                    <div style={{ border: '1px solid #E2E8F0', maxHeight: 360, overflow: 'auto' }}>
                      {addableMem.length === 0 ? <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>No other members. Use Create to add one.</div> :
                        addableMem.map((m, i) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < addableMem.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.email} · in {(m.teamIds || []).length} team{(m.teamIds || []).length !== 1 ? 's' : ''}</div>
                            </div>
                            <button onClick={() => toggleMem(m.id, true)} style={pill('#EFF6FF', '#2563EB')}><Ic n="plus" size={10} color="#2563EB" />Add</button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create / edit team modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowForm(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)' }} />
          <div style={{ position: 'relative', zIndex: 1, background: '#fff', width: 420, maxWidth: '92vw', borderRadius: 12, padding: 22 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#0F172A' }}>{editing ? 'Edit Team' : 'Create Team'}</h2>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Name</label>
            <input autoFocus style={{ ...searchInput, padding: '9px 11px', margin: '4px 0 12px' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Zone Drivers" />
            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Description (optional)</label>
            <input style={{ ...searchInput, padding: '9px 11px', margin: '4px 0 18px' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ ...pill('#F1F5F9', '#334155'), padding: '9px 16px' }}>Cancel</button>
              <button onClick={saveTeam} style={{ ...pill('var(--theme-sidebar-bg)', '#fff'), padding: '9px 16px' }}>{editing ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

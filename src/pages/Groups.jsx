import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { getGroups, getGroupById, createGroup, updateGroup, deleteGroup, addVehicleToGroup, removeVehicleFromGroup, getGroupReportSummary, getGroupReportTrips, exportGroupReportExcel } from '../services/group.service';
import { createTripShare } from '../services/share.service';
import { getVehicles } from '../services/vehicle.service';
import { getISTToday, getISTDaysAgo } from '../utils/dateFormat';
import LocationPlayer from '../components/common/LocationPlayer';

// ─── Constants ────────────────────────────────────────────────────────────────
const GROUP_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#a855f7','#84cc16','#64748b'];
const VEHICLE_ICON_MAP = { car:'🚗',suv:'🚙',truck:'🚛',bus:'🚌',bike:'🏍️',auto:'🛺',van:'🚐',ambulance:'🚑',pickup:'🛻',minibus:'🚌',schoolbus:'🚍',tractor:'🚜',crane:'🏗️',jcb:'🏗️',dumper:'🚚',earthmover:'🚜',tanker:'⛽',container:'🚛',fire:'🚒',police:'🚔',sweeper:'🚛',tipper:'🚚' };
const PAGE_SIZE = 50;

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = ({ n, size = 14, color = 'currentColor', sw = 1.75 }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0, display: 'block' } };
  const I = {
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    edit:     <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
    x:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    layers:   <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    users:    <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
    chart:    <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    route:    <><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/><circle cx="18" cy="5" r="3"/></>,
    search:   <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    refresh:  <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
  };
  return <svg {...p}>{I[n] ?? null}</svg>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDur = (seconds) => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ─── Main Component ───────────────────────────────────────────────────────────
const Groups = () => {
  const today = getISTToday();
  const weekAgo = getISTDaysAgo(7);

  // Groups list
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // All vehicles (for assignment)
  const [allVehicles, setAllVehicles] = useState([]);

  // Group form (create/edit)
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', color: '#3b82f6' });
  const [savingGroup, setSavingGroup] = useState(false);

  // Active tab inside group detail
  const [activeTab, setActiveTab] = useState('vehicles');

  // Vehicle assignment search
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [togglingVehicle, setTogglingVehicle] = useState(null);

  // Reports state
  const [reportFrom, setReportFrom] = useState(weekAgo);
  const [reportTo, setReportTo] = useState(today);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [trips, setTrips] = useState(null);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripsPage, setTripsPage] = useState(0);

  // Location player state
  const [playerVehicle, setPlayerVehicle] = useState(null);
  const [playerFrom, setPlayerFrom] = useState(null);
  const [playerTo, setPlayerTo] = useState(null);

  // Share state
  const [sharingTripId, setSharingTripId] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await getGroups();
      setGroups(res.data || []);
    } catch { toast.error('Failed to load groups'); }
    finally { setLoadingGroups(false); }
  };

  const fetchAllVehicles = async () => {
    try {
      const res = await getVehicles();
      setAllVehicles(res.data || []);
    } catch { /* silent */ }
  };

  const fetchGroupDetail = async (id) => {
    setLoadingDetail(true);
    setGroupDetail(null);
    setSummary(null);
    setTrips(null);
    setTripsPage(0);
    try {
      const res = await getGroupById(id);
      setGroupDetail(res.data);
    } catch { toast.error('Failed to load group details'); }
    finally { setLoadingDetail(false); }
  };

  const fetchSummary = async (id) => {
    setLoadingSummary(true);
    setSummary(null);
    try {
      const res = await getGroupReportSummary(id, reportFrom, reportTo);
      setSummary(res.data);
    } catch { toast.error('Failed to load summary'); }
    finally { setLoadingSummary(false); }
  };

  const fetchTrips = async (id, page = 0) => {
    setLoadingTrips(true);
    try {
      const res = await getGroupReportTrips(id, reportFrom, reportTo, PAGE_SIZE, page * PAGE_SIZE);
      setTrips(res.data?.trips || []);
      setTripsTotal(res.data?.total || 0);
      setTripsPage(page);
    } catch { toast.error('Failed to load trips'); }
    finally { setLoadingTrips(false); }
  };

  useEffect(() => { fetchGroups(); fetchAllVehicles(); }, []);

  useEffect(() => {
    if (!selectedGroupId) { setGroupDetail(null); return; }
    fetchGroupDetail(selectedGroupId);
    setActiveTab('vehicles');
  }, [selectedGroupId]);

  // ── Group CRUD ─────────────────────────────────────────────────────────────
  const openCreateForm = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', description: '', color: '#3b82f6' });
    setShowGroupForm(true);
  };

  const openEditForm = (g, e) => {
    e.stopPropagation();
    setEditingGroup(g);
    setGroupForm({ name: g.name, description: g.description || '', color: g.color || '#3b82f6' });
    setShowGroupForm(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return toast.error('Group name is required');
    setSavingGroup(true);
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, groupForm);
        toast.success('Group updated');
      } else {
        await createGroup(groupForm);
        toast.success('Group created');
      }
      setShowGroupForm(false);
      await fetchGroups();
      if (selectedGroupId) fetchGroupDetail(selectedGroupId);
    } catch (e) { toast.error(e.message || 'Save failed'); }
    finally { setSavingGroup(false); }
  };

  const handleDeleteGroup = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this group? This will not delete the vehicles.')) return;
    try {
      await deleteGroup(id);
      toast.success('Group deleted');
      if (selectedGroupId === id) setSelectedGroupId(null);
      fetchGroups();
    } catch (e) { toast.error(e.message || 'Delete failed'); }
  };

  // ── Vehicle assignment ─────────────────────────────────────────────────────
  const handleToggleVehicle = async (vehicleId, inGroup) => {
    if (!groupDetail) return;
    setTogglingVehicle(vehicleId);
    try {
      if (inGroup) {
        await removeVehicleFromGroup(groupDetail.id, vehicleId);
      } else {
        await addVehicleToGroup(groupDetail.id, vehicleId);
      }
      await fetchGroupDetail(groupDetail.id);
      await fetchGroups();
    } catch (e) { toast.error(e.message || 'Failed'); }
    finally { setTogglingVehicle(null); }
  };

  // ── Download Excel ─────────────────────────────────────────────────────────
  const handleDownloadExcel = async () => {
    if (!groupDetail) return;
    setDownloadingExcel(true);
    try {
      const res = await exportGroupReportExcel(groupDetail.id, reportFrom, reportTo);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `group_${groupDetail.name.replace(/\s+/g, '_')}_${reportFrom}_${reportTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel report downloaded');
    } catch { toast.error('Failed to download Excel report'); }
    finally { setDownloadingExcel(false); }
  };

  // ── Share trip ──────────────────────────────────────────────────────────────
  const handleShareTrip = async (trip) => {
    setSharingTripId(trip.id);
    try {
      const res = await createTripShare(trip.vehicleId, trip.startTime, trip.endTime);
      const token = res.data?.token;
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard!');
    } catch { toast.error('Failed to create share link'); }
    finally { setSharingTripId(null); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const groupVehicleIds = useMemo(() => new Set((groupDetail?.vehicles || []).map(v => v.id)), [groupDetail]);

  const filteredAllVehicles = useMemo(() => {
    const q = vehicleSearch.toLowerCase();
    return allVehicles.filter(v =>
      !q || (v.vehicleName || '').toLowerCase().includes(q) || (v.vehicleNumber || '').toLowerCase().includes(q)
    );
  }, [allVehicles, vehicleSearch]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f8fafc' }}>

      {/* ── Left panel: group list ──────────────────────────────────────── */}
      <div style={{ width: 280, borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Vehicle Groups</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{groups.length} group{groups.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={openCreateForm}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
            <Ic n="plus" size={12} color="#fff" />New
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loadingGroups ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Loading groups…</div>
          ) : groups.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
              No groups yet.<br />Create your first group to get started.
            </div>
          ) : (
            groups.map(g => {
              const isActive = selectedGroupId === g.id;
              return (
                <div key={g.id}
                  onClick={() => setSelectedGroupId(isActive ? null : g.id)}
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: isActive ? '#EFF6FF' : '#fff', borderLeft: `3px solid ${isActive ? '#2563EB' : g.color || '#E2E8F0'}`, transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#fff'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color || '#3b82f6', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#2563EB' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                      {g.description && (
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.description}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, background: isActive ? '#DBEAFE' : '#F1F5F9', color: isActive ? '#1D4ED8' : '#64748B', padding: '2px 7px', flexShrink: 0 }}>
                      {g.vehicles?.length || 0}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingLeft: 20 }}>
                    <button onClick={e => openEditForm(g, e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'none', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 11, color: '#64748B', fontFamily: 'inherit' }}>
                      <Ic n="edit" size={10} color="#64748B" />Edit
                    </button>
                    <button onClick={e => handleDeleteGroup(g.id, e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'none', border: '1px solid #FECACA', cursor: 'pointer', fontSize: 11, color: '#DC2626', fontFamily: 'inherit' }}>
                      <Ic n="trash" size={10} color="#DC2626" />Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: group detail ──────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedGroupId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 48 }}>🚗</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Select a group to view details</div>
            <div style={{ fontSize: 13 }}>or create a new group using the button on the left</div>
          </div>
        ) : loadingDetail ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>Loading…</div>
        ) : groupDetail ? (
          <>
            {/* Group header */}
            <div style={{ background: 'var(--theme-sidebar-bg)', padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <div style={{ width: 42, height: 42, background: groupDetail.color || '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ic n="layers" size={20} color="#fff" sw={1.5} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{groupDetail.name}</div>
                {groupDetail.description && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{groupDetail.description}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <span style={{ background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.9)', padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                  {groupDetail.vehicles?.length || 0} vehicles
                </span>
                <button onClick={e => openEditForm(groupDetail, e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  <Ic n="edit" size={12} color="#fff" />Edit Group
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', background: '#f8fafc', flexShrink: 0 }}>
              {[
                { id: 'vehicles', label: 'Vehicles', icon: 'users' },
                { id: 'summary',  label: 'Summary',  icon: 'chart'  },
                { id: 'trips',    label: 'Trips',    icon: 'route'  },
              ].map(t => (
                <button key={t.id} onClick={() => {
                    setActiveTab(t.id);
                    if (t.id === 'summary' && !summary) fetchSummary(groupDetail.id);
                    if (t.id === 'trips' && !trips) fetchTrips(groupDetail.id, 0);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', border: 'none', background: activeTab === t.id ? '#fff' : 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? '#2563EB' : '#64748B', borderBottom: `2px solid ${activeTab === t.id ? '#2563EB' : 'transparent'}`, marginBottom: -2, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <Ic n={t.icon} size={13} color={activeTab === t.id ? '#2563EB' : '#94A3B8'} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>

              {/* ── Vehicles tab ── */}
              {activeTab === 'vehicles' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

                  {/* Current members */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                      In this group ({groupDetail.vehicles?.length || 0})
                    </div>
                    {groupDetail.vehicles?.length === 0 ? (
                      <div style={{ border: '1px solid #E2E8F0', padding: '28px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13, background: '#f8fafc' }}>
                        No vehicles in this group yet.<br />Add vehicles from the right column.
                      </div>
                    ) : (
                      <div style={{ border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                        {groupDetail.vehicles.map((v, i) => (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < groupDetail.vehicles.length - 1 ? '1px solid #F1F5F9' : 'none', background: '#fff' }}>
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{VEHICLE_ICON_MAP[v.vehicleIcon] || '🚗'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {v.vehicleName || v.vehicleNumber || `Vehicle #${v.id}`}
                              </div>
                              {v.vehicleName && v.vehicleNumber && (
                                <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', marginTop: 1 }}>{v.vehicleNumber}</div>
                              )}
                            </div>
                            <button onClick={() => handleToggleVehicle(v.id, true)} disabled={togglingVehicle === v.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', cursor: togglingVehicle === v.id ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0 }}>
                              <Ic n="x" size={10} color="#DC2626" />Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* All vehicles (add to group) */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                      All vehicles — add to group
                    </div>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <Ic n="search" size={13} color="#94A3B8" />
                      </span>
                      <input
                        value={vehicleSearch}
                        onChange={e => setVehicleSearch(e.target.value)}
                        placeholder="Search vehicles…"
                        style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }}
                      />
                    </div>
                    <div style={{ border: '1px solid #E2E8F0', overflow: 'hidden', maxHeight: 380, overflowY: 'auto' }}>
                      {filteredAllVehicles.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No vehicles found</div>
                      ) : (
                        filteredAllVehicles.map((v, i) => {
                          const inGroup = groupVehicleIds.has(v.id);
                          return (
                            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < filteredAllVehicles.length - 1 ? '1px solid #F1F5F9' : 'none', background: inGroup ? '#F0FDF4' : '#fff' }}>
                              <span style={{ fontSize: 18, flexShrink: 0 }}>{VEHICLE_ICON_MAP[v.vehicleIcon] || '🚗'}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {v.vehicleName || v.vehicleNumber || `Vehicle #${v.id}`}
                                </div>
                                {v.vehicleName && v.vehicleNumber && (
                                  <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{v.vehicleNumber}</div>
                                )}
                              </div>
                              {inGroup ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#059669', fontWeight: 700, flexShrink: 0 }}>
                                  <Ic n="check" size={11} color="#059669" />In group
                                </span>
                              ) : (
                                <button onClick={() => handleToggleVehicle(v.id, false)} disabled={togglingVehicle === v.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', cursor: togglingVehicle === v.id ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0 }}>
                                  <Ic n="plus" size={10} color="#2563EB" />Add
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Summary tab ── */}
              {activeTab === 'summary' && (
                <div>
                  {/* Date range controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E2E8F0', padding: '6px 12px' }}>
                      <Ic n="calendar" size={13} color="#94A3B8" />
                      <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', color: '#334155' }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>to</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E2E8F0', padding: '6px 12px' }}>
                      <Ic n="calendar" size={13} color="#94A3B8" />
                      <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', color: '#334155' }} />
                    </div>
                    <button onClick={() => fetchSummary(groupDetail.id)} disabled={loadingSummary}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: loadingSummary ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                      <Ic n="refresh" size={13} color="#fff" />{loadingSummary ? 'Loading…' : 'Generate'}
                    </button>
                    <button onClick={handleDownloadExcel} disabled={downloadingExcel}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: downloadingExcel ? '#94a3b8' : '#059669', border: 'none', color: '#fff', cursor: downloadingExcel ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                      📥 {downloadingExcel ? 'Downloading…' : 'Download Excel'}
                    </button>
                  </div>

                  {loadingSummary && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: 14 }}>Loading summary…</div>
                  )}

                  {summary && (
                    <>
                      {/* Aggregate stat tiles */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                        {[
                          { label: 'Vehicles', value: summary.totals.vehicleCount, color: '#2563EB', icon: '🚗' },
                          { label: 'Total Trips', value: summary.totals.tripCount, color: '#059669', icon: '🛣️' },
                          { label: 'Total Distance', value: `${summary.totals.totalDistance} km`, color: '#7C3AED', icon: '📏' },
                          { label: 'Engine Time', value: fmtDur(summary.totals.totalDuration), color: '#D97706', icon: '⏱️' },
                          { label: 'Fuel Used', value: summary.totals.totalFuel > 0 ? `${summary.totals.totalFuel} L` : '—', color: '#0891B2', icon: '⛽' },
                          { label: 'Max Speed', value: summary.totals.maxSpeed > 0 ? `${summary.totals.maxSpeed} km/h` : '—', color: '#DC2626', icon: '🏎️' },
                        ].map(s => (
                          <div key={s.label} style={{ background: '#fff', border: `1px solid #E2E8F0`, borderTop: `3px solid ${s.color}`, padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 18 }}>{s.icon}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Per-vehicle breakdown */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Per Vehicle Breakdown</div>
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              {['Vehicle', 'Trips', 'Distance', 'Duration', 'Avg Speed', 'Max Speed', 'Fuel'].map(h => (
                                <th key={h}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {summary.perVehicle.length === 0 ? (
                              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: '28px' }}>No trip data in this period</td></tr>
                            ) : (
                              summary.perVehicle.map(pv => (
                                <tr key={pv.vehicleId}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 16 }}>{VEHICLE_ICON_MAP[pv.vehicleIcon] || '🚗'}</span>
                                      <div>
                                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{pv.vehicleName || pv.vehicleNumber || `#${pv.vehicleId}`}</div>
                                        {pv.vehicleName && pv.vehicleNumber && <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{pv.vehicleNumber}</div>}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ fontWeight: 700 }}>{pv.tripCount}</td>
                                  <td style={{ fontWeight: 600 }}>{pv.totalDistance} km</td>
                                  <td>{fmtDur(pv.totalDuration)}</td>
                                  <td>{pv.avgSpeed > 0 ? `${pv.avgSpeed} km/h` : '—'}</td>
                                  <td style={{ color: pv.maxSpeed > 80 ? '#DC2626' : 'inherit', fontWeight: pv.maxSpeed > 80 ? 700 : 400 }}>{pv.maxSpeed > 0 ? `${pv.maxSpeed} km/h` : '—'}</td>
                                  <td>{pv.totalFuel > 0 ? `${pv.totalFuel} L` : '—'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {!summary && !loadingSummary && (
                    <div style={{ border: '1px solid #E2E8F0', padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: 13, background: '#fff' }}>
                      Select a date range and click Generate to see the group summary report.
                    </div>
                  )}
                </div>
              )}

              {/* ── Trips tab ── */}
              {activeTab === 'trips' && (
                <div>
                  {/* Date range controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E2E8F0', padding: '6px 12px' }}>
                      <Ic n="calendar" size={13} color="#94A3B8" />
                      <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', color: '#334155' }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>to</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E2E8F0', padding: '6px 12px' }}>
                      <Ic n="calendar" size={13} color="#94A3B8" />
                      <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', color: '#334155' }} />
                    </div>
                    <button onClick={() => fetchTrips(groupDetail.id, 0)} disabled={loadingTrips}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: loadingTrips ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                      <Ic n="refresh" size={13} color="#fff" />{loadingTrips ? 'Loading…' : 'Load Trips'}
                    </button>
                    {trips !== null && (
                      <span style={{ fontSize: 12, color: '#64748B', marginLeft: 4 }}>{tripsTotal} trip{tripsTotal !== 1 ? 's' : ''} found</span>
                    )}
                  </div>

                  {loadingTrips && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: 14 }}>Loading trips…</div>
                  )}

                  {trips !== null && !loadingTrips && (
                    <>
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              {['Vehicle', 'Start', 'End', 'Duration', 'Distance', 'Avg Speed', 'Max Speed', 'Fuel', 'Actions'].map(h => (
                                <th key={h}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {trips.length === 0 ? (
                              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94A3B8', padding: '32px' }}>No trips found in this period</td></tr>
                            ) : (
                              trips.map(t => (
                                <tr key={t.id}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                      <span style={{ fontSize: 15 }}>{VEHICLE_ICON_MAP[t.vehicle?.vehicleIcon] || '🚗'}</span>
                                      <div>
                                        <div style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>{t.vehicle?.vehicleName || t.vehicle?.vehicleNumber || `#${t.vehicleId}`}</div>
                                        {t.vehicle?.vehicleName && t.vehicle?.vehicleNumber && (
                                          <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{t.vehicle.vehicleNumber}</div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(t.startTime)}</td>
                                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(t.endTime)}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDur(t.duration)}</td>
                                  <td style={{ fontWeight: 600 }}>{Number(t.distance).toFixed(1)} km</td>
                                  <td>{t.avgSpeed ? `${Number(t.avgSpeed).toFixed(1)} km/h` : '—'}</td>
                                  <td style={{ color: Number(t.maxSpeed) > 80 ? '#DC2626' : 'inherit', fontWeight: Number(t.maxSpeed) > 80 ? 700 : 400 }}>
                                    {t.maxSpeed ? `${Number(t.maxSpeed).toFixed(1)} km/h` : '—'}
                                  </td>
                                  <td>{t.fuelConsumed ? `${Number(t.fuelConsumed).toFixed(1)} L` : '—'}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button
                                        onClick={() => { setPlayerVehicle({ id: t.vehicleId, vehicleNumber: t.vehicle?.vehicleNumber, vehicleName: t.vehicle?.vehicleName, vehicleIcon: t.vehicle?.vehicleIcon }); setPlayerFrom(t.startTime); setPlayerTo(t.endTime); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
                                        ▶ Play
                                      </button>
                                      <button
                                        onClick={() => handleShareTrip(t)}
                                        disabled={sharingTripId === t.id}
                                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#059669', cursor: sharingTripId === t.id ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
                                        🔗 {sharingTripId === t.id ? '…' : 'Share'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {tripsTotal > PAGE_SIZE && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                          <button onClick={() => fetchTrips(groupDetail.id, tripsPage - 1)} disabled={tripsPage === 0 || loadingTrips}
                            style={{ padding: '6px 14px', background: '#fff', border: '1px solid #E2E8F0', cursor: tripsPage === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: tripsPage === 0 ? 0.5 : 1 }}>
                            ← Prev
                          </button>
                          <span style={{ fontSize: 13, color: '#64748B' }}>
                            Page {tripsPage + 1} / {Math.ceil(tripsTotal / PAGE_SIZE)}
                          </span>
                          <button onClick={() => fetchTrips(groupDetail.id, tripsPage + 1)} disabled={(tripsPage + 1) * PAGE_SIZE >= tripsTotal || loadingTrips}
                            style={{ padding: '6px 14px', background: '#fff', border: '1px solid #E2E8F0', cursor: (tripsPage + 1) * PAGE_SIZE >= tripsTotal ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: (tripsPage + 1) * PAGE_SIZE >= tripsTotal ? 0.5 : 1 }}>
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {trips === null && !loadingTrips && (
                    <div style={{ border: '1px solid #E2E8F0', padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: 13, background: '#fff' }}>
                      Select a date range and click Load Trips to see all trips for vehicles in this group.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* ── Location Player ───────────────────────────────────────────── */}
      {playerVehicle && (
        <LocationPlayer
          vehicle={playerVehicle}
          initialFrom={playerFrom}
          initialTo={playerTo}
          onClose={() => { setPlayerVehicle(null); setPlayerFrom(null); setPlayerTo(null); }}
        />
      )}

      {/* ── Group create/edit modal ────────────────────────────────────── */}
      {showGroupForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowGroupForm(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'relative', zIndex: 1, background: '#fff', width: 440, maxWidth: '95vw', padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: 'var(--theme-sidebar-bg)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{editingGroup ? 'Edit Group' : 'New Group'}</span>
              <button onClick={() => setShowGroupForm(false)} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ic n="x" size={13} color="#fff" />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group Name *</label>
                <input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="e.g. North Zone Fleet"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                <input value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} placeholder="Optional"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {GROUP_COLORS.map(c => (
                    <button key={c} onClick={() => setGroupForm({ ...groupForm, color: c })}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: groupForm.color === c ? `3px solid #0F172A` : '3px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
                <button onClick={() => setShowGroupForm(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleSaveGroup} disabled={savingGroup}
                  style={{ padding: '8px 16px', background: 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: savingGroup ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: savingGroup ? 0.7 : 1 }}>
                  {savingGroup ? 'Saving…' : editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;

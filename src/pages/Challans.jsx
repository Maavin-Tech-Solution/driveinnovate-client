import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getScChallanData } from '../services/smartchallan.service';
import { toISTDateString } from '../utils/dateFormat';
import { useAuth } from '../context/AuthContext';

const STATUS_META = {
  pending:  { cls: 'badge-warning', label: 'Pending',  color: '#D97706' },
  paid:     { cls: 'badge-success', label: 'Paid',     color: '#059669' },
  disposed: { cls: 'badge-success', label: 'Paid',     color: '#059669' },
  disputed: { cls: 'badge-info',    label: 'Disputed', color: '#0EA5E9' },
  waived:   { cls: 'badge-gray',    label: 'Waived',   color: '#94A3B8' },
};

const normalise = (records) => {
  const flat = [];
  records.forEach(r => {
    (r.pending_data  || []).forEach(c => flat.push({ ...c, _vehicleNum: r.vehicle_number || r.vehicleNumber, _status: 'pending', _raw: c }));
    (r.disposed_data || []).forEach(c => flat.push({ ...c, _vehicleNum: r.vehicle_number || r.vehicleNumber, _status: 'disposed', _raw: c }));
  });
  return flat.map((c, i) => {
    // offence_details is an array of { act, name }; join names for display
    const offenceArr = Array.isArray(c.offence_details) ? c.offence_details : [];
    const offense = offenceArr.map(o => o.name).filter(Boolean).join(' | ')
      || c.offense || c.violation || '—';

    // Amount: fine_imposed is a string, received_amount is a number for disposed
    const amount = Number(c.fine_imposed || c.received_amount || c.amount || 0);

    // Date: challan_date_time e.g. "22-09-2025 16:18:36"
    const challanDate = c.challan_date_time || c.challan_date || c.challanDate || null;

    return {
      _raw:          c._raw || c,
      id:            `${i}`,
      vehicleNumber: (c._vehicleNum || '—').toUpperCase(),
      challanNumber: c.challan_no    || c.challanNo   || '—',
      challanType:   c.department    || c.challan_type || c.challanType || '—',
      offense,
      offenceDetails: offenceArr,
      amount,
      challanDate,
      dueDate:       c.due_date || c.dueDate || c.date_of_proceeding || null,
      challanPlace:  c.challan_place || null,
      status:        c._status,
    };
  });
};

const dateMs = (d) => d ? new Date(d).getTime() : 0;

const SortIcon = ({ col, sortCol, sortDir }) => {
  if (sortCol !== col) return <span style={{ color: '#CBD5E1', marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: '#2563EB', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

const DetailModal = ({ row, onClose }) => {
  if (!row) return null;
  const Field = ({ label, value }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</span>
    </div>
  ) : null;
  const sm = STATUS_META[row.status] || STATUS_META.pending;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{row.vehicleNumber} — {row.challanNumber}</div>
            <span className={`badge ${sm.cls}`} style={{ marginTop: 4 }}>{sm.label}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          <Field label="Vehicle"       value={row.vehicleNumber} />
          <Field label="Challan No."   value={row.challanNumber} />
          <Field label="Department"    value={row.challanType} />
          <Field label="Place"         value={row.challanPlace} />
          <Field label="Amount"        value={`₹${row.amount.toLocaleString('en-IN')}`} />
          <Field label="Date"          value={row.challanDate} />
          <Field label="Due Date"      value={row.dueDate} />
          <Field label="Status"        value={sm.label} />
          {/* Offences */}
          {row.offenceDetails?.length > 0 && (
            <div style={{ paddingTop: 10, borderTop: '1px solid #F1F5F9', marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Offences</div>
              {row.offenceDetails.map((o, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  {o.act && <span style={{ fontSize: 11, fontFamily: 'monospace', background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{o.act}</span>}
                  <span style={{ fontSize: 12, color: '#374151' }}>{o.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const STATUS_FILTERS = ['all', 'pending', 'paid', 'disputed', 'waived'];

// Modal box shown when the dealer has not granted Challan permission to this client.
const NoPermissionModal = () => {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: '32px 28px', textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ fontSize: 30 }}>🔒</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Access not permitted</div>
        <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, marginBottom: 6 }}>
          Your dealer has not enabled <strong>Challans</strong> for your account.
        </div>
        <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, marginBottom: 22 }}>
          Please contact your dealer / service provider to request access to challan data.
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ padding: '10px 22px', background: '#1B2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

// Shown when the SmartChallan challan service is not enabled on the user's profile.
const ServiceNotEnabledBox = ({ message }) => (
  <div style={{ maxWidth: 520, margin: '40px auto', background: '#fff', border: '1px solid #FDE68A', borderRadius: 16, padding: '32px 28px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
      <span style={{ fontSize: 30 }}>🚦</span>
    </div>
    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Challan service not enabled</div>
    <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, marginBottom: 6 }}>
      {message || 'The challan service is not enabled on your profile.'}
    </div>
    <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, marginBottom: 22 }}>
      Go to <strong>Profile → RTO &amp; Challan</strong>, turn on the service and add your
      SmartChallan credentials to start fetching challan data.
    </div>
    <Link
      to="/profile?tab=rto-challan"
      style={{ display: 'inline-block', padding: '10px 22px', background: '#1B2A4A', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
      Go to Profile → RTO &amp; Challan
    </Link>
  </div>
);

const Challans = () => {
  const { user } = useAuth();
  const isPapa = user?.role === 'papa' || Number(user?.parentId) === 0 || Number(user?.parent_id) === 0;
  const hasPermission = isPapa || user?.permissions?.canViewChallans === true;

  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [notEnabled,    setNotEnabled]    = useState(false);
  const [notEnabledMsg, setNotEnabledMsg] = useState(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [sortCol, setSortCol] = useState('challanDate');
  const [sortDir, setSortDir] = useState('desc');
  const [detail,  setDetail]  = useState(null);

  useEffect(() => {
    // No dealer permission → don't call the API; the modal box is shown instead.
    if (!hasPermission) { setLoading(false); return; }
    getScChallanData()
      .then(res => {
        if (res?.success === false) throw new Error(res.message || 'API error');
        // Server returns disabled:true when SmartChallan / challan is off on the profile.
        if (res?.disabled) { setNotEnabled(true); return; }
        setRows(normalise(Array.isArray(res?.data) ? res.data : []));
      })
      .catch(err => {
        const msg = err?.response?.data?.message || err?.message || 'Failed to load challan data';
        // Credentials not configured / not enabled → show the enable-service guidance.
        if (/credential|not configured|not enabled/i.test(msg)) {
          setNotEnabled(true); setNotEnabledMsg(msg);
        } else {
          setError(msg); toast.error(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [hasPermission]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const displayed = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => r.vehicleNumber.toLowerCase().includes(q) || r.challanNumber.toLowerCase().includes(q) || r.offense.toLowerCase().includes(q));
    }
    if (filter !== 'all') list = list.filter(r => r.status === filter || (filter === 'paid' && r.status === 'disposed'));
    return [...list].sort((a, b) => {
      let va, vb;
      if (sortCol === 'amount')      { va = a.amount;         vb = b.amount; }
      else if (sortCol === 'challanDate') { va = dateMs(a.challanDate); vb = dateMs(b.challanDate); }
      else if (sortCol === 'dueDate')     { va = dateMs(a.dueDate);     vb = dateMs(b.dueDate); }
      else { va = (a[sortCol] || '').toLowerCase(); vb = (b[sortCol] || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [rows, search, filter, sortCol, sortDir]);

  const totalPending = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const Th = ({ col, children }) => (
    <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {children}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );

  // No dealer permission → show the modal box and nothing else.
  if (!hasPermission) return <NoPermissionModal />;

  // SmartChallan / challan service not enabled on the profile → guidance message.
  if (notEnabled) return <ServiceNotEnabledBox message={notEnabledMsg} />;

  return (
    <div>
      {/* Summary */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="stat-pill stat-pill-blue"><span style={{ fontWeight: 800, fontSize: 18 }}>{rows.length}</span><span>Total</span></div>
          <div className="stat-pill stat-pill-red"><span style={{ fontWeight: 800, fontSize: 18 }}>{rows.filter(r => r.status === 'pending').length}</span><span>Pending</span></div>
          <div className="stat-pill stat-pill-green"><span style={{ fontWeight: 800, fontSize: 18 }}>{rows.filter(r => r.status === 'paid' || r.status === 'disposed').length}</span><span>Paid</span></div>
          {totalPending > 0 && <div className="stat-pill stat-pill-amber"><span style={{ fontWeight: 800, fontSize: 18 }}>₹{totalPending.toLocaleString('en-IN')}</span><span>Pending Amount</span></div>}
        </div>
      )}

      {/* Controls */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle, challan, offense…"
              className="form-control" style={{ paddingLeft: 30, width: 240 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>({rows.filter(r => r.status === f || (f === 'paid' && r.status === 'disposed')).length})</span>}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>{displayed.length} of {rows.length}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <span className="spinner" /> Loading challan data…
        </div>
      ) : error ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#DC2626', marginBottom: '8px' }}>Could not load challan data</div>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>{error}</div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>Check SmartChallan credentials in <strong>Profile → RTO &amp; Challan</strong></div>
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px' }}>No challans found.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <Th col="vehicleNumber">Vehicle</Th>
                <Th col="challanNumber">Challan No.</Th>
                <Th col="challanType">Type</Th>
                <Th col="offense">Offense</Th>
                <Th col="amount">Amount</Th>
                <Th col="challanDate">Date</Th>

                <Th col="status">Status</Th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((c, idx) => {
                const sm = STATUS_META[c.status] || STATUS_META.pending;
                return (
                  <tr key={c.id}>
                    <td style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 600 }}>{String(idx + 1).padStart(2, '0')}</td>
                    <td><span style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>{c.vehicleNumber}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748B' }}>{c.challanNumber}</td>
                    <td style={{ fontSize: '13px' }}>{c.challanType}</td>
                    <td style={{ maxWidth: 200, fontSize: '13px', color: '#334155' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.offense}>{c.offense}</div>
                      {c.challanPlace && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.challanPlace}>{c.challanPlace}</div>}
                    </td>
                    <td><span style={{ fontWeight: 800, fontSize: '15px', color: c.status === 'disposed' ? '#059669' : '#DC2626', fontVariantNumeric: 'tabular-nums' }}>₹{c.amount.toLocaleString('en-IN')}</span></td>
                    <td style={{ fontSize: '13px', color: '#64748B', whiteSpace: 'nowrap' }}>{c.challanDate || '—'}</td>
                    <td><span className={`badge ${sm.cls}`}>{sm.label}</span></td>
                    <td>
                      <button onClick={() => setDetail(c)}
                        style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#2563EB', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        title="View full details">
                        🔍 View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DetailModal row={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

export default Challans;

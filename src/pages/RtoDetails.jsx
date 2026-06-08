import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getScRtoData } from '../services/smartchallan.service';
import { toISTDateString } from '../utils/dateFormat';
import { useAuth } from '../context/AuthContext';

const isExpiringSoon = (d) => { if (!d) return false; const diff = new Date(d) - new Date(); return diff > 0 && diff < 30 * 86400000; };
const isExpired      = (d) => { if (!d) return false; return new Date(d) < new Date(); };
const dateMs         = (d) => d ? new Date(d).getTime() : 0;

const DateCell = ({ date }) => {
  if (!date) return <span style={{ color: '#CBD5E1' }}>—</span>;
  const expired  = isExpired(date);
  const expiring = isExpiringSoon(date);
  const color = expired ? '#DC2626' : expiring ? '#D97706' : '#059669';
  return (
    <div>
      <div style={{ fontWeight: 700, color, fontSize: '13px' }}>{toISTDateString(date)}</div>
      {expired  && <span style={{ fontSize: '10px', background: '#FEF2F2', color: '#DC2626', padding: '1px 5px', borderRadius: '2px', fontWeight: 700 }}>EXPIRED</span>}
      {expiring && <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#D97706', padding: '1px 5px', borderRadius: '2px', fontWeight: 700 }}>SOON</span>}
    </div>
  );
};

const normalise = (r) => {
  // rto_data can be a nested object with a VehicleDetails sub-key
  const vd = r.rto_data?.VehicleDetails || r.rto_data || {};
  return {
    _raw:                 r,
    id:                   r.id,
    vehicleNumber:        r.vehicle_number || r.vehicleNumber || '—',
    regDate:              vd.rc_regn_dt    || r.rc_regn_dt    || null,
    insuranceExpiry:      r.insurance_exp  || r.insuranceExpiry      || vd.rc_insurance_upto || null,
    roadTaxExpiry:        r.road_tax_exp   || r.roadTaxExpiry         || vd.rc_tax_upto       || null,
    fitnessExpiry:        r.fitness_exp    || r.fitnessExpiry         || vd.rc_fit_upto       || null,
    pollutionExpiry:      r.pollution_exp  || r.pollutionExpiry       || vd.rc_pucc_upto      || null,
    nationalPermitExpiry: r.nationalPermitExpiry || vd.permit_exp     || vd.rc_permit_exp     || null,
    statePermit:          r.state_permit   || vd.state_permit         || vd.rc_state_permit   || null,
  };
};

const EXPIRY_KEYS = ['insuranceExpiry','roadTaxExpiry','fitnessExpiry','pollutionExpiry','nationalPermitExpiry','statePermit'];
const SORT_COLS   = ['vehicleNumber','regDate','insuranceExpiry','roadTaxExpiry','fitnessExpiry','pollutionExpiry','nationalPermitExpiry','statePermit'];

const SortIcon = ({ col, sortCol, sortDir }) => {
  if (sortCol !== col) return <span style={{ color: '#CBD5E1', marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: '#2563EB', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

// Detail modal showing full raw API response
const DetailModal = ({ row, onClose }) => {
  if (!row) return null;
  const data = row._raw || row;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{row.vehicleNumber}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Full RTO Record</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {/* Key expiry fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Reg Date',       val: row.regDate, plain: true },
              { label: 'Insurance',      val: row.insuranceExpiry },
              { label: 'Road Tax',       val: row.roadTaxExpiry },
              { label: 'Fitness',        val: row.fitnessExpiry },
              { label: 'Pollution',      val: row.pollutionExpiry },
              { label: 'Nat. Permit',    val: row.nationalPermitExpiry },
              { label: 'State Permit',   val: row.statePermit },
            ].map(({ label, val, plain }) => (
              <div key={label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                {plain
                  ? <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>{val || '—'}</span>
                  : <DateCell date={val} />}
              </div>
            ))}
          </div>
          {/* Raw rto_data JSON */}
          {data.rto_data && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Raw RTO Data</div>
              <div style={{ background: '#F1F5F9', borderRadius: 8, padding: '14px', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 300, overflow: 'auto', color: '#334155', border: '1px solid #E2E8F0' }}>
                {JSON.stringify(data.rto_data, null, 2)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'expired',  label: '⚠ Expired' },
  { key: 'expiring', label: '🔔 Expiring Soon' },
  { key: 'ok',       label: '✅ Valid' },
];

// Optional columns hidden by default — user can toggle them on
const OPTIONAL_COLS = [
  { key: 'nationalPermitExpiry', label: 'National Permit' },
  { key: 'statePermit',          label: 'State Permit'    },
];

// Modal box shown when the dealer has not granted RTO permission to this client.
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
          Your dealer has not enabled <strong>RTO Details</strong> for your account.
        </div>
        <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, marginBottom: 22 }}>
          Please contact your dealer / service provider to request access to RTO and compliance data.
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

// Shown when the SmartChallan RTO service is not enabled on the user's profile.
const ServiceNotEnabledBox = ({ message }) => (
  <div style={{ maxWidth: 520, margin: '40px auto', background: '#fff', border: '1px solid #FDE68A', borderRadius: 16, padding: '32px 28px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
      <span style={{ fontSize: 30 }}>📋</span>
    </div>
    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>RTO service not enabled</div>
    <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, marginBottom: 6 }}>
      {message || 'The RTO service is not enabled on your profile.'}
    </div>
    <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, marginBottom: 22 }}>
      Go to <strong>Profile → RTO &amp; Challan</strong>, turn on the service and add your
      SmartChallan credentials to start fetching RTO data.
    </div>
    <Link
      to="/profile?tab=rto-challan"
      style={{ display: 'inline-block', padding: '10px 22px', background: '#1B2A4A', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
      Go to Profile → RTO &amp; Challan
    </Link>
  </div>
);

const RtoDetails = () => {
  const { user } = useAuth();
  const isPapa = user?.role === 'papa' || Number(user?.parentId) === 0 || Number(user?.parent_id) === 0;
  const hasPermission = isPapa || user?.permissions?.canViewRTO === true;
  const [notEnabled, setNotEnabled] = useState(false);
  const [notEnabledMsg, setNotEnabledMsg] = useState(null);

  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState('');
  const [sortCol,    setSortCol]    = useState('vehicleNumber');
  const [sortDir,    setSortDir]    = useState('asc');
  const [filter,     setFilter]     = useState('all');
  const [detail,     setDetail]     = useState(null);
  // Optional columns — hidden by default
  const [optCols,    setOptCols]    = useState(new Set());

  const toggleOptCol = (key) => setOptCols(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  useEffect(() => {
    // No dealer permission → don't call the API; the modal box is shown instead.
    if (!hasPermission) { setLoading(false); return; }
    getScRtoData()
      .then(res => {
        if (res?.success === false) throw new Error(res.message || 'API error');
        // Server returns disabled:true when SmartChallan / RTO is off on the profile.
        if (res?.disabled) { setNotEnabled(true); return; }
        setRows((Array.isArray(res?.data) ? res.data : []).map(normalise));
      })
      .catch(err => {
        const msg = err?.response?.data?.message || err?.message || 'Failed to load RTO data';
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
      list = list.filter(r => r.vehicleNumber.toLowerCase().includes(q));
    }
    if (filter === 'expired')  list = list.filter(r => EXPIRY_KEYS.some(k => isExpired(r[k])));
    if (filter === 'expiring') list = list.filter(r => !EXPIRY_KEYS.some(k => isExpired(r[k])) && EXPIRY_KEYS.some(k => isExpiringSoon(r[k])));
    if (filter === 'ok')       list = list.filter(r => !EXPIRY_KEYS.some(k => isExpired(r[k])) && !EXPIRY_KEYS.some(k => isExpiringSoon(r[k])));
    list = [...list].sort((a, b) => {
      let va = SORT_COLS.includes(sortCol) && sortCol !== 'vehicleNumber' ? dateMs(a[sortCol]) : (a[sortCol] || '');
      let vb = SORT_COLS.includes(sortCol) && sortCol !== 'vehicleNumber' ? dateMs(b[sortCol]) : (b[sortCol] || '');
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return list;
  }, [rows, search, filter, sortCol, sortDir]);

  const expired  = rows.filter(r => EXPIRY_KEYS.some(k => isExpired(r[k]))).length;
  const expiring = rows.filter(r => !EXPIRY_KEYS.some(k => isExpired(r[k])) && EXPIRY_KEYS.some(k => isExpiringSoon(r[k]))).length;

  const Th = ({ col, children }) => (
    <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {children}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );

  // No dealer permission → show the modal box and nothing else.
  if (!hasPermission) return <NoPermissionModal />;

  // SmartChallan / RTO service not enabled on the profile → guidance message.
  if (notEnabled) return <ServiceNotEnabledBox message={notEnabledMsg} />;

  return (
    <div>
      {/* Summary pills */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="stat-pill stat-pill-blue"><span style={{ fontWeight: 800, fontSize: '18px' }}>{rows.length}</span><span>Total</span></div>
          {expired > 0  && <div className="stat-pill stat-pill-red"><span style={{ fontWeight: 800, fontSize: '18px' }}>⚠ {expired}</span><span>Expired</span></div>}
          {expiring > 0 && <div className="stat-pill stat-pill-amber"><span style={{ fontWeight: 800, fontSize: '18px' }}>🔔 {expiring}</span><span>Expiring Soon</span></div>}
        </div>
      )}

      {/* Controls */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle…"
              className="form-control" style={{ paddingLeft: 30, width: 200 }} />
          </div>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-outline'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Optional column toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 8, paddingLeft: 12, borderLeft: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Show columns:</span>
            {OPTIONAL_COLS.map(c => (
              <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, color: optCols.has(c.key) ? '#2563EB' : '#64748B', fontWeight: optCols.has(c.key) ? 700 : 500, userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={optCols.has(c.key)}
                  onChange={() => toggleOptCol(c.key)}
                  style={{ accentColor: '#2563EB', width: 14, height: 14, cursor: 'pointer' }}
                />
                {c.label}
              </label>
            ))}
          </div>

          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>{displayed.length} of {rows.length} vehicles</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <span className="spinner" /> Loading RTO data…
        </div>
      ) : error ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#DC2626', marginBottom: '8px' }}>Could not load RTO data</div>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>{error}</div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>Check SmartChallan credentials in <strong>Profile → RTO &amp; Challan</strong></div>
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '15px' }}>No records found.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <Th col="vehicleNumber">Vehicle</Th>
                <Th col="regDate">Reg Date</Th>
                <Th col="insuranceExpiry">Insurance</Th>
                <Th col="roadTaxExpiry">Road Tax</Th>
                <Th col="fitnessExpiry">Fitness</Th>
                <Th col="pollutionExpiry">Pollution</Th>
                {optCols.has('nationalPermitExpiry') && <Th col="nationalPermitExpiry">Nat. Permit</Th>}
                {optCols.has('statePermit')          && <Th col="statePermit">State Permit</Th>}
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => (
                <tr key={r.id}>
                  <td><span style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>{r.vehicleNumber}</span></td>
                  <td><span style={{ fontSize: '13px', color: '#475569' }}>{r.regDate || <span style={{ color: '#CBD5E1' }}>—</span>}</span></td>
                  <td><DateCell date={r.insuranceExpiry} /></td>
                  <td><DateCell date={r.roadTaxExpiry} /></td>
                  <td><DateCell date={r.fitnessExpiry} /></td>
                  <td><DateCell date={r.pollutionExpiry} /></td>
                  {optCols.has('nationalPermitExpiry') && <td><DateCell date={r.nationalPermitExpiry} /></td>}
                  {optCols.has('statePermit')          && <td><DateCell date={r.statePermit} /></td>}
                  <td>
                    <button onClick={() => setDetail(r)}
                      style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#2563EB', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title="View full details">
                      🔍 View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailModal row={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

export default RtoDetails;

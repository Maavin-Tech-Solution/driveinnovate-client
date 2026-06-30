import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { MagnifyingGlassIcon, CheckIcon } from '@heroicons/react/24/outline';
import { getRates, setRate, formatCoins } from '../services/billing.service';

const card = { background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' };
const inputStyle = { width: 140, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#1e293b', background: '#fff', outline: 'none' };

const BillingRates = () => {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({}); // clientId -> string
  const [savingId, setSavingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRates();
      setRows(res.data || []);
      setDrafts(Object.fromEntries((res.data || []).map(r => [r.clientId, String(r.monthlyPrice)])));
    } catch (err) {
      toast.error(err.message || 'Failed to load rates');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (row) => {
    const val = Number(drafts[row.clientId]);
    if (!(val >= 0) || isNaN(val)) { toast.error('Enter a valid price (0 or more)'); return; }
    setSavingId(row.clientId);
    try {
      await setRate(row.clientId, val);
      toast.success(`Rate saved for ${row.name}`);
      setRows(rs => rs.map(r => r.clientId === row.clientId ? { ...r, monthlyPrice: val, source: 'client' } : r));
    } catch (err) {
      toast.error(err.message || 'Failed to save rate');
    } finally { setSavingId(null); }
  };

  const filtered = q.trim()
    ? rows.filter(r => r.name?.toLowerCase().includes(q.toLowerCase()) || r.email?.toLowerCase().includes(q.toLowerCase()))
    : rows;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Billing Rates</h1>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          Set the price per vehicle (1 year) for each client. This is used to value the invoice when you recharge their wallet with vehicle tokens.
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', maxWidth: 320 }}>
          <MagnifyingGlassIcon style={{ width: 16, color: '#94a3b8' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients…" style={{ border: 'none', outline: 'none', fontSize: 13.5, flex: 1 }} />
        </div>

        {filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0' }}>No clients found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '8px 10px' }}>Client</th>
                  <th style={{ padding: '8px 10px' }}>Price / vehicle / year (₹)</th>
                  <th style={{ padding: '8px 10px' }}>Source</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const dirty = String(drafts[row.clientId] ?? '') !== String(row.monthlyPrice);
                  return (
                    <tr key={row.clientId} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.email}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <input
                          type="number" min="0" step="1"
                          value={drafts[row.clientId] ?? ''}
                          onChange={e => setDrafts(d => ({ ...d, [row.clientId]: e.target.value }))}
                          style={inputStyle}
                        />
                      </td>
                      <td style={{ padding: '10px' }}>
                        {row.source === 'client'
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 10 }}>Custom</span>
                          : <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 10 }}>Network default</span>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button
                          onClick={() => save(row)}
                          disabled={!dirty || savingId === row.clientId}
                          style={{
                            padding: '7px 14px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: dirty ? '#2563eb' : '#e2e8f0', color: dirty ? '#fff' : '#94a3b8',
                            cursor: dirty ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <CheckIcon style={{ width: 14 }} /> {savingId === row.clientId ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingRates;

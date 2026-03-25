import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getChallans, payChallan, deleteChallan } from '../services/challan.service';
import { toISTDateString } from '../utils/dateFormat';

const STATUS_META = {
  pending:  { cls: 'badge-warning', label: 'Pending' },
  paid:     { cls: 'badge-success', label: 'Paid' },
  disputed: { cls: 'badge-info',    label: 'Disputed' },
  waived:   { cls: 'badge-gray',    label: 'Waived' },
};

const FILTERS = ['all', 'pending', 'paid', 'disputed', 'waived'];

const Challans = () => {
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchChallans = () => {
    setLoading(true);
    getChallans()
      .then((res) => setChallans(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(fetchChallans, []);

  const handlePay = async (id) => {
    const txnId = window.prompt('Enter transaction ID (optional):') || '';
    try {
      await payChallan(id, { transactionId: txnId });
      toast.success('Challan marked as paid');
      fetchChallans();
    } catch (err) {
      toast.error(err.message || 'Failed to update challan');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this challan record?')) return;
    try {
      await deleteChallan(id);
      toast.success('Challan deleted');
      fetchChallans();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const filtered = filter === 'all' ? challans : challans.filter((c) => c.status === filter);
  const totalPending = challans.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div>
      {/* Filter strip */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span style={{ marginLeft: '4px', opacity: 0.75, fontWeight: 400 }}>
                ({challans.filter((c) => c.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <span className="spinner" /> Loading challans…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px' }}>No challans found.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vehicle</th>
                <th>Challan No.</th>
                <th>Type</th>
                <th>Offense</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id}>
                  <td style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600 }}>{String(idx + 1).padStart(2, '0')}</td>
                  <td>
                    <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '15px', letterSpacing: '-0.01em' }}>{c.vehicleNumber}</span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', color: '#64748B' }}>{c.challanNumber}</td>
                  <td style={{ fontSize: '14px' }}>{c.challanType || '—'}</td>
                  <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px', color: '#334155' }}>
                    {c.offense || '—'}
                  </td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: '16px', color: c.status === 'paid' ? '#059669' : '#DC2626', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{Number(c.amount).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td style={{ fontSize: '13.5px', color: '#64748B' }}>{toISTDateString(c.challanDate)}</td>
                  <td style={{ fontSize: '13.5px', color: '#64748B' }}>{toISTDateString(c.dueDate)}</td>
                  <td>
                    <span className={`badge ${(STATUS_META[c.status] || STATUS_META.pending).cls}`}>
                      {(STATUS_META[c.status] || STATUS_META.pending).label}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {c.status === 'pending' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handlePay(c.id)}>
                          💳 Pay
                        </button>
                      )}
                      <button className="btn btn-sm btn-outline" onClick={() => handleDelete(c.id)} style={{ color: '#DC2626', borderColor: '#FECACA' }}>
                        ✕ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Challans;

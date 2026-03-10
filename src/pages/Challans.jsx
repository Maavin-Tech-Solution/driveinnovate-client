import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getChallans, payChallan, deleteChallan } from '../services/challan.service';
import { toISTDateString } from '../utils/dateFormat';

const statusBadge = {
  pending: 'badge-warning',
  paid: 'badge-success',
  disputed: 'badge-info',
  waived: 'badge-gray',
};

const formatDate = (d) => toISTDateString(d);

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
      <div className="page-header">
        <div>
          <h2 className="page-title">Challans</h2>
          <p className="page-subtitle">
            {challans.length} total · Pending dues: ₹{totalPending.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'pending', 'paid', 'disputed', 'waived'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                  ({challans.filter((c) => c.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading challans...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>No challans found.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vehicle No.</th>
                  <th>Challan Number</th>
                  <th>Challan Type</th>
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
                    <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e3a5f' }}>{c.vehicleNumber}</span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{c.challanNumber}</td>
                    <td>{c.challanType}</td>
                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.offense || '—'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: c.status === 'paid' ? '#10b981' : '#ef4444' }}>
                        ₹{Number(c.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>{formatDate(c.challanDate)}</td>
                    <td>{formatDate(c.dueDate)}</td>
                    <td>
                      <span className={`badge ${statusBadge[c.status] || 'badge-gray'}`}>{c.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {c.status === 'pending' && (
                          <button className="btn btn-sm btn-primary" onClick={() => handlePay(c.id)} title="Mark as paid">
                            💳 Pay
                          </button>
                        )}
                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(c.id)} title="Delete">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Challans;

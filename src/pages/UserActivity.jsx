import React, { useEffect, useState } from 'react';
import { getActivities } from '../services/activity.service';
import { toISTString } from '../utils/dateFormat';

const statusBadge = { success: 'badge-success', failure: 'badge-danger' };

const formatDate = (d) => toISTString(d);

const UserActivity = () => {
  const [data, setData] = useState({ activities: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    getActivities({ page, limit: 20 })
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const { activities, pagination } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">User Activity</h2>
          <p className="page-subtitle">Action log & audit trail for your account</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ borderRadius: '12px', border: 'none' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading activity...</div>
          ) : activities.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>No activity recorded yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Description</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a, idx) => (
                  <tr key={a.id}>
                    <td style={{ color: '#94a3b8' }}>{(page - 1) * 20 + idx + 1}</td>
                    <td>
                      <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#1e3a5f' }}>
                        {a.action}
                      </code>
                    </td>
                    <td>{a.module || '—'}</td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569' }}>
                      {a.description || '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                      {a.ipAddress || '—'}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge[a.status] || 'badge-gray'}`}>{a.status}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatDate(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total} records
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <button
                className="btn btn-outline btn-sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserActivity;

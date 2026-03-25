import React, { useEffect, useState } from 'react';
import { getActivities } from '../services/activity.service';
import { toISTString } from '../utils/dateFormat';

const STATUS_META = {
  success: { cls: 'badge-success', label: 'Success' },
  failure: { cls: 'badge-danger',  label: 'Failed' },
};

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
      {pagination?.total && (
        <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, marginBottom: '16px' }}>
          {pagination.total} total records
        </div>
      )}

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <span className="spinner" /> Loading activity…
        </div>
      ) : activities.length === 0 ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px' }}>No activity recorded yet.</div>
      ) : (
        <>
          <div className="table-container">
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
                  <tr key={a.id || idx}>
                    <td style={{ color: '#94A3B8', fontWeight: 600 }}>{String(idx + 1 + (page - 1) * 20).padStart(2, '0')}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>{a.action}</span>
                    </td>
                    <td>
                      <span style={{ background: '#F1F5F9', color: '#475569', padding: '3px 9px', borderRadius: '2px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {a.module}
                      </span>
                    </td>
                    <td style={{ maxWidth: '240px', color: '#334155' }}>{a.description || '—'}</td>
                    <td style={{ fontFamily: 'monospace', color: '#64748B' }}>{a.ipAddress || '—'}</td>
                    <td>
                      <span className={`badge ${(STATUS_META[a.status] || STATUS_META.success).cls}`}>
                        {(STATUS_META[a.status] || STATUS_META.success).label}
                      </span>
                    </td>
                    <td style={{ color: '#64748B', whiteSpace: 'nowrap' }}>{toISTString(a.createdAt || a.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination?.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>
                Page {page} of {pagination.totalPages}
              </span>
              <button
                className="btn btn-outline btn-sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserActivity;

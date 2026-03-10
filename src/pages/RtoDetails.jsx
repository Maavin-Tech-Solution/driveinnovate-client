import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getRtoDetails } from '../services/rto.service';
import { toISTDateString } from '../utils/dateFormat';

const isExpiringSoon = (dateStr) => {
  if (!dateStr) return false;
  const diff = new Date(dateStr) - new Date();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
};

const isExpired = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return toISTDateString(dateStr);
};

const DateCell = ({ date }) => {
  if (!date) return <span style={{ color: '#94a3b8' }}>—</span>;
  const expired = isExpired(date);
  const expiring = isExpiringSoon(date);
  return (
    <span style={{ color: expired ? '#ef4444' : expiring ? '#f59e0b' : '#10b981', fontWeight: 500 }}>
      {formatDate(date)}
      {expired && ' ⚠️'} {expiring && ' 🔔'}
    </span>
  );
};

const RtoDetails = () => {
  const [rtoList, setRtoList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRtoDetails()
      .then((res) => setRtoList(res.data || []))
      .catch((err) => toast.error(err.message || 'Failed to load RTO details'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">RTO Details</h2>
          <p className="page-subtitle">Insurance, fitness & compliance records for your fleet</p>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { color: '#ef4444', label: 'Expired' },
          { color: '#f59e0b', label: 'Expiring within 30 days' },
          { color: '#10b981', label: 'Valid' },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, display: 'inline-block' }} />
            {l.label}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ borderRadius: '12px', border: 'none' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading RTO data...</div>
          ) : rtoList.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
              No RTO details found. Add vehicle compliance data via the API.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Vehicle No.</th>
                  <th>Owner Name</th>
                  <th>Body Type</th>
                  <th>Insurance Expiry</th>
                  <th>Road Tax Expiry</th>
                  <th>Fitness Expiry</th>
                  <th>Pollution Expiry</th>
                  <th>Nat. Permit Expiry</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rtoList.map((rto) => (
                  <tr key={rto.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e3a5f' }}>
                        {rto.vehicle?.vehicleNumber || rto.vehicleNumber}
                      </span>
                    </td>
                    <td>{rto.ownerName || '—'}</td>
                    <td>{rto.bodyType || '—'}</td>
                    <td><DateCell date={rto.insuranceExpiry} /></td>
                    <td><DateCell date={rto.roadTaxExpiry} /></td>
                    <td><DateCell date={rto.fitnessExpiry} /></td>
                    <td><DateCell date={rto.pollutionExpiry} /></td>
                    <td><DateCell date={rto.nationalPermitExpiry} /></td>
                    <td>
                      <button className="btn btn-outline btn-sm">✏️ Edit</button>
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

export default RtoDetails;

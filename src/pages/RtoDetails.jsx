import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getRtoDetails } from '../services/rto.service';
import { toISTDateString } from '../utils/dateFormat';
import ServiceGate from '../components/common/ServiceGate';

const RTO_ENABLED = import.meta.env.VITE_RTO_SERVICE_ENABLED !== 'false';
const RTO_MSG     = import.meta.env.VITE_RTO_UNAVAILABLE_MSG;

const isExpiringSoon = (d) => { if (!d) return false; const diff = new Date(d) - new Date(); return diff > 0 && diff < 30 * 86400000; };
const isExpired = (d) => { if (!d) return false; return new Date(d) < new Date(); };

const DateCell = ({ date }) => {
  if (!date) return <span style={{ color: '#CBD5E1' }}>—</span>;
  const expired = isExpired(date);
  const expiring = isExpiringSoon(date);
  const color = expired ? '#DC2626' : expiring ? '#D97706' : '#059669';
  return (
    <div>
      <div style={{ fontWeight: 700, color, fontSize: '14px' }}>{toISTDateString(date)}</div>
      {expired  && <div style={{ fontSize: '11px', background: '#FEF2F2', color: '#DC2626', display: 'inline-block', padding: '1px 6px', borderRadius: '2px', marginTop: '3px', fontWeight: 700 }}>EXPIRED</div>}
      {expiring && <div style={{ fontSize: '11px', background: '#FEF3C7', color: '#D97706', display: 'inline-block', padding: '1px 6px', borderRadius: '2px', marginTop: '3px', fontWeight: 700 }}>EXPIRING SOON</div>}
    </div>
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

  const expired  = rtoList.filter(r => ['insuranceExpiry','roadTaxExpiry','fitnessExpiry','pollutionExpiry','nationalPermitExpiry'].some(k => isExpired(r[k]))).length;
  const expiring = rtoList.filter(r => ['insuranceExpiry','roadTaxExpiry','fitnessExpiry','pollutionExpiry','nationalPermitExpiry'].some(k => isExpiringSoon(r[k]))).length;

  return (
    <ServiceGate enabled={RTO_ENABLED} message={RTO_MSG} serviceName="RTO Details" icon="🚦">
    <div>
      {/* Summary pills */}
      {rtoList.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="stat-pill stat-pill-blue">
            <span style={{ fontWeight: 800, fontSize: '18px' }}>{rtoList.length}</span>
            <span>Total Vehicles</span>
          </div>
          {expired > 0 && (
            <div className="stat-pill stat-pill-red">
              <span style={{ fontWeight: 800, fontSize: '18px' }}>⚠ {expired}</span>
              <span>Expired Documents</span>
            </div>
          )}
          {expiring > 0 && (
            <div className="stat-pill stat-pill-amber">
              <span style={{ fontWeight: 800, fontSize: '18px' }}>🔔 {expiring}</span>
              <span>Expiring in 30 Days</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <span className="spinner" /> Loading RTO data…
        </div>
      ) : rtoList.length === 0 ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', fontSize: '15px' }}>No RTO details found.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Owner</th>
                <th>Body Type</th>
                <th>Insurance</th>
                <th>Road Tax</th>
                <th>Fitness</th>
                <th>Pollution</th>
                <th>Nat. Permit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rtoList.map((rto) => (
                <tr key={rto.id}>
                  <td>
                    <span style={{ fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
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
        </div>
      )}
    </div>
    </ServiceGate>
  );
};

export default RtoDetails;

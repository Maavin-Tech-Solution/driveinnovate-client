import React, { useState } from 'react';
import api from '../services/api';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—';
const ago = (d) => {
  if (!d) return '—';
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86400000);
  const hrs  = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hrs}h ago`;
  if (hrs > 0)  return `${hrs}h ${mins}m ago`;
  return `${mins}m ago`;
};

const TAG = ({ color, children }) => (
  <span style={{
    background: color + '22', color, border: `1px solid ${color}55`,
    borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 700,
  }}>{children}</span>
);

const Card = ({ title, children, accent = '#3B82F6' }) => (
  <div style={{
    background: '#fff', borderRadius: 10, border: `1px solid #e5e7eb`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16, overflow: 'hidden',
  }}>
    <div style={{ background: accent, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 13 }}>
      {title}
    </div>
    <div style={{ padding: 16 }}>{children}</div>
  </div>
);

const Row = ({ label, value, highlight }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
    <span style={{ color: '#6b7280', fontSize: 12, width: 180, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: highlight || '#111827', wordBreak: 'break-all' }}>{value ?? '—'}</span>
  </div>
);

// ── Packet type breakdown table ───────────────────────────────────────────────
const TypeBreakdown = ({ rows }) => {
  if (!rows?.length) return <div style={{ color: '#9ca3af', fontSize: 12 }}>No data for last 7 days</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {['Packet Type', 'Count', 'Has GPS', 'Has ACC', 'Avg Speed'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: r.hasGps > 0 ? '#f0fdf4' : undefined }}>
              <td style={{ padding: '5px 10px', fontWeight: 600 }}>{r._id}</td>
              <td style={{ padding: '5px 10px' }}>{r.count}</td>
              <td style={{ padding: '5px 10px', color: r.hasGps > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{r.hasGps} / {r.count}</td>
              <td style={{ padding: '5px 10px', color: r.hasAcc > 0 ? '#2563eb' : '#9ca3af' }}>{r.hasAcc}</td>
              <td style={{ padding: '5px 10px' }}>{r.avgSpeed != null ? `${r.avgSpeed.toFixed(1)} km/h` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Recent packets table ──────────────────────────────────────────────────────
const RecentPackets = ({ packets }) => {
  if (!packets?.length) return <div style={{ color: '#9ca3af', fontSize: 12 }}>No recent packets</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {['Timestamp (IST)', 'Type', 'lat', 'lng', 'acc', 'speed', 'IMEI'].map(h => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {packets.map((p, i) => {
            const hasGps = p.lat != null && p.lat > 0;
            return (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: hasGps ? '#f0fdf4' : undefined }}>
                <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{fmt(p.timestamp)}</td>
                <td style={{ padding: '4px 8px', fontWeight: 600, color: '#374151' }}>{p.packetType}</td>
                <td style={{ padding: '4px 8px', color: hasGps ? '#16a34a' : '#9ca3af' }}>{p.lat ?? '—'}</td>
                <td style={{ padding: '4px 8px', color: hasGps ? '#16a34a' : '#9ca3af' }}>{p.lng ?? '—'}</td>
                <td style={{ padding: '4px 8px', color: p.acc != null ? '#2563eb' : '#9ca3af', fontWeight: 700 }}>{p.acc ?? '—'}</td>
                <td style={{ padding: '4px 8px' }}>{p.speed ?? '—'}</td>
                <td style={{ padding: '4px 8px', color: '#9ca3af', fontSize: 10 }}>{p.imei}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── Daily packet bar chart (text-based) ──────────────────────────────────────
const PacketTimeline = ({ counts }) => {
  if (!counts?.length) return <div style={{ color: '#9ca3af', fontSize: 12 }}>No packets found</div>;
  const max = Math.max(...counts.map(c => c.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 300, overflowY: 'auto' }}>
      {counts.map(({ _id, count, imei }) => {
        const pct = Math.round((count / max) * 100);
        const isRecent = new Date(_id) >= new Date(Date.now() - 3 * 86400000);
        return (
          <div key={_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 90, fontSize: 11, color: isRecent ? '#16a34a' : '#6b7280', fontWeight: isRecent ? 700 : 400 }}>{_id}</span>
            <div style={{ flex: 1, height: 14, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: isRecent ? '#16a34a' : '#3B82F6', borderRadius: 3 }} />
            </div>
            <span style={{ width: 50, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>{count}</span>
            <span style={{ width: 130, fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imei}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── DIAGNOSIS TAB ─────────────────────────────────────────────────────────────
const DiagnosisTab = () => {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reprocess state
  const [rpFrom, setRpFrom] = useState('');
  const [rpTo, setRpTo] = useState('');
  const [rpLoading, setRpLoading] = useState(false);
  const [rpResult, setRpResult] = useState(null);

  const fetchStatus = async () => {
    if (!vehicleNumber.trim()) return;
    setLoading(true); setError(''); setStatus(null); setRpResult(null);
    try {
      const res = await api.get(`/debug/vehicle-status?vehicleNumber=${vehicleNumber.trim().toUpperCase()}`);
      setStatus(res.data || res);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
    setLoading(false);
  };

  const runReprocess = async () => {
    if (!status?.vehicle?.id || !rpFrom || !rpTo) return;
    setRpLoading(true); setRpResult(null);
    try {
      const res = await api.post(`/vehicles/${status.vehicle.id}/reports/reprocess`, { from: rpFrom, to: rpTo });
      setRpResult(res.data || res);
    } catch (e) {
      setRpResult({ error: e.response?.data?.message || e.message });
    }
    setRpLoading(false);
  };

  const d = status;

  // Determine diagnosis verdict
  const getVerdict = () => {
    if (!d) return null;
    const mongoGt06Latest  = d.mongo?.gt06locations?.latestPacket?.timestamp;
    const mongoFmbLatest   = d.mongo?.fmb125locations?.latestPacket?.timestamp;
    const mongoLatest      = [mongoGt06Latest, mongoFmbLatest].filter(Boolean).sort().pop();
    const mysqlLast        = d.deviceState?.lastPacketTime;

    if (!mongoLatest) return { color: '#dc2626', icon: '✗', text: 'No MongoDB packets found for this IMEI. Device may be offline or IMEI mismatch.' };

    const mongoMs = new Date(mongoLatest).getTime();
    const mysqlMs = mysqlLast ? new Date(mysqlLast).getTime() : 0;
    const diffDays = Math.floor((mongoMs - mysqlMs) / 86400000);

    if (diffDays > 1) return {
      color: '#d97706', icon: '⚠',
      text: `MongoDB has ${diffDays}d of unprocessed packets (latest: ${fmtDate(mongoLatest)}). MySQL last processed: ${fmtDate(mysqlLast)}. Run reprocess to backfill.`,
    };

    const staleDays = Math.floor((Date.now() - mongoMs) / 86400000);
    if (staleDays > 1) return { color: '#dc2626', icon: '✗', text: `Device stopped transmitting ${staleDays} days ago (last MongoDB packet: ${fmtDate(mongoLatest)}). Check device/SIM.` };

    return { color: '#16a34a', icon: '✓', text: `Live and processed. Last MongoDB packet: ${fmt(mongoLatest)}` };
  };

  const verdict = getVerdict();

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={vehicleNumber}
          onChange={e => setVehicleNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchStatus()}
          placeholder="Vehicle number (e.g. HR26DC9709)"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }}
        />
        <button
          onClick={fetchStatus}
          disabled={loading || !vehicleNumber.trim()}
          style={{ padding: '8px 20px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}
        >
          {loading ? 'Checking...' : 'Diagnose'}
        </button>
      </div>

      {error && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '10px 14px', marginBottom: 16 }}>{error}</div>}

      {d && (
        <>
          {/* Verdict */}
          {verdict && (
            <div style={{ background: verdict.color + '11', border: `1px solid ${verdict.color}44`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: verdict.color }}>{verdict.icon}</span>
              <span style={{ fontSize: 13, color: verdict.color, fontWeight: 600 }}>{verdict.text}</span>
            </div>
          )}

          {/* Vehicle */}
          <Card title="Vehicle (MySQL)" accent="#1e40af">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              <Row label="ID" value={d.vehicle.id} />
              <Row label="Vehicle Number" value={d.vehicle.vehicleNumber} />
              <Row label="IMEI (stored)" value={d.vehicle.imei} />
              <Row label="IMEI variants searched" value={d.imeiVariants?.join(', ')} />
              <Row label="Device Type" value={d.vehicle.deviceType || '—'} />
              <Row label="Status" value={<TAG color={d.vehicle.status === 'active' ? '#16a34a' : '#dc2626'}>{d.vehicle.status || 'unknown'}</TAG>} />
            </div>
          </Card>

          {/* Device State */}
          <Card title="Live State (VehicleDeviceState — MySQL)" accent="#7c3aed">
            {d.deviceState ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <Row label="Last packet (MySQL)" value={fmt(d.deviceState.lastPacketTime)} highlight={d.deviceState.lastPacketTime ? '#111' : '#dc2626'} />
                <Row label="Last packet age" value={ago(d.deviceState.lastPacketTime)} />
                <Row label="Engine on" value={d.deviceState.engineOn ? <TAG color="#16a34a">YES</TAG> : <TAG color="#6b7280">NO</TAG>} />
                <Row label="Last speed" value={d.deviceState.lastSpeed != null ? `${d.deviceState.lastSpeed} km/h` : '—'} />
                <Row label="Last position" value={d.deviceState.lastLat ? `${d.deviceState.lastLat}, ${d.deviceState.lastLng}` : '—'} />
                <Row label="Active trip ID" value={d.deviceState.currentTripId || 'none'} />
              </div>
            ) : (
              <div style={{ color: '#dc2626', fontSize: 13 }}>No VehicleDeviceState row found — vehicle has never been processed.</div>
            )}
          </Card>

          {/* MySQL trips */}
          <Card title="MySQL Trips" accent="#0891b2">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              <Row label="Total trips stored" value={d.mysql.totalTrips} />
              <Row label="Latest trip start" value={fmt(d.mysql.lastTrip?.startTime)} />
              <Row label="Latest trip end" value={fmt(d.mysql.lastTrip?.endTime)} />
              <Row label="Latest trip distance" value={d.mysql.lastTrip?.distanceKm != null ? `${d.mysql.lastTrip.distanceKm} km` : '—'} />
            </div>
          </Card>

          {/* MongoDB — GT06 */}
          <Card title="MongoDB — gt06locations" accent="#059669">
            {d.mongo?.gt06locations ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 12 }}>
                  <Row label="Total packets" value={d.mongo.gt06locations.totalCount?.toLocaleString()} />
                  <Row label="Latest packet (any type)" value={fmt(d.mongo.gt06locations.latestPacket?.timestamp)} highlight={d.mongo.gt06locations.latestPacket ? '#111' : '#dc2626'} />
                  <Row label="Latest packet IMEI" value={d.mongo.gt06locations.latestPacket?.imei || '—'} />
                  <Row label="Latest packet type" value={d.mongo.gt06locations.latestPacket?.packetType || '—'} />
                  <Row label="Latest acc / speed"
                    value={d.mongo.gt06locations.latestPacket
                      ? `acc=${d.mongo.gt06locations.latestPacket.acc ?? 'N/A'}, speed=${d.mongo.gt06locations.latestPacket.speed ?? 'N/A'} km/h`
                      : '—'} />
                  <Row label="Latest GPS packet"
                    value={d.mongo.gt06locations.latestGpsPacket
                      ? `${fmt(d.mongo.gt06locations.latestGpsPacket.timestamp)} — ${d.mongo.gt06locations.latestGpsPacket.lat}, ${d.mongo.gt06locations.latestGpsPacket.lng}`
                      : <span style={{ color: '#dc2626' }}>No GPS packets found</span>} />
                </div>

                <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 6, marginTop: 8 }}>Packet Type Breakdown (last 7 days)</div>
                <TypeBreakdown rows={d.mongo.gt06locations.typeBreakdown} />

                <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 6, marginTop: 14 }}>Last 10 Packets</div>
                <RecentPackets packets={d.mongo.gt06locations.recentPackets} />

                <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 8, marginTop: 14 }}>Daily Packet Counts (last 45 days)</div>
                <PacketTimeline counts={d.mongo.gt06locations.dailyCounts} />
              </>
            ) : <div style={{ color: '#9ca3af', fontSize: 12 }}>Not available</div>}
          </Card>

          {/* MongoDB — FMB125 */}
          <Card title="MongoDB — fmb125locations" accent="#d97706">
            {d.mongo?.fmb125locations ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 12 }}>
                  <Row label="Total packets" value={d.mongo.fmb125locations.totalCount?.toLocaleString()} />
                  <Row label="Latest packet (any type)" value={fmt(d.mongo.fmb125locations.latestPacket?.timestamp)} />
                  <Row label="Latest packet IMEI" value={d.mongo.fmb125locations.latestPacket?.imei || '—'} />
                  <Row label="Latest packet type" value={d.mongo.fmb125locations.latestPacket?.packetType || '—'} />
                  <Row label="Latest GPS packet"
                    value={d.mongo.fmb125locations.latestGpsPacket
                      ? `${fmt(d.mongo.fmb125locations.latestGpsPacket.timestamp)} — ${d.mongo.fmb125locations.latestGpsPacket.lat}, ${d.mongo.fmb125locations.latestGpsPacket.lng}`
                      : <span style={{ color: '#dc2626' }}>No GPS packets found</span>} />
                </div>

                <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 6, marginTop: 8 }}>Packet Type Breakdown (last 7 days)</div>
                <TypeBreakdown rows={d.mongo.fmb125locations.typeBreakdown} />

                <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 6, marginTop: 14 }}>Last 10 Packets</div>
                <RecentPackets packets={d.mongo.fmb125locations.recentPackets} />

                <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 8, marginTop: 14 }}>Daily Packet Counts (last 45 days)</div>
                <PacketTimeline counts={d.mongo.fmb125locations.dailyCounts} />
              </>
            ) : <div style={{ color: '#9ca3af', fontSize: 12 }}>Not available</div>}
          </Card>

          {/* Reprocess */}
          <Card title="Reprocess (backfill MySQL from MongoDB)" accent="#dc2626">
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              Deletes existing trips/sessions/stops for the date range and rebuilds from raw MongoDB packets.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, color: '#374151' }}>From</label>
              <input type="date" value={rpFrom} onChange={e => setRpFrom(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
              <label style={{ fontSize: 12, color: '#374151' }}>To</label>
              <input type="date" value={rpTo} onChange={e => setRpTo(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
              <button
                onClick={runReprocess}
                disabled={rpLoading || !rpFrom || !rpTo}
                style={{ padding: '7px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}
              >
                {rpLoading ? 'Running...' : 'Reprocess'}
              </button>
            </div>
            {rpResult && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 7,
                background: rpResult.error ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${rpResult.error ? '#fca5a5' : '#86efac'}`,
                fontSize: 13, color: rpResult.error ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                {rpResult.error ? `Error: ${rpResult.error}` : `Done — ${rpResult.data?.processed ?? 0} packets processed`}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

// ── RAW PACKETS TAB ───────────────────────────────────────────────────────────
const RawPacketsTab = () => {
  const [imei, setImei] = useState('');
  const [deviceType, setDeviceType] = useState('gt06');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const handleFetch = async (append = false) => {
    setLoading(true);
    try {
      const res = await api.get(`/debug/data-packets?imei=${imei}&deviceType=${deviceType}&limit=20&skip=${append ? skip : 0}`);
      const packets = Array.isArray(res) ? res : [];
      if (append) setData(prev => [...prev, ...packets]);
      else setData(packets);
      setHasMore(packets.length === 20);
      setSkip(prev => append ? prev + packets.length : packets.length);
    } catch {
      setData([]); setHasMore(false);
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={imei} onChange={e => setImei(e.target.value)}
          placeholder="IMEI"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }} />
        <select value={deviceType} onChange={e => setDeviceType(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }}>
          <option value="gt06">GT06</option>
          <option value="fmb125">FMB125</option>
        </select>
        <button onClick={() => { setSkip(0); handleFetch(false); }} disabled={loading || !imei}
          style={{ padding: '8px 18px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Fetch'}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Date (IST)', 'IMEI', 'acc', 'speed', 'lat', 'lng', 'Full Data'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{fmt(row.date)}</td>
                <td style={{ padding: '6px 10px' }}>{row.data?.imei || row.imei}</td>
                <td style={{ padding: '6px 10px' }}>{String(row.data?.acc ?? '—')}</td>
                <td style={{ padding: '6px 10px' }}>{row.data?.speed ?? '—'}</td>
                <td style={{ padding: '6px 10px' }}>{row.data?.latitude ?? '—'}</td>
                <td style={{ padding: '6px 10px' }}>{row.data?.longitude ?? '—'}</td>
                <td style={{ padding: '6px 10px' }}>
                  <details><summary style={{ cursor: 'pointer', color: '#3B82F6' }}>show</summary>
                    <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: 400 }}>{JSON.stringify(row.data, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && !loading && data.length > 0 && (
        <button onClick={() => handleFetch(true)} style={{ marginTop: 12, padding: '7px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
          Load More
        </button>
      )}
      {loading && <div style={{ marginTop: 12, color: '#6b7280' }}>Loading…</div>}
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
const Debug = () => {
  const [tab, setTab] = useState('diagnosis');

  const tabStyle = (active) => ({
    padding: '8px 20px', borderRadius: '8px 8px 0 0', border: '1px solid #e5e7eb',
    borderBottom: active ? '1px solid #fff' : '1px solid #e5e7eb',
    background: active ? '#fff' : '#f9fafb', cursor: 'pointer',
    fontWeight: active ? 700 : 500, fontSize: 13, color: active ? '#1d4ed8' : '#6b7280',
    marginRight: 4,
  });

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, color: '#111827' }}>Debug Console</h2>
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        <button style={tabStyle(tab === 'diagnosis')} onClick={() => setTab('diagnosis')}>Vehicle Diagnosis</button>
        <button style={tabStyle(tab === 'packets')} onClick={() => setTab('packets')}>Raw Packets</button>
      </div>
      {tab === 'diagnosis' ? <DiagnosisTab /> : <RawPacketsTab />}
    </div>
  );
};

export default Debug;

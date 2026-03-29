import React, { useState, useEffect } from 'react';
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

// ── PACKET EXPLORER TAB ───────────────────────────────────────────────────────
const LIMIT = 20;

const inputSt = { padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' };
const labelSt = { fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 3, display: 'block' };
const FilterGroup = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span style={labelSt}>{label}</span>
    {children}
  </div>
);

const PacketExplorer = () => {
  // ── vehicle list ──────────────────────────────────────────────────────────
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [deviceType, setDeviceType] = useState('fmb125');

  useEffect(() => {
    api.get('/vehicles')
      .then(res => setVehicles(Array.isArray(res) ? res : (res.data ?? [])))
      .catch(() => {});
  }, []);

  const handleVehicleChange = (e) => {
    const vid = e.target.value;
    setVehicleId(vid);
    if (vid) {
      const v = vehicles.find(x => String(x.id) === vid);
      if (v?.deviceType) setDeviceType(v.deviceType);
    }
  };

  // ── filters ───────────────────────────────────────────────────────────────
  // Default: today IST 00:00 → now
  const todayIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);
    return ist.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const [from, setFrom]           = useState(todayIST() + 'T00:00');
  const [to,   setTo]             = useState('');
  const [packetType, setPacketType] = useState('');
  const [acc,      setAcc]        = useState('any');
  const [hasGps,   setHasGps]     = useState('any');
  const [minSpeed, setMinSpeed]   = useState('');
  const [maxSpeed, setMaxSpeed]   = useState('');
  const [hasBattery, setHasBattery] = useState('any');

  // ── results ───────────────────────────────────────────────────────────────
  const [data,    setData]    = useState([]);
  const [skip,    setSkip]    = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [totalHint, setTotalHint] = useState(null);

  const buildParams = (skipVal) => {
    const p = new URLSearchParams();
    if (vehicleId) p.set('vehicleId', vehicleId);
    else           p.set('deviceType', deviceType);
    if (from)        p.set('from', from);
    if (to)          p.set('to',   to);
    if (packetType)  p.set('packetType', packetType);
    if (acc !== 'any')        p.set('acc',        acc);
    if (hasGps !== 'any')     p.set('hasGps',     hasGps);
    if (minSpeed !== '')      p.set('minSpeed',   minSpeed);
    if (maxSpeed !== '')      p.set('maxSpeed',   maxSpeed);
    if (hasBattery !== 'any') p.set('hasBattery', hasBattery);
    p.set('limit', String(LIMIT));
    p.set('skip',  String(skipVal));
    return p.toString();
  };

  const handleFetch = async (append = false) => {
    if (!vehicleId) { setError('Select a vehicle first'); return; }
    setLoading(true); setError('');
    const currentSkip = append ? skip : 0;
    try {
      const res = await api.get(`/debug/data-packets?${buildParams(currentSkip)}`);
      const packets = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);
      if (append) {
        setData(prev => [...prev, ...packets]);
      } else {
        setData(packets);
        setTotalHint(null);
      }
      const newSkip = currentSkip + packets.length;
      setSkip(newSkip);
      setHasMore(packets.length === LIMIT);
      if (!append) setTotalHint(packets.length < LIMIT ? packets.length : `${packets.length}+`);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      if (!append) { setData([]); setHasMore(false); }
    }
    setLoading(false);
  };

  const cols = ['Timestamp (IST)', 'Type', 'lat', 'lng', 'acc', 'speed', 'battery', 'IMEI', 'Full JSON'];

  return (
    <div>
      {/* ── Filter panel ── */}
      <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        {/* Row 1: vehicle + device type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
          <FilterGroup label="Vehicle">
            <select value={vehicleId} onChange={handleVehicleChange} style={{ ...inputSt, width: '100%' }}>
              <option value="">— Select vehicle —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber}{v.deviceType ? ` (${v.deviceType.toUpperCase()})` : ''}{v.imei ? ` — ${v.imei}` : ''}
                </option>
              ))}
            </select>
          </FilterGroup>
          <FilterGroup label="Device Type">
            <select value={deviceType} onChange={e => setDeviceType(e.target.value)} style={inputSt}>
              <option value="fmb125">FMB125</option>
              <option value="gt06">GT06</option>
            </select>
          </FilterGroup>
        </div>

        {/* Row 2: date range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <FilterGroup label="From (IST)">
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} style={inputSt} />
          </FilterGroup>
          <FilterGroup label="To (IST — leave blank for now)">
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} style={inputSt} />
          </FilterGroup>
        </div>

        {/* Row 3: packet type + attribute filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
          <FilterGroup label="Packet Type">
            <input value={packetType} onChange={e => setPacketType(e.target.value)}
              placeholder="e.g. location" style={inputSt} />
          </FilterGroup>
          <FilterGroup label="ACC / Engine">
            <select value={acc} onChange={e => setAcc(e.target.value)} style={inputSt}>
              <option value="any">Any</option>
              <option value="true">On (true)</option>
              <option value="false">Off (false)</option>
            </select>
          </FilterGroup>
          <FilterGroup label="Has GPS">
            <select value={hasGps} onChange={e => setHasGps(e.target.value)} style={inputSt}>
              <option value="any">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FilterGroup>
          <FilterGroup label="Min Speed (km/h)">
            <input type="number" value={minSpeed} onChange={e => setMinSpeed(e.target.value)}
              placeholder="0" style={inputSt} />
          </FilterGroup>
          <FilterGroup label="Max Speed (km/h)">
            <input type="number" value={maxSpeed} onChange={e => setMaxSpeed(e.target.value)}
              placeholder="—" style={inputSt} />
          </FilterGroup>
          <FilterGroup label="Battery present">
            <select value={hasBattery} onChange={e => setHasBattery(e.target.value)} style={inputSt}>
              <option value="any">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FilterGroup>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => handleFetch(false)}
            disabled={loading || !vehicleId}
            style={{ padding: '8px 22px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {loading && !data.length ? 'Loading…' : 'Fetch Packets'}
          </button>
          {totalHint !== null && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Showing {data.length} packet{data.length !== 1 ? 's' : ''}
              {hasMore ? ' (more available)' : ''}
            </span>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Results table ── */}
      {data.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                {cols.map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const d = row.data || {};
                const hasGpsRow = d.latitude > 0 && d.longitude;
                const accOn = d.acc === true;
                const accOff = d.acc === false;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: hasGpsRow ? '#f0fdf4' : undefined }}>
                    <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>{fmt(row.date)}</td>
                    <td style={{ padding: '5px 10px', fontWeight: 600, color: '#374151' }}>{d.packetType || '—'}</td>
                    <td style={{ padding: '5px 10px', color: hasGpsRow ? '#16a34a' : '#9ca3af' }}>{d.latitude ?? '—'}</td>
                    <td style={{ padding: '5px 10px', color: hasGpsRow ? '#16a34a' : '#9ca3af' }}>{d.longitude ?? '—'}</td>
                    <td style={{ padding: '5px 10px', fontWeight: 700, color: accOn ? '#16a34a' : accOff ? '#dc2626' : '#9ca3af' }}>
                      {d.acc === true ? 'ON' : d.acc === false ? 'OFF' : d.acc ?? '—'}
                    </td>
                    <td style={{ padding: '5px 10px' }}>{d.speed != null ? `${d.speed} km/h` : '—'}</td>
                    <td style={{ padding: '5px 10px', color: d.battery != null ? '#2563eb' : '#9ca3af' }}>{d.battery ?? '—'}</td>
                    <td style={{ padding: '5px 10px', color: '#9ca3af', fontSize: 10 }}>{d.imei || row.imei}</td>
                    <td style={{ padding: '5px 10px' }}>
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#3B82F6', fontSize: 11 }}>show</summary>
                        <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: 420, marginTop: 4, background: '#f9fafb', padding: 8, borderRadius: 5 }}>
                          {JSON.stringify(d, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !loading && (
        <button
          onClick={() => handleFetch(true)}
          style={{ marginTop: 12, padding: '7px 18px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
          Load More ({data.length} loaded)
        </button>
      )}
      {loading && data.length > 0 && <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Loading more…</div>}
      {!loading && !data.length && totalHint === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No packets match the current filters.</div>
      )}
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
        <button style={tabStyle(tab === 'packets')} onClick={() => setTab('packets')}>Packet Explorer</button>
      </div>
      {tab === 'diagnosis' ? <DiagnosisTab /> : <PacketExplorer />}
    </div>
  );
};

export default Debug;

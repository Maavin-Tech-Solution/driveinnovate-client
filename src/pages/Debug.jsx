import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getClientTree } from '../services/user.service';

// Flatten the papa→dealer→client tree into a depth-indented list for a <select>.
const flattenClients = (nodes, depth = 0, out = []) => {
  for (const n of (nodes || [])) {
    out.push({ id: n.id, name: n.name, email: n.email, depth });
    if (n.children?.length) flattenClients(n.children, depth + 1, out);
  }
  return out;
};

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => d
  ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }).replace(',', '')
  : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—';
const ago = (d) => {
  if (!d) return '—';
  const ms = Date.now() - new Date(d).getTime();
  const days  = Math.floor(ms / 86400000);
  const hrs   = Math.floor((ms % 86400000) / 3600000);
  const mins  = Math.floor((ms % 3600000) / 60000);
  const secs  = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hrs}h ago`;
  if (hrs > 0)  return `${hrs}h ${mins}m ago`;
  if (mins > 0) return `${mins}m ${secs}s ago`;
  return `${secs}s ago`;
};

const copyToClipboard = (text) => navigator.clipboard?.writeText(text).catch(() => {});

// ── colour helpers ────────────────────────────────────────────────────────────
const PACKET_COLORS = {
  location: '#16a34a',
  status:   '#2563eb',
  alarm:    '#dc2626',
  heartbeat:'#7c3aed',
  gps:      '#0891b2',
};
const packetColor = (type) => {
  if (!type) return '#6b7280';
  const t = type.toLowerCase();
  for (const [k, v] of Object.entries(PACKET_COLORS)) if (t.includes(k)) return v;
  return '#6b7280';
};

// ── small UI primitives ───────────────────────────────────────────────────────
const Pill = ({ label, color, bg }) => (
  <span style={{
    display: 'inline-block', padding: '1px 8px', borderRadius: 20,
    fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
    background: bg || color + '20', color: color, border: `1px solid ${color}40`,
  }}>{label}</span>
);

const TypePill = ({ type }) => {
  const color = packetColor(type);
  return <Pill label={type || '—'} color={color} />;
};

const AccBadge = ({ acc }) => {
  if (acc === true)  return <Pill label="ON"  color="#16a34a" bg="#dcfce7" />;
  if (acc === false) return <Pill label="OFF" color="#dc2626" bg="#fee2e2" />;
  return <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>;
};

const SpeedBar = ({ speed, max = 120 }) => {
  if (speed == null) return <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>;
  const pct = Math.min(100, (speed / max) * 100);
  const color = speed > 80 ? '#dc2626' : speed > 40 ? '#d97706' : '#16a34a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 80 }}>
      <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: '#374151', minWidth: 34, textAlign: 'right' }}>{speed} km/h</span>
    </div>
  );
};

const CopyBtn = ({ value }) => (
  <button
    onClick={() => copyToClipboard(String(value))}
    title="Copy"
    style={{
      border: 'none', background: 'none', cursor: 'pointer', padding: '1px 4px',
      color: '#9ca3af', fontSize: 11, lineHeight: 1,
    }}>⎘</button>
);

// ── Card ─────────────────────────────────────────────────────────────────────
const Card = ({ title, icon, children, accent = '#3B82F6', action }) => (
  <div style={{
    background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 14, overflow: 'hidden',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: accent + '12', borderBottom: `1px solid ${accent}30`,
      padding: '8px 14px',
    }}>
      <span style={{ fontWeight: 700, fontSize: 12, color: accent, letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{title}
      </span>
      {action}
    </div>
    <div style={{ padding: 14 }}>{children}</div>
  </div>
);

const Row = ({ label, value, mono }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
    <span style={{ color: '#9ca3af', fontSize: 11, width: 170, flexShrink: 0, paddingTop: 1 }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', wordBreak: 'break-all', fontFamily: mono ? 'monospace' : 'inherit' }}>
      {value ?? '—'}
    </span>
  </div>
);

const StatBox = ({ label, value, sub, color = '#374151' }) => (
  <div style={{
    background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8,
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2,
  }}>
    <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.1 }}>{value ?? '—'}</span>
    {sub && <span style={{ fontSize: 10, color: '#9ca3af' }}>{sub}</span>}
  </div>
);

// ── JSON viewer ───────────────────────────────────────────────────────────────
const JsonViewer = ({ data }) => {
  const [open, setOpen] = useState(false);
  const str = JSON.stringify(data, null, 2);
  const lineCount = str.split('\n').length;
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          border: '1px solid #dbeafe', background: open ? '#dbeafe' : '#eff6ff',
          borderRadius: 5, padding: '2px 10px', fontSize: 11, cursor: 'pointer',
          color: '#2563eb', fontWeight: 600,
        }}
      >{open ? 'Hide JSON' : 'View JSON'}</button>
      {open && (
        <div style={{ position: 'relative', marginTop: 4 }}>
          <button
            onClick={() => copyToClipboard(str)}
            style={{
              position: 'absolute', top: 6, right: 6, border: '1px solid #d1d5db',
              background: '#fff', borderRadius: 4, padding: '2px 8px',
              fontSize: 10, cursor: 'pointer', color: '#6b7280',
            }}>Copy</button>
          <pre style={{
            fontSize: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            background: '#0f172a', color: '#e2e8f0', padding: '10px 12px',
            borderRadius: 6, margin: 0, maxHeight: 320, overflowY: 'auto',
            fontFamily: 'Consolas, "Courier New", monospace',
          }}>{str}</pre>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{lineCount} lines</div>
        </div>
      )}
    </div>
  );
};

// ── Daily bar chart ───────────────────────────────────────────────────────────
const DailyBars = ({ counts }) => {
  if (!counts?.length) return <span style={{ color: '#9ca3af', fontSize: 12 }}>No data</span>;
  const max = Math.max(...counts.map(c => c.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {counts.map(({ _id, count }) => {
        const pct = Math.round((count / max) * 100);
        const staleDays = Math.floor((Date.now() - new Date(_id).getTime()) / 86400000);
        const color = staleDays === 0 ? '#16a34a' : staleDays <= 3 ? '#2563eb' : '#9ca3af';
        return (
          <div key={_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 85, fontSize: 10, color, fontWeight: staleDays <= 3 ? 700 : 400, fontFamily: 'monospace' }}>{_id}</span>
            <div style={{ flex: 1, height: 12, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
            </div>
            <span style={{ width: 40, fontSize: 10, color: '#6b7280', textAlign: 'right', fontFamily: 'monospace' }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Packet type breakdown ─────────────────────────────────────────────────────
const TypeBreakdown = ({ rows }) => {
  if (!rows?.length) return <span style={{ color: '#9ca3af', fontSize: 12 }}>No data for last 7 days</span>;
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map((r, i) => {
        const color = packetColor(r._id);
        const pct = Math.round((r.count / total) * 100);
        const gpsPct = r.count ? Math.round((r.hasGps / r.count) * 100) : 0;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 10px', background: color + '08',
            border: `1px solid ${color}20`, borderRadius: 6,
          }}>
            <TypePill type={r._id} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', minWidth: 30, textAlign: 'right' }}>{r.count}</span>
            <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 55 }}>
              GPS: <span style={{ color: gpsPct > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{gpsPct}%</span>
            </span>
            {r.avgSpeed != null && (
              <span style={{ fontSize: 10, color: '#6b7280', minWidth: 60 }}>
                avg {r.avgSpeed.toFixed(0)} km/h
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Recent packets (in Diagnosis) ─────────────────────────────────────────────
const RecentPacketList = ({ packets }) => {
  if (!packets?.length) return <span style={{ color: '#9ca3af', fontSize: 12 }}>No recent packets</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {packets.map((p, i) => {
        const hasGps = p.lat != null && p.lat !== 0;
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '160px 90px 60px 100px 80px 1fr',
            gap: 8, alignItems: 'center', padding: '5px 8px',
            background: hasGps ? '#f0fdf4' : '#f9fafb',
            border: `1px solid ${hasGps ? '#bbf7d0' : '#f3f4f6'}`,
            borderRadius: 5, fontSize: 11,
          }}>
            <span style={{ fontFamily: 'monospace', color: '#374151' }}>{fmt(p.timestamp)}</span>
            <TypePill type={p.packetType} />
            <AccBadge acc={p.acc} />
            <span style={{ color: hasGps ? '#16a34a' : '#9ca3af' }}>
              {hasGps ? `${p.lat?.toFixed(4)}, ${p.lng?.toFixed(4)}` : 'No GPS'}
            </span>
            <SpeedBar speed={p.speed} />
            <span style={{ color: '#9ca3af', fontSize: 10 }}>{p.imei}</span>
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

  const getVerdict = () => {
    if (!d) return null;
    const mongoGt06Latest = d.mongo?.gt06locations?.latestPacket?.timestamp;
    const mongoFmbLatest  = d.mongo?.fmb125locations?.latestPacket?.timestamp;
    const mongoLatest     = [mongoGt06Latest, mongoFmbLatest].filter(Boolean).sort().pop();
    const mysqlLast       = d.deviceState?.lastPacketTime;

    if (!mongoLatest) return {
      icon: '✗', color: '#dc2626',
      title: 'No MongoDB packets found',
      body: 'Device may be offline, or the IMEI stored in MySQL does not match what the device is sending.',
    };
    const mongoMs  = new Date(mongoLatest).getTime();
    const mysqlMs  = mysqlLast ? new Date(mysqlLast).getTime() : 0;
    const diffDays = Math.floor((mongoMs - mysqlMs) / 86400000);
    if (diffDays > 1) return {
      icon: '⚠', color: '#d97706',
      title: `${diffDays}d of unprocessed packets`,
      body: `MongoDB has newer data (${fmtDate(mongoLatest)}) than MySQL last processed (${fmtDate(mysqlLast)}). Use Reprocess below to backfill.`,
    };
    const staleDays = Math.floor((Date.now() - mongoMs) / 86400000);
    if (staleDays > 1) return {
      icon: '✗', color: '#dc2626',
      title: `Device silent for ${staleDays} days`,
      body: `Last MongoDB packet: ${fmtDate(mongoLatest)}. Check device power, SIM data balance, or network connectivity.`,
    };
    return {
      icon: '✓', color: '#16a34a',
      title: 'Live & processed',
      body: `Last MongoDB packet: ${fmt(mongoLatest)}.`,
    };
  };

  const verdict = getVerdict();

  const gt06  = d?.mongo?.gt06locations;
  const fmb   = d?.mongo?.fmb125locations;

  const MongoSection = ({ data: m, label, accent }) => {
    if (!m) return null;
    const totalPackets  = m.totalCount ?? 0;
    const latestTs      = m.latestPacket?.timestamp;
    const latestGps     = m.latestGpsPacket;

    return (
      <Card title={label} icon="🗄" accent={accent}>
        {/* stat boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8, marginBottom: 14 }}>
          <StatBox label="Total packets" value={totalPackets.toLocaleString()} />
          <StatBox label="Latest packet" value={latestTs ? ago(latestTs) : 'Never'} sub={latestTs ? fmt(latestTs) : undefined}
            color={latestTs && (Date.now() - new Date(latestTs).getTime()) < 86400000 ? '#16a34a' : '#dc2626'} />
          <StatBox label="Last type" value={m.latestPacket?.packetType || '—'} />
          <StatBox label="Last ACC" value={m.latestPacket?.acc != null ? (m.latestPacket.acc ? 'ON' : 'OFF') : '—'}
            color={m.latestPacket?.acc ? '#16a34a' : '#dc2626'} />
        </div>

        {/* latest GPS */}
        <div style={{ background: latestGps ? '#f0fdf4' : '#fef2f2', border: `1px solid ${latestGps ? '#bbf7d0' : '#fca5a5'}`, borderRadius: 7, padding: '8px 12px', marginBottom: 14, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: latestGps ? '#16a34a' : '#dc2626' }}>
            {latestGps ? `Last GPS: ${fmt(latestGps.timestamp)}` : 'No GPS packets found in this collection'}
          </span>
          {latestGps && (
            <span style={{ marginLeft: 12, color: '#374151', fontFamily: 'monospace' }}>
              {latestGps.lat?.toFixed(6)}, {latestGps.lng?.toFixed(6)}
            </span>
          )}
        </div>

        {/* packet type breakdown */}
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Packet Types (last 7d)</div>
        <TypeBreakdown rows={m.typeBreakdown} />

        {/* last 10 packets */}
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', margin: '14px 0 6px' }}>Last 10 Packets</div>
        <RecentPacketList packets={m.recentPackets} />

        {/* daily chart */}
        <div style={{ fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', margin: '14px 0 6px' }}>
          Daily Counts (last 45d)
        </div>
        <DailyBars counts={m.dailyCounts} />
      </Card>
    );
  };

  return (
    <div>
      {/* search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={vehicleNumber}
          onChange={e => setVehicleNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchStatus()}
          placeholder="Enter vehicle number  (e.g. HR26CX4194)"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' }}
        />
        <button
          onClick={fetchStatus}
          disabled={loading || !vehicleNumber.trim()}
          style={{
            padding: '9px 24px', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >{loading ? 'Checking…' : 'Diagnose'}</button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      {d && (
        <>
          {/* Verdict banner */}
          {verdict && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: verdict.color + '12', border: `1.5px solid ${verdict.color}50`,
              borderRadius: 10, padding: '14px 18px', marginBottom: 16,
            }}>
              <span style={{ fontSize: 22, color: verdict.color, flexShrink: 0, lineHeight: 1 }}>{verdict.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: verdict.color }}>{verdict.title}</div>
                <div style={{ fontSize: 12, color: verdict.color + 'cc', marginTop: 2 }}>{verdict.body}</div>
              </div>
            </div>
          )}

          {/* Vehicle */}
          <Card title="Vehicle" icon="🚘" accent="#1e40af">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              <Row label="ID" value={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{d.vehicle.id}<CopyBtn value={d.vehicle.id} /></span>} />
              <Row label="Vehicle Number" value={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{d.vehicle.vehicleNumber}<CopyBtn value={d.vehicle.vehicleNumber} /></span>} />
              <Row label="IMEI (MySQL)" value={<span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>{d.vehicle.imei}<CopyBtn value={d.vehicle.imei} /></span>} />
              <Row label="Device Type" value={d.vehicle.deviceType?.toUpperCase() || '—'} />
              <Row label="Status" value={<Pill label={d.vehicle.status || 'unknown'} color={d.vehicle.status === 'active' ? '#16a34a' : '#dc2626'} />} />
              <Row label="IMEI variants searched" value={d.imeiVariants?.join(', ')} mono />
            </div>
          </Card>

          {/* Live State */}
          <Card title="Live Device State" icon="⚡" accent="#7c3aed">
            {d.deviceState ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <StatBox label="Last packet (MySQL)" value={ago(d.deviceState.lastPacketTime)} sub={fmt(d.deviceState.lastPacketTime)}
                  color={d.deviceState.lastPacketTime ? '#111' : '#dc2626'} />
                <StatBox label="Engine" value={d.deviceState.engineOn ? 'ON' : 'OFF'}
                  color={d.deviceState.engineOn ? '#16a34a' : '#6b7280'} />
                <StatBox label="Last Speed" value={d.deviceState.lastSpeed != null ? `${d.deviceState.lastSpeed} km/h` : '—'} />
                <StatBox label="Active Trip ID" value={d.deviceState.currentTripId || 'None'}
                  color={d.deviceState.currentTripId ? '#2563eb' : '#9ca3af'} />
                <StatBox label="Last position"
                  value={d.deviceState.lastLat ? `${Number(d.deviceState.lastLat).toFixed(4)}, ${Number(d.deviceState.lastLng).toFixed(4)}` : '—'} />
              </div>
            ) : (
              <div style={{ color: '#dc2626', fontSize: 13 }}>
                No VehicleDeviceState row found — device has never been processed by the state machine.
              </div>
            )}
          </Card>

          {/* MySQL Trips */}
          <Card title="MySQL Trips" icon="🛣" accent="#0891b2">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              <StatBox label="Total trips" value={d.mysql?.totalTrips} />
              <StatBox label="Latest start" value={d.mysql?.lastTrip?.startTime ? fmt(d.mysql.lastTrip.startTime) : '—'} />
              <StatBox label="Latest distance" value={d.mysql?.lastTrip?.distanceKm != null ? `${d.mysql.lastTrip.distanceKm} km` : '—'} />
            </div>
          </Card>

          {/* MongoDB collections */}
          <MongoSection data={gt06}  label="MongoDB — gt06locations"   accent="#059669" />
          <MongoSection data={fmb}   label="MongoDB — fmb125locations" accent="#d97706" />

          {/* Reprocess */}
          <Card title="Reprocess" icon="♻" accent="#dc2626"
            action={
              <span style={{ fontSize: 11, color: '#dc2626', opacity: 0.8 }}>
                Deletes &amp; rebuilds trips/sessions for date range
              </span>
            }>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {[['From', rpFrom, setRpFrom], ['To', rpTo, setRpTo]].map(([lbl, val, set]) => (
                <div key={lbl} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{lbl}</span>
                  <input type="date" value={val} onChange={e => set(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }} />
                </div>
              ))}
              <button
                onClick={runReprocess}
                disabled={rpLoading || !rpFrom || !rpTo}
                style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', height: 36 }}>
                {rpLoading ? 'Running…' : 'Reprocess'}
              </button>
            </div>
            {rpResult && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: rpResult.error ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${rpResult.error ? '#fca5a5' : '#86efac'}`,
                color: rpResult.error ? '#dc2626' : '#16a34a',
              }}>
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
const LIMIT = 25;
const inputSt = { padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' };
const labelSt = { fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 3, display: 'block' };
const FilterGroup = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span style={labelSt}>{label}</span>
    {children}
  </div>
);

const GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5-minute gap = highlight

const PacketExplorer = () => {
  const { user } = useAuth();
  const isPapaOrDealer = user?.role === 'papa' || Number(user?.parentId) === 0 || user?.role === 'dealer' || user?.permissions?.canAddClient === true;
  const [clients, setClients]       = useState([]);
  const [clientId, setClientId]     = useState(''); // '' = own fleet
  const [vehicles, setVehicles]     = useState([]);
  const [vehicleId, setVehicleId]   = useState('');
  const [deviceType, setDeviceType] = useState('fmb125');
  const todayIST = () => {
    const ist = new Date(Date.now() + 5.5 * 3600000);
    return ist.toISOString().slice(0, 10);
  };
  const [from, setFrom]           = useState(todayIST() + 'T00:00');
  const [to,   setTo]             = useState('');
  const [packetType, setPacketType] = useState('');
  const [acc,      setAcc]        = useState('any');
  const [hasGps,   setHasGps]     = useState('any');
  const [minSpeed, setMinSpeed]   = useState('');
  const [maxSpeed, setMaxSpeed]   = useState('');
  const [hasBattery, setHasBattery] = useState('any');
  const [data,    setData]    = useState([]);
  const [skip,    setSkip]    = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [fetched, setFetched] = useState(false);

  // Load the client tree once (papa/dealer only) so the dropdown can let them
  // drill into any vehicle in the network, not just their own.
  useEffect(() => {
    if (!isPapaOrDealer) return;
    getClientTree()
      .then(r => setClients(flattenClients(r.data || [])))
      .catch(() => {});
  }, [isPapaOrDealer]);

  // Re-fetch vehicles whenever the chosen client changes. Empty clientId =
  // caller's own fleet (current behavior).
  useEffect(() => {
    const url = clientId ? `/vehicles?clientId=${encodeURIComponent(clientId)}` : '/vehicles';
    api.get(url)
      .then(res => setVehicles(Array.isArray(res) ? res : (res.data ?? [])))
      .catch(() => setVehicles([]));
    // Reset any currently-selected vehicle — it likely doesn't belong to the
    // newly-selected client's fleet.
    setVehicleId('');
  }, [clientId]);

  const handleVehicleChange = (e) => {
    const vid = e.target.value;
    setVehicleId(vid);
    if (vid) {
      const v = vehicles.find(x => String(x.id) === vid);
      if (v?.deviceType) setDeviceType(v.deviceType.toLowerCase());
    }
  };

  const buildParams = (skipVal) => {
    const p = new URLSearchParams();
    if (vehicleId) p.set('vehicleId', vehicleId);
    else           p.set('deviceType', deviceType);
    if (from)       p.set('from', from);
    if (to)         p.set('to',   to);
    if (packetType) p.set('packetType', packetType);
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
      setData(prev => append ? [...prev, ...packets] : packets);
      setSkip(currentSkip + packets.length);
      setHasMore(packets.length === LIMIT);
      setFetched(true);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      if (!append) { setData([]); setHasMore(false); }
    }
    setLoading(false);
  };

  // Quick stats
  const gpsCount  = data.filter(r => (r.data?.latitude ?? 0) > 0).length;
  const accOnCount = data.filter(r => r.data?.acc === true).length;
  const speeds    = data.map(r => r.data?.speed).filter(s => s != null && s > 0);
  const avgSpeed  = speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : null;
  const maxSpeedVal = speeds.length ? Math.max(...speeds) : null;

  return (
    <div>
      {/* filter panel */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        {isPapaOrDealer && (
          <div style={{ marginBottom: 10 }}>
            <FilterGroup label={`Client  (${clients.length} in network)`}>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...inputSt, width: '100%' }}>
                <option value="">— My own fleet —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {'— '.repeat(c.depth)}{c.name}{c.email ? `  (${c.email})` : ''}
                  </option>
                ))}
              </select>
            </FilterGroup>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
          <FilterGroup label={`Vehicle  (${vehicles.length})`}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <FilterGroup label="From (IST)">
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} style={inputSt} />
          </FilterGroup>
          <FilterGroup label="To (IST — leave blank for now)">
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} style={inputSt} />
          </FilterGroup>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8, marginBottom: 12 }}>
          <FilterGroup label="Packet Type">
            <input value={packetType} onChange={e => setPacketType(e.target.value)} placeholder="e.g. location" style={inputSt} />
          </FilterGroup>
          <FilterGroup label="ACC / Ignition">
            <select value={acc} onChange={e => setAcc(e.target.value)} style={inputSt}>
              <option value="any">Any</option>
              <option value="true">ON</option>
              <option value="false">OFF</option>
            </select>
          </FilterGroup>
          <FilterGroup label="Has GPS">
            <select value={hasGps} onChange={e => setHasGps(e.target.value)} style={inputSt}>
              <option value="any">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FilterGroup>
          <FilterGroup label="Min Speed">
            <input type="number" value={minSpeed} onChange={e => setMinSpeed(e.target.value)} placeholder="km/h" style={inputSt} />
          </FilterGroup>
          <FilterGroup label="Max Speed">
            <input type="number" value={maxSpeed} onChange={e => setMaxSpeed(e.target.value)} placeholder="km/h" style={inputSt} />
          </FilterGroup>
          <FilterGroup label="Battery">
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
            style={{ padding: '8px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {loading && !data.length ? 'Loading…' : 'Fetch Packets'}
          </button>
          {fetched && data.length > 0 && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {data.length} packets{hasMore ? '+' : ''}
            </span>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}
      </div>

      {/* quick stats */}
      {data.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8, marginBottom: 14 }}>
          <StatBox label="Packets" value={data.length + (hasMore ? '+' : '')} />
          <StatBox label="With GPS" value={`${gpsCount} (${data.length ? Math.round(gpsCount / data.length * 100) : 0}%)`}
            color={gpsCount > 0 ? '#16a34a' : '#dc2626'} />
          <StatBox label="ACC ON" value={accOnCount} color={accOnCount > 0 ? '#16a34a' : '#6b7280'} />
          <StatBox label="Avg speed" value={avgSpeed ? `${avgSpeed} km/h` : '—'} />
          <StatBox label="Max speed" value={maxSpeedVal != null ? `${maxSpeedVal} km/h` : '—'}
            color={maxSpeedVal > 80 ? '#dc2626' : '#374151'} />
        </div>
      )}

      {/* packets list */}
      {data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.map((row, idx) => {
            const d = row.data || {};
            const ts      = row.date || d.timestamp;
            const prev    = idx < data.length - 1 ? (data[idx + 1].date || data[idx + 1].data?.timestamp) : null;
            const gapMs   = prev ? new Date(ts).getTime() - new Date(prev).getTime() : 0;
            const hasGapAbove = gapMs > GAP_THRESHOLD_MS;
            const hasGpsRow   = (d.latitude ?? d.lat) > 0 && (d.longitude ?? d.lng) != null;
            const lat     = d.latitude ?? d.lat;
            const lng     = d.longitude ?? d.lng;
            const accVal  = d.acc;
            const speed   = d.speed;
            const battery = d.battery;
            const imei    = d.imei || row.imei;

            return (
              <React.Fragment key={idx}>
                {hasGapAbove && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                    <div style={{ flex: 1, height: 1, background: '#fbbf24' }} />
                    <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {Math.round(gapMs / 60000)}m gap
                    </span>
                    <div style={{ flex: 1, height: 1, background: '#fbbf24' }} />
                  </div>
                )}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '155px 90px 55px 190px 110px 70px 70px 1fr',
                  gap: 8, alignItems: 'center',
                  padding: '6px 10px',
                  background: hasGpsRow ? '#f0fdf4' : '#fafafa',
                  border: `1px solid ${hasGpsRow ? '#bbf7d0' : '#e5e7eb'}`,
                  borderRadius: 6, fontSize: 12,
                  transition: 'background 0.1s',
                }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>{fmt(ts)}</span>
                  <TypePill type={d.packetType} />
                  <AccBadge acc={accVal} />
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: hasGpsRow ? '#16a34a' : '#9ca3af' }}>
                    {hasGpsRow
                      ? <>{lat?.toFixed(5)}, {lng?.toFixed(5)}</>
                      : 'No GPS'}
                  </span>
                  <SpeedBar speed={speed} />
                  <span style={{ fontSize: 11, color: battery != null ? '#2563eb' : '#9ca3af' }}>
                    {battery != null ? `🔋 ${battery}` : '—'}
                  </span>
                  <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{imei}</span>
                  <JsonViewer data={d} />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {hasMore && !loading && (
        <button
          onClick={() => handleFetch(true)}
          style={{ marginTop: 12, padding: '8px 20px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Load more ({data.length} loaded)
        </button>
      )}
      {loading && data.length > 0 && <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Loading more…</div>}
      {fetched && !loading && data.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          No packets match the current filters.
        </div>
      )}
    </div>
  );
};

// ── RAW PACKET DECODER TAB ────────────────────────────────────────────────────
const GT06_PACKET_TYPES = {
  0x01: 'Login',      0x10: 'GPS Location', 0x11: 'GPS Online',
  0x12: 'GPS+Status', 0x13: 'STATUS',       0x16: 'Alarm',
  0x17: 'Heartbeat',  0x19: 'GPS Info',     0x1A: 'GPS+Acc',
  0x22: 'Combined',   0x26: 'Timing',
};

const decodeGT06 = (hexStr) => {
  try {
    const raw = hexStr.replace(/\s/g, '').toLowerCase();
    if (!raw.startsWith('7878') && !raw.startsWith('7979')) throw new Error('Invalid start bytes (expected 7878 or 7979)');
    const bytes = [];
    for (let i = 0; i < raw.length; i += 2) bytes.push(parseInt(raw.slice(i, i + 2), 16));

    const longHeader = raw.startsWith('7979');
    const headerLen  = longHeader ? 5 : 4;
    const msgLen     = longHeader
      ? (bytes[2] << 8 | bytes[3])
      : bytes[2];
    const protocolNum = bytes[headerLen - 1];
    const typeName    = GT06_PACKET_TYPES[protocolNum] || 'Unknown';

    const fields = [
      { key: 'Start',        value: raw.startsWith('7878') ? '0x7878 (short)' : '0x7979 (long)' },
      { key: 'Length',       value: `${msgLen} bytes` },
      { key: 'Protocol',     value: `0x${protocolNum.toString(16).padStart(2, '0').toUpperCase()} — ${typeName}` },
    ];

    let offset = headerLen;

    if ([0x10, 0x11, 0x12, 0x1A, 0x22].includes(protocolNum)) {
      if (bytes.length > offset + 5) {
        const yy = bytes[offset], mo = bytes[offset+1], dd = bytes[offset+2],
              hh = bytes[offset+3], mm = bytes[offset+4], ss = bytes[offset+5];
        fields.push({ key: 'Timestamp', value: `20${yy.toString().padStart(2,'0')}-${mo.toString().padStart(2,'0')}-${dd.toString().padStart(2,'0')} ${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')} UTC` });
        offset += 6;
      }
      if (bytes.length > offset) {
        fields.push({ key: 'Satellites',  value: `${bytes[offset] & 0x0F} (qty), ${(bytes[offset] >> 4) & 0x0F} (no motion bits)` });
        offset += 1;
      }
      if (bytes.length > offset + 3) {
        const latRaw = (bytes[offset] << 24 | bytes[offset+1] << 16 | bytes[offset+2] << 8 | bytes[offset+3]) >>> 0;
        offset += 4;
        const lngRaw = (bytes[offset] << 24 | bytes[offset+1] << 16 | bytes[offset+2] << 8 | bytes[offset+3]) >>> 0;
        offset += 4;
        fields.push({ key: 'Lat raw (hex)', value: `0x${latRaw.toString(16).toUpperCase().padStart(8,'0')}  → ${(latRaw / 1800000).toFixed(6)}°` });
        fields.push({ key: 'Lng raw (hex)', value: `0x${lngRaw.toString(16).toUpperCase().padStart(8,'0')}  → ${(lngRaw / 1800000).toFixed(6)}°` });
      }
      if (bytes.length > offset) {
        const speed = bytes[offset]; offset++;
        fields.push({ key: 'Speed', value: `${speed} km/h` });
      }
      if (bytes.length > offset + 1) {
        const cs = (bytes[offset] << 8 | bytes[offset+1]) >>> 0; offset += 2;
        const csHex = `0x${cs.toString(16).toUpperCase().padStart(4,'0')}`;
        const csBin = cs.toString(2).padStart(16,'0');
        const realTime = (cs & 0x8000) !== 0;
        const gpsFixed = (cs & 0x4000) === 0; // inverted
        const isEast   = (cs & 0x2000) === 0; // inverted
        const isNorth  = (cs & 0x1000) !== 0; // standard
        const accOn    = (cs & 0x0400) !== 0;
        fields.push({ key: 'courseStatus', value: `${csHex} = 0b${csBin.slice(0,8)} ${csBin.slice(8)}` });
        fields.push({ key: '  Bit 15 — realTime',  value: realTime ? '1 = Real-time GPS' : '0 = Differential GPS' });
        fields.push({ key: '  Bit 14 — gpsFixed (inv)', value: gpsFixed ? '0 → Fixed (good GPS)' : '1 → Not fixed' });
        fields.push({ key: '  Bit 13 — E/W (inv)',  value: isEast  ? '0 → East' : '1 → West' });
        fields.push({ key: '  Bit 12 — N/S',        value: isNorth ? '1 → North' : '0 → South' });
        fields.push({ key: '  Bit 10 — ACC',        value: accOn  ? '1 → Ignition ON' : '0 → Ignition OFF' });
        fields.push({ key: 'Decoded GPS', value: `${isNorth ? '' : '-'}lat,  ${isEast ? '' : '-'}lng  (${gpsFixed ? 'fixed' : 'not fixed'})  ACC=${accOn ? 'ON' : 'OFF'}` });
      }
    }

    if (protocolNum === 0x13) {
      // STATUS packet
      if (bytes.length > offset + 1) {
        const vHex  = bytes[offset].toString(16).padStart(2,'0');
        const power = bytes[offset+1];
        fields.push({ key: 'Voltage level', value: `0x${vHex.toUpperCase()} (${bytes[offset]})` });
        fields.push({ key: 'GSM signal',    value: `${power}` });
        offset += 2;
      }
      if (bytes.length > offset) {
        const alarm = bytes[offset]; offset++;
        fields.push({ key: 'Alarm code', value: `0x${alarm.toString(16).toUpperCase()} (${alarm === 0 ? 'normal' : 'alarm'})` });
      }
      if (bytes.length > offset) {
        const status = bytes[offset]; offset++;
        const accOn  = (status & 0x02) !== 0;
        fields.push({ key: 'Status byte', value: `0x${status.toString(16).toUpperCase().padStart(2,'0')} = 0b${status.toString(2).padStart(8,'0')}` });
        fields.push({ key: '  Bit 1 — ACC', value: accOn ? '1 → Ignition ON' : '0 → Ignition OFF' });
      }
    }

    // Serial + CRC at end
    if (bytes.length >= 4) {
      const sn  = (bytes[bytes.length-4] << 8 | bytes[bytes.length-3]);
      const crc = (bytes[bytes.length-2] << 8 | bytes[bytes.length-1]);
      if (bytes[bytes.length-2] !== 0x0D || bytes[bytes.length-1] !== 0x0A) {
        fields.push({ key: 'Serial #', value: sn });
        fields.push({ key: 'CRC', value: `0x${crc.toString(16).toUpperCase().padStart(4,'0')}` });
      }
    }

    return { ok: true, fields, typeName, protocolNum };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

const RawDecoderTab = () => {
  const [rawHex, setRawHex] = useState('');
  const [result, setResult] = useState(null);

  const decode = () => {
    if (!rawHex.trim()) return;
    setResult(decodeGT06(rawHex.trim()));
  };

  const EXAMPLES = [
    { label: 'GPS+ACC (0x22)',  hex: '787822221a040a0d1315ca0311b105084f5f9116154b01940a02060096c5010000007e64850d0a' },
    { label: 'STATUS (0x13)', hex: '787805130108020064F60D0A' },
  ];

  return (
    <div>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>GT06 Raw Hex Decoder</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
          Paste the full raw packet hex (from MongoDB <code>raw</code> field or device log). Supports GT06 protocol packets.
        </div>
        <textarea
          value={rawHex}
          onChange={e => setRawHex(e.target.value)}
          placeholder={'e.g. 787822221a040a0d1315ca0311b105084f5f9116154b01940a02060096c5010000007e64850d0a'}
          rows={3}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db',
            fontSize: 12, fontFamily: 'Consolas, monospace', boxSizing: 'border-box', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={decode}
            disabled={!rawHex.trim()}
            style={{ padding: '8px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            Decode
          </button>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Examples:</span>
          {EXAMPLES.map(ex => (
            <button key={ex.label}
              onClick={() => { setRawHex(ex.hex); setResult(null); }}
              style={{ padding: '5px 12px', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {result && (
        result.ok ? (
          <Card title={`Protocol 0x${result.protocolNum?.toString(16).toUpperCase().padStart(2,'0')} — ${result.typeName}`}
            icon="🔍" accent="#7c3aed">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {result.fields.map((f, i) => {
                const isIndented = f.key.startsWith('  ');
                const isSub = isIndented;
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    paddingLeft: isSub ? 16 : 0,
                    background: isSub ? '#f8fafc' : undefined,
                    borderRadius: isSub ? 4 : 0,
                    padding: isSub ? '3px 8px 3px 16px' : '3px 0',
                    borderLeft: isSub ? '2px solid #c4b5fd' : undefined,
                    marginLeft: isSub ? 4 : 0,
                  }}>
                    <span style={{ color: '#6b7280', fontSize: 11, width: 200, flexShrink: 0, fontFamily: 'monospace' }}>
                      {f.key.trim()}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {String(f.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
            Decode error: {result.error}
          </div>
        )
      )}

      {/* bit reference */}
      <Card title="courseStatus Bit Reference" icon="📖" accent="#6b7280">
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', lineHeight: 1.8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', columnGap: 16, rowGap: 2 }}>
            {[
              ['Bit 15', 'realTime — 1=real-time GPS, 0=differential GPS'],
              ['Bit 14', 'gpsFixed (INVERTED) — 0=fixed (good), 1=not fixed'],
              ['Bit 13', 'E/W (INVERTED) — 0=East, 1=West'],
              ['Bit 12', 'N/S (standard) — 1=North, 0=South'],
              ['Bit 11', 'unused'],
              ['Bit 10', 'ACC — 1=ignition ON, 0=ignition OFF'],
              ['Bit 9–0', 'course/heading (0–359°)'],
            ].map(([bit, desc]) => (
              <React.Fragment key={bit}>
                <span style={{ color: '#7c3aed', fontWeight: 700 }}>{bit}</span>
                <span>{desc}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
          Note: Bits 14 and 13 are inverted vs the raw spec — 0 means the condition is true.
          Bit 12 is not inverted. This was confirmed by live packet analysis.
        </div>
      </Card>
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'diagnosis', label: 'Vehicle Diagnosis', icon: '🩺' },
  { id: 'packets',   label: 'Packet Explorer',   icon: '📡' },
  { id: 'decoder',   label: 'Raw Decoder',        icon: '🔬' },
];

const Debug = () => {
  const [tab, setTab] = useState('diagnosis');

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1050, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Debug Console</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Diagnose vehicles, explore raw packets, and decode GT06 hex frames.
        </p>
      </div>

      {/* tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 18px', border: 'none', background: 'none',
              cursor: 'pointer', fontWeight: tab === t.id ? 700 : 500,
              fontSize: 13, color: tab === t.id ? '#2563eb' : '#64748b',
              borderBottom: tab === t.id ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -2, transition: 'color 0.15s',
            }}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'diagnosis' && <DiagnosisTab />}
      {tab === 'packets'   && <PacketExplorer />}
      {tab === 'decoder'   && <RawDecoderTab />}
    </div>
  );
};

export default Debug;

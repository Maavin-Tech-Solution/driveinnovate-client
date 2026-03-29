import React, { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { createTicket, getTickets, getTicketById, updateTicketStatus } from '../services/support.service';
import { getVehicles } from '../services/vehicle.service';
import { getGroups } from '../services/group.service';
import { useAuth } from '../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const ISSUE_TYPES = [
  { value: 'VEHICLE_TRACKING', label: 'Vehicle Tracking',       icon: '📡', color: '#2563eb', desc: 'Live tracking, location, routes' },
  { value: 'GPS_DEVICE',       label: 'GPS Device Issue',        icon: '🛰️', color: '#0891b2', desc: 'Hardware, connectivity, device offline' },
  { value: 'ACCOUNT',          label: 'Account & Profile',       icon: '👤', color: '#7c3aed', desc: 'Login, password, profile settings' },
  { value: 'BILLING',          label: 'Billing & Subscription',  icon: '💳', color: '#d97706', desc: 'Payment, invoice, subscription plans' },
  { value: 'REPORTS',          label: 'Reports & Data',          icon: '📊', color: '#059669', desc: 'Missing data, incorrect reports, exports' },
  { value: 'TECHNICAL',        label: 'Technical / App Bug',     icon: '🐛', color: '#dc2626', desc: 'Platform error, app crash, unexpected behavior' },
  { value: 'OTHER',            label: 'Other',                   icon: '💬', color: '#64748b', desc: 'Any other query or feedback' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW',      label: '🟢 Low',      color: '#16a34a' },
  { value: 'MEDIUM',   label: '🟡 Medium',   color: '#d97706' },
  { value: 'HIGH',     label: '🔴 High',     color: '#dc2626' },
  { value: 'CRITICAL', label: '🚨 Critical', color: '#7f1d1d' },
];

const STATUS_META = {
  OPEN:        { label: 'Open',        color: '#2563eb', bg: '#eff6ff' },
  IN_PROGRESS: { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  RESOLVED:    { label: 'Resolved',    color: '#16a34a', bg: '#f0fdf4' },
  CLOSED:      { label: 'Closed',      color: '#94a3b8', bg: '#f8fafc' },
};

const VEHICLE_ICONS = { car:'🚗',suv:'🚙',truck:'🚛',bus:'🚌',bike:'🏍️',auto:'🛺',van:'🚐',ambulance:'🚑',pickup:'🛻' };
const ALLOWED_EXTS  = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.xlsx,.csv';
const API_BASE      = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const fmtDate  = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtShort = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'short',  timeStyle: 'short' }) : '—';
const fmtSize  = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Ic = ({ n, size = 14, color = 'currentColor', sw = 1.75 }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0, display: 'block' } };
  const icons = {
    plus:       <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x:          <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    ticket:     <><path d="M2 9a3 3 0 010-6h20a3 3 0 010 6"/><path d="M2 15a3 3 0 000 6h20a3 3 0 000-6"/><path d="M6 9v6M18 9v6"/></>,
    search:     <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    paperclip:  <><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></>,
    chevron:    <><polyline points="9 18 15 12 9 6"/></>,
    check:      <polyline points="20 6 9 17 4 12"/>,
    info:       <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    download:   <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    phone:      <><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.62-.62a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></>,
    mail:       <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
  };
  return <svg {...p}>{icons[n] ?? null}</svg>;
};

const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };
const inp = { width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', borderRadius: 8, background: '#fff', transition: 'border-color 0.15s', color: '#0f172a' };

// ─── Ticket Detail Modal ──────────────────────────────────────────────────────
const TicketDetailModal = ({ ticketId, onClose, onStatusUpdate }) => {
  const [ticket, setTicket]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    getTicketById(ticketId)
      .then(r => { setTicket(r.data); setNewStatus(r.data.status); })
      .catch(() => toast.error('Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [ticketId]);

  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === ticket.status) return;
    setUpdating(true);
    try {
      await updateTicketStatus(ticketId, { status: newStatus });
      toast.success(`Status updated to ${STATUS_META[newStatus]?.label}`);
      onStatusUpdate();
      onClose();
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  };

  const isImage = (mime) => mime?.startsWith('image/');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: '#fff', width: 660, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : ticket ? (() => {
          const typeMeta     = ISSUE_TYPES.find(t => t.value === ticket.issueType) || {};
          const statusMeta   = STATUS_META[ticket.status] || {};
          const priorityMeta = PRIORITY_OPTIONS.find(p => p.value === ticket.priority) || {};
          const attachments  = ticket.attachments || [];

          return (
            <>
              {/* Header */}
              <div style={{ background: 'var(--theme-sidebar-bg)', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderRadius: '14px 14px 0 0' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>Support Ticket</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4, letterSpacing: '-0.01em' }}>{ticket.ticketNumber}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{ticket.subject}</div>
                </div>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, flexShrink: 0 }}>
                  <Ic n="x" size={14} color="#fff" />
                </button>
              </div>

              <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Badges */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.color}30` }}>
                    ● {statusMeta.label}
                  </span>
                  <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${typeMeta.color || '#2563eb'}12`, color: typeMeta.color || '#2563eb' }}>
                    {typeMeta.icon} {typeMeta.label}
                  </span>
                  <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#f8fafc', color: priorityMeta.color || '#64748b' }}>
                    {priorityMeta.label}
                  </span>
                </div>

                {/* Contact info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    ['📧 Email', ticket.email],
                    ['📞 Phone', ticket.phone],
                    ['📱 Alt Phone', ticket.alternatePhone || '—'],
                    ['📅 Submitted', fmtDate(ticket.createdAt)],
                    ticket.resolvedAt && ['✅ Resolved', fmtDate(ticket.resolvedAt)],
                    ticket.closedAt  && ['🔒 Closed',   fmtDate(ticket.closedAt)],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Vehicle / Group scope */}
                {ticket.issueType === 'VEHICLE_TRACKING' && (
                  <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13 }}>
                    <strong>Scope:</strong> {ticket.vehicleScope === 'SINGLE'
                      ? `Single Vehicle — ${ticket.vehicle?.vehicleName || ticket.vehicle?.vehicleNumber || `#${ticket.vehicleId}`}`
                      : ticket.vehicleScope === 'GROUP'
                      ? `Vehicle Group #${ticket.groupId}`
                      : 'All vehicles'}
                  </div>
                )}

                {/* Description */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Description</div>
                  <div style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {ticket.description}
                  </div>
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Attachments ({attachments.length})</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {attachments.map((a, i) => (
                        <a key={i} href={`${API_BASE}/${a.path}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, textDecoration: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600 }}
                          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                          <span style={{ fontSize: 18 }}>{isImage(a.mimetype) ? '🖼️' : a.mimetype === 'application/pdf' ? '📄' : '📎'}</span>
                          <div>
                            <div style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.originalname}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{fmtSize(a.size)}</div>
                          </div>
                          <Ic n="download" size={12} color="#94a3b8" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin notes */}
                {ticket.adminNotes && (
                  <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>📝 Support Notes</div>
                    <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.adminNotes}</div>
                  </div>
                )}

                {/* Status update */}
                {ticket.status !== 'CLOSED' && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Update Status:</span>
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                      {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                    </select>
                    <button onClick={handleStatusUpdate} disabled={updating || newStatus === ticket.status}
                      style={{ padding: '8px 18px', background: newStatus !== ticket.status ? 'var(--theme-sidebar-bg)' : '#e2e8f0', border: 'none', color: newStatus !== ticket.status ? '#fff' : '#94a3b8', cursor: newStatus !== ticket.status ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit' }}>
                      {updating ? 'Updating…' : 'Update'}
                    </button>
                  </div>
                )}
              </div>
            </>
          );
        })() : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Ticket not found</div>
        )}
      </div>
    </div>
  );
};

// ─── New Ticket Form ──────────────────────────────────────────────────────────
const NewTicketForm = ({ vehicles, groups, user, onSuccess }) => {
  const [form, setForm] = useState({
    email: user?.email || '', phone: '', alternatePhone: '',
    issueType: '', vehicleScope: 'SINGLE', vehicleId: '', groupId: '',
    subject: '', description: '', priority: 'MEDIUM',
  });
  const [files, setFiles]         = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(null);
  const fileRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedType = ISSUE_TYPES.find(t => t.value === form.issueType);

  const handleFilePick = (e) => {
    const picked = Array.from(e.target.files || []);
    const combined = [...files];
    for (const f of picked) {
      if (combined.length >= 5) break;
      if (f.size > 10 * 1024 * 1024) { toast.warn(`${f.name} exceeds 10MB limit`); continue; }
      combined.push(f);
    }
    setFiles(combined);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!form.email.trim())       return toast.error('Email is required');
    if (!form.phone.trim())       return toast.error('Phone is required');
    if (!form.issueType)          return toast.error('Please select an issue type');
    if (!form.subject.trim())     return toast.error('Subject is required');
    if (!form.description.trim()) return toast.error('Description is required');
    if (form.issueType === 'VEHICLE_TRACKING' && form.vehicleScope === 'SINGLE' && !form.vehicleId)
      return toast.error('Please select a vehicle');
    if (form.issueType === 'VEHICLE_TRACKING' && form.vehicleScope === 'GROUP' && !form.groupId)
      return toast.error('Please select a group');

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
    files.forEach(f => fd.append('attachments', f));

    setSubmitting(true);
    try {
      const res = await createTicket(fd);
      setSubmitted(res.data);
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit ticket');
    } finally { setSubmitting(false); }
  };

  // ── Success screen ──
  if (submitted) return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>✅</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Ticket Submitted!</div>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>Your support request has been received.</div>
      <div style={{ display: 'inline-block', background: '#eff6ff', border: '2px solid #2563eb', borderRadius: 12, padding: '12px 28px', fontSize: 24, fontWeight: 800, color: '#2563eb', letterSpacing: '0.04em', marginBottom: 16 }}>
        {submitted.ticketNumber}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 28 }}>
        A confirmation email has been sent to <strong>{submitted.email}</strong>
      </div>
      <button onClick={() => setSubmitted(null)}
        style={{ padding: '12px 32px', background: 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, borderRadius: 10, fontFamily: 'inherit' }}>
        Raise Another Ticket
      </button>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

      {/* ── Left: Form ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Contact details */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ic n="mail" size={12} color="#94a3b8" /> Contact Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Email Address *</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" style={inp}
                onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>
            <div>
              <label style={lbl}>Registered Phone *</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXXXXXXX" style={inp}
                onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>
            <div>
              <label style={lbl}>Alternate Phone</label>
              <input value={form.alternatePhone} onChange={e => set('alternatePhone', e.target.value)} placeholder="Optional" style={inp}
                onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} style={inp}>
                {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Issue type */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
            🔍 Issue Type *
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {ISSUE_TYPES.map(t => (
              <button key={t.value} onClick={() => set('issueType', t.value)}
                style={{ padding: '12px 10px', border: `2px solid ${form.issueType === t.value ? t.color : '#e2e8f0'}`, borderRadius: 10, background: form.issueType === t.value ? `${t.color}0f` : '#f8fafc', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: form.issueType === t.value ? t.color : '#0f172a', marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {/* Vehicle tracking scope */}
          {form.issueType === 'VEHICLE_TRACKING' && (
            <div style={{ marginTop: 16, padding: '16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>📡 Select Scope</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['SINGLE', '🚗 Single Vehicle'], ['GROUP', '📦 Vehicle Group']].map(([v, l]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: form.vehicleScope === v ? '#2563eb' : '#fff', border: `1.5px solid ${form.vehicleScope === v ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: form.vehicleScope === v ? 700 : 500, color: form.vehicleScope === v ? '#fff' : '#64748b', transition: 'all 0.15s', userSelect: 'none' }}>
                    <input type="radio" name="vehicleScope" value={v} checked={form.vehicleScope === v} onChange={() => set('vehicleScope', v)} style={{ display: 'none' }} />
                    {l}
                  </label>
                ))}
              </div>
              {form.vehicleScope === 'SINGLE' && (
                <div>
                  <label style={lbl}>Select Vehicle *</label>
                  <select value={form.vehicleId} onChange={e => set('vehicleId', e.target.value)} style={inp}>
                    <option value="">— Choose a vehicle —</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {VEHICLE_ICONS[v.vehicleIcon] || '🚗'} {v.vehicleName || v.vehicleNumber}{v.vehicleName && v.vehicleNumber ? ` (${v.vehicleNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {form.vehicleScope === 'GROUP' && (
                <div>
                  <label style={lbl}>Select Vehicle Group *</label>
                  <select value={form.groupId} onChange={e => set('groupId', e.target.value)} style={inp}>
                    <option value="">— Choose a group —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>📦 {g.name} ({g.vehicles?.length || 0} vehicles)</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Issue details */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
            📝 Issue Details
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Subject *</label>
              <input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief summary of the issue" style={inp}
                onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>
            <div>
              <label style={lbl}>Detailed Description *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={6}
                placeholder="Describe your issue in detail — include steps to reproduce, error messages, timestamps, affected vehicles, etc."
                style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = '#2563eb'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>{form.description.length} characters</div>
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ic n="paperclip" size={12} color="#94a3b8" /> Attachments
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#2563eb'; }}
            onDragLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1';
              handleFilePick({ target: { files: e.dataTransfer.files } });
            }}
            style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: '24px 20px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s', marginBottom: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 3 }}>Click or drag files here</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Up to 5 files · Max 10 MB each · Images, PDF, DOC, XLSX, CSV, TXT</div>
            <input ref={fileRef} type="file" multiple accept={ALLOWED_EXTS} onChange={handleFilePick} style={{ display: 'none' }} />
          </div>
          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 18 }}>{f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📎'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtSize(f.size)}</div>
                  </div>
                  <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}>
                    <Ic n="x" size={13} color="#94a3b8" />
                  </button>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{files.length}/5 files</div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting}
          style={{ padding: '14px', background: submitting ? '#94a3b8' : 'var(--theme-sidebar-bg)', border: 'none', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 800, borderRadius: 10, fontFamily: 'inherit', boxShadow: submitting ? 'none' : '0 4px 14px rgba(0,0,0,0.2)', transition: 'all 0.2s' }}>
          {submitting ? '⏳ Submitting…' : '🎫 Submit Support Ticket'}
        </button>
      </div>

      {/* ── Right: Help sidebar ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>

        {/* What to expect */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: 'var(--theme-sidebar-bg)', padding: '14px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>What happens next?</div>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { step: '1', title: 'Ticket Created', body: 'You receive a unique ticket number and a confirmation email.', color: '#2563eb' },
              { step: '2', title: 'Team Notified',  body: 'Our support team is alerted and will review your request.', color: '#7c3aed' },
              { step: '3', title: 'Resolution',     body: 'We will update the ticket status as we work on your issue.', color: '#16a34a' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${s.color}14`, border: `1.5px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: s.color, flexShrink: 0 }}>{s.step}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority guide */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Priority Guide</div>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PRIORITY_OPTIONS.map(p => (
              <div key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14 }}>{p.label.split(' ')[0]}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.color }}>{p.label.split(' ').slice(1).join(' ')}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                    {p.value === 'LOW' && 'General queries, minor issues'}
                    {p.value === 'MEDIUM' && 'Standard issues affecting workflow'}
                    {p.value === 'HIGH' && 'Significant impact, needs quick fix'}
                    {p.value === 'CRITICAL' && 'System down, fleet unable to operate'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>💡 Tips for faster resolution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Include the vehicle number or IMEI',
              'Add screenshots or screen recordings',
              'Mention the exact date and time of the issue',
              'Describe steps to reproduce the problem',
            ].map(t => (
              <div key={t} style={{ display: 'flex', gap: 8, fontSize: 11, color: '#78350f' }}>
                <span style={{ color: '#d97706', marginTop: 1, flexShrink: 0 }}>✓</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tickets List Tab ─────────────────────────────────────────────────────────
const TicketsList = ({ refreshKey }) => {
  const [tickets, setTickets]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]   = useState('');
  const [selectedId, setSelectedId]   = useState(null);
  const PAGE_SIZE = 20;

  const fetch = useCallback(async (pg = 0) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: PAGE_SIZE };
      if (filterStatus) params.status    = filterStatus;
      if (filterType)   params.issueType = filterType;
      const res = await getTickets(params);
      setTickets(res.data?.tickets || []);
      setTotal(res.data?.total || 0);
      setPage(pg);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }, [filterStatus, filterType]);

  useEffect(() => { fetch(0); }, [fetch, refreshKey]);

  const totalPages   = Math.ceil(total / PAGE_SIZE);
  const openCount    = tickets.filter(t => t.status === 'OPEN').length;
  const progCount    = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolvedCount= tickets.filter(t => t.status === 'RESOLVED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary + filters */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: `All (${total})`,         filter: '',            color: '#2563eb' },
            { label: `Open (${openCount})`,    filter: 'OPEN',        color: '#2563eb' },
            { label: `In Progress (${progCount})`, filter: 'IN_PROGRESS', color: '#d97706' },
            { label: `Resolved (${resolvedCount})`, filter: 'RESOLVED',  color: '#16a34a' },
          ].map(c => (
            <button key={c.filter} onClick={() => setFilterStatus(prev => prev === c.filter ? '' : c.filter)}
              style={{ padding: '5px 14px', background: filterStatus === c.filter ? c.color : '#f8fafc', color: filterStatus === c.filter ? '#fff' : c.color, border: `1px solid ${c.color}40`, borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        {/* Type chips */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterType('')}
            style={{ padding: '4px 11px', border: `1px solid ${!filterType ? '#2563eb' : '#e2e8f0'}`, borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: !filterType ? 700 : 400, background: !filterType ? '#eff6ff' : '#fff', color: !filterType ? '#2563eb' : '#64748b', fontFamily: 'inherit' }}>
            All Types
          </button>
          {ISSUE_TYPES.map(t => (
            <button key={t.value} onClick={() => setFilterType(prev => prev === t.value ? '' : t.value)}
              style={{ padding: '4px 11px', border: `1px solid ${filterType === t.value ? t.color : '#e2e8f0'}`, borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: filterType === t.value ? 700 : 400, background: filterType === t.value ? `${t.color}12` : '#fff', color: filterType === t.value ? t.color : '#64748b', fontFamily: 'inherit' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {(filterStatus || filterType) && (
          <button onClick={() => { setFilterStatus(''); setFilterType(''); }}
            style={{ padding: '5px 12px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span className="spinner" /> Loading tickets…
        </div>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🎫</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', marginBottom: 6 }}>No tickets found</div>
          <div style={{ fontSize: 13 }}>Raise a new ticket using the form.</div>
        </div>
      ) : (
        <div className="table-container" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Ticket #</th>
                <th style={{ textAlign: 'left' }}>Subject</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Attach.</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, idx) => {
                const statusMeta = STATUS_META[t.status] || {};
                const typeMeta   = ISSUE_TYPES.find(it => it.value === t.issueType) || {};
                const prioMeta   = PRIORITY_OPTIONS.find(p => p.value === t.priority) || {};
                return (
                  <tr key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    style={{ cursor: 'pointer', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfc'}>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{t.ticketNumber}</span>
                    </td>
                    <td style={{ padding: '12px 14px', maxWidth: 280 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.email}</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${typeMeta.color || '#64748b'}12`, color: typeMeta.color || '#64748b', fontWeight: 700 }}>
                        {typeMeta.icon} {typeMeta.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: prioMeta.color || '#64748b' }}>{prioMeta.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.color}30`, whiteSpace: 'nowrap' }}>
                        ● {statusMeta.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {fmtShort(t.createdAt)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                      {t.attachments?.length > 0
                        ? <span style={{ color: '#2563eb', fontWeight: 700 }}>📎 {t.attachments.length}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <button onClick={() => fetch(page - 1)} disabled={page === 0}
            style={{ padding: '7px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: page === 0 ? 0.5 : 1, fontWeight: 600 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Page {page + 1} of {totalPages}</span>
          <button onClick={() => fetch(page + 1)} disabled={page >= totalPages - 1}
            style={{ padding: '7px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: page >= totalPages - 1 ? 0.5 : 1, fontWeight: 600 }}>
            Next →
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selectedId && (
        <TicketDetailModal ticketId={selectedId} onClose={() => setSelectedId(null)} onStatusUpdate={() => fetch(page)} />
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Support = () => {
  const { user } = useAuth();
  const [tab, setTab]         = useState('new');
  const [vehicles, setVehicles] = useState([]);
  const [groups, setGroups]   = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    Promise.all([getVehicles(), getGroups()])
      .then(([vRes, gRes]) => { setVehicles(vRes.data || []); setGroups(gRes.data || []); })
      .catch(() => {});
  }, []);

  const onTicketCreated = () => {
    setRefreshKey(k => k + 1);
    setTab('list');
  };

  return (
    <div style={{ padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Page title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Support Center</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('new')}
            style={{ padding: '8px 18px', background: tab === 'new' ? '#2563eb' : '#f1f5f9', border: tab === 'new' ? 'none' : '1px solid #e2e8f0', color: tab === 'new' ? '#fff' : '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit' }}>
            + New Ticket
          </button>
          <button onClick={() => setTab('list')}
            style={{ padding: '8px 18px', background: tab === 'list' ? '#2563eb' : '#f1f5f9', border: tab === 'list' ? 'none' : '1px solid #e2e8f0', color: tab === 'list' ? '#fff' : '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit' }}>
            📋 My Tickets
          </button>
        </div>
      </div>

      {tab === 'new'  && <NewTicketForm vehicles={vehicles} groups={groups} user={user} onSuccess={onTicketCreated} />}
      {tab === 'list' && <TicketsList refreshKey={refreshKey} />}
    </div>
  );
};

export default Support;

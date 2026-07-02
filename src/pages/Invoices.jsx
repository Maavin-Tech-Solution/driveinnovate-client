import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { PrinterIcon, ArrowPathIcon, Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import {
  getInvoices, getInvoice, renewVehicle, setVehicleExpiry,
  getBillingSettings, updateBillingSettings, formatCoins, formatVehicles,
} from '../services/billing.service';
import { getVehicles } from '../services/vehicle.service';
import { printInvoice } from '../utils/invoicePrint';

const card = { background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' };   // modal box
const panel = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' };      // page card
const inputStyle = { width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
const btnPrimary = { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const sectionTitle = { fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 14 };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const EmptyState = ({ emoji, title, sub }) => (
  <div style={{ textAlign: 'center', padding: '56px 20px', color: '#94a3b8' }}>
    <div style={{ fontSize: 46, marginBottom: 12 }}>{emoji}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{title}</div>
    {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
  </div>
);

// ── Renew modal ───────────────────────────────────────────────────────────────
// Renewing spends 1 vehicle token and extends billed-till by 1 year.
// Papa additionally gets a manual expiry override (no token spend).
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const RenewModal = ({ isPapa, onClose, onDone }) => {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [saving, setSaving] = useState(false);
  const [ovrActual, setOvrActual] = useState('');
  const [ovrGrace, setOvrGrace] = useState('');
  const [savingOvr, setSavingOvr] = useState(false);

  useEffect(() => {
    getVehicles().then(r => setVehicles(r.data || [])).catch(() => {});
  }, []);

  const selected = vehicles.find(v => String(v.id) === String(vehicleId));

  // Prefill the override fields when a vehicle is picked.
  useEffect(() => {
    setOvrActual(toDateInput(selected?.subscriptionExpiresAt));
    setOvrGrace(toDateInput(selected?.graceExpiresAt || selected?.subscriptionExpiresAt));
  }, [vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!vehicleId) { toast.error('Select a vehicle'); return; }
    setSaving(true);
    try {
      const res = await renewVehicle(vehicleId);
      toast.success(`Renewed — valid till ${fmtDate(res.data.graceExpiresAt || res.data.subscriptionExpiresAt)}`);
      onDone();
    } catch (err) {
      if (err.code === 'INSUFFICIENT_FUNDS') {
        toast.error('No tokens left in the wallet. Recharge it first.');
      } else {
        toast.error(err.message || 'Renewal failed');
      }
    } finally { setSaving(false); }
  };

  const saveOverride = async () => {
    if (!vehicleId) { toast.error('Select a vehicle'); return; }
    if (!ovrActual) { toast.error('Enter the actual expiry date'); return; }
    setSavingOvr(true);
    try {
      await setVehicleExpiry(vehicleId, { subscriptionExpiresAt: ovrActual, graceExpiresAt: ovrGrace || ovrActual });
      toast.success('Vehicle expiry updated');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Failed to update expiry');
    } finally { setSavingOvr(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ ...card, width: 480, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Renew a vehicle</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XMarkIcon style={{ width: 20, color: '#94a3b8' }} /></button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Vehicle</label>
        <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={{ ...inputStyle, margin: '6px 0 14px' }}>
          <option value="">Select a vehicle…</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {(v.vehicleNumber || v.imei || `Vehicle #${v.id}`)}{v.subscriptionExpiresAt ? ` — expires ${fmtDate(v.subscriptionExpiresAt)}` : ' — not activated'}
            </option>
          ))}
        </select>

        {/* Current expiry of the selected vehicle */}
        {selected && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ color: '#64748b' }}>Actual expiry</span>
              <strong style={{ color: '#1e40af' }}>{fmtDate(selected.subscriptionExpiresAt)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ color: '#64748b' }}>Grace expiry</span>
              <strong style={{ color: '#1e40af' }}>{fmtDate(selected.graceExpiresAt || selected.subscriptionExpiresAt)}</strong>
            </div>
          </div>
        )}

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 800, color: '#0f172a' }}>
            <span>Cost</span><span>1 token</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
            Extends by 1 year (+ the client's grace period) from the current expiry.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={submit} disabled={saving || !vehicleId} style={{ ...btnPrimary, opacity: (saving || !vehicleId) ? 0.6 : 1 }}>{saving ? 'Renewing…' : 'Renew (1 token)'}</button>
        </div>

        {/* Papa-only manual override */}
        {isPapa && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed #e2e8f0' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7c3aed', marginBottom: 4 }}>Admin: override expiry</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 10 }}>Sets the dates directly without spending a token.</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Actual expiry</label>
                <input type="date" value={ovrActual} onChange={e => setOvrActual(e.target.value)} style={{ ...inputStyle, margin: '6px 0 0' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Grace expiry</label>
                <input type="date" value={ovrGrace} onChange={e => setOvrGrace(e.target.value)} style={{ ...inputStyle, margin: '6px 0 0' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={saveOverride} disabled={savingOvr || !vehicleId} style={{ ...btnPrimary, background: '#7c3aed', opacity: (savingOvr || !vehicleId) ? 0.6 : 1 }}>{savingOvr ? 'Saving…' : 'Save expiry'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Billing settings modal (issuer GST + branding) ───────────────────────────
const SettingsModal = ({ onClose }) => {
  const [form, setForm] = useState({ gstin: '', invoiceTaxPercent: '', invoicePrefix: '', logoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBillingSettings().then(r => {
      const d = r.data || {};
      setForm({ gstin: d.gstin || '', invoiceTaxPercent: d.invoiceTaxPercent ?? '', invoicePrefix: d.invoicePrefix || '', logoUrl: d.logoUrl || '' });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      await updateBillingSettings(form);
      toast.success('Billing settings saved');
      onClose();
    } catch (err) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const field = (label, key, props = {}) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{label}</label>
      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} {...props} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ ...card, width: 460, maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Invoice settings</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XMarkIcon style={{ width: 20, color: '#94a3b8' }} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>Shown on invoices you issue to your clients.</div>
        {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading…</div> : (
          <>
            {field('GSTIN', 'gstin', { placeholder: '22AAAAA0000A1Z5' })}
            {field('Default GST %', 'invoiceTaxPercent', { type: 'number', min: 0, max: 100, placeholder: 'e.g. 18 (blank = network default)' })}
            {field('Invoice number prefix', 'invoicePrefix', { placeholder: 'INV', maxLength: 12 })}
            {field('Company logo URL', 'logoUrl', { placeholder: 'https://…/logo.png' })}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={onClose} style={btnGhost}>Cancel</button>
              <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Invoices = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'papa' || user?.permissions?.canManageBilling === true;

  const [data, setData] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRenew, setShowRenew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [printingId, setPrintingId] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await getInvoices({ page, limit: 25, type: typeFilter || undefined });
      setData(res.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load invoices');
    } finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(1); }, [load]);

  const doPrint = async (id) => {
    setPrintingId(id);
    try {
      const res = await getInvoice(id);
      if (!printInvoice(res.data)) toast.error('Pop-up blocked — allow pop-ups to print.');
    } catch (err) { toast.error(err.message || 'Failed to open invoice'); }
    finally { setPrintingId(null); }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  const FILTERS = [
    { label: 'All', value: '' },
    { label: 'Recharges', value: 'RECHARGE' },
    { label: 'Renewals', value: 'RENEWAL' },
    { label: 'Activations', value: 'ACTIVATION' },
  ];

  return (
    <div style={{ padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Page title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Invoices</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage && (
            <button onClick={() => setShowSettings(true)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cog6ToothIcon style={{ width: 16 }} /> Invoice settings
            </button>
          )}
          <button onClick={() => setShowRenew(true)} style={{ padding: '8px 18px', background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowPathIcon style={{ width: 16 }} /> Renew vehicle
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Filters */}
        <div style={{ ...panel, padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginRight: 4 }}>Show:</span>
          {FILTERS.map(f => (
            <button key={f.value || 'all'} onClick={() => setTypeFilter(f.value)}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${typeFilter === f.value ? '#2563eb' : '#e2e8f0'}`,
                background: typeFilter === f.value ? '#2563eb' : '#fff',
                color: typeFilter === f.value ? '#fff' : '#64748b' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Invoice list */}
        <div style={panel}>
          <div style={sectionTitle}>Invoices</div>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><span className="spinner" /> Loading invoices…</div>
          ) : data.rows.length === 0 ? (
            <EmptyState emoji="🧾" title="No invoices yet" sub="Recharges and renewals generate printable bills here." />
          ) : (
            <>
              <div className="table-container" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Invoice #</th>
                      <th style={{ textAlign: 'left' }}>Date</th>
                      <th style={{ textAlign: 'left' }}>Billed to</th>
                      <th>Type</th>
                      <th>Tokens</th>
                      <th>Total</th>
                      <th>Print</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(inv => (
                      <tr key={inv.id}>
                        <td style={{ textAlign: 'left', fontWeight: 700, color: '#2563eb', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{inv.invoiceNumber}</td>
                        <td style={{ textAlign: 'left', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(inv.createdAt)}</td>
                        <td style={{ textAlign: 'left', color: '#0f172a', fontWeight: 600 }}>{inv.client?.name || inv.clientSnapshot?.name || '—'}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: inv.type === 'RECHARGE' ? '#dcfce7' : '#f3e8ff', color: inv.type === 'RECHARGE' ? '#15803d' : '#7c3aed' }}>
                            {inv.type === 'RECHARGE' ? 'Recharge' : inv.type === 'ACTIVATION' ? 'Activation' : 'Renewal'}
                          </span>
                        </td>
                        <td style={{ color: '#475569', fontWeight: 600 }}>{inv.vehicleCount ?? (inv.vehicleSnapshot?.vehicleNumber ? 1 : '—')}</td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>{formatCoins(inv.totalAmount)}</td>
                        <td>
                          <button onClick={() => doPrint(inv.id)} disabled={printingId === inv.id} style={{ ...btnGhost, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <PrinterIcon style={{ width: 14 }} /> {printingId === inv.id ? '…' : 'Print'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }}>
                  <button disabled={data.page <= 1} onClick={() => load(data.page - 1)} style={{ ...btnGhost, opacity: data.page <= 1 ? 0.5 : 1 }}>← Prev</button>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Page {data.page} of {totalPages}</span>
                  <button disabled={data.page >= totalPages} onClick={() => load(data.page + 1)} style={{ ...btnGhost, opacity: data.page >= totalPages ? 0.5 : 1 }}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showRenew && <RenewModal isPapa={user?.role === 'papa'} onClose={() => setShowRenew(false)} onDone={() => { setShowRenew(false); load(1); }} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default Invoices;

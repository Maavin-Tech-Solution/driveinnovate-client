import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { TruckIcon, ArrowUpRightIcon, ArrowDownLeftIcon, SparklesIcon, PlusIcon, XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import {
  getMyWallet, getTransactions, getNetworkWallets,
  mintCoins, transferCoins, formatCoins, formatVehicles,
} from '../services/billing.service';
import { getParentContact } from '../services/user.service';

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const card = { background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' };   // modal box
const panel = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' };      // page card
const sectionTitle = { fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 14 };
const inputStyle = { width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
const btnPrimary = { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };

const EmptyState = ({ emoji, title, sub }) => (
  <div style={{ textAlign: 'center', padding: '56px 20px', color: '#94a3b8' }}>
    <div style={{ fontSize: 46, marginBottom: 12 }}>{emoji}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{title}</div>
    {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
  </div>
);

const REF_LABELS = {
  MINT: 'Minted', TRANSFER: 'Recharge', VEHICLE_ACTIVATION: 'Vehicle activation',
  VEHICLE_RENEWAL: 'Vehicle renewal', MANUAL_ADJUST: 'Adjustment', REVERSAL: 'Reversal',
};

// ── Recharge (vehicle-token) modal ───────────────────────────────────────────
// Parent enters number of vehicles + per-vehicle price; that many TOKENS move
// down. The ₹ value (vehicles × price) is captured on the invoice.
const TransferModal = ({ child, onClose, onDone }) => {
  const [vehicles, setVehicles] = useState('');
  const [price, setPrice] = useState(child.monthlyPrice ? String(child.monthlyPrice) : '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const count = Number(vehicles);
  const unit = Number(price);
  const validCount = Number.isInteger(count) && count > 0;
  const validPrice = unit >= 0 && price !== '';
  const baseValue = validCount && validPrice ? unit * count : 0;

  const submit = async () => {
    if (!validCount) { toast.error('Enter the number of tokens'); return; }
    if (!validPrice) { toast.error('Enter the per-token price'); return; }
    setSaving(true);
    try {
      const res = await transferCoins(child.id, { vehicles: count, unitPrice: unit, note });
      toast.success(`Added ${formatVehicles(res.data.vehicles)} to ${child.name} (invoice ${res.data.invoiceNumber})`);
      onDone(res.data);
    } catch (err) {
      if (err.code === 'INSUFFICIENT_FUNDS') {
        toast.error(`You only have ${formatVehicles(err.details?.balance)} in your wallet — mint or get more first.`);
      } else {
        toast.error(err.message || 'Recharge failed');
      }
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ ...card, width: 450, maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Recharge {child.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XMarkIcon style={{ width: 20, color: '#94a3b8' }} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
          Tokens move from your wallet into theirs. Each token = 1 vehicle subscription (+ the client's grace period).
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Number of tokens</label>
            <input type="number" min="1" step="1" autoFocus value={vehicles} onChange={e => setVehicles(e.target.value)} style={{ ...inputStyle, margin: '6px 0 14px' }} placeholder="e.g. 10" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Price / token (₹/yr)</label>
            <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} style={{ ...inputStyle, margin: '6px 0 14px' }} placeholder="e.g. 1200" />
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#475569' }}>
            <span>{validCount ? count : 0} token{count === 1 ? '' : 's'} × {formatCoins(validPrice ? unit : 0)}</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatCoins(baseValue)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Invoice value (before GST). They receive {validCount ? count : 0} token{count === 1 ? '' : 's'}.</div>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, margin: '6px 0 18px' }} placeholder="e.g. Q3 top-up" />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={submit} disabled={saving || !validCount || !validPrice} style={{ ...btnPrimary, opacity: (saving || !validCount || !validPrice) ? 0.6 : 1 }}>
            {saving ? 'Adding…' : validCount ? `Add ${count} token${count === 1 ? '' : 's'}` : 'Add tokens'}
          </button>
          {/* recharge is always billable/paid — no token type */}
        </div>
      </div>
    </div>
  );
};

// ── Mint modal (papa only) ───────────────────────────────────────────────────
const MintModal = ({ onClose, onDone }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt <= 0) { toast.error('Enter a whole number of tokens'); return; }
    setSaving(true);
    try {
      const res = await mintCoins(amt, note);
      toast.success(`Minted ${formatVehicles(amt)}`);
      onDone(res.data);
    } catch (err) { toast.error(err.message || 'Mint failed'); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ ...card, width: 420, maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Mint tokens</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XMarkIcon style={{ width: 20, color: '#94a3b8' }} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
          Minting adds tokens into your own wallet — the origin of all tokens in the network. Distribute them to your dealers from the list below.
        </div>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Number of tokens</label>
        <input type="number" min="1" step="1" autoFocus value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, margin: '6px 0 14px' }} placeholder="e.g. 1000" />
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, margin: '6px 0 18px' }} placeholder="e.g. Opening stock" />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...btnPrimary, background: '#7c3aed', opacity: saving ? 0.7 : 1 }}>{saving ? 'Minting…' : 'Mint'}</button>
        </div>
      </div>
    </div>
  );
};

const Wallet = () => {
  const { user } = useAuth();
  const isPapa = user?.role === 'papa';

  const [wallet, setWallet] = useState(null);
  const [children, setChildren] = useState([]);
  const [ledger, setLedger] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transferTarget, setTransferTarget] = useState(null);
  const [showMint, setShowMint] = useState(false);
  // Manager = the server let us list a downline (papa/dealer). null until known.
  const [isManager, setIsManager] = useState(null);

  // Ledger filters
  const [dir, setDir] = useState('');   // '' | 'credit' | 'debit'
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchLedger = useCallback(async (page = 1, override = {}) => {
    const params = {
      page, limit: 25,
      direction: (override.dir ?? dir) || undefined,
      from: (override.from ?? from) || undefined,
      to: (override.to ?? to) || undefined,
    };
    setLedgerLoading(true);
    try { const res = await getTransactions(params); setLedger(res.data); }
    catch (e) { toast.error(e.message || 'Failed to load transactions'); }
    finally { setLedgerLoading(false); }
  }, [dir, from, to]);

  const applyDir = (d) => { setDir(d); fetchLedger(1, { dir: d }); };
  const clearFilters = () => { setDir(''); setFrom(''); setTo(''); fetchLedger(1, { dir: '', from: '', to: '' }); };

  const exportRows = async () => {
    const res = await getTransactions({ limit: 5000, direction: dir || undefined, from: from || undefined, to: to || undefined });
    return res.data.rows || [];
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = await exportRows();
      if (!rows.length) { toast.info('No transactions to export'); return; }
      const data = rows.map(t => ({
        Date: fmtDateTime(t.createdAt),
        Type: REF_LABELS[t.refType] || t.refType,
        Direction: t.amount >= 0 ? 'Credit' : 'Debit',
        Details: t.note || '',
        Counterparty: t.counterpartyName || '',
        Tokens: `${t.amount >= 0 ? '+' : '−'}${Math.abs(t.amount)}`,
        'Balance after': Math.round(t.balanceAfter),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      XLSX.writeFile(wb, `wallet_transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { toast.error(e.message || 'Export failed'); }
    finally { setExporting(false); }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const rows = await exportRows();
      if (!rows.length) { toast.info('No transactions to export'); return; }
      const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const body = rows.map(t => `<tr>
        <td>${esc(fmtDateTime(t.createdAt))}</td>
        <td>${esc(REF_LABELS[t.refType] || t.refType)}</td>
        <td style="color:${t.amount >= 0 ? '#15803d' : '#b91c1c'}">${t.amount >= 0 ? 'Credit' : 'Debit'}</td>
        <td>${esc(t.note || '')}${t.counterpartyName ? ' · ' + esc(t.counterpartyName) : ''}</td>
        <td style="text-align:right">${t.amount >= 0 ? '+' : '−'}${Math.abs(t.amount)}</td>
        <td style="text-align:right">${Math.round(t.balanceAfter)}</td>
      </tr>`).join('');
      const rangeNote = (from || to) ? `Range: ${from || '…'} → ${to || '…'}` : 'All dates';
      const dirNote = dir ? ` · ${dir === 'credit' ? 'Credits' : 'Debits'} only` : '';
      const w = window.open('', '_blank', 'width=1000,height=800');
      if (!w) { toast.error('Pop-up blocked — allow pop-ups to export PDF.'); return; }
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Wallet Transactions</title>
        <style>body{font-family:Segoe UI,Roboto,Arial,sans-serif;padding:28px;color:#1e293b}h1{font-size:20px;margin:0 0 4px}.sub{color:#64748b;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1e293b;color:#fff;text-align:left;padding:8px 10px}td{padding:7px 10px;border-bottom:1px solid #e2e8f0}@media print{body{padding:0}}</style>
        </head><body><h1>Wallet Transactions</h1><div class="sub">${esc(rangeNote)}${esc(dirNote)} · ${rows.length} record(s) · generated ${new Date().toLocaleString('en-IN')}</div>
        <table><thead><tr><th>Date</th><th>Type</th><th>Direction</th><th>Details</th><th style="text-align:right">Tokens</th><th style="text-align:right">Balance</th></tr></thead><tbody>${body}</tbody></table>
        <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script></body></html>`);
      w.document.close();
    } catch (e) { toast.error(e.message || 'Export failed'); }
    finally { setExporting(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, l] = await Promise.all([getMyWallet(), getTransactions({ page: 1, limit: 25 })]);
      setWallet(w.data);
      setLedger(l.data);
      // Ask the server (fresh, authoritative) whether we manage a downline — this
      // works even when the cached session role is stale (a client who just created
      // a sub-account is a dealer now but the login snapshot still says client).
      try {
        const n = await getNetworkWallets();
        setChildren(n.data || []);
        setIsManager(true);
      } catch {
        setIsManager(false);
        try { const p = await getParentContact(); setParent(p.data || null); } catch { /* ignore */ }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load wallet');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 80, textAlign: 'center', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><span className="spinner" /> Loading wallet…</div>;

  const balance = Number(wallet?.balance || 0);
  const lowBalance = balance <= 0;
  const totalPages = Math.ceil(ledger.total / ledger.limit);

  return (
    <div style={{ padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Page title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Wallet</div>
        {isPapa && (
          <button onClick={() => setShowMint(true)} style={{ padding: '8px 18px', background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <SparklesIcon style={{ width: 16 }} /> Mint tokens
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Balance card */}
        <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TruckIcon style={{ width: 28, color: '#2563eb' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available tokens</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', lineHeight: 1.1, marginTop: 2 }}>{balance.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>token{balance === 1 ? '' : 's'} · 1 token = 1 vehicle subscription</div>
          </div>
        </div>

        {/* Low-balance hint for clients (leaf accounts with no downline) */}
        {isManager === false && lowBalance && (
          <div style={{ ...panel, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>You have no tokens left</div>
            <div style={{ fontSize: 13, color: '#a16207' }}>
              You need tokens to add or renew vehicles. Ask your dealer{parent?.name ? <> <strong>{parent.name}</strong></> : ''} to recharge your wallet
              {parent?.phone ? <> — {parent.phone}</> : ''}{parent?.email ? <> · {parent.email}</> : ''}.
            </div>
          </div>
        )}

        {/* Network wallets (dealer/papa) */}
        {isManager && (
          <div style={panel}>
            <div style={sectionTitle}>Your clients' wallets</div>
            {children.length === 0 ? (
              <EmptyState emoji="👥" title="No clients yet" sub="Clients you add will appear here to recharge." />
            ) : (
              <div className="table-container" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Client</th>
                      <th>Tokens in wallet</th>
                      <th>Price / token / yr</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map(c => (
                      <tr key={c.id}>
                        <td style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {c.name}
                            {c.billingType === 'prepaid'
                              ? <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#dcfce7', color: '#15803d' }}>prepaid</span>
                              : <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#f1f5f9', color: '#64748b' }}>postpaid</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{c.email}</div>
                        </td>
                        <td style={{ fontWeight: 700, color: c.balance <= 0 ? '#dc2626' : '#15803d' }}>{formatVehicles(c.balance)}</td>
                        <td style={{ color: '#475569' }}>
                          {formatCoins(c.monthlyPrice)}
                          {c.rateSource === 'default' && <span style={{ marginLeft: 6, fontSize: 10.5, color: '#94a3b8' }}>(default)</span>}
                        </td>
                        <td>
                          <button onClick={() => setTransferTarget(c)} style={{ ...btnPrimary, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <PlusIcon style={{ width: 14 }} /> Recharge
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Ledger */}
        <div style={panel}>
          {/* Header: title + export */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Transaction history</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportExcel} disabled={exporting} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: exporting ? 0.6 : 1 }}>
                <ArrowDownTrayIcon style={{ width: 14 }} /> Excel
              </button>
              <button onClick={exportPdf} disabled={exporting} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: exporting ? 0.6 : 1 }}>
                <ArrowDownTrayIcon style={{ width: 14 }} /> PDF
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
            {[{ label: 'All', v: '' }, { label: 'Credit', v: 'credit' }, { label: 'Debit', v: 'debit' }].map(f => (
              <button key={f.v || 'all'} onClick={() => applyDir(f.v)}
                style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${dir === f.v ? '#2563eb' : '#e2e8f0'}`,
                  background: dir === f.v ? '#2563eb' : '#fff',
                  color: dir === f.v ? '#fff' : '#64748b' }}>
                {f.label}
              </button>
            ))}
            <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 2px' }} />
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, color: '#0f172a', fontFamily: 'inherit' }} />
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, color: '#0f172a', fontFamily: 'inherit' }} />
            <button onClick={() => fetchLedger(1)} style={{ ...btnPrimary, padding: '6px 14px' }}>Apply</button>
            {(dir || from || to) && (
              <button onClick={clearFilters} style={{ ...btnGhost, padding: '6px 12px' }}>✕ Clear</button>
            )}
          </div>

          {ledgerLoading ? (
            <div style={{ padding: 50, textAlign: 'center', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><span className="spinner" /> Loading…</div>
          ) : ledger.rows.length === 0 ? (
            <EmptyState emoji="🧾" title={dir || from || to ? 'No matching transactions' : 'No transactions yet'} sub={dir || from || to ? 'Try adjusting the filters.' : 'Recharges and vehicle activations will show up here.'} />
          ) : (
            <>
              <div className="table-container" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Date</th>
                      <th style={{ textAlign: 'left' }}>Type</th>
                      <th style={{ textAlign: 'left' }}>Details</th>
                      <th>Tokens</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.rows.map(t => {
                      const credit = t.amount >= 0;
                      return (
                        <tr key={t.id}>
                          <td style={{ textAlign: 'left', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDateTime(t.createdAt)}</td>
                          <td style={{ textAlign: 'left' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: credit ? '#15803d' : '#b91c1c' }}>
                              {credit ? <ArrowDownLeftIcon style={{ width: 14 }} /> : <ArrowUpRightIcon style={{ width: 14 }} />}
                              {REF_LABELS[t.refType] || t.refType}
                            </span>
                          </td>
                          <td style={{ textAlign: 'left', color: '#475569' }}>
                            {t.note || '—'}
                            {t.counterpartyName && <span style={{ color: '#94a3b8' }}> · {t.counterpartyName}</span>}
                          </td>
                          <td style={{ fontWeight: 700, color: credit ? '#15803d' : '#b91c1c' }}>{credit ? '+' : '−'}{Math.abs(t.amount)}</td>
                          <td style={{ color: '#64748b' }}>{Math.round(t.balanceAfter)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }}>
                  <button disabled={ledger.page <= 1} onClick={() => fetchLedger(ledger.page - 1)} style={{ ...btnGhost, opacity: ledger.page <= 1 ? 0.5 : 1 }}>← Prev</button>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Page {ledger.page} of {totalPages}</span>
                  <button disabled={ledger.page >= totalPages} onClick={() => fetchLedger(ledger.page + 1)} style={{ ...btnGhost, opacity: ledger.page >= totalPages ? 0.5 : 1 }}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {transferTarget && <TransferModal child={transferTarget} onClose={() => setTransferTarget(null)} onDone={() => { setTransferTarget(null); load(); }} />}
      {showMint && <MintModal onClose={() => setShowMint(false)} onDone={() => { setShowMint(false); load(); }} />}
    </div>
  );
};

export default Wallet;

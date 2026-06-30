import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { TruckIcon, ArrowUpRightIcon, ArrowDownLeftIcon, SparklesIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import {
  getMyWallet, getTransactions, getNetworkWallets,
  mintCoins, transferCoins, formatCoins, formatVehicles, TOKEN_TYPE_OPTIONS,
} from '../services/billing.service';
import { getParentContact } from '../services/user.service';

const card = { background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' };
const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' };
const btnPrimary = { padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' };
const btnGhost = { padding: '9px 16px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };

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
  const [graceDays, setGraceDays] = useState(child.graceDays != null ? String(child.graceDays) : '0');
  const [tokenType, setTokenType] = useState('PAID');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isFree = tokenType !== 'PAID';
  const count = Number(vehicles);
  const unit = Number(price);
  const validCount = Number.isInteger(count) && count > 0;
  const validPrice = isFree || (unit >= 0 && price !== '');
  const baseValue = !isFree && validCount && validPrice ? unit * count : 0;
  const graceNum = graceDays === '' ? 0 : Number(graceDays);
  const validGrace = Number.isInteger(graceNum) && graceNum >= 0;

  const submit = async () => {
    if (!validCount) { toast.error('Enter the number of vehicles'); return; }
    if (!validPrice) { toast.error('Enter the per-vehicle price'); return; }
    if (!validGrace) { toast.error('Grace days must be a whole number ≥ 0'); return; }
    setSaving(true);
    try {
      const res = await transferCoins(child.id, {
        vehicles: count,
        unitPrice: isFree ? undefined : unit,
        graceDays: graceNum,
        tokenType,
        note,
      });
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
          The vehicles move from your wallet into theirs. Each = 1 vehicle for 1 year.
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Number of vehicles</label>
            <input type="number" min="1" step="1" autoFocus value={vehicles} onChange={e => setVehicles(e.target.value)} style={{ ...inputStyle, margin: '6px 0 14px' }} placeholder="e.g. 10" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Price / vehicle (₹/yr)</label>
            <input type="number" min="0" value={isFree ? '' : price} onChange={e => setPrice(e.target.value)} disabled={isFree} style={{ ...inputStyle, margin: '6px 0 14px', background: isFree ? '#f1f5f9' : '#fff', color: isFree ? '#94a3b8' : '#1e293b' }} placeholder={isFree ? 'Free' : 'e.g. 1200'} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Token type</label>
            <select value={tokenType} onChange={e => setTokenType(e.target.value)} style={{ ...inputStyle, margin: '6px 0 14px' }}>
              {TOKEN_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Grace period (days)</label>
            <input type="number" min="0" step="1" value={graceDays} onChange={e => setGraceDays(e.target.value)} style={{ ...inputStyle, margin: '6px 0 14px' }} placeholder="e.g. 15" />
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#475569' }}>
            <span>{validCount ? count : 0} vehicle{count === 1 ? '' : 's'}{isFree ? ' (free)' : ` × ${formatCoins(validPrice ? unit : 0)}`}</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{isFree ? '₹0.00' : formatCoins(baseValue)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
            {isFree ? 'Free grant — excluded from revenue. ' : 'Invoice value (before GST). '}
            Each vehicle they activate will be valid for 1 year{graceNum > 0 ? ` + ${graceNum} day${graceNum === 1 ? '' : 's'} grace` : ''}.
          </div>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, margin: '6px 0 18px' }} placeholder="e.g. Q3 top-up" />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={submit} disabled={saving || !validCount || !validPrice} style={{ ...btnPrimary, opacity: (saving || !validCount || !validPrice) ? 0.6 : 1 }}>
            {saving ? 'Adding…' : validCount ? `Add ${count} vehicle${count === 1 ? '' : 's'}` : 'Add vehicles'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Mint modal (papa only) ───────────────────────────────────────────────────
const MintModal = ({ onClose, onDone }) => {
  const [amount, setAmount] = useState('');
  const [tokenType, setTokenType] = useState('PAID');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt <= 0) { toast.error('Enter a whole number of vehicles'); return; }
    setSaving(true);
    try {
      const res = await mintCoins(amt, note, tokenType);
      toast.success(`Minted ${formatVehicles(amt)}`);
      onDone(res.data);
    } catch (err) { toast.error(err.message || 'Mint failed'); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ ...card, width: 420, maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Mint vehicle tokens</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XMarkIcon style={{ width: 20, color: '#94a3b8' }} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
          Minting adds vehicle tokens into your own wallet — the origin of all tokens in the network. Distribute them to your dealers from the list below.
        </div>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Number of vehicles</label>
        <input type="number" min="1" step="1" autoFocus value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, margin: '6px 0 14px' }} placeholder="e.g. 1000" />
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Token type</label>
        <select value={tokenType} onChange={e => setTokenType(e.target.value)} style={{ ...inputStyle, margin: '6px 0 4px' }}>
          {TOKEN_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 14 }}>Testing/Grace tokens are free and excluded from revenue/accounting.</div>
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
  const canManage = user?.role === 'papa' || user?.permissions?.canManageBilling === true;
  const isPapa = user?.role === 'papa';

  const [wallet, setWallet] = useState(null);
  const [children, setChildren] = useState([]);
  const [ledger, setLedger] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transferTarget, setTransferTarget] = useState(null);
  const [showMint, setShowMint] = useState(false);

  const loadLedger = useCallback(async (page = 1) => {
    try {
      const res = await getTransactions({ page, limit: 25 });
      setLedger(res.data);
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, l] = await Promise.all([getMyWallet(), getTransactions({ page: 1, limit: 25 })]);
      setWallet(w.data);
      setLedger(l.data);
      if (canManage) {
        try { const n = await getNetworkWallets(); setChildren(n.data || []); } catch { /* ignore */ }
      } else {
        try { const p = await getParentContact(); setParent(p.data || null); } catch { /* ignore */ }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load wallet');
    } finally { setLoading(false); }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  const balance = Number(wallet?.balance || 0);
  const lowBalance = balance <= 0;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Wallet</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Vehicle tokens · 1 token = 1 vehicle for 1 year</div>
        </div>
        {isPapa && <button onClick={() => setShowMint(true)} style={{ ...btnPrimary, background: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}><SparklesIcon style={{ width: 16 }} /> Mint tokens</button>}
      </div>

      {/* Balance card */}
      <div style={{ ...card, background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', border: 'none', color: '#fff', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12.5, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Available vehicles</div>
            <div style={{ fontSize: 38, fontWeight: 800, marginTop: 4 }}>{balance.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12.5, opacity: 0.85 }}>total vehicle token{balance === 1 ? '' : 's'}</div>
          </div>
          <TruckIcon style={{ width: 56, opacity: 0.5 }} />
        </div>
        {/* Per-type breakdown */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Paid', val: wallet?.balancePaid },
            { label: 'Testing', val: wallet?.balanceTesting },
            { label: 'Grace', val: wallet?.balanceGrace },
          ].map(t => (
            <div key={t.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 12px', fontSize: 12.5 }}>
              <span style={{ opacity: 0.85 }}>{t.label}: </span><strong>{Number(t.val || 0).toLocaleString('en-IN')}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Low-balance hint for clients */}
      {!canManage && lowBalance && (
        <div style={{ ...card, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>You have no vehicles left</div>
          <div style={{ fontSize: 13, color: '#a16207' }}>
            You need vehicle tokens to add or renew vehicles. Ask your dealer{parent?.name ? <> <strong>{parent.name}</strong></> : ''} to recharge your wallet
            {parent?.phone ? <> — {parent.phone}</> : ''}{parent?.email ? <> · {parent.email}</> : ''}.
          </div>
        </div>
      )}

      {/* Network wallets (dealer/papa) */}
      {canManage && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>Your clients' wallets</div>
          {children.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>You have no direct clients yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '8px 10px' }}>Client</th>
                    <th style={{ padding: '8px 10px' }}>Vehicles in wallet</th>
                    <th style={{ padding: '8px 10px' }}>Price / vehicle / yr</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {c.name}
                          {c.billingType === 'prepaid'
                            ? <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#dcfce7', color: '#15803d' }}>prepaid</span>
                            : <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#f1f5f9', color: '#64748b' }}>postpaid</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.email}</div>
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700, color: c.balance <= 0 ? '#dc2626' : '#15803d' }}>{formatVehicles(c.balance)}</td>
                      <td style={{ padding: '10px', color: '#475569' }}>
                        {formatCoins(c.monthlyPrice)}
                        {c.rateSource === 'default' && <span style={{ marginLeft: 6, fontSize: 10.5, color: '#94a3b8' }}>(default)</span>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button onClick={() => setTransferTarget(c)} style={{ ...btnPrimary, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>Transaction history</div>
        {ledger.rows.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No transactions yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '8px 10px' }}>Date</th>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px' }}>Details</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Vehicles</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map(t => {
                  const credit = t.amount >= 0;
                  return (
                    <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', color: '#475569', whiteSpace: 'nowrap' }}>{new Date(t.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: credit ? '#15803d' : '#b91c1c' }}>
                          {credit ? <ArrowDownLeftIcon style={{ width: 14 }} /> : <ArrowUpRightIcon style={{ width: 14 }} />}
                          {REF_LABELS[t.refType] || t.refType}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: '#475569' }}>
                        {t.note || '—'}
                        {t.counterpartyName && <span style={{ color: '#94a3b8' }}> · {t.counterpartyName}</span>}
                        {t.tokenType && t.tokenType !== 'PAID' && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#fef3c7', color: '#92400e', textTransform: 'capitalize' }}>{t.tokenType.toLowerCase()}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: credit ? '#15803d' : '#b91c1c' }}>{credit ? '+' : '−'}{Math.abs(t.amount)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#64748b' }}>{Math.round(t.balanceAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Pagination */}
            {ledger.total > ledger.limit && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button disabled={ledger.page <= 1} onClick={() => loadLedger(ledger.page - 1)} style={{ ...btnGhost, opacity: ledger.page <= 1 ? 0.5 : 1 }}>Prev</button>
                <span style={{ fontSize: 12.5, color: '#64748b', alignSelf: 'center' }}>Page {ledger.page} of {Math.ceil(ledger.total / ledger.limit)}</span>
                <button disabled={ledger.page >= Math.ceil(ledger.total / ledger.limit)} onClick={() => loadLedger(ledger.page + 1)} style={{ ...btnGhost, opacity: ledger.page >= Math.ceil(ledger.total / ledger.limit) ? 0.5 : 1 }}>Next</button>
              </div>
            )}
          </div>
        )}
      </div>

      {transferTarget && <TransferModal child={transferTarget} onClose={() => setTransferTarget(null)} onDone={() => { setTransferTarget(null); load(); }} />}
      {showMint && <MintModal onClose={() => setShowMint(false)} onDone={() => { setShowMint(false); load(); }} />}
    </div>
  );
};

export default Wallet;

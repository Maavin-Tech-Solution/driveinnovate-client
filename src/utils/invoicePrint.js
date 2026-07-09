// Builds a self-contained printable HTML invoice (GST + branding) and opens it
// in a new window, triggering the browser print dialog. Kept framework-free so
// the printed page is clean letterhead with no app chrome.
import { formatCoins } from '../services/billing.service';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const party = (p, title) => `
  <div class="party">
    <div class="party-title">${title}</div>
    <div class="party-name">${esc(p?.company || p?.name || '—')}</div>
    ${p?.company && p?.name ? `<div>${esc(p.name)}</div>` : ''}
    ${p?.address ? `<div>${esc(p.address)}</div>` : ''}
    ${p?.phone ? `<div>Phone: ${esc(p.phone)}</div>` : ''}
    ${p?.email ? `<div>${esc(p.email)}</div>` : ''}
    ${p?.gstin ? `<div><strong>GSTIN:</strong> ${esc(p.gstin)}</div>` : ''}
  </div>`;

export const buildInvoiceHtml = (inv) => {
  const issuer = inv.issuerSnapshot || {};
  const client = inv.clientSnapshot || {};
  const veh = inv.vehicleSnapshot || {};
  const isRecharge = inv.type === 'RECHARGE';
  const qty = isRecharge ? (inv.vehicleCount || 0) : 1;
  const SAC_CODE = '997331'; // GST Service Accounting Code for the subscription service
  const taxRow = Number(inv.taxPercent) > 0
    ? `<tr><td class="r" colspan="4">GST (${Number(inv.taxPercent)}%)</td><td class="r">${formatCoins(inv.taxAmount)}</td></tr>`
    : '';
  const lineDesc = isRecharge
    ? `Vehicle subscription tokens — ${qty}`
    : `Vehicle ${inv.type === 'ACTIVATION' ? 'activation' : 'renewal'}`;
  const metaHtml = isRecharge
    ? `<div><span>Vehicle tokens:</span> <strong>${qty}</strong></div>`
    : `<div><span>Vehicle:</span> <strong>${esc(veh.vehicleNumber || veh.imei || '—')}</strong></div>
       <div><span>Billed till:</span> ${fmtDate(inv.periodEnd)}</div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(inv.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px; }
  .sheet { max-width: 800px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4ed8; padding-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { height: 54px; }
  .brand .co { font-size: 22px; font-weight: 800; color: #1d4ed8; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; font-size: 26px; letter-spacing: 2px; color: #0f172a; }
  .doc .num { font-size: 13px; color: #475569; margin-top: 4px; }
  .badge { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #dcfce7; color: #15803d; }
  .parties { display: flex; gap: 40px; margin: 26px 0; }
  .party { flex: 1; font-size: 12.5px; line-height: 1.6; }
  .party-title { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
  .party-name { font-size: 14px; font-weight: 800; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
  td { padding: 11px 12px; border-bottom: 1px solid #eef2f7; }
  td.r, th.r { text-align: right; }
  .total td { border-top: 2px solid #1d4ed8; border-bottom: none; font-weight: 800; font-size: 15px; color: #0f172a; padding-top: 14px; }
  .meta { display: flex; gap: 40px; margin: 22px 0 4px; font-size: 12.5px; }
  .meta div span { color: #94a3b8; }
  .foot { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style></head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="brand">
        ${issuer.logoUrl ? `<img src="${esc(issuer.logoUrl)}" alt="logo"/>` : ''}
        <div class="co">${esc(issuer.company || issuer.name || 'Tax Invoice')}</div>
      </div>
      <div class="doc">
        <h1>INVOICE</h1>
        <div class="num">${esc(inv.invoiceNumber)}</div>
        <div class="num">Date: ${fmtDate(inv.createdAt)}</div>
        <div class="badge">${esc(inv.status)}</div>
      </div>
    </div>

    <div class="parties">
      ${party(issuer, 'From')}
      ${party(client, 'Bill To')}
    </div>

    <div class="meta">
      ${metaHtml}
    </div>

    <table>
      <thead><tr><th>Description</th><th class="r">SAC</th><th class="r">Qty</th><th class="r">Rate / token</th><th class="r">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>${esc(lineDesc)}</td>
          <td class="r">${SAC_CODE}</td>
          <td class="r">${qty}</td>
          <td class="r">${formatCoins(inv.monthlyPrice)}</td>
          <td class="r">${formatCoins(inv.baseAmount)}</td>
        </tr>
        <tr><td class="r" colspan="4">Subtotal</td><td class="r">${formatCoins(inv.baseAmount)}</td></tr>
        ${taxRow}
        <tr class="total"><td class="r" colspan="4">Total</td><td class="r">${formatCoins(inv.totalAmount)}</td></tr>
      </tbody>
    </table>

    <div class="foot">
      Each token = 1 vehicle subscription · SAC ${SAC_CODE}. This is a computer-generated invoice.
    </div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;
};

export const printInvoice = (inv) => {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(buildInvoiceHtml(inv));
  w.document.close();
  return true;
};

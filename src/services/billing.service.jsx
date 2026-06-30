import api from './api';

// ── Wallet ────────────────────────────────────────────────────────────────
export const getMyWallet      = ()                 => api.get('/billing/wallet');
export const getTransactions  = (params = {})      => api.get('/billing/wallet/transactions', { params });
export const getNetworkWallets= ()                 => api.get('/billing/network/wallets');

// ── Coin chain ────────────────────────────────────────────────────────────
// Mint vehicle tokens (papa). amount = whole number of vehicle tokens; tokenType = PAID|TESTING|GRACE.
export const mintCoins        = (amount, note, tokenType = 'PAID') => api.post('/billing/mint', { amount, note, tokenType });
// Recharge a child with vehicle tokens. { vehicles, unitPrice?, graceDays?, tokenType? }.
export const transferCoins    = (toUserId, { vehicles, unitPrice, graceDays, tokenType, note } = {}) => api.post('/billing/transfer', { toUserId, vehicles, unitPrice, graceDays, tokenType, note });

// ── Rates ─────────────────────────────────────────────────────────────────
export const getRates         = ()                 => api.get('/billing/rates');
export const setRate          = (clientId, monthlyPrice) => api.put(`/billing/rates/${clientId}`, { monthlyPrice });

// ── Recharge quote (preview ₹ for a token sale) ───────────────────────────
export const getRechargeQuote = (toUserId, vehicles, unitPrice) => api.get('/billing/quote', { params: { toUserId, vehicles, unitPrice } });

// ── Renew (spends 1 token of tokenType; duration depends on the type) ──────
export const renewVehicle     = (vehicleId, tokenType = 'PAID') => api.post(`/billing/vehicles/${vehicleId}/renew`, { tokenType });

// ── Papa: manually override a vehicle's expiry (no token spend) ───────────
export const setVehicleExpiry = (vehicleId, data)  => api.put(`/billing/vehicles/${vehicleId}/expiry`, data);

// Token types selectable when minting / recharging.
export const TOKEN_TYPE_OPTIONS = [
  { value: 'PAID',    label: 'Paid (billable)',        free: false },
  { value: 'TESTING', label: 'Testing (free)',         free: true  },
  { value: 'GRACE',   label: 'Grace / complimentary',  free: true  },
];

// ── Invoices ──────────────────────────────────────────────────────────────
export const getInvoices      = (params = {})      => api.get('/billing/invoices', { params });
export const getInvoice       = (id)               => api.get(`/billing/invoices/${id}`);

// ── Issuer billing settings (GST + branding) ──────────────────────────────
export const getBillingSettings    = ()            => api.get('/billing/settings');
export const updateBillingSettings = (data)        => api.put('/billing/settings', data);

// Billing cycle is fixed at 1 year — 1 token = 1 vehicle for 1 year.
export const SUBSCRIPTION_LABEL = '1 year';

// ₹ amount formatter (invoices, recharge value).
export const formatCoins = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Vehicle-token formatter (wallet balances, ledger).
export const formatVehicles = (n) => {
  const v = Number(n || 0);
  return `${v.toLocaleString('en-IN')} vehicle${v === 1 ? '' : 's'}`;
};

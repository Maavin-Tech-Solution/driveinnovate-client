import api from './api';

// ── Wallet ────────────────────────────────────────────────────────────────
export const getMyWallet      = ()                 => api.get('/billing/wallet');
export const getTransactions  = (params = {})      => api.get('/billing/wallet/transactions', { params });
export const getNetworkWallets= ()                 => api.get('/billing/network/wallets');

// ── Coin chain ────────────────────────────────────────────────────────────
// Mint vehicle tokens (papa). amount = whole number of vehicle tokens.
export const mintCoins        = (amount, note) => api.post('/billing/mint', { amount, note });
// Recharge a child with vehicle tokens. { vehicles, unitPrice? }.
export const transferCoins    = (toUserId, { vehicles, unitPrice, note } = {}) => api.post('/billing/transfer', { toUserId, vehicles, unitPrice, note });

// ── Rates ─────────────────────────────────────────────────────────────────
export const getRates         = ()                 => api.get('/billing/rates');
export const setRate          = (clientId, monthlyPrice) => api.put(`/billing/rates/${clientId}`, { monthlyPrice });

// ── Recharge quote (preview ₹ for a token sale) ───────────────────────────
export const getRechargeQuote = (toUserId, vehicles, unitPrice) => api.get('/billing/quote', { params: { toUserId, vehicles, unitPrice } });

// ── Renew (spends 1 vehicle token, +1 year + grace) ───────────────────────
export const renewVehicle     = (vehicleId) => api.post(`/billing/vehicles/${vehicleId}/renew`, {});

// ── Papa: manually override a vehicle's expiry (no token spend) ───────────
export const setVehicleExpiry = (vehicleId, data)  => api.put(`/billing/vehicles/${vehicleId}/expiry`, data);


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

// Token formatter (wallet balances, ledger). 1 token = 1 vehicle for 1 year.
export const formatVehicles = (n) => {
  const v = Number(n || 0);
  return `${v.toLocaleString('en-IN')} token${v === 1 ? '' : 's'}`;
};

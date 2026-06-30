import {
  MapIcon, PlusCircleIcon, UserGroupIcon, ClipboardDocumentListIcon,
  ExclamationTriangleIcon, ChartBarIcon, Cog6ToothIcon, ClockIcon,
  RectangleGroupIcon, BellAlertIcon, LifebuoyIcon, MapPinIcon, BellIcon, UsersIcon,
  BanknotesIcon, CurrencyRupeeIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline';

// Canonical list of CONFIGURABLE sidebar pages. Dashboard, Menu Manager, Profile
// and Logout are always rendered fixed, so they're intentionally not here.
// `perm` = the permission key that gates the page (null = always allowed).
// `role: 'dealer_or_papa'` = visible to papa/dealer or anyone with canAddClient.
export const MENU_REGISTRY = [
  { key: 'my-fleet',         label: 'Tracking',        to: '/my-fleet',         perm: 'canTrackVehicle',    Icon: MapIcon },
  { key: 'groups',           label: 'Groups',          to: '/groups',           perm: 'canManageGroups',    Icon: RectangleGroupIcon },
  { key: 'geofences',        label: 'Geofences',       to: '/geofences',        perm: 'canManageGeofences', Icon: MapPinIcon },
  { key: 'add-vehicle',      label: 'Add Vehicle',     to: '/add-vehicle',      perm: 'canAddVehicle',      Icon: PlusCircleIcon },
  { key: 'rto-details',      label: 'RTO Details',     to: '/rto-details',      perm: 'canViewRTO',         Icon: ClipboardDocumentListIcon },
  { key: 'challans',         label: 'Challans',        to: '/challans',         perm: 'canViewChallans',    Icon: ExclamationTriangleIcon },
  { key: 'vehicle-settings', label: 'Vehicle Settings',to: '/vehicle-settings', perm: null,                 Icon: Cog6ToothIcon },
  { key: 'alerts',           label: 'Alerts',          to: '/alerts',           perm: 'canSetAlerts',       Icon: BellAlertIcon },
  { key: 'reports',          label: 'Reports',         to: '/reports',          perm: 'canViewReports',     Icon: ChartBarIcon },
  { key: 'my-clients',       label: 'My Clients',      to: '/my-clients',       perm: null, role: 'dealer_or_papa', Icon: UsersIcon },
  { key: 'add-client',       label: 'Add Client',      to: '/add-client',       perm: 'canAddClient',       Icon: UserGroupIcon },
  { key: 'teams',            label: 'Teams',           to: '/teams',            perm: 'canManageTeams',     Icon: UserGroupIcon },
  { key: 'wallet',           label: 'Wallet',          to: '/wallet',           perm: null,                 Icon: BanknotesIcon },
  { key: 'billing-rates',    label: 'Billing Rates',   to: '/billing-rates',    perm: 'canManageBilling',   Icon: CurrencyRupeeIcon },
  { key: 'invoices',         label: 'Invoices',        to: '/invoices',         perm: null,                 Icon: DocumentTextIcon },
  { key: 'notifications',    label: 'Notifications',   to: '/notifications',    perm: 'canViewNotifications', Icon: BellIcon },
  { key: 'support',          label: 'Support',         to: '/support',          perm: null,                 Icon: LifebuoyIcon },
  { key: 'user-activity',    label: 'Activity',        to: '/user-activity',    perm: null,                 Icon: ClockIcon },
];

export const REGISTRY_BY_KEY = Object.fromEntries(MENU_REGISTRY.map(p => [p.key, p]));

// Default grouping shown to a user who hasn't customised yet (mirrors the
// built-in sidebar layout) — the Menu Manager starts from this.
export const DEFAULT_MENU = {
  groups: [
    { label: 'Fleet',     items: ['my-fleet', 'groups', 'geofences'] },
    { label: 'Vehicles',  items: ['add-vehicle', 'rto-details', 'challans'] },
    { label: 'Analytics', items: ['alerts', 'reports'] },
    { label: 'Clients',   items: ['my-clients', 'add-client', 'teams'] },
    { label: 'Billing',   items: ['wallet', 'billing-rates', 'invoices'] },
    { label: 'Account',   items: ['notifications', 'support', 'user-activity'] },
  ],
};

// True if `user` may see the page `p` (same "hide only if explicitly false"
// rule the default sidebar uses; papa sees everything).
export const canSeePage = (p, user) => {
  const perms = user?.permissions || {};
  const isPapa = user?.role === 'papa' || Number(user?.parentId) === 0 || Number(user?.parent_id) === 0;
  if (isPapa) return true;
  if (p.role === 'dealer_or_papa') {
    if (!(user?.role === 'dealer' || perms.canAddClient === true)) return false;
  }
  if (p.perm && perms[p.perm] === false) return false;
  if (p.perm && perms[p.perm] === undefined && user?.role === 'member') return false; // members are explicit
  return true;
};

// Pages always rendered in a FIXED position (Settings hosts the Menu Manager, so
// it must never be removable/lock the user out). Excluded from the configurable set.
export const FIXED_KEYS = ['vehicle-settings'];

// The registry filtered to the pages this user is allowed to place in sections.
export const allowedPages = (user) =>
  MENU_REGISTRY.filter(p => !FIXED_KEYS.includes(p.key) && canSeePage(p, user));

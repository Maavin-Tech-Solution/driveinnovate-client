export const SIDEBAR_PRESETS = {
  navy:    '#1A2F6B',
  slate:   '#1E293B',
  noir:    '#18181B',
  indigo:  '#312E81',
  ocean:   '#1D4ED8',
  violet:  '#6D28D9',
  forest:  '#14532D',
  teal:    '#0D9488',
  sky:     '#0284C7',
  rose:    '#BE185D',
  amber:   '#92400E',
  gray:    '#475569',
};

export const applyTheme = () => {
  const r = document.documentElement;
  const sidebar = localStorage.getItem('theme-sidebar') || 'navy';
  r.style.setProperty('--theme-sidebar-bg', SIDEBAR_PRESETS[sidebar] || SIDEBAR_PRESETS.navy);
  const hfs     = localStorage.getItem('theme-table-header-font-size'); if (hfs)     r.style.setProperty('--theme-table-header-font-size', hfs);
  const bfs     = localStorage.getItem('theme-table-body-font-size');   if (bfs)     r.style.setProperty('--theme-table-body-font-size',   bfs);
  const btnFrom = localStorage.getItem('theme-btn-from');               if (btnFrom) r.style.setProperty('--theme-btn-from', btnFrom);
  const btnTo   = localStorage.getItem('theme-btn-to');                 if (btnTo)   r.style.setProperty('--theme-btn-to',   btnTo);
};

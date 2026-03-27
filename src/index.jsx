import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';

// ── Apply saved theme vars ─────────────────────────────────────────────────
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

export const HEADER_PRESETS = {
  midnight: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #2563eb 100%)',
  ocean:    'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #38bdf8 100%)',
  violet:   'linear-gradient(135deg, #2e1065 0%, #6d28d9 60%, #a78bfa 100%)',
  forest:   'linear-gradient(135deg, #052e16 0%, #15803d 60%, #4ade80 100%)',
  rose:     'linear-gradient(135deg, #4c0519 0%, #be123c 60%, #fb7185 100%)',
  amber:    'linear-gradient(135deg, #431407 0%, #c2410c 55%, #fb923c 100%)',
  teal:     'linear-gradient(135deg, #042f2e 0%, #0f766e 55%, #2dd4bf 100%)',
  slate:    'linear-gradient(135deg, #0f172a 0%, #334155 60%, #64748b 100%)',
  indigo:   'linear-gradient(135deg, #1e1b4b 0%, #4338ca 60%, #818cf8 100%)',
  noir:     'linear-gradient(135deg, #09090b 0%, #18181b 50%, #3f3f46 100%)',
};

export const applyTheme = () => {
  const r = document.documentElement;
  const sidebar = localStorage.getItem('theme-sidebar') || 'navy';
  r.style.setProperty('--theme-sidebar-bg', SIDEBAR_PRESETS[sidebar] || SIDEBAR_PRESETS.navy);
  const header = localStorage.getItem('theme-header') || 'midnight';
  r.style.setProperty('--theme-header-bg', HEADER_PRESETS[header] || HEADER_PRESETS.midnight);
  const hfs     = localStorage.getItem('theme-table-header-font-size'); if (hfs)     r.style.setProperty('--theme-table-header-font-size', hfs);
  const bfs     = localStorage.getItem('theme-table-body-font-size');   if (bfs)     r.style.setProperty('--theme-table-body-font-size',   bfs);
  const btnFrom = localStorage.getItem('theme-btn-from');               if (btnFrom) r.style.setProperty('--theme-btn-from', btnFrom);
  const btnTo   = localStorage.getItem('theme-btn-to');                 if (btnTo)   r.style.setProperty('--theme-btn-to',   btnTo);
};
applyTheme();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

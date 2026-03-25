import React from 'react';

const resolveAccent = (bgColor) => {
  if (!bgColor) return 'blue';
  const b = bgColor.toLowerCase();
  if (b.includes('d1fae5') || b.includes('dcfce7') || b.includes('ecfdf5')) return 'green';
  if (b.includes('fee2e2') || b.includes('fef2f2') || b.includes('fecaca')) return 'red';
  if (b.includes('fef3c7') || b.includes('fffbeb') || b.includes('fef9c3')) return 'amber';
  if (b.includes('f5f3ff') || b.includes('ede9fe')) return 'purple';
  return 'blue';
};

const ACCENTS = {
  blue:   { bg: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)', shadow: '0 4px 18px rgba(37,99,235,0.32)', iconBg: 'rgba(255,255,255,0.22)', stripe: 'rgba(255,255,255,0.06)' },
  green:  { bg: 'linear-gradient(135deg, #047857 0%, #10B981 100%)', shadow: '0 4px 18px rgba(5,150,105,0.32)', iconBg: 'rgba(255,255,255,0.22)', stripe: 'rgba(255,255,255,0.06)' },
  red:    { bg: 'linear-gradient(135deg, #B91C1C 0%, #EF4444 100%)', shadow: '0 4px 18px rgba(220,38,38,0.32)', iconBg: 'rgba(255,255,255,0.22)', stripe: 'rgba(255,255,255,0.06)' },
  amber:  { bg: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)', shadow: '0 4px 18px rgba(217,119,6,0.32)', iconBg: 'rgba(255,255,255,0.22)', stripe: 'rgba(255,255,255,0.06)' },
  purple: { bg: 'linear-gradient(135deg, #5B21B6 0%, #8B5CF6 100%)', shadow: '0 4px 18px rgba(124,58,237,0.32)', iconBg: 'rgba(255,255,255,0.22)', stripe: 'rgba(255,255,255,0.06)' },
};

const StatCard = ({ title, value, icon, bgColor, change, accent: accentProp }) => {
  const key = accentProp || resolveAccent(bgColor);
  const accent = ACCENTS[key] || ACCENTS.blue;

  return (
    <div style={{
      background: accent.bg,
      borderRadius: '10px',
      padding: '20px 22px',
      flex: '1',
      minWidth: '195px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: accent.shadow,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative stripe */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '40%', background: `linear-gradient(135deg, transparent 0%, ${accent.stripe} 100%)`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: accent.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', lineHeight: 1, backdropFilter: 'blur(4px)' }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '42px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', position: 'relative' }}>
        {value !== undefined && value !== null ? value : '—'}
      </div>
      {change !== undefined && (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', marginTop: '-4px', position: 'relative' }}>{change}</div>
      )}
    </div>
  );
};

export default StatCard;

import React from 'react';

const StatCard = ({ title, value, icon, color = '#2563eb', bgColor = '#dbeafe', change }) => {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      flex: '1',
      minWidth: '200px',
    }}>
      <div style={{
        width: '52px',
        height: '52px',
        borderRadius: '12px',
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '22px' }}>{icon}</span>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{title}</p>
        <p style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>
          {value !== undefined && value !== null ? value : '—'}
        </p>
        {change !== undefined && (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>{change}</p>
        )}
      </div>
    </div>
  );
};

export default StatCard;

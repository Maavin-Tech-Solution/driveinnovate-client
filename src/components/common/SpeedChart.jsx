import React, { useState, useEffect, useRef } from 'react';

/**
 * Interactive speed-vs-time SVG chart.
 *
 * Props:
 *   locations    — array of { speed, timestamp } objects (all points)
 *   currentIndex — index of the active playback position (red line)
 *   onHover(i)   — called with the hovered index while mouse is over the chart
 *   onLeave()    — called when mouse leaves the chart
 *   dark         — true for dark background (SharePlayer)
 */
const SpeedChart = ({ locations, currentIndex, onHover, onLeave, dark = false }) => {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [tooltipIdx, setTooltipIdx] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = locations.length;
  if (n < 2) return null;

  const H = 68;
  const PAD_LEFT = 28; // space for Y-axis labels
  const chartW = Math.max(width - PAD_LEFT, 10);
  const maxSpeed = Math.max(10, ...locations.map(l => l.speed || 0));

  const xOf = (i) => PAD_LEFT + (i / (n - 1)) * chartW;
  const yOf = (spd) => 4 + ((1 - spd / maxSpeed) * (H - 12));

  const polyPoints = locations
    .map((l, i) => `${xOf(i).toFixed(1)},${yOf(l.speed || 0).toFixed(1)}`)
    .join(' ');
  const areaPoints =
    `${xOf(0).toFixed(1)},${H} ${polyPoints} ${xOf(n - 1).toFixed(1)},${H}`;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - PAD_LEFT;
    const i = Math.round((x / chartW) * (n - 1));
    const idx = Math.max(0, Math.min(i, n - 1));
    setTooltipIdx(idx);
    onHover(idx);
  };

  const handleLeave = () => {
    setTooltipIdx(null);
    onLeave();
  };

  const curX = xOf(currentIndex);
  const curY = yOf(locations[currentIndex]?.speed || 0);

  const tipIdx = tooltipIdx;
  const tipX = tipIdx !== null ? xOf(tipIdx) : null;
  const tipY = tipIdx !== null ? yOf(locations[tipIdx]?.speed || 0) : null;
  const tipSpd = tipIdx !== null ? (locations[tipIdx]?.speed || 0) : null;
  const TIP_W = 62;
  const tipLabelX = tipX !== null
    ? Math.min(tipX + 8, PAD_LEFT + chartW - TIP_W - 2)
    : 0;

  const lineColor   = dark ? '#60a5fa' : '#3b82f6';
  const areaColor   = dark ? 'rgba(96,165,250,0.18)' : 'rgba(59,130,246,0.12)';
  const gridColor   = dark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
  const labelColor  = dark ? 'rgba(255,255,255,0.4)' : '#cbd5e1';

  return (
    <div
      ref={containerRef}
      style={{
        padding: dark ? '4px 20px 8px' : '4px 24px 10px',
        background: dark ? 'rgba(15,23,42,0.92)' : '#fff',
        borderTop: dark ? 'none' : '1px solid #e2e8f0',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 2,
        fontSize: 10,
        fontWeight: 600,
        color: dark ? 'rgba(255,255,255,0.45)' : '#94a3b8',
      }}>
        <span>Speed (km/h)</span>
        <span>max {maxSpeed} km/h</span>
      </div>

      <svg
        width={width}
        height={H}
        style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {/* Y-axis grid + labels */}
        {[0, 0.5, 1].map(p => {
          const y = yOf(maxSpeed * p);
          return (
            <g key={p}>
              <line x1={PAD_LEFT} y1={y} x2={PAD_LEFT + chartW} y2={y} stroke={gridColor} strokeWidth={1} />
              <text x={PAD_LEFT - 3} y={y + 3} fontSize={8} fill={labelColor} textAnchor="end">
                {Math.round(maxSpeed * p)}
              </text>
            </g>
          );
        })}

        {/* Filled area under curve */}
        <polygon points={areaPoints} fill={areaColor} />

        {/* Speed polyline */}
        <polyline points={polyPoints} fill="none" stroke={lineColor} strokeWidth={1.5} />

        {/* Current playback indicator (red) */}
        <line x1={curX} y1={0} x2={curX} y2={H} stroke="#ef4444" strokeWidth={2} opacity={0.8} />
        <circle cx={curX} cy={curY} r={3} fill="#ef4444" />

        {/* Hover indicator (amber) */}
        {tipIdx !== null && (
          <>
            <line
              x1={tipX} y1={0} x2={tipX} y2={H}
              stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 2"
            />
            <circle cx={tipX} cy={tipY} r={4} fill="#f59e0b" stroke={dark ? '#0f172a' : '#fff'} strokeWidth={1.5} />
            {/* Tooltip bubble */}
            <rect x={tipLabelX} y={tipY - 20} width={TIP_W} height={16} rx={3} fill="#0f172a" opacity={0.9} />
            <text x={tipLabelX + TIP_W / 2} y={tipY - 8} fontSize={10} fill="#fff" textAnchor="middle">
              {tipSpd} km/h
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

export default SpeedChart;

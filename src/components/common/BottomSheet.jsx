import React, { useEffect, useRef, useState } from 'react';

/**
 * Three-state bottom sheet that snaps between collapsed / half / full peek
 * heights. Designed for the MyFleet map-view detail panel — gives much more
 * horizontal room than the old 380 px right drawer.
 *
 * Peek heights:
 *   collapsed — 110 px strip (just header + status; user can still see most of map)
 *   half      — 50 vh (tabs + comfortable content; map shrinks to upper half)
 *   full      — 100 vh (overlays the entire viewport, including app header)
 *
 * Behaviour:
 *   • Drag the handle vertically to resize. On release, snap to the nearest peek.
 *   • At "full", z-index promotes above the sticky app header (which is at 5000).
 *   • Close button calls onClose(); ESC also closes.
 */
const PEEK = {
  collapsed: 110,
  half: '50vh',
  full: '100vh',
};

// CSS heights converted to pixels at the moment of snap calculation.
const toPx = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return 0;
  if (val.endsWith('vh')) return (parseFloat(val) / 100) * window.innerHeight;
  if (val.endsWith('px')) return parseFloat(val);
  return parseFloat(val) || 0;
};

const BottomSheet = ({ open, peek, onPeekChange, onClose, children, accentColor = '#2563EB' }) => {
  // Live height during drag (px). null = not dragging, use peek value.
  const [dragHeight, setDragHeight] = useState(null);
  const dragStateRef = useRef({ startY: 0, startH: 0 });

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const startDrag = (e) => {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    const currentH = dragHeight ?? toPx(PEEK[peek]);
    dragStateRef.current = { startY: point.clientY, startH: currentH };
    setDragHeight(currentH);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    const onMove = (ev) => {
      const p = ev.touches ? ev.touches[0] : ev;
      const dy = p.clientY - dragStateRef.current.startY;
      // Dragging UP increases height; clamp to viewport bounds.
      const next = Math.max(60, Math.min(window.innerHeight, dragStateRef.current.startH - dy));
      setDragHeight(next);
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      // Snap to nearest peek by pixel distance
      const currentH = dragHeight ?? dragStateRef.current.startH;
      const candidates = [
        ['collapsed', toPx(PEEK.collapsed)],
        ['half',      toPx(PEEK.half)],
        ['full',      toPx(PEEK.full)],
      ];
      let nearest = candidates[0];
      let bestDist = Infinity;
      for (const c of candidates) {
        const d = Math.abs(currentH - c[1]);
        if (d < bestDist) { bestDist = d; nearest = c; }
      }
      onPeekChange?.(nearest[0]);
      setDragHeight(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
  };

  // Quick-tap on the handle: cycle peek state forward (collapsed → half → full → collapsed)
  const handleHandleClick = () => {
    const order = ['collapsed', 'half', 'full'];
    const next = order[(order.indexOf(peek) + 1) % order.length];
    onPeekChange?.(next);
  };

  if (!open) return null;

  // Effective height: dragging takes priority; otherwise peek state.
  const heightStyle = dragHeight != null ? `${dragHeight}px` : PEEK[peek];

  // Promote z-index when in full state so the sheet overlays the app header (zIndex 5000).
  const zIndex = peek === 'full' ? 7500 : 6500;

  return (
    <>
      {/* Click-outside dimmer — only at full peek (when sheet covers everything anyway) */}
      {peek === 'full' && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: zIndex - 1 }}
        />
      )}

      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: heightStyle,
        background: '#FFFFFF',
        borderRadius: 0,
        boxShadow: '0 -10px 40px rgba(15,23,42,0.18), 0 -2px 6px rgba(15,23,42,0.08)',
        zIndex,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: dragHeight != null ? 'none' : 'height 0.28s cubic-bezier(0.4,0,0.2,1)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>

        {/* Drag handle — covers full width so it's easy to grab */}
        <div
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px 6px',
            cursor: 'ns-resize',
            background: peek === 'full' ? '#F8FAFC' : '#FFFFFF',
            borderBottom: '1px solid #F1F5F9',
            position: 'relative',
            userSelect: 'none',
          }}
        >
          {/* Grab bar */}
          <div
            onClick={(e) => { e.stopPropagation(); handleHandleClick(); }}
            style={{
              width: 60, height: 4, borderRadius: 0,
              background: '#94A3B8',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#475569'}
            onMouseLeave={e => e.currentTarget.style.background = '#94A3B8'}
            title="Drag to resize, or click to cycle (collapsed → half → full)"
          />

          {/* Quick-state buttons + close — sit on the right of the handle row */}
          <div style={{ position: 'absolute', right: 12, top: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            {[
              { id: 'collapsed', label: '⌐', title: 'Collapse' },
              { id: 'half',      label: '◐', title: 'Half-screen' },
              { id: 'full',      label: '◼', title: 'Full-screen' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => onPeekChange?.(s.id)}
                title={s.title}
                style={{
                  width: 30, height: 26, padding: 0,
                  background: peek === s.id ? accentColor : '#F1F5F9',
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 12,
                  color: peek === s.id ? '#FFFFFF' : '#475569',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={onClose}
              title="Close (Esc)"
              style={{
                width: 30, height: 26, padding: 0, marginLeft: 4,
                background: '#DC2626', border: 'none',
                borderRadius: 0, color: '#FFFFFF', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content area — scrollable */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </>
  );
};

export default BottomSheet;

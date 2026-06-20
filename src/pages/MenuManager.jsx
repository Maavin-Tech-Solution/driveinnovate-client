import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { getSettings, updateSettings } from '../services/settings.service';
import { allowedPages, REGISTRY_BY_KEY } from '../config/menuRegistry';

const sbtn = (bg, fg) => ({ background: bg, color: fg, border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' });
const mini = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: '#475569', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

// menuConfig.items = flat ordered [{ key, depth }] (depth 0 = top, 1 = sub-item).
const normalize = (items) => items.map((it, i) => ({ key: it.key, depth: i === 0 ? 0 : (it.depth ? 1 : 0) }));

export default function MenuManager() {
  const { user } = useAuth();
  const allowed = useMemo(() => allowedPages(user), [user]);
  const allowedKeys = useMemo(() => new Set(allowed.map(p => p.key)), [allowed]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getSettings();
        const saved = res.data?.menuConfig?.items;
        const base = saved?.length
          ? saved.filter(it => allowedKeys.has(it.key))
          : allowed.map(p => ({ key: p.key, depth: 0 })); // flat, no preset sections
        setItems(normalize(base));
      } catch {
        setItems(allowed.map(p => ({ key: p.key, depth: 0 })));
      } finally { setLoading(false); }
    })();
  }, [allowedKeys]);

  const usedKeys = useMemo(() => new Set(items.map(i => i.key)), [items]);
  const available = allowed.filter(p => !usedKeys.has(p.key));

  // ── mutations ──
  const move = (from, to) => setItems(arr => {
    if (to < 0 || to >= arr.length) return arr;
    const n = [...arr]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return normalize(n);
  });
  const setDepth = (i, depth) => setItems(arr => normalize(arr.map((x, idx) => idx === i ? { ...x, depth } : x)));
  const remove = (i) => setItems(arr => normalize(arr.filter((_, idx) => idx !== i)));
  const add = (key) => setItems(arr => normalize([...arr, { key, depth: 0 }]));

  const onDragOver = (i) => { if (dragIdx !== null && dragIdx !== i) { move(dragIdx, i); setDragIdx(i); } };

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({ menuConfig: { items: normalize(items) } });
      toast.success('Menu saved — applies on your next page load / login.');
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };
  const reset = () => setItems(allowed.map(p => ({ key: p.key, depth: 0 })));

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: '#dbeafe', borderRadius: 8, padding: '7px 9px', fontSize: 16 }}>📑</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Sidebar Menu</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Drag to reorder; indent an item to nest it under the one above. Only your accessible pages are shown.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={sbtn('#F1F5F9', '#334155')} onClick={reset}>Reset</button>
          <button style={sbtn('var(--theme-sidebar-bg, #1D4ED8)', '#fff')} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save menu'}</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 24, color: '#94a3b8' }}>Loading…</div> : (
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20, alignItems: 'start' }}>
          {/* The menu (draggable) */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Your menu</div>
            {items.length === 0 ? (
              <div style={{ border: '1px dashed #CBD5E1', borderRadius: 8, padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                Empty. Add pages from the right.
              </div>
            ) : (
              <div onDragOver={e => e.preventDefault()}>
                {items.map((it, i) => {
                  const p = REGISTRY_BY_KEY[it.key];
                  if (!p) return null;
                  return (
                    <div key={it.key}
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragEnter={() => onDragOver(i)}
                      onDragEnd={() => setDragIdx(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        marginLeft: it.depth === 1 ? 28 : 0,
                        padding: '9px 12px', marginBottom: 6,
                        border: '1px solid #E2E8F0', borderLeft: `3px solid ${it.depth === 1 ? '#93C5FD' : '#2563EB'}`,
                        borderRadius: 8, background: dragIdx === i ? '#EFF6FF' : '#fff', cursor: 'grab',
                      }}>
                      <span style={{ color: '#CBD5E1', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                      <p.Icon style={{ width: 16, height: 16, color: '#475569', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', flex: 1 }}>{p.label}</span>
                      {it.depth === 1
                        ? <button title="Outdent (make top-level)" style={mini} onClick={() => setDepth(i, 0)}>←</button>
                        : <button title="Indent (nest under item above)" style={{ ...mini, opacity: i === 0 ? 0.35 : 1 }} disabled={i === 0} onClick={() => setDepth(i, 1)}>→</button>}
                      <button title="Remove" style={{ ...mini, color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }} onClick={() => remove(i)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available pages */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Available</div>
            {available.length === 0 ? <div style={{ fontSize: 13, color: '#94A3B8' }}>All pages added.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {available.map(p => (
                  <button key={p.key} onClick={() => add(p.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                    <p.Icon style={{ width: 15, height: 15, color: '#64748B', flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', flex: 1 }}>{p.label}</span>
                    <span style={{ fontSize: 15, color: '#2563EB' }}>+</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

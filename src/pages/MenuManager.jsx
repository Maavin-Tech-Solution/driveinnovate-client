import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { getSettings, updateSettings } from '../services/settings.service';
import { allowedPages, REGISTRY_BY_KEY, DEFAULT_MENU } from '../config/menuRegistry';

const sbtn = (bg, fg) => ({ background: bg, color: fg, border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' });
const mini = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', color: '#475569', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

// menuConfig = { groups: [{ label, items: [pageKey] }] } — sections (containers,
// not pages) each holding ordered page items.
const sanitize = (groups, allowedKeys) =>
  (groups || []).map(g => ({ label: (g.label || 'Section'), items: (g.items || []).filter(k => allowedKeys.has(k)) }));

export default function MenuManager() {
  const { user } = useAuth();
  const allowed = useMemo(() => allowedPages(user), [user]);
  const allowedKeys = useMemo(() => new Set(allowed.map(p => p.key)), [allowed]);

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeGi, setActiveGi] = useState(0);
  const [drag, setDrag] = useState(null);     // { gi, ii } being dragged
  const [overGi, setOverGi] = useState(null);  // section highlighted as drop target

  useEffect(() => {
    (async () => {
      try {
        const res = await getSettings();
        const saved = res.data?.menuConfig?.groups;
        setGroups(sanitize(saved?.length ? saved : DEFAULT_MENU.groups, allowedKeys));
      } catch {
        setGroups(sanitize(DEFAULT_MENU.groups, allowedKeys));
      } finally { setLoading(false); }
    })();
  }, [allowedKeys]);

  const usedKeys = useMemo(() => new Set(groups.flatMap(g => g.items)), [groups]);
  const available = allowed.filter(p => !usedKeys.has(p.key));

  // ── section mutations ──
  const addSection   = () => { setGroups(g => [...g, { label: 'New Section', items: [] }]); setActiveGi(groups.length); };
  const renameSection = (gi, label) => setGroups(g => g.map((x, i) => i === gi ? { ...x, label } : x));
  const deleteSection = (gi) => { setGroups(g => g.filter((_, i) => i !== gi)); setActiveGi(0); };
  const moveSection   = (gi, d) => setGroups(g => { const n = [...g]; const j = gi + d; if (j < 0 || j >= n.length) return g; [n[gi], n[j]] = [n[j], n[gi]]; return n; });

  // ── item mutations ──
  const addToActive = (key) => setGroups(g => {
    if (!g.length) return [{ label: 'New Section', items: [key] }];
    const gi = Math.min(activeGi, g.length - 1);
    return g.map((x, i) => i === gi ? { ...x, items: [...x.items, key] } : x);
  });
  const removeItem = (gi, ii) => setGroups(g => g.map((x, i) => i === gi ? { ...x, items: x.items.filter((_, k) => k !== ii) } : x));

  // Move dragged item to (toGi, toIi). toIi = items.length appends.
  const moveItem = (from, toGi, toIi) => setGroups(gs => {
    const next = gs.map(x => ({ ...x, items: [...x.items] }));
    const key = next[from.gi]?.items[from.ii];
    if (key == null) return gs;
    next[from.gi].items.splice(from.ii, 1);
    let ti = toIi;
    if (from.gi === toGi && from.ii < toIi) ti -= 1;
    next[toGi].items.splice(Math.max(0, ti), 0, key);
    return next;
  });

  const onDropItem = (toGi, toIi) => { if (drag) { moveItem(drag, toGi, toIi); } setDrag(null); setOverGi(null); };

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({ menuConfig: { groups: groups.map(g => ({ label: (g.label || 'Section').trim(), items: g.items })) } });
      toast.success('Menu saved — applies on your next page load / login.');
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };
  const reset = () => setGroups(sanitize(DEFAULT_MENU.groups, allowedKeys));

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: '#dbeafe', borderRadius: 8, padding: '7px 9px', fontSize: 16 }}>📑</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Sidebar Menu</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Organise pages into sections. Drag a page onto another page or a section to move it. Dashboard, Settings &amp; Profile stay fixed.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={sbtn('#F1F5F9', '#334155')} onClick={reset}>Reset</button>
          <button style={sbtn('var(--theme-sidebar-bg, #1D4ED8)', '#fff')} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save menu'}</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 24, color: '#94a3b8' }}>Loading…</div> : (
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 230px', gap: 20, alignItems: 'start' }}>
          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g, gi) => {
              const active = gi === activeGi;
              const over = overGi === gi;
              return (
                <div key={gi} onClick={() => setActiveGi(gi)}
                  onDragOver={e => { e.preventDefault(); setOverGi(gi); }}
                  onDrop={() => onDropItem(gi, g.items.length)}
                  style={{ border: `2px solid ${over ? '#2563EB' : active ? '#93C5FD' : '#E2E8F0'}`, borderRadius: 12, padding: 12, background: over ? '#EFF6FF' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: g.items.length ? 10 : 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Section</span>
                    <input value={g.label} onChange={e => renameSection(gi, e.target.value)} onClick={e => e.stopPropagation()}
                      style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#0F172A', border: 'none', borderBottom: '1px dashed #CBD5E1', padding: '2px 0', fontFamily: 'inherit', background: 'transparent' }} />
                    {active && <span style={{ fontSize: 9, fontWeight: 700, color: '#1D4ED8', background: '#DBEAFE', padding: '2px 7px', borderRadius: 4 }}>ADDING HERE</span>}
                    <button title="Up" style={mini} onClick={e => { e.stopPropagation(); moveSection(gi, -1); }}>▲</button>
                    <button title="Down" style={mini} onClick={e => { e.stopPropagation(); moveSection(gi, 1); }}>▼</button>
                    <button title="Delete section" style={{ ...mini, color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }} onClick={e => { e.stopPropagation(); deleteSection(gi); }}>✕</button>
                  </div>
                  {g.items.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94A3B8', padding: '10px 6px', border: '1px dashed #E2E8F0', borderRadius: 8, textAlign: 'center' }}>
                      Drop pages here, or select this section and add from the right.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {g.items.map((key, ii) => {
                        const p = REGISTRY_BY_KEY[key];
                        if (!p) return null;
                        return (
                          <div key={key}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDrag({ gi, ii }); }}
                            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setOverGi(gi); }}
                            onDrop={e => { e.stopPropagation(); onDropItem(gi, ii); }}
                            onDragEnd={() => { setDrag(null); setOverGi(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #F1F5F9', borderRadius: 8, background: '#f8fafc', cursor: 'grab' }}>
                            <span style={{ color: '#CBD5E1', userSelect: 'none' }}>⠿</span>
                            <p.Icon style={{ width: 16, height: 16, color: '#475569', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', flex: 1 }}>{p.label}</span>
                            <button title="Remove" style={{ ...mini, color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }} onClick={e => { e.stopPropagation(); removeItem(gi, ii); }}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={addSection} style={{ ...sbtn('#fff', '#1D4ED8'), border: '1px dashed #93C5FD', padding: '11px' }}>+ Add section</button>
          </div>

          {/* Available pages */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Available pages</div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94A3B8' }}>Adds to the highlighted section.</p>
            {available.length === 0 ? <div style={{ fontSize: 13, color: '#94A3B8' }}>All pages placed.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {available.map(p => (
                  <button key={p.key} onClick={() => addToActive(p.key)}
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

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, patchSetting } from '../api/settings.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faXmark, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';

const PINNED_REASON = "Didn't attend the enquiry";

// ── Save button ──────────────────────────────────────────────────────────────

function SaveButton({ saving, saved, dirty, onSave, onCancel, error }: {
  saving: boolean; saved: boolean; dirty: boolean; onSave: () => void; onCancel: () => void; error: string;
}) {
  if (!dirty && !error) return null;
  return (
    <>
      {error && <p style={{ color: '#c47272', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onCancel} disabled={saving} style={st.cancelBtn}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={saved ? st.savedBtn : st.saveBtn}>
          {saving ? 'Saving…' : saved ? <><FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Saved</> : 'Save Changes'}
        </button>
      </div>
    </>
  );
}

// ── Appointment Settings ─────────────────────────────────────────────────────

function AppointmentSettings({ settings, isAdmin, onSaved }: {
  settings: Record<string, unknown>; isAdmin: boolean; onSaved: () => void;
}) {
  const [duration, setDuration] = useState(String((settings.appointment_duration_minutes as number) ?? 30));
  const [leadTime, setLeadTime] = useState(String((settings.appointment_lead_time_hours as number) ?? 24));
  const [address, setAddress] = useState(String((settings.kinder_address as string) ?? ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDirty(false); setSaved(false); }, [settings]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting('appointment_duration_minutes', Number(duration));
      await patchSetting('appointment_lead_time_hours', Number(leadTime));
      await patchSetting('kinder_address', address);
      setSaved(true); setDirty(false); onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const mark = () => { setDirty(true); setSaved(false); };
  const reset = () => {
    setDuration(String((settings.appointment_duration_minutes as number) ?? 30));
    setLeadTime(String((settings.appointment_lead_time_hours as number) ?? 24));
    setAddress(String((settings.kinder_address as string) ?? ''));
    setDirty(false); setError('');
  };

  return (
    <div style={st.card}>
      <div style={st.cardHeader}>
        <h2 style={st.cardTitle}>Appointment Settings</h2>
      </div>
      <div style={st.cardBody}>
        <table style={st.fieldTable}><tbody>
          <tr>
            <td style={st.ftLabel}>Duration</td>
            <td style={st.ftValue}>
              <input style={st.numInput} type="number" min={5} value={duration}
                onChange={e => { setDuration(e.target.value); mark(); }} disabled={!isAdmin} />
              <span style={st.ftUnit}>minutes</span>
            </td>
          </tr>
          {/* Booking notice (appointment_lead_time_hours) — hidden for now, setting preserved in backend */}
          <tr>
            <td style={{ ...st.ftLabel, verticalAlign: 'top', paddingTop: 10 }}>Address</td>
            <td style={st.ftValue}>
              <input style={{ ...st.textInput }} value={address} onChange={e => { setAddress(e.target.value); mark(); }}
                disabled={!isAdmin} placeholder="e.g. Bukit Indah, Johor Bahru" />
              <span style={st.ftHint}>Shown in confirmations and directions</span>
            </td>
          </tr>
        </tbody></table>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onSave={handleSave} onCancel={reset} error={error} />
      </div>
    </div>
  );
}

// ── Urgency Rules ────────────────────────────────────────────────────────────

function UrgencySettings({ settings, isAdmin, onSaved }: {
  settings: Record<string, unknown>; isAdmin: boolean; onSaved: () => void;
}) {
  const [amberDays, setAmberDays] = useState(String((settings.urgency_orange_days as number) ?? 1));
  const [redDays, setRedDays] = useState(String((settings.urgency_red_days as number) ?? 3));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDirty(false); setSaved(false); }, [settings]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting('urgency_orange_days', Number(amberDays));
      await patchSetting('urgency_red_days', Number(redDays));
      setSaved(true); setDirty(false); onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const mark = () => { setDirty(true); setSaved(false); };
  const reset = () => {
    setAmberDays(String((settings.urgency_orange_days as number) ?? 1));
    setRedDays(String((settings.urgency_red_days as number) ?? 3));
    setDirty(false); setError('');
  };

  return (
    <div style={st.card}>
      <div style={st.cardHeader}>
        <h2 style={st.cardTitle}>Lead Urgency Rules</h2>
      </div>
      <div style={st.cardBody}>
        <table style={st.fieldTable}><tbody>
          <tr>
            <td style={st.ftValue}>
              <span style={{ ...st.dot, background: '#f59e0b' }} />
              <span style={st.ftInlineText}>Amber warning after</span>
              <input style={st.numInput} type="number" min={1} value={amberDays}
                onChange={e => { setAmberDays(e.target.value); mark(); }} disabled={!isAdmin} />
              <span style={st.ftUnit}>{Number(amberDays) === 1 ? 'day' : 'days'} without action</span>
            </td>
          </tr>
          <tr>
            <td style={st.ftValue}>
              <span style={{ ...st.dot, background: '#ef4444' }} />
              <span style={st.ftInlineText}>Red alert after</span>
              <input style={st.numInput} type="number" min={1} value={redDays}
                onChange={e => { setRedDays(e.target.value); mark(); }} disabled={!isAdmin} />
              <span style={st.ftUnit}>{Number(redDays) === 1 ? 'day' : 'days'} without action</span>
            </td>
          </tr>
        </tbody></table>
        <SaveButton saving={saving} saved={saved} dirty={dirty} onSave={handleSave} onCancel={reset} error={error} />
      </div>
    </div>
  );
}

// ── Lost Reasons ─────────────────────────────────────────────────────────────

function LostReasonsEditor({ reasons, isAdmin, onSaved }: {
  reasons: string[]; isAdmin: boolean; onSaved: () => void;
}) {
  const [items, setItems] = useState<string[]>(reasons.filter(r => r !== PINNED_REASON));
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const mark = () => { setDirty(true); setSaved(false); };
  const reset = () => {
    setItems(reasons.filter(r => r !== PINNED_REASON));
    setNewItem(''); setEditingIdx(null); setEditingValue('');
    setDirty(false); setError('');
  };

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop = (targetIdx: number) => {
    const from = dragIdx.current;
    if (from === null || from === targetIdx) { setDragOver(null); return; }
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    dragIdx.current = null; setDragOver(null); mark();
  };

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems(prev => [...prev, trimmed]);
    setNewItem(''); mark();
  };

  const removeItem = (idx: number) => { setItems(prev => prev.filter((_, i) => i !== idx)); mark(); };

  const startEdit = (idx: number) => { setEditingIdx(idx); setEditingValue(items[idx]); };
  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editingValue.trim();
    if (trimmed && trimmed !== PINNED_REASON) {
      setItems(prev => prev.map((item, i) => i === editingIdx ? trimmed : item));
      mark();
    }
    setEditingIdx(null); setEditingValue('');
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting('lost_reasons', [PINNED_REASON, ...items]);
      setSaved(true); setDirty(false); onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={st.card}>
      <div style={{ ...st.cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={st.cardTitle}>Lost Reasons</h2>
        <span style={{ fontSize: 11, color: '#b0b8c9' }}>{1 + items.length} reasons</span>
      </div>
      <div style={st.cardBody}>
        {/* Add input */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            <input
              style={{ ...st.textInput, flex: 1 }}
              placeholder="Add new reason…"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
            <button onClick={addItem} style={rs.addBtn} disabled={!newItem.trim()}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 5 }} /> Add
            </button>
          </div>
        )}

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* System reason */}
          <div style={rs.systemRow}>
            <span style={rs.systemText}>{PINNED_REASON}</span>
            <span style={rs.systemBadge}>system</span>
          </div>

          {/* Custom reasons */}
          {items.map((item, idx) => (
            <div
              key={idx}
              draggable={isAdmin && editingIdx !== idx}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragLeave={() => setDragOver(null)}
              style={{
                ...rs.row,
                ...(dragOver === idx ? { borderColor: '#5a79c8', background: '#f0f4fa' } : {}),
                cursor: isAdmin && editingIdx !== idx ? 'grab' : 'default',
              }}
            >
              {isAdmin && <span style={rs.handle}>⠿</span>}
              {editingIdx === idx ? (
                <input
                  autoFocus
                  style={{ ...st.textInput, flex: 1, padding: '2px 7px' }}
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingIdx(null); setEditingValue(''); } }}
                />
              ) : (
                <span style={rs.text}>{item}</span>
              )}
              {isAdmin && editingIdx !== idx && (
                <div style={rs.actions}>
                  <button onClick={() => startEdit(idx)} style={rs.actionBtn} title="Rename"><FontAwesomeIcon icon={faPen} /></button>
                  <button onClick={() => removeItem(idx)} style={{ ...rs.actionBtn, color: '#dca0a0' }} title="Remove"><FontAwesomeIcon icon={faXmark} /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        <SaveButton saving={saving} saved={saved} dirty={dirty} onSave={handleSave} onCancel={reset} error={error} />
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function LeadStatusSettingsPage() {
  const { isMobile } = useIsMobile();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  if (isLoading) return <p style={{ padding: 32, fontSize: 16, color: '#4a5568' }}>Loading settings…</p>;
  if (isError) return <p style={{ padding: 32, fontSize: 16, color: '#c47272' }}>Failed to load settings.</p>;

  const lostReasons: string[] = Array.isArray(data?.lost_reasons) ? data.lost_reasons as string[] : [];
  const onSaved = () => queryClient.invalidateQueries({ queryKey: ['settings'] });

  return (
    <div style={{ ...st.page, ...(isMobile ? { padding: '16px 12px' } : {}) }}>
      <div style={{ ...st.inner, ...(isMobile ? { maxWidth: '100%' } : {}) }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={st.heading}>Lead Settings</h1>
          <p style={st.subtitle}>Configure how leads are managed across the pipeline.</p>
          {!isAdmin && (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>Read-only access. Admin role required to save changes.</p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AppointmentSettings settings={data ?? {}} isAdmin={isAdmin} onSaved={onSaved} />
          <UrgencySettings settings={data ?? {}} isAdmin={isAdmin} onSaved={onSaved} />
          <LostReasonsEditor reasons={lostReasons} isAdmin={isAdmin} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 660 },
  heading: { margin: 0, fontSize: 21, fontWeight: 700, color: '#0f172a' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#94a3b8' },

  // Card
  card: {
    background: '#fff', border: '1px solid #e8eaee', borderRadius: 10, overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 20px', borderBottom: '1px solid #f1f3f5',
  },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' },
  cardBody: { padding: '16px 20px' },

  // Field table
  fieldTable: { width: '100%', borderCollapse: 'collapse' as const },
  ftLabel: {
    padding: '7px 0', fontSize: 13, fontWeight: 500, color: '#475569',
    width: 120, verticalAlign: 'middle' as const, whiteSpace: 'nowrap' as const,
  },
  ftValue: {
    padding: '7px 0', display: 'flex', alignItems: 'center', gap: 8,
  },
  ftUnit: { fontSize: 12, color: '#b0b8c9' },
  ftHint: { fontSize: 11, color: '#c4c9d4', display: 'block', marginTop: 3 },
  ftInlineText: { fontSize: 13, fontWeight: 500, color: '#475569', minWidth: 130 },

  // Inputs
  numInput: {
    width: 64, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, fontFamily: 'inherit', textAlign: 'center' as const, color: '#1e293b',
    background: '#fff', outline: 'none', boxSizing: 'border-box' as const,
  },
  textInput: {
    padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, fontFamily: 'inherit', color: '#1e293b', background: '#fff',
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  },

  // Dot
  dot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },

  // Save
  cancelBtn: {
    padding: '7px 16px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0',
    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  },
  saveBtn: {
    padding: '7px 20px', background: '#5a79c8', color: '#fff', border: 'none',
    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  savedBtn: {
    padding: '7px 20px', background: '#5b9a6f', color: '#fff', border: 'none',
    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};

const rs: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', background: '#fff',
    borderRadius: 5, border: '1px solid #eef0f3',
    minHeight: 32,
  },
  systemRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', background: '#fafbfc',
    borderRadius: 5, border: '1px solid #eef0f3', minHeight: 32,
  },
  handle: { color: '#d4d4d8', fontSize: 12, cursor: 'grab', userSelect: 'none', flexShrink: 0, width: 12, textAlign: 'center' },
  text: { flex: 1, fontSize: 13, color: '#334155' },
  systemText: { flex: 1, fontSize: 13, color: '#b0b8c9' },
  systemBadge: {
    fontSize: 9, fontWeight: 500, color: '#ccc', letterSpacing: '0.05em', textTransform: 'uppercase',
    flexShrink: 0,
  },
  actions: { display: 'flex', gap: 4, flexShrink: 0, marginLeft: 'auto' },
  actionBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#d4d4d8',
    fontSize: 12, padding: '2px 4px', lineHeight: 1, borderRadius: 3,
  },
  addBtn: {
    padding: '7px 14px', background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
};

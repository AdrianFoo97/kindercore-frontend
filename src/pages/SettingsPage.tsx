import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, patchSetting } from '../api/settings.js';

const PINNED_REASON = "Didn't attend the enquiry";

function LostReasonsEditor({ reasons, isAdmin, onSaved }: {
  reasons: string[];
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<string[]>(
    reasons.filter(r => r !== PINNED_REASON)
  );
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

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
    dragIdx.current = null;
    setDragOver(null);
    setSaved(false);
  };

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems(prev => [...prev, trimmed]);
    setNewItem('');
    setSaved(false);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const startEdit = (idx: number) => { setEditingIdx(idx); setEditingValue(items[idx]); };
  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editingValue.trim();
    if (trimmed && trimmed !== PINNED_REASON) {
      setItems(prev => prev.map((item, i) => i === editingIdx ? trimmed : item));
      setSaved(false);
    }
    setEditingIdx(null); setEditingValue('');
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting('lost_reasons', [PINNED_REASON, ...items]);
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.card}>
      <label style={styles.label}>Lost Reasons</label>
      <p style={styles.desc}>Dropdown options shown when marking a lead as Lost.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <div style={{ ...reasonStyles.row, background: '#eef2ff', borderColor: '#c7d2fe' }}>
          <span style={{ ...reasonStyles.text, color: '#4338ca', fontWeight: 700 }}>{PINNED_REASON}</span>
          <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, padding: '1px 6px', background: '#e0e7ff', borderRadius: 8 }}>fixed</span>
        </div>
        {items.map((item, idx) => (
          <div
            key={idx}
            draggable={isAdmin && editingIdx !== idx}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragLeave={() => setDragOver(null)}
            style={{
              ...reasonStyles.row,
              ...(dragOver === idx ? { borderColor: '#6366f1', background: '#eef2ff' } : {}),
              cursor: isAdmin && editingIdx !== idx ? 'grab' : 'default',
            }}
          >
            {isAdmin && <span style={reasonStyles.handle}>⠿</span>}
            {editingIdx === idx ? (
              <input
                autoFocus
                style={{ ...styles.input, flex: 1, padding: '3px 7px', fontSize: 13 }}
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingIdx(null); setEditingValue(''); } }}
              />
            ) : (
              <span style={reasonStyles.text}>{item}</span>
            )}
            {isAdmin && editingIdx !== idx && (
              <button onClick={() => startEdit(idx)} style={reasonStyles.editBtn} title="Rename">✎</button>
            )}
            {isAdmin && editingIdx !== idx && (
              <button onClick={() => removeItem(idx)} style={reasonStyles.removeBtn} title="Remove">✕</button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              style={{ ...styles.input, flex: 1 }}
              placeholder="Add new reason…"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
            <button onClick={addItem} style={reasonStyles.addBtn} disabled={!newItem.trim()}>Add</button>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button onClick={handleSave} disabled={saving} style={{ ...(saved ? styles.savedBtn : styles.saveBtn), marginTop: 12 }}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  const isAdmin = user?.role === 'ADMIN';

  if (isLoading) return <p style={styles.state}>Loading settings…</p>;
  if (isError) return <p style={{ ...styles.state, color: '#e53e3e' }}>Failed to load settings.</p>;

  const lostReasons: string[] = Array.isArray(data?.lost_reasons) ? data.lost_reasons as string[] : [];

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.heading}>Leads Settings</h1>
        {!isAdmin && (
          <p style={styles.readonlyNote}>You have read-only access. Admin role required to save changes.</p>
        )}
        <div style={styles.list}>
          <LostReasonsEditor
            reasons={lostReasons}
            isAdmin={isAdmin}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ['settings'] })}
          />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 680 },
  heading: { margin: '0 0 8px', fontSize: 24 },
  readonlyNote: { color: '#718096', fontSize: 13, marginBottom: 24 },
  state: { padding: 32, fontSize: 16, color: '#4a5568' },
  list: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 },
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  label: { fontWeight: 700, fontSize: 14, color: '#2d3748' },
  desc: { fontSize: 12, color: '#718096', margin: 0 },
  input: {
    padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 4,
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  error: { color: '#e53e3e', fontSize: 12, margin: 0 },
  saveBtn: {
    alignSelf: 'flex-end', padding: '7px 18px',
    background: '#4299e1', color: '#fff', border: 'none',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  savedBtn: {
    alignSelf: 'flex-end', padding: '7px 18px',
    background: '#38a169', color: '#fff', border: 'none',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};

const reasonStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 10px', background: '#f7fafc',
    borderRadius: 4, border: '1px solid #e2e8f0',
  },
  handle: { color: '#a0aec0', fontSize: 14, cursor: 'grab', userSelect: 'none', flexShrink: 0 },
  text: { flex: 1, fontSize: 13, color: '#2d3748' },
  editBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0', fontSize: 15, padding: '0 2px', lineHeight: 1 },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0', fontSize: 14, padding: '0 2px', lineHeight: 1 },
  addBtn: {
    padding: '8px 16px', background: '#edf2f7', border: '1px solid #e2e8f0',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4a5568',
  },
};

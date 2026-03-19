import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, patchSetting } from '../api/settings.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faXmark, faCheck } from '@fortawesome/free-solid-svg-icons';

export default function OnboardingSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  const isAdmin = user?.role === 'ADMIN';

  const tasks: string[] = Array.isArray(data?.onboarding_tasks) ? (data.onboarding_tasks as string[]) : [];

  if (isLoading) return <p style={styles.state}>Loading…</p>;
  if (isError) return <p style={{ ...styles.state, color: '#e53e3e' }}>Failed to load settings.</p>;

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.heading}>Student Onboarding</h1>
        <p style={styles.subheading}>Tasks to complete when a new student is enrolled.</p>
        {!isAdmin && (
          <p style={styles.readonlyNote}>You have read-only access. Admin role required to save changes.</p>
        )}
        <OnboardingEditor
          tasks={tasks}
          isAdmin={isAdmin}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['settings'] })}
        />
      </div>
    </div>
  );
}

function OnboardingEditor({
  tasks: initialTasks,
  isAdmin,
  onSaved,
}: {
  tasks: string[];
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<string[]>(initialTasks);
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
    if (!trimmed) return;
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
    if (trimmed) {
      setItems(prev => prev.map((item, i) => i === editingIdx ? trimmed : item));
      setSaved(false);
    }
    setEditingIdx(null); setEditingValue('');
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting('onboarding_tasks', items);
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 && (
          <p style={{ color: '#a0aec0', fontSize: 13, margin: 0 }}>No tasks yet. Add one below.</p>
        )}
        {items.map((item, idx) => (
          <div
            key={idx}
            draggable={isAdmin && editingIdx !== idx}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragLeave={() => setDragOver(null)}
            style={{
              ...rowStyles.row,
              ...(dragOver === idx ? { borderColor: '#6366f1', background: '#eef2ff' } : {}),
              cursor: isAdmin && editingIdx !== idx ? 'grab' : 'default',
            }}
          >
            {isAdmin && <span style={rowStyles.handle}>⠿</span>}
            <span style={rowStyles.num}>{idx + 1}.</span>
            {editingIdx === idx ? (
              <input
                autoFocus
                style={{ ...styles.input, flex: 1, padding: '3px 7px', fontSize: 13 }}
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') { setEditingIdx(null); setEditingValue(''); }
                }}
              />
            ) : (
              <span style={rowStyles.text}>{item}</span>
            )}
            {isAdmin && editingIdx !== idx && (
              <button onClick={() => startEdit(idx)} style={rowStyles.iconBtn} title="Edit"><FontAwesomeIcon icon={faPen} /></button>
            )}
            {isAdmin && editingIdx !== idx && (
              <button onClick={() => removeItem(idx)} style={rowStyles.iconBtn} title="Remove"><FontAwesomeIcon icon={faXmark} /></button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              style={{ ...styles.input, flex: 1 }}
              placeholder="Add new task…"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
            <button onClick={addItem} style={styles.addBtn} disabled={!newItem.trim()}>Add</button>
          </div>
          {error && <p style={{ color: '#e53e3e', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={handleSave} disabled={saving} style={saved ? styles.savedBtn : styles.saveBtn}>
              {saving ? 'Saving…' : saved ? <>Saved <FontAwesomeIcon icon={faCheck} /></> : 'Save Changes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 680 },
  heading: { margin: '0 0 4px', fontSize: 24 },
  subheading: { margin: '0 0 20px', fontSize: 13, color: '#718096' },
  readonlyNote: { color: '#718096', fontSize: 13, marginBottom: 16 },
  state: { padding: 32, fontSize: 16, color: '#4a5568' },
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20,
  },
  input: {
    padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 4,
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  addBtn: {
    padding: '8px 16px', background: '#edf2f7', border: '1px solid #e2e8f0',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4a5568',
    whiteSpace: 'nowrap',
  },
  saveBtn: {
    padding: '8px 20px', background: '#4299e1', color: '#fff', border: 'none',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  savedBtn: {
    padding: '8px 20px', background: '#38a169', color: '#fff', border: 'none',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};

const rowStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', background: '#f7fafc',
    borderRadius: 4, border: '1px solid #e2e8f0',
  },
  handle: { color: '#a0aec0', fontSize: 14, cursor: 'grab', userSelect: 'none', flexShrink: 0 },
  num: { fontSize: 12, color: '#a0aec0', fontWeight: 700, width: 22, flexShrink: 0, textAlign: 'right' },
  text: { flex: 1, fontSize: 13, color: '#2d3748' },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#a0aec0', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0,
  },
};

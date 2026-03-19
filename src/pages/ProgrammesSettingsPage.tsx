import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPackagesConfig, updateProgrammes } from '../api/packages.js';
import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faXmark, faCheck } from '@fortawesome/free-solid-svg-icons';

interface ProgItem { original: string | null; current: string; }

export default function ProgrammesSettingsPage() {
  const queryClient = useQueryClient();
  const raw = localStorage.getItem('user');
  const isAdmin = raw ? (JSON.parse(raw) as { role: string }).role === 'ADMIN' : false;

  const { data: config, isLoading, isError } = useQuery({ queryKey: ['packages-config'], queryFn: fetchPackagesConfig });
  const programmes: string[] = Array.isArray(config?.programmes) ? config!.programmes : [];

  const [items, setItems] = useState<ProgItem[]>([]);
  const [newName, setNewName] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setItems(programmes.map(p => ({ original: p, current: p }))); }, [config]);

  const addItem = () => {
    const trimmed = newName.trim();
    if (!trimmed || items.some(i => i.current === trimmed)) return;
    setItems(prev => [...prev, { original: null, current: trimmed }]);
    setNewName(''); setSaved(false);
  };

  const removeItem = (idx: number) => { setItems(prev => prev.filter((_, i) => i !== idx)); setSaved(false); };
  const startEdit = (idx: number) => { setEditingIdx(idx); setEditingValue(items[idx].current); };
  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editingValue.trim();
    if (trimmed && !items.some((i, idx) => i.current === trimmed && idx !== editingIdx)) {
      setItems(prev => prev.map((item, i) => i === editingIdx ? { ...item, current: trimmed } : item));
      setSaved(false);
    }
    setEditingIdx(null);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const renames: { from: string; to: string }[] = [];
      const add: string[] = [];
      const remove: string[] = [];
      for (const item of items) {
        if (item.original === null) add.push(item.current);
        else if (item.original !== item.current) renames.push({ from: item.original, to: item.current });
      }
      for (const orig of programmes) {
        if (!items.some(i => i.original === orig)) remove.push(orig);
      }
      await updateProgrammes({ renames, add, remove });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['packages-config'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  if (isLoading) return <p style={st.state}>Loading...</p>;
  if (isError) return <p style={{ ...st.state, color: '#e53e3e' }}>Failed to load.</p>;
  if (!isAdmin) return <div style={st.page}><h1 style={st.heading}>Programmes</h1><p style={{ color: '#718096', fontSize: 13 }}>Admin role required.</p></div>;

  return (
    <div style={st.page}>
      <style>{`.pkg-icon-btn{transition:color .12s}.pkg-icon-btn:hover{color:#475569!important}.pkg-del-btn{transition:color .12s}.pkg-del-btn:hover{color:#ef4444!important}`}</style>
      <h1 style={st.heading}>Programmes</h1>
      <p style={st.sub}>Manage the list of programmes offered. Renaming or deleting cascades to package assignments.</p>

      <div style={st.card}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item, idx) => (
            <div key={idx} style={st.row}>
              {editingIdx === idx ? (
                <input autoFocus style={{ ...st.input, flex: 1, padding: '4px 8px', fontSize: 13 }} value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingIdx(null); }} />
              ) : (
                <span style={st.text}>
                  {item.current}
                  {item.original !== null && item.original !== item.current && <span style={st.renameBadge}>was: {item.original}</span>}
                  {item.original === null && <span style={st.newBadge}>new</span>}
                </span>
              )}
              {editingIdx !== idx && <>
                <button className="pkg-icon-btn" onClick={() => startEdit(idx)} style={st.iconBtn} title="Rename"><FontAwesomeIcon icon={faPen} /></button>
                <button className="pkg-del-btn" onClick={() => removeItem(idx)} style={st.iconBtn} title="Delete"><FontAwesomeIcon icon={faXmark} /></button>
              </>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input style={{ ...st.input, flex: 1 }} placeholder="New programme name..." value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
          <button onClick={addItem} style={st.addBtn} disabled={!newName.trim()}>Add</button>
        </div>
        {error && <p style={{ color: '#e53e3e', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
        <button onClick={handleSave} disabled={saving} style={{ ...(saved ? st.savedBtn : st.saveBtn), marginTop: 12 }}>
          {saving ? 'Saving...' : saved ? <>Saved <FontAwesomeIcon icon={faCheck} /></> : 'Save'}
        </button>
      </div>
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  page: { padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 22, fontWeight: 700 },
  sub: { color: '#718096', fontSize: 13, marginBottom: 24, marginTop: 4 },
  state: { padding: 32, fontSize: 16, color: '#4a5568' },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 },
  input: { padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f7fafc', borderRadius: 4, border: '1px solid #e2e8f0' },
  text: { flex: 1, fontSize: 13, color: '#2d3748', display: 'flex', alignItems: 'center', gap: 8 },
  renameBadge: { fontSize: 11, color: '#c05621', background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: 8, padding: '1px 6px' },
  newBadge: { fontSize: 11, color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: '1px 6px' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13, padding: '2px 4px', lineHeight: 1 },
  addBtn: { padding: '8px 16px', background: '#edf2f7', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4a5568' },
  saveBtn: { alignSelf: 'flex-end' as const, padding: '7px 18px', background: '#4299e1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  savedBtn: { alignSelf: 'flex-end' as const, padding: '7px 18px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPackagesConfig, updateAges } from '../api/packages.js';
import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCheck } from '@fortawesome/free-solid-svg-icons';

export default function AgeGroupsSettingsPage() {
  const queryClient = useQueryClient();
  const raw = localStorage.getItem('user');
  const isAdmin = raw ? (JSON.parse(raw) as { role: string }).role === 'ADMIN' : false;

  const { data: config, isLoading, isError } = useQuery({ queryKey: ['packages-config'], queryFn: fetchPackagesConfig });
  const ages: number[] = Array.isArray(config?.ages) ? config!.ages : [];

  const [items, setItems] = useState<number[]>([]);
  const [newAge, setNewAge] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setItems(ages); }, [config]);

  const addItem = () => {
    const val = parseInt(newAge, 10);
    if (isNaN(val) || val < 0 || items.includes(val)) return;
    setItems(prev => [...prev, val].sort((a, b) => a - b));
    setNewAge(''); setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const add = items.filter(a => !ages.includes(a));
      const remove = ages.filter(a => !items.includes(a));
      await updateAges({ add, remove });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['packages-config'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  if (isLoading) return <p style={st.state}>Loading...</p>;
  if (isError) return <p style={{ ...st.state, color: '#e53e3e' }}>Failed to load.</p>;
  if (!isAdmin) return <div style={st.page}><h1 style={st.heading}>Age Groups</h1><p style={{ color: '#718096', fontSize: 13 }}>Admin role required.</p></div>;

  return (
    <div style={st.page}>
      <style>{`.pkg-del-btn{transition:color .12s}.pkg-del-btn:hover{color:#ef4444!important}`}</style>
      <h1 style={st.heading}>Age Groups</h1>
      <p style={st.sub}>Manage available age groups. Removing an age group deletes all its package assignments.</p>

      <div style={st.card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map(age => (
            <div key={age} style={st.pill}>
              <span style={{ fontWeight: 600 }}>Age {age}</span>
              <button className="pkg-del-btn" onClick={() => { setItems(prev => prev.filter(a => a !== age)); setSaved(false); }} style={st.pillRemove}><FontAwesomeIcon icon={faXmark} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input style={{ ...st.input, width: 80 }} type="text" placeholder="Age..." value={newAge}
            onChange={e => setNewAge(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && addItem()} />
          <button onClick={addItem} style={st.addBtn} disabled={!newAge.trim()}>Add</button>
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
  pill: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 20, fontSize: 13, color: '#2c5282' },
  pillRemove: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: 0, lineHeight: 1 },
  addBtn: { padding: '8px 16px', background: '#edf2f7', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4a5568' },
  saveBtn: { alignSelf: 'flex-end' as const, padding: '7px 18px', background: '#4299e1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  savedBtn: { alignSelf: 'flex-end' as const, padding: '7px 18px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};

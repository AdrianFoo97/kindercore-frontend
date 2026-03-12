import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPackagesConfig,
  fetchPackages,
  fetchPackageYears,
  createPackage,
  deletePackage,
  patchPackageName,
  updateProgrammes,
  updateAges,
} from '../api/packages.js';
import { Package } from '../types/index.js';

const CURRENT_YEAR = new Date().getFullYear();

// ── Programme row item with original name tracking ────────────────────────────

interface ProgItem { original: string | null; current: string; }

function ProgrammesEditor({ programmes, onSaved }: { programmes: string[]; onSaved: () => void }) {
  const [items, setItems] = useState<ProgItem[]>(() => programmes.map((p) => ({ original: p, current: p })));
  const [newName, setNewName] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setItems(programmes.map((p) => ({ original: p, current: p }))); }, [programmes]);

  const addItem = () => {
    const trimmed = newName.trim();
    if (!trimmed || items.some((i) => i.current === trimmed)) return;
    setItems((prev) => [...prev, { original: null, current: trimmed }]);
    setNewName(''); setSaved(false);
  };

  const removeItem = (idx: number) => { setItems((prev) => prev.filter((_, i) => i !== idx)); setSaved(false); };

  const startEdit = (idx: number) => { setEditingIdx(idx); setEditingValue(items[idx].current); };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editingValue.trim();
    if (trimmed && !items.some((i, idx) => i.current === trimmed && idx !== editingIdx)) {
      setItems((prev) => prev.map((item, i) => i === editingIdx ? { ...item, current: trimmed } : item));
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
        if (!items.some((i) => i.original === orig)) remove.push(orig);
      }
      await updateProgrammes({ renames, add, remove });
      setSaved(true); onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={s.card}>
      <div style={s.label}>Programmes</div>
      <p style={s.desc}>Renaming or deleting cascades to package assignments.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {items.map((item, idx) => (
          <div key={idx} style={ls.row}>
            {editingIdx === idx ? (
              <input autoFocus style={{ ...s.input, flex: 1, padding: '4px 8px', fontSize: 13 }} value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={commitEdit} onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingIdx(null); }} />
            ) : (
              <span style={ls.text}>
                {item.current}
                {item.original !== null && item.original !== item.current && <span style={ls.renameBadge}>was: {item.original}</span>}
                {item.original === null && <span style={ls.newBadge}>new</span>}
              </span>
            )}
            {editingIdx !== idx && <>
              <button onClick={() => startEdit(idx)} style={ls.iconBtn} title="Rename">✎</button>
              <button onClick={() => removeItem(idx)} style={ls.removeBtn} title="Delete">✕</button>
            </>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input style={{ ...s.input, flex: 1 }} placeholder="New programme name…" value={newName}
          onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
        <button onClick={addItem} style={ls.addBtn} disabled={!newName.trim()}>Add</button>
      </div>
      {error && <p style={s.error}>{error}</p>}
      <button onClick={handleSave} disabled={saving} style={{ ...(saved ? s.savedBtn : s.saveBtn), marginTop: 12 }}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  );
}

// ── Ages Editor ───────────────────────────────────────────────────────────────

function AgesEditor({ ages, onSaved }: { ages: number[]; onSaved: () => void }) {
  const [items, setItems] = useState<number[]>(ages);
  const [newAge, setNewAge] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setItems(ages); }, [ages]);

  const addItem = () => {
    const val = parseInt(newAge, 10);
    if (isNaN(val) || val < 0 || items.includes(val)) return;
    setItems((prev) => [...prev, val].sort((a, b) => a - b));
    setNewAge(''); setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const add = items.filter((a) => !ages.includes(a));
      const remove = ages.filter((a) => !items.includes(a));
      await updateAges({ add, remove });
      setSaved(true); onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={s.card}>
      <div style={s.label}>Age Groups</div>
      <p style={s.desc}>Removing an age group deletes all its package assignments.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {items.map((age) => (
          <div key={age} style={ls.agePill}>
            <span style={{ fontWeight: 600 }}>Age {age}</span>
            <button onClick={() => { setItems((prev) => prev.filter((a) => a !== age)); setSaved(false); }} style={ls.agePillRemove}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input style={{ ...s.input, width: 80 }} type="text" placeholder="Age…" value={newAge}
          onChange={(e) => setNewAge(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
        <button onClick={addItem} style={ls.addBtn} disabled={!newAge.trim()}>Add</button>
      </div>
      {error && <p style={s.error}>{error}</p>}
      <button onClick={handleSave} disabled={saving} style={{ ...(saved ? s.savedBtn : s.saveBtn), marginTop: 12 }}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  );
}

// ── Assignments Editor ────────────────────────────────────────────────────────

function AssignmentsEditor({
  packages, programmes, ages, years, onChanged,
}: { packages: Package[]; programmes: string[]; ages: number[]; years: number[]; onChanged: () => void }) {
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [groupBy, setGroupBy] = useState<'programme' | 'age'>('programme');
  const [addYear, setAddYear] = useState(CURRENT_YEAR);
  const [addProg, setAddProg] = useState(programmes[0] ?? '');
  const [addAge, setAddAge] = useState<string>(ages[0] !== undefined ? String(ages[0]) : '');
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Auto-fill name when year/programme/age selection changes
  useEffect(() => {
    const prog = addProg || programmes[0] || '';
    const age = parseInt(addAge, 10);
    if (prog && !isNaN(age)) setAddName(`${addYear} ${prog} (${age}Y)`);
  }, [addYear, addProg, addAge, programmes]);

  useEffect(() => {
    if (programmes.length) setAddProg((p) => p || programmes[0]);
  }, [programmes]);
  useEffect(() => {
    if (ages.length) setAddAge((a) => a || String(ages[0]));
  }, [ages]);

  const handleAdd = async () => {
    const prog = addProg.trim();
    const age = parseInt(addAge, 10);
    const name = addName.trim();
    const price = parseFloat(addPrice);
    if (!prog || isNaN(age) || !name) { setAddError('All fields required'); return; }
    if (addPrice.trim() === '' || isNaN(price) || price < 0) { setAddError('Please enter a valid price'); return; }
    setAdding(true); setAddError('');
    try {
      await createPackage({ year: addYear, programme: prog, age, name, price });
      setFilterYear(addYear);
      onChanged();
    } catch (err: unknown) { setAddError(err instanceof Error ? err.message : 'Failed to add'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try { await deletePackage(id); onChanged(); }
    catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const startEditName = (pkg: Package) => { setEditingId(pkg.id); setEditingName(pkg.name); };

  const commitEditName = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) { setEditingId(null); return; }
    setSavingId(id);
    try { await patchPackageName(id, trimmed); onChanged(); }
    catch { /* ignore */ }
    finally { setSavingId(null); setEditingId(null); }
  };

  const visiblePackages = packages.filter((p) => p.year === filterYear);
  const usedCombos = new Set(packages.filter((p) => p.year === addYear).map((p) => `${p.programme}|${p.age}`));

  // All years to show as tabs (from existing packages + current year)
  const allYears = [...new Set([...years, CURRENT_YEAR])].sort((a, b) => b - a);

  return (
    <div style={s.card}>
      <div style={s.label}>Package Assignments</div>
      <p style={s.desc}>Assign a programme to an age group to create a package. Only assigned packages appear on the pricing page.</p>

      {/* Year filter tabs + Group by toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={as.yearTabs}>
          {allYears.map((y) => (
            <button key={y} onClick={() => setFilterYear(y)}
              style={y === filterYear ? as.yearTabActive : as.yearTab}>
              {y}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#718096', fontWeight: 600 }}>Group by</span>
          <div style={as.groupToggle}>
            <button onClick={() => setGroupBy('programme')} style={groupBy === 'programme' ? as.groupBtnActive : as.groupBtn}>Programme</button>
            <button onClick={() => setGroupBy('age')} style={groupBy === 'age' ? as.groupBtnActive : as.groupBtn}>Age</button>
          </div>
        </div>
      </div>

      {visiblePackages.length === 0 && (
        <p style={{ color: '#a0aec0', fontSize: 13, marginTop: 8 }}>No packages assigned for {filterYear}.</p>
      )}

      {visiblePackages.length > 0 && (() => {
        const pkgRow = (pkg: Package) => (
          <div key={pkg.id} style={as.row}>
            {groupBy === 'programme'
              ? <span style={as.ageBadge}>Age {pkg.age}</span>
              : <span style={as.progBadge}>{pkg.programme}</span>
            }
            {editingId === pkg.id ? (
              <input
                autoFocus
                style={{ ...s.input, flex: 1, padding: '4px 8px', fontSize: 13 }}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => commitEditName(pkg.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEditName(pkg.id); if (e.key === 'Escape') setEditingId(null); }}
              />
            ) : (
              <span style={as.name}>{pkg.name}</span>
            )}
            {editingId !== pkg.id && (
              <button onClick={() => startEditName(pkg)} style={ls.iconBtn} disabled={savingId === pkg.id} title="Rename">✎</button>
            )}
            {confirmDeleteId === pkg.id ? (
              <span style={as.confirmRow}>
                <span style={as.confirmText}>Remove?</span>
                <button onClick={() => handleDelete(pkg.id)} disabled={deletingId === pkg.id} style={as.confirmYes}>Yes</button>
                <button onClick={() => setConfirmDeleteId(null)} style={as.confirmNo}>No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDeleteId(pkg.id)} style={as.deleteBtn} disabled={deletingId === pkg.id} title="Remove">✕</button>
            )}
          </div>
        );

        if (groupBy === 'programme') {
          const groups = [...new Set(visiblePackages.map(p => p.programme))].sort();
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
              {groups.map(prog => (
                <div key={prog}>
                  <div style={as.groupHeader}>{prog}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {visiblePackages.filter(p => p.programme === prog).sort((a, b) => a.age - b.age).map(pkgRow)}
                  </div>
                </div>
              ))}
            </div>
          );
        } else {
          const groups = [...new Set(visiblePackages.map(p => p.age))].sort((a, b) => a - b);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
              {groups.map(age => (
                <div key={age}>
                  <div style={as.groupHeader}>Age {age}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {visiblePackages.filter(p => p.age === age).sort((a, b) => a.programme.localeCompare(b.programme)).map(pkgRow)}
                  </div>
                </div>
              ))}
            </div>
          );
        }
      })()}

      {/* Add new assignment */}
      {programmes.length > 0 && ages.length > 0 && (
        <div style={as.addForm}>
          <div style={as.addFormTitle}>Add Assignment</div>
          {/* Row 1: Year · Programme · Age */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <label style={as.fieldLabel}>
              Year
              <select style={{ ...as.select, width: 90 }} value={addYear} onChange={(e) => setAddYear(Number(e.target.value))}>
                {allYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label style={{ ...as.fieldLabel, flex: 1 }}>
              Programme
              <select style={as.select} value={addProg} onChange={(e) => setAddProg(e.target.value)}>
                {programmes.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label style={as.fieldLabel}>
              Age
              <select style={as.select} value={addAge} onChange={(e) => setAddAge(e.target.value)}>
                {ages.map((a) => (
                  <option key={a} value={a} disabled={usedCombos.has(`${addProg}|${a}`)}>
                    Age {a}{usedCombos.has(`${addProg}|${a}`) ? ' (exists)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* Row 2: Package Name · Price · Add */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <label style={{ ...as.fieldLabel, flex: 1 }}>
              Package Name
              <input style={s.input} value={addName} onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="e.g. 2026 Half Day (2Y)" />
            </label>
            <label style={as.fieldLabel}>
              Price (RM)
              <input
                type="number"
                min="0"
                step="0.01"
                style={{ ...as.select, width: 110 }}
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. 500"
              />
            </label>
            <button onClick={handleAdd} disabled={adding} style={{ ...s.saveBtn, alignSelf: 'flex-end' }}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          {addError && <p style={s.error}>{addError}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PackageSettingsPage() {
  const queryClient = useQueryClient();
  const raw = localStorage.getItem('user');
  const isAdmin = raw ? (JSON.parse(raw) as { role: string }).role === 'ADMIN' : false;

  const { data: config, isLoading: configLoading, isError } = useQuery({
    queryKey: ['packages-config'],
    queryFn: fetchPackagesConfig,
  });
  const { data: packages = [], isLoading: pkgsLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => fetchPackages(),
  });
  const { data: years = [] } = useQuery({
    queryKey: ['package-years'],
    queryFn: fetchPackageYears,
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['packages-config'] });
    queryClient.invalidateQueries({ queryKey: ['packages'] });
    queryClient.invalidateQueries({ queryKey: ['package-years'] });
  };

  if (configLoading || pkgsLoading) return <p style={s.state}>Loading…</p>;
  if (isError) return <p style={{ ...s.state, color: '#e53e3e' }}>Failed to load packages config.</p>;
  if (!isAdmin) return (
    <div style={s.page}><h1 style={s.heading}>Package Settings</h1>
      <p style={{ color: '#718096', fontSize: 13 }}>Admin role required.</p>
    </div>
  );

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Package Settings</h1>
      <p style={s.subNote}>Define programmes, age groups, and assign which packages are available.</p>
      <div style={s.list}>
        <ProgrammesEditor programmes={config!.programmes} onSaved={handleSaved} />
        <AgesEditor ages={config!.ages} onSaved={handleSaved} />
        <AssignmentsEditor packages={packages} programmes={config!.programmes} ages={config!.ages} years={years} onChanged={handleSaved} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'system-ui, sans-serif', maxWidth: 700, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24 },
  subNote: { color: '#718096', fontSize: 13, marginBottom: 24, marginTop: 4 },
  state: { padding: 32, fontSize: 16, color: '#4a5568' },
  list: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontWeight: 700, fontSize: 14, color: '#2d3748' },
  desc: { fontSize: 12, color: '#718096', margin: 0 },
  input: { padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const },
  error: { color: '#e53e3e', fontSize: 12, margin: 0 },
  saveBtn: { alignSelf: 'flex-end', padding: '7px 18px', background: '#4299e1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  savedBtn: { alignSelf: 'flex-end', padding: '7px 18px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};

const ls: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f7fafc', borderRadius: 4, border: '1px solid #e2e8f0' },
  text: { flex: 1, fontSize: 13, color: '#2d3748', display: 'flex', alignItems: 'center', gap: 8 },
  renameBadge: { fontSize: 11, color: '#c05621', background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: 8, padding: '1px 6px' },
  newBadge: { fontSize: 11, color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: '1px 6px' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0', fontSize: 15, padding: '0 2px', lineHeight: 1 },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0', fontSize: 14, padding: '0 2px', lineHeight: 1 },
  addBtn: { padding: '8px 16px', background: '#edf2f7', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4a5568' },
  agePill: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 20, fontSize: 13, color: '#2c5282' },
  agePillRemove: { background: 'none', border: 'none', cursor: 'pointer', color: '#90cdf4', fontSize: 12, padding: 0, lineHeight: 1 },
};

const as: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f7fafc', borderRadius: 4, border: '1px solid #e2e8f0' },
  progBadge: { fontSize: 11, fontWeight: 700, color: '#2b6cb0', background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap' as const },
  ageBadge: { fontSize: 11, fontWeight: 700, color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap' as const },
  name: { flex: 1, fontSize: 13, color: '#2d3748', fontWeight: 500 },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#fc8181', fontSize: 14, padding: '0 2px', lineHeight: 1 },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 4 },
  confirmText: { fontSize: 12, color: '#e53e3e', fontWeight: 600 },
  confirmYes: { padding: '2px 8px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  confirmNo: { padding: '2px 8px', background: '#edf2f7', color: '#4a5568', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  yearTabs: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const },
  groupToggle: { display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' },
  groupBtn: { padding: '4px 12px', background: '#f7fafc', border: 'none', cursor: 'pointer', fontSize: 12, color: '#4a5568', fontWeight: 500 },
  groupBtnActive: { padding: '4px 12px', background: '#2b6cb0', border: 'none', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 700 },
  groupHeader: { fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, paddingLeft: 2 },
  yearTab: { padding: '4px 14px', border: '1px solid #e2e8f0', borderRadius: 20, background: '#f7fafc', cursor: 'pointer', fontSize: 13, color: '#4a5568', fontWeight: 500 },
  yearTabActive: { padding: '4px 14px', border: '1px solid #4299e1', borderRadius: 20, background: '#ebf8ff', cursor: 'pointer', fontSize: 13, color: '#2b6cb0', fontWeight: 700 },
  addForm: { marginTop: 14, padding: 14, background: '#f7fafc', borderRadius: 6, border: '1px dashed #cbd5e0', display: 'flex', flexDirection: 'column', gap: 10 },
  addFormTitle: { fontSize: 13, fontWeight: 700, color: '#4a5568' },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#4a5568' },
  select: { padding: '7px 10px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: 14, fontFamily: 'inherit', background: '#fff' },
};

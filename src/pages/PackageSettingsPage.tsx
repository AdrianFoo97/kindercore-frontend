import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPackagesConfig,
  fetchPackages,
  fetchPackageYears,
  createPackage,
  deletePackage,
  patchPackage,
} from '../api/packages.js';
import { Package } from '../types/index.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash, faCheck, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';

const CURRENT_YEAR = new Date().getFullYear();

const AGE_COLORS: { bg: string; color: string; border: string }[] = [
  { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
  { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  { bg: '#ccfbf1', color: '#115e59', border: '#99f6e4' },
  { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
];

const PROG_COLORS: { bg: string; color: string; border: string }[] = [
  { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
  { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
  { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  { bg: '#ccfbf1', color: '#115e59', border: '#99f6e4' },
  { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
];

// ── Assignments Editor ────────────────────────────────────────────────────────

function AssignmentsEditor({
  packages, programmes, ages, years, onChanged,
}: { packages: Package[]; programmes: string[]; ages: number[]; years: number[]; onChanged: () => void }) {
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [groupBy, setGroupBy] = useState<'programme' | 'age'>('programme');
  const [addProg, setAddProg] = useState(programmes[0] ?? '');
  const [addAge, setAddAge] = useState<string>(ages[0] !== undefined ? String(ages[0]) : '');
  const [addPrice, setAddPrice] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPrice, setEditingPrice] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => { if (programmes.length) setAddProg(p => p || programmes[0]); }, [programmes]);
  useEffect(() => { if (ages.length) setAddAge(a => a || String(ages[0])); }, [ages]);

  const autoName = () => {
    const prog = addProg || programmes[0] || '';
    const age = parseInt(addAge, 10);
    return prog && !isNaN(age) ? `${filterYear} ${prog} (${age}Y)` : '';
  };

  const handleAdd = async () => {
    const prog = addProg.trim();
    const age = parseInt(addAge, 10);
    const name = autoName();
    const price = parseFloat(addPrice);
    if (!prog || isNaN(age) || !name) { setAddError('Select programme and age'); return; }
    if (addPrice.trim() === '' || isNaN(price) || price < 0) { setAddError('Enter a valid price'); return; }
    setAdding(true); setAddError('');
    try {
      await createPackage({ year: filterYear, programme: prog, age, name, price });
      setAddPrice(''); setShowAddForm(false);
      onChanged();
    } catch (err: unknown) { setAddError(err instanceof Error ? err.message : 'Failed to add'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null); setDeletingId(id);
    try { await deletePackage(id); onChanged(); }
    catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const startEdit = (pkg: Package) => { setEditingId(pkg.id); setEditingName(pkg.name); setEditingPrice(pkg.price !== null ? String(pkg.price) : ''); };
  const commitEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) { setEditingId(null); return; }
    const price = parseFloat(editingPrice);
    setSavingId(id);
    try { await patchPackage(id, { name: trimmed, ...(editingPrice.trim() !== '' && !isNaN(price) ? { price } : {}) }); onChanged(); }
    catch { /* ignore */ }
    finally { setSavingId(null); setEditingId(null); }
  };

  const visible = packages.filter(p => p.year === filterYear);
  const usedCombos = new Set(packages.filter(p => p.year === filterYear).map(p => `${p.programme}|${p.age}`));
  const allYears = [...new Set([...years, CURRENT_YEAR])].sort((a, b) => b - a);

  const formatPrice = (p: number | null) => p !== null ? `RM ${p.toFixed(2)}` : '—';

  // ── Row renderer ──
  const pkgRow = (pkg: Package) => (
    <div key={pkg.id} className="pa-row" style={st.row}>
      <div style={st.rowBadge}>
        {groupBy === 'programme'
          ? (() => { const idx = ages.indexOf(pkg.age); const c = AGE_COLORS[(idx >= 0 ? idx : pkg.age) % AGE_COLORS.length]; return <span style={{ ...st.pill, background: c.bg, color: c.color }}>Age {pkg.age}</span>; })()
          : (() => { const idx = programmes.indexOf(pkg.programme); const c = PROG_COLORS[(idx >= 0 ? idx : 0) % PROG_COLORS.length]; return <span style={{ ...st.pill, background: c.bg, color: c.color }}>{pkg.programme}</span>; })()
        }
      </div>
      <div style={st.rowMain}>
        {editingId === pkg.id ? (
          <input autoFocus style={st.editInput} value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(pkg.id); if (e.key === 'Escape') setEditingId(null); }}
          />
        ) : (
          <span style={st.rowName}>{pkg.name}</span>
        )}
      </div>
      {editingId === pkg.id ? (
        <input type="number" min="0" step="0.01" style={{ ...st.editInput, width: 90, textAlign: 'right' as const }} value={editingPrice}
          onChange={e => setEditingPrice(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(pkg.id); if (e.key === 'Escape') setEditingId(null); }}
        />
      ) : (
        <span style={st.rowPrice}>{formatPrice(pkg.price)}</span>
      )}
      <div style={st.rowActions}>
        {editingId === pkg.id ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button onClick={() => commitEdit(pkg.id)} disabled={savingId === pkg.id} style={{ ...st.iconBtn, color: '#16a34a', borderColor: '#bbf7d0' }} title="Save">
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button onClick={() => setEditingId(null)} style={{ ...st.iconBtn, color: '#94a3b8' }} title="Cancel">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </span>
        ) : (
          <button onClick={() => startEdit(pkg)} style={st.iconBtn} disabled={savingId === pkg.id} title="Edit">
            <FontAwesomeIcon icon={faPen} />
          </button>
        )}
        {editingId !== pkg.id && (
          confirmDeleteId === pkg.id ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button onClick={() => handleDelete(pkg.id)} disabled={deletingId === pkg.id} style={st.confirmYes}>Yes</button>
              <button onClick={() => setConfirmDeleteId(null)} style={st.confirmNo}>No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDeleteId(pkg.id)} style={st.deleteIconBtn} disabled={deletingId === pkg.id} title="Remove">
              <FontAwesomeIcon icon={faTrash} />
            </button>
          )
        )}
      </div>
    </div>
  );

  // ── Group renderer ──
  const renderGroups = () => {
    if (groupBy === 'programme') {
      const groups = [...new Set(visible.map(p => p.programme))].sort();
      return groups.map(prog => (
        <div key={prog} style={{ marginBottom: 16 }}>
          <div style={st.groupHeader}>{prog} <span style={st.groupCount}>{visible.filter(p => p.programme === prog).length}</span></div>
          <div style={st.groupList}>
            {visible.filter(p => p.programme === prog).sort((a, b) => a.age - b.age).map(pkgRow)}
          </div>
        </div>
      ));
    } else {
      const groups = [...new Set(visible.map(p => p.age))].sort((a, b) => a - b);
      return groups.map(age => (
        <div key={age} style={{ marginBottom: 16 }}>
          <div style={st.groupHeader}>Age {age} <span style={st.groupCount}>{visible.filter(p => p.age === age).length}</span></div>
          <div style={st.groupList}>
            {visible.filter(p => p.age === age).sort((a, b) => a.programme.localeCompare(b.programme)).map(pkgRow)}
          </div>
        </div>
      ));
    }
  };

  return (
    <>
      <style>{`
        .pa-row:hover{background:#f8fafc}
      `}</style>

      {/* ── Controls bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        {/* Year dropdown */}
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={{
          padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600,
          color: '#1e293b', background: '#fff', cursor: 'pointer',
        }}>
          {allYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Group by segmented control */}
          <div style={{ display: 'inline-flex', borderRadius: 6, background: '#f1f5f9', padding: 2 }}>
            {(['programme', 'age'] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)} style={{
                padding: '4px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: 'none', lineHeight: '18px',
                background: groupBy === g ? '#fff' : 'transparent',
                color: groupBy === g ? '#1e293b' : '#94a3b8',
                boxShadow: groupBy === g ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.12s',
              }}>{g === 'programme' ? 'Programme' : 'Age'}</button>
            ))}
          </div>

          {/* Add button */}
          {programmes.length > 0 && ages.length > 0 && (
            <button onClick={() => setShowAddForm(v => !v)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
              background: showAddForm ? '#1e293b' : '#5a79c8', color: '#fff',
            }}>
              <FontAwesomeIcon icon={faPlus} /> Add
            </button>
          )}
        </div>
      </div>

      {/* ── Quick add form ── */}
      {showAddForm && (
        <div style={st.addCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>New Package for {filterYear}</span>
            <button onClick={() => { setShowAddForm(false); setAddError(''); setAddPrice(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={st.addFieldLabel}>
              Programme
              <select value={addProg} onChange={e => setAddProg(e.target.value)} style={st.addSelect}>
                {programmes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label style={st.addFieldLabel}>
              Age
              <select value={addAge} onChange={e => setAddAge(e.target.value)} style={{ ...st.addSelect, width: 85 }}>
                {ages.map(a => (
                  <option key={a} value={a} disabled={usedCombos.has(`${addProg}|${a}`)}>
                    {a}{usedCombos.has(`${addProg}|${a}`) ? ' (exists)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label style={st.addFieldLabel}>
              Price (RM)
              <input type="number" min="0" step="0.01" placeholder="0.00" value={addPrice}
                onChange={e => setAddPrice(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ ...st.addInput, width: 100 }}
              />
            </label>
            <button onClick={handleAdd} disabled={adding} style={st.addBtn}>
              {adding ? '...' : 'Add Package'}
            </button>
          </div>
          {autoName() && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
              Will be created as: <strong style={{ color: '#64748b' }}>{autoName()}</strong>
            </div>
          )}
          {addError && <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626' }}>{addError}</div>}
        </div>
      )}

      {/* ── Assignment list ── */}
      {visible.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No packages assigned for {filterYear}.
        </div>
      )}

      {visible.length > 0 && (
        <div>
          {renderGroups()}
        </div>
      )}

      {/* Summary */}
      <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
        {visible.length} package{visible.length !== 1 ? 's' : ''} for {filterYear}
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PackageSettingsPage() {
  const { isMobile } = useIsMobile();
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

  if (configLoading || pkgsLoading) return <p style={{ padding: 32, fontSize: 16, color: '#4a5568' }}>Loading...</p>;
  if (isError) return <p style={{ padding: 32, fontSize: 16, color: '#e53e3e' }}>Failed to load packages config.</p>;

  const programmes: string[] = Array.isArray(config?.programmes) ? config!.programmes : [];
  const ages: number[] = Array.isArray(config?.ages) ? config!.ages : [];

  if (!isAdmin) return (
    <div style={{ ...st.page, ...(isMobile ? { padding: '16px 12px', maxWidth: '100%' } : {}) }}>
      <h1 style={st.heading}>Package Assignment</h1>
      <p style={{ color: '#718096', fontSize: 13 }}>Admin role required.</p>
    </div>
  );

  return (
    <div style={{ ...st.page, ...(isMobile ? { padding: '16px 12px', maxWidth: '100%' } : {}) }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={st.heading}>Package Assignment</h1>
        <p style={st.sub}>Assign programmes to age groups. Only assigned packages appear on the pricing page.</p>
      </div>
      <AssignmentsEditor packages={packages} programmes={programmes} ages={ages} years={years} onChanged={handleSaved} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto' },
  heading: { margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' },
  sub: { margin: '4px 0 0', fontSize: 13, color: '#8893a7' },

  // Group
  groupHeader: {
    fontSize: 13, fontWeight: 700, color: '#1e293b',
    padding: '0 4px 8px', display: 'flex', alignItems: 'center', gap: 8,
    borderBottom: '2px solid #e2e8f0', marginBottom: 6,
  },
  groupCount: { fontSize: 10, fontWeight: 600, color: '#94a3b8', background: '#f1f5f9', padding: '1px 7px', borderRadius: 20 },
  groupList: { display: 'flex', flexDirection: 'column' as const, gap: 0 },

  // Row
  row: {
    display: 'grid', gridTemplateColumns: 'auto 1fr 90px 60px', gap: 10, alignItems: 'center',
    padding: '9px 12px', borderBottom: '1px solid #f1f5f9',
  },
  rowBadge: { flexShrink: 0 },
  rowMain: { minWidth: 0 },
  rowName: { fontSize: 13, color: '#475569', fontWeight: 400, overflow: 'hidden' as const, textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block' },
  rowPrice: { fontSize: 13, fontWeight: 600, color: '#1e293b', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' as const, textAlign: 'right' as const },
  rowActions: { display: 'flex', gap: 4, justifyContent: 'flex-end', flexShrink: 0 },
  editInput: { width: '100%', padding: '3px 8px', border: '1px solid #93c5fd', borderRadius: 4, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const },

  // Badges
  pill: { fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px', display: 'inline-block', whiteSpace: 'nowrap' as const },

  // Action buttons
  iconBtn: { background: 'none', border: '1px solid #e2e8f0', cursor: 'pointer', color: '#94a3b8', fontSize: 11, padding: '3px 6px', lineHeight: 1, borderRadius: 4, transition: 'all 0.12s' },
  deleteIconBtn: { background: 'none', border: '1px solid #fecaca', cursor: 'pointer', color: '#fca5a5', fontSize: 11, padding: '3px 6px', lineHeight: 1, borderRadius: 4, transition: 'all 0.12s' },
  confirmYes: { padding: '2px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  confirmNo: { padding: '2px 8px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 },

  // Add card
  addCard: {
    padding: '14px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20,
  },
  addFieldLabel: { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 11, fontWeight: 600, color: '#64748b' },
  addSelect: { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#334155', cursor: 'pointer' },
  addInput: { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, color: '#334155' },
  addBtn: { padding: '6px 16px', background: '#5a79c8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, alignSelf: 'flex-end' as const },
};

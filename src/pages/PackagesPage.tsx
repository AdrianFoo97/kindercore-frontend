import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPackages, fetchPackageYears, upsertPackages } from '../api/packages.js';
import { Package } from '../types/index.js';

const CURRENT_YEAR = new Date().getFullYear();

type PriceDraft = Record<string, string>; // key = `${programme}|${age}`
type ErrorDraft = Record<string, string>;

function cellKey(programme: string, age: number) { return `${programme}|${age}`; }

const CURRENCY_RE = /^\d+(\.\d{0,2})?$/;

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return `RM ${price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PackagesPage() {
  const queryClient = useQueryClient();
  const raw = localStorage.getItem('user');
  const isAdmin = raw ? (JSON.parse(raw) as { role: string }).role === 'ADMIN' : false;

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const { data: years = [] } = useQuery({
    queryKey: ['package-years'],
    queryFn: fetchPackageYears,
  });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages', selectedYear],
    queryFn: () => fetchPackages(selectedYear),
  });

  const allYears = [...new Set([...years, CURRENT_YEAR])].sort((a, b) => b - a);

  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<PriceDraft>({});
  const [errors, setErrors] = useState<ErrorDraft>({});
  const [saveError, setSaveError] = useState('');
  const [savedYear, setSavedYear] = useState<number | null>(null);

  const programmes = [...new Set(packages.map((p) => p.programme))].sort();
  const ages = [...new Set(packages.map((p) => p.age))].sort((a, b) => a - b);

  const pkgMap = new Map<string, Package>();
  for (const pkg of packages) pkgMap.set(cellKey(pkg.programme, pkg.age), pkg);

  const handleEdit = () => {
    const d: PriceDraft = {};
    for (const pkg of packages) {
      d[cellKey(pkg.programme, pkg.age)] = pkg.price !== null ? String(pkg.price) : '';
    }
    setDrafts(d);
    setErrors({});
    setSaveError('');
    setSavedYear(null);
    setEditMode(true);
  };

  const handleCancel = () => { setEditMode(false); setErrors({}); setSaveError(''); };

  const handleChange = (key: string, val: string) => {
    // Allow empty, digits, one dot, up to 2 decimal places
    if (val !== '' && !CURRENCY_RE.test(val)) return;
    setDrafts((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const mutation = useMutation({
    mutationFn: upsertPackages,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages', selectedYear] });
      setEditMode(false); setSaveError(''); setErrors({});
      setSavedYear(selectedYear);
    },
    onError: (err: unknown) => setSaveError(err instanceof Error ? err.message : 'Save failed'),
  });

  const handleSave = () => {
    const errs: ErrorDraft = {};
    for (const pkg of packages) {
      const key = cellKey(pkg.programme, pkg.age);
      const val = (drafts[key] ?? '').trim();
      if (val !== '') {
        const n = parseFloat(val);
        if (!CURRENCY_RE.test(val) || isNaN(n) || n < 0) errs[key] = 'Must be a valid amount (e.g. 700.00)';
      }
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const items = packages.map((pkg) => {
      const val = (drafts[cellKey(pkg.programme, pkg.age)] ?? '').trim();
      return { year: pkg.year, programme: pkg.programme, age: pkg.age, price: val === '' ? null : parseFloat(val) };
    });
    mutation.mutate(items);
  };

  return (
    <div style={styles.page}>
      <div style={styles.inner}>

        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 style={styles.heading}>Packages &amp; Pricing</h1>
            <select
              value={selectedYear}
              onChange={e => { setSelectedYear(Number(e.target.value)); setEditMode(false); setSavedYear(null); }}
              style={styles.yearSelect}
            >
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdmin && editMode && <>
              <button onClick={handleCancel} style={styles.cancelBtn} disabled={mutation.isPending}>Cancel</button>
              <button onClick={handleSave} style={styles.saveBtn} disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </>}
            {isAdmin && !editMode && packages.length > 0 && (
              <button onClick={handleEdit} style={styles.editBtn}>Edit Prices</button>
            )}
          </div>
        </div>

        <div style={{ ...styles.editBanner, visibility: savedYear !== null ? 'visible' : 'hidden' }}>
          Prices for <strong>{savedYear ?? selectedYear}</strong> saved successfully.
        </div>

        {saveError && <p style={styles.error}>{saveError}</p>}

        {isLoading ? (
          <p style={styles.stateMsg}>Loading…</p>
        ) : packages.length === 0 ? (
          <p style={styles.stateMsg}>
            No packages assigned yet.{isAdmin && ' Go to Settings → Packages to create assignments.'}
          </p>
        ) : (
          <div style={styles.card}>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.progCol }}>Programme</th>
                    {ages.map((age) => (
                      <th key={age} style={styles.th}>Age {age}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {programmes.map((prog, progIdx) => (
                    <tr key={prog} style={{ ...styles.tr, ...(progIdx % 2 === 1 ? styles.trAlt : {}) }}>
                      <td style={{ ...styles.td, ...styles.progCell }}>{prog}</td>
                      {ages.map((age) => {
                        const pkg = pkgMap.get(cellKey(prog, age));
                        const key = cellKey(prog, age);
                        const err = errors[key];
                        return (
                          <td key={age} style={styles.td}>
                            {!pkg ? (
                              <span style={styles.na}>—</span>
                            ) : editMode ? (
                              <div style={styles.inputWrapper}>
                                <input
                                  type="text"
                                  style={{ ...styles.priceInput, ...(err ? styles.inputError : {}) }}
                                  value={drafts[key] ?? ''}
                                  onChange={(e) => handleChange(key, e.target.value)}
                                  placeholder=""
                                />
                                {err && <span style={styles.cellError}>{err}</span>}
                              </div>
                            ) : (
                              <span style={pkg.price !== null ? styles.priceDisplay : styles.priceEmpty}>
                                {formatPrice(pkg.price)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isAdmin && packages.length > 0 && (
          <p style={styles.readonlyNote}>Viewing only. Contact an admin to update pricing.</p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center', background: '#f8fafc', minHeight: '100vh' },
  inner: { width: '100%', maxWidth: 1200 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  heading: { margin: 0, fontSize: 22, fontWeight: 700, color: '#1a202c' },
  yearSelect: {
    padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
    fontSize: 14, fontWeight: 700, color: '#2b6cb0', background: '#ebf8ff',
    cursor: 'pointer', outline: 'none',
  },
  editBanner: {
    marginBottom: 16, padding: '10px 16px', background: '#fffbeb',
    border: '1px solid #f6e05e', borderRadius: 8, fontSize: 13, color: '#744210',
  },
  stateMsg: { color: '#718096', textAlign: 'center', marginTop: 48, fontSize: 15 },
  error: { color: '#e53e3e', marginBottom: 12, fontSize: 13 },
  card: {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  tableWrapper: {},
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'center', padding: '11px 16px',
    background: '#f7fafc', fontWeight: 700, fontSize: 12,
    color: '#718096', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' as const,
  },
  progCol: { textAlign: 'left', width: 180 },
  tr: { borderBottom: '1px solid #f0f4f8', transition: 'background 0.15s' },
  trAlt: { background: '#fafbfc' },
  td: { padding: '0 16px', height: 58, verticalAlign: 'middle', textAlign: 'center' },
  progCell: {
    textAlign: 'left', fontWeight: 600, fontSize: 14,
    color: '#2d3748', whiteSpace: 'nowrap' as const,
  },
  na: { color: '#e2e8f0', fontSize: 18, fontWeight: 300 },
  priceDisplay: {
    display: 'inline-block', width: 110, height: 30, lineHeight: '28px',
    fontSize: 14, fontWeight: 700, color: '#2b6cb0',
    background: '#ebf8ff', padding: '0', borderRadius: 8,
    border: '1px solid #bee3f8', boxSizing: 'border-box' as const, textAlign: 'center' as const,
  },
  priceEmpty: {
    display: 'inline-block', width: 110, height: 30, lineHeight: '30px',
    fontSize: 14, color: '#cbd5e0',
    boxSizing: 'border-box' as const, textAlign: 'center' as const,
  },
  inputWrapper: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  priceInput: {
    display: 'inline-block', width: 110, height: 30, padding: '0',
    border: '2px solid #4299e1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit',
    textAlign: 'center' as const, background: '#ebf8ff', color: '#2b6cb0', fontWeight: 700,
    outline: 'none', boxSizing: 'border-box' as const, lineHeight: '26px',
  },
  inputError: { border: '2px solid #fc8181', background: '#fff5f5', color: '#c53030' },
  cellError: {
    position: 'absolute' as const, bottom: -16, left: '50%',
    transform: 'translateX(-50%)', fontSize: 10, color: '#e53e3e', whiteSpace: 'nowrap' as const,
  },
  editBtn: {
    padding: '7px 18px', background: '#fff', color: '#2d3748',
    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  saveBtn: {
    padding: '7px 18px', background: '#2b6cb0', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  cancelBtn: {
    padding: '7px 18px', background: '#fff', color: '#4a5568',
    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  readonlyNote: { marginTop: 16, fontSize: 12, color: '#a0aec0', textAlign: 'center' as const },
};

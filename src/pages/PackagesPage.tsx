import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark, faPen } from '@fortawesome/free-solid-svg-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPackages, fetchPackageYears, upsertPackages } from '../api/packages.js';
import { Package } from '../types/index.js';

const CURRENT_YEAR = new Date().getFullYear();

type ErrorDraft = Record<string, string>;

function cellKey(programme: string, age: number) { return `${programme}|${age}`; }

const CURRENCY_RE = /^\d+(\.\d{0,2})?$/;

function formatPrice(price: number | null): string {
  if (price === null || price === 0) return '';
  return `RM ${price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Inline editable price cell ──────────────────────────────────────────────

function PriceCell({ pkg, isAdmin, onSave, editingKey, onEditStart }: {
  pkg: Package;
  isAdmin: boolean;
  onSave: (pkg: Package, price: number | null) => void;
  editingKey: string | null;
  onEditStart: (key: string | null) => void;
}) {
  const key = cellKey(pkg.programme, pkg.age);
  const editing = editingKey === key;
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (!isAdmin) return;
    setDraft(pkg.price !== null && pkg.price !== 0 ? String(pkg.price) : '');
    setError('');
    onEditStart(key);
  };

  const handleChange = (val: string) => {
    if (val !== '' && !CURRENCY_RE.test(val)) return;
    setDraft(val);
    setError('');
  };

  const handleSave = () => {
    const val = draft.trim();
    if (val === '') {
      setError('Required');
      return;
    }
    const n = parseFloat(val);
    if (!CURRENCY_RE.test(val) || isNaN(n) || n < 0) {
      setError('Invalid');
      return;
    }
    onSave(pkg, n);
    onEditStart(null);
    setHovered(false);
  };

  const handleCancel = () => {
    onEditStart(null);
    setError('');
    setHovered(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  const hasPrice = pkg.price !== null && pkg.price !== 0;
  const display = formatPrice(pkg.price);

  if (editing) {
    return (
      <div style={s.editingCell}>
        <div style={s.inputRow}>
          <span style={s.rmPrefix}>RM</span>
          <input
            ref={inputRef}
            type="text"
            style={{ ...s.inlineInput, ...(error ? s.inputErr : {}) }}
            value={draft}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0.00"
          />
          <button onClick={handleSave} style={s.inlineSave} title="Save"><FontAwesomeIcon icon={faCheck} /></button>
          <button onClick={handleCancel} style={s.inlineCancel} title="Cancel"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        {error && <span style={s.cellError}>{error}</span>}
      </div>
    );
  }

  return (
    <div
      style={{ ...s.displayCell, ...(isAdmin && hovered && !editingKey ? s.displayCellHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={startEdit}
    >
      {hasPrice ? (
        <>
          <span style={s.priceText}>{display}</span>
          <span style={{ ...s.editIcon, opacity: isAdmin && hovered && !editingKey ? 1 : 0 }}><FontAwesomeIcon icon={faPen} /></span>
        </>
      ) : (
        <span style={s.addPrice}>{isAdmin ? '+ Add Price' : '—'}</span>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const queryClient = useQueryClient();
  const raw = localStorage.getItem('user');
  const isAdmin = raw ? (JSON.parse(raw) as { role: string }).role === 'ADMIN' || (JSON.parse(raw) as { role: string }).role === 'SUPERADMIN' : false;

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [toast, setToast] = useState<string | null>(null);
  const pendingToastRef = useRef<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const { data: years = [] } = useQuery({
    queryKey: ['package-years'],
    queryFn: fetchPackageYears,
  });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages', selectedYear],
    queryFn: () => fetchPackages(selectedYear),
  });

  const allYears = [...new Set([...years, CURRENT_YEAR])].sort((a, b) => b - a);

  const programmes = [...new Set(packages.map((p) => p.programme))].sort();
  const ages = [...new Set(packages.map((p) => p.age))].sort((a, b) => a - b);

  const pkgMap = new Map<string, Package>();
  for (const pkg of packages) pkgMap.set(cellKey(pkg.programme, pkg.age), pkg);

  const mutation = useMutation({
    mutationFn: upsertPackages,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages', selectedYear] });
      setToast(pendingToastRef.current);
      setTimeout(() => setToast(null), 2500);
    },
  });

  const handleCellSave = (pkg: Package, price: number | null) => {
    const priceStr = price !== null ? `RM ${price.toFixed(2)}` : 'empty';
    pendingToastRef.current = `${pkg.programme} Age ${pkg.age} → ${priceStr}`;
    mutation.mutate([{ year: pkg.year, programme: pkg.programme, age: pkg.age, price }]);
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
              onChange={e => { setSelectedYear(Number(e.target.value)); setToast(null); }}
              style={styles.yearSelect}
            >
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {toast && (
          <div style={styles.toast}>
            <span style={styles.toastIcon}><FontAwesomeIcon icon={faCheck} /></span>
            <div>
              <div style={styles.toastTitle}>Price Updated</div>
              <div style={styles.toastDetail}>{toast}</div>
            </div>
          </div>
        )}

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
                        return (
                          <td key={age} style={styles.td}>
                            {!pkg ? (
                              <span style={styles.na}>—</span>
                            ) : (
                              <PriceCell pkg={pkg} isAdmin={isAdmin} onSave={handleCellSave} editingKey={editingKey} onEditStart={setEditingKey} />
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

// ── Inline cell styles ──────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  displayCell: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    width: 150, height: 32, borderRadius: 6, cursor: 'pointer',
    transition: 'background .15s', padding: '0 8px', position: 'relative',
    boxSizing: 'border-box',
  },
  displayCellHover: {
    background: '#f1f5f9',
  },
  priceText: {
    fontSize: 14, fontWeight: 600, color: '#1e293b', fontVariantNumeric: 'tabular-nums',
  },
  addPrice: {
    fontSize: 12, fontWeight: 500, color: '#94a3b8',
  },
  editIcon: {
    fontSize: 11, color: '#94a3b8', transition: 'opacity .15s', flexShrink: 0, width: 12,
  },
  editingCell: {
    display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    width: 150, boxSizing: 'border-box',
  },
  inputRow: {
    display: 'inline-flex', alignItems: 'center', gap: 0, borderRadius: 6,
    border: '1.5px solid #3b82f6', background: '#fff', overflow: 'hidden', height: 30,
    width: '100%',
  },
  rmPrefix: {
    fontSize: 12, fontWeight: 600, color: '#64748b', padding: '0 6px 0 8px',
    background: '#f8fafc', height: '100%', display: 'flex', alignItems: 'center',
    borderRight: '1px solid #e2e8f0',
  },
  inlineInput: {
    flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none',
    fontSize: 13, fontWeight: 600, color: '#1e293b', padding: '0 4px',
    fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
  },
  inputErr: { color: '#dc2626' },
  inlineSave: {
    width: 26, height: '100%', border: 'none', borderLeft: '1px solid #e2e8f0',
    background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontSize: 13, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  inlineCancel: {
    width: 26, height: '100%', border: 'none', borderLeft: '1px solid #e2e8f0',
    background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cellError: {
    fontSize: 10, color: '#dc2626',
  },
};

// ── Page styles ─────────────────────────────────────────────────────────────

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
  toast: {
    position: 'fixed' as const, top: 24, left: '50%', transform: 'translateX(-50%)',
    zIndex: 9999, padding: '12px 20px', borderRadius: 10,
    background: '#fff', color: '#1e293b', fontSize: 13,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  toastIcon: {
    width: 28, height: 28, borderRadius: '50%', background: '#dcfce7', color: '#16a34a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  toastTitle: {
    fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3,
  },
  toastDetail: {
    fontSize: 12, color: '#64748b', fontWeight: 500, lineHeight: 1.3, marginTop: 1,
  },
  stateMsg: { color: '#718096', textAlign: 'center', marginTop: 48, fontSize: 15 },
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
  readonlyNote: { marginTop: 16, fontSize: 12, color: '#a0aec0', textAlign: 'center' as const },
};

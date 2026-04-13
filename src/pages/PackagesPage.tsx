import { forwardRef, memo, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPlus, faPen } from '@fortawesome/free-solid-svg-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPackages, fetchPackageYears, fetchPackagesConfig,
  createPackage, deletePackage, patchPackage,
} from '../api/packages.js';
import { Package } from '../types/index.js';
import { useToast } from '../components/common/Toast.js';
import { useDeleteDialog } from '../components/common/DeleteDialog.js';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENCY_RE = /^\d+(\.\d{0,2})?$/;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellKey(programme: string, age: number) { return `${programme}|${age}`; }

function fmtPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return '';
  return `RM ${price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page wrapper — owns data, mutations, and the matrix viewport
// ─────────────────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();

  const raw = localStorage.getItem('user');
  const isAdmin = raw
    ? (() => {
        const role = (JSON.parse(raw) as { role: string }).role;
        return role === 'ADMIN' || role === 'SUPERADMIN';
      })()
    : false;

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const { data: years = [] } = useQuery({
    queryKey: ['package-years'],
    queryFn: fetchPackageYears,
  });
  const { data: config } = useQuery({
    queryKey: ['packages-config'],
    queryFn: fetchPackagesConfig,
  });
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages', selectedYear],
    queryFn: () => fetchPackages(selectedYear),
  });
  // Keep the global packages cache warm for sibling/edit modals on other pages
  useQuery({
    queryKey: ['packages-all'],
    queryFn: () => fetchPackages(),
  });

  const programmes: string[] = config?.programmes ?? [];
  const ages: number[] = config?.ages ?? [];
  const allYears = useMemo(() => {
    const next = CURRENT_YEAR + 1;
    return [...new Set([...years, CURRENT_YEAR, next])].sort((a, b) => b - a);
  }, [years]);

  const pkgMap = useMemo(() => {
    const m = new Map<string, Package>();
    for (const p of packages) m.set(cellKey(p.programme, p.age), p);
    return m;
  }, [packages]);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const handleSavePrice = async (pkg: Package, newPrice: number) => {
    if (pkg.price === newPrice) return; // no-op
    try {
      await patchPackage(pkg.id, { price: newPrice });
      queryClient.invalidateQueries({ queryKey: ['packages', selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['packages-all'] });
      showToast(`${pkg.programme} · Age ${pkg.age} → ${fmtPrice(newPrice)}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update price', 'error');
    }
  };

  const handleCreate = async (programme: string, age: number, price: number) => {
    try {
      const name = `${selectedYear} ${programme} (${age}Y)`;
      await createPackage({ year: selectedYear, programme, age, name, price });
      queryClient.invalidateQueries({ queryKey: ['packages', selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['packages-all'] });
      queryClient.invalidateQueries({ queryKey: ['package-years'] });
      showToast(`${programme} · Age ${age} created at ${fmtPrice(price)}`);
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to create package';
      try {
        const parsed = JSON.parse(msg);
        showToast(parsed?.message ?? msg, 'error');
      } catch {
        showToast(msg, 'error');
      }
    }
  };

  const handleDelete = async (pkg: Package) => {
    // The trash button is disabled in the cell when studentCount > 0, so this
    // path is only reachable for safe deletes. The dependencies array is still
    // passed as a defensive race-condition guard.
    const ok = await confirmDelete({
      entityType: 'price',
      entityName: `${pkg.programme} · Age ${pkg.age}`,
      title: 'Delete this price?',
      consequence: <><strong>{pkg.programme} · Age {pkg.age}</strong> for {selectedYear} will be unassigned. This action cannot be undone.</>,
      dependencies: [{ label: 'student', count: pkg.studentCount ?? 0 }],
      onConfirm: async () => {
        try {
          await deletePackage(pkg.id);
          queryClient.invalidateQueries({ queryKey: ['packages', selectedYear] });
          queryClient.invalidateQueries({ queryKey: ['packages-all'] });
        } catch (e: any) {
          const msg = e instanceof Error ? e.message : 'Failed to delete';
          try {
            const parsed = JSON.parse(msg);
            showToast(parsed?.message ?? msg, 'error');
          } catch {
            showToast(msg, 'error');
          }
          throw e;
        }
      },
    });
    if (ok) showToast(`${pkg.programme} · Age ${pkg.age} unassigned`);
  };

  // Clear selection when year changes
  useEffect(() => { setSelectedKey(null); setEditingKey(null); }, [selectedYear]);

  const selectedPkg = selectedKey ? pkgMap.get(selectedKey) ?? null : null;

  const handleToolbarEdit = () => {
    if (selectedKey) setEditingKey(selectedKey);
  };
  const handleToolbarDelete = () => {
    if (selectedPkg) {
      void handleDelete(selectedPkg);
      setSelectedKey(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Click outside the table → deselect
  const tableRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selectedKey && !editingKey) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (tableRef.current?.contains(t)) return;
      if (headerRef.current?.contains(t)) return;
      setSelectedKey(null);
      setEditingKey(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedKey, editingKey]);

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <Header
          ref={headerRef}
          selectedYear={selectedYear}
          allYears={allYears}
          onYearChange={setSelectedYear}
          packageCount={packages.length}
          isLoading={isLoading}
          isAdmin={isAdmin}
          selectedPkg={selectedPkg}
          onEdit={handleToolbarEdit}
          onDelete={handleToolbarDelete}
        />

        {isLoading ? (
          <SkeletonMatrix programmes={programmes.length || 3} ages={ages.length || 5} />
        ) : programmes.length === 0 || ages.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyTitle}>No programmes or age groups configured</div>
            <div style={s.emptySub}>
              Add programmes under <strong>Settings → Programmes</strong> and age groups under{' '}
              <strong>Settings → Age Groups</strong> first.
            </div>
          </div>
        ) : (
          <PricingTable
            ref={tableRef}
            programmes={programmes}
            ages={ages}
            year={selectedYear}
            pkgMap={pkgMap}
            isAdmin={isAdmin}
            selectedKey={selectedKey}
            setSelectedKey={setSelectedKey}
            editingKey={editingKey}
            setEditingKey={setEditingKey}
            onSavePrice={handleSavePrice}
            onCreate={handleCreate}
          />
        )}

        {!isAdmin && packages.length > 0 && (
          <p style={s.readonlyNote}>Viewing only. Contact an admin to manage prices.</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PricingTable — wraps the matrix, owns hover-column + editing-cell state
// ─────────────────────────────────────────────────────────────────────────────

interface PricingTableProps {
  programmes: string[];
  ages: number[];
  year: number;
  pkgMap: Map<string, Package>;
  isAdmin: boolean;
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
  editingKey: string | null;
  setEditingKey: (key: string | null) => void;
  onSavePrice: (pkg: Package, price: number) => void | Promise<void>;
  onCreate: (programme: string, age: number, price: number) => void | Promise<void>;
}

const PricingTable = forwardRef<HTMLDivElement, PricingTableProps>(function PricingTable({
  programmes, ages, year, pkgMap, isAdmin,
  selectedKey, setSelectedKey, editingKey, setEditingKey,
  onSavePrice, onCreate,
}, ref) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  return (
    <div ref={ref} style={s.tableWrap}>
      <div style={s.tableScroll} onMouseLeave={() => setHoverCol(null)}>
        <table style={s.table}>
          <colgroup>
            <col style={{ width: 220 }} />
            {ages.map(age => <col key={age} style={{ width: 160 }} />)}
          </colgroup>
          <thead>
            <tr style={s.theadRow}>
              <th style={{ ...s.th, ...s.thProg, borderTopLeftRadius: 10 }}>Programme</th>
              {ages.map((age, i) => (
                <th
                  key={age}
                  style={{
                    ...s.th,
                    ...s.thAge,
                    ...(hoverCol === age ? s.thAgeHover : {}),
                    borderTopRightRadius: i === ages.length - 1 ? 10 : 0,
                  }}
                  onMouseEnter={() => setHoverCol(age)}
                >
                  <span style={s.thAgeLabel}>Age</span>
                  <span style={s.thAgeNum}>{age}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programmes.map((prog, rowIdx) => (
              <PricingRow
                key={prog}
                programme={prog}
                ages={ages}
                year={year}
                pkgMap={pkgMap}
                isAdmin={isAdmin}
                isLast={rowIdx === programmes.length - 1}
                selectedKey={selectedKey}
                setSelectedKey={setSelectedKey}
                editingKey={editingKey}
                setEditingKey={setEditingKey}
                hoverCol={hoverCol}
                setHoverCol={setHoverCol}
                onSavePrice={onSavePrice}
                onCreate={onCreate}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PricingRow — one programme row, knows about its empty state
// ─────────────────────────────────────────────────────────────────────────────

interface PricingRowProps {
  programme: string;
  ages: number[];
  year: number;
  pkgMap: Map<string, Package>;
  isAdmin: boolean;
  isLast: boolean;
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
  editingKey: string | null;
  setEditingKey: (key: string | null) => void;
  hoverCol: number | null;
  setHoverCol: (age: number | null) => void;
  onSavePrice: (pkg: Package, price: number) => void | Promise<void>;
  onCreate: (programme: string, age: number, price: number) => void | Promise<void>;
}

function PricingRow({
  programme, ages, year, pkgMap, isAdmin, isLast,
  selectedKey, setSelectedKey, editingKey, setEditingKey, hoverCol, setHoverCol,
  onSavePrice, onCreate,
}: PricingRowProps) {
  // Detect "no prices set" — every cell in this row is unassigned
  const isFullyEmpty = useMemo(
    () => ages.every(age => !pkgMap.get(cellKey(programme, age))),
    [programme, ages, pkgMap],
  );

  return (
    <tr
      className="pkg-tr"
      style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}
    >
      <td style={s.tdProg}>
        <div style={s.progNameWrap}>
          <span style={s.progName}>{programme}</span>
          {isFullyEmpty && (
            <span style={s.progEmptyHint}>No prices set</span>
          )}
        </div>
      </td>
      {ages.map(age => {
        const key = cellKey(programme, age);
        const pkg = pkgMap.get(key);
        return (
          <td
            key={age}
            style={{
              ...s.tdCell,
              ...(hoverCol === age ? s.tdCellColHover : {}),
            }}
            onMouseEnter={() => setHoverCol(age)}
          >
            <PricingCell
              programme={programme}
              age={age}
              pkg={pkg}
              isAdmin={isAdmin}
              isSelected={selectedKey === key}
              isEditing={editingKey === key}
              onSelect={() => { setSelectedKey(key); setEditingKey(null); }}
              onStartEdit={() => setEditingKey(key)}
              onStopEdit={() => { setEditingKey(null); setSelectedKey(null); }}
              onSavePrice={onSavePrice}
              onCreate={onCreate}
            />
          </td>
        );
      })}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PricingCell — empty / filled / editing
// ─────────────────────────────────────────────────────────────────────────────

interface PricingCellProps {
  programme: string;
  age: number;
  pkg?: Package;
  isAdmin: boolean;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onSavePrice: (pkg: Package, price: number) => void | Promise<void>;
  onCreate: (programme: string, age: number, price: number) => void | Promise<void>;
}

const PricingCell = memo(function PricingCell({
  programme, age, pkg, isAdmin, isSelected, isEditing,
  onSelect, onStartEdit, onStopEdit, onSavePrice, onCreate,
}: PricingCellProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const blurringRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setDraft(pkg?.price !== null && pkg?.price !== undefined ? String(pkg.price) : '');
      setError('');
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    }
  }, [isEditing, pkg]);

  const handleChange = (val: string) => {
    if (val !== '' && !CURRENCY_RE.test(val)) return;
    setDraft(val);
    setError('');
  };

  const exitEdit = () => {
    onStopEdit();
    setError('');
  };

  /** Validate + persist. Returns true on success, false on validation failure. */
  const trySave = async (): Promise<boolean> => {
    const v = draft.trim();
    if (v === '') return false;
    const n = parseFloat(v);
    if (!CURRENCY_RE.test(v) || isNaN(n) || n < 0) {
      setError('Invalid');
      return false;
    }
    if (pkg) {
      if (pkg.price !== n) await onSavePrice(pkg, n);
    } else {
      await onCreate(programme, age, n);
    }
    return true;
  };

  const onBlur = async () => {
    blurringRef.current = true;
    await trySave();
    exitEdit();
    blurringRef.current = false;
  };

  const onKey = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const saved = await trySave();
      if (saved) exitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      exitEdit();
    }
  };

  // ── Editing state ─────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div style={s.editingWrap}>
        <div style={{ ...s.inputRow, ...(error ? s.inputRowErr : {}) }}>
          <span style={s.rmPrefix}>RM</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={onKey}
            onBlur={onBlur}
            placeholder="0.00"
            style={s.priceInput}
          />
        </div>
        {error && <span style={s.errorText}>{error}</span>}
      </div>
    );
  }

  // ── Filled (default) state ────────────────────────────────────────────────
  // Click selects the cell — Edit/Delete actions live in the toolbar above.
  if (pkg) {
    return (
      <div
        className={`pkg-cell pkg-cell-assigned${isSelected ? ' pkg-cell-selected' : ''}`}
        style={{
          ...s.assignedCell,
          ...(isSelected ? s.assignedCellSelected : {}),
        }}
        onClick={() => isAdmin && onSelect()}
      >
        <span style={s.priceText}>{fmtPrice(pkg.price)}</span>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  return (
    <div
      className="pkg-cell pkg-cell-empty"
      style={s.emptyCell}
      onClick={() => isAdmin && onStartEdit()}
    >
      {isAdmin ? (
        <span className="pkg-empty-text" style={s.emptyAddText}>
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 9, marginRight: 5 }} />
          Set Price
        </span>
      ) : (
        <span style={s.naDash}>—</span>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderProps {
  selectedYear: number;
  allYears: number[];
  onYearChange: (y: number) => void;
  packageCount: number;
  isLoading?: boolean;
  isAdmin: boolean;
  selectedPkg: Package | null;
  onEdit: () => void;
  onDelete: () => void;
}

const Header = forwardRef<HTMLElement, HeaderProps>(function Header({
  selectedYear, allYears, onYearChange, packageCount, isLoading,
  isAdmin, selectedPkg, onEdit, onDelete,
}, ref) {
  const hasSelection = selectedPkg !== null;
  const blocked = hasSelection && (selectedPkg.studentCount ?? 0) > 0;

  return (
    <header ref={ref} style={s.header}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={s.heading}>Packages &amp; Pricing</h1>
        {!isLoading && <span style={s.countBadge}>{packageCount}</span>}
      </div>
      <div style={s.headerActions}>
        {isAdmin && (
          <>
            <button
              type="button"
              disabled={!hasSelection}
              onClick={onEdit}
              style={{
                ...s.toolbarBtn,
                ...(hasSelection ? s.toolbarBtnActive : {}),
              }}
              title={hasSelection ? `Edit ${selectedPkg.programme} · Age ${selectedPkg.age}` : 'Select a cell first'}
            >
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, marginRight: 6 }} />
              Edit
            </button>
            <button
              type="button"
              disabled={!hasSelection || blocked}
              onClick={onDelete}
              style={{
                ...s.toolbarBtn,
                ...(hasSelection && !blocked ? s.toolbarBtnDanger : {}),
                ...(blocked ? s.toolbarBtnBlocked : {}),
              }}
              title={
                !hasSelection ? 'Select a cell first'
                : blocked ? `Cannot delete — in use by ${selectedPkg.studentCount} student${selectedPkg.studentCount !== 1 ? 's' : ''}`
                : `Delete ${selectedPkg.programme} · Age ${selectedPkg.age}`
              }
            >
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11, marginRight: 6 }} />
              Delete
            </button>
          </>
        )}
        <select
          value={selectedYear}
          onChange={e => onYearChange(Number(e.target.value))}
          style={s.yearSelect}
        >
          {allYears.map(y => (
            <option key={y} value={y}>
              {y === CURRENT_YEAR ? `${y} (current)` : y}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonMatrix({ programmes, ages }: { programmes: number; ages: number }) {
  return (
    <div style={s.tableWrap}>
      <div style={s.tableScroll}>
        <table style={s.table}>
          <colgroup>
            <col style={{ width: 220 }} />
            {Array.from({ length: ages }).map((_, i) => <col key={i} style={{ width: 160 }} />)}
          </colgroup>
          <thead>
            <tr style={s.theadRow}>
              <th style={{ ...s.th, ...s.thProg, borderTopLeftRadius: 10 }}>Programme</th>
              {Array.from({ length: ages }).map((_, i) => (
                <th
                  key={i}
                  style={{
                    ...s.th,
                    ...s.thAge,
                    borderTopRightRadius: i === ages - 1 ? 10 : 0,
                  }}
                >
                  <span style={s.thAgeLabel}>Age</span>
                  <span style={s.thAgeNum}>—</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: programmes }).map((_, r) => (
              <tr key={r} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={s.tdProg}><div style={{ ...skel, width: 90, height: 14 }} /></td>
                {Array.from({ length: ages }).map((_, c) => (
                  <td key={c} style={s.tdCell}>
                    <div style={{ ...skel, width: 100, height: 20, borderRadius: 6, marginLeft: 'auto' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const skel: React.CSSProperties = {
  background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
  backgroundSize: '200% 100%',
  borderRadius: 4,
  animation: 'pkg-skel 1.4s ease-in-out infinite',
};

// ─────────────────────────────────────────────────────────────────────────────
// Global CSS — micro-interactions, row hover, animations
// ─────────────────────────────────────────────────────────────────────────────

const globalCss = `
  @keyframes pkg-skel {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes pkg-fade-in {
    from { opacity: 0; transform: translateY(2px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  /* Row + cell hover layering */
  .pkg-tr:hover td { background: #fafbfc; }
  .pkg-cell-assigned { transition: background 0.12s, box-shadow 0.12s; }
  .pkg-cell-assigned:hover {
    background: #f1f5f9;
    box-shadow: 0 0 0 1px #e2e8f0 inset;
  }
  /* Direct cell hover wins over row hover */
  .pkg-tr:hover .pkg-cell-assigned:hover {
    background: #e2e8f0;
    box-shadow: 0 0 0 1px #cbd5e1 inset;
  }
  /* Empty cell hover */
  .pkg-cell-empty { transition: background 0.12s, border-color 0.12s; }
  .pkg-cell-empty:hover { background: #eff6ff !important; border-color: #93c5fd !important; }
  .pkg-cell-empty:hover .pkg-empty-text { color: #2563eb !important; }
  /* Active press effect */
  .pkg-cell-assigned:active, .pkg-cell-empty:active { transform: scale(0.99); }
  /* Selected cell highlight */
  .pkg-cell-selected {
    background: #eff6ff !important;
    box-shadow: 0 0 0 2px #2563eb inset !important;
  }
  .pkg-tr:hover .pkg-cell-selected {
    background: #eff6ff !important;
  }
`;

// inject styles once
if (typeof document !== 'undefined' && !document.getElementById('pkg-page-styles')) {
  const tag = document.createElement('style');
  tag.id = 'pkg-page-styles';
  tag.textContent = globalCss;
  document.head.appendChild(tag);
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px 40px',
    background: '#f8fafc',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#0f172a',
  },
  inner: { maxWidth: 1180, margin: '0 auto' },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  heading: { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    height: 22,
    padding: '0 8px',
    background: '#f1f5f9',
    color: '#64748b',
    borderRadius: 11,
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as any,
  },
  yearSelect: {
    padding: '7px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#0f172a',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  },

  // ── Empty state (no programmes/ages) ────────────────────────────────────
  emptyState: {
    border: '1px dashed #cbd5e1',
    borderRadius: 10,
    padding: '48px 24px',
    textAlign: 'center' as const,
    background: '#fafbfc',
  },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: '#334155', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94a3b8', maxWidth: 460, margin: '0 auto', lineHeight: 1.55 },

  // ── Table ───────────────────────────────────────────────────────────────
  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  tableScroll: { overflowX: 'auto' as const },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    tableLayout: 'fixed' as const,
  },
  theadRow: {
    background: '#fafbfc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '14px 16px',
    fontWeight: 600,
    fontSize: 11,
    color: '#94a3b8',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
    textAlign: 'left' as const,
    transition: 'background 0.12s',
  },
  thProg: {
    background: '#fafbfc',
    borderRight: '1px solid #f1f5f9',
    position: 'sticky' as const,
    left: 0,
    zIndex: 2,
  },
  thAge: {
    textAlign: 'center' as const,
    padding: '12px 16px',
    borderRight: '1px solid #f1f5f9',
  },
  thAgeHover: {
    background: '#f1f5f9',
  },
  thAgeLabel: {
    display: 'block',
    fontSize: 10,
    fontWeight: 500,
    color: '#94a3b8',
    letterSpacing: '0.08em',
    marginBottom: 2,
  },
  thAgeNum: {
    display: 'block',
    fontSize: 14,
    fontWeight: 700,
    color: '#1e293b',
    letterSpacing: 0,
    textTransform: 'none' as const,
  },

  // Programme name column
  tdProg: {
    padding: '0 16px',
    background: '#fafbfc',
    borderRight: '1px solid #f1f5f9',
    height: 64,
    verticalAlign: 'middle' as const,
    position: 'sticky' as const,
    left: 0,
    zIndex: 1,
  },
  progNameWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  progName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
    whiteSpace: 'nowrap' as const,
  },
  progEmptyHint: {
    fontSize: 11,
    fontWeight: 500,
    color: '#cbd5e1',
    fontStyle: 'italic' as const,
  },

  // Cell wrapper td
  tdCell: {
    padding: '6px 8px',
    verticalAlign: 'middle' as const,
    textAlign: 'right' as const,
    borderRight: '1px solid #f1f5f9',
    height: 64,
    transition: 'background 0.12s',
  },
  tdCellColHover: {
    background: '#f8fafc',
  },

  // ── Assigned cell ───────────────────────────────────────────────────────
  assignedCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    width: '100%',
    height: 44,
    borderRadius: 7,
    cursor: 'pointer',
    padding: '0 12px',
    boxSizing: 'border-box' as const,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0f172a',
    fontVariantNumeric: 'tabular-nums' as any,
    whiteSpace: 'nowrap' as const,
  },
  // Selected cell visual
  assignedCellSelected: {
    background: '#eff6ff',
    boxShadow: '0 0 0 2px #2563eb inset',
  },

  // Toolbar buttons
  toolbarBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    background: '#fff',
    cursor: 'not-allowed',
    outline: 'none',
    transition: 'all 0.15s',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    opacity: 0.6,
  },
  toolbarBtnActive: {
    color: '#0f172a',
    borderColor: '#cbd5e1',
    cursor: 'pointer',
    opacity: 1,
  },
  toolbarBtnDanger: {
    color: '#dc2626',
    borderColor: '#fecaca',
    background: '#fef2f2',
    cursor: 'pointer',
    opacity: 1,
  },
  toolbarBtnBlocked: {
    color: '#cbd5e1',
    borderColor: '#e2e8f0',
    background: '#f8fafc',
    cursor: 'not-allowed',
    opacity: 0.6,
  },

  // ── Empty cell ──────────────────────────────────────────────────────────
  emptyCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 44,
    borderRadius: 7,
    border: '1px dashed #e2e8f0',
    background: 'transparent',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  },
  emptyAddText: {
    fontSize: 12,
    fontWeight: 500,
    color: '#cbd5e1',
    transition: 'color 0.12s',
    display: 'inline-flex',
    alignItems: 'center',
  },
  naDash: {
    color: '#cbd5e1',
    fontSize: 16,
  },

  // ── Editing state ───────────────────────────────────────────────────────
  editingWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    gap: 2,
    width: '100%',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'stretch',
    height: 38,
    border: '1.5px solid #2563eb',
    borderRadius: 7,
    background: '#fff',
    overflow: 'hidden',
    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.12)',
  },
  inputRowErr: {
    borderColor: '#dc2626',
    boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.12)',
  },
  rmPrefix: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 9px',
    background: '#f8fafc',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    borderRight: '1px solid #e2e8f0',
  },
  priceInput: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    padding: '0 10px',
    fontSize: 14,
    fontWeight: 600,
    color: '#0f172a',
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums' as any,
    textAlign: 'right' as const,
  },
  errorText: {
    fontSize: 10,
    color: '#dc2626',
    marginTop: 2,
    paddingRight: 4,
    textAlign: 'right' as const,
  },

  readonlyNote: {
    marginTop: 16,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center' as const,
  },
};

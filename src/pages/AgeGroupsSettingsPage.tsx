import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPackages, fetchPackagesConfig, updateAges } from '../api/packages.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrash, faCheck, faXmark, faPlus, faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import ConfirmDialog from '../components/common/ConfirmDialog.js';
import DeleteDialog from '../components/common/DeleteDialog.js';
import { useToast } from '../components/common/Toast.js';
import { Package } from '../types/index.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Row {
  /** Stable per-mount key so React doesn't reuse rows when a value changes */
  key: string;
  /** Server-side value, or null for newly added unsaved rows */
  original: number | null;
  current: number;
}

interface UsageInfo {
  packageCount: number;
  studentCount: number;
}

/** Inline per-row save feedback (saving / saved) — anchors next to the row */
type Feedback = { rowKey: string; type: 'saving' | 'saved' };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgeGroupsSettingsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const raw = localStorage.getItem('user');
  const isAdmin = raw
    ? (() => {
        const role = (JSON.parse(raw) as { role: string }).role;
        return role === 'ADMIN' || role === 'SUPERADMIN';
      })()
    : false;

  const { data: config, isLoading, isError } = useQuery({
    queryKey: ['packages-config'],
    queryFn: fetchPackagesConfig,
  });
  const { data: allPackages = [] } = useQuery({ queryKey: ['packages-all'], queryFn: () => fetchPackages() });

  const serverAges: number[] = Array.isArray(config?.ages) ? config!.ages : [];
  const usage: Map<number, UsageInfo> = useMemo(
    () => new Map((config?.agesDetail ?? []).map(d => [d.age, d])),
    [config],
  );

  /** Packages grouped by age — for the expandable detail row */
  const packagesByAge = useMemo(() => {
    const m = new Map<number, typeof allPackages>();
    for (const pkg of allPackages) {
      const list = m.get(pkg.age) ?? [];
      list.push(pkg);
      m.set(pkg.age, list);
    }
    return m;
  }, [allPackages]);

  // ── Local state ─────────────────────────────────────────────────────────────

  const [rows, setRows] = useState<Row[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newAgeValue, setNewAgeValue] = useState('');
  const newRowInputRef = useRef<HTMLInputElement | null>(null);

  // Per-row inline feedback (Saving… / Saved ✓)
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // Briefly highlight the row that just successfully saved
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const [expandedAge, setExpandedAge] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [conflictError, setConflictError] = useState<null | {
    conflicts: Array<{ age: number; packageCount: number; studentCount: number }>;
  }>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { key: string; age: number; isNew: boolean }>(null);

  // Serialised save chain — guarantees that rapid actions persist in order
  // and never collide on the API.
  const savePromiseRef = useRef<Promise<unknown>>(Promise.resolve());

  // Sync from server when config arrives or changes — always ascending
  useEffect(() => {
    const sorted = [...serverAges].sort((a, b) => a - b);
    setRows(sorted.map((a, i) => ({ key: `s-${a}-${i}`, original: a, current: a })));
  }, [config]);

  useEffect(() => { if (adding) newRowInputRef.current?.focus(); }, [adding]);

  // ── Auto-save core ──────────────────────────────────────────────────────────
  /**
   * Persist the new state to the server immediately. Caller passes the rows
   * snapshot they want saved (so optimistic updates can be applied first).
   * If `feedbackRowKey` is given, the inline saving/saved indicator anchors
   * to that row. Otherwise the toast is the only feedback.
   */
  const persistRows = async (newRows: Row[], opts?: { feedbackRowKey?: string; toast?: string }) => {
    const { feedbackRowKey, toast } = opts ?? {};
    if (feedbackRowKey) setFeedback({ rowKey: feedbackRowKey, type: 'saving' });

    const next = savePromiseRef.current.then(async () => {
      try {
        const renames: Array<{ from: number; to: number }> = [];
        const adds: number[] = [];
        const removes: number[] = [];

        for (const row of newRows) {
          if (row.original === null) {
            adds.push(row.current);
          } else if (row.original !== row.current) {
            renames.push({ from: row.original, to: row.current });
          }
        }
        for (const orig of serverAges) {
          if (!newRows.some(r => r.original === orig)) removes.push(orig);
        }

        const order = newRows.map(r => r.current);
        await updateAges({ add: adds, remove: removes, renames, order });

        queryClient.invalidateQueries({ queryKey: ['packages-config'] });
        queryClient.invalidateQueries({ queryKey: ['packages'] });
        queryClient.invalidateQueries({ queryKey: ['packages-all'] });

        if (feedbackRowKey) {
          setFeedback({ rowKey: feedbackRowKey, type: 'saved' });
          setFlashKey(feedbackRowKey);
          setTimeout(() => {
            setFeedback(curr => (curr?.rowKey === feedbackRowKey && curr?.type === 'saved') ? null : curr);
          }, 1500);
          setTimeout(() => {
            setFlashKey(curr => curr === feedbackRowKey ? null : curr);
          }, 1000);
        } else if (toast) {
          showToast(toast);
        }
      } catch (err: any) {
        // Roll back local state to the last known server state
        setRows(serverAges.map((a, i) => ({ key: `s-${a}-${i}`, original: a, current: a })));
        setFeedback(null);
        const msg = err instanceof Error ? err.message : 'Save failed';
        try {
          const parsed = JSON.parse(msg);
          if (parsed?.conflicts && Array.isArray(parsed.conflicts)) {
            setConflictError({ conflicts: parsed.conflicts });
            return;
          }
          if (parsed?.message) { setError(parsed.message); return; }
        } catch { /* not JSON */ }
        showToast(msg, 'error');
      }
    });

    savePromiseRef.current = next;
    return next;
  };

  // ── Inline edit ─────────────────────────────────────────────────────────────

  const startEdit = (row: Row) => {
    setEditingKey(row.key);
    setEditingValue(String(row.current));
    setError('');
  };

  const commitEdit = async () => {
    if (editingKey === null) return;
    const trimmed = editingValue.trim();
    if (!trimmed) { setEditingKey(null); return; }
    const newVal = parseInt(trimmed, 10);
    if (isNaN(newVal) || newVal < 0) {
      setError('Age must be a non-negative integer');
      return;
    }
    if (rows.some(r => r.key !== editingKey && r.current === newVal)) {
      setError(`Age ${newVal} already exists in the list`);
      return;
    }
    const editKey = editingKey;
    const newRows = rows.map(r => r.key === editKey ? { ...r, current: newVal } : r)
      .sort((a, b) => a.current - b.current);
    setRows(newRows);
    setEditingKey(null);
    setError('');
    // Only save if the value actually changed from the original
    const target = newRows.find(r => r.key === editKey);
    if (target && target.original !== newVal) {
      await persistRows(newRows, { feedbackRowKey: editKey });
    }
  };

  const cancelEdit = () => { setEditingKey(null); setError(''); };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const requestDelete = (row: Row) => {
    setConfirmDelete({ key: row.key, age: row.current, isNew: row.original === null });
  };

  const performDelete = async () => {
    if (confirmDelete === null) return;
    const ageDeleted = confirmDelete.age;
    const newRows = rows.filter(r => r.key !== confirmDelete.key);
    setRows(newRows);
    setConfirmDelete(null);
    setError('');
    await persistRows(newRows, { toast: `Age ${ageDeleted} deleted` });
  };

  // ── Add ─────────────────────────────────────────────────────────────────────

  const startAdd = () => { setAdding(true); setNewAgeValue(''); setError(''); };
  const cancelAdd = () => { setAdding(false); setNewAgeValue(''); setError(''); };
  const commitAdd = async () => {
    const trimmed = newAgeValue.trim();
    if (!trimmed) return;
    const val = parseInt(trimmed, 10);
    if (isNaN(val) || val < 0) {
      setError('Age must be a non-negative integer');
      return;
    }
    if (rows.some(r => r.current === val)) {
      setError(`Age ${val} already exists in the list`);
      return;
    }
    const newKey = `n-${Date.now()}-${val}`;
    const newRows = [...rows, { key: newKey, original: null, current: val }]
      .sort((a, b) => a.current - b.current);
    setRows(newRows);
    setNewAgeValue('');
    setAdding(false);
    setError('');
    await persistRows(newRows, { feedbackRowKey: newKey });
  };

  // ── Render guards ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={s.page}>
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={s.heading}>Age Groups</h1>
          </div>
        </header>
        <SkeletonTable rowCount={5} />
      </div>
    );
  }
  if (isError) return <div style={s.page}><p style={{ ...s.muted, color: '#dc2626' }}>Failed to load.</p></div>;
  if (!isAdmin) {
    return (
      <div style={s.page}>
        <h1 style={s.heading}>Age Groups</h1>
        <p style={s.muted}>Admin role required.</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <style>{rowHoverCss}</style>

      {/* Header */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={s.heading}>Age Groups</h1>
          <span style={s.countBadge}>{rows.length}</span>
        </div>
      </header>

      {error && (
        <div style={s.errorBanner} role="alert">
          <span><strong>⚠</strong> {error}</span>
          <button onClick={() => setError('')} style={s.errorClose} aria-label="Dismiss"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && !adding ? (
        <div style={s.emptyState}>
          <div style={s.emptyTitle}>No age groups yet</div>
          <div style={s.emptySub}>Add your first age group to start defining packages.</div>
          <button onClick={startAdd} style={{ ...s.btnPrimary, marginTop: 14 }}>
            <FontAwesomeIcon icon={faPlus} /> Add your first age group
          </button>
        </div>
      ) : (
        <>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.theadRow}>
                  <th style={{ ...s.th, borderTopLeftRadius: 10 }}>Age group</th>
                  <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Packages</th>
                  <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Students</th>
                  <th style={{ ...s.th, width: 110 }}>Status</th>
                  <th style={{ ...s.th, width: 70, textAlign: 'right', borderTopRightRadius: 10 }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const u = row.original !== null ? usage.get(row.original) : null;
                  const inUse = u ? u.packageCount > 0 || u.studentCount > 0 : false;
                  const editing = editingKey === row.key;
                  const rowFeedback = feedback?.rowKey === row.key ? feedback : null;
                  const isFlashing = flashKey === row.key;

                  return (
                    <tr
                      key={row.key}
                      className="ag-row"
                      style={{
                        background: isFlashing ? '#ecfdf5' : (row.original === null ? '#f0fdf4' : (inUse ? '#fff' : '#fafafa')),
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.4s',
                      }}
                    >
                      {/* Name (inline editable) */}
                      <td style={s.td}>
                        {editing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              autoFocus
                              type="text"
                              inputMode="numeric"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value.replace(/\D/g, ''))}
                              onBlur={commitEdit}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              style={s.editInput}
                            />
                            <span style={s.muted}>Press Enter</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="ag-name-btn"
                              style={s.nameBtn}
                              title="Click to edit"
                            >
                              <span style={s.ageName}>Age {row.current}</span>
                            </button>
                            {rowFeedback && <SaveIndicator type={rowFeedback.type} />}
                          </div>
                        )}
                      </td>

                      {/* Packages — clickable to show modal */}
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        {u && u.packageCount > 0 ? (
                          <button
                            type="button"
                            className="ag-pkg-btn"
                            onClick={() => setExpandedAge(row.current)}
                            style={s.pkgCountBtn}
                            title="Click to view packages"
                          >
                            {u.packageCount}
                          </button>
                        ) : (
                          <span style={s.numMuted}>0</span>
                        )}
                      </td>

                      {/* Students */}
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <span style={u && u.studentCount > 0 ? s.numStrong : s.numMuted}>
                          {u?.studentCount ?? 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={s.td}>
                        {row.original === null ? (
                          <span style={{ ...s.badge, ...s.badgeNew }}>Saving…</span>
                        ) : inUse ? (
                          <span style={{ ...s.badge, ...s.badgeInUse }}>In use</span>
                        ) : (
                          <span style={{ ...s.badge, ...s.badgeUnused }}>Unused</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => requestDelete(row)}
                          disabled={inUse}
                          className="ag-delete-btn"
                          style={{
                            ...s.iconBtn,
                            ...(inUse ? s.iconBtnBlocked : s.iconBtnDanger),
                          }}
                          title={
                            inUse
                              ? `Cannot delete — used by ${u!.packageCount} package${u!.packageCount !== 1 ? 's' : ''} and ${u!.studentCount} student${u!.studentCount !== 1 ? 's' : ''}`
                              : 'Delete'
                          }
                          aria-label={inUse ? 'Delete (disabled)' : 'Delete'}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Add row */}
                {adding && (
                  <tr style={s.rowAdd}>
                    <td style={s.td} colSpan={4}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          ref={newRowInputRef}
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 7"
                          value={newAgeValue}
                          onChange={e => setNewAgeValue(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitAdd();
                            if (e.key === 'Escape') cancelAdd();
                          }}
                          style={{ ...s.editInput, width: 120 }}
                        />
                        <span style={s.muted}>Press Enter to add</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                        <button type="button" onClick={commitAdd} style={s.iconBtnConfirm} title="Add" aria-label="Add">
                          <FontAwesomeIcon icon={faCheck} />
                        </button>
                        <button type="button" onClick={cancelAdd} style={s.iconBtn} title="Cancel" aria-label="Cancel">
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!adding && (
            <div style={{ marginTop: 12 }}>
              <button onClick={startAdd} style={s.btnSecondary}>
                <FontAwesomeIcon icon={faPlus} /> Add age group
              </button>
            </div>
          )}
        </>
      )}

      {/* Confirm delete — DeleteDialog detects whether the age has dependencies
          and renders the deletable or blocked state automatically. */}
      {confirmDelete && (() => {
        const target = rows.find(r => r.key === confirmDelete.key);
        const u = target?.original != null ? usage.get(target.original) : null;
        const dependencies = u
          ? [
              { label: 'package', count: u.packageCount },
              { label: 'student', count: u.studentCount },
            ]
          : [];
        return (
          <DeleteDialog
            entityType="Age Group"
            entityName={`Age ${confirmDelete.age}`}
            dependencies={dependencies}
            onConfirm={performDelete}
            onCancel={() => setConfirmDelete(null)}
          />
        );
      })()}

      {/* Package detail modal */}
      {expandedAge !== null && (
        <PackageModal
          age={expandedAge}
          packages={packagesByAge.get(expandedAge) ?? []}
          onClose={() => setExpandedAge(null)}
        />
      )}

      {/* Server-side conflict (race condition fallback) */}
      {conflictError && (
        <ConfirmDialog
          title="Cannot save — ages still in use"
          message={
            <>
              <p style={{ margin: '0 0 12px' }}>
                The following ages can't be removed because packages or students still depend on them.
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#1a202c' }}>
                {conflictError.conflicts.map(c => (
                  <li key={c.age}>
                    <strong>Age {c.age}</strong> — {c.packageCount} package{c.packageCount !== 1 ? 's' : ''}
                    {c.studentCount > 0 && `, ${c.studentCount} student${c.studentCount !== 1 ? 's' : ''}`}
                  </li>
                ))}
              </ul>
            </>
          }
          confirmLabel="OK"
          hideCancel
          onConfirm={() => setConflictError(null)}
          onCancel={() => setConflictError(null)}
        />
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function SaveIndicator({ type }: { type: 'saving' | 'saved' }) {
  if (type === 'saving') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 10 }} />
        Saving…
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#15803d', fontWeight: 600 }}>
      <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} />
      Saved
    </span>
  );
}

function PackageModal({ age, packages: pkgs, onClose }: { age: number; packages: Package[]; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Group by year, newest first
  const byYear = new Map<number, Package[]>();
  for (const p of pkgs) {
    const list = byYear.get(p.year) ?? [];
    list.push(p);
    byYear.set(p.year, list);
  }
  const sortedYears = [...byYear.keys()].sort((a, b) => b - a);

  return ReactDOM.createPortal(
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Age {age} Packages</span>
          <span style={s.modalCount}>{pkgs.length}</span>
          <button type="button" onClick={onClose} style={s.modalClose} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div style={s.modalBody}>
          {sortedYears.map(year => {
            const yearPkgs = byYear.get(year)!;
            const students = yearPkgs.reduce((sum, p) => sum + (p.studentCount ?? 0), 0);
            return (
              <div key={year} style={s.detailRow}>
                <span style={s.detailYear}>{year}</span>
                <div style={s.detailPills}>
                  {yearPkgs.map(p => (
                    <span key={p.id} style={s.detailPill}>{p.programme}</span>
                  ))}
                </div>
                {students > 0 && (
                  <span style={s.detailStudents}>
                    {students} student{students !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SkeletonTable({ rowCount }: { rowCount: number }) {
  return (
    <div style={{ ...s.tableWrap, marginTop: 20 }}>
      <table style={s.table}>
        <thead>
          <tr style={s.theadRow}>
            <th style={{ ...s.th, borderTopLeftRadius: 10 }}>Age group</th>
            <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Packages</th>
            <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Students</th>
            <th style={{ ...s.th, width: 110 }}>Status</th>
            <th style={{ ...s.th, width: 70, borderTopRightRadius: 10 }} />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={s.td}><div style={{ ...skel, width: 70, height: 14 }} /></td>
              <td style={{ ...s.td, textAlign: 'right' }}><div style={{ ...skel, width: 24, height: 14, marginLeft: 'auto' }} /></td>
              <td style={{ ...s.td, textAlign: 'right' }}><div style={{ ...skel, width: 24, height: 14, marginLeft: 'auto' }} /></td>
              <td style={s.td}><div style={{ ...skel, width: 50, height: 18, borderRadius: 4 }} /></td>
              <td style={{ ...s.td, textAlign: 'right' }}><div style={{ ...skel, width: 28, height: 28, borderRadius: 6, marginLeft: 'auto' }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const skel: React.CSSProperties = {
  background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
  backgroundSize: '200% 100%',
  borderRadius: 4,
  animation: 'kc-skel 1.4s ease-in-out infinite',
};

// ── Hover & focus styles ─────────────────────────────────────────────────────

const rowHoverCss = `
  @keyframes kc-skel {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .ag-row:hover { background: #f8fafc !important; }
  .ag-name-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; border-radius: 4px; }
  .ag-delete-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .ag-delete-btn:not(:disabled):hover { background: #fef2f2 !important; border-color: #fca5a5 !important; }
  .ag-pkg-btn:hover { text-decoration: underline; }
`;

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px 40px',
    maxWidth: 880,
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#0f172a',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
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
  muted: { color: '#94a3b8', fontSize: 12 },

  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    fontSize: 13,
    color: '#991b1b',
    marginBottom: 12,
  },
  errorClose: { background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 13, padding: 4 },

  emptyState: {
    border: '1px dashed #cbd5e1',
    borderRadius: 10,
    padding: '48px 24px',
    textAlign: 'center' as const,
    background: '#fafbfc',
  },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: '#334155', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#94a3b8' },

  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    borderRadius: 10,
  },
  theadRow: {
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    textAlign: 'left',
    padding: '9px 14px',
    fontWeight: 600,
    fontSize: 11,
    color: '#8893a7',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '10px 14px',
    verticalAlign: 'middle',
    fontSize: 13,
  },
  rowAdd: { background: '#f0fdf4' },

  ageName: { fontSize: 14, fontWeight: 600, color: '#0f172a' },
  nameBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'text',
    textAlign: 'left' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'inherit',
  },

  numStrong: { fontSize: 13, fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' as any },
  numMuted: { fontSize: 13, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' as any },

  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  badgeUnused: { color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0' },
  badgeInUse: { color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe' },
  badgeNew: { color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa' },

  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    background: '#fff',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 12,
    transition: 'all 0.12s',
  },
  iconBtnConfirm: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    background: '#f0fdf4',
    color: '#15803d',
    cursor: 'pointer',
    fontSize: 12,
  },
  iconBtnDanger: {
    color: '#dc2626',
    borderColor: '#fecaca',
    background: '#fff',
  },
  iconBtnBlocked: {
    color: '#cbd5e1',
    background: '#f8fafc',
    cursor: 'not-allowed',
    borderColor: '#e2e8f0',
  },

  editInput: {
    padding: '6px 10px',
    border: '1px solid #2563eb',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums' as any,
    width: 80,
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.12)',
  },

  btnPrimary: {
    padding: '7px 16px',
    background: '#0f172a',
    color: '#fff',
    border: '1px solid #0f172a',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  btnSecondary: {
    padding: '7px 14px',
    background: '#fff',
    color: '#334155',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },

  // Package count button — clickable to expand
  pkgCountBtn: {
    background: 'none',
    border: 'none',
    padding: '2px 4px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: '#2563eb',
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums' as any,
    borderRadius: 4,
    transition: 'color 0.12s',
  },

  // Modal
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 1000,
    background: 'rgba(15, 23, 42, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.18)',
    width: '100%',
    maxWidth: 480,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
  },
  modalCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 20,
    padding: '0 6px',
    background: '#f1f5f9',
    color: '#64748b',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  modalClose: {
    marginLeft: 'auto' as const,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: 16,
    padding: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    transition: 'color 0.12s',
  },
  modalBody: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    overflowY: 'auto' as const,
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
  },
  detailYear: {
    fontWeight: 700,
    fontSize: 12,
    color: '#334155',
    minWidth: 36,
    fontVariantNumeric: 'tabular-nums' as any,
  },
  detailPills: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
    flex: 1,
  },
  detailPill: {
    padding: '3px 10px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 500,
    color: '#334155',
    whiteSpace: 'nowrap' as const,
  },
  detailStudents: {
    color: '#94a3b8',
    fontSize: 11,
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums' as any,
  },
};

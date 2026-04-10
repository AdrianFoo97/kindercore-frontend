import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPackages, fetchPackagesConfig, updateProgrammes } from '../api/packages.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrash, faCheck, faXmark, faPlus, faGripVertical, faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import ConfirmDialog from '../components/common/ConfirmDialog.js';
import DeleteDialog from '../components/common/DeleteDialog.js';
import { useToast } from '../components/common/Toast.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Row {
  /** Stable per-mount key so React doesn't reuse rows when a value changes */
  key: string;
  /** Server-side value, or null for newly added unsaved rows */
  original: string | null;
  current: string;
}

interface UsageInfo {
  packageCount: number;
  studentCount: number;
}

type Feedback = { rowKey: string; type: 'saving' | 'saved' };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgrammesSettingsPage() {
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
  // Prefetched but not used directly here
  useQuery({ queryKey: ['packages-all'], queryFn: () => fetchPackages() });

  const serverProgrammes: string[] = Array.isArray(config?.programmes) ? config!.programmes : [];
  const usage: Map<string, UsageInfo> = useMemo(
    () => new Map((config?.programmesDetail ?? []).map(d => [d.name, d])),
    [config],
  );

  // ── Local state ─────────────────────────────────────────────────────────────

  const [rows, setRows] = useState<Row[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newProgrammeValue, setNewProgrammeValue] = useState('');
  const newRowInputRef = useRef<HTMLInputElement | null>(null);

  // Drag-and-drop state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  // Per-row save indicator + flash highlight
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [conflictError, setConflictError] = useState<null | {
    conflicts: Array<{ programme: string; packageCount: number; studentCount: number }>;
  }>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { key: string; name: string; isNew: boolean }>(null);

  // Serialised save chain — guarantees that rapid actions persist in order
  const savePromiseRef = useRef<Promise<unknown>>(Promise.resolve());

  // Sync from server when config arrives or changes
  useEffect(() => {
    setRows(serverProgrammes.map((p, i) => ({ key: `s-${p}-${i}`, original: p, current: p })));
  }, [config]);

  useEffect(() => { if (adding) newRowInputRef.current?.focus(); }, [adding]);

  // ── Auto-save core ──────────────────────────────────────────────────────────

  const persistRows = async (newRows: Row[], opts?: { feedbackRowKey?: string; toast?: string }) => {
    const { feedbackRowKey, toast } = opts ?? {};
    if (feedbackRowKey) setFeedback({ rowKey: feedbackRowKey, type: 'saving' });

    const next = savePromiseRef.current.then(async () => {
      try {
        const renames: Array<{ from: string; to: string }> = [];
        const adds: string[] = [];
        const removes: string[] = [];
        for (const row of newRows) {
          if (row.original === null) adds.push(row.current);
          else if (row.original !== row.current) renames.push({ from: row.original, to: row.current });
        }
        for (const orig of serverProgrammes) {
          if (!newRows.some(r => r.original === orig)) removes.push(orig);
        }
        const order = newRows.map(r => r.current);

        await updateProgrammes({ renames, add: adds, remove: removes, order });
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
        setRows(serverProgrammes.map((p, i) => ({ key: `s-${p}-${i}`, original: p, current: p })));
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

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* noop */ }
  };

  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropIdx !== idx) setDropIdx(idx);
  };

  const onDragEnd = () => {
    setDragIdx(null);
    setDropIdx(null);
  };

  const onDrop = (idx: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) {
      onDragEnd();
      return;
    }
    const next = [...rows];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setRows(next);
    onDragEnd();
    setError('');
    await persistRows(next, { toast: 'Order updated' });
  };

  // ── Inline edit ─────────────────────────────────────────────────────────────

  const startEdit = (row: Row) => {
    setEditingKey(row.key);
    setEditingValue(row.current);
    setError('');
  };

  const commitEdit = async () => {
    if (editingKey === null) return;
    const trimmed = editingValue.trim();
    if (!trimmed) { setEditingKey(null); return; }
    if (rows.some(r => r.key !== editingKey && r.current === trimmed)) {
      setError(`"${trimmed}" already exists in the list`);
      return;
    }
    const editKey = editingKey;
    const newRows = rows.map(r => r.key === editKey ? { ...r, current: trimmed } : r);
    setRows(newRows);
    setEditingKey(null);
    setError('');
    const target = newRows.find(r => r.key === editKey);
    if (target && target.original !== trimmed) {
      await persistRows(newRows, { feedbackRowKey: editKey });
    }
  };

  const cancelEdit = () => { setEditingKey(null); setError(''); };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const requestDelete = (row: Row) => {
    setConfirmDelete({ key: row.key, name: row.current, isNew: row.original === null });
  };

  const performDelete = async () => {
    if (confirmDelete === null) return;
    const nameDeleted = confirmDelete.name;
    const newRows = rows.filter(r => r.key !== confirmDelete.key);
    setRows(newRows);
    setConfirmDelete(null);
    setError('');
    await persistRows(newRows, { toast: `${nameDeleted} deleted` });
  };

  // ── Add ─────────────────────────────────────────────────────────────────────

  const startAdd = () => { setAdding(true); setNewProgrammeValue(''); setError(''); };
  const cancelAdd = () => { setAdding(false); setNewProgrammeValue(''); setError(''); };
  const commitAdd = async () => {
    const trimmed = newProgrammeValue.trim();
    if (!trimmed) return;
    if (rows.some(r => r.current === trimmed)) {
      setError(`"${trimmed}" already exists in the list`);
      return;
    }
    const newKey = `n-${Date.now()}-${trimmed}`;
    const newRows = [...rows, { key: newKey, original: null, current: trimmed }];
    setRows(newRows);
    setNewProgrammeValue('');
    setAdding(false);
    setError('');
    await persistRows(newRows, { feedbackRowKey: newKey });
  };

  // ── Render guards ───────────────────────────────────────────────────────────

  if (isLoading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;
  if (isError) return <div style={s.page}><p style={{ ...s.muted, color: '#dc2626' }}>Failed to load.</p></div>;
  if (!isAdmin) {
    return (
      <div style={s.page}>
        <h1 style={s.heading}>Programmes</h1>
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
          <h1 style={s.heading}>Programmes</h1>
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
          <div style={s.emptyTitle}>No programmes yet</div>
          <div style={s.emptySub}>Add your first programme to start defining packages.</div>
          <button onClick={startAdd} style={{ ...s.btnPrimary, marginTop: 14 }}>
            <FontAwesomeIcon icon={faPlus} /> Add your first programme
          </button>
        </div>
      ) : (
        <>
          {/* Table */}
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.theadRow}>
                  <th style={{ ...s.th, width: 36, borderTopLeftRadius: 10 }} aria-label="Drag handle" />
                  <th style={s.th}>Programme name</th>
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
                  const isDragging = dragIdx === idx;
                  const isDropTarget = dropIdx === idx && dragIdx !== null && dragIdx !== idx;
                  const rowFeedback = feedback?.rowKey === row.key ? feedback : null;
                  const isFlashing = flashKey === row.key;

                  return (
                    <tr
                      key={row.key}
                      className="pg-row"
                      style={{
                        opacity: isDragging ? 0.4 : 1,
                        background: isFlashing ? '#ecfdf5' : (row.original === null ? '#f0fdf4' : (inUse ? '#fff' : '#fafafa')),
                        borderBottom: '1px solid #f1f5f9',
                        borderTop: isDropTarget ? '2px solid #2563eb' : undefined,
                        transition: 'background 0.4s, opacity 0.12s',
                      }}
                      onDragOver={onDragOver(idx)}
                      onDrop={onDrop(idx)}
                    >
                      {/* Drag handle */}
                      <td style={s.tdHandle}>
                        <span
                          draggable
                          onDragStart={onDragStart(idx)}
                          onDragEnd={onDragEnd}
                          className="pg-handle"
                          style={s.dragHandle}
                          title="Drag to reorder"
                          aria-label="Drag to reorder"
                        >
                          <FontAwesomeIcon icon={faGripVertical} />
                        </span>
                      </td>

                      {/* Name (inline editable) */}
                      <td style={s.td}>
                        {editing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              autoFocus
                              type="text"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
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
                              className="pg-name-btn"
                              style={s.nameBtn}
                              title="Click to edit"
                            >
                              <span style={s.programmeName}>{row.current}</span>
                            </button>
                            {rowFeedback && <SaveIndicator type={rowFeedback.type} />}
                          </div>
                        )}
                      </td>

                      {/* Packages */}
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <span style={u && u.packageCount > 0 ? s.numStrong : s.numMuted}>
                          {u?.packageCount ?? 0}
                        </span>
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
                          className="pg-delete-btn"
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
                    <td style={s.tdHandle} />
                    <td style={s.td} colSpan={4}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          ref={newRowInputRef}
                          type="text"
                          placeholder="e.g. After School Care"
                          value={newProgrammeValue}
                          onChange={e => setNewProgrammeValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitAdd();
                            if (e.key === 'Escape') cancelAdd();
                          }}
                          style={{ ...s.editInput, width: 240 }}
                        />
                        <span style={s.muted}>Will be added when you click <strong>Save changes</strong>.</span>
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

          {/* Add button */}
          {!adding && (
            <div style={{ marginTop: 12 }}>
              <button onClick={startAdd} style={s.btnSecondary}>
                <FontAwesomeIcon icon={faPlus} /> Add programme
              </button>
            </div>
          )}
        </>
      )}

      {/* Confirm delete — DeleteDialog auto-detects deletable vs blocked */}
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
            entityType="Programme"
            entityName={confirmDelete.name}
            dependencies={dependencies}
            onConfirm={performDelete}
            onCancel={() => setConfirmDelete(null)}
          />
        );
      })()}

      {/* Server-side conflict (race condition fallback) */}
      {conflictError && (
        <ConfirmDialog
          title="Cannot save — programmes still in use"
          message={
            <>
              <p style={{ margin: '0 0 12px' }}>
                The following programmes can't be removed because packages or students still depend on them.
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#1a202c' }}>
                {conflictError.conflicts.map(c => (
                  <li key={c.programme}>
                    <strong>{c.programme}</strong> — {c.packageCount} package{c.packageCount !== 1 ? 's' : ''}
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

// ── Hover & focus styles ──────────────────────────────────────────────────────

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

// ── Hover & focus styles ─────────────────────────────────────────────────────

const rowHoverCss = `
  .pg-row .pg-handle { opacity: 0; transition: opacity 0.12s; }
  .pg-row:hover .pg-handle { opacity: 1; }
  .pg-row .pg-handle:active { cursor: grabbing; }
  .pg-row:hover { background: #f8fafc !important; }
  .pg-name-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; border-radius: 4px; }
  .pg-delete-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .pg-delete-btn:not(:disabled):hover { background: #fef2f2 !important; border-color: #fca5a5 !important; }
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
  unsavedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    padding: '0 10px',
    background: '#fef3c7',
    color: '#92400e',
    borderRadius: 11,
    fontSize: 11,
    fontWeight: 600,
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
  tdHandle: {
    padding: '10px 4px 10px 10px',
    verticalAlign: 'middle',
    width: 28,
  },
  rowAdd: { background: '#f0fdf4' },

  dragHandle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    color: '#94a3b8',
    cursor: 'grab',
    fontSize: 12,
    userSelect: 'none' as const,
  },

  programmeName: { fontSize: 14, fontWeight: 600, color: '#0f172a' },
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
  changedBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: '#9a3412',
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: 4,
    padding: '1px 6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  newBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: '#15803d',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 4,
    padding: '1px 6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
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
    width: 220,
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
  btnGhost: {
    padding: '7px 14px',
    background: 'none',
    color: '#64748b',
    border: '1px solid transparent',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
};

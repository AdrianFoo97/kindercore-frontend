import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen, faTrash, faPlus, faCheck, faXmark, faGripVertical, faLock, faEllipsisVertical,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchOperatingCostGroups,
  createOperatingCostGroup,
  updateOperatingCostGroup,
  deleteOperatingCostGroup,
  OperatingCostGroup,
} from '../../api/operatingCost.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import { SettingsBreadcrumb } from '../../components/common/SettingsBreadcrumb.js';

const C = {
  bg: '#f8fafc',
  card: '#fff',
  text: '#0f172a',
  textSub: '#334155',
  muted: '#64748b',
  mutedMore: '#94a3b8',
  dim: '#cbd5e1',
  border: '#e2e8f0',
  borderSoft: '#eef0f4',
  divider: '#f1f5f9',
  primary: '#5a67d8',
  primaryLight: '#eef0fa',
  red: '#dc2626',
  redBg: '#fef2f2',
};

export default function OperatingCostMainCategoriesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingExclude, setConfirmingExclude] = useState<OperatingCostGroup | null>(null);

  // Drag-and-drop reorder state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below' | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ['operating-cost-groups'],
    queryFn: fetchOperatingCostGroups,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['operating-cost-groups'] });
    qc.invalidateQueries({ queryKey: ['operating-cost-categories'] });
  };

  function startAdd() {
    setEditing({});
    setNewName('');
    setIsAdding(true);
  }

  function cancelAdd() {
    setIsAdding(false);
    setNewName('');
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createOperatingCostGroup({ name: newName.trim() });
      setNewName('');
      setIsAdding(false);
      invalidate();
      showToast('Main category added', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(id: string) {
    const name = editing[id];
    if (!name || !name.trim()) return;
    setBusy(true);
    try {
      await updateOperatingCostGroup(id, { name: name.trim() });
      setEditing(prev => { const next = { ...prev }; delete next[id]; return next; });
      invalidate();
      showToast('Updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function setIncludeInSum(group: OperatingCostGroup, include: boolean) {
    setBusy(true);
    try {
      await updateOperatingCostGroup(group.id, { includeInOperatingCostSum: include });
      invalidate();
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      showToast(include ? `${group.name} now counts as operating cost` : `${group.name} excluded from operating cost`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // Excluding a main category cascades to every category under it and
  // changes profit-share/bonus-pool eligibility numbers — confirm that
  // direction. Including it back is always safe and stays a plain click.
  function handleToggleIncludeInSum(group: OperatingCostGroup) {
    if (group.includeInOperatingCostSum) setConfirmingExclude(group);
    else setIncludeInSum(group, true);
  }

  async function confirmExclude() {
    if (!confirmingExclude) return;
    const group = confirmingExclude;
    setConfirmingExclude(null);
    await setIncludeInSum(group, false);
  }

  async function handleDelete(id: string, name: string) {
    await confirmDelete({
      entityType: 'main category',
      entityName: name,
      consequence: (
        <>
          This main category will be removed. Any categories under it must be moved or
          deleted first — otherwise the server will reject the delete.
        </>
      ),
      actionLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteOperatingCostGroup(id);
          invalidate();
          showToast('Main category deleted', 'success');
        } catch (err: any) {
          showToast(err.message || 'Cannot delete — main category in use', 'error');
          throw err;
        }
      },
    });
  }

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  }

  function handleDragOver(e: React.DragEvent<HTMLTableRowElement>, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos: 'above' | 'below' = e.clientY < midY ? 'above' : 'below';
    if (dragOverId !== id || dragOverPos !== pos) {
      setDragOverId(id);
      setDragOverPos(pos);
    }
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
    setDragOverPos(null);
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = draggedId;
    const pos = dragOverPos ?? 'above';
    setDraggedId(null);
    setDragOverId(null);
    setDragOverPos(null);
    if (!sourceId || sourceId === targetId) return;

    const currentList = groups;
    const fromIdx = currentList.findIndex(g => g.id === sourceId);
    const targetIdx = currentList.findIndex(g => g.id === targetId);
    if (fromIdx < 0 || targetIdx < 0) return;

    let insertIdx = pos === 'below' ? targetIdx + 1 : targetIdx;
    if (fromIdx < insertIdx) insertIdx--;

    const reordered = [...currentList];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(insertIdx, 0, moved);

    const sortOrders = currentList.map(g => g.sortOrder).slice().sort((a, b) => a - b);
    const updates = reordered
      .map((g, i) => ({ id: g.id, sortOrder: sortOrders[i] }))
      .filter(u => currentList.find(g => g.id === u.id)?.sortOrder !== u.sortOrder);

    if (updates.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(updates.map(u => updateOperatingCostGroup(u.id, { sortOrder: u.sortOrder })));
      invalidate();
    } catch (err: any) {
      showToast(err.message || 'Failed to reorder', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={embedded ? { maxWidth: 980, margin: '0 auto' } : s.page}>
      <style>{`
        .mcat-row { transition: background 0.12s ease; }
        .mcat-row > td { transition: box-shadow 0.12s ease; }
        .mcat-row:hover { background: #f7f9fc; }
        .mcat-row.mcat-system { background: #fafbff; }
        .mcat-row.mcat-system:hover { background: #f4f6ff; }
        .mcat-row .row-actions { opacity: 0; transition: opacity 0.15s; }
        .mcat-row:hover .row-actions { opacity: 1; }
        .mcat-row:hover .occ-grip { color: ${C.textSub} !important; }
        .occ-grip:hover { color: ${C.primary} !important; background: #eef0fa !important; }
        .occ-grip:active { cursor: grabbing !important; }
        .occ-table tbody tr:last-child td { border-bottom: none !important; }
        .occ-table input { outline: none; }
        .occ-cell-input:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.15); }
        .mcat-menu-btn:hover { background: #e2e8f0 !important; color: ${C.text} !important; }
        .mcat-menu-rename:hover { background: ${C.primaryLight} !important; color: ${C.primary} !important; }
        .mcat-menu-rename:hover svg { color: ${C.primary} !important; }
        .mcat-menu-danger:hover:not([disabled]) { background: ${C.redBg} !important; }
        .mcat-menu-item[disabled] { opacity: 0.45; cursor: default; }
      `}</style>

      {/* Breadcrumb + Add main category share one row */}
      <div style={s.headerRow}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!embedded && <SettingsBreadcrumb label={['Operating Cost', 'Main Categories']} inline />}
        </div>
        <button
          type="button"
          onClick={startAdd}
          disabled={isAdding}
          style={{
            ...s.primaryBtn,
            opacity: isAdding ? 0.5 : 1,
            cursor: isAdding ? 'default' : 'pointer',
          }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10, marginRight: 6 }} />
          Add main category
        </button>
      </div>

      <div style={s.contentCard}>
        <table style={s.table} className="occ-table">
          <colgroup>
            <col style={{ width: 32 }} />
            <col />
            <col style={{ width: 150 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={s.th}></th>
              <th style={{ ...s.th, textAlign: 'left' }}>Name</th>
              <th style={{ ...s.th, textAlign: 'center' }} title="Whether categories under this main category count toward the monthly operating cost total used for the Expense Ratio Target / profit-share eligibility">In Cost Total</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ height: 49 }}>
                <td style={s.td} />
                <td style={s.td}>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="New main category name…"
                    autoFocus
                    className="occ-cell-input"
                    style={s.cellInput}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAdd();
                      if (e.key === 'Escape') cancelAdd();
                    }}
                  />
                </td>
                <td style={{ ...s.td, textAlign: 'center', color: C.muted, fontSize: 11 }}>Yes</td>
                <td style={{ ...s.td, textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 2 }}>
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={busy || !newName.trim()}
                      style={s.iconBtnGreen}
                      title="Save"
                    >
                      <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                    </button>
                    <button type="button" onClick={cancelAdd} style={s.iconBtn} title="Cancel">
                      <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {groups.map((g: OperatingCostGroup) => {
              const isRowEditing = g.id in editing;
              const editValue = editing[g.id];
              const isDragging = draggedId === g.id;
              const isDragTarget = dragOverId === g.id && draggedId !== null && draggedId !== g.id;
              const dropLine: React.CSSProperties = isDragTarget
                ? dragOverPos === 'above'
                  ? { borderTop: `2px solid ${C.primary}` }
                  : { borderBottom: `2px solid ${C.primary}` }
                : {};

              const cancelEdit = () => setEditing(prev => {
                const next = { ...prev };
                delete next[g.id];
                return next;
              });
              return (
                <tr
                  key={g.id}
                  className={`mcat-row ${g.isProtected ? 'mcat-system' : ''}`}
                  onDragOver={e => handleDragOver(e, g.id)}
                  onDrop={e => handleDrop(e, g.id)}
                  onDragLeave={() => {
                    if (dragOverId === g.id) {
                      setDragOverId(null);
                      setDragOverPos(null);
                    }
                  }}
                  style={{
                    height: 52,
                    opacity: isDragging ? 0.4 : 1,
                    transition: 'opacity 0.12s',
                  }}
                >
                  <td style={{ ...s.td, ...dropLine, width: 32, padding: '0 0 0 8px' }}>
                    <span
                      draggable={!isRowEditing}
                      onDragStart={e => handleDragStart(e, g.id)}
                      onDragEnd={handleDragEnd}
                      title="Drag to reorder"
                      className="occ-grip"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 6,
                        color: C.mutedMore,
                        cursor: isRowEditing ? 'default' : 'grab',
                        borderRadius: 4,
                        transition: 'color 0.12s, background 0.12s',
                      }}
                    >
                      <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 12 }} />
                    </span>
                  </td>

                  <td style={{ ...s.td, ...dropLine }}>
                    {isRowEditing ? (
                      <input
                        value={editValue}
                        onChange={e => setEditing(prev => ({ ...prev, [g.id]: e.target.value }))}
                        autoFocus
                        className="occ-cell-input"
                        style={s.cellInput}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit(g.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>{g.name}</span>
                        {g.isProtected && (
                          <span
                            title="System preset — protected from deletion"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 9px',
                              fontSize: 10,
                              fontWeight: 700,
                              background: C.card,
                              color: C.primary,
                              border: `1px solid ${C.primaryLight}`,
                              borderRadius: 5,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                            }}
                          >
                            <FontAwesomeIcon icon={faLock} style={{ fontSize: 9 }} />
                            System
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td style={{ ...s.td, ...dropLine, textAlign: 'center' }}>
                    <IncludeInSumToggle
                      active={g.includeInOperatingCostSum}
                      onChange={() => handleToggleIncludeInSum(g)}
                      disabled={busy}
                    />
                  </td>

                  <td style={{ ...s.td, ...dropLine, textAlign: 'right' }}>
                    {isRowEditing ? (
                      <div style={{ display: 'inline-flex', gap: 2 }}>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(g.id)}
                          disabled={busy}
                          style={s.iconBtnGreen}
                          title="Save"
                        >
                          <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          style={s.iconBtn}
                          title="Cancel"
                        >
                          <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                        </button>
                      </div>
                    ) : (
                      <div className="row-actions">
                        <RowMenu
                          onRename={() => setEditing(prev => ({ ...prev, [g.id]: g.name }))}
                          onDelete={() => handleDelete(g.id, g.name)}
                          canDelete={!g.isProtected}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {groups.length === 0 && !isAdding && (
              <tr>
                <td colSpan={4} style={{ ...s.td, textAlign: 'center', color: C.dim, padding: '32px 0' }}>
                  No main categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmingExclude && (
        <ConfirmDialog
          title={`Exclude "${confirmingExclude.name}" from operating cost?`}
          message={
            <>
              Every category under this main category will still be recorded, but will no longer
              count toward the monthly operating cost total that feeds the Expense Ratio Target —
              this can change profit-share and bonus-pool eligibility for affected months. Individual
              categories will show as excluded and can't be switched back on their own while this is off.
            </>
          }
          confirmLabel="Exclude"
          loading={busy}
          onConfirm={confirmExclude}
          onCancel={() => setConfirmingExclude(null)}
        />
      )}
    </div>
  );
}

function IncludeInSumToggle({ active, onChange, disabled }: {
  active: boolean; onChange: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label="Counts as operating cost"
      onClick={onChange}
      disabled={disabled}
      title={active ? 'Counts toward the operating cost total' : 'Excluded from the operating cost total'}
      style={{
        position: 'relative',
        width: 36, height: 20, borderRadius: 999,
        background: active ? C.primary : '#cbd5e1',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        padding: 0, flexShrink: 0, opacity: disabled ? 0.6 : 1,
        transition: 'background 160ms ease',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2, left: active ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(15,23,42,0.18)',
        transition: 'left 160ms cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '28px 32px',
    maxWidth: 980,
    margin: '0 auto',
    background: C.bg,
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  contentCard: {
    background: C.card,
    borderRadius: 14,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
    border: `1px solid ${C.borderSoft}`,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
    tableLayout: 'fixed' as const,
  },
  th: {
    padding: '12px 20px',
    fontSize: 10,
    fontWeight: 700,
    color: C.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    borderBottom: `1px solid ${C.border}`,
    background: C.card,
  },
  td: {
    padding: '10px 20px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 13,
    color: C.text,
    verticalAlign: 'middle' as const,
  },
  cellInput: {
    display: 'block',
    width: 'calc(100% + 22px)',
    margin: '-7px -11px',
    padding: '7px 10px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: C.card,
    fontSize: 13,
    color: C.text,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  primaryBtn: {
    background: C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: C.muted,
    cursor: 'pointer',
    padding: 8,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnGreen: {
    background: '#ecfdf5',
    border: `1px solid #a7f3d0`,
    color: '#059669',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtn: {
    background: 'transparent',
    border: 'none',
    color: C.muted,
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 120ms ease, color 120ms ease',
  },
  menu: {
    position: 'fixed' as const,
    zIndex: 9999,
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06)',
    width: 168,
    overflow: 'hidden',
    padding: '4px 0',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    color: C.text,
  },
};

// ── RowMenu ──────────────────────────────────────────────────────────────────

function RowMenu({ onRename, onDelete, canDelete }: {
  onRename: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 168 });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="mcat-menu-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        style={s.menuBtn}
        aria-label="More actions"
      >
        <FontAwesomeIcon icon={faEllipsisVertical} style={{ fontSize: 14 }} />
      </button>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} style={{ ...s.menu, top: pos.top, left: pos.left }}>
          <button
            type="button"
            className="mcat-menu-item mcat-menu-rename"
            style={s.menuItem}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(); }}
          >
            <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, width: 14, color: C.muted }} />
            Rename
          </button>
          <button
            type="button"
            className="mcat-menu-item mcat-menu-danger"
            style={{ ...s.menuItem, color: canDelete ? C.red : C.mutedMore }}
            disabled={!canDelete}
            onClick={(e) => {
              e.stopPropagation();
              if (!canDelete) return;
              setOpen(false);
              onDelete();
            }}
          >
            <FontAwesomeIcon icon={canDelete ? faTrash : faLock} style={{ fontSize: 11, width: 14 }} />
            {canDelete ? 'Delete' : 'Protected'}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen, faTrash, faPlus, faCheck, faXmark, faGripVertical, faEllipsisVertical,
} from '@fortawesome/free-solid-svg-icons';
import { fetchDepartments, upsertDepartment, deleteDepartment } from '../../api/salary.js';
import { Department } from '../../types/index.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';

const C = {
  bg: '#f8fafc', card: '#fff', text: '#0f172a', textSub: '#334155',
  muted: '#64748b', mutedMore: '#94a3b8', dim: '#cbd5e1',
  border: '#e2e8f0', borderSoft: '#eef0f4', primary: '#5a67d8', primaryLight: '#eef0fa', red: '#dc2626',
};

const CODE_RE = /^[A-Z0-9_]+$/;

export default function DepartmentsPage() {
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newHasCareerPath, setNewHasCareerPath] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState<Department | null>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below' | null>(null);

  const { data: departmentList = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['departments'] });

  function startAdd() {
    setEditing({});
    setNewCode('');
    setNewName('');
    setNewHasCareerPath(true);
    setIsAdding(true);
  }

  function cancelAdd() {
    setIsAdding(false);
    setNewCode('');
    setNewName('');
    setNewHasCareerPath(true);
  }

  const codeTaken = departmentList.some(d => d.departmentId === newCode.trim().toUpperCase());
  const canAdd = CODE_RE.test(newCode.trim().toUpperCase()) && !!newName.trim() && !codeTaken;

  async function handleAdd() {
    if (!canAdd) return;
    setBusy(true);
    try {
      await upsertDepartment(newCode.trim().toUpperCase(), { name: newName.trim(), sortOrder: departmentList.length, hasCareerPath: newHasCareerPath });
      setNewCode(''); setNewName(''); setNewHasCareerPath(true); setIsAdding(false);
      invalidate();
      showToast('Department added', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCareerPath(d: Department) {
    setBusy(true);
    try {
      await upsertDepartment(d.departmentId, { name: d.name, sortOrder: d.sortOrder, hasCareerPath: !d.hasCareerPath });
      invalidate();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // Turning career path OFF hides the Level Incentive Matrix for every
  // position in the department and strips inCareerProgression the next time
  // any of those positions is saved — consequential enough to confirm.
  // Turning it ON is harmless, so that direction stays a plain click.
  function handleToggleCareerPath(d: Department) {
    if (d.hasCareerPath) setConfirmingOff(d);
    else toggleCareerPath(d);
  }

  async function confirmToggleOff() {
    if (!confirmingOff) return;
    const d = confirmingOff;
    setConfirmingOff(null);
    await toggleCareerPath(d);
  }

  async function handleSaveEdit(departmentId: string) {
    const name = editing[departmentId];
    if (!name || !name.trim()) return;
    const dept = departmentList.find(d => d.departmentId === departmentId);
    if (!dept) return;
    setBusy(true);
    try {
      await upsertDepartment(departmentId, { name: name.trim(), sortOrder: dept.sortOrder });
      setEditing(prev => { const next = { ...prev }; delete next[departmentId]; return next; });
      invalidate();
      showToast('Updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(departmentId: string, name: string) {
    await confirmDelete({
      entityType: 'department',
      entityName: name,
      consequence: (
        <>
          This department will be removed. Any positions assigned to it must be moved to
          another department first — otherwise the server will reject the delete.
        </>
      ),
      actionLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDepartment(departmentId);
          invalidate();
          showToast('Department deleted', 'success');
        } catch (err: any) {
          showToast(err.message || 'Cannot delete — department in use', 'error');
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
    setDraggedId(null); setDragOverId(null); setDragOverPos(null);
    if (!sourceId || sourceId === targetId) return;

    const currentList = departmentList;
    const fromIdx = currentList.findIndex(d => d.departmentId === sourceId);
    const targetIdx = currentList.findIndex(d => d.departmentId === targetId);
    if (fromIdx < 0 || targetIdx < 0) return;

    let insertIdx = pos === 'below' ? targetIdx + 1 : targetIdx;
    if (fromIdx < insertIdx) insertIdx--;

    const reordered = [...currentList];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(insertIdx, 0, moved);

    setBusy(true);
    try {
      for (let i = 0; i < reordered.length; i++) {
        const d = reordered[i];
        if (d.sortOrder !== i) await upsertDepartment(d.departmentId, { name: d.name, sortOrder: i });
      }
      invalidate();
    } catch (err: any) {
      showToast(err.message || 'Failed to reorder', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <style>{`
        .dept-row { transition: background 0.12s ease; }
        .dept-row:hover { background: #f7f9fc; }
        .dept-row .row-actions { opacity: 0; transition: opacity 0.15s; }
        .dept-row:hover .row-actions { opacity: 1; }
        .dept-row:hover .dept-grip { color: ${C.textSub} !important; }
        .dept-grip:hover { color: ${C.primary} !important; background: #eef0fa !important; }
        .dept-grip:active { cursor: grabbing !important; }
        .dept-table tbody tr:last-child td { border-bottom: none !important; }
        .dept-table input { outline: none; }
        .dept-cell-input:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.15); }
        .dept-menu-btn:hover { background: #e2e8f0 !important; color: ${C.text} !important; }
        .dept-menu-rename:hover { background: ${C.primaryLight} !important; color: ${C.primary} !important; }
        .dept-menu-rename:hover svg { color: ${C.primary} !important; }
        .dept-menu-danger:hover { background: #fef2f2 !important; }
      `}</style>

      <div style={s.headerRow}>
        <p style={s.subtitle}>Positions belong to a department — Employee Salary, Career Missions, and staff pickers can be scoped or grouped by it.</p>
        <button
          type="button"
          onClick={startAdd}
          disabled={isAdding}
          style={{ ...s.primaryBtn, opacity: isAdding ? 0.5 : 1, cursor: isAdding ? 'default' : 'pointer' }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10, marginRight: 6 }} />
          Add department
        </button>
      </div>

      <div style={s.contentCard}>
        <table style={s.table} className="dept-table">
          <colgroup>
            <col style={{ width: 32 }} />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 120 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={s.th}></th>
              <th style={{ ...s.th, textAlign: 'left' }}>Code</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Name</th>
              <th style={s.th}>Career Path</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ height: 49 }}>
                <td style={s.td} />
                <td style={s.td}>
                  <input
                    value={newCode}
                    onChange={e => setNewCode(e.target.value.toUpperCase())}
                    placeholder="ADMIN"
                    autoFocus
                    className="dept-cell-input"
                    style={s.cellInput}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelAdd(); }}
                  />
                </td>
                <td style={s.td}>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="New department name…"
                    className="dept-cell-input"
                    style={s.cellInput}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelAdd(); }}
                  />
                </td>
                <td style={{ ...s.td, textAlign: 'center' }}>
                  <CareerPathToggle active={newHasCareerPath} onChange={() => setNewHasCareerPath(v => !v)} label="Career path" />
                </td>
                <td style={{ ...s.td, textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 2 }}>
                    <button type="button" onClick={handleAdd} disabled={busy || !canAdd} style={s.iconBtnGreen} title="Save">
                      <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                    </button>
                    <button type="button" onClick={cancelAdd} style={s.iconBtn} title="Cancel">
                      <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {departmentList.map((d: Department) => {
              const isRowEditing = d.departmentId in editing;
              const editValue = editing[d.departmentId];
              const isDragging = draggedId === d.departmentId;
              const isDragTarget = dragOverId === d.departmentId && draggedId !== null && draggedId !== d.departmentId;
              const dropLine: React.CSSProperties = isDragTarget
                ? dragOverPos === 'above' ? { borderTop: `2px solid ${C.primary}` } : { borderBottom: `2px solid ${C.primary}` }
                : {};

              const cancelEdit = () => setEditing(prev => { const next = { ...prev }; delete next[d.departmentId]; return next; });

              return (
                <tr
                  key={d.departmentId}
                  className="dept-row"
                  onDragOver={e => handleDragOver(e, d.departmentId)}
                  onDrop={e => handleDrop(e, d.departmentId)}
                  onDragLeave={() => { if (dragOverId === d.departmentId) { setDragOverId(null); setDragOverPos(null); } }}
                  style={{ height: 52, opacity: isDragging ? 0.4 : 1, transition: 'opacity 0.12s' }}
                >
                  <td style={{ ...s.td, ...dropLine, width: 32, padding: '0 0 0 8px' }}>
                    <span
                      draggable={!isRowEditing}
                      onDragStart={e => handleDragStart(e, d.departmentId)}
                      onDragEnd={handleDragEnd}
                      title="Drag to reorder"
                      className="dept-grip"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6,
                        color: C.mutedMore, cursor: isRowEditing ? 'default' : 'grab', borderRadius: 4,
                        transition: 'color 0.12s, background 0.12s',
                      }}
                    >
                      <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 12 }} />
                    </span>
                  </td>

                  <td style={{ ...s.td, ...dropLine }}>
                    <span style={s.codeBadge}>{d.departmentId}</span>
                  </td>

                  <td style={{ ...s.td, ...dropLine }}>
                    {isRowEditing ? (
                      <input
                        value={editValue}
                        onChange={e => setEditing(prev => ({ ...prev, [d.departmentId]: e.target.value }))}
                        autoFocus
                        className="dept-cell-input"
                        style={s.cellInput}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(d.departmentId); if (e.key === 'Escape') cancelEdit(); }}
                      />
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>{d.name}</span>
                    )}
                  </td>

                  <td style={{ ...s.td, ...dropLine, textAlign: 'center' }}>
                    <CareerPathToggle
                      active={d.hasCareerPath}
                      onChange={() => handleToggleCareerPath(d)}
                      disabled={busy}
                      label="Career path"
                      title={d.hasCareerPath ? 'Positions here can be part of a career ladder' : 'Positions here have no career progression'}
                    />
                  </td>

                  <td style={{ ...s.td, ...dropLine, textAlign: 'right' }}>
                    {isRowEditing ? (
                      <div style={{ display: 'inline-flex', gap: 2 }}>
                        <button type="button" onClick={() => handleSaveEdit(d.departmentId)} disabled={busy} style={s.iconBtnGreen} title="Save">
                          <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                        </button>
                        <button type="button" onClick={cancelEdit} style={s.iconBtn} title="Cancel">
                          <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                        </button>
                      </div>
                    ) : (
                      <div className="row-actions">
                        <RowMenu
                          onRename={() => setEditing(prev => ({ ...prev, [d.departmentId]: d.name }))}
                          onDelete={() => handleDelete(d.departmentId, d.name)}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {departmentList.length === 0 && !isAdding && (
              <tr>
                <td colSpan={5} style={{ ...s.td, textAlign: 'center', color: C.dim, padding: '32px 0' }}>
                  No departments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmingOff && (
        <ConfirmDialog
          title={`Turn off career path for ${confirmingOff.name}?`}
          message={
            <>
              The Level Incentive Matrix will no longer show for positions in this department, and
              any position here on a career path will drop off it the next time it's saved.
            </>
          }
          confirmLabel="Turn off"
          loading={busy}
          onConfirm={confirmToggleOff}
          onCancel={() => setConfirmingOff(null)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 },
  subtitle: { flex: 1, minWidth: 0, margin: 0, fontSize: 12.5, color: C.muted, lineHeight: 1.5 },
  contentCard: {
    background: C.card, borderRadius: 14,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
    border: `1px solid ${C.borderSoft}`, overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13, tableLayout: 'fixed' as const },
  th: {
    padding: '12px 20px', fontSize: 10, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}`, background: C.card,
  },
  td: { padding: '10px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, verticalAlign: 'middle' as const },
  codeBadge: {
    display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 700,
    background: C.primaryLight, color: C.primary, borderRadius: 5, letterSpacing: '0.03em',
  },
  cellInput: {
    display: 'block', width: 'calc(100% + 22px)', margin: '-7px -11px', padding: '7px 10px',
    border: `1px solid ${C.border}`, borderRadius: 6, background: C.card, fontSize: 13, color: C.text,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
  },
  primaryBtn: {
    background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px',
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', height: 36, display: 'inline-flex', alignItems: 'center', flexShrink: 0,
  },
  iconBtn: { background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 8, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  iconBtnGreen: { background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', cursor: 'pointer', padding: 8, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  menuBtn: {
    background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: '6px 8px', borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms ease, color 120ms ease',
  },
  menu: {
    position: 'fixed' as const, zIndex: 9999, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06)', width: 168, overflow: 'hidden', padding: '4px 0',
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', fontSize: 13, fontWeight: 500,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit', color: C.text,
  },
};

// ── CareerPathToggle ─────────────────────────────────────────────────────────
// A pill-shaped badge here would be indistinguishable from the read-only
// status badges used elsewhere (e.g. "Guaranteed" on AllowancesPage) — a
// real switch makes it visually obvious this is clickable.
function CareerPathToggle({ active, onChange, disabled, label, title }: {
  active: boolean; onChange: () => void; disabled?: boolean; label: string; title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      title={title}
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

// ── RowMenu ──────────────────────────────────────────────────────────────────

function RowMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
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
      <button ref={btnRef} type="button" className="dept-menu-btn" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} style={s.menuBtn} aria-label="More actions">
        <FontAwesomeIcon icon={faEllipsisVertical} style={{ fontSize: 14 }} />
      </button>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} style={{ ...s.menu, top: pos.top, left: pos.left }}>
          <button type="button" className="dept-menu-item dept-menu-rename" style={s.menuItem} onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(); }}>
            <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, width: 14, color: C.muted }} />
            Rename
          </button>
          <button type="button" className="dept-menu-item dept-menu-danger" style={{ ...s.menuItem, color: C.red }} onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}>
            <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11, width: 14 }} />
            Delete
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

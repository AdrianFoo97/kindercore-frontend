import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash, faPlus, faCheck, faXmark, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import {
  fetchOperatingCostCategories,
  fetchOperatingCostGroups,
  createOperatingCostCategory,
  updateOperatingCostCategory,
  deleteOperatingCostCategory,
  OperatingCostCategory,
} from '../../api/operatingCost.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import { SettingsBreadcrumb } from '../../components/common/SettingsBreadcrumb.js';

const C = {
  bg: '#f8fafc', card: '#fff', text: '#1e293b', muted: '#64748b', border: '#e2e8f0',
  primary: '#5a67d8', red: '#dc2626',
};

const PAGE_SIZE_OPTIONS: Array<10 | 20 | 'all'> = [10, 20, 'all'];
const DEFAULT_PAGE_SIZE = 10;

export default function OperatingCostCategoriesPage() {
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();
  const qc = useQueryClient();
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Record<string, { name: string; defaultAmount: string; monthlyBudget: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDefault, setNewDefault] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageSize, setPageSize] = useState<10 | 20 | 'all'>(DEFAULT_PAGE_SIZE);

  // Drag-and-drop reorder state (HTML5 DnD, within the current page)
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below' | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ['operating-cost-groups'],
    queryFn: fetchOperatingCostGroups,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['operating-cost-categories'],
    queryFn: fetchOperatingCostCategories,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Default to the first group once groups load
  useEffect(() => {
    if (!activeGroupId && groups.length > 0) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, activeGroupId]);

  // Reset to page 1 + default page size + close any in-progress add whenever
  // the active tab changes
  useEffect(() => {
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setIsAdding(false);
    setNewName('');
    setNewDefault('');
    setNewBudget('');
  }, [activeGroupId]);

  const { activeGroup, activeCategories, groupCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categories) counts.set(c.groupId, (counts.get(c.groupId) ?? 0) + 1);
    const active = groups.find(g => g.id === activeGroupId) ?? null;
    const items = categories
      .filter(c => c.groupId === activeGroupId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return { activeGroup: active, activeCategories: items, groupCounts: counts };
  }, [groups, categories, activeGroupId]);

  const effectivePageSize = pageSize === 'all' ? activeCategories.length || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(activeCategories.length / effectivePageSize));
  // Clamp page if the list shrinks (e.g. after a delete) or the page size changes
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);
  const pageCategories = pageSize === 'all'
    ? activeCategories
    : activeCategories.slice((page - 1) * pageSize, page * pageSize);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['operating-cost-categories'] });

  function parseMoney(s: string): number | null {
    const t = s.trim().replace(/,/g, '');
    if (t === '') return null;
    const n = parseFloat(t);
    return Number.isNaN(n) ? null : n;
  }

  function cancelAdd() {
    setIsAdding(false);
    setNewName('');
    setNewDefault('');
    setNewBudget('');
  }

  function startAdd() {
    // Close any open edits + reset the pagination so the new row lands on page 1
    setEditing({});
    setPage(1);
    setNewName('');
    setNewDefault('');
    setNewBudget('');
    setIsAdding(true);
  }

  async function handleAdd() {
    if (!newName.trim() || !activeGroupId) return;
    setBusy(true);
    try {
      const groupCats = categories.filter(c => c.groupId === activeGroupId);
      const nextOrder = groupCats.length > 0 ? Math.max(...groupCats.map(c => c.sortOrder)) + 10 : 10;
      await createOperatingCostCategory({
        name: newName.trim(),
        groupId: activeGroupId,
        sortOrder: nextOrder,
        defaultAmount: parseMoney(newDefault),
        monthlyBudget: parseMoney(newBudget),
      });
      cancelAdd();
      invalidate();
      showToast('Category added', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = editing[id];
    if (!edit || !edit.name.trim()) return;
    setBusy(true);
    try {
      await updateOperatingCostCategory(id, {
        name: edit.name.trim(),
        defaultAmount: parseMoney(edit.defaultAmount),
        monthlyBudget: parseMoney(edit.monthlyBudget),
      });
      setEditing(prev => { const next = { ...prev }; delete next[id]; return next; });
      invalidate();
      showToast('Updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ── Drag-and-drop reorder ────────────────────────────────────────────────
  // HTML5 DnD within the current page. Dragging swaps the sortOrder values of
  // the visible rows so the server-side sortOrder always matches the display.
  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  }

  function handleDragOver(e: React.DragEvent<HTMLTableRowElement>, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Split the target row into top/bottom halves to decide insertion side
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

    // Reorder within the CURRENT PAGE only. Users paginate first, then drag.
    const currentList = pageCategories;
    const fromIdx = currentList.findIndex(c => c.id === sourceId);
    const targetIdx = currentList.findIndex(c => c.id === targetId);
    if (fromIdx < 0 || targetIdx < 0) return;

    let insertIdx = pos === 'below' ? targetIdx + 1 : targetIdx;
    if (fromIdx < insertIdx) insertIdx--;  // account for splice shift

    const reordered = [...currentList];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(insertIdx, 0, moved);

    // Reassign each cell's sortOrder to the sorted values of the original
    // sortOrders in the slice (so the ordering is stable relative to the
    // rest of the page's range).
    const sortOrders = currentList.map(c => c.sortOrder).slice().sort((a, b) => a - b);
    const updates = reordered
      .map((cat, i) => ({ id: cat.id, sortOrder: sortOrders[i] }))
      .filter(u => currentList.find(c => c.id === u.id)?.sortOrder !== u.sortOrder);

    if (updates.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(updates.map(u => updateOperatingCostCategory(u.id, { sortOrder: u.sortOrder })));
      invalidate();
    } catch (err: any) {
      showToast(err.message || 'Failed to reorder', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cat: OperatingCostCategory) {
    const hasEntries = cat.entryCount > 0;
    const consequence = hasEntries ? (
      <>
        This category will be removed along with{' '}
        <strong>{cat.entryCount} recorded monthly {cat.entryCount === 1 ? 'entry' : 'entries'}</strong>
        {cat.entryTotal > 0 && <> totalling <strong>RM {cat.entryTotal.toLocaleString('en-MY')}</strong></>}.
        {' '}This data cannot be recovered.
      </>
    ) : (
      <>This category will be removed. It has no recorded cost entries yet, so no data will be lost.</>
    );

    await confirmDelete({
      entityType: 'category',
      entityName: cat.name,
      consequence,
      actionLabel: hasEntries ? 'Delete category and data' : 'Delete category',
      onConfirm: async () => {
        try {
          await deleteOperatingCostCategory(cat.id);
          invalidate();
          // Also refresh the finance page cache since the totals will change
          qc.invalidateQueries({ queryKey: ['finance-summary'] });
          showToast('Category deleted', 'success');
        } catch (err: any) {
          showToast(err.message || 'Failed to delete category', 'error');
          throw err;
        }
      },
    });
  }

  return (
    <div style={s.page}>
      <style>{`
        .cat-row { transition: background 0.1s; }
        .cat-row:hover { background: #f8fafc; }
        .cat-row .row-actions { opacity: 0; transition: opacity 0.15s; }
        .cat-row:hover .row-actions { opacity: 1; }
        .cat-row:hover .occ-grip { color: ${C.muted} !important; }
        .occ-grip:hover { color: ${C.primary} !important; background: ${C.card} !important; }
        .occ-grip:active { cursor: grabbing !important; }
        .occ-tab:hover { background: #f1f5f9 !important; }
        .occ-table tbody tr:last-child td { border-bottom: none !important; }
        .occ-table input { outline: none; }
        .occ-cell-input, .occ-money-wrap { transition: border-color 0.15s, box-shadow 0.15s; }
        .occ-cell-input:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.15); }
        .occ-money-wrap:focus-within { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.15); }
      `}</style>

      {/* Breadcrumb + Add category share one row */}
      <div style={s.headerRow}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SettingsBreadcrumb label={['Operating Cost', 'Categories']} inline />
        </div>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={startAdd}
            disabled={isAdding || !activeGroupId}
            style={{
              ...s.primaryBtn,
              opacity: (isAdding || !activeGroupId) ? 0.5 : 1,
              cursor: (isAdding || !activeGroupId) ? 'not-allowed' : 'pointer',
            }}
          >
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10, marginRight: 6 }} />
            Add category
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div style={s.card}>
          <p style={s.empty}>
            No main categories yet. Add one under{' '}
            <a href="/settings/operating-cost-main-categories" style={{ color: C.primary, fontWeight: 600 }}>Main Categories</a> first.
          </p>
        </div>
      ) : (
        <>
        <div style={s.layout}>
          {/* Left sidebar — main categories as vertical tabs */}
          <div style={s.sidebarCard}>
            <div style={s.sidebarHeader}>
              <span>Main Categories</span>
            </div>
            <div style={s.tabNav}>
              {groups.map(g => {
                const isActive = g.id === activeGroupId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="occ-tab"
                    onClick={() => setActiveGroupId(g.id)}
                    style={{ ...s.tabBtn, ...(isActive ? s.tabBtnActive : {}) }}
                  >
                    {/* Active left accent bar */}
                    <span style={{
                      width: 3,
                      alignSelf: 'stretch',
                      borderRadius: 2,
                      background: isActive ? C.primary : 'transparent',
                      marginRight: 8,
                    }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{g.name}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: isActive ? '#fff' : '#e2e8f0',
                      color: isActive ? C.primary : C.muted,
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: 22,
                      textAlign: 'center',
                    }}>{groupCounts.get(g.id) ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right content — card with header + table */}
          <div style={s.content}>
            <div style={s.contentCard}>
              <div style={s.contentHeader}>
                <div>
                  <h2 style={s.contentTitle}>{activeGroup?.name}</h2>
                  <p style={s.contentSub}>{activeCategories.length} {activeCategories.length === 1 ? 'category' : 'categories'}</p>
                </div>
              </div>

              {activeCategories.length === 0 && !isAdding ? (
                <p style={s.empty}>No categories in {activeGroup?.name ?? ''} yet.</p>
              ) : (
                <table style={s.table} className="occ-table">
                  <colgroup>
                    <col style={{ width: 32 }} />
                    <col />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 88 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={s.th}></th>
                      <th style={{ ...s.th, textAlign: 'left' }}>Name</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Preset Amount</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Budget</th>
                      <th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isAdding && (
                      <tr>
                        <td style={s.td} />
                        <td style={s.td}>
                          <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="New category name…"
                            autoFocus
                            className="occ-cell-input" style={s.cellInput}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAdd();
                              if (e.key === 'Escape') cancelAdd();
                            }}
                          />
                        </td>
                        <td style={s.td}>
                          <CellMoneyInput
                            value={newDefault}
                            onChange={setNewDefault}
                            onEnter={handleAdd}
                            onEscape={cancelAdd}
                          />
                        </td>
                        <td style={s.td}>
                          <CellMoneyInput
                            value={newBudget}
                            onChange={setNewBudget}
                            onEnter={handleAdd}
                            onEscape={cancelAdd}
                          />
                        </td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 2 }}>
                            <button type="button" onClick={handleAdd} disabled={busy || !newName.trim()} style={s.iconBtnGreen} title="Save">
                              <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                            </button>
                            <button type="button" onClick={cancelAdd} style={s.iconBtn} title="Cancel">
                              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {pageCategories.map((cat: OperatingCostCategory) => {
                      const isEditing = !!editing[cat.id];
                      const edit = editing[cat.id];
                      const isDragging = draggedId === cat.id;
                      const isDragTarget = dragOverId === cat.id && draggedId !== null && draggedId !== cat.id;
                      // Drop line: a 2px indigo border-top (above) or border-bottom
                      // (below) applied to every td in the target row so the line
                      // spans the full row width in borderCollapse: collapse mode.
                      const dropLine: React.CSSProperties = isDragTarget
                        ? dragOverPos === 'above'
                          ? { borderTop: `2px solid ${C.primary}` }
                          : { borderBottom: `2px solid ${C.primary}` }
                        : {};
                      return (
                        <tr
                          key={cat.id}
                          className="cat-row"
                          onDragOver={e => handleDragOver(e, cat.id)}
                          onDrop={e => handleDrop(e, cat.id)}
                          onDragLeave={() => {
                            if (dragOverId === cat.id) {
                              setDragOverId(null);
                              setDragOverPos(null);
                            }
                          }}
                          style={{
                            height: 49,
                            opacity: isDragging ? 0.4 : 1,
                            transition: 'opacity 0.12s',
                          }}
                        >
                          <td style={{ ...s.td, ...dropLine, width: 32, padding: '0 0 0 8px' }}>
                            <span
                              draggable={!isEditing}
                              onDragStart={e => handleDragStart(e, cat.id)}
                              onDragEnd={handleDragEnd}
                              title="Drag to reorder"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 6,
                                color: '#cbd5e1',
                                cursor: isEditing ? 'default' : 'grab',
                                borderRadius: 4,
                                transition: 'color 0.12s, background 0.12s',
                              }}
                              className="occ-grip"
                            >
                              <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 12 }} />
                            </span>
                          </td>
                          <td style={{ ...s.td, ...dropLine }}>
                            {isEditing ? (
                              <input
                                value={edit.name}
                                onChange={e => setEditing(prev => ({ ...prev, [cat.id]: { ...edit, name: e.target.value } }))}
                                autoFocus
                                placeholder="Category name"
                                className="occ-cell-input" style={s.cellInput}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveEdit(cat.id);
                                  if (e.key === 'Escape') setEditing(prev => { const next = { ...prev }; delete next[cat.id]; return next; });
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: 13, color: C.text }}>{cat.name}</span>
                            )}
                          </td>
                          <td style={{ ...s.td, ...dropLine, textAlign: 'right' }}>
                            {isEditing ? (
                              <CellMoneyInput
                                value={edit.defaultAmount}
                                onChange={v => setEditing(prev => ({ ...prev, [cat.id]: { ...edit, defaultAmount: v } }))}
                                onEnter={() => handleSaveEdit(cat.id)}
                                onEscape={() => setEditing(prev => { const next = { ...prev }; delete next[cat.id]; return next; })}
                              />
                            ) : (
                              cat.defaultAmount != null ? (
                                <span style={s.moneyCell}>RM {cat.defaultAmount.toLocaleString('en-MY')}</span>
                              ) : <span style={s.dashCell}>—</span>
                            )}
                          </td>
                          <td style={{ ...s.td, ...dropLine, textAlign: 'right' }}>
                            {isEditing ? (
                              <CellMoneyInput
                                value={edit.monthlyBudget}
                                onChange={v => setEditing(prev => ({ ...prev, [cat.id]: { ...edit, monthlyBudget: v } }))}
                                onEnter={() => handleSaveEdit(cat.id)}
                                onEscape={() => setEditing(prev => { const next = { ...prev }; delete next[cat.id]; return next; })}
                              />
                            ) : (
                              cat.monthlyBudget != null ? (
                                <span style={s.moneyCell}>RM {cat.monthlyBudget.toLocaleString('en-MY')}</span>
                              ) : <span style={s.dashCell}>—</span>
                            )}
                          </td>
                          <td style={{ ...s.td, ...dropLine, textAlign: 'right' }}>
                            {isEditing ? (
                              <div style={{ display: 'inline-flex', gap: 2 }}>
                                <button type="button" onClick={() => handleSaveEdit(cat.id)} disabled={busy} style={s.iconBtnGreen} title="Save">
                                  <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                                </button>
                                <button type="button" onClick={() => setEditing(prev => { const next = { ...prev }; delete next[cat.id]; return next; })} style={s.iconBtn} title="Cancel">
                                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                                </button>
                              </div>
                            ) : (
                              <div className="row-actions" style={{ display: 'inline-flex', gap: 2 }}>
                                <button
                                  type="button"
                                  onClick={() => setEditing(prev => ({
                                    ...prev,
                                    [cat.id]: {
                                      name: cat.name,
                                      defaultAmount: cat.defaultAmount != null ? String(cat.defaultAmount) : '',
                                      monthlyBudget: cat.monthlyBudget != null ? String(cat.monthlyBudget) : '',
                                    },
                                  }))}
                                  style={s.iconBtn}
                                  title="Edit"
                                >
                                  <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(cat)}
                                  disabled={busy}
                                  style={{ ...s.iconBtn, color: C.red }}
                                  title="Delete"
                                >
                                  <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Filler rows keep the table height constant across pages */}
                    {pageSize !== 'all' && pageCategories.length < pageSize && (
                      Array.from({ length: pageSize - pageCategories.length }).map((_, i) => (
                        <tr key={`filler-${i}`} aria-hidden="true" style={{ height: 49 }}>
                          <td colSpan={5} style={{ padding: 0, border: 'none' }} />
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

            {activeCategories.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                padding: '18px 20px',
                minHeight: 64,
                borderTop: `1px solid ${C.border}`,
                background: C.card,
                gap: 12,
              }}>
                {/* Left: rows-per-page dropdown */}
                <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Rows per page</label>
                  <select
                    value={String(pageSize)}
                    onChange={e => {
                      const v = e.target.value;
                      setPageSize(v === 'all' ? 'all' : (Number(v) as 10 | 20));
                      setPage(1);
                    }}
                    style={{
                      padding: '5px 10px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.text,
                      background: C.card,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map(opt => (
                      <option key={String(opt)} value={String(opt)}>
                        {opt === 'all' ? 'All' : opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Center: page navigation (only when paginating AND more than one page) */}
                {pageSize !== 'all' && totalPages > 1 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" onClick={() => setPage(1)} disabled={page === 1} style={s.pageBtn}>«</button>
                    <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={s.pageBtn}>‹</button>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.primary,
                      padding: '4px 10px',
                      background: '#eef2ff',
                      borderRadius: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}>{page} / {totalPages}</span>
                    <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={s.pageBtn}>›</button>
                    <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={s.pageBtn}>»</button>
                  </div>
                ) : (
                  <div />
                )}

                {/* Right: range / total count */}
                <span style={{ justifySelf: 'end', fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {pageSize !== 'all' && totalPages > 1
                    ? `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, activeCategories.length)} of ${activeCategories.length}`
                    : `${activeCategories.length} ${activeCategories.length === 1 ? 'category' : 'categories'}`}
                </span>
              </div>
            )}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function CellMoneyInput({ value, onChange, onEnter, onEscape }: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  onEscape?: () => void;
}) {
  return (
    <div className="occ-money-wrap" style={s.cellMoneyWrap}>
      <span style={s.cellMoneyPrefix}>RM</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        placeholder=""
        inputMode="decimal"
        style={s.cellMoneyInput}
        onKeyDown={e => {
          if (e.key === 'Enter' && onEnter) onEnter();
          if (e.key === 'Escape' && onEscape) onEscape();
        }}
      />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', maxWidth: 980, margin: '0 auto', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
  title: { fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: C.muted, margin: 0 },
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  sidebarCard: {
    width: 240, flexShrink: 0, background: C.card, borderRadius: 14,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)', overflow: 'hidden',
    position: 'sticky' as const, top: 28, border: `1px solid #eef0f4`,
  },
  sidebarHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
    fontSize: 10, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  },
  tabNav: { display: 'flex', flexDirection: 'column' as const, gap: 2, padding: 8 },
  tabBtn: {
    display: 'flex', alignItems: 'center', padding: '8px 10px 8px 0', fontSize: 13, fontWeight: 500,
    color: C.text, background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
    textAlign: 'left' as const, fontFamily: 'inherit', transition: 'all 0.1s', width: '100%',
  },
  tabBtnActive: { background: '#eef0fa', color: C.primary, fontWeight: 600 },
  content: { flex: 1, minWidth: 0 },
  contentCard: { background: C.card, borderRadius: 14, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)', border: `1px solid #eef0f4`, overflow: 'hidden' },
  contentHeader: { padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  contentToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14 },
  headerRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  contentTitle: { fontSize: 15, fontWeight: 700, color: C.text, margin: 0 },
  contentSub: { fontSize: 12, color: C.muted, margin: '2px 0 0' },
  card: { background: C.card, borderRadius: 12, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 },
  input: { padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, fontFamily: 'inherit', outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13, tableLayout: 'fixed' as const },
  th: { padding: '12px 20px', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}`, background: C.card },
  td: { padding: '10px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, verticalAlign: 'middle' as const },
  moneyCell: { fontVariantNumeric: 'tabular-nums' as const, color: C.text, fontWeight: 600 },
  dashCell: { color: '#cbd5e1' },
  // Inputs use negative margin so their interior text lines up with the display-span
  // position, preventing a visible text shift when entering edit mode.
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
  cellMoneyWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: 'calc(100% + 22px)',
    margin: '-7px -11px',
    padding: '6px 10px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: C.card,
    boxSizing: 'border-box' as const,
    justifyContent: 'flex-end',
  },
  cellMoneyPrefix: { fontSize: 12, color: C.muted, fontWeight: 600 },
  cellMoneyInput: {
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    color: C.text,
    fontFamily: 'inherit',
    outline: 'none',
    textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums' as const,
    padding: 0,
    minWidth: 0,
    flex: 1,
  },
  primaryBtn: { background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', height: 36, display: 'inline-flex', alignItems: 'center' },
  secondaryBtn: { background: C.card, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', height: 36, cursor: 'pointer' },
  iconBtn: { background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 8, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  iconBtnGreen: { background: '#ecfdf5', border: `1px solid #a7f3d0`, color: '#059669', cursor: 'pointer', padding: 8, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#cbd5e1', fontSize: 13, textAlign: 'center' as const, padding: '24px 0', margin: 0 },
  pageBtn: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: C.muted, cursor: 'pointer', fontFamily: 'inherit', minWidth: 28 },
};

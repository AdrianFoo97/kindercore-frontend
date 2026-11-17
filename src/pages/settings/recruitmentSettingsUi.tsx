import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPen, faEllipsisVertical, faGripVertical } from '@fortawesome/free-solid-svg-icons';

// Settings → Recruitment: the palette, styles and row controls its editors share.

export const C = {
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  border: '#e2e8f0',
  borderSoft: '#eef0f3',
  bg: '#f8fafc',
  surface: '#ffffff',
  primary: '#5a67d8',
  primaryDeep: '#3c339a',
  primarySoft: '#eef2ff',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
};

// ─── Drag-to-reorder ─────────────────────────────────────────────────────────
// Same grip-only drag mechanics as DepartmentsPage — no up/down arrow
// buttons. Reorders local draft state; persisted on the next Save.
export function useDragReorder<T>(setItems: React.Dispatch<React.SetStateAction<T[]>>, enabled: boolean) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below' | null>(null);

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    if (!enabled) return;
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIdx(idx);
  };
  const onDragOver = (idx: number) => (e: React.DragEvent<HTMLElement>) => {
    if (!enabled || draggedIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const pos: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    if (dragOverIdx !== idx || dragOverPos !== pos) { setDragOverIdx(idx); setDragOverPos(pos); }
  };
  const onDragEnd = () => { setDraggedIdx(null); setDragOverIdx(null); setDragOverPos(null); };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIdx === null) { onDragEnd(); return; }
    let insertIdx = dragOverPos === 'below' ? idx + 1 : idx;
    if (draggedIdx < insertIdx) insertIdx--;
    const from = draggedIdx;
    onDragEnd();
    if (insertIdx === from) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(insertIdx, 0, moved);
      return next;
    });
  };

  const rowStyle = (idx: number): React.CSSProperties => {
    const isDragging = draggedIdx === idx;
    const isDropTarget = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;
    // Only include border keys when actually needed — spreading an
    // explicit `undefined` value still overwrites the base row style's
    // borderBottom divider, silently erasing it on every render.
    const style: React.CSSProperties = { opacity: isDragging ? 0.4 : 1 };
    if (isDropTarget && dragOverPos === 'above') style.borderTop = `2px solid ${C.primary}`;
    if (isDropTarget && dragOverPos === 'below') style.borderBottom = `2px solid ${C.primary}`;
    return style;
  };

  return { onDragStart, onDragOver, onDragEnd, onDrop, rowStyle };
}

export function DragGrip({ idx, enabled, reorder }: { idx: number; enabled: boolean; reorder: ReturnType<typeof useDragReorder> }) {
  return (
    <span
      draggable={enabled}
      onDragStart={reorder.onDragStart(idx)}
      onDragEnd={reorder.onDragEnd}
      title={enabled ? 'Drag to reorder' : undefined}
      className="recruit-grip"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, flexShrink: 0, color: C.muted, fontSize: 12, borderRadius: 4,
        cursor: enabled ? 'grab' : 'default', transition: 'color 0.12s, background 0.12s',
      }}
    >
      <FontAwesomeIcon icon={faGripVertical} />
    </span>
  );
}

// ─── Row menu ────────────────────────────────────────────────────────────────
// Same "…" kebab → Rename/Delete dropdown as DepartmentsPage. Rows display
// as plain text; clicking Rename swaps the row into an editable input with
// Save/Cancel, instead of every row being permanently an open text field.
export function RowMenu({ onRename, onDelete, renameLabel = 'Rename' }: {
  onRename: () => void; onDelete?: () => void; renameLabel?: string;
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
      <button ref={btnRef} type="button" className="recruit-menu-btn" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} style={S.menuBtn} aria-label="More actions" title="More actions">
        <FontAwesomeIcon icon={faEllipsisVertical} style={{ fontSize: 14 }} />
      </button>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} style={{ ...S.menu, top: pos.top, left: pos.left }}>
          <button type="button" className="recruit-menu-rename" style={S.menuItem} onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(); }}>
            <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, width: 14, color: C.muted }} />
            {renameLabel}
          </button>
          {onDelete && (
            <button type="button" className="recruit-menu-danger" style={{ ...S.menuItem, color: C.danger }} onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}>
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11, width: 14 }} />
              Delete
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

export const S = {
  page: { background: C.bg, minHeight: '100%', padding: '24px 16px' } as React.CSSProperties,
  inner: { maxWidth: 760, margin: '0 auto' } as React.CSSProperties,
  state: { padding: 24, color: C.muted } as React.CSSProperties,
  heading: { fontSize: 24, fontWeight: 700, margin: '8px 0 4px', color: C.text } as React.CSSProperties,
  sub: { fontSize: 14, color: C.muted, margin: '0 0 18px', lineHeight: 1.55 } as React.CSSProperties,
  readonly: {
    background: '#fffbeb', color: '#92400e', padding: '8px 12px',
    borderRadius: 8, fontSize: 13, marginBottom: 12,
  } as React.CSSProperties,
  card: {
    background: C.surface, border: '1px solid #eef0f4', borderRadius: 14,
    padding: '22px 26px', marginBottom: 20,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  } as React.CSSProperties,
  cardHeader: { marginBottom: 12 } as React.CSSProperties,
  cardTitleWrap: { display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
  cardTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: C.text } as React.CSSProperties,
  cardDesc: { fontSize: 13, color: C.muted, margin: '4px 0 0' } as React.CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 700, color: C.text, margin: 0 } as React.CSSProperties,
  addBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600,
    borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: 'pointer',
  } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as React.CSSProperties,
  th: {
    textAlign: 'left' as const, padding: '8px 12px', fontWeight: 600, fontSize: 11, color: C.muted,
    letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: C.text,
    height: 48, verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  cellInput: {
    display: 'block', width: '100%', padding: '7px 10px',
    border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, fontSize: 13, color: C.text,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  menuBtn: {
    background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: '6px 8px', borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms ease, color 120ms ease',
  } as React.CSSProperties,
  menu: {
    position: 'fixed' as const, zIndex: 9999, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06)', width: 168, overflow: 'hidden', padding: '4px 0',
  } as React.CSSProperties,
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', fontSize: 13, fontWeight: 500,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit', color: C.text,
  } as React.CSSProperties,
  saveIconBtn: {
    background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', cursor: 'pointer', padding: 8, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  cancelIconBtn: {
    background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 8, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  dash: { color: C.muted, fontSize: 14 } as React.CSSProperties,
  saveRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  dirtyHint: { fontSize: 12, color: C.muted } as React.CSSProperties,
  saveBtn: (active: boolean): React.CSSProperties => ({
    background: active ? C.primary : '#cbd5e1', color: '#fff',
    border: 'none', padding: '8px 16px', borderRadius: 8,
    fontSize: 13, fontWeight: 600,
    cursor: active ? 'pointer' : 'default',
  }),
};

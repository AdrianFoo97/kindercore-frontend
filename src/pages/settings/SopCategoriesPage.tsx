import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faGripVertical, faCheck, faXmark, faTag } from '@fortawesome/free-solid-svg-icons';
import {
  fetchCategories, createCategory, updateCategory, deleteCategory, reorderCategories,
  SopCategory, CATEGORY_COLOR_PALETTE,
} from '../../api/sop-categories.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  danger: '#dc2626',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

export default function SopCategoriesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data: categories = [], isLoading } = useQuery({ queryKey: ['sop-categories'], queryFn: () => fetchCategories() });
  const sorted = useMemo(() => [...categories].sort((a, b) => a.displayOrder - b.displayOrder), [categories]);

  // "Adding" and "editing an existing row" share one inline form — only one
  // can be open at a time, keyed by editingId (null while adding new).
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [colorDraft, setColorDraft] = useState(CATEGORY_COLOR_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sop-categories'] });

  const startAdd = () => {
    setEditingId(null);
    setNameDraft('');
    const usedColors = sorted.map(c => c.color);
    const firstAvailable = CATEGORY_COLOR_PALETTE.find(c => !usedColors.includes(c))
      ?? CATEGORY_COLOR_PALETTE[sorted.length % CATEGORY_COLOR_PALETTE.length];
    setColorDraft(firstAvailable);
    setFormOpen(true);
  };
  const startEdit = (cat: SopCategory) => {
    setEditingId(cat.id);
    setNameDraft(cat.name);
    setColorDraft(cat.color);
    setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const submit = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateCategory(editingId, { name, color: colorDraft });
        showToast('Category updated');
      } else {
        await createCategory(name, colorDraft);
        showToast('Category added');
      }
      invalidate();
      closeForm();
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (cat: SopCategory) => {
    await confirm({
      entityType: 'Category',
      entityName: cat.name,
      consequence: 'Any How-To Guides currently labelled with this category will simply lose that label — nothing else is affected.',
      actionLabel: 'Delete',
      onConfirm: async () => {
        await deleteCategory(cat.id);
        invalidate();
        showToast('Category deleted');
      },
    });
  };

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropId !== id) setDropId(id);
  };
  const onDragEnd = () => { setDragId(null); setDropId(null); };
  const onDrop = (targetId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { onDragEnd(); return; }
    const ids = sorted.map(c => c.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const reordered = [...ids];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onDragEnd();
    try {
      await reorderCategories(reordered);
      invalidate();
    } catch (err: any) {
      showToast(err?.message ?? 'Reorder failed', 'error');
    }
  };

  return (
    <div style={embedded ? undefined : s.page}>
      <div style={embedded ? undefined : s.inner}>
        {!embedded && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={s.heading}>How-To Guide Categories</h1>
            <p style={s.subheading}>
              Labels used to organize How-To Guides — a guide can carry several. Assigned from each guide's own page;
              managed here.
            </p>
          </div>
        )}

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Categories</h3>
              <div style={s.cardSub}>
                {sorted.length === 0 ? 'No categories yet' : `${sorted.length} categor${sorted.length === 1 ? 'y' : 'ies'} · drag to reorder`}
              </div>
            </div>
            {!formOpen && (
              <button onClick={startAdd} style={s.primaryBtn}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                Add category
              </button>
            )}
          </div>

          {formOpen && (
            <CategoryForm
              // Forces a remount when the edit target changes, so the
              // form's internal hexDraft state re-seeds from the new
              // category's color instead of keeping whatever the
              // previously-open row left behind (same fix as StepDrawer).
              key={editingId ?? 'new'}
              isEdit={!!editingId}
              name={nameDraft}
              color={colorDraft}
              // Once a swatch is already in use by another category, drop it
              // from the pick list — the whole point of the palette is to
              // keep labels visually distinct, so offering an already-taken
              // color just invites two categories that look the same.
              usedColors={sorted.filter(c => c.id !== editingId).map(c => c.color)}
              saving={saving}
              onNameChange={setNameDraft}
              onColorChange={setColorDraft}
              onSubmit={submit}
              onCancel={closeForm}
            />
          )}

          {isLoading ? (
            <p style={{ padding: 24, color: C.mutedSoft, fontSize: 13 }}>Loading…</p>
          ) : sorted.length === 0 && !formOpen ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <FontAwesomeIcon icon={faTag} style={{ fontSize: 20, color: C.mutedSoft, marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No categories configured yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: formOpen ? 14 : 0 }}>
              {sorted.map(cat => {
                if (cat.id === editingId) return null;
                const isDrag = dragId === cat.id;
                const isDrop = dropId === cat.id && dragId !== cat.id;
                return (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={onDragStart(cat.id)}
                    onDragOver={onDragOver(cat.id)}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop(cat.id)}
                    style={{
                      ...s.row,
                      opacity: isDrag ? 0.45 : 1,
                      borderColor: isDrop ? C.primary : C.cardBorder,
                      boxShadow: isDrop ? '0 0 0 3px rgba(90,103,216,0.15)' : undefined,
                    }}
                  >
                    <div style={s.dragHandle}>
                      <FontAwesomeIcon icon={faGripVertical} />
                    </div>
                    <span style={{ ...s.colorDot, background: cat.color }} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.text }}>{cat.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => startEdit(cat)} style={s.iconBtn} aria-label="Edit category">
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button onClick={() => onDelete(cat)} style={{ ...s.iconBtn, color: C.danger }} aria-label="Delete category">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function CategoryForm({ isEdit, name, color, usedColors, saving, onNameChange, onColorChange, onSubmit, onCancel }: {
  isEdit: boolean;
  name: string;
  color: string;
  usedColors: string[];
  saving: boolean;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const availableSwatches = CATEGORY_COLOR_PALETTE.filter(c => !usedColors.includes(c) || c === color);
  const [hexDraft, setHexDraft] = useState(color);
  const hexValid = HEX_RE.test(hexDraft);

  return (
    <div style={s.formBox}>
      <input
        autoFocus
        type="text"
        value={name}
        disabled={saving}
        onChange={e => onNameChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="e.g. Warehouse"
        style={{ ...s.input, width: '100%' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' as const }}>
        {availableSwatches.length > 0 ? (
          <div style={{ display: 'flex', gap: 6 }}>
            {availableSwatches.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { onColorChange(c); setHexDraft(c); }}
                aria-label={c}
                style={{
                  width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '2px solid #fff' : `2px solid ${C.cardBorder}`,
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 11.5, color: C.mutedSoft, fontStyle: 'italic' }}>All preset colors are taken — pick a custom one:</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Native picker — any color, not just the preset swatches. */}
          <input
            type="color"
            value={hexValid ? hexDraft : color}
            onChange={e => { onColorChange(e.target.value); setHexDraft(e.target.value); }}
            title="Pick a custom color"
            style={s.colorPicker}
          />
          <input
            type="text"
            value={hexDraft}
            onChange={e => {
              const v = e.target.value;
              setHexDraft(v);
              if (HEX_RE.test(v)) onColorChange(v);
            }}
            onBlur={() => setHexDraft(color)}
            placeholder="#5a67d8"
            maxLength={7}
            style={{ ...s.input, width: 90, fontFamily: 'ui-monospace, SFMono-Regular, monospace', ...(hexDraft !== '' && !hexValid ? { borderColor: C.danger } : {}) }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <button onClick={onSubmit} disabled={!name.trim() || saving} style={{ ...s.saveBtn, opacity: !name.trim() || saving ? 0.5 : 1 }}>
          <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5, fontSize: 10 }} />
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add category'}
        </button>
        <button onClick={onCancel} disabled={saving} style={s.cancelBtn}>
          <FontAwesomeIcon icon={faXmark} style={{ marginRight: 5, fontSize: 10 }} />
          Cancel
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 900, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5, maxWidth: 620 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW,
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' as const },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 10, background: '#fff',
    transition: 'box-shadow 120ms ease, border-color 120ms ease',
  },
  dragHandle: { cursor: 'grab', fontSize: 13, color: C.mutedSoft, flexShrink: 0 },
  colorDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  iconBtn: {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11.5,
  },
  formBox: {
    padding: 14, background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 10, marginBottom: 4,
  },
  input: {
    padding: '9px 11px', fontSize: 13, border: `1px solid ${C.cardBorder}`,
    borderRadius: 8, outline: 'none', color: C.text, boxSizing: 'border-box' as const, background: '#fff',
  },
  colorPicker: {
    width: 32, height: 32, padding: 2, border: `1px solid ${C.cardBorder}`,
    borderRadius: 8, cursor: 'pointer', background: '#fff',
  },
  saveBtn: {
    padding: '7px 14px', borderRadius: 7, border: 'none', background: C.primary,
    color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  cancelBtn: {
    padding: '7px 14px', borderRadius: 7, border: `1px solid ${C.cardBorder}`, background: '#fff',
    color: C.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
};

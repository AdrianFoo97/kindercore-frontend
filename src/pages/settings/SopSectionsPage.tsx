import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faGripVertical, faCheck, faXmark, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import {
  fetchSections, createSection, updateSection, deleteSection, reorderSections, SopSection,
} from '../../api/sop-sections.js';
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

export default function SopSectionsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data: sections = [], isLoading } = useQuery({ queryKey: ['sop-sections'], queryFn: () => fetchSections() });
  const sorted = useMemo(() => [...sections].sort((a, b) => a.displayOrder - b.displayOrder), [sections]);

  // "Adding" and "editing an existing row" share one inline form — only one
  // can be open at a time, keyed by editingId (null while adding new).
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sop-sections'] });

  const startAdd = () => { setEditingId(null); setNameDraft(''); setFormOpen(true); };
  const startEdit = (sec: SopSection) => { setEditingId(sec.id); setNameDraft(sec.name); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const submit = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateSection(editingId, name);
        showToast('Section updated');
      } else {
        await createSection(name);
        showToast('Section added');
      }
      invalidate();
      closeForm();
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (sec: SopSection) => {
    await confirm({
      entityType: 'Section',
      entityName: sec.name,
      consequence: 'Steps that already used this section keep their text as-is — it just stops showing up as a choice for new steps.',
      actionLabel: 'Delete',
      onConfirm: async () => {
        await deleteSection(sec.id);
        invalidate();
        showToast('Section deleted');
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
    const ids = sorted.map(s => s.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const reordered = [...ids];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onDragEnd();
    try {
      await reorderSections(reordered);
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
            <h1 style={s.heading}>How-To Guide Sections</h1>
            <p style={s.subheading}>
              The group headings a step can belong to (e.g. "Pre-shift Preparation", "Main Process") — shared across every
              guide, so the same grouping means the same thing everywhere. Picked from this list when adding a step;
              managed here.
            </p>
          </div>
        )}

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Sections</h3>
              <div style={s.cardSub}>
                {sorted.length === 0 ? 'No sections yet' : `${sorted.length} section${sorted.length === 1 ? '' : 's'} · drag to reorder`}
              </div>
            </div>
            {!formOpen && (
              <button onClick={startAdd} style={s.primaryBtn}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                Add section
              </button>
            )}
          </div>

          {formOpen && (
            <SectionForm
              key={editingId ?? 'new'}
              isEdit={!!editingId}
              name={nameDraft}
              saving={saving}
              onNameChange={setNameDraft}
              onSubmit={submit}
              onCancel={closeForm}
            />
          )}

          {isLoading ? (
            <p style={{ padding: 24, color: C.mutedSoft, fontSize: 13 }}>Loading…</p>
          ) : sorted.length === 0 && !formOpen ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: 20, color: C.mutedSoft, marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No sections configured yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: formOpen ? 14 : 0 }}>
              {sorted.map(sec => {
                if (sec.id === editingId) return null;
                const isDrag = dragId === sec.id;
                const isDrop = dropId === sec.id && dragId !== sec.id;
                return (
                  <div
                    key={sec.id}
                    draggable
                    onDragStart={onDragStart(sec.id)}
                    onDragOver={onDragOver(sec.id)}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop(sec.id)}
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
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.text }}>{sec.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => startEdit(sec)} style={s.iconBtn} aria-label="Edit section">
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button onClick={() => onDelete(sec)} style={{ ...s.iconBtn, color: C.danger }} aria-label="Delete section">
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

function SectionForm({ isEdit, name, saving, onNameChange, onSubmit, onCancel }: {
  isEdit: boolean;
  name: string;
  saving: boolean;
  onNameChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={s.formBox}>
      <input
        autoFocus
        type="text"
        value={name}
        disabled={saving}
        onChange={e => onNameChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="e.g. Main Process"
        style={{ ...s.input, width: '100%' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <button onClick={onSubmit} disabled={!name.trim() || saving} style={{ ...s.saveBtn, opacity: !name.trim() || saving ? 0.5 : 1 }}>
          <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5, fontSize: 10 }} />
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add section'}
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
  saveBtn: {
    padding: '7px 14px', borderRadius: 7, border: 'none', background: C.primary,
    color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  cancelBtn: {
    padding: '7px 14px', borderRadius: 7, border: `1px solid ${C.cardBorder}`, background: '#fff',
    color: C.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
};

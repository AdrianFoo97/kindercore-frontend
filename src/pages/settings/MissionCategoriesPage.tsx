import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faGripVertical, faTimes, faCheck, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import {
  fetchMissionCategories, createMissionCategory, updateMissionCategory,
  deleteMissionCategory, reorderMissionCategories,
  MissionCategoryRecord, ALLOWED_ICONS, COLOR_PALETTE,
} from '../../api/mission-categories.js';
import { resolveCategoryIcon } from '../../utils/missionCategoryIcons.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  divider: '#eef0f3',
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
const RADIUS_SM = 8;
const SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.05)';

export default function MissionCategoriesPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['mission-categories'],
    queryFn: fetchMissionCategories,
  });
  const sorted = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder), [categories]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MissionCategoryRecord | null>(null);
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [dropCode, setDropCode] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['mission-categories'] });

  const onSave = async (payload: any, isEdit: boolean) => {
    try {
      if (isEdit) {
        await updateMissionCategory(editing!.code, payload);
        showToast('Category updated');
      } else {
        await createMissionCategory(payload);
        showToast('Category added');
      }
      invalidate();
      setEditorOpen(false); setEditing(null);
    } catch (e: any) {
      const msg = (() => { try { return JSON.parse(e?.message)?.message ?? e.message; } catch { return e?.message ?? 'Save failed'; } })();
      showToast(msg, 'error');
      throw e;
    }
  };

  const onDelete = async (cat: MissionCategoryRecord) => {
    await confirm({
      entityType: 'Category',
      entityName: cat.name,
      consequence: 'The category will be permanently removed.',
      blockedHint: 'Reassign or delete those missions first, then try again.',
      onConfirm: async () => {
        try {
          await deleteMissionCategory(cat.code);
          invalidate();
          showToast('Category deleted');
        } catch (e: any) {
          const msg = (() => { try { return JSON.parse(e?.message)?.message ?? e.message; } catch { return e?.message ?? 'Delete failed'; } })();
          showToast(msg, 'error');
          throw e;
        }
      },
    });
  };

  const onDragStart = (code: string) => (e: React.DragEvent) => {
    setDragCode(code);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (code: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropCode !== code) setDropCode(code);
  };
  const onDragEnd = () => { setDragCode(null); setDropCode(null); };
  const onDrop = (target: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragCode || dragCode === target) { onDragEnd(); return; }
    const codes = sorted.map(c => c.code);
    const fromIdx = codes.indexOf(dragCode);
    const toIdx = codes.indexOf(target);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const reordered = [...codes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onDragEnd();
    try {
      await reorderMissionCategories(reordered);
      invalidate();
    } catch (err: any) {
      showToast(err?.message ?? 'Reorder failed', 'error');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={s.heading}>Mission Categories</h1>
          <p style={s.subheading}>
            Capability buckets that drive achievement badges on the teacher career page.
            Each category has a code (used by missions) and an achievement name (shown to teachers).
          </p>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Categories</h3>
              <div style={s.cardSub}>
                {sorted.length === 0 ? 'No categories yet' : `${sorted.length} categor${sorted.length === 1 ? 'y' : 'ies'} · drag to reorder`}
              </div>
            </div>
            <button
              onClick={() => { setEditing(null); setEditorOpen(true); }}
              style={s.primaryBtn}
            >
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              Add category
            </button>
          </div>

          {isLoading ? (
            <p style={{ padding: 24, color: C.mutedSoft, fontSize: 13 }}>Loading…</p>
          ) : sorted.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No categories configured yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sorted.map(cat => {
                const icon = resolveCategoryIcon(cat.icon);
                const isDrag = dragCode === cat.code;
                const isDrop = dropCode === cat.code && dragCode !== cat.code;
                return (
                  <div
                    key={cat.code}
                    draggable
                    onDragStart={onDragStart(cat.code)}
                    onDragOver={onDragOver(cat.code)}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop(cat.code)}
                    style={{
                      ...s.row,
                      opacity: isDrag ? 0.45 : 1,
                      borderColor: isDrop ? C.primary : C.cardBorder,
                      boxShadow: isDrop ? '0 0 0 3px rgba(90,103,216,0.15)' : 'none',
                    }}
                  >
                    <div style={s.dragHandle}>
                      <FontAwesomeIcon icon={faGripVertical} />
                    </div>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${cat.color}24`, color: cat.color, fontSize: 16, flexShrink: 0,
                    }}>
                      <FontAwesomeIcon icon={icon} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                          {cat.name}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: '#f1f5f9', color: C.muted,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        }}>{cat.code}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                        Achievement: <strong style={{ color: C.textSub, fontWeight: 600 }}>{cat.achievementName}</strong>
                      </div>
                      {cat.description && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: C.mutedSoft, lineHeight: 1.5 }}>
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => { setEditing(cat); setEditorOpen(true); }}
                        style={s.iconBtn}
                        aria-label="Edit"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        onClick={() => onDelete(cat)}
                        style={{ ...s.iconBtn, color: C.danger }}
                        aria-label="Delete"
                      >
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

      {editorOpen && (
        <CategoryEditorModal
          category={editing}
          onCancel={() => { setEditorOpen(false); setEditing(null); }}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function CategoryEditorModal({
  category, onCancel, onSave,
}: {
  category: MissionCategoryRecord | null;
  onCancel: () => void;
  onSave: (payload: any, isEdit: boolean) => Promise<void>;
}) {
  const [code, setCode] = useState(category?.code ?? '');
  const [name, setName] = useState(category?.name ?? '');
  const [achievementName, setAchievementName] = useState(category?.achievementName ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [icon, setIcon] = useState<string>(category?.icon ?? ALLOWED_ICONS[0]);
  const [color, setColor] = useState(category?.color ?? COLOR_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  const isEdit = !!category;

  const submit = async () => {
    if (!name.trim() || !achievementName.trim()) return;
    if (!isEdit && !/^[A-Z0-9_]+$/.test(code)) return;
    setSaving(true);
    try {
      await onSave({
        code: isEdit ? category!.code : code.trim().toUpperCase(),
        name: name.trim(),
        achievementName: achievementName.trim(),
        description: description.trim() || null,
        icon, color,
      }, isEdit);
    } catch { /* error already toasted */ }
    finally { setSaving(false); }
  };

  return ReactDOM.createPortal(
    <div style={modal.overlay} onClick={onCancel}>
      <div style={modal.dialog} onClick={e => e.stopPropagation()}>
        <div style={modal.header}>
          <div>
            <h2 style={modal.title}>{isEdit ? 'Edit category' : 'New category'}</h2>
            <div style={modal.subtitle}>
              {isEdit ? `Editing ${category!.name}` : 'Add a new capability bucket'}
            </div>
          </div>
          <button onClick={onCancel} style={modal.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={modal.body}>
          <div style={modal.row2}>
            <div style={modal.field}>
              <label style={modal.label}>
                Code
                <span style={modal.labelHint}>Uppercase + underscores. Used by missions.</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                disabled={isEdit}
                placeholder="WELLNESS"
                style={{
                  ...modal.input,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  background: isEdit ? '#f8fafc' : '#fff',
                  color: isEdit ? C.muted : C.text,
                }}
              />
            </div>
            <div style={modal.field}>
              <label style={modal.label}>Display name</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Wellness"
                style={modal.input}
              />
            </div>
          </div>

          <div style={modal.field}>
            <label style={modal.label}>
              Achievement name
              <span style={modal.labelHint}>Shown on the teacher's badge ("Wellness Champion").</span>
            </label>
            <input
              type="text"
              value={achievementName}
              onChange={e => setAchievementName(e.target.value)}
              placeholder="Wellness Champion"
              style={modal.input}
            />
          </div>

          <div style={modal.field}>
            <label style={modal.label}>Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Demonstrated commitment to teacher wellbeing."
              style={{ ...modal.input, minHeight: 60, resize: 'vertical' }}
            />
          </div>

          <div style={modal.field}>
            <label style={modal.label}>Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALLOWED_ICONS.map(name => {
                const ic = resolveCategoryIcon(name);
                const active = icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? `${color}24` : '#fff',
                      border: `2px solid ${active ? color : C.cardBorder}`,
                      color: active ? color : C.muted,
                      fontSize: 16, cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <FontAwesomeIcon icon={ic} />
                  </button>
                );
              })}
            </div>
          </div>

          <div style={modal.field}>
            <label style={modal.label}>Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COLOR_PALETTE.map(c => {
                const active = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: c, cursor: 'pointer',
                      border: active ? `3px solid #fff` : `2px solid ${C.cardBorder}`,
                      boxShadow: active
                        ? `0 0 0 2px ${c}, 0 1px 3px rgba(15,23,42,0.15)`
                        : '0 1px 2px rgba(15,23,42,0.06)',
                      transition: 'all 150ms ease',
                    }}
                    aria-label={c}
                  />
                );
              })}
            </div>
          </div>

          {/* Live preview */}
          <div style={{ marginTop: 4, padding: '12px 14px', background: '#fafbfc', border: `1px solid ${C.cardBorder}`, borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Preview
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${color}24`, color, fontSize: 15,
              }}>
                <FontAwesomeIcon icon={resolveCategoryIcon(icon)} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                  {name || 'Display name'}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {achievementName || 'Achievement name'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={modal.footer}>
          <button onClick={onCancel} style={modal.cancelBtn}>Cancel</button>
          <button
            onClick={submit}
            disabled={!name.trim() || !achievementName.trim() || (!isEdit && !/^[A-Z0-9_]+$/.test(code)) || saving}
            style={{ ...modal.saveBtn, opacity: !name.trim() || !achievementName.trim() || (!isEdit && !/^[A-Z0-9_]+$/.test(code)) || saving ? 0.5 : 1 }}
          >
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add category'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5, maxWidth: 720 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '20px 24px', boxShadow: SHADOW, marginBottom: 18,
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
    transition: 'box-shadow 120ms ease, border-color 120ms ease',
  },
  dragHandle: { cursor: 'grab', fontSize: 14, padding: '4px 6px', color: C.mutedSoft },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
};

const modal: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  dialog: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580,
    boxShadow: '0 24px 60px rgba(15,23,42,0.25)',
    maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 14px', borderBottom: `1px solid ${C.divider}`, gap: 12,
  },
  title: { margin: '0 0 2px', fontSize: 17, fontWeight: 700, color: C.text },
  subtitle: { fontSize: 12, color: C.muted },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 14,
  },
  body: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  labelHint: { display: 'block', fontSize: 11, fontWeight: 400, color: C.mutedSoft, marginTop: 2 },
  input: {
    width: '100%', padding: '10px 12px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS_SM,
    outline: 'none', color: C.text, boxSizing: 'border-box',
  },
  row2: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '14px 24px 20px', borderTop: `1px solid ${C.divider}`,
  },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};

import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPen, faGripVertical, faTimes, faCheck,
  faClipboardCheck, faChevronRight, faListCheck,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchTemplates, createTemplate, updateTemplate, deleteTemplate, reorderTemplates,
  SopTemplate, UpsertSopTemplatePayload,
} from '../../api/sop-templates.js';
import { fetchSteps } from '../../api/sop-steps.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';

// ── Design tokens ────────────────────────────────────────────────────────────
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
const PAGE_SIZE = 10;

export default function SopLibraryPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();

  const { data: allTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['sop-templates'],
    queryFn: () => fetchTemplates(),
  });
  const templates = useMemo(
    () => [...allTemplates].sort((a, b) => a.displayOrder - b.displayOrder),
    [allTemplates],
  );

  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(templates.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedTemplates = templates.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Each template's step count, fetched once so the card can show "N steps"
  // without a click-through.
  const { data: stepCounts = {} } = useQuery({
    queryKey: ['sop-step-counts', templates.map(t => t.id).join(',')],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(templates.map(async t => {
        const steps = await fetchSteps(t.id);
        counts[t.id] = steps.length;
      }));
      return counts;
    },
    enabled: templates.length > 0,
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SopTemplate | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sop-templates'] });

  const onSave = async (payload: UpsertSopTemplatePayload) => {
    try {
      if (editing) {
        await updateTemplate(editing.id, payload);
        showToast('SOP updated');
      } else {
        await createTemplate(payload);
        showToast('SOP added');
      }
      invalidate();
      setEditorOpen(false);
      setEditing(null);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    }
  };

  const onDelete = async (t: SopTemplate) => {
    const ok = await confirmDelete({
      entityType: 'SOP',
      entityName: t.title,
      consequence: 'The SOP will be archived. Past observation records against it stay in history (read-only).',
      actionLabel: 'Archive',
      onConfirm: async () => {
        await deleteTemplate(t.id);
        invalidate();
        showToast('SOP archived');
      },
    });
    if (!ok) return;
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
    const ids = templates.map(t => t.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const reordered = [...ids];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onDragEnd();
    try {
      await reorderTemplates(reordered);
      invalidate();
    } catch (err: any) {
      showToast(err?.message ?? 'Reorder failed', 'error');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={s.heading}>SOP Library</h1>
            <p style={s.subheading}>Standard operating procedures staff are observed and certified against — a flat, org-wide library.</p>
          </div>
          <button onClick={() => { setEditing(null); setEditorOpen(true); }} style={s.primaryBtn}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
            Add SOP
          </button>
        </div>

        <div style={s.card}>
          {templatesLoading ? (
            <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
          ) : templates.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted }}>
                No SOPs configured yet.
              </p>
              <button onClick={() => { setEditing(null); setEditorOpen(true); }} style={s.primaryBtnGhost}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                Add the first SOP
              </button>
            </div>
          ) : (
            <>
              <div style={s.cardSub}>{templates.length} SOP{templates.length === 1 ? '' : 's'} · Drag to reorder</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {pagedTemplates.map(t => {
                  const isDrag = dragId === t.id;
                  const isDrop = dropId === t.id && dragId !== t.id;
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={onDragStart(t.id)}
                      onDragOver={onDragOver(t.id)}
                      onDragEnd={onDragEnd}
                      onDrop={onDrop(t.id)}
                      onClick={() => navigate(`/operations/sops/${t.id}`)}
                      style={{
                        ...s.templateRow,
                        opacity: isDrag ? 0.45 : 1,
                        borderColor: isDrop ? C.primary : C.cardBorder,
                        boxShadow: isDrop ? '0 0 0 3px rgba(90,103,216,0.15)' : 'none',
                      }}
                    >
                      <div style={{ ...s.dragHandle, color: C.mutedSoft }} onClick={e => e.stopPropagation()}>
                        <FontAwesomeIcon icon={faGripVertical} />
                      </div>
                      <div style={s.catIconWrap}>
                        <FontAwesomeIcon icon={faClipboardCheck} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.title}</span>
                        {t.goal && <p style={s.templateGoal}>{t.goal}</p>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11.5, color: C.mutedSoft }}>
                          <FontAwesomeIcon icon={faListCheck} style={{ fontSize: 11 }} />
                          {stepCounts[t.id] ?? '…'} step{stepCounts[t.id] === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditing(t); setEditorOpen(true); }} style={s.iconBtn} aria-label="Edit">
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        <button onClick={() => onDelete(t)} style={{ ...s.iconBtn, color: C.danger }} aria-label="Delete">
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                        <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: C.mutedSoft, marginLeft: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <SopPagination page={safePage} pageCount={pageCount} totalCount={templates.length} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      {editorOpen && (
        <SopTemplateEditorModal
          template={editing}
          onCancel={() => { setEditorOpen(false); setEditing(null); }}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function SopPagination({ page, pageCount, totalCount, onPageChange }: {
  page: number;
  pageCount: number;
  totalCount: number;
  onPageChange: (p: number) => void;
}) {
  if (totalCount <= PAGE_SIZE) return null;
  const btn: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 7,
    padding: '5px 11px', fontSize: 12, fontWeight: 600, color: C.muted,
    cursor: 'pointer', minWidth: 30,
  };
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '16px 4px 4px', marginTop: 6, borderTop: `1px solid ${C.divider}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={() => onPageChange(1)} disabled={page === 1} style={btn}>«</button>
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={btn}>‹</button>
        <span style={{
          fontSize: 12, fontWeight: 700, color: C.primary, padding: '5px 14px',
          background: C.primarySoft, borderRadius: 7, fontVariantNumeric: 'tabular-nums',
          minWidth: 52, textAlign: 'center',
        }}>{page} / {pageCount}</span>
        <button type="button" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} style={btn}>›</button>
        <button type="button" onClick={() => onPageChange(pageCount)} disabled={page >= pageCount} style={btn}>»</button>
      </div>
      <span style={{ fontSize: 11, color: C.mutedSoft, fontVariantNumeric: 'tabular-nums' }}>
        {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
      </span>
    </div>
  );
}

// ── Editor modal ─────────────────────────────────────────────────────────────

function SopTemplateEditorModal({
  template,
  onCancel,
  onSave,
}: {
  template: SopTemplate | null;
  onCancel: () => void;
  onSave: (payload: UpsertSopTemplatePayload) => Promise<void>;
}) {
  const [title, setTitle] = useState(template?.title ?? '');
  const [goal, setGoal] = useState(template?.goal ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), goal: goal.trim() || null });
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div style={modalS.overlay} onClick={onCancel}>
      <div style={modalS.dialog} onClick={e => e.stopPropagation()}>
        <div style={modalS.header}>
          <h2 style={modalS.title}>{template ? 'Edit SOP' : 'New SOP'}</h2>
          <button onClick={onCancel} style={modalS.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={modalS.body}>
          <div style={modalS.field}>
            <label style={modalS.label}>Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Picking"
              style={modalS.input}
            />
          </div>

          <div style={modalS.field}>
            <label style={modalS.label}>
              Goal
              <span style={modalS.labelHint}>What does this procedure exist to ensure?</span>
            </label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Confirm inbound QR info, physical QR info, and item batch/quantity/quality all match before completing picking."
              style={{ ...modalS.input, minHeight: 90, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={modalS.footer}>
          <button onClick={onCancel} style={modalS.cancelBtn}>Cancel</button>
          <button
            onClick={submit}
            disabled={!title.trim() || saving}
            style={{ ...modalS.saveBtn, opacity: !title.trim() || saving ? 0.5 : 1 }}
          >
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
            {saving ? 'Saving…' : template ? 'Save changes' : 'Create SOP'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, maxWidth: 620 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW,
  },
  cardSub: { fontSize: 11, color: C.mutedSoft },
  primaryBtn: {
    padding: '9px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  primaryBtnGhost: {
    padding: '8px 16px', borderRadius: 10, border: `1px dashed ${C.primaryBorder}`,
    background: C.primarySoft, color: C.primary, fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  templateRow: {
    display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
    cursor: 'pointer', transition: 'box-shadow 120ms ease, border-color 120ms ease',
  },
  dragHandle: { cursor: 'grab', fontSize: 14, padding: '4px 6px' },
  catIconWrap: {
    width: 36, height: 36, borderRadius: 10, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
    background: C.primarySoft, color: C.primary,
  },
  templateGoal: {
    margin: '4px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
  },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
};

const modalS: Record<string, React.CSSProperties> = {
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
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: C.text },
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
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box',
  },
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

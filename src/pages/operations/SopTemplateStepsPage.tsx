import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPen, faGripVertical, faTimes, faCheck,
  faArrowLeft, faListCheck, faCircleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTemplates } from '../../api/sop-templates.js';
import {
  fetchSteps, createStep, updateStep, deleteStep, reorderSteps,
  SopStep, UpsertSopStepPayload,
} from '../../api/sop-steps.js';
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
const PAGE_SIZE = 10;

export default function SopTemplateStepsPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();

  const { data: allTemplates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const template = allTemplates.find(t => t.id === templateId) ?? null;

  const { data: allSteps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ['sop-steps', templateId],
    queryFn: () => fetchSteps(templateId!),
    enabled: !!templateId,
  });
  const steps = useMemo(
    () => [...allSteps].sort((a, b) => a.displayOrder - b.displayOrder),
    [allSteps],
  );
  const sections = useMemo(() => [...new Set(steps.map(s => s.section))], [steps]);

  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [sectionFilter]);

  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of steps) map.set(s.section, (map.get(s.section) ?? 0) + 1);
    return map;
  }, [steps]);

  const filteredSteps = useMemo(
    () => sectionFilter === 'ALL' ? steps : steps.filter(s => s.section === sectionFilter),
    [steps, sectionFilter],
  );

  // "All sections" clusters steps by section (in first-seen order) rather
  // than raw displayOrder, since displayOrder can interleave sections after
  // reordering — grouped display needs same-section steps adjacent.
  const orderedSteps = useMemo(() => {
    if (sectionFilter !== 'ALL') return filteredSteps;
    const bySection = new Map<string, SopStep[]>();
    for (const s of filteredSteps) {
      if (!bySection.has(s.section)) bySection.set(s.section, []);
      bySection.get(s.section)!.push(s);
    }
    return [...bySection.keys()].flatMap(sec => bySection.get(sec)!);
  }, [filteredSteps, sectionFilter]);

  const pageCount = Math.max(1, Math.ceil(orderedSteps.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedSteps = orderedSteps.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reordering assumes visible order matches true displayOrder — only true
  // when a single section is selected (see CareerMissionSettingsPage for
  // the same tradeoff on category grouping).
  const dragEnabled = sectionFilter !== 'ALL';

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SopStep | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sop-steps', templateId] });

  const onSave = async (payload: UpsertSopStepPayload) => {
    try {
      if (editing) {
        await updateStep(editing.id, payload);
        showToast('Step updated');
      } else {
        await createStep(payload);
        showToast('Step added');
      }
      invalidate();
      setEditorOpen(false);
      setEditing(null);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    }
  };

  const onDelete = async (st: SopStep) => {
    const ok = await confirmDelete({
      entityType: 'Step',
      entityName: st.title,
      consequence: 'The step will be archived. Past observation checklists that recorded it stay in history (read-only).',
      actionLabel: 'Archive',
      onConfirm: async () => {
        await deleteStep(st.id);
        invalidate();
        showToast('Step archived');
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
    if (!dragId || dragId === targetId || !templateId) { onDragEnd(); return; }
    const ids = steps.map(s => s.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const reordered = [...ids];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onDragEnd();
    try {
      await reorderSteps(templateId, reordered);
      invalidate();
    } catch (err: any) {
      showToast(err?.message ?? 'Reorder failed', 'error');
    }
  };

  if (!template) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <div style={{ ...s.card, textAlign: 'center', padding: '64px 32px' }}>
            <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 28, color: C.mutedSoft, marginBottom: 14 }} />
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.text }}>SOP not found</h3>
            <button onClick={() => navigate('/operations/sops')} style={s.primaryBtnGhost}>
              <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} />
              Back to SOP Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <button onClick={() => navigate('/operations/sops')} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
          SOP Library
        </button>

        <div style={{ marginBottom: 24 }}>
          <h1 style={s.heading}>{template.title}</h1>
          {template.goal && <p style={s.subheading}>{template.goal}</p>}
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Steps</h3>
              <div style={s.cardSub}>
                {`${filteredSteps.length} step${filteredSteps.length === 1 ? '' : 's'}${dragEnabled ? ' · Drag to reorder' : ''}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {steps.length > 0 && (
                <select
                  value={sectionFilter}
                  onChange={e => setSectionFilter(e.target.value)}
                  style={s.sectionSelect}
                >
                  <option value="ALL">All sections ({steps.length})</option>
                  {sections.map(sec => (
                    <option key={sec} value={sec}>{sec} ({sectionCounts.get(sec)})</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => { setEditing(null); setEditorOpen(true); }}
                style={s.primaryBtn}
              >
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                Add step
              </button>
            </div>
          </div>

          {stepsLoading ? (
            <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
          ) : filteredSteps.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted }}>
                {steps.length === 0 ? 'No steps configured for this SOP yet.' : 'No steps in this section yet.'}
              </p>
              <button
                onClick={() => { setEditing(null); setEditorOpen(true); }}
                style={s.primaryBtnGhost}
              >
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                {steps.length === 0 ? 'Add the first step' : 'Add a step'}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pagedSteps.map((st, idx) => {
                  const isDrag = dragId === st.id;
                  const isDrop = dropId === st.id && dragId !== st.id;
                  const showHeader = sectionFilter === 'ALL' && (idx === 0 || pagedSteps[idx - 1].section !== st.section);
                  return (
                    <React.Fragment key={st.id}>
                      {showHeader && (
                        <div style={s.sectionGroupHeader}>
                          {st.section}
                          <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                        </div>
                      )}
                      <div
                        draggable={dragEnabled}
                        onDragStart={dragEnabled ? onDragStart(st.id) : undefined}
                        onDragOver={dragEnabled ? onDragOver(st.id) : undefined}
                        onDragEnd={dragEnabled ? onDragEnd : undefined}
                        onDrop={dragEnabled ? onDrop(st.id) : undefined}
                        style={{
                          ...s.stepRow,
                          opacity: isDrag ? 0.45 : 1,
                          borderColor: isDrop ? C.primary : C.cardBorder,
                          boxShadow: isDrop ? '0 0 0 3px rgba(90,103,216,0.15)' : 'none',
                        }}
                      >
                        <div
                          style={{ ...s.dragHandle, color: C.mutedSoft, opacity: dragEnabled ? 1 : 0.3, cursor: dragEnabled ? 'grab' : 'default' }}
                          title={dragEnabled ? undefined : 'Select a single section to reorder'}
                        >
                          <FontAwesomeIcon icon={faGripVertical} />
                        </div>
                        <div style={s.stepIconWrap}>
                          <FontAwesomeIcon icon={faListCheck} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{st.title}</span>
                          {st.detail && (
                            <p style={s.stepDetail}>{st.detail}</p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setEditing(st); setEditorOpen(true); }} style={s.iconBtn} aria-label="Edit">
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                          <button onClick={() => onDelete(st)} style={{ ...s.iconBtn, color: C.danger }} aria-label="Delete">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <StepsPagination page={safePage} pageCount={pageCount} totalCount={orderedSteps.length} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      {editorOpen && templateId && (
        <SopStepEditorModal
          step={editing}
          sopTemplateId={templateId}
          sectionOptions={sections}
          onCancel={() => { setEditorOpen(false); setEditing(null); }}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function StepsPagination({ page, pageCount, totalCount, onPageChange }: {
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

function SopStepEditorModal({
  step,
  sopTemplateId,
  sectionOptions,
  onCancel,
  onSave,
}: {
  step: SopStep | null;
  sopTemplateId: string;
  sectionOptions: string[];
  onCancel: () => void;
  onSave: (payload: UpsertSopStepPayload) => Promise<void>;
}) {
  const [section, setSection] = useState(step?.section ?? sectionOptions[0] ?? '');
  const [title, setTitle] = useState(step?.title ?? '');
  const [detail, setDetail] = useState(step?.detail ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !section.trim()) return;
    setSaving(true);
    try {
      await onSave({
        sopTemplateId,
        section: section.trim(),
        title: title.trim(),
        detail: detail.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div style={modalS.overlay} onClick={onCancel}>
      <div style={modalS.dialog} onClick={e => e.stopPropagation()}>
        <div style={modalS.header}>
          <h2 style={modalS.title}>{step ? 'Edit step' : 'New step'}</h2>
          <button onClick={onCancel} style={modalS.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={modalS.body}>
          <div style={modalS.field}>
            <label style={modalS.label}>
              Section
              <span style={modalS.labelHint}>Groups this step with others under the same label, e.g. "Pre-shift Prep".</span>
            </label>
            <input
              type="text"
              list="sop-section-options"
              value={section}
              onChange={e => setSection(e.target.value)}
              placeholder="e.g. Main Process"
              style={modalS.input}
            />
            <datalist id="sop-section-options">
              {sectionOptions.map(sec => <option key={sec} value={sec} />)}
            </datalist>
          </div>

          <div style={modalS.field}>
            <label style={modalS.label}>Step title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Scan the Picking Task Sheet"
              style={modalS.input}
            />
          </div>

          <div style={modalS.field}>
            <label style={modalS.label}>
              Operation standard
              <span style={modalS.labelHint}>One point per line — shown to the trainer during observation.</span>
            </label>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder={'e.g.\nLog into PDA system → Picking.\nScan the Picking Task Sheet (multiple sheets can be scanned together).'}
              style={{ ...modalS.input, minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div style={modalS.footer}>
          <button onClick={onCancel} style={modalS.cancelBtn}>Cancel</button>
          <button
            onClick={submit}
            disabled={!title.trim() || !section.trim() || saving}
            style={{ ...modalS.saveBtn, opacity: !title.trim() || !section.trim() || saving ? 0.5 : 1 }}
          >
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
            {saving ? 'Saving…' : step ? 'Save changes' : 'Create step'}
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
  backBtn: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 10px', marginBottom: 14,
    border: 'none', background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, maxWidth: 720, lineHeight: 1.6 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW, marginBottom: 20,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, gap: 10, flexWrap: 'wrap',
  },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  primaryBtnGhost: {
    padding: '8px 16px', borderRadius: 10, border: `1px dashed ${C.primaryBorder}`,
    background: C.primarySoft, color: C.primary, fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  sectionSelect: {
    padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontWeight: 600, fontSize: 12.5,
    cursor: 'pointer', outline: 'none',
  },
  sectionGroupHeader: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 2px',
    fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sectionGroupCount: {
    padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
    background: C.divider, color: C.mutedSoft,
  },
  stepRow: {
    display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
    transition: 'box-shadow 120ms ease, border-color 120ms ease',
  },
  dragHandle: { cursor: 'grab', fontSize: 14, padding: '4px 6px' },
  stepIconWrap: {
    width: 36, height: 36, borderRadius: 10, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
    background: C.primarySoft, color: C.primary,
  },
  stepDetail: {
    margin: '6px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5, whiteSpace: 'pre-line' as const,
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
  title: { margin: '0 0 2px', fontSize: 17, fontWeight: 700, color: C.text },
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

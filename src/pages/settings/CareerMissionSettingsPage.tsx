import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPen, faGripVertical, faTimes, faCheck, faCircleExclamation,
  faRoad, faClipboardCheck, faCalendarDays, faPeopleArrows, faStar,
} from '@fortawesome/free-solid-svg-icons';
import { fetchPositions, fetchDepartments } from '../../api/salary.js';
import {
  fetchMissions, createMission, updateMission, deleteMission, reorderMissions,
  CareerMission, MissionCategory, MissionDifficulty, CreateMissionPayload,
} from '../../api/career-missions.js';
import { useCategoryMeta } from '../../utils/missionCategoryIcons.js';
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
  success: '#059669',
  successSoft: '#dcfce7',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

const DIFFICULTY_META: Record<MissionDifficulty, { label: string; color: string }> = {
  BASIC:        { label: 'Basic',        color: '#065f46' },
  INTERMEDIATE: { label: 'Intermediate', color: '#92400e' },
  ADVANCED:     { label: 'Advanced',     color: '#991b1b' },
};
const PAGE_SIZE = 10;

export default function CareerMissionSettingsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();
  const { categories: missionCategories, getMeta } = useCategoryMeta();

  const { data: positions = [], isLoading: positionsLoading } =
    useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const { data: departmentList = [] } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => a.titleWeight - b.titleWeight),
    [positions],
  );

  const [deptFilter, setDeptFilter] = useState<string>('');
  useEffect(() => {
    if (!deptFilter && departmentList.length > 0) setDeptFilter(departmentList[0].departmentId);
  }, [deptFilter, departmentList]);
  const visiblePositions = useMemo(
    () => sortedPositions.filter(p => p.departmentId === deptFilter),
    [sortedPositions, deptFilter],
  );

  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  useEffect(() => {
    if (visiblePositions.length === 0) { setSelectedPositionId(null); return; }
    if (!selectedPositionId || !visiblePositions.some(p => p.positionId === selectedPositionId)) {
      setSelectedPositionId(visiblePositions[0].positionId);
    }
  }, [visiblePositions, selectedPositionId]);

  const { data: allMissions = [], isLoading: missionsLoading } = useQuery({
    queryKey: ['career-missions'],
    queryFn: () => fetchMissions(),
  });
  const missions = useMemo(
    () => allMissions
      .filter(m => m.positionId === selectedPositionId)
      .sort((a, b) => a.displayOrder - b.displayOrder),
    [allMissions, selectedPositionId],
  );

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  useEffect(() => { setCategoryFilter('ALL'); setPage(1); }, [selectedPositionId]);
  useEffect(() => { setPage(1); }, [categoryFilter]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of missions) map.set(m.category, (map.get(m.category) ?? 0) + 1);
    return map;
  }, [missions]);

  const filteredMissions = useMemo(
    () => categoryFilter === 'ALL' ? missions : missions.filter(m => m.category === categoryFilter),
    [missions, categoryFilter],
  );

  // "All categories" clusters missions by category (admin-configured
  // category order) rather than raw displayOrder, since displayOrder can
  // freely interleave categories after reordering — grouped display needs
  // same-category missions adjacent, not just correctly ranked.
  const orderedMissions = useMemo(() => {
    if (categoryFilter !== 'ALL') return filteredMissions;
    const byCategory = new Map<string, CareerMission[]>();
    for (const m of filteredMissions) {
      if (!byCategory.has(m.category)) byCategory.set(m.category, []);
      byCategory.get(m.category)!.push(m);
    }
    const knownCodes = missionCategories.map(c => c.code).filter(code => byCategory.has(code));
    const unknownCodes = [...byCategory.keys()].filter(code => !missionCategories.some(c => c.code === code));
    return [...knownCodes, ...unknownCodes].flatMap(code => byCategory.get(code)!);
  }, [filteredMissions, categoryFilter, missionCategories]);

  const pageCount = Math.max(1, Math.ceil(orderedMissions.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedMissions = orderedMissions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reordering assumes the visible order matches the true displayOrder
  // sequence. That's only true when a single category is selected — the
  // grouped "All categories" view reflows same-category missions together,
  // so a drag there wouldn't land where it visually appears to.
  const dragEnabled = categoryFilter !== 'ALL';

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CareerMission | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['career-missions'] });

  const onSave = async (payload: CreateMissionPayload) => {
    try {
      if (editing) {
        await updateMission(editing.id, payload);
        showToast('Mission updated');
      } else {
        await createMission(payload);
        showToast('Mission added');
      }
      invalidate();
      setEditorOpen(false);
      setEditing(null);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    }
  };

  const onDelete = async (m: CareerMission) => {
    const ok = await confirmDelete({
      entityType: 'Mission',
      entityName: m.title,
      consequence: 'The mission will be archived. Existing teacher progress on this mission stays in their history (read-only).',
      actionLabel: 'Archive',
      onConfirm: async () => {
        await deleteMission(m.id);
        invalidate();
        showToast('Mission archived');
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
    if (!dragId || dragId === targetId || !selectedPositionId) { onDragEnd(); return; }
    const ids = missions.map(m => m.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const reordered = [...ids];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onDragEnd();
    try {
      await reorderMissions(selectedPositionId, reordered);
      invalidate();
    } catch (err: any) {
      showToast(err?.message ?? 'Reorder failed', 'error');
    }
  };

  // ── Empty: no positions exist yet ──
  if (!positionsLoading && positions.length === 0) {
    return (
      <div style={embedded ? undefined : s.page}>
        <div style={embedded ? undefined : s.inner}>
          {!embedded && <h1 style={s.heading}>Career Mission Settings</h1>}
          <div style={{ ...s.card, textAlign: 'center', padding: '64px 32px' }}>
            <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 28, color: C.mutedSoft, marginBottom: 14 }} />
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.text }}>No positions yet</h3>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              Create positions first before configuring career missions.
            </p>
            <a href="/settings/employee-salary" style={{
              display: 'inline-block', marginTop: 16, padding: '8px 16px',
              background: C.primary, color: '#fff', borderRadius: 8,
              textDecoration: 'none', fontSize: 13, fontWeight: 600,
            }}>
              Manage Positions
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={embedded ? undefined : s.page}>
      <div style={embedded ? undefined : s.inner}>
        {!embedded && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={s.heading}>Career Mission Settings</h1>
            <p style={s.subheading}>Define the capability missions a teacher must complete before they can be promoted from each position.</p>
          </div>
        )}

        {/* Department filter */}
        {departmentList.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {departmentList.map(d => (
              <button
                key={d.departmentId}
                onClick={() => setDeptFilter(d.departmentId)}
                style={{ ...s.deptPill, ...(deptFilter === d.departmentId ? s.deptPillActive : {}) }}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}

        {/* Position tabs */}
        <div style={s.tabsCard}>
          <div style={s.tabsRow}>
            {visiblePositions.map(p => {
              const active = p.positionId === selectedPositionId;
              const count = allMissions.filter(m => m.positionId === p.positionId).length;
              return (
                <button
                  key={p.positionId}
                  onClick={() => setSelectedPositionId(p.positionId)}
                  style={{
                    ...s.tab,
                    background: active ? C.primarySoft : 'transparent',
                    color: active ? C.primary : C.textSub,
                    borderColor: active ? C.primaryBorder : 'transparent',
                  }}
                >
                  <span>{p.name}</span>
                  <span style={{
                    marginLeft: 8, padding: '0 8px', borderRadius: 999,
                    fontSize: 10, fontWeight: 700,
                    background: active ? '#fff' : C.divider,
                    color: active ? C.primary : C.muted,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mission list card */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Missions</h3>
              <div style={s.cardSub}>
                {selectedPositionId
                  ? `${filteredMissions.length} mission${filteredMissions.length === 1 ? '' : 's'}${dragEnabled ? ' · Drag to reorder' : ''}`
                  : 'Select a position'}
              </div>
            </div>
            {selectedPositionId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {missions.length > 0 && (
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    style={s.categorySelect}
                  >
                    <option value="ALL">All categories ({missions.length})</option>
                    {missionCategories
                      .filter(c => (categoryCounts.get(c.code) ?? 0) > 0)
                      .map(c => (
                        <option key={c.code} value={c.code}>{c.name} ({categoryCounts.get(c.code)})</option>
                      ))}
                  </select>
                )}
                <button
                  onClick={() => { setEditing(null); setEditorOpen(true); }}
                  style={s.primaryBtn}
                >
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                  Add mission
                </button>
              </div>
            )}
          </div>

          {missionsLoading ? (
            <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
          ) : filteredMissions.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted }}>
                {missions.length === 0
                  ? 'No missions configured for this position yet.'
                  : 'No missions in this category yet.'}
              </p>
              <button
                onClick={() => { setEditing(null); setEditorOpen(true); }}
                style={s.primaryBtnGhost}
              >
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                {missions.length === 0 ? 'Add the first mission' : 'Add a mission'}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pagedMissions.map((m, idx) => {
                  const cat = getMeta(m.category);
                  const diff = DIFFICULTY_META[m.difficulty];
                  const isDrag = dragId === m.id;
                  const isDrop = dropId === m.id && dragId !== m.id;
                  const showHeader = categoryFilter === 'ALL' && (idx === 0 || pagedMissions[idx - 1].category !== m.category);
                  return (
                    <React.Fragment key={m.id}>
                      {showHeader && (
                        <div style={s.categoryGroupHeader}>
                          <FontAwesomeIcon icon={cat.icon} style={{ fontSize: 11, color: cat.color }} />
                          {cat.label}
                          <span style={s.categoryGroupCount}>{categoryCounts.get(m.category) ?? 0}</span>
                        </div>
                      )}
                      <div
                        draggable={dragEnabled}
                        onDragStart={dragEnabled ? onDragStart(m.id) : undefined}
                        onDragOver={dragEnabled ? onDragOver(m.id) : undefined}
                        onDragEnd={dragEnabled ? onDragEnd : undefined}
                        onDrop={dragEnabled ? onDrop(m.id) : undefined}
                        style={{
                          ...s.missionRow,
                          opacity: isDrag ? 0.45 : 1,
                          borderColor: isDrop ? C.primary : C.cardBorder,
                          boxShadow: isDrop ? '0 0 0 3px rgba(90,103,216,0.15)' : 'none',
                        }}
                      >
                        <div
                          style={{ ...s.dragHandle, color: C.mutedSoft, opacity: dragEnabled ? 1 : 0.3, cursor: dragEnabled ? 'grab' : 'default' }}
                          title={dragEnabled ? undefined : 'Select a single category to reorder'}
                        >
                          <FontAwesomeIcon icon={faGripVertical} />
                        </div>
                        <div style={{
                          ...s.catIconWrap,
                          background: cat.bg, color: cat.color,
                        }}>
                          <FontAwesomeIcon icon={cat.icon} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.title}</span>
                            {m.highPriority && (
                              <span style={{ ...s.pill, background: '#fef3c7', color: '#92400e' }}>★ Priority</span>
                            )}
                            <span style={{ ...s.pill, background: cat.bg, color: cat.color }}>{cat.label}</span>
                            <span style={{ ...s.pill, background: '#f1f5f9', color: diff.color }}>{diff.label}</span>
                            {!m.required && (
                              <span style={{ ...s.pill, background: '#f1f5f9', color: C.muted }}>Optional</span>
                            )}
                            {!m.requiresApproval && (
                              <span style={{ ...s.pill, background: '#f1f5f9', color: C.muted }}>Self-verify</span>
                            )}
                          </div>
                          {m.description && (
                            <p style={s.missionDesc}>{m.description}</p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => { setEditing(m); setEditorOpen(true); }}
                            style={s.iconBtn}
                            aria-label="Edit"
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                          <button
                            onClick={() => onDelete(m)}
                            style={{ ...s.iconBtn, color: C.danger }}
                            aria-label="Delete"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <MissionsPagination
                page={safePage}
                pageCount={pageCount}
                totalCount={orderedMissions.length}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      {editorOpen && selectedPositionId && (
        <MissionEditorModal
          mission={editing}
          positionId={selectedPositionId}
          positionName={sortedPositions.find(p => p.positionId === selectedPositionId)?.name ?? ''}
          defaultCategory={!editing && categoryFilter !== 'ALL' ? categoryFilter : undefined}
          onCancel={() => { setEditorOpen(false); setEditing(null); }}
          onSave={onSave}
        />
      )}
    </div>
  );
}

// ── Mission Editor Modal ─────────────────────────────────────────────────────

function MissionEditorModal({
  mission,
  positionId,
  positionName,
  defaultCategory,
  onCancel,
  onSave,
}: {
  mission: CareerMission | null;
  positionId: string;
  positionName: string;
  defaultCategory?: string;
  onCancel: () => void;
  onSave: (payload: CreateMissionPayload) => Promise<void>;
}) {
  const { categories: missionCategories, getMeta } = useCategoryMeta();
  const [title, setTitle] = useState(mission?.title ?? '');
  const [category, setCategory] = useState<MissionCategory>(
    mission?.category ?? defaultCategory ?? missionCategories[0]?.code ?? 'CLASSROOM',
  );
  const [description, setDescription] = useState(mission?.description ?? '');
  const [whyItMatters, setWhyItMatters] = useState(mission?.whyItMatters ?? '');
  const [difficulty, setDifficulty] = useState<MissionDifficulty>(mission?.difficulty ?? 'BASIC');
  const [evidenceRequirements, setEvidenceRequirements] = useState(mission?.evidenceRequirements ?? '');
  const [required, setRequired] = useState(mission?.required ?? true);
  const [highPriority, setHighPriority] = useState(mission?.highPriority ?? false);
  const [requiresApproval, setRequiresApproval] = useState(mission?.requiresApproval ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        positionId,
        title: title.trim(),
        category,
        description: description.trim() || null,
        whyItMatters: whyItMatters.trim() || null,
        difficulty,
        evidenceRequirements: evidenceRequirements.trim() || null,
        required,
        highPriority,
        requiresApproval,
      });
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div style={modalS.overlay} onClick={onCancel}>
      <div style={modalS.dialog} onClick={e => e.stopPropagation()}>
        <div style={modalS.header}>
          <div>
            <h2 style={modalS.title}>{mission ? 'Edit mission' : 'New mission'}</h2>
            <div style={modalS.subtitle}>For position <strong>{positionName}</strong></div>
          </div>
          <button onClick={onCancel} style={modalS.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={modalS.body}>
          <div style={modalS.field}>
            <label style={modalS.label}>Mission title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Organize Sports Day"
              style={modalS.input}
            />
          </div>

          <div style={modalS.row2}>
            <div style={modalS.field}>
              <label style={modalS.label}>Category</label>
              <div style={modalS.chipRow}>
                {missionCategories.map(c => {
                  const meta = getMeta(c.code);
                  const active = category === c.code;
                  return (
                    <button
                      key={c.code}
                      onClick={() => setCategory(c.code)}
                      type="button"
                      style={{
                        ...modalS.chip,
                        background: active ? meta.bg : '#fff',
                        color: active ? meta.color : C.muted,
                        borderColor: active ? meta.color : C.cardBorder,
                      }}
                    >
                      <FontAwesomeIcon icon={meta.icon} style={{ marginRight: 6, fontSize: 11 }} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={modalS.field}>
            <label style={modalS.label}>Difficulty</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['BASIC', 'INTERMEDIATE', 'ADVANCED'] as MissionDifficulty[]).map(d => {
                const meta = DIFFICULTY_META[d];
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    style={{
                      ...modalS.segBtn,
                      background: active ? meta.color : '#fff',
                      color: active ? '#fff' : meta.color,
                      borderColor: meta.color,
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={modalS.field}>
            <label style={modalS.label}>
              Description
              <span style={modalS.labelHint}>What does success look like? Context, scope, examples.</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Plan and lead a full lesson independently with supervisor observation."
              style={{ ...modalS.input, minHeight: 70, resize: 'vertical' }}
            />
          </div>

          <div style={modalS.field}>
            <label style={modalS.label}>
              Why it matters
              <span style={modalS.labelHint}>Promotion rationale shown on the teacher's mission card. Why does completing this earn the next position?</span>
            </label>
            <textarea
              value={whyItMatters}
              onChange={e => setWhyItMatters(e.target.value)}
              placeholder="e.g. Independent lesson delivery is the single biggest gap between Junior and Senior."
              style={{ ...modalS.input, minHeight: 70, resize: 'vertical' }}
            />
          </div>

          <div style={modalS.field}>
            <label style={modalS.label}>
              Evidence requirements
              <span style={modalS.labelHint}>One per line — these become checklist items the teacher must submit.</span>
            </label>
            <textarea
              value={evidenceRequirements}
              onChange={e => setEvidenceRequirements(e.target.value)}
              placeholder={'e.g.\nEvent plan\nPhoto of activity\nFeedback summary'}
              style={{ ...modalS.input, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={modalS.row2}>
            <CheckRow
              label="Required for promotion"
              hint="Mission must be completed for this position's promotion."
              checked={required}
              onChange={setRequired}
            />
            <CheckRow
              label="High priority"
              hint="Pulls the mission to the top of the teacher's board with a Priority badge."
              checked={highPriority}
              onChange={setHighPriority}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <CheckRow
              label="Requires admin approval"
              hint="Teacher submits → admin reviews → mission completes."
              checked={requiresApproval}
              onChange={setRequiresApproval}
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
            {saving ? 'Saving…' : mission ? 'Save changes' : 'Create mission'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MissionsPagination({ page, pageCount, totalCount, onPageChange }: {
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

function CheckRow({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px',
      border: `1px solid ${C.cardBorder}`, borderRadius: 10, cursor: 'pointer',
      background: checked ? C.primarySoft : '#fff',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 3, accentColor: C.primary }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hint}</div>
      </div>
    </label>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted },
  tabsCard: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: 8, marginBottom: 18, boxShadow: SHADOW,
  },
  tabsRow: { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  deptPill: {
    padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20,
    border: `1px solid ${C.cardBorder}`, background: C.card, color: C.muted, cursor: 'pointer',
  },
  deptPillActive: { borderColor: C.primary, background: C.primary, color: '#fff' },
  tab: {
    display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid transparent', whiteSpace: 'nowrap',
  },
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
  categorySelect: {
    padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontWeight: 600, fontSize: 12.5,
    cursor: 'pointer', outline: 'none',
  },
  categoryGroupHeader: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 2px',
    fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  categoryGroupCount: {
    padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
    background: C.divider, color: C.mutedSoft,
  },
  missionRow: {
    display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
    transition: 'box-shadow 120ms ease, border-color 120ms ease',
  },
  dragHandle: { cursor: 'grab', fontSize: 14, padding: '4px 6px' },
  catIconWrap: {
    width: 36, height: 36, borderRadius: 10, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
  },
  pill: {
    padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  missionDesc: {
    margin: '6px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5,
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
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: '1px solid', cursor: 'pointer',
  },
  segBtn: {
    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    border: '1px solid', cursor: 'pointer',
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

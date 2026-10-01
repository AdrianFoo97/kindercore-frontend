import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCheck, faXmark, faPlus, faPen, faTrash, faGripVertical,
  faArrowUp, faArrowDown, faUserPen, faClock, faLayerGroup, faMinus, faCopy,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchRevision, updateRevision, approveRevision, rejectRevision, ProposedStep,
} from '../api/sop-revisions.js';
import { fetchSteps, SopStep } from '../api/sop-steps.js';
import { fetchSections } from '../api/sop-sections.js';
import { useToast } from '../components/common/Toast.js';
import { useDeleteDialog } from '../components/common/DeleteDialog.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

// ─────────────────────────────────────────────────────────────────────────────
// A supervisor must land HERE before Approve/Reject exist at all — the
// Improvement Inbox list (HrSopRevisionsPage.tsx) is now a plain clickable
// list with no action buttons of its own, forcing a real look at the guide
// first. This page also lets the supervisor fix small things in the
// proposal (a typo, a misplaced step) before approving instead of having
// to reject-and-ask-for-a-resubmit for something trivial.
//
// The step-editing pattern (DraftStep/local-only-until-save, add/edit/
// delete/reorder via a slide-in drawer) is adapted from
// operations/SopProposePage.tsx rather than imported from it — that page
// has had extensive teacher-mobile-specific work done and isn't touched
// here; this is a second, independent, admin-only use of the same shape.
// Worth extracting into a shared component if a third use ever shows up.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  textBody: '#52525b',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  success: '#059669',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';
const NAVBAR_HEIGHT = 50;
const SECTION_ACCENTS = ['#5a67d8', '#0d9488', '#b45309', '#be185d', '#0369a1', '#7c3aed'];

interface DraftStep extends ProposedStep {
  key: string;
}
let keySeq = 0;

// Same bullet-line convention as SopProposePage.tsx / SopTemplateStepsPage.tsx.
function renderDetailLines(lines: string[]): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(<ul key={`ul-${blocks.length}`} style={s.detailList}>{bullets.map((l, i) => <li key={i}>{l}</li>)}</ul>);
    bullets = [];
  };
  lines.forEach(line => {
    if (line.startsWith('- ')) bullets.push(line.slice(2));
    else { flushBullets(); blocks.push(<p key={`p-${blocks.length}`} style={s.detailPara}>{line}</p>); }
  });
  flushBullets();
  return blocks;
}

// Same shape as the diff HrSopRevisionsPage.tsx used to compute inline —
// moved here since the inbox no longer needs it (see that file's own note).
interface StepDiff {
  added: ProposedStep[];
  removed: SopStep[];
  modified: { live: SopStep; proposed: ProposedStep; sectionChanged: boolean; detailChanged: boolean }[];
  unchangedCount: number;
  reordered: boolean;
}
function diffSteps(liveSteps: SopStep[], proposedSteps: ProposedStep[]): StepDiff {
  const norm = (v: string) => v.trim().toLowerCase();
  const liveByTitle = new Map(liveSteps.map(st => [norm(st.title), st]));
  const proposedByTitle = new Map(proposedSteps.map(st => [norm(st.title), st]));
  const added: ProposedStep[] = [];
  const modified: StepDiff['modified'] = [];
  let unchangedCount = 0;
  const matchedProposedOrder: string[] = [];
  for (const p of proposedSteps) {
    const key = norm(p.title);
    const live = liveByTitle.get(key);
    if (!live) { added.push(p); continue; }
    matchedProposedOrder.push(key);
    const sectionChanged = live.section !== p.section;
    const detailChanged = (live.detail ?? '').trim() !== (p.detail ?? '').trim();
    if (sectionChanged || detailChanged) modified.push({ live, proposed: p, sectionChanged, detailChanged });
    else unchangedCount += 1;
  }
  const removed = liveSteps.filter(st => !proposedByTitle.has(norm(st.title)));
  const liveMatchedOrder = liveSteps.map(st => norm(st.title)).filter(k => matchedProposedOrder.includes(k));
  const reordered = liveMatchedOrder.join('|') !== matchedProposedOrder.join('|');
  return { added, removed, modified, unchangedCount, reordered };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

type StepDrawerState =
  | { mode: 'closed' }
  | { mode: 'new'; insertAfterKey?: string }
  | { mode: 'edit'; key: string };

export default function HrSopRevisionReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();
  const { isMobile } = useIsMobile();

  const { data: revision, isLoading } = useQuery({
    queryKey: ['sop-revision', id],
    queryFn: () => fetchRevision(id!),
    enabled: !!id,
  });
  const { data: liveSteps = [] } = useQuery({
    queryKey: ['sop-steps', revision?.sopTemplateId],
    queryFn: () => fetchSteps(revision!.sopTemplateId!),
    enabled: !!revision?.sopTemplateId,
  });
  const { data: globalSections = [] } = useQuery({ queryKey: ['sop-sections'], queryFn: () => fetchSections() });
  const existingSections = globalSections.map(sec => sec.name);

  const isPending = revision?.status === 'PENDING';

  // Back goes to wherever the supervisor actually came from (the inbox's
  // Pending tab, a search result, wherever) — not a hardcoded destination.
  // Same fix already applied to the admin Add-How-To-Guide form.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/hr/sop-revisions');
  };

  // ── Editable draft steps, seeded once from the loaded revision ────────
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !revision) return;
    setSteps(revision.stepsJson.map(st => ({ key: `k${keySeq++}`, ...st })));
    setSeeded(true);
  }, [seeded, revision]);

  const usedSections = useMemo(() => {
    const present = new Set(steps.map(st => st.section));
    const canonical = existingSections.filter(name => present.has(name));
    const extras = [...present].filter(name => !canonical.includes(name));
    return [...canonical, ...extras];
  }, [steps, existingSections]);
  const sectionAccent = (section: string) => SECTION_ACCENTS[usedSections.indexOf(section) % SECTION_ACCENTS.length];
  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const st of steps) map.set(st.section, (map.get(st.section) ?? 0) + 1);
    return map;
  }, [steps]);
  const displaySteps = useMemo(() => {
    const bySection = new Map<string, DraftStep[]>();
    for (const st of steps) {
      if (!bySection.has(st.section)) bySection.set(st.section, []);
      bySection.get(st.section)!.push(st);
    }
    return usedSections.flatMap(sec => bySection.get(sec) ?? []);
  }, [steps, usedSections]);

  const removeStep = (key: string) => setSteps(prev => prev.filter(st => st.key !== key));

  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const onDragStart = (key: string) => (e: React.DragEvent) => { setDragKey(key); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (key: string) => (e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (dropKey !== key) setDropKey(key);
  };
  const onDragEnd = () => { setDragKey(null); setDropKey(null); };
  const reorderTo = (fromKey: string, toKey: string) => {
    const displayKeys = displaySteps.map(st => st.key);
    const fromIdx = displayKeys.indexOf(fromKey);
    const toIdx = displayKeys.indexOf(toKey);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...displayKeys];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const displaySet = new Set(displayKeys);
    const byKey = new Map(steps.map(st => [st.key, st]));
    let cursor = 0;
    setSteps(prev => prev.map(st => (displaySet.has(st.key) ? byKey.get(reordered[cursor++])! : st)));
  };
  const onDrop = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragKey || dragKey === targetKey) { onDragEnd(); return; }
    reorderTo(dragKey, targetKey);
    onDragEnd();
  };
  const moveStep = (key: string, direction: -1 | 1) => {
    const displayKeys = displaySteps.map(st => st.key);
    const fromIdx = displayKeys.indexOf(key);
    const toIdx = fromIdx + direction;
    if (fromIdx < 0 || toIdx < 0 || toIdx >= displayKeys.length) return;
    reorderTo(key, displayKeys[toIdx]);
  };

  const [drawer, setDrawer] = useState<StepDrawerState>({ mode: 'closed' });
  const editingStep = drawer.mode === 'edit' ? steps.find(st => st.key === drawer.key) ?? null : null;
  const insertAfterStep = drawer.mode === 'new' && drawer.insertAfterKey ? steps.find(st => st.key === drawer.insertAfterKey) ?? null : null;
  const closeDrawer = () => setDrawer({ mode: 'closed' });
  const saveDrawerStep = (section: string, title: string, detail: string) => {
    if (drawer.mode === 'edit') {
      const key = drawer.key;
      setSteps(prev => prev.map(st => (st.key === key ? { ...st, section, title, detail } : st)));
    } else {
      const newStep: DraftStep = { key: `k${keySeq++}`, section, title, detail };
      const insertAfterKey = drawer.mode === 'new' ? drawer.insertAfterKey : undefined;
      setSteps(prev => {
        const idx = insertAfterKey ? prev.findIndex(st => st.key === insertAfterKey) : -1;
        if (idx === -1) return [...prev, newStep];
        const next = [...prev];
        next.splice(idx + 1, 0, newStep);
        return next;
      });
    }
    closeDrawer();
  };

  const cleanSteps: ProposedStep[] = steps
    .filter(st => st.title.trim())
    .map(st => ({ section: st.section.trim() || 'General', title: st.title.trim(), detail: (st.detail ?? '').trim() || null }));

  const [processing, setProcessing] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sop-revisions'] });
    qc.invalidateQueries({ queryKey: ['sop-revision', id] });
    qc.invalidateQueries({ queryKey: ['sop-templates'] });
    qc.invalidateQueries({ queryKey: ['sop-steps'] });
  };

  const onApprove = async () => {
    if (!revision || cleanSteps.length === 0) return;
    setProcessing(true);
    try {
      // Always save the current draft first (whether the supervisor
      // actually touched anything or not) so approveRevision — which
      // reads stepsJson straight off the row, unchanged — picks up
      // exactly what's on screen.
      await updateRevision(revision.id, {
        title: revision.title,
        goal: revision.goal,
        videoUrl: revision.videoUrl,
        icon: revision.icon,
        steps: cleanSteps,
        categoryIds: revision.categoryIdsJson ?? undefined,
      });
      await approveRevision(revision.id);
      invalidate();
      showToast('Improvement approved — now live');
      goBack();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to approve', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const onReject = async () => {
    if (!revision) return;
    const ok = await confirm({
      entityType: 'Suggestion',
      entityName: revision.title,
      consequence: 'The person who suggested this will see it was declined. Nothing about the current How-To Guide changes.',
      actionLabel: 'Reject',
      onConfirm: async () => {
        setProcessing(true);
        try {
          await rejectRevision(revision.id);
          invalidate();
          showToast('Suggestion rejected');
          goBack();
        } catch (e: any) {
          showToast(e?.message ?? 'Failed to reject', 'error');
        } finally {
          setProcessing(false);
        }
      },
    });
    if (!ok) return;
  };

  if (isLoading || !revision) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>{isLoading ? 'Loading…' : 'Revision not found.'}</p>
        </div>
      </div>
    );
  }

  const diff = revision.sopTemplateId ? diffSteps(liveSteps, revision.stepsJson) : null;
  const hasDiffChanges = !!diff && (diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0 || diff.reordered);

  return (
    <div style={s.page}>
      <style>{`
        @media (hover: hover) {
          .rev-step-row:hover { background: ${C.divider}; }
          .rev-grip:hover { color: ${C.primary} !important; }
        }
        .rev-grip:active { cursor: grabbing !important; }
      `}</style>
      <div style={s.inner}>
        <button onClick={goBack} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
          Improvement Inbox
        </button>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
            <span style={revision.sopTemplateId ? s.badgeEdit : s.badgeNew}>
              {revision.sopTemplateId ? 'Edit' : 'New How-To Guide'}
            </span>
            <h1 style={s.heading}>{revision.title}</h1>
          </div>
          <div style={s.metaRow}>
            <span style={s.metaItem}><FontAwesomeIcon icon={faUserPen} style={{ fontSize: 10.5 }} />{revision.proposedByName}</span>
            <span style={s.metaDot} />
            <span style={s.metaItem}><FontAwesomeIcon icon={faClock} style={{ fontSize: 10.5 }} />{fmtDate(revision.createdAt)}</span>
          </div>
          {!isPending && revision.reviewedByName && (
            <div style={{ fontSize: 12, color: C.mutedSoft, marginTop: 8 }}>
              {revision.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {revision.reviewedByName}
              {revision.reviewedAt ? ` on ${fmtDate(revision.reviewedAt)}` : ''}
              {revision.reviewNote ? ` — "${revision.reviewNote}"` : ''}
            </div>
          )}
          {revision.goal && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: C.textBody, lineHeight: 1.5, maxWidth: 640 }}>{revision.goal}</p>
          )}
        </div>

        {diff && (
          <div style={{ ...s.card, marginBottom: 18 }}>
            <div style={s.previewLabel}>What the teacher changed</div>
            {!hasDiffChanges ? (
              <p style={{ fontSize: 12.5, color: C.mutedSoft, margin: '8px 0 0' }}>No step changes — identical to the current version.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {diff.added.map((st, i) => (
                  <div key={`add-${i}`} style={s.diffAdded}>
                    <FontAwesomeIcon icon={faPlus} style={{ ...s.diffIcon, color: C.success }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.diffSectionLabel}>{st.section}</div>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 12.5 }}>{st.title}</div>
                      {st.detail && <div style={{ color: C.textBody, fontSize: 12, marginTop: 2, whiteSpace: 'pre-line' as const }}>{st.detail}</div>}
                    </div>
                  </div>
                ))}
                {diff.removed.map(st => (
                  <div key={`rm-${st.id}`} style={s.diffRemoved}>
                    <FontAwesomeIcon icon={faMinus} style={{ ...s.diffIcon, color: C.danger }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.diffSectionLabel}>{st.section}</div>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 12.5, textDecoration: 'line-through' as const }}>{st.title}</div>
                    </div>
                  </div>
                ))}
                {diff.modified.map(({ live, proposed, sectionChanged, detailChanged }, i) => (
                  <div key={`mod-${i}`} style={s.diffModified}>
                    <FontAwesomeIcon icon={faPen} style={{ ...s.diffIcon, color: '#b45309' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.diffSectionLabel}>{proposed.section}</div>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 12.5 }}>{proposed.title}</div>
                      {sectionChanged && (
                        <div style={{ fontSize: 11.5, marginTop: 3 }}>
                          <span style={{ color: C.mutedSoft }}>Section: </span>
                          <span style={{ textDecoration: 'line-through' as const, color: C.mutedSoft }}>{live.section}</span>
                          {' → '}
                          <span style={{ color: C.text, fontWeight: 600 }}>{proposed.section}</span>
                        </div>
                      )}
                      {detailChanged && (
                        <div style={{ marginTop: 4, fontSize: 12 }}>
                          {live.detail && <div style={{ color: C.mutedSoft, textDecoration: 'line-through' as const, whiteSpace: 'pre-line' as const, marginBottom: 3 }}>{live.detail}</div>}
                          <div style={{ color: C.textBody, whiteSpace: 'pre-line' as const }}>{proposed.detail || <em style={{ color: C.mutedSoft }}>(removed)</em>}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(diff.reordered || diff.unchangedCount > 0) && hasDiffChanges && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: C.mutedSoft }}>
                {[
                  diff.unchangedCount > 0 ? `${diff.unchangedCount} step${diff.unchangedCount === 1 ? '' : 's'} unchanged` : null,
                  diff.reordered ? 'step order changed too' : null,
                ].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        )}

        <div style={s.stepsCardHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>
              {isPending ? 'Steps — edit before approving' : 'Steps'}
            </h3>
            <div style={s.cardSub}>{`${steps.length} step${steps.length === 1 ? '' : 's'} across ${usedSections.length} section${usedSections.length === 1 ? '' : 's'}`}</div>
          </div>
          {isPending && (
            <button
              onClick={() => setDrawer({ mode: 'new' })}
              style={{ ...s.addStepBtn, ...(isMobile ? { width: '100%', display: 'flex', justifyContent: 'center' } : null) }}
            >
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              Add step
            </button>
          )}
        </div>

        {displaySteps.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS }}>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No steps in this proposal.</p>
          </div>
        ) : (() => {
          let lastSection = '';
          let posInGroup = 0;
          const rows = displaySteps.map((st, i) => {
            const showHeader = st.section !== lastSection;
            if (showHeader) { lastSection = st.section; posInGroup = 0; }
            const stepNumber = posInGroup + 1;
            posInGroup += 1;
            const accent = sectionAccent(st.section);
            const detailLines = (st.detail ?? '').split('\n').map(l => l.trim()).filter(Boolean);
            return {
              st, showHeader, stepNumber, accent, detailLines,
              isDrag: dragKey === st.key, isDrop: dropKey === st.key && dragKey !== st.key,
              isFirst: i === 0, isLast: i === displaySteps.length - 1,
            };
          });

          return isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map(({ st, showHeader, stepNumber, accent, detailLines, isFirst, isLast }) => (
                <React.Fragment key={st.key}>
                  {showHeader && (
                    <div style={sMobile.sectionHeader}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderLeft: `3px solid ${accent}`, paddingLeft: 10 }}>
                        <span style={{ color: accent }}>{st.section}</span>
                        <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                      </div>
                    </div>
                  )}
                  <div style={{ ...sMobile.stepCard, background: '#fff' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      {isPending && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
                          <button type="button" onClick={() => moveStep(st.key, -1)} disabled={isFirst} aria-label="Move step up" style={{ ...s.stepIconBtn, width: 20, height: 16, fontSize: 9, opacity: isFirst ? 0.35 : 1, cursor: isFirst ? 'default' : 'pointer' }}>
                            <FontAwesomeIcon icon={faArrowUp} />
                          </button>
                          <button type="button" onClick={() => moveStep(st.key, 1)} disabled={isLast} aria-label="Move step down" style={{ ...s.stepIconBtn, width: 20, height: 16, fontSize: 9, opacity: isLast ? 0.35 : 1, cursor: isLast ? 'default' : 'pointer' }}>
                            <FontAwesomeIcon icon={faArrowDown} />
                          </button>
                        </div>
                      )}
                      <span style={{ ...s.stepNumber, background: `${accent}1c`, color: accent, marginTop: 1 }}>{stepNumber}</span>
                      <span style={{ flex: 1, fontWeight: 600, color: C.text }}>{st.title}</span>
                    </div>
                    {detailLines.length > 0 && <div style={sMobile.stepCardDetail}>{renderDetailLines(detailLines)}</div>}
                    {isPending && (
                      <div style={sMobile.stepCardActions}>
                        <button onClick={() => setDrawer({ mode: 'new', insertAfterKey: st.key })} style={s.stepIconBtn} aria-label="Insert step after this one"><FontAwesomeIcon icon={faPlus} /></button>
                        <button onClick={() => setDrawer({ mode: 'edit', key: st.key })} style={s.stepIconBtn} aria-label="Edit step"><FontAwesomeIcon icon={faPen} /></button>
                        <button onClick={() => removeStep(st.key)} style={{ ...s.stepIconBtn, color: C.danger }} aria-label="Remove step"><FontAwesomeIcon icon={faTrash} /></button>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS, padding: '4px 14px', overflowX: 'auto' as const }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: '30%' }}>Step</th>
                    <th style={s.th}>Operation Details &amp; Standard</th>
                    {isPending && <th style={{ ...s.th, width: 118 }} />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ st, showHeader, stepNumber, accent, detailLines, isDrag, isDrop }) => (
                    <React.Fragment key={st.key}>
                      {showHeader && (
                        <tr><td colSpan={isPending ? 3 : 2} style={{ ...s.sectionHeaderCell, borderLeftColor: accent }}>
                          <span style={{ color: accent }}>{st.section}</span>
                          <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                        </td></tr>
                      )}
                      <tr
                        className="rev-step-row"
                        onDragOver={isPending ? onDragOver(st.key) : undefined}
                        onDrop={isPending ? onDrop(st.key) : undefined}
                        style={{ opacity: isDrag ? 0.45 : 1, background: isDrop ? C.primarySoft : undefined }}
                      >
                        <td style={s.tdStep}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            {isPending && (
                              <span className="rev-grip" draggable onDragStart={onDragStart(st.key)} onDragEnd={onDragEnd} style={s.dragHandle} title="Drag to reorder">
                                <FontAwesomeIcon icon={faGripVertical} />
                              </span>
                            )}
                            <span style={{ ...s.stepNumber, background: `${accent}1c`, color: accent }}>{stepNumber}</span>
                            <span style={{ fontWeight: 600, color: C.text, paddingTop: 2 }}>{st.title}</span>
                          </div>
                        </td>
                        <td style={s.tdDetail}>{renderDetailLines(detailLines)}</td>
                        {isPending && (
                          <td style={s.tdActions}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button onClick={() => setDrawer({ mode: 'new', insertAfterKey: st.key })} style={s.stepIconBtn} aria-label="Insert step after this one"><FontAwesomeIcon icon={faPlus} /></button>
                              <button onClick={() => setDrawer({ mode: 'edit', key: st.key })} style={s.stepIconBtn} aria-label="Edit step"><FontAwesomeIcon icon={faPen} /></button>
                              <button onClick={() => removeStep(st.key)} style={{ ...s.stepIconBtn, color: C.danger }} aria-label="Remove step"><FontAwesomeIcon icon={faTrash} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {isPending && (
          <div style={{ ...s.footer, ...(isMobile ? { flexDirection: 'column' as const } : null) }}>
            {/* Rework this substantially instead of Approve/Reject-as-is —
                clones this proposal's content into a brand-new revision
                owned by the reviewer, left as a private draft. The
                original stays exactly as it is here, still needing its
                own real decision separately. */}
            <button
              onClick={() => navigate(`/operations/sops/propose?fromRevision=${revision.id}`)}
              disabled={processing}
              style={{ ...s.copyBtn, ...(isMobile ? { width: '100%' } : null) }}
            >
              <FontAwesomeIcon icon={faCopy} style={{ marginRight: 6 }} />
              Copy into my own draft
            </button>
            <button onClick={onReject} disabled={processing} style={{ ...s.rejectBtn, ...(isMobile ? { width: '100%' } : null) }}>
              <FontAwesomeIcon icon={faXmark} style={{ marginRight: 6 }} />
              Reject
            </button>
            <button onClick={onApprove} disabled={processing || cleanSteps.length === 0} style={{ ...s.approveBtn, ...(isMobile ? { width: '100%' } : null), opacity: cleanSteps.length === 0 ? 0.5 : 1 }}>
              <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
              {processing ? 'Approving…' : 'Approve'}
            </button>
          </div>
        )}
      </div>

      {drawer.mode !== 'closed' && (
        <StepDrawer
          mode={drawer.mode}
          initial={editingStep}
          insertAfterStep={insertAfterStep}
          sections={existingSections}
          onCancel={closeDrawer}
          onSave={saveDrawerStep}
        />
      )}
    </div>
  );
}

function StepDrawer({
  mode, initial, insertAfterStep, sections, onCancel, onSave,
}: {
  mode: 'new' | 'edit';
  initial: DraftStep | null;
  insertAfterStep: DraftStep | null;
  sections: string[];
  onCancel: () => void;
  onSave: (section: string, title: string, detail: string) => void;
}) {
  const [section, setSection] = useState(initial?.section ?? insertAfterStep?.section ?? sections[0] ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [detail, setDetail] = useState(initial?.detail ?? '');
  const contextText = mode === 'edit'
    ? 'Local to this review until approved'
    : insertAfterStep
      ? `Inserting right after "${insertAfterStep.title}" in ${insertAfterStep.section}`
      : 'Local to this review until approved';

  return createPortal(
    <>
      <div style={{ ...drawerS.overlay, top: NAVBAR_HEIGHT }} onClick={onCancel} />
      <div style={{ ...drawerS.panel, top: NAVBAR_HEIGHT }}>
        <div style={drawerS.header}>
          <div>
            <div style={drawerS.title}>{mode === 'edit' ? 'Edit step' : 'Add step'}</div>
            <div style={drawerS.context}><FontAwesomeIcon icon={faLayerGroup} style={{ marginRight: 5, fontSize: 10 }} />{contextText}</div>
          </div>
          <button onClick={onCancel} style={drawerS.closeBtn} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        <div style={drawerS.body}>
          <div style={s.field}>
            <label style={s.label}>Section</label>
            {sections.length > 0 ? (
              <div style={s.chipRow}>
                {sections.map(sec => (
                  <button key={sec} type="button" onClick={() => setSection(sec)} style={{ ...s.chip, ...(section === sec ? s.chipActive : {}) }}>{sec}</button>
                ))}
              </div>
            ) : (
              <input type="text" value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. Main Process" style={s.input} />
            )}
          </div>
          <div style={s.field}>
            <label style={s.label}>Step title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Confirm the pick list" style={s.input} autoFocus />
          </div>
          <div style={{ ...s.field, marginBottom: 0 }}>
            <label style={s.label}>Operation details<span style={s.labelHint}>One point per line. Start a line with "-" for a bullet point.</span></label>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} style={{ ...s.input, minHeight: 140, resize: 'vertical' as const }} />
          </div>
        </div>
        <div style={drawerS.footer}>
          <button onClick={onCancel} style={s.cancelBtn}>Cancel</button>
          <button onClick={() => onSave(section.trim() || 'General', title.trim(), detail)} disabled={!title.trim()} style={{ ...s.saveBtn, opacity: !title.trim() ? 0.5 : 1 }}>
            {mode === 'edit' ? 'Save step' : 'Add step'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 900, margin: '0 auto' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 10px', marginBottom: 14,
    border: 'none', background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  heading: { margin: 0, fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  badgeNew: {
    display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: C.primarySoft, color: C.primary, textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
  badgeEdit: {
    display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: '#fff7ed', color: '#b45309', textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' as const },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.mutedSoft, fontWeight: 500 },
  metaDot: { width: 3, height: 3, borderRadius: '50%', background: C.mutedSoft, flexShrink: 0 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '18px 22px', boxShadow: SHADOW,
  },
  previewLabel: { fontSize: 10.5, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  diffAdded: { display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(5,150,105,0.06)', borderLeft: `3px solid ${C.success}` },
  diffRemoved: { display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: C.dangerSoft, borderLeft: `3px solid ${C.danger}` },
  diffModified: { display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#fff7ed', borderLeft: '3px solid #b45309' },
  diffIcon: { fontSize: 11, marginTop: 3, flexShrink: 0 },
  diffSectionLabel: { fontSize: 10.5, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase' as const, letterSpacing: '0.03em' },
  stepsCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 0 12px', gap: 10, flexWrap: 'wrap' as const },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  addStepBtn: { padding: '7px 14px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },
  table: { width: '100%', minWidth: 640, borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const },
  th: { textAlign: 'left' as const, padding: '8px 10px', fontSize: 11, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: `2px solid ${C.divider}` },
  sectionHeaderCell: { padding: '18px 10px 8px 14px', fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderLeft: '3px solid transparent' },
  sectionGroupCount: { marginLeft: 8, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: C.divider, color: C.mutedSoft, textTransform: 'none' as const, letterSpacing: 'normal' },
  tdStep: { verticalAlign: 'top' as const, padding: '13px 10px', fontSize: 13.5, borderBottom: `1px solid ${C.divider}`, wordBreak: 'break-word' as const },
  tdDetail: { verticalAlign: 'top' as const, padding: '13px 10px', fontSize: 12.5, color: C.textSub, borderBottom: `1px solid ${C.divider}`, lineHeight: 1.6 },
  tdActions: { verticalAlign: 'top' as const, padding: '13px 10px', borderBottom: `1px solid ${C.divider}`, whiteSpace: 'nowrap' as const },
  detailList: { margin: '0 0 4px', paddingLeft: 16 },
  detailPara: { margin: '0 0 4px' },
  dragHandle: { cursor: 'grab', fontSize: 13, flexShrink: 0, marginTop: 3, padding: '2px 4px', color: C.mutedSoft, userSelect: 'none' as const, WebkitUserSelect: 'none' as const },
  stepNumber: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: C.primarySoft, color: C.primary, fontSize: 11, fontWeight: 700, flexShrink: 0 },
  stepIconBtn: { width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.cardBorder}`, background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  approveBtn: { padding: '10px 18px', borderRadius: 10, border: 'none', background: C.success, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  rejectBtn: { padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  // Sits before Reject/Approve, same footer row — a third, quieter option
  // (marginRight: auto pushes it away from the decision buttons on
  // desktop, so it doesn't read as equally weighted with them).
  copyBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    marginRight: 'auto',
  },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  labelHint: { display: 'block', fontSize: 11, fontWeight: 400, color: C.mutedSoft, marginTop: 2 },
  input: { width: '100%', padding: '9px 11px', fontSize: 13, border: `1px solid ${C.cardBorder}`, borderRadius: 8, outline: 'none', color: C.text, boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#fff' },
  chipRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  chip: { padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.textSub, cursor: 'pointer' },
  chipActive: { borderColor: C.primary, background: C.primary, color: '#fff' },
  cancelBtn: { padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  saveBtn: { padding: '10px 18px', borderRadius: 10, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};

const sMobile: Record<string, React.CSSProperties> = {
  sectionHeader: { padding: '14px 4px 4px', fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  stepCard: { border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '12px 12px 10px' },
  stepCardDetail: { marginTop: 8, fontSize: 12.5, color: C.textSub, lineHeight: 1.6 },
  stepCardActions: { display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.divider}` },
};

const drawerS: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.28)', zIndex: 55 },
  panel: { position: 'fixed', right: 0, bottom: 0, width: 440, maxWidth: '100vw', background: '#fff', borderLeft: `1px solid ${C.cardBorder}`, boxShadow: '-8px 0 28px rgba(15,23,42,0.08)', zIndex: 56, display: 'flex', flexDirection: 'column' as const },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${C.divider}` },
  title: { fontSize: 15, fontWeight: 700, color: C.text },
  context: { marginTop: 3, fontSize: 11.5, color: C.mutedSoft },
  closeBtn: { width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.cardBorder}`, background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { padding: '18px 20px', overflowY: 'auto' as const, flex: 1 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: `1px solid ${C.divider}` },
};

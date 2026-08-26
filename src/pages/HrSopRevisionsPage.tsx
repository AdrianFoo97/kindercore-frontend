import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck, faXmark, faChevronDown, faChevronUp, faClipboardList, faUserPen, faClock,
  faPlus, faMinus, faPen,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchRevisions, approveRevision, rejectRevision, SopTemplateRevision, SopRevisionStatus, ProposedStep,
} from '../api/sop-revisions.js';
import { fetchTemplates } from '../api/sop-templates.js';
import { fetchSteps, SopStep } from '../api/sop-steps.js';
import { useToast } from '../components/common/Toast.js';
import { useDeleteDialog } from '../components/common/DeleteDialog.js';
import { usePermissions } from '../hooks/usePermissions.js';

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
  primaryBorder: '#c7d2fe',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  success: '#059669',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

const TABS: { key: SopRevisionStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Suggesting an improvement only ever touches Steps (title/goal/video/labels
// are carried through unchanged), so a step-level diff is the whole story of
// what a teacher actually proposed. Revisions don't carry the original
// step's id — it's a flat re-typed snapshot — so steps are matched by title
// (case/whitespace-insensitive), the same way a person would recognize
// "is this the same step" at a glance.
interface StepDiff {
  added: ProposedStep[];
  removed: SopStep[];
  modified: { live: SopStep; proposed: ProposedStep; sectionChanged: boolean; detailChanged: boolean }[];
  unchangedCount: number;
  reordered: boolean;
}
function diffSteps(liveSteps: SopStep[], proposedSteps: ProposedStep[]): StepDiff {
  const norm = (s: string) => s.trim().toLowerCase();
  const liveByTitle = new Map(liveSteps.map(s => [norm(s.title), s]));
  const proposedByTitle = new Map(proposedSteps.map(s => [norm(s.title), s]));

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
  const removed = liveSteps.filter(s => !proposedByTitle.has(norm(s.title)));
  // A pure reorder shows the same matched steps, just in a different
  // relative sequence — compare each side's order restricted to only the
  // steps that matched (added/removed steps don't count as reordering).
  const liveMatchedOrder = liveSteps.map(s => norm(s.title)).filter(k => matchedProposedOrder.includes(k));
  const reordered = liveMatchedOrder.join('|') !== matchedProposedOrder.join('|');

  return { added, removed, modified, unchangedCount, reordered };
}

export default function HrSopRevisionsPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();
  const { hasView } = usePermissions();

  const [tab, setTab] = useState<SopRevisionStatus>('PENDING');
  const { data: revisions = [], isLoading } = useQuery({
    queryKey: ['sop-revisions', tab],
    queryFn: () => fetchRevisions({ status: tab }),
  });
  const { data: templates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const templateById = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sop-revisions'] });
    qc.invalidateQueries({ queryKey: ['sop-templates'] });
    qc.invalidateQueries({ queryKey: ['sop-steps'] });
  };

  const onApprove = async (rev: SopTemplateRevision) => {
    setProcessingId(rev.id);
    try {
      await approveRevision(rev.id);
      invalidate();
      showToast('Improvement approved — now live');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to approve', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const onReject = async (rev: SopTemplateRevision) => {
    const ok = await confirm({
      entityType: 'Suggestion',
      entityName: rev.title,
      consequence: 'The person who suggested this will see it was declined. Nothing about the current How-To Guide changes.',
      actionLabel: 'Reject',
      onConfirm: async () => {
        setProcessingId(rev.id);
        try {
          await rejectRevision(rev.id);
          invalidate();
          showToast('Suggestion rejected');
        } catch (e: any) {
          showToast(e?.message ?? 'Failed to reject', 'error');
        } finally {
          setProcessingId(null);
        }
      },
    });
    if (!ok) return;
  };

  return (
    <div style={s.page}>
      <style>{`.hr-rev-tab:hover { color: ${C.text} !important; background: #f1f5f9 !important; }`}</style>
      <div style={s.inner}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={s.heading}>Improvement Inbox</h1>
          <p style={s.subheading}>
            Challenge before we decide, align after we decide. How-To Guide changes and new suggestions from the team, waiting for review before they become the current way.
          </p>
        </div>

        <div style={s.tabStrip}>
          {TABS.map(t => (
            <button
              key={t.key}
              className="hr-rev-tab"
              onClick={() => setTab(t.key)}
              style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
        ) : revisions.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '48px 20px' }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 22, color: C.mutedSoft, marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              {tab === 'PENDING' ? 'Nothing waiting on review.' : `No ${tab.toLowerCase()} suggestions.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {revisions.map(rev => {
              const target = rev.sopTemplateId ? templateById.get(rev.sopTemplateId) : null;
              const isExpanded = expandedId === rev.id;
              const isProcessing = processingId === rev.id;
              const sections = [...new Set(rev.stepsJson.map(st => st.section))];

              return (
                <div key={rev.id} style={s.card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                        <span style={rev.sopTemplateId ? s.badgeEdit : s.badgeNew}>
                          {rev.sopTemplateId ? `Edit${target ? ` · v${target.currentVersion} → v${target.currentVersion + 1}` : ''}` : 'New How-To Guide'}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{rev.title}</span>
                      </div>
                      {rev.sopTemplateId && target && rev.title !== target.title && (
                        <div style={{ fontSize: 12, color: C.mutedSoft, marginBottom: 4 }}>Currently: "{target.title}"</div>
                      )}
                      <div style={s.metaRow}>
                        <span style={s.metaItem}>
                          <FontAwesomeIcon icon={faUserPen} style={{ fontSize: 10.5 }} />
                          {rev.proposedByName}
                        </span>
                        <span style={s.metaDot} />
                        <span style={s.metaItem}>
                          <FontAwesomeIcon icon={faClock} style={{ fontSize: 10.5 }} />
                          {fmtDate(rev.createdAt)}
                        </span>
                        <span style={s.metaDot} />
                        <span style={s.metaItem}>{rev.stepsJson.length} step{rev.stepsJson.length === 1 ? '' : 's'} · {sections.length} section{sections.length === 1 ? '' : 's'}</span>
                      </div>
                      {rev.status !== 'PENDING' && rev.reviewedByName && (
                        <div style={{ fontSize: 11.5, color: C.mutedSoft, marginTop: 6 }}>
                          {rev.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {rev.reviewedByName}
                          {rev.reviewedAt ? ` on ${fmtDate(rev.reviewedAt)}` : ''}
                          {rev.reviewNote ? ` — "${rev.reviewNote}"` : ''}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => setExpandedId(isExpanded ? null : rev.id)} style={s.iconBtn} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                        <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
                      </button>
                      {tab === 'PENDING' && hasView('OPERATION_SOP_APPROVE') && (
                        <>
                          <button onClick={() => onReject(rev)} disabled={isProcessing} style={s.rejectBtn}>
                            <FontAwesomeIcon icon={faXmark} style={{ marginRight: 5 }} />
                            Reject
                          </button>
                          <button onClick={() => onApprove(rev)} disabled={isProcessing} style={s.approveBtn}>
                            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5 }} />
                            {isProcessing ? 'Approving…' : 'Approve'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={s.previewBox}>
                      {rev.sopTemplateId ? (
                        <RevisionStepDiff sopTemplateId={rev.sopTemplateId} proposedSteps={rev.stepsJson} />
                      ) : (
                        <>
                          {rev.goal && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={s.previewLabel}>Purpose</div>
                              <p style={{ margin: 0, fontSize: 12.5, color: C.textBody, lineHeight: 1.5 }}>{rev.goal}</p>
                            </div>
                          )}
                          <div style={s.previewLabel}>Steps</div>
                          {sections.map(section => (
                            <div key={section} style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase' as const, letterSpacing: '0.04em', margin: '8px 0 4px' }}>
                                {section}
                              </div>
                              {rev.stepsJson.filter(st => st.section === section).map((st, i) => (
                                <div key={i} style={{ padding: '4px 0', fontSize: 12.5 }}>
                                  <span style={{ fontWeight: 600, color: C.text }}>{i + 1}. {st.title}</span>
                                  {st.detail && <div style={{ color: C.textBody, marginTop: 2, whiteSpace: 'pre-line' as const }}>{st.detail}</div>}
                                </div>
                              ))}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Fetches the guide's live steps on demand (only while its card is
// expanded) and renders the diff against the proposal — added/removed/
// modified, so the admin sees exactly what a teacher is asking to change
// instead of re-reading the whole document to spot it themselves.
function RevisionStepDiff({ sopTemplateId, proposedSteps }: { sopTemplateId: string; proposedSteps: ProposedStep[] }) {
  const { data: liveSteps = [], isLoading } = useQuery({
    queryKey: ['sop-steps', sopTemplateId],
    queryFn: () => fetchSteps(sopTemplateId),
  });

  if (isLoading) {
    return <p style={{ fontSize: 12.5, color: C.mutedSoft, margin: 0 }}>Loading current steps…</p>;
  }

  const diff = diffSteps(liveSteps, proposedSteps);
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0 || diff.reordered;

  if (!hasChanges) {
    return <p style={{ fontSize: 12.5, color: C.mutedSoft, margin: 0 }}>No step changes — identical to the current version.</p>;
  }

  return (
    <div>
      <div style={s.previewLabel}>What changed</div>
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
                  {live.detail && (
                    <div style={{ color: C.mutedSoft, textDecoration: 'line-through' as const, whiteSpace: 'pre-line' as const, marginBottom: 3 }}>{live.detail}</div>
                  )}
                  <div style={{ color: C.textBody, whiteSpace: 'pre-line' as const }}>
                    {proposed.detail || <em style={{ color: C.mutedSoft }}>(removed)</em>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {(diff.reordered || diff.unchangedCount > 0) && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: C.mutedSoft }}>
          {[
            diff.unchangedCount > 0 ? `${diff.unchangedCount} step${diff.unchangedCount === 1 ? '' : 's'} unchanged` : null,
            diff.reordered ? 'step order changed too' : null,
          ].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 900, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, maxWidth: 640, lineHeight: 1.5 },
  tabStrip: { display: 'flex', gap: 2, borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 20 },
  tabBtn: {
    padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.muted, background: 'none',
    border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', marginBottom: -1,
  },
  tabBtnActive: { color: C.primary, borderBottom: `2px solid ${C.primary}` },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '18px 22px', boxShadow: SHADOW,
  },
  badgeNew: {
    display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: C.primarySoft, color: C.primary, textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
  badgeEdit: {
    display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: '#fff7ed', color: '#b45309', textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' as const },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.mutedSoft, fontWeight: 500 },
  metaDot: { width: 3, height: 3, borderRadius: '50%', background: C.mutedSoft, flexShrink: 0 },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  approveBtn: {
    padding: '7px 14px', borderRadius: 8, border: 'none', background: C.success,
    color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  rejectBtn: {
    padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: '#fff',
    color: C.danger, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  previewBox: {
    marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.divider}`,
  },
  previewLabel: {
    fontSize: 10.5, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  },
  diffAdded: {
    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
    background: 'rgba(5,150,105,0.06)', borderLeft: `3px solid ${C.success}`,
  },
  diffRemoved: {
    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
    background: C.dangerSoft, borderLeft: `3px solid ${C.danger}`,
  },
  diffModified: {
    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
    background: '#fff7ed', borderLeft: '3px solid #b45309',
  },
  diffIcon: { fontSize: 11, marginTop: 3, flexShrink: 0 },
  diffSectionLabel: {
    fontSize: 10.5, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
};

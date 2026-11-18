import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCheck, faCircleCheck, faTriangleExclamation, faFloppyDisk, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import {
  fetchObservation, advanceStage, saveStepResultsDraft, sendBackForTraining, SopObservationDetail, SopObservationStatus, StepResultValue,
} from '../api/sop-observations.js';
import { useToast } from '../components/common/Toast.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { certifyProblem } from './teacherHome/myTraining.js';
import { levelsScore, markingOfObservation, passMarkText, passedForLevel, type MarkLevel } from './observationMarking.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#64748b',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  success: '#059669',
  successSoft: '#dcfce7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

const STAGES: { status: SopObservationStatus; role: string; nameKey: 'trainerName' | 'assessorName'; atKey: 'trainerAt' | 'assessorAt' }[] = [
  { status: 'PENDING_TRAINER', role: 'Trainer', nameKey: 'trainerName', atKey: 'trainerAt' },
  { status: 'PENDING_ASSESSOR', role: 'Assessor', nameKey: 'assessorName', atKey: 'assessorAt' },
];
const STAGE_ORDER: SopObservationStatus[] = [...STAGES.map(s => s.status), 'CERTIFIED'];

function today() {
  return new Date().toISOString().split('T')[0];
}
function currentUserName() {
  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { name?: string }) : null;
  return user?.name ?? 'You';
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// NA steps don't count toward the mark — they mean "not applicable to this
// run," not "not assessed." A mark is only meaningful once at least one
// step has been decided PASS/FAIL.
function computeScore(results: { passed: StepResultValue }[]) {
  const passed = results.filter(r => r.passed === 'PASS').length;
  const failed = results.filter(r => r.passed === 'FAIL').length;
  const decided = passed + failed;
  return { passed, failed, decided, percent: decided > 0 ? Math.round((passed / decided) * 100) : null };
}

export default function SopObservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const { data: obs, isLoading } = useQuery({
    queryKey: ['sop-observation', id],
    queryFn: () => fetchObservation(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sop-observation', id] });
    qc.invalidateQueries({ queryKey: ['sop-observations'] });
  };

  if (isLoading || !obs) {
    return (
      <div className="m-pad" style={s.page}>
        <div style={s.inner}>
          <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}><LoadingSpinner /></p>
        </div>
      </div>
    );
  }

  const currentStageIdx = STAGE_ORDER.indexOf(obs.status);

  return (
    <div className="m-pad" style={s.page}>
      <div style={s.inner}>
        <button className="back-btn" onClick={() => navigate('/hr/sop-observations')} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
          Practice Observations
        </button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={s.heading}>{obs.templateTitle}</h1>
          <p style={s.subheading}>
            {obs.teacherName}
            {obs.assignedTrainerName && <span style={{ color: C.mutedSoft }}> · Trainer: {obs.assignedTrainerName}</span>}
          </p>
          {obs.templateGoal && <p style={s.goal}>{obs.templateGoal}</p>}
        </div>

        <div style={{ ...s.card, marginBottom: 20 }}>
          <Timeline obs={obs} currentStageIdx={currentStageIdx} />
        </div>

        <div style={s.card}>
          {obs.status === 'PENDING_TRAINER' && (
            <TrainerStage obs={obs} onDone={invalidate} showToast={showToast} />
          )}
          {obs.status === 'PENDING_ASSESSOR' && (
            <AssessorStage obs={obs} onDone={invalidate} showToast={showToast} />
          )}
          {obs.status === 'CERTIFIED' && <CertifiedSummary obs={obs} />}
        </div>
      </div>
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ obs, currentStageIdx }: { obs: SopObservationDetail; currentStageIdx: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto' }}>
      {STAGES.map((stage, idx) => {
        const done = idx < currentStageIdx || obs.status === 'CERTIFIED';
        const active = idx === currentStageIdx && obs.status !== 'CERTIFIED';
        const name = obs[stage.nameKey];
        const at = obs[stage.atKey];
        return (
          <React.Fragment key={stage.status}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 140, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? C.successSoft : active ? C.primarySoft : C.divider,
                color: done ? C.success : active ? C.primary : C.mutedSoft,
                fontSize: 13, fontWeight: 700, border: active ? `2px solid ${C.primary}` : 'none',
              }}>
                {done ? <FontAwesomeIcon icon={faCircleCheck} /> : idx + 1}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: done || active ? C.text : C.mutedSoft }}>{stage.role}</div>
                {name && at ? (
                  <div style={{ fontSize: 10.5, color: C.mutedSoft, marginTop: 1 }}>{name} · {fmtDate(at)}</div>
                ) : active ? (
                  <div style={{ fontSize: 10.5, color: C.primary, marginTop: 1, fontWeight: 600 }}>In progress</div>
                ) : (
                  <div style={{ fontSize: 10.5, color: C.mutedSoft, marginTop: 1 }}>—</div>
                )}
              </div>
            </div>
            {idx < STAGES.length - 1 && (
              <div style={{ height: 2, flex: 1, minWidth: 40, marginTop: 14, background: idx < currentStageIdx || obs.status === 'CERTIFIED' ? C.success : C.divider }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Stage 1: Trainer (trains against the checklist, doesn't score it) ───────

function TrainerStage({ obs, onDone, showToast }: {
  obs: SopObservationDetail; onDone: () => void; showToast: (msg: string, kind?: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const trainerName = obs.assignedTrainerName ?? 'Trainer';

  const submit = async () => {
    setSaving(true);
    try {
      await advanceStage(obs.id, { trainerName, trainerAt: today() });
      showToast('Sent to assessor');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Group by section, preserving displayOrder within each.
  const sections: string[] = [];
  for (const r of obs.stepResults) if (!sections.includes(r.section)) sections.push(r.section);

  return (
    <div>
      <h3 style={s.cardTitle}>Trainer observation</h3>
      <p style={s.cardSub}>Train the employee against each step below. The assessor marks pass/fail — this is your reference checklist.</p>

      {sections.map(sec => (
        <div key={sec} style={{ marginBottom: 18 }}>
          <div style={s.sectionLabel}>{sec}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {obs.stepResults.filter(r => r.section === sec).map((r, idx) => (
              <div key={r.sopStepId} style={s.stepCard}>
                <span style={s.stepNumber}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{r.title}</div>
                  {r.detail && <div style={s.stepDetailText}>{r.detail}</div>}
                  {r.passed === 'FAIL' && (
                    <div style={{ marginTop: 6, fontSize: 12.5, color: C.danger }}>
                      <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />
                      Failed at the last assessment{r.note ? ` — ${r.note}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={s.autoRow}>
        Confirming as <strong>{trainerName}</strong> on {fmtDate(new Date().toISOString())}.
      </div>
      <button onClick={submit} disabled={saving} style={{ ...s.primaryBtn, opacity: saving ? 0.5 : 1, marginTop: 14 }}>
        <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
        {saving ? 'Saving…' : 'Confirm training'}
      </button>
    </div>
  );
}

// ── Stage 2: Assessor (marks the checklist, then certifies) ─────────────────

function AssessorStage({ obs, onDone, showToast }: {
  obs: SopObservationDetail; onDone: () => void; showToast: (msg: string, kind?: string) => void;
}) {
  // Marked on levels (Settings → Practice observations, copied when assigned) or pass / fail.
  const marking = markingOfObservation(obs.marking);
  const onLevels = marking.inputType === 'LEVELS';
  const [results, setResults] = useState<Record<string, { passed: StepResultValue; note: string; level?: number | null }>>(
    () => Object.fromEntries(obs.stepResults.map(r => [r.sopStepId, { passed: r.passed, note: r.note ?? '', level: r.level ?? null }])),
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const assessorName = currentUserName();

  const setResult = (stepId: string, patch: Partial<{ passed: StepResultValue; note: string; level: number | null }>) => {
    setResults(prev => ({ ...prev, [stepId]: { ...prev[stepId], ...patch } }));
  };

  const allDecided = obs.stepResults.every(r => results[r.sopStepId]?.passed !== 'NA');
  const blocker = certifyProblem(obs.stepResults.map(r => results[r.sopStepId]?.passed ?? 'NA'));
  const anyFailed = obs.stepResults.some(r => results[r.sopStepId]?.passed === 'FAIL');
  const liveScore = computeScore(obs.stepResults.map(r => ({ passed: results[r.sopStepId]?.passed ?? 'NA' })));
  const levelAverage = onLevels ? levelsScore(marking.levels, obs.stepResults.map(r => results[r.sopStepId]?.level ?? null)) : null;

  const currentStepResults = () => obs.stepResults.map(r => (onLevels
    ? { stepId: r.sopStepId, level: results[r.sopStepId]?.level ?? -1, note: results[r.sopStepId]?.note || null }
    : { stepId: r.sopStepId, passed: results[r.sopStepId]?.passed ?? 'NA', note: results[r.sopStepId]?.note || null }));

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      await saveStepResultsDraft(obs.id, currentStepResults());
      showToast('Draft saved');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save draft', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await advanceStage(obs.id, {
        assessorName,
        assessorAt: today(),
        notes: notes.trim() || null,
        stepResults: currentStepResults(),
      });
      showToast('Observation certified');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendBack = async () => {
    setSaving(true);
    try {
      await sendBackForTraining(obs.id, currentStepResults(), notes.trim() || null);
      showToast('Sent back to the trainer');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Group by section, preserving displayOrder within each.
  const sections: string[] = [];
  for (const r of obs.stepResults) if (!sections.includes(r.section)) sections.push(r.section);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
        <h3 style={s.cardTitle}>Assessor review</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(onLevels ? levelAverage : liveScore.percent) !== null && (
            <span style={{ ...s.scoreBadge, background: (onLevels ? levelAverage! : liveScore.percent!) >= 80 ? C.successSoft : C.dangerSoft, color: (onLevels ? levelAverage! : liveScore.percent!) >= 80 ? C.success : C.danger }}>
              {liveScore.passed}/{liveScore.decided} passed · {onLevels ? `average ${levelAverage}%` : `${liveScore.percent}%`}
            </span>
          )}
          <button onClick={saveDraft} disabled={saving || savingDraft} style={{ ...s.secondaryBtn, padding: '6px 12px', fontSize: 12, opacity: saving || savingDraft ? 0.5 : 1 }}>
            <FontAwesomeIcon icon={faFloppyDisk} style={{ marginRight: 5 }} />
            {savingDraft ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </div>
      {obs.stepResults.length === 0 && (
        <div role="status" style={{ margin: '12px 0', padding: '12px 14px', borderRadius: 10, background: '#fffbeb', color: '#92400e', fontSize: 13.5, lineHeight: 1.5 }}>
          <strong>{obs.templateTitle ?? 'This guide'} has no steps yet</strong>, so there’s nothing to mark. Add its steps in the guide — they’ll show here to mark.{' '}
          <a href={`/operations/sops/${obs.sopTemplateId}`} style={{ color: C.primary, fontWeight: 600 }}>Open the guide</a>
        </div>
      )}
      <p style={s.cardSub}>{onLevels ? `Go through each step and pick its level — ${passMarkText(marking.levels, marking.passMark)} passes. N/A isn’t counted.` : 'Go through each step and mark the result.'}</p>

      {sections.map(sec => (
        <div key={sec} style={{ marginBottom: 18 }}>
          <div style={s.sectionLabel}>{sec}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {obs.stepResults.filter(r => r.section === sec).map((r, idx) => {
              const val = results[r.sopStepId]?.passed ?? 'NA';
              return (
                <div key={r.sopStepId} style={s.stepCard}>
                  <span style={s.stepNumber}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{r.title}</div>
                    {r.detail && <div style={s.stepDetailText}>{r.detail}</div>}
                    {val === 'FAIL' && (
                      <input
                        style={{ ...s.input, marginTop: 8, fontSize: 12.5 }}
                        placeholder="What went wrong? (exception note)"
                        value={results[r.sopStepId]?.note ?? ''}
                        onChange={e => setResult(r.sopStepId, { note: e.target.value })}
                      />
                    )}
                  </div>
                  {onLevels ? (
                    <LevelButtons levels={marking.levels} passMark={marking.passMark} level={results[r.sopStepId]?.level ?? null}
                      onPick={level => setResult(r.sopStepId, { level, passed: passedForLevel(marking.levels, marking.passMark, level), ...(passedForLevel(marking.levels, marking.passMark, level) !== 'FAIL' ? { note: '' } : {}) })} />
                  ) : (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {(['PASS', 'FAIL', 'NA'] as StepResultValue[]).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setResult(r.sopStepId, { passed: opt, ...(opt !== 'FAIL' ? { note: '' } : {}) })}
                        style={{
                          ...s.pillBtn,
                          background: val === opt ? (opt === 'PASS' ? C.successSoft : opt === 'FAIL' ? C.dangerSoft : C.divider) : '#fff',
                          color: val === opt ? (opt === 'PASS' ? C.success : opt === 'FAIL' ? C.danger : C.muted) : C.mutedSoft,
                          borderColor: val === opt ? (opt === 'PASS' ? C.success : opt === 'FAIL' ? C.danger : C.mutedSoft) : C.cardBorder,
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 4 }}>
        <label style={s.label}>Notes (optional)</label>
        <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      {!allDecided && (
        <p style={{ fontSize: 12, color: '#92400e', margin: '10px 0 0' }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />
          Some steps are still marked N/A.
        </p>
      )}
      <div style={s.autoRow}>
        Certifying as <strong>{assessorName}</strong> on {fmtDate(new Date().toISOString())}.
      </div>
      {blocker && <p role="status" style={{ fontSize: 12.5, color: anyFailed ? C.danger : C.muted, margin: '10px 0 0', textAlign: 'right' }}>{blocker}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' as const }}>
        <button onClick={saveDraft} disabled={saving || savingDraft} style={{ ...s.secondaryBtn, opacity: saving || savingDraft ? 0.5 : 1 }}>
          <FontAwesomeIcon icon={faFloppyDisk} style={{ marginRight: 6 }} />
          {savingDraft ? 'Saving…' : 'Save draft'}
        </button>
        {anyFailed && (
          <button onClick={sendBack} disabled={saving || savingDraft} style={{ ...s.secondaryBtn, color: C.danger, borderColor: C.danger, opacity: saving || savingDraft ? 0.5 : 1 }}>
            <FontAwesomeIcon icon={faRotateLeft} style={{ marginRight: 6 }} />
            Needs more training
          </button>
        )}
        <button onClick={submit} disabled={saving || savingDraft || !!blocker} title={blocker ?? undefined}
          style={{ ...s.primaryBtn, opacity: saving || savingDraft || blocker ? 0.5 : 1, cursor: saving || savingDraft || blocker ? 'default' : 'pointer' }}>
          <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
          {saving ? 'Saving…' : 'Certify'}
        </button>
      </div>
    </div>
  );
}

/** One step marked on levels: a button per level (green at or above the pass mark, red below — with its name), then N/A. */
function LevelButtons({ levels, passMark, level, onPick }: { levels: MarkLevel[]; passMark: number; level: number | null; onPick: (level: number | null) => void }) {
  const opts = [...levels.map((l, i) => ({ i, label: l.label, title: `${l.score}%`, pass: l.score >= passMark })), { i: -1, label: 'N/A', title: 'Not counted', pass: null as boolean | null }];
  return (
    <div role="radiogroup" aria-label="Level" style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 320 }}>
      {opts.map(o => {
        const on = o.i === -1 ? level == null : level === o.i;
        const fg = o.pass === null ? C.muted : o.pass ? C.success : C.danger;
        const bg = o.pass === null ? C.divider : o.pass ? C.successSoft : C.dangerSoft;
        return (
          <button key={o.i} type="button" role="radio" aria-checked={on} title={o.title} onClick={() => onPick(o.i === -1 ? null : o.i)}
            style={{ ...s.pillBtn, background: on ? bg : '#fff', color: on ? fg : C.mutedSoft, borderColor: on ? fg : C.cardBorder }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Certified (read-only) ─────────────────────────────────────────────────────

function CertifiedSummary({ obs }: { obs: SopObservationDetail }) {
  const failedSteps = obs.stepResults.filter(r => r.passed === 'FAIL');
  const score = computeScore(obs.stepResults);
  const marking = markingOfObservation(obs.marking);
  const levelName = (r: { level?: number | null; passed: StepResultValue }) => (marking.inputType === 'LEVELS' && r.level != null ? marking.levels[r.level]?.label ?? r.passed : r.passed);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FontAwesomeIcon icon={faCircleCheck} style={{ color: C.success, fontSize: 18 }} />
          <h3 style={{ ...s.cardTitle, margin: 0 }}>Certified</h3>
        </div>
        {score.percent !== null && (
          <span style={{ ...s.scoreBadge, background: score.percent >= 80 ? C.successSoft : C.dangerSoft, color: score.percent >= 80 ? C.success : C.danger }}>
            {score.passed}/{score.decided} passed · {score.percent}%
          </span>
        )}
      </div>
      <p style={s.cardSub}>{obs.stepResults.length} step(s) observed, {failedSteps.length} flagged.{obs.notes ? ` Notes: ${obs.notes}` : ''}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
        {obs.stepResults.map(r => (
          <div key={r.sopStepId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{
              ...s.miniPill,
              background: r.passed === 'PASS' ? C.successSoft : r.passed === 'FAIL' ? C.dangerSoft : C.divider,
              color: r.passed === 'PASS' ? C.success : r.passed === 'FAIL' ? C.danger : C.muted,
            }}>{levelName(r)}</span>
            <span style={{ color: C.textSub }}>{r.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 900, margin: '0 auto' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 10px', marginBottom: 14,
    border: 'none', background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  heading: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted },
  goal: { margin: '8px 0 0', fontSize: 12.5, color: C.textSub, lineHeight: 1.6, maxWidth: 640 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW,
  },
  cardTitle: { margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: C.text },
  cardSub: { margin: '0 0 16px', fontSize: 12.5, color: C.muted },
  scoreBadge: {
    display: 'inline-flex', alignItems: 'center', padding: '4px 11px', borderRadius: 999,
    fontSize: 12, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' as const,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const,
    letterSpacing: '0.04em', marginBottom: 8,
  },
  autoRow: { fontSize: 12.5, color: C.muted },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6 },
  input: {
    width: '100%', padding: '9px 11px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box', fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  stepCard: {
    display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 10, background: '#fff',
  },
  stepNumber: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: '50%', fontSize: 10.5, fontWeight: 700,
    flexShrink: 0, marginTop: 1, background: C.primarySoft, color: C.primary,
  },
  stepDetailText: {
    fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-line' as const,
  },
  pillBtn: {
    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
    border: '1px solid', cursor: 'pointer', background: '#fff',
  },
  miniPill: {
    padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 34, textAlign: 'center' as const,
  },
};

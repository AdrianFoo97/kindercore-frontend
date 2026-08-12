import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCheck, faCircleCheck, faCircleExclamation, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchObservation, advanceStage, SopObservationDetail, SopObservationStatus, StepResultValue,
} from '../api/sop-observations.js';
import { useToast } from '../components/common/Toast.js';

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
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

const STAGES: { status: SopObservationStatus; role: string; nameKey: 'completedByName' | 'trainerName' | 'assessorName' | 'followUp1Name' | 'followUp2Name'; atKey: 'completedAt' | 'trainerAt' | 'assessorAt' | 'followUp1At' | 'followUp2At' }[] = [
  { status: 'PENDING_TRAINEE', role: 'Trainee', nameKey: 'completedByName', atKey: 'completedAt' },
  { status: 'PENDING_TRAINER', role: 'Trainer', nameKey: 'trainerName', atKey: 'trainerAt' },
  { status: 'PENDING_ASSESSOR', role: 'Assessor', nameKey: 'assessorName', atKey: 'assessorAt' },
  { status: 'PENDING_FOLLOWUP_1', role: 'Follow-up 1', nameKey: 'followUp1Name', atKey: 'followUp1At' },
  { status: 'PENDING_FOLLOWUP_2', role: 'Follow-up 2', nameKey: 'followUp2Name', atKey: 'followUp2At' },
];
const STAGE_ORDER: SopObservationStatus[] = [...STAGES.map(s => s.status), 'CERTIFIED'];

function today() {
  return new Date().toISOString().split('T')[0];
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
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
      <div style={s.page}>
        <div style={s.inner}>
          <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
        </div>
      </div>
    );
  }

  const currentStageIdx = STAGE_ORDER.indexOf(obs.status);

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <button onClick={() => navigate('/hr/sop-observations')} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
          SOP Observations
        </button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={s.heading}>{obs.templateTitle}</h1>
          <p style={s.subheading}>{obs.teacherName}</p>
          {obs.templateGoal && <p style={s.goal}>{obs.templateGoal}</p>}
        </div>

        <div style={{ ...s.card, marginBottom: 20 }}>
          <Timeline obs={obs} currentStageIdx={currentStageIdx} />
        </div>

        <div style={s.card}>
          {obs.status === 'PENDING_TRAINEE' && (
            <TraineeStage observationId={obs.id} onDone={invalidate} showToast={showToast} />
          )}
          {obs.status === 'PENDING_TRAINER' && (
            <TrainerStage obs={obs} onDone={invalidate} showToast={showToast} />
          )}
          {obs.status === 'PENDING_ASSESSOR' && (
            <AssessorStage obs={obs} onDone={invalidate} showToast={showToast} />
          )}
          {obs.status === 'PENDING_FOLLOWUP_1' && (
            <FollowUpStage
              key="fu1" stageLabel="Follow-up 1" observationId={obs.id}
              field="followUp1Name" atField="followUp1At"
              onDone={invalidate} showToast={showToast}
            />
          )}
          {obs.status === 'PENDING_FOLLOWUP_2' && (
            <FollowUpStage
              key="fu2" stageLabel="Follow-up 2" observationId={obs.id}
              field="followUp2Name" atField="followUp2At"
              onDone={invalidate} showToast={showToast}
            />
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
    <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
      {STAGES.map((stage, idx) => {
        const done = idx < currentStageIdx || obs.status === 'CERTIFIED';
        const active = idx === currentStageIdx && obs.status !== 'CERTIFIED';
        const name = obs[stage.nameKey];
        const at = obs[stage.atKey];
        return (
          <div key={stage.status} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 140 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
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
              <div style={{ height: 2, flex: 0.5, background: idx < currentStageIdx || obs.status === 'CERTIFIED' ? C.success : C.divider, marginTop: -20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stage 1: Trainee ─────────────────────────────────────────────────────────

function TraineeStage({ observationId, onDone, showToast }: {
  observationId: string; onDone: () => void; showToast: (msg: string, kind?: string) => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await advanceStage(observationId, { completedByName: name.trim(), completedAt: date });
      showToast('Completion recorded — sent to trainer');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 style={s.cardTitle}>Trainee completion</h3>
      <p style={s.cardSub}>The employee confirms they've completed the procedure and are ready to be observed.</p>
      <div style={s.formRow}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Completed by</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Employee name" />
        </div>
        <div style={{ width: 180 }}>
          <label style={s.label}>Date</label>
          <input style={s.input} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <button onClick={submit} disabled={!name.trim() || saving} style={{ ...s.primaryBtn, opacity: !name.trim() || saving ? 0.5 : 1, marginTop: 14 }}>
        <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
        {saving ? 'Saving…' : 'Confirm completion'}
      </button>
    </div>
  );
}

// ── Stage 2: Trainer (full checklist) ────────────────────────────────────────

function TrainerStage({ obs, onDone, showToast }: {
  obs: SopObservationDetail; onDone: () => void; showToast: (msg: string, kind?: string) => void;
}) {
  const [results, setResults] = useState<Record<string, { passed: StepResultValue; note: string }>>(
    () => Object.fromEntries(obs.stepResults.map(r => [r.sopStepId, { passed: r.passed, note: r.note ?? '' }])),
  );
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const setResult = (stepId: string, patch: Partial<{ passed: StepResultValue; note: string }>) => {
    setResults(prev => ({ ...prev, [stepId]: { ...prev[stepId], ...patch } }));
  };

  const allDecided = obs.stepResults.every(r => results[r.sopStepId]?.passed !== 'NA');

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await advanceStage(obs.id, {
        trainerName: name.trim(),
        trainerAt: date,
        stepResults: obs.stepResults.map(r => ({
          stepId: r.sopStepId,
          passed: results[r.sopStepId]?.passed ?? 'NA',
          note: results[r.sopStepId]?.note || null,
        })),
      });
      showToast('Observation submitted — sent to assessor');
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
      <p style={s.cardSub}>Watch the employee perform each step and record the result.</p>

      {sections.map(sec => (
        <div key={sec} style={{ marginBottom: 18 }}>
          <div style={s.sectionLabel}>{sec}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {obs.stepResults.filter(r => r.section === sec).map(r => {
              const val = results[r.sopStepId]?.passed ?? 'NA';
              return (
                <div key={r.sopStepId} style={s.stepCard}>
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
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={s.formRow}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Trainer name</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Trainer name" />
        </div>
        <div style={{ width: 180 }}>
          <label style={s.label}>Date</label>
          <input style={s.input} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      {!allDecided && (
        <p style={{ fontSize: 12, color: '#92400e', margin: '10px 0 0' }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />
          Some steps are still marked N/A.
        </p>
      )}
      <button onClick={submit} disabled={!name.trim() || saving} style={{ ...s.primaryBtn, opacity: !name.trim() || saving ? 0.5 : 1, marginTop: 14 }}>
        <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
        {saving ? 'Saving…' : 'Submit observation'}
      </button>
    </div>
  );
}

// ── Stage 3: Assessor (read-only summary + certify) ─────────────────────────

function AssessorStage({ obs, onDone, showToast }: {
  obs: SopObservationDetail; onDone: () => void; showToast: (msg: string, kind?: string) => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const failedSteps = obs.stepResults.filter(r => r.passed === 'FAIL');

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await advanceStage(obs.id, { assessorName: name.trim(), assessorAt: date, notes: notes.trim() || null });
      showToast('Certification stage recorded — moved to follow-up');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 style={s.cardTitle}>Assessor review</h3>
      <p style={s.cardSub}>Trainer's observation summary — {obs.stepResults.length} step(s), {failedSteps.length} failed.</p>

      {failedSteps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {failedSteps.map(r => (
            <div key={r.sopStepId} style={s.failCard}>
              <FontAwesomeIcon icon={faCircleExclamation} style={{ color: C.danger, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.title}</div>
                {r.note && <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{r.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {obs.stepResults.map(r => (
          <div key={r.sopStepId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{
              ...s.miniPill,
              background: r.passed === 'PASS' ? C.successSoft : r.passed === 'FAIL' ? C.dangerSoft : C.divider,
              color: r.passed === 'PASS' ? C.success : r.passed === 'FAIL' ? C.danger : C.muted,
            }}>{r.passed}</span>
            <span style={{ color: C.textSub }}>{r.title}</span>
          </div>
        ))}
      </div>

      <div style={s.formRow}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Assessor name</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Assessor name" />
        </div>
        <div style={{ width: 180 }}>
          <label style={s.label}>Date</label>
          <input style={s.input} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={s.label}>Notes (optional)</label>
        <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <button onClick={submit} disabled={!name.trim() || saving} style={{ ...s.primaryBtn, opacity: !name.trim() || saving ? 0.5 : 1, marginTop: 14 }}>
        <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
        {saving ? 'Saving…' : 'Certify stage'}
      </button>
    </div>
  );
}

// ── Stage 4/5: Follow-up ──────────────────────────────────────────────────────

function FollowUpStage({ stageLabel, observationId, field, atField, onDone, showToast }: {
  stageLabel: string;
  observationId: string;
  field: 'followUp1Name' | 'followUp2Name';
  atField: 'followUp1At' | 'followUp2At';
  onDone: () => void;
  showToast: (msg: string, kind?: string) => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = field === 'followUp1Name'
        ? { followUp1Name: name.trim(), followUp1At: date, notes: notes.trim() || null }
        : { followUp2Name: name.trim(), followUp2At: date, notes: notes.trim() || null };
      await advanceStage(observationId, payload);
      showToast(field === 'followUp1Name' ? 'Follow-up 1 recorded' : 'Certified');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 style={s.cardTitle}>{stageLabel}</h3>
      <p style={s.cardSub}>Spot-check that the procedure is still being followed correctly.</p>
      <div style={s.formRow}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Checked by</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
        </div>
        <div style={{ width: 180 }}>
          <label style={s.label}>Date</label>
          <input style={s.input} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={s.label}>Notes (optional)</label>
        <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <button onClick={submit} disabled={!name.trim() || saving} style={{ ...s.primaryBtn, opacity: !name.trim() || saving ? 0.5 : 1, marginTop: 14 }}>
        <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
        {saving ? 'Saving…' : 'Confirm follow-up'}
      </button>
    </div>
  );
}

// ── Certified (read-only) ─────────────────────────────────────────────────────

function CertifiedSummary({ obs }: { obs: SopObservationDetail }) {
  const failedSteps = obs.stepResults.filter(r => r.passed === 'FAIL');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <FontAwesomeIcon icon={faCircleCheck} style={{ color: C.success, fontSize: 18 }} />
        <h3 style={{ ...s.cardTitle, margin: 0 }}>Certified</h3>
      </div>
      <p style={s.cardSub}>{obs.stepResults.length} step(s) observed, {failedSteps.length} flagged.{obs.notes ? ` Notes: ${obs.notes}` : ''}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
        {obs.stepResults.map(r => (
          <div key={r.sopStepId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{
              ...s.miniPill,
              background: r.passed === 'PASS' ? C.successSoft : r.passed === 'FAIL' ? C.dangerSoft : C.divider,
              color: r.passed === 'PASS' ? C.success : r.passed === 'FAIL' ? C.danger : C.muted,
            }}>{r.passed}</span>
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
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const,
    letterSpacing: '0.04em', marginBottom: 8,
  },
  formRow: { display: 'flex', gap: 12 },
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
  stepCard: {
    display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 10, background: '#fff',
  },
  stepDetailText: {
    fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-line' as const,
  },
  pillBtn: {
    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
    border: '1px solid', cursor: 'pointer', background: '#fff',
  },
  failCard: {
    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
    background: C.dangerSoft, marginBottom: 6,
  },
  miniPill: {
    padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 34, textAlign: 'center' as const,
  },
};

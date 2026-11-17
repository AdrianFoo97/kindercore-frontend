import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.js';
import { MODULES } from '../../constants/authModules.js';
import { stageOf } from './appraisalsList.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateLeft, faUserCheck } from '@fortawesome/free-solid-svg-icons';
import {
  TASKS_KEY, fetchAppraisalRun, runKey, saveAppraisalScores, submitAppraisal, type AppraisalRun,
} from '../../api/appraisal-runs.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import { useToast } from '../../components/common/Toast.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useGoBack } from '../../hooks/useGoBack.js';
import {
  allInputs, isDirty, invalidInputs, notesFrom, progressOf, scoresPayload, sendBackReason, submitBlocker, valuesFrom,
  type Notes, type Values,
} from './appraisalRun.js';
import RunCriteria from './RunCriteria.js';
import { useKeepDraftOnLeave } from './useKeepDraftOnLeave.js';
import RunScoreSummary from './RunScoreSummary.js';
import RunHeader from './RunHeader.js';
import OwnAppraisalSummary, { OwnAppraisalComments } from './OwnAppraisalSummary.js';
import { totalScore } from './liveScore.js';
import { RunCommentsList, RunMarksReview } from './RunReview.js';
import { ACTION_BAR_SPACE, type RunStep } from './RunActions.js';
import { RunSteps } from './RunSteps.js';
import { RunActions } from './RunActions.js';
import { ADMIN, TEACHER, card, type RunPalette } from './runTheme.js';

/**
 * One appraisal: the exact form version it's scored on, the scores, and the
 * step it's at. Whoever's turn it is acts here — the scorer scores and
 * submits, a signer signs off or sends it back, the staff member confirms
 * they've read it. Everyone else (HR, people on its steps) can read it.
 * Opened from the admin site, or from the teacher app with ?app=teacher.
 */
/** Fills a 13-inch laptop (1280–1440px wide) less the page's side padding. */
const RUN_PAGE_MAX_WIDTH = 1200;

export default function AppraisalRunPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const inTeacherApp = params.get('app') === 'teacher';
  const palette = inTeacherApp ? TEACHER : ADMIN;
  const { isMobile } = useIsMobile();
  const { data: run, isPending, error } = useQuery({ queryKey: runKey(id), queryFn: () => fetchAppraisalRun(id), retry: false });

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px 48px', paddingBottom: ACTION_BAR_SPACE + 24, fontFamily: palette.font, background: palette.bg, minHeight: '100%' }}>
      {/* Wide enough to use a 13-inch laptop's whole screen (criterion list + criterion | score | comment). */}
      <div style={{ maxWidth: RUN_PAGE_MAX_WIDTH, margin: '0 auto', paddingTop: inTeacherApp ? TEACHER_CONTENT_TOP : 0 }}>
        {isPending && <LoadingSpinner />}
        {error && (
          <div role="alert" style={{ ...card(palette), color: palette.red, fontSize: 14 }}>
            {(error as Error).message || 'Couldn’t open this appraisal.'}
          </div>
        )}
        {run && <RunEditor key={run.id} run={run} palette={palette} mobile={isMobile} inTeacherApp={inTeacherApp} />}
      </div>
    </div>
  );
}

function RunEditor({ run, palette: p, mobile, inTeacherApp }: { run: AppraisalRun; palette: RunPalette; mobile: boolean; inTeacherApp: boolean }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const saved = useMemo(() => valuesFrom(run.scores), [run.scores]);
  const [values, setValues] = useState<Values>(saved);
  const savedNotes = useMemo(() => notesFrom(run.scores), [run.scores]);
  const [notes, setNotes] = useState<Notes>(savedNotes);
  const [comments, setComments] = useState(run.comments ?? '');
  const inputs = useMemo(() => allInputs(run.form.sections), [run.form.sections]);
  const goBack = useGoBack('/hr/appraisals');
  const navigate = useNavigate();
  const { hasModule } = usePermissions();
  /**
   * After Save draft / Submit: HR goes to HRMS → Appraisals for its month, on the tab it's now in
   * (In progress, Sign-off, Staff to confirm or Done). Anyone else — e.g. a supervisor scoring from the
   * teacher app — goes back to where they came from.
   */
  const afterward = (next: AppraisalRun) => {
    if (inTeacherApp || !hasModule(MODULES.HR)) { goBack(); return; }
    navigate(`/hr/appraisals?year=${next.period.year}&month=${next.period.month}&tab=${stageOf(next.status, next.scores.some(s => s.rawValue != null))}`);
  };
  /** The criterion open — shared by the criteria and the score panel (click a criterion there to open it). */
  const [current, setCurrent] = useState(0);
  /** Score (one criterion at a time) → Comments (read them back, write overall comments) → Review (marks) → Submit. */
  const [step, setStep] = useState<RunStep>('score');
  const goStep = (s: RunStep) => { setStep(s); document.getElementById('run-top')?.scrollIntoView({ block: 'start' }); };
  const editing = run.can.score;
  const dirty = editing && isDirty(inputs, values, saved, comments, run.comments, notes, savedNotes);
  const invalid = invalidInputs(inputs, values).length > 0;
  // Leaving with unsaved marks (Back, a tab, a link) keeps them as a draft; closing the tab asks first.
  const leaving = useKeepDraftOnLeave(dirty && !invalid, async () => {
    qc.setQueryData(runKey(run.id), await saveAppraisalScores(run.id, scoresPayload(inputs, values, notes), comments.trim() || null));
    qc.invalidateQueries({ queryKey: TASKS_KEY });
    showToast('Draft saved');
  });

  /** Show what the server now holds, and refresh the lists that show this appraisal. */
  const settle = (next: AppraisalRun) => {
    leaving.settled();
    qc.setQueryData(runKey(run.id), next);
    setValues(valuesFrom(next.scores));
    setNotes(notesFrom(next.scores));
    setComments(next.comments ?? '');
    qc.invalidateQueries({ queryKey: TASKS_KEY });
    qc.invalidateQueries({ queryKey: ['appraisal-overview'] });
    // Once finished it becomes that month's score — refresh their history, average and career readiness everywhere.
    qc.invalidateQueries({ queryKey: ['teacher-appraisals', next.teacherId] });
    qc.invalidateQueries({ queryKey: ['teacher-career', next.teacherId] });
    qc.invalidateQueries({ queryKey: ['appraisal-schedules'] });
  };
  const save = useMutation({
    mutationFn: () => saveAppraisalScores(run.id, scoresPayload(inputs, values, notes), comments.trim() || null),
    // Saved — on to HRMS → Appraisals, In progress, for its month (or back, for someone without HR).
    onSuccess: next => { settle(next); showToast('Draft saved'); afterward(next); },
  });
  // Submitting saves anything unsaved first, so what's submitted is what's on screen.
  const submit = useMutation({
    mutationFn: async () => {
      if (dirty) await saveAppraisalScores(run.id, scoresPayload(inputs, values, notes), comments.trim() || null);
      return submitAppraisal(run.id);
    },
    onSuccess: next => { settle(next); showToast(next.status === 'COMPLETED' ? 'Appraisal completed' : 'Submitted for sign-off'); afterward(next); },
  });

  const sentBack = sendBackReason(run);
  /** The staff member reading their own appraisal in the teacher app — not a scorer or approver opening someone else's. */
  const own = inTeacherApp && run.mine && !editing;
  const score = (
    <RunScoreSummary sections={run.form.sections} values={values} policy={run.form.missingPolicy} current={current} onJump={setCurrent}
      editing={editing} palette={p} mobile={mobile} />
  );
  const scoreError = (save.error ?? submit.error) as Error | null;

  return (
    <>
      {/* Their own: the title sits inside the score card (OwnAppraisalSummary). */}
      {!own && <RunHeader run={run} palette={p} mobile={mobile} step={editing ? step : null} onStep={goStep} />}

      {/* The steps are for people following it along — not for the staff member reading their own. */}
      {!editing && !inTeacherApp && <RunSteps run={run} palette={p} />}

      {sentBack && (
        <div role="status" style={{ ...card(p), background: p.redSoft, borderColor: '#fecaca', display: 'flex', gap: 12 }}>
          <FontAwesomeIcon icon={faRotateLeft} style={{ color: p.red, marginTop: 3 }} />
          <div style={{ fontSize: 14, color: p.text, lineHeight: 1.5 }}>
            <strong>Sent back{sentBack.authorName ? ` by ${sentBack.authorName}` : ''}</strong>
            {sentBack.detail && <div>{sentBack.detail}</div>}
          </div>
        </div>
      )}

      {run.signOffBySomeoneAbove && (
        <div role="status" style={{ ...card(p), background: p.accentSoft, display: 'flex', gap: 12 }}>
          <FontAwesomeIcon icon={faUserCheck} style={{ color: p.accent, marginTop: 3 }} />
          <div style={{ fontSize: 14, color: p.text, lineHeight: 1.5 }}>
            <strong>You scored this one</strong>
            <div>So someone above you in the reporting line signs it off.</div>
          </div>
        </div>
      )}

      {/* Their own (teacher app): score, then their appraiser's words, then the breakdown. Everyone else: the score card with its section tiles. */}
      {own ? <OwnAppraisalSummary run={run} total={totalScore(run.form.sections, values, run.form.missingPolicy)} palette={p} /> : score}
      {/* Scoring: one criterion at a time. Reviewing (and for anyone just reading it): everything at once, with every comment. */}
      {editing && step === 'score' && (
        <RunCriteria sections={run.form.sections} values={values} readOnly={false} byCriterion={run.byCriterion} policy={run.form.missingPolicy} palette={p} mobile={mobile}
          current={current} onCurrent={setCurrent}
          onChange={(key, v) => setValues(prev => ({ ...prev, [key]: v }))}
          notes={notes} onNote={(key, v) => setNotes(prev => ({ ...prev, [key]: v }))} />
      )}
      {/* Read back every comment, then the overall comments below (step 2; always for someone just reading it). */}
      {/* The scorer reads their comments back in step 2; anyone else reads each one from its icon in the marks. */}
      {editing && step === 'comments' && <RunCommentsList sections={run.form.sections} values={values} notes={notes} palette={p} />}
      {/* The marks, section by section (step 3; for readers, first). */}
      {(!editing || step === 'review') && <RunMarksReview sections={run.form.sections} values={values} notes={notes} policy={run.form.missingPolicy} palette={p}
        detailHref={editing ? undefined : cid => `/appraisals/${run.id}/criteria/${cid}${inTeacherApp ? '?app=teacher' : ''}`} />}

      {/* Overall comments are written in step 2, after reading back the comments. */}
      {own && <OwnAppraisalComments comments={run.comments} palette={p} />}
      {!own && (!editing || step === 'comments') && <section style={card(p)}>
        <label htmlFor="run-comments" style={{ display: 'block', fontSize: 15, fontWeight: 700, color: p.text, marginBottom: 8 }}>Overall comments</label>
        {editing ? (
          <textarea id="run-comments" rows={4} value={comments} onChange={e => setComments(e.target.value)} maxLength={5000}
            placeholder="What went well, what to work on"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: mobile ? 16 : 14, fontFamily: 'inherit', color: p.text,
              border: `1px solid ${p.borderStrong}`, borderRadius: 8, outline: 'none', resize: 'vertical' }} />
        ) : (
          <p id="run-comments" style={{ margin: 0, fontSize: 14, color: run.comments ? p.sub : p.muted, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {run.comments || 'No comments.'}
          </p>
        )}
      </section>}

      {scoreError && <p role="alert" style={{ color: p.red, fontSize: 14 }}>{scoreError.message}</p>}

      {/* Signed off, sent back or confirmed: show the new state, then on to the Appraisals tab it's now on. */}
      <RunActions run={run} palette={p} mobile={mobile} onSettled={next => { settle(next); afterward(next); }}
        scoring={editing ? {
          canSave: dirty && !invalid, saving: save.isPending, onSave: () => save.mutate(),
          blocker: submitBlocker(run.form.sections, run.form.missingPolicy, values), submitting: submit.isPending, onSubmit: () => submit.mutateAsync(),
          step, onStep: goStep,
          canDiscard: dirty,
          onDiscard: () => { setValues(saved); setNotes(savedNotes); setComments(run.comments ?? ''); },
        } : null} />

    </>
  );
}


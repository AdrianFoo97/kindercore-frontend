import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { acknowledgeAppraisal, approveAppraisal, sendBackAppraisal, type AppraisalRun } from '../../api/appraisal-runs.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import FormModal from '../../components/common/FormModal.js';
import { useToast } from '../../components/common/Toast.js';
import { periodLabel, signOffOutcome } from './appraisalRun.js';
import { button, card, type RunPalette } from './runTheme.js';

const REASON_MAX = 1000;

/** The scorer's steps: give marks, read back comments and write overall comments, review the marks. */
export type RunStep = 'score' | 'comments' | 'review';

/** Room kept free at the bottom of the page for the pinned action bar. */
export const ACTION_BAR_SPACE = 96;

export interface ScoringActions {
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  /** Why it can't be submitted yet (null = it can). */
  blocker: string | null;
  submitting: boolean;
  onSubmit: () => Promise<unknown>;
  /** Unsaved changes there are to throw away. */
  canDiscard: boolean;
  /** Back to what was last saved (scores, comments, overall comments). */
  onDiscard: () => void;
  /** Which step: score → comments (overall comments) → review (marks) — Submit is offered only on review. */
  step: RunStep;
  onStep: (s: RunStep) => void;
}

interface Props {
  run: AppraisalRun;
  palette: RunPalette;
  mobile: boolean;
  /** Only for the person scoring it, while it's being scored. */
  scoring: ScoringActions | null;
  onSettled: (next: AppraisalRun) => void;
}

type Asking = 'submit' | 'approve' | 'sendBack' | 'discard' | null;

const whoAndWhen = (run: AppraisalRun) => `${run.teacherName} — ${periodLabel(run.periodType, run.period)}`;

/**
 * What the person whose turn it is can do now, kept in view at the bottom.
 * Nothing shows for someone who's only reading it.
 */
export function RunActions({ run, palette: p, mobile, scoring, onSettled }: Props) {
  const { showToast } = useToast();
  const [asking, setAsking] = useState<Asking>(null);
  const [reason, setReason] = useState('');
  const done = (message: string) => (next: AppraisalRun) => { setAsking(null); onSettled(next); showToast(message); };

  const approve = useMutation({ mutationFn: () => approveAppraisal(run.id), onSuccess: done('Signed off') });
  const sendBack = useMutation({ mutationFn: () => sendBackAppraisal(run.id, reason.trim()), onSuccess: done('Sent back to the scorer') });
  const acknowledge = useMutation({ mutationFn: () => acknowledgeAppraisal(run.id), onSuccess: done('Thanks — marked as read') });
  const error = (approve.error ?? acknowledge.error) as Error | null;
  const { can } = run;
  // Sign off names what happens next: to the staff member, to the next approver, or finished.
  const outcome = signOffOutcome(run.form.stages, run.currentStep, run.teacherName);
  if (!scoring && !can.signOff && !can.acknowledge) return null;

  // On a phone the buttons share the row equally; on a desktop they sit on the right.
  const grow = mobile ? { flex: 1 } : {};

  // Discard and Save draft: on the left / right of the bar on a desktop; on a phone they sit at the end of the
  // page, so the pinned bar holds only what moves the appraisal on (one row, out of the way of the form).
  const secondaryButtons = scoring ? {
    discard: (
            <button type="button" style={{ ...button(p, 'danger', { mobile, disabled: !scoring.canDiscard }), borderColor: scoring.canDiscard ? p.red : undefined, ...grow }}
              disabled={!scoring.canDiscard} title={scoring.canDiscard ? undefined : 'Nothing to discard — no changes since the last save'} onClick={() => setAsking('discard')}>
              Discard changes
            </button>
    ),
    save: (
              <button type="button" style={{ ...button(p, 'secondary', { mobile, disabled: !scoring.canSave || scoring.saving }), ...grow }}
                disabled={!scoring.canSave || scoring.saving} onClick={scoring.onSave}>
                {scoring.saving ? 'Saving…' : 'Save draft'}
              </button>
    ),
  } : null;

  return (
    <>
      {mobile && secondaryButtons && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>{secondaryButtons.discard}{secondaryButtons.save}</div>
      )}
      {/* Pinned to the bottom of the screen; the page keeps ACTION_BAR_SPACE free below the form so nothing ends up hidden under it. */}
      <section aria-label="Actions" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: p.card, borderTop: `1px solid ${p.border}`,
        boxShadow: '0 -2px 8px rgba(15,23,42,0.06)', padding: mobile ? '12px 16px calc(12px + env(safe-area-inset-bottom))' : '12px 32px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {error && <p role="alert" style={{ margin: '0 0 8px', color: p.red, fontSize: 14 }}>{error.message}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: mobile ? 'wrap' : 'nowrap' }}>
          {!mobile && secondaryButtons && <>{secondaryButtons.discard}<span style={{ flex: 1 }} />{secondaryButtons.save}</>}
          {scoring && (
            <>
              {/* Score → Comments → Review: a Back on every step after the first, Next until the last, Submit only on Review. */}
              {scoring.step !== 'score' && (
                <button type="button" style={{ ...button(p, 'secondary', { mobile }), ...grow, order: -1 }} onClick={() => scoring.onStep(scoring.step === 'review' ? 'comments' : 'score')}>Back</button>
              )}
              {scoring.step === 'review' ? (
                <button type="button" style={{ ...button(p, 'primary', { mobile, disabled: !!scoring.blocker || scoring.submitting }), ...grow }}
                  disabled={!!scoring.blocker || scoring.submitting} aria-describedby={scoring.blocker ? 'submit-blocker' : undefined} title={scoring.blocker ?? undefined}
                  onClick={() => setAsking('submit')}>
                  Submit
                </button>
              ) : (
                // Moving between steps is always allowed, scored or not — only Submit waits for a complete appraisal.
                <button type="button" style={{ ...button(p, 'primary', { mobile }), ...grow }}
                  onClick={() => scoring.onStep(scoring.step === 'score' ? 'comments' : 'review')}>
                  {scoring.step === 'score' ? 'Next: comments' : 'Next: review'}
                </button>
              )}
            </>
          )}
          {can.signOff && (
            <>
              <button type="button" style={{ ...button(p, 'secondary', { mobile }), ...grow }} onClick={() => { setReason(''); sendBack.reset(); setAsking('sendBack'); }}>
                Send back
              </button>
              <button type="button" style={{ ...button(p, 'primary', { mobile }), ...grow }} onClick={() => setAsking('approve')}>{outcome.label}</button>
            </>
          )}
          {can.acknowledge && (
            <button type="button" style={{ ...button(p, 'primary', { mobile, disabled: acknowledge.isPending }), ...grow }}
              disabled={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
              {acknowledge.isPending ? 'Saving…' : 'I’ve read it'}
            </button>
          )}
        </div>
        </div>
      </section>

      {asking === 'submit' && scoring && (
        <ConfirmDialog title="Submit these scores?" confirmLabel="Submit" loading={scoring.submitting}
          message={run.form.stages.some(s => s.kind === 'SIGN_OFF')
            ? 'It goes for sign-off. You can’t change the scores after this, unless it’s sent back to you.'
            : 'It’s finished once submitted — the scores can’t be changed after this.'}
          onConfirm={() => { scoring.onSubmit().then(() => setAsking(null), () => setAsking(null)); }}
          onCancel={() => setAsking(null)} />
      )}
      {asking === 'discard' && scoring && (
        <ConfirmDialog title="Discard your changes?" confirmLabel="Discard" destructive
          message="Scores and comments go back to how they were when last saved."
          onConfirm={() => { scoring.onDiscard(); setAsking(null); }} onCancel={() => setAsking(null)} />
      )}
      {asking === 'approve' && (
        <ConfirmDialog title="Sign off this appraisal?" confirmLabel={outcome.label} loading={approve.isPending}
          message={`${whoAndWhen(run)}, total ${run.totalScore == null ? '—' : Math.round(run.totalScore)} / 100. ${outcome.message}`}
          onConfirm={() => approve.mutate()} onCancel={() => setAsking(null)} />
      )}
      {asking === 'sendBack' && (
        <FormModal title="Send back to the scorer" onClose={() => setAsking(null)} width={480}
          primary={{ label: 'Send back', onClick: () => sendBack.mutate(), busy: sendBack.isPending, disabled: reason.trim() === '', hint: reason.trim() === '' ? 'Say what needs changing.' : undefined }}>
          <label htmlFor="send-back-reason" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: p.sub, marginBottom: 4 }}>What needs changing</label>
          <textarea id="send-back-reason" rows={4} autoFocus value={reason} maxLength={REASON_MAX} onChange={e => setReason(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: mobile ? 16 : 14, fontFamily: 'inherit', border: `1px solid ${p.borderStrong}`, borderRadius: 8, resize: 'vertical' }} />
          {sendBack.error && <p role="alert" style={{ margin: '8px 0 0', color: p.red, fontSize: 14 }}>{(sendBack.error as Error).message}</p>}
        </FormModal>
      )}
    </>
  );
}

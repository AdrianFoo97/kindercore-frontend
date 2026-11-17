import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import type { AppraisalRun, RunLogEntry } from '../../api/appraisal-runs.js';
import { STEP_LABEL, stepStates } from './appraisalRun.js';
import { card, type RunPalette } from './runTheme.js';

/** The form's steps in order — done ones ticked, the current one highlighted. */
export function RunSteps({ run, palette: p }: { run: AppraisalRun; palette: RunPalette }) {
  const states = stepStates(run.form.stages, run.currentStep, run.status);
  return (
    <ol aria-label="Steps" style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {run.form.stages.map((s, i) => {
        const state = states[i];
        const on = state === 'current';
        return (
          <li key={s.id} aria-current={on ? 'step' : undefined} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            border: `1px solid ${on ? p.accent : p.border}`, background: on ? p.accentSoft : p.card, color: state === 'todo' ? p.muted : p.text,
          }}>
            <span aria-hidden style={{
              width: 22, height: 22, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              background: state === 'done' ? p.green : on ? p.accent : p.bg, color: state === 'todo' ? p.muted : '#fff',
              border: state === 'todo' ? `1px solid ${p.border}` : 'none',
            }}>
              {state === 'done' ? <FontAwesomeIcon icon={faCheck} /> : i + 1}
            </span>
            {STEP_LABEL[s.kind]}
            <span style={visuallyHidden}>{state === 'done' ? ' (done)' : on ? ' (now)' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

const visuallyHidden: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

const LOG_WORDS: Record<RunLogEntry['kind'], string> = {
  STARTED: 'Started',
  SUBMITTED: 'Scored and submitted',
  SIGNED_OFF: 'Signed off',
  SENT_BACK: 'Sent back',
  ACKNOWLEDGED: 'Read and confirmed',
};

const when = (at: string) => new Date(at).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Who did what, when — oldest first. */
export function RunHistory({ log, palette: p }: { log: RunLogEntry[]; palette: RunPalette }) {
  if (log.length === 0) return null;
  return (
    // Folded away by default — it's for looking back, not for doing the appraisal.
    <details style={card(p)}>
      <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700, color: p.text, padding: '4px 0' }}>History ({log.length})</summary>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {log.map((l, i) => (
          <li key={i} style={{ padding: '8px 0', borderTop: i ? `1px solid ${p.border}` : 'none', fontSize: 14, color: p.sub, lineHeight: 1.5 }}>
            <strong style={{ color: p.text }}>{LOG_WORDS[l.kind]}</strong>
            {l.authorName && <> by {l.authorName}</>}
            <span style={{ color: p.muted }}> · {when(l.at)}</span>
            {l.detail && <div style={{ fontSize: 13, color: p.muted }}>{l.detail}</div>}
          </li>
        ))}
      </ol>
    </details>
  );
}

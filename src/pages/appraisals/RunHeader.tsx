import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import type { AppraisalRun } from '../../api/appraisal-runs.js';
import { getAvatarColor, getInitials } from '../../components/onboarding/avatar.js';
import { STATUS_LABEL, periodLabel } from './appraisalRun.js';
import type { RunStep } from './RunActions.js';
import { pill, statusTone, type RunPalette } from './runTheme.js';
import { MONTH_LABELS } from './appraisalDisplay.js';

/** The period, short: "Nov 2026", "Q4 2026" or "2026". */
export const shortPeriod = (run: Pick<AppraisalRun, 'periodType' | 'period'>) =>
  run.periodType === 'QUARTERLY' ? `Q${Math.floor(run.period.month / 3) + 1} ${run.period.year}`
    : run.periodType === 'YEARLY' ? `${run.period.year}`
    : `${MONTH_LABELS[run.period.month]} ${run.period.year}`;

const STEPS: { key: RunStep; label: string }[] = [
  { key: 'score', label: 'Score' },
  { key: 'comments', label: 'Comments' },
  { key: 'review', label: 'Review' },
];

interface Props {
  run: AppraisalRun;
  palette: RunPalette;
  mobile: boolean;
  /** The scorer's current step — null for anyone just reading it. */
  step: RunStep | null;
  onStep: (s: RunStep) => void;
}

/**
 * Top of an appraisal: who it's about (avatar + name), then the form and
 * period. The person scoring sees where they are in Score → Comments →
 * Review (each step can be clicked); anyone else sees its status instead.
 */
export default function RunHeader({ run, palette: p, mobile, step, onStep }: Props) {
  const avatar = getAvatarColor(run.teacherName);
  const tone = statusTone(p, run.status);
  return (
    <header id="run-top" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div aria-hidden style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: avatar.bg, color: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
          {getInitials(run.teacherName)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: mobile ? 20 : 22, fontWeight: 700, color: p.text }}>{run.teacherName}</h1>
            {!step && <span style={pill(tone.fg, tone.bg)}>{STATUS_LABEL[run.status]}</span>}
          </div>
          <div style={{ fontSize: 14, color: p.muted, marginTop: 2 }}>
            <span title={`Version ${run.form.version} of the form — the exact one it's scored on`}>{run.form.name} V{run.form.version}</span>
            {' · '}{periodLabel(run.periodType, run.period)}
            {run.assessedByName && <> · Scored by {run.assessedByName}</>}
          </div>
        </div>
      </div>
      {step && <StepIndicator step={step} onStep={onStep} palette={p} mobile={mobile} />}
    </header>
  );
}

function StepIndicator({ step, onStep, palette: p, mobile }: { step: RunStep; onStep: (s: RunStep) => void; palette: RunPalette; mobile: boolean }) {
  const at = STEPS.findIndex(s => s.key === step);
  return (
    <nav aria-label="Steps" style={{ width: mobile ? '100%' : undefined }}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        {STEPS.map((s, i) => {
          const on = i === at;
          const done = i < at;
          return (
            <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: mobile ? 1 : undefined }}>
              {i > 0 && <span aria-hidden style={{ width: mobile ? 8 : 16, height: 1, background: p.borderStrong }} />}
              <button type="button" onClick={() => onStep(s.key)} aria-current={on ? 'step' : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: mobile ? 44 : 32, padding: '0 10px', borderRadius: 999,
                  border: 'none', background: on ? p.accentSoft : 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: on ? 700 : 600, color: on ? p.accent : done ? p.sub : p.muted, whiteSpace: 'nowrap',
                }}>
                <span aria-hidden style={{
                  width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                  background: on ? p.accent : done ? p.green : '#fff', color: on || done ? '#fff' : p.muted, border: on || done ? 'none' : `1px solid ${p.borderStrong}`,
                }}>
                  {done ? <FontAwesomeIcon icon={faCheck} /> : i + 1}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

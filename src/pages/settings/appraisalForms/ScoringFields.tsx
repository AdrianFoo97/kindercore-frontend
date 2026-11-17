import SegmentedControl from '../../../components/common/SegmentedControl.js';
import type { InputType } from '../../../api/appraisal-templates.js';
import { INPUT_LABEL, numberRule, type DraftScale, type ManualInput } from './appraisalFormDraft.js';
import RatingScalePicker from './RatingScalePicker.js';
import { needsTarget } from './criterionWizard.js';
import { C, input, label } from './formTheme.js';

const INPUT_HINT: Record<ManualInput, string> = {
  RATING: 'The assessor picks a level, e.g. 4 out of 5 = 80%.',
  PERCENT: 'The assessor enters 0–100%.',
  YES_NO: 'Yes = 100%, no = 0%.',
  PASS_FAIL: 'As in SOP observations: pass = 100%, fail = 0%, N/A isn’t counted.',
  NUMBER: 'A count compared with a target, e.g. days late.',
};
const INPUTS = Object.keys(INPUT_LABEL) as ManualInput[];
type Direction = 'lower' | 'higher';

interface Props {
  value: DraftScale;
  onChange: (patch: Partial<DraftScale>) => void;
  /** Makes ids and the radio group unique when several are on screen. */
  idPrefix: string;
  /** Show a missing target in red (after "Add" was tried). */
  showErrors: boolean;
  /** A new criterion / point — a rating with no wording yet takes the default rating scale. */
  isNew: boolean;
  /** Heading over the kinds. */
  legend?: string;
  /** Also offer "From a scoring form" (a criterion only): whether it's the one chosen, choosing it, and why it can't be (greyed out). */
  scoringForm?: { chosen: boolean; onChoose: () => void; unavailable?: string | null };
}

// How one thing (a criterion or a point) is scored, in two screens: the kind
// (ScoringChoice), then — after "Next" — a rating's scale or a number's target
// (ScoringSettings).

/** Just the kinds, as cards. */
export function ScoringChoice({ value: s, onChange, idPrefix, legend = 'How it’s scored', scoringForm }: Props) {
  // "From a scoring form" chosen = none of the kinds is (nor is an old "on several points").
  const kind = scoringForm?.chosen ? null : s.inputType;
  const choiceText = (k: ManualInput) => ({ label: INPUT_LABEL[k], hint: INPUT_HINT[k] });
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend style={label}>{legend}</legend>
      <div style={{ display: 'grid', gap: 8 }}>
        {INPUTS.map(k => (
          <label key={k} style={choice(kind === k)}>
            <input type="radio" name={`${idPrefix}-input`} checked={kind === k} onChange={() => onChange({ inputType: k as InputType })} style={{ marginTop: 2, accentColor: C.primary }} />
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{choiceText(k).label}</span>
              <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>{choiceText(k).hint}</span>
            </span>
          </label>
        ))}
        {scoringForm && (
          <label title={scoringForm.unavailable ?? undefined}
            style={{ ...choice(scoringForm.chosen), ...(scoringForm.unavailable ? { cursor: 'default', opacity: 0.7 } : {}) }}>
            <input type="radio" name={`${idPrefix}-input`} checked={scoringForm.chosen} disabled={!!scoringForm.unavailable}
              onChange={scoringForm.onChoose} style={{ marginTop: 2, accentColor: C.primary }} />
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>From a scoring form</span>
              <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>
                Use a saved scoring form (Settings → Scoring forms); it scores as that form’s weighted total.
              </span>
              {scoringForm.unavailable && (
                <span style={{ display: 'flex', gap: 6, fontSize: 13, color: C.amber, marginTop: 4 }}>{scoringForm.unavailable}</span>
              )}
            </span>
          </label>
        )}
      </div>
    </fieldset>
  );
}

/**
 * The chosen kind's settings — its rating scale, or its target. Nothing for
 * kinds without settings. `flush` = first thing on the screen, so no space above.
 */
export function ScoringSettings({ value: s, onChange, idPrefix, showErrors, isNew, flush = false }: Props & { flush?: boolean }) {
  if (s.inputType === 'RATING') return <RatingScalePicker s={s} onChange={onChange} idPrefix={idPrefix} isNew={isNew} flush={flush} />;
  if (s.inputType === 'NUMBER') return <TargetFields s={s} onChange={onChange} idPrefix={idPrefix} flush={flush} showError={showErrors && needsTarget(s)} />;
  return null;
}

interface TargetProps { s: DraftScale; onChange: (patch: Partial<DraftScale>) => void; idPrefix: string; flush: boolean; showError: boolean }

function TargetFields({ s, onChange, idPrefix, flush, showError }: TargetProps) {
  return (
    <div style={{ marginTop: flush ? 0 : 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={label} htmlFor={`${idPrefix}-target`}>Target</label>
          <input id={`${idPrefix}-target`} type="number" min={0} step="any" inputMode="decimal" style={{ ...input, width: 120 }}
            aria-invalid={showError} value={s.target} onChange={e => onChange({ target: e.target.value === '' ? '' : Number(e.target.value) })} />
        </div>
        <SegmentedControl<Direction>
          ariaLabel="Which way is better"
          accent={C.primary}
          value={s.higherIsBetter ? 'higher' : 'lower'}
          onChange={k => onChange({ higherIsBetter: k === 'higher' })}
          segments={[{ key: 'lower', label: 'Lower is better' }, { key: 'higher', label: 'Higher is better' }]}
        />
      </div>
      <p style={{ fontSize: 13, color: showError ? C.red : C.muted, margin: '8px 0 0' }} role={showError ? 'alert' : undefined}>
        {numberRule(s.target, s.higherIsBetter)}
      </p>
    </div>
  );
}

const choice = (on: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
  border: `1px solid ${on ? C.primary : C.border}`, background: on ? C.primarySoft : '#fff',
});

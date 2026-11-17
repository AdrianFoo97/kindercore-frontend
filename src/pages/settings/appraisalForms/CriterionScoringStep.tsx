import type { DraftCriterion } from './appraisalFormDraft.js';
import { ScoringChoice } from './ScoringFields.js';

interface Props {
  c: DraftCriterion;
  set: (patch: Partial<DraftCriterion>) => void;
  /** "From a scoring form" is the choice. */
  fromScoringForm: boolean;
  /** Omit to leave the option out (inside a scoring form). */
  onFromScoringForm?: (on: boolean) => void;
  /** Why "From a scoring form" can't be chosen (greyed out with this reason), or null. */
  scoringFormUnavailable?: string | null;
}

/**
 * How it's scored — just the choice: one of the four kinds, or "From a
 * scoring form". Its settings (scale, target, which
 * scoring form) are the next step; points are added afterwards, one at a time,
 * under the criterion on the form. Nothing appears or disappears here when
 * choosing, so the pop-up keeps its height.
 */
export default function CriterionScoringStep({ c, set, fromScoringForm, onFromScoringForm, scoringFormUnavailable = null }: Props) {
  const who = c.name.trim() || 'this criterion';
  // Picking one of the kinds turns "from a scoring form" off.
  const choose = (patch: Partial<DraftCriterion>) => { onFromScoringForm?.(false); set(patch); };
  return (
    <ScoringChoice value={c} onChange={choose} idPrefix="crit" showErrors={false} isNew={false} legend={`How “${who}” is scored`}
      scoringForm={onFromScoringForm ? { chosen: fromScoringForm, onChoose: () => onFromScoringForm(true), unavailable: scoringFormUnavailable } : undefined} />
  );
}

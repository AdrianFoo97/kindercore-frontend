import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RATING_SCALES_KEY, fetchRatingScales } from '../../../api/appraisal-rating-scales.js';
import { SCORING_FORMS_KEY, fetchScoringForms } from '../../../api/appraisal-scoring-forms.js';
import FormModal from '../../../components/common/FormModal.js';
import CriterionScoringStep from './CriterionScoringStep.js';
import ScoringFormPicker from './ScoringFormPicker.js';
import { ScoringSettings } from './ScoringFields.js';
import type { DraftCriterion } from './appraisalFormDraft.js';
import { withDefaultScale } from './ratingScales.js';
import { SCORING_FORM_NEEDED, copyOfScoringForm, scoringFormUnavailableReason, type ScoringFormCopy } from './scoringForms.js';
import { criterionStepIssues, criterionSteps, criterionToSave, isLastStep, nextStep, prevStep, stepIndex, type CriterionStep } from './criterionWizard.js';
import { input, label } from './formTheme.js';

/** The server's limit on a criterion's description. */
const MAX_DESCRIPTION = 1000;

interface Props {
  criterion: DraftCriterion;
  isNew: boolean;
  onSave: (c: DraftCriterion) => void;
  onClose: () => void;
  /** Inside a scoring form: scored directly only — no "on several points", no scoring form. */
  inScoringForm?: boolean;
  /** The appraisal form's "who it's for" — narrows the scoring forms offered. */
  positionIds?: string[];
}

/**
 * One criterion, in a pop-up — 1 its name and how it's scored (just the
 * choice: one of four kinds, "On several points" — points added on the form
 * afterwards — or "From a scoring form") · 2 Scale / Target / which scoring
 * form, only when there's something to set. No step bar — Next / Back move
 * between the two. Next / Add stay off until what that screen needs is filled
 * in. Its weight is set on the form.
 */
export default function CriterionModal({ criterion, isNew, onSave, onClose, inScoringForm = false, positionIds = [] }: Props) {
  const [c, setC] = useState(criterion);
  const [step, setStep] = useState<CriterionStep>('about');
  // An existing "from a scoring form" criterion opens with its form still picked.
  const savedCopy = criterion.inputType === 'FORM' ? (criterion.otherConfig as ScoringFormCopy | null) : null;
  const [fromForm, setFromForm] = useState(!!savedCopy);
  const [formId, setFormId] = useState<string | null>(savedCopy?.scoringFormId ?? null);
  const { data: scales = [] } = useQuery({ queryKey: RATING_SCALES_KEY, queryFn: fetchRatingScales });
  const { data: forms = [] } = useQuery({ queryKey: SCORING_FORMS_KEY, queryFn: fetchScoringForms });
  const set = (patch: Partial<DraftCriterion>) => setC(prev => ({ ...prev, ...patch }));

  const steps = criterionSteps(c.inputType, fromForm);
  const last = isLastStep(steps, step);
  const chosenForm = forms.find(f => f.id === formId && f.problems.length === 0) ?? null;
  // What this screen (and any before it) still needs — the main button stays off until it's done.
  // Checked as chosen on screen: "from a scoring form" counts as that, whatever the criterion was before.
  const issues = criterionStepIssues(fromForm ? { ...c, inputType: 'FORM' } : c);
  // Unchanged from-a-scoring-form criterion: its saved copy still counts, even if the form has changed since.
  const keepsSavedCopy = fromForm && !!savedCopy && formId === savedCopy.scoringFormId && !chosenForm;
  const settingsIssue = fromForm ? (chosenForm || keepsSavedCopy ? undefined : SCORING_FORM_NEEDED) : issues.settings[0];
  const missing = issues.about[0] ?? (step === 'settings' ? settingsIssue : undefined);

  const finish = () => {
    // From a scoring form: scored as its weighted total, on a copy of its sections (a fresh copy when (re)picked).
    if (fromForm) {
      const copy = chosenForm ? copyOfScoringForm(chosenForm) : savedCopy;
      onSave(criterionToSave({ ...c, inputType: 'FORM', otherConfig: copy, points: [] }));
      return;
    }
    // A new rating left on the default scale (shown chosen) takes its wording now.
    onSave(criterionToSave(withDefaultScale(c, scales, isNew)));
  };

  return (
    <FormModal
      title={isNew ? 'Add criterion' : 'Edit criterion'}
      onClose={onClose}
      primary={{
        label: last ? (isNew ? 'Add' : 'Done') : 'Next', onClick: last ? finish : () => setStep(nextStep(steps, step)),
        disabled: !!missing, hint: missing,
      }}
      secondary={stepIndex(steps, step) > 0 ? { label: 'Back', onClick: () => setStep(prevStep(steps, step)) } : undefined}
    >
      {step === 'about' && (
        <>
          <label style={label} htmlFor="crit-name">Name</label>
          <input id="crit-name" autoFocus style={input} value={c.name} maxLength={191} placeholder="e.g. Love for children"
            aria-required onChange={e => set({ name: e.target.value })} />
          {/* What it means — shown to the assessor under the criterion while scoring. */}
          <label style={{ ...label, marginTop: 16 }} htmlFor="crit-description">Description <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <textarea id="crit-description" style={{ ...input, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }} value={c.description} maxLength={MAX_DESCRIPTION}
            placeholder="e.g. Speaks calmly and patiently, even when a child is upset." onChange={e => set({ description: e.target.value })} />
          <div style={{ marginTop: 20 }}>
            <CriterionScoringStep c={c} set={set} fromScoringForm={fromForm} onFromScoringForm={inScoringForm ? undefined : setFromForm}
              // Greyed out (with why) when no complete scoring form is on offer — unless it already uses one.
              scoringFormUnavailable={savedCopy ? null : scoringFormUnavailableReason(forms.filter(f => f.isActive), positionIds)} />
          </div>
        </>
      )}
      {step === 'settings' && (fromForm
        ? <ScoringFormPicker chosenId={formId} onChoose={setFormId} positionIds={positionIds} />
        : <ScoringSettings value={c} onChange={set} idPrefix="crit" showErrors={false} isNew={isNew} flush />)}
    </FormModal>
  );
}

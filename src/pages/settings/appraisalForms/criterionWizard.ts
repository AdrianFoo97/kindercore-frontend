import type { InputType } from '../../../api/appraisal-templates.js';
import type { DraftCriterion } from './appraisalFormDraft.js';

// Adding or editing a criterion: 1 its name and which kind of scoring (just
// the choice) → 2 that kind's settings (the scale, or the target) — step 2
// only for kinds that have settings. "On several points" has its points added
// on the form afterwards.

export type CriterionStep = 'about' | 'settings';
export interface StepDef { key: CriterionStep; label: string }

/** Step 2's name for the kinds that have settings; other kinds are done in one step. */
const SETTINGS_LABEL: Partial<Record<InputType, string>> = { RATING: 'Scale', NUMBER: 'Target' };

/** The steps for a criterion scored this way (or copied from a scoring form — then step 2 is picking it). */
export function criterionSteps(inputType: InputType, fromScoringForm = false): StepDef[] {
  const settings = fromScoringForm ? 'Scoring form' : SETTINGS_LABEL[inputType];
  return [
    { key: 'about', label: 'Criterion' },
    ...(settings ? [{ key: 'settings' as const, label: settings }] : []),
  ];
}

export const NAME_NEEDED = 'Give it a name.';
export const TARGET_NEEDED = 'Set a target above 0.';
/** "On several points" was replaced by scoring forms — an old one must be changed. */
export const POINTS_RETIRED = 'Pick how it’s scored — “on several points” is no longer offered.';

export const needsTarget = (s: Pick<DraftCriterion, 'inputType' | 'target'>) => s.inputType === 'NUMBER' && (s.target === '' || s.target <= 0);


/**
 * What each step still needs before the criterion can be added. "On several
 * points" with none yet is fine here — the form shows it needs points, and it
 * can't go live until it has some.
 */
export function criterionStepIssues(c: Pick<DraftCriterion, 'name' | 'inputType' | 'target'>): Record<CriterionStep, string[]> {
  return {
    about: [...(c.name.trim() ? [] : [NAME_NEEDED]), ...(c.inputType === 'POINTS' ? [POINTS_RETIRED] : [])],
    settings: needsTarget(c) ? [TARGET_NEEDED] : [],
  };
}


/** The first step that still needs something — where "Add" takes you. */
export function firstStepWithIssue(issues: Record<CriterionStep, string[]>, steps: StepDef[]): CriterionStep | null {
  return steps.find(s => issues[s.key].length > 0)?.key ?? null;
}

/** What's saved: points only when it's scored on points (picking another kind drops them — the screen says so first). */
export function criterionToSave(c: DraftCriterion): DraftCriterion {
  return { ...c, name: c.name.trim(), points: c.inputType === 'POINTS' ? c.points.map(p => ({ ...p, name: p.name.trim() })) : [] };
}

export const stepIndex = (steps: StepDef[], step: CriterionStep) => steps.findIndex(s => s.key === step);
export const isLastStep = (steps: StepDef[], step: CriterionStep) => stepIndex(steps, step) === steps.length - 1;
export const nextStep = (steps: StepDef[], step: CriterionStep): CriterionStep => steps[Math.min(stepIndex(steps, step) + 1, steps.length - 1)].key;
export const prevStep = (steps: StepDef[], step: CriterionStep): CriterionStep => steps[Math.max(stepIndex(steps, step) - 1, 0)].key;

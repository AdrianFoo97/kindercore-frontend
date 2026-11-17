import { describe, it, expect } from 'vitest';
import {
  NAME_NEEDED, POINTS_RETIRED, TARGET_NEEDED,
  criterionStepIssues, criterionSteps, criterionToSave, firstStepWithIssue, isLastStep, nextStep, prevStep,
} from '../../pages/settings/appraisalForms/criterionWizard';
import { inputSummary, newCriterion, newPoint } from '../../pages/settings/appraisalForms/appraisalFormDraft';

// Adding a criterion to an appraisal form: its name and how it's scored on one
// screen, then Scale / Target only for kinds with settings. "On several
// points" has its points added on the form afterwards.

const crit = (o: Partial<ReturnType<typeof newCriterion>> = {}) => ({ ...newCriterion('Love for children'), ...o });

describe('Criterion wizard', () => {
  it('adds a second step only for kinds with settings — the scale or the target', () => {
    expect(criterionSteps('RATING').map(s => s.label)).toEqual(['Criterion', 'Scale']);
    expect(criterionSteps('NUMBER').map(s => s.label)).toEqual(['Criterion', 'Target']);
    for (const kind of ['PERCENT', 'YES_NO', 'POINTS'] as const) expect(criterionSteps(kind).map(s => s.key)).toEqual(['about']);
  });

  it('walks through the steps in order, either way', () => {
    const steps = criterionSteps('RATING');
    expect(nextStep(steps, 'about')).toBe('settings');
    expect(nextStep(steps, 'settings')).toBe('settings');
    expect(prevStep(steps, 'settings')).toBe('about');
    expect(prevStep(steps, 'about')).toBe('about');
    expect(isLastStep(steps, 'settings')).toBe(true);
    expect(isLastStep(criterionSteps('YES_NO'), 'about')).toBe(true);
  });

  it('knows which step still needs something, and opens that one when adding', () => {
    expect(criterionStepIssues(crit({ name: ' ' })).about).toEqual([NAME_NEEDED]);
    const num = criterionSteps('NUMBER');
    expect(criterionStepIssues(crit({ inputType: 'NUMBER', target: '' })).settings).toEqual([TARGET_NEEDED]);
    expect(firstStepWithIssue(criterionStepIssues(crit({ inputType: 'NUMBER', target: '' })), num)).toBe('settings');
    expect(firstStepWithIssue(criterionStepIssues(crit({ name: '', inputType: 'NUMBER', target: 0 })), num)).toBe('about');
    expect(firstStepWithIssue(criterionStepIssues(crit({ inputType: 'NUMBER', target: 3 })), num)).toBeNull();
  });

  it('makes an old "on several points" criterion pick another way before it can be saved', () => {
    const old = crit({ inputType: 'POINTS', points: [newPoint('Cares'), newPoint('Calm')] });
    expect(criterionStepIssues(old).about).toEqual([POINTS_RETIRED]);
    expect(inputSummary(old)).toBe('On 2 points (no longer offered)');
    expect(criterionStepIssues({ ...old, inputType: 'YES_NO' }).about).toEqual([]);
    // Switching it to a scoring form clears it too.
    expect(criterionStepIssues({ ...old, inputType: 'FORM' }).about).toEqual([]);
  });

  it('keeps the points only when it is scored on points', () => {
    const points = [newPoint('Cares')];
    expect(criterionToSave(crit({ inputType: 'POINTS', points })).points.map(p => p.name)).toEqual(['Cares']);
    expect(criterionToSave(crit({ inputType: 'RATING', points })).points).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { NAME_MISSING, POSITIONS_MISSING, chainProblems, firstStepToFix, formSteps, saveBlocker, saveStatusText } from '../../pages/settings/appraisalForms/formSteps';

// The appraisal-form editor as three tabs (Basics — incl. who it's for ·
// What's scored · Who appraises): each says what it still needs, "Make live"
// is off until nothing is left, and the draft is saved with "Save draft".

const area = (scoring: string[] = [], approval: string[] = []) => ({ scoring, approval });

describe('Appraisal form editor — steps', () => {
  it('puts each thing to fix in the step it belongs to', () => {
    const stages = [{ name: 'Assessed by', kind: 'ASSESS' as const, positionIds: ['P-S'] }, { name: 'Signed off by', kind: 'SIGN_OFF' as const, positionIds: [] }];
    const steps = formSteps({ name: '', overWeight: [], positionCount: 1, stages, problemsByArea: area(['Add at least one section.']) });
    expect(steps.map(s => [s.number, s.title, s.issues.length])).toEqual([[1, 'Basics', 1], [2, 'What’s scored', 1], [3, 'Who appraises', 1]]);
    expect(steps[0].issues).toEqual([NAME_MISSING]);
  });

  it('needs at least one position it is for, counting what is picked on the page', () => {
    expect(formSteps({ name: 'Monthly', overWeight: [], positionCount: 0, stages: [], problemsByArea: area() })[0].issues).toEqual([POSITIONS_MISSING]);
    expect(formSteps({ name: 'Monthly', overWeight: [], positionCount: 2, stages: [], problemsByArea: area() })[0].issues).toEqual([]);
  });

  it('checks who appraises as positions are picked, before saving', () => {
    const chain = (assess: string[], signOff: string[]) => [
      { name: 'Assessed by', kind: 'ASSESS' as const, positionIds: assess },
      { name: 'Signed off by', kind: 'SIGN_OFF' as const, positionIds: signOff },
      { name: 'Acknowledged', kind: 'ACKNOWLEDGE' as const, positionIds: [] },
    ];
    expect(chainProblems(chain([], ['P-P']))).toEqual(['"Assessed by" needs at least one position to do it.']);
    expect(chainProblems(chain(['P-S', 'P-T'], ['P-P']))).toEqual(['Only one position can score it — pick one.']);
    // Picked on the page = fixed, even while the saved form still has the old problem.
    const steps = formSteps({ name: 'Monthly', overWeight: [], positionCount: 1, stages: chain(['P-S'], ['P-P']),
      problemsByArea: area([], ['"Assessed by" needs at least one position to do it.']) });
    expect(steps[2].issues).toEqual([]);
  });

  it('shows weights over 100% straight away, without repeating a problem the server also found', () => {
    const over = 'Sections add up to 120%, 20% too much.';
    const steps = formSteps({ name: 'Monthly', overWeight: [over], positionCount: 1, stages: [], problemsByArea: area([over, 'Add at least one section.']) });
    expect(steps[1].issues).toEqual([over, 'Add at least one section.']);
  });

  it('knows the first step that still needs fixing, and when nothing is left', () => {
    const steps = formSteps({ name: 'Monthly', overWeight: [], positionCount: 1, stages: [], problemsByArea: area([], ['A', 'B']) });
    expect(firstStepToFix(steps)?.key).toBe('approval');
    const done = formSteps({ name: 'Monthly', overWeight: [], positionCount: 1, stages: [], problemsByArea: area() });
    expect(firstStepToFix(done)).toBeNull();
  });

  it('says plainly whether the draft is saved, and why it can’t be saved yet', () => {
    expect(saveBlocker('', [])).toBe('give the form a name');
    expect(saveBlocker('Monthly', ['over'])).toBe('weights add up to more than 100%');
    expect(saveBlocker('Monthly', [])).toBeNull();
    expect(saveStatusText('saved')).toBe('All changes saved');
    expect(saveStatusText('pending')).toBe('Unsaved changes');
    expect(saveStatusText('error', 'Network down')).toBe('Couldn’t save — Network down');
  });
});

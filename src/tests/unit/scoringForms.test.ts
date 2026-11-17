import { describe, it, expect } from 'vitest';
import { DEFAULT_SOP_SECTION, MAX_CRITERIA_PER_SECTION, copyOfScoringForm, isUsable, filterSops, sectionsFromSops, sopFormName, sopGroupingProblem, sopTags, splitWeights, scoringFormSummary, scoringFormUnavailableReason, scoringFormsForPositions } from '../../pages/settings/appraisalForms/scoringForms';
import { inputSummary, newCriterion, sectionsFromSaved, sectionsPayload } from '../../pages/settings/appraisalForms/appraisalFormDraft';

// Scoring forms (Settings → Scoring forms): weighted sections and criteria,
// built like an appraisal form's; a criterion "from a scoring form" keeps a copy.

const care = {
  id: 'sf-1', name: 'Classroom care', problems: [] as string[], positionIds: [] as string[],
  sections: [
    { name: 'Care', weight: 60, criteria: [
      { name: 'Patience', description: null, weight: 50, inputType: 'RATING' as const, scaleConfig: { max: 4, levels: [{ value: 4, label: 'Always' }] }, points: [] },
      { name: 'Washes hands', description: null, weight: 50, inputType: 'YES_NO' as const, scaleConfig: null, points: [] },
    ] },
    { name: 'Safety', weight: 40, criteria: [
      { name: 'Head counts missed', description: null, weight: 100, inputType: 'NUMBER' as const, scaleConfig: { target: 1, higherIsBetter: false }, points: [] },
    ] },
  ],
};

describe('Scoring forms', () => {
  it('loads and saves its sections exactly like an appraisal form', () => {
    expect(sectionsPayload(sectionsFromSaved(care.sections))).toEqual(care.sections);
  });

  it('sums a form up, and can only be picked once it is complete', () => {
    expect(scoringFormSummary(care)).toBe('2 sections · 3 criteria');
    expect(scoringFormSummary({ sections: [] })).toBe('Nothing to score yet');
    expect(isUsable(care)).toBe(true);
    expect(isUsable({ problems: ['Add at least one section.'] })).toBe(false);
  });

  it('offers the forms for the appraisal form’s positions first, then those for anyone, each A–Z', () => {
    const f = (name: string, positionIds: string[]) => ({ name, positionIds });
    const forms = [f('Zoo trip', []), f('Teaching', ['P-T']), f('Admin work', ['P-A']), f('Art', ['P-T', 'P-A']), f('Basics', [])];
    const names = (r: { forThese: { name: string }[]; forAnyone: { name: string }[] }) => [r.forThese.map(x => x.name), r.forAnyone.map(x => x.name)];
    expect(names(scoringFormsForPositions(forms, ['P-T']))).toEqual([['Art', 'Teaching'], ['Basics', 'Zoo trip']]);
    // No positions picked yet: every form, assigned ones first.
    expect(names(scoringFormsForPositions(forms, []))).toEqual([['Admin work', 'Art', 'Teaching'], ['Basics', 'Zoo trip']]);
  });

  it('says why "From a scoring form" can’t be chosen, or nothing when one is on offer', () => {
    const f = (positionIds: string[], problems: string[] = []) => ({ name: 'X', positionIds, problems });
    expect(scoringFormUnavailableReason([], ['P-T'])).toMatch(/No scoring forms yet/);
    expect(scoringFormUnavailableReason([f(['P-A'])], ['P-T'])).toMatch(/for this form’s positions/);
    expect(scoringFormUnavailableReason([f(['P-T'], ['Add at least one section.'])], ['P-T'])).toMatch(/complete/);
    expect(scoringFormUnavailableReason([f([])], ['P-T'])).toBeNull();
  });

  it('gives a criterion its own copy of the form, and names the form it came from', () => {
    const copy = copyOfScoringForm(care);
    expect(copy).toEqual({ scoringFormId: 'sf-1', name: 'Classroom care', sections: care.sections });
    expect(inputSummary({ ...newCriterion('Love'), inputType: 'FORM', otherConfig: copy })).toBe('From scoring form “Classroom care”');
  });
});


describe('Scoring forms — from an SOP', () => {
  const step = (section: string, title: string, displayOrder: number, extra: Partial<{ detail: string | null; deletedAt: string | null }> = {}) =>
    ({ section, title, detail: null, displayOrder, deletedAt: null, ...extra });

  it('splits weights to two decimals that add up to exactly 100', () => {
    expect(splitWeights(100, [1, 1, 1])).toEqual([33.34, 33.33, 33.33]);
    expect(splitWeights(100, [3, 1])).toEqual([75, 25]);
    expect(splitWeights(100, [1, 1, 1, 1, 1, 1, 1]).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  it('puts every SOP in one section to start, sharing it evenly, each SOP scored on its pass / fail / N/A steps', () => {
    const arrival = { title: 'Morning arrival', steps: [
      step('Door', 'Greet', 0), step('Bags', 'Check bag', 1, { detail: 'Look for medicine' }),
      step('Bags', 'Old step', 2, { deletedAt: '2026-01-01' }), step('Bags', 'Hang bag', 3),
    ] };
    const lunch = { title: 'Lunch', steps: [step('', 'Wash hands', 0)] };
    const built = sectionsFromSops([arrival, lunch]);
    if (!('sections' in built)) throw new Error(built.problem);
    expect(built.sections.map(s => [s.name, s.weight])).toEqual([[DEFAULT_SOP_SECTION, 100]]);
    // Each SOP is a criterion scored on its steps (passed ÷ decided, like an observation); deleted steps are left out.
    expect(built.sections[0].criteria.map(c => [c.name, c.weight, c.inputType, c.points.length])).toEqual([
      ['Morning arrival', 50, 'POINTS', 3], ['Lunch', 50, 'POINTS', 1],
    ]);
    expect(built.sections[0].criteria[0].points.map(p => [p.name, p.inputType])).toEqual([
      ['Door · Greet', 'PASS_FAIL'], ['Bags · Check bag', 'PASS_FAIL'], ['Bags · Hang bag', 'PASS_FAIL'],
    ]);
    expect(built.sections[0].criteria[0].points[1].description).toBe('Look for medicine');
    expect(built.sections[0].criteria[1].points[0].name).toBe('Wash hands');
  });

  it("says why SOPs can't be used, and when the sections and SOP shares are ready to save", () => {
    expect(sectionsFromSops([])).toEqual({ problem: 'Pick at least one SOP.' });
    expect(sectionsFromSops([{ title: 'Empty', steps: [] }])).toEqual({ problem: '“Empty” has no steps yet — add some, or leave it out.' });
    const long = { title: 'Long', steps: Array.from({ length: MAX_CRITERIA_PER_SECTION + 1 }, (_, i) => step('', `Step ${i}`, i)) };
    expect('problem' in sectionsFromSops([long])).toBe(true);
    const ok = [
      { name: 'Routines', share: '60', sops: [{ name: 'Gate', share: '50' }, { name: 'Lunch', share: '50' }] },
      { name: 'Safety', share: '40', sops: [{ name: 'Incidents', share: '100' }] },
    ];
    expect(sopGroupingProblem(ok)).toBeNull();
    expect(sopGroupingProblem([{ ...ok[0], name: ' ' }, ok[1]])).toBe('Give section 1 a name.');
    expect(sopGroupingProblem([ok[0], { ...ok[1], sops: [] }])).toBe('“Safety” has no SOPs — move some in, or remove it.');
    expect(sopGroupingProblem([{ ...ok[0], share: '50' }, ok[1]])).toBe('The sections add up to 90% — make them 100%.');
    expect(sopGroupingProblem([ok[0], { ...ok[1], sops: [{ name: 'Incidents', share: '90' }] }])).toBe('The SOPs in “Safety” add up to 90% — make them 100%.');
    expect(sopGroupingProblem([{ ...ok[0], share: '' }, ok[1]])).toBe('Give each section a share from 0 to 100%.');
    expect(sopFormName(['Lunch'], 100)).toBe('Lunch — SOP check');
  });

  it('finds SOPs by any word of the title or a tag, and narrows to one tag', () => {
    const hygiene = { id: 't1', name: 'Hygiene', color: '#0d9488' };
    const daily = { id: 't2', name: 'Daily', color: '#5a67d8' };
    const sops = [
      { title: 'Health Screening', categories: [hygiene, daily] },
      { title: 'Packing', categories: [daily] },
      { title: 'Receiving', categories: [] },
    ];
    expect(filterSops(sops, 'screen health', '').map(s => s.title)).toEqual(['Health Screening']);
    expect(filterSops(sops, 'daily', '').map(s => s.title)).toEqual(['Health Screening', 'Packing']);
    expect(filterSops(sops, '', 't1').map(s => s.title)).toEqual(['Health Screening']);
    expect(filterSops(sops, 'pack', 't1')).toEqual([]);
    expect(sopTags(sops).map(c => c.name)).toEqual(['Daily', 'Hygiene']);
  });
});

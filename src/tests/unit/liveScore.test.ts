import { describe, it, expect } from 'vitest';
import type { TemplateCriterion, TemplateSection } from '../../api/appraisal-templates';
import { formKey, inputKey } from '../../pages/appraisals/appraisalRun';
import { criterionScore, itemScore, round1, sectionScore, totalScore, weightedScore } from '../../pages/appraisals/liveScore';

// Scores shown on screen as the scorer marks. They follow the server's rules
// (appraisalScoring.service) — these use the server tests' own examples, so a
// change to one without the other shows up here.

const form: TemplateCriterion = {
  id: 'care', name: 'Classroom care', description: null, weight: 50, inputType: 'FORM', points: [],
  scaleConfig: { scoringFormId: 'sf', name: 'Care', sections: [
    { name: 'Care', weight: 100, criteria: [
      { name: 'Patience', weight: 50, inputType: 'RATING', scaleConfig: { max: 4 } },
      { name: 'Calm', weight: 50, inputType: 'YES_NO', scaleConfig: null },
    ] },
  ] },
};

describe('Appraisal — scores as marks are given', () => {
  it('turns each mark into 0–100 the way the server does', () => {
    expect(itemScore({ kind: 'RATING', scaleConfig: { max: 5 } }, '4')).toBe(80);
    expect(itemScore({ kind: 'YES_NO', scaleConfig: null }, '1')).toBe(100);
    expect(itemScore({ kind: 'PERCENT', scaleConfig: null }, '65')).toBe(65);
    // Days late, target 2, lower is better: 1 → full marks, 3 → 50.
    expect(itemScore({ kind: 'NUMBER', scaleConfig: { target: 2, higherIsBetter: false } }, '1')).toBe(100);
    expect(itemScore({ kind: 'NUMBER', scaleConfig: { target: 2, higherIsBetter: false } }, '3')).toBe(50);
    // Nothing, or something that doesn't fit, isn't a score.
    expect(itemScore({ kind: 'RATING', scaleConfig: { max: 5 } }, '')).toBeNull();
    expect(itemScore({ kind: 'RATING', scaleConfig: { max: 5 } }, '9')).toBeNull();
  });

  it('scores a criterion from a scoring form as that form\'s weighted total — and waits for every item unless the form skips missing ones', () => {
    const both = { [inputKey('care', formKey(0, 0))]: '2', [inputKey('care', formKey(0, 1))]: '1' }; // 50 and 100
    expect(criterionScore(form, both, 'REQUIRE_ALL')).toBe(75);
    const one = { [inputKey('care', formKey(0, 0))]: '2' };
    expect(criterionScore(form, one, 'REQUIRE_ALL')).toBeNull();
    expect(criterionScore(form, one, 'REWEIGHT')).toBe(50);
  });

  it('weights parts and rounds to one decimal for showing', () => {
    expect(weightedScore([{ score: 80, weight: 50 }, { score: 75, weight: 50 }], 'REQUIRE_ALL')).toBe(77.5);
    expect(weightedScore([{ score: 100, weight: 1 }, { score: null, weight: 1 }], 'REWEIGHT')).toBe(100);
    expect(round1(88.75)).toBe(88.8);
  });
  it('works out each section and the total by weight — the server\'s example comes to 88.8', () => {
    const sections: TemplateSection[] = [
      { id: 's1', name: 'Core values', weight: 50, criteria: [
        { id: 'love', name: 'Love', description: null, weight: 50, inputType: 'RATING', scaleConfig: { max: 5 }, points: [] },
        { ...form, weight: 50 },
      ] },
      { id: 's2', name: 'KPI', weight: 50, criteria: [
        { id: 'late', name: 'Days late', description: null, weight: 100, inputType: 'NUMBER', scaleConfig: { target: 2, higherIsBetter: false }, points: [] },
      ] },
    ];
    const values = {
      [inputKey('love', null)]: '4', [inputKey('care', formKey(0, 0))]: '2', [inputKey('care', formKey(0, 1))]: '1', [inputKey('late', null)]: '1',
    };
    expect(sectionScore(sections[0], values, 'REQUIRE_ALL')).toBe(77.5);
    expect(sectionScore(sections[1], values, 'REQUIRE_ALL')).toBe(100);
    expect(totalScore(sections, values, 'REQUIRE_ALL')).toBe(88.8);
    expect(totalScore(sections, { [inputKey('love', null)]: '4' }, 'REQUIRE_ALL')).toBeNull();
  });
});
describe('Appraisal — SOP steps (pass, fail or N/A)', () => {
  // The server test's example: Arrival (3 steps) 50% + Hygiene (1 step) 50%.
  const sop: TemplateCriterion = {
    id: 'sop', name: 'Morning arrival SOP', description: null, weight: 100, inputType: 'FORM', points: [],
    scaleConfig: { scoringFormId: 'sf', name: 'Arrival', sections: [
      { name: 'Arrival', weight: 50, criteria: [
        { name: 'Greet', weight: 34, inputType: 'PASS_FAIL', scaleConfig: null },
        { name: 'Temperature', weight: 33, inputType: 'PASS_FAIL', scaleConfig: null },
        { name: 'Bag check', weight: 33, inputType: 'PASS_FAIL', scaleConfig: null },
      ] },
      { name: 'Hygiene', weight: 50, criteria: [{ name: 'Wash hands', weight: 100, inputType: 'PASS_FAIL', scaleConfig: null }] },
    ] },
  };
  const k = (s: number, c: number) => inputKey('sop', formKey(s, c));

  it('leaves N/A steps out so the others share their weight, the same as the server', () => {
    expect(itemScore({ kind: 'PASS_FAIL', scaleConfig: null }, '1')).toBe(100);
    expect(itemScore({ kind: 'PASS_FAIL', scaleConfig: null }, '0')).toBe(0);
    // Pass, fail, N/A → 50.7; Hygiene pass 100 → 75.4 — and with "score everything", N/A isn't a gap.
    const some = { [k(0, 0)]: '1', [k(0, 1)]: '0', [k(0, 2)]: '-1', [k(1, 0)]: '1' };
    expect(round1(criterionScore(sop, some, 'REQUIRE_ALL')!)).toBe(75.4);
    // A whole section N/A drops out: only Arrival counts (2 of 3 passed by weight = 67).
    const noHygiene = { [k(0, 0)]: '1', [k(0, 1)]: '1', [k(0, 2)]: '0', [k(1, 0)]: '-1' };
    expect(Math.round(criterionScore(sop, noHygiene, 'REQUIRE_ALL')!)).toBe(67);
  });
});

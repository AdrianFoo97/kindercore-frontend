import { describe, it, expect } from 'vitest';
import {
  draftFromTemplate, inputSummary, isFullWeight, moveItem, newPoint, numberRule, orderedChain, overWeightProblems, payloadFromDraft, remainingWeight, spreadEvenly,
  typedWeight, weightTotal,
} from '../../pages/settings/appraisalForms/appraisalFormDraft';
import type { AppraisalTemplate } from '../../api/appraisal-templates';

// Settings → Appraisal Forms: the editor's working copy of a form, its weight
// helpers and the plain-English descriptions of each criterion.

const template: AppraisalTemplate = {
  id: 't1', familyId: 't1', name: ' Monthly appraisal ', description: '', frequency: 'MONTHLY', status: 'DRAFT', version: 1,
  missingPolicy: 'REQUIRE_ALL', updatedAt: '2026-11-01T00:00:00Z', positionIds: [], problems: [], draftId: null, activeId: null,
  sections: [{
    id: 's1', name: 'Core values', weight: 50, criteria: [
      { id: 'c1', name: 'Love', description: null, weight: 60, inputType: 'RATING', scaleConfig: { max: 4, levels: [{ value: 4, label: 'Outstanding' }] }, points: [] },
      { id: 'c2', name: 'Late days', description: 'Days late', weight: 40, inputType: 'NUMBER', scaleConfig: { target: 2, higherIsBetter: false }, points: [] },
    ],
  }],
  stages: [
    { id: 'st1', name: 'Assessed by', kind: 'ASSESS', scope: 'OWN_TEAM', positionIds: ['SUP'] },
    { id: 'st2', name: 'Acknowledged', kind: 'ACKNOWLEDGE', scope: 'ANYONE', positionIds: [] },
  ],
};

describe('Appraisal forms — editing a form', () => {
  it('round-trips a form through the editor unchanged, apart from trimming text', () => {
    expect(payloadFromDraft(draftFromTemplate(template))).toEqual({
      name: 'Monthly appraisal', description: null, frequency: 'MONTHLY', missingPolicy: 'REQUIRE_ALL',
      sections: [{
        name: 'Core values', weight: 50, criteria: [
          { name: 'Love', description: null, weight: 60, inputType: 'RATING', scaleConfig: { max: 4, levels: [{ value: 4, label: 'Outstanding' }] }, points: [] },
          { name: 'Late days', description: 'Days late', weight: 40, inputType: 'NUMBER', scaleConfig: { target: 2, higherIsBetter: false }, points: [] },
        ],
      }],
      stages: [
        { name: 'Assessed by', kind: 'ASSESS', scope: 'OWN_TEAM', positionIds: ['SUP'] },
        { name: 'Acknowledged', kind: 'ACKNOWLEDGE', scope: 'ANYONE', positionIds: [] },
      ],
    });
  });

  it('keeps a criterion\'s own points in order, leaving out blank ones, and none for criteria scored directly', () => {
    const d = draftFromTemplate({
      ...template,
      sections: [{ ...template.sections[0], criteria: [{ ...template.sections[0].criteria[0], points: [{ id: 'p1', name: 'Speaks calmly' }] }, template.sections[0].criteria[1]] }],
    });
    d.sections[0].criteria[0].points.push(newPoint('  Comforts upset children '), newPoint('   '));
    const [love, late] = payloadFromDraft(d).sections[0].criteria;
    expect(love.points).toEqual([{ name: 'Speaks calmly' }, { name: 'Comforts upset children' }]);
    expect(late.points).toEqual([]);
  });

  it('drops level names above a smaller rating scale', () => {
    const d = draftFromTemplate(template);
    d.sections[0].criteria[0].ratingMax = 3;
    expect(payloadFromDraft(d).sections[0].criteria[0].scaleConfig).toEqual({ max: 3, levels: [] });
  });

  it('keeps the approval chain in its fixed order: assess, sign-offs, then acknowledge', () => {
    const d = draftFromTemplate(template);
    const signOff = { key: 'x', name: 'Principal', kind: 'SIGN_OFF' as const, scope: 'ANYONE' as const, positionIds: ['PRIN'] };
    expect(orderedChain(d.stages[0], [signOff], true).map(s => s.kind)).toEqual(['ASSESS', 'SIGN_OFF', 'ACKNOWLEDGE']);
    expect(orderedChain(d.stages[0], [signOff], false).map(s => s.kind)).toEqual(['ASSESS', 'SIGN_OFF']);
    expect(orderedChain(undefined, [], false)[0]).toMatchObject({ kind: 'ASSESS', scope: 'OWN_TEAM', positionIds: [] });
  });

  it('moves a section or criterion one place, and ignores moves past either end', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  });
});

describe('Appraisal forms — weights and descriptions', () => {
  it('splits 100% evenly in whole numbers, giving the leftover to the first items', () => {
    expect(spreadEvenly(3)).toEqual([34, 33, 33]);
    expect(spreadEvenly(4)).toEqual([25, 25, 25, 25]);
    expect(spreadEvenly(0)).toEqual([]);
    expect(weightTotal(spreadEvenly(7))).toBe(100);
  });

  it('adds weights to one decimal, and treats 33.3 × 3 as not quite 100', () => {
    expect(weightTotal([33.3, 33.3, 33.3])).toBe(99.9);
    expect(isFullWeight([33.3, 33.3, 33.3])).toBe(false);
    expect(isFullWeight([50, 50])).toBe(true);
  });

  it('starts a new criterion or section on whatever is left of 100% — all of it for the first', () => {
    expect(remainingWeight([])).toBe(100);
    expect(remainingWeight([60])).toBe(40);
    expect(remainingWeight([33.3, 33.3])).toBe(33.4);
    expect(remainingWeight([70, 50])).toBe(0);
  });

  it('keeps a typed weight exactly as typed, only holding one box to 0–100', () => {
    expect(typedWeight(70)).toBe(70);
    expect(typedWeight(150)).toBe(100);
    expect(typedWeight(-5)).toBe(0);
    expect(typedWeight(Number.NaN)).toBe(0);
  });

  it('says which weights add up to more than 100%, and by how much', () => {
    const section = (name: string, weight: number, criteria: number[]) =>
      ({ name, weight, criteria: criteria.map(w => ({ weight: w })) as never });
    expect(overWeightProblems([section('Core values', 50, [70, 60]), section('KPI', 50, [100])]))
      .toEqual(['Criteria in “Core values” add up to 130%, 30% too much.']);
    expect(overWeightProblems([section('Core values', 70, [100]), section('', 40, [50])]))
      .toEqual(['Sections add up to 110%, 10% too much.']);
    expect(overWeightProblems([section('Core values', 50, [40, 30])])).toEqual([]);
  });

  it('keeps a name and a "what it looks like" for each rating level, dropping empty ones', () => {
    const d = draftFromTemplate(template);
    const c = d.sections[0].criteria[0];
    c.ratingDescriptions[0] = ' Often loses patience ';
    expect(payloadFromDraft(d).sections[0].criteria[0].scaleConfig).toEqual({
      max: 4, levels: [{ value: 1, label: '', description: 'Often loses patience' }, { value: 4, label: 'Outstanding' }],
    });
  });

  it('describes how each criterion is scored in a few words', () => {
    const base = { ratingMax: 5, target: '' as const, higherIsBetter: false };
    expect(inputSummary({ ...base, inputType: 'RATING' })).toBe('Rating 1–5');
    expect(inputSummary({ ...base, inputType: 'RATING', ratingLabels: ['Rarely patient', '', '', '', 'Always caring'] })).toBe('Rating 1–5 · Rarely patient → Always caring');
    expect(inputSummary({ ...base, inputType: 'YES_NO' })).toBe('Yes or no');
    expect(inputSummary({ ...base, inputType: 'NUMBER' })).toBe('Number · no target yet');
    expect(inputSummary({ ...base, inputType: 'NUMBER', target: 2 })).toBe('Number · target 2, lower is better');
  });

  it('explains how a number becomes a mark, matching the server\'s scoring', () => {
    expect(numberRule(2, false)).toBe('2 or fewer scores 100%. 4 or more scores 0%.');
    expect(numberRule(10, true)).toBe('10 or more scores 100%. Half of it (5) scores 50%.');
    expect(numberRule('', true)).toBe('Set a target above 0.');
  });
});

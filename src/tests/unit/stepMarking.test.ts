import { describe, it, expect } from 'vitest';
import { CUSTOM_STARTER, ONE_TO_FIVE, levelsFromRatingScale, levelsProblem, markingOfPoint, pointScale } from '../../pages/settings/appraisalForms/stepMarking';
import { levelsScore, markingOfObservation, passMarkText, passedForLevel } from '../../pages/observationMarking';
import { markText, valueProblem } from '../../pages/appraisals/appraisalRun';
import { itemScore } from '../../pages/appraisals/liveScore';
import { markingLine } from '../../pages/appraisals/sopCheck';

// How SOP steps are marked: Pass / Fail, 1–5, a rating scale, or custom levels — always with N/A.

const levels = [{ label: 'Fail', score: 0 }, { label: 'Satisfactory', score: 60 }, { label: 'Excellent', score: 100 }];
const step = { kind: 'LEVELS' as const, scaleConfig: { levels } };

describe('SOP steps — how they’re marked', () => {
  it('offers 1–5, a rating scale as its own levels, or custom levels', () => {
    expect(ONE_TO_FIVE.map(l => l.score)).toEqual([20, 40, 60, 80, 100]);
    expect(levelsFromRatingScale({ max: 4, levels: [{ value: 1, label: 'Poor' }, { value: 4, label: 'Great' }] }))
      .toEqual([{ label: 'Poor', score: 25 }, { label: '2', score: 50 }, { label: '3', score: 75 }, { label: 'Great', score: 100 }]);
    expect(CUSTOM_STARTER).toEqual(levels);
  });

  it('keeps Save off with a reason until the custom levels make sense', () => {
    expect(levelsProblem(levels)).toBeNull();
    expect(levelsProblem([{ label: 'Only', score: 50 }])).toMatch(/at least 2/);
    expect(levelsProblem([{ label: '', score: 0 }, { label: 'Good', score: 100 }])).toMatch(/name/);
    expect(levelsProblem([{ label: 'Low', score: 0 }, { label: 'low', score: 100 }])).toMatch(/same name/);
    expect(levelsProblem([{ label: 'Low', score: 0 }, { label: 'High', score: 120 }])).toMatch(/0 to 100/);
  });

  it('saves each step with its levels, and reads the form’s marking back from a step', () => {
    const saved = pointScale({ inputType: 'LEVELS', levels, source: { kind: 'CUSTOM' } });
    expect(saved).toEqual({ inputType: 'LEVELS', scaleConfig: { levels, source: { kind: 'CUSTOM' } } });
    expect(markingOfPoint(saved)).toEqual({ inputType: 'LEVELS', levels, source: { kind: 'CUSTOM' } });
    expect(markingOfPoint({ inputType: 'PASS_FAIL' })).toEqual({ inputType: 'PASS_FAIL' });
  });

  it('marks and scores a step on levels: its percentage, N/A not counted', () => {
    expect(markText(step, '1')).toBe('Satisfactory · 60%');
    expect(markText(step, '-1')).toBe('N/A');
    expect(itemScore(step, '2')).toBe(100);
    expect(valueProblem('LEVELS', step.scaleConfig, '3')).toMatch(/level/);
    expect(valueProblem('LEVELS', step.scaleConfig, '-1')).toBeNull();
  });
});

describe('Practice observations — marked on levels', () => {
  it('passes a step at or above the pass mark, fails below, and averages the marked steps', () => {
    const m = markingOfObservation({ inputType: 'LEVELS', levels, passMark: 60 });
    expect(m.inputType).toBe('LEVELS');
    expect(passedForLevel(levels, 60, 1)).toBe('PASS');
    expect(passedForLevel(levels, 60, 0)).toBe('FAIL');
    expect(passedForLevel(levels, 60, null)).toBe('NA');
    expect(levelsScore(levels, [1, 2, null])).toBe(80);
    expect(passMarkText(levels, 60)).toBe('Satisfactory (60%) and above');
    expect(markingOfObservation(null)).toEqual({ inputType: 'PASS_FAIL' });
  });
});

describe('SOP checks — how it’s marked, in words', () => {
  it('says how this form marks its steps, from the steps themselves', () => {
    const group = (kind: 'PASS_FAIL' | 'LEVELS') => [{ name: 'Gate Duty', inputs: [{ key: 'a', criterionId: 'c', pointId: 'p', name: 'Open', kind, scaleConfig: kind === 'LEVELS' ? { levels } : null, weight: 1 }] }];
    expect(markingLine(group('LEVELS') as never)).toBe('Mark each step Fail (0%), Satisfactory (60%), Excellent (100%) or N/A. Each SOP scores the average of its marked steps; N/A isn’t counted.');
    expect(markingLine(group('PASS_FAIL') as never)).toMatch(/^Mark each step pass, fail or N\/A/);
  });
});

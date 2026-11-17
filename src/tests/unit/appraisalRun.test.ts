import { describe, it, expect } from 'vitest';
import type { TemplateSection } from '../../api/appraisal-templates';
import type { AppraisalTask } from '../../api/appraisal-runs';
import type { AppraisalSchedule } from '../../api/appraisal-schedules';
import type { AppraisalOverviewRow, AppraisalStage } from '../../api/teacher-appraisals';
import {
  allInputs, criterionDone, criterionLeft, formKey, inputKey, isDirty, notesFrom, periodLabel, progressOf, scoresPayload, sendBackReason, stepStates, submitBlocker, valueProblem, valuesFrom,
} from '../../pages/appraisals/appraisalRun';
import { alreadyScheduled, byStaff, describeRule, draftProblem, fitsForm, groupAssignable, newDraft, ordinal, scheduleCounts } from '../../pages/appraisals/appraisalSchedule';
import { actionLabel, appraisalItems, inProgressNote, initialView, stageOf, tabCounts } from '../../pages/appraisals/appraisalsList';
import { groupTasks, taskLine } from '../../pages/appraisals/appraisalTasks';
import { isSopCheck, sopProgress } from '../../pages/appraisals/sopCheck';
import { signOffOutcome } from '../../pages/appraisals/appraisalRun';

// Scoring an appraisal on screen, the appraisal schedule, HRMS → Appraisals,
// and the "Appraisals to do" list. The server checks everything again — these make
// sure the page says so up front and keeps Submit disabled until it's ready.

const sections: TemplateSection[] = [
  { id: 's1', name: 'Core values', weight: 100, criteria: [
    { id: 'love', name: 'Love', description: null, weight: 50, inputType: 'RATING', scaleConfig: { max: 5, levels: [] }, points: [] },
    // Scored from a copied scoring form: Patience (rating 1–4) + Calm (yes/no).
    { id: 'care', name: 'Care', description: null, weight: 50, inputType: 'FORM', points: [], scaleConfig: { scoringFormId: 'sf', name: 'Care', sections: [
      { name: 'Care', weight: 100, criteria: [
        { name: 'Patience', weight: 50, inputType: 'RATING', scaleConfig: { max: 4 } },
        { name: 'Calm', weight: 50, inputType: 'YES_NO', scaleConfig: null },
      ] },
    ] } },
  ] },
];

describe('Appraisal — scoring on screen', () => {
  it('gives a box for each criterion, and one for each criterion of a copied scoring form (keyed as the server keys them)', () => {
    expect(allInputs(sections).map(i => [i.criterionId, i.pointId, i.kind])).toEqual([
      ['love', null, 'RATING'], ['care', formKey(0, 0), 'RATING'], ['care', formKey(0, 1), 'YES_NO'],
    ]);
    expect(formKey(0, 1)).toBe('f:0:1');
  });

  it('keeps what was typed and flags it when it doesn\'t fit', () => {
    expect(valueProblem('RATING', { max: 5 }, '6')).toBe('Pick 1 to 5.');
    expect(valueProblem('RATING', { max: 5 }, '4')).toBeNull();
    expect(valueProblem('PERCENT', null, '120')).toBe('Enter 0 to 100.');
    expect(valueProblem('NUMBER', null, '-1')).toBe('Can’t be below 0.');
    expect(valueProblem('NUMBER', null, '')).toBeNull();
  });

  it('can\'t be submitted until everything is scored and every score fits (or, when missing ones are skipped, until one is)', () => {
    const inputs = allInputs(sections);
    const partial = { [inputs[0].key]: '4', [inputs[1].key]: '2' };
    expect(submitBlocker(sections, 'REQUIRE_ALL', partial)).toBe('Still to score: Care.');
    expect(submitBlocker(sections, 'REQUIRE_ALL', { ...partial, [inputs[2].key]: '1' })).toBeNull();
    expect(submitBlocker(sections, 'REQUIRE_ALL', { ...partial, [inputs[0].key]: '9', [inputs[2].key]: '1' })).toBe('Fix the scores marked in red first.');
    expect(submitBlocker(sections, 'REWEIGHT', {})).toBe('Score at least one thing first.');
    expect(submitBlocker(sections, 'REWEIGHT', partial)).toBeNull();
  });

  it('sends every box (empty ones as nothing), and only counts a real change as unsaved', () => {
    const inputs = allInputs(sections);
    const saved = valuesFrom([{ criterionId: 'love', pointId: null, rawValue: 4, normalised: null, comment: null }]);
    expect(saved).toEqual({ [inputKey('love', null)]: '4' });
    expect(scoresPayload(inputs, saved)).toEqual([
      { criterionId: 'love', pointId: null, rawValue: 4, comment: null },
      { criterionId: 'care', pointId: 'f:0:0', rawValue: null, comment: null },
      { criterionId: 'care', pointId: 'f:0:1', rawValue: null, comment: null },
    ]);
    expect(isDirty(inputs, { [inputKey('love', null)]: '4.0' }, saved, '', null)).toBe(false);
    expect(isDirty(inputs, saved, saved, 'Great month', null)).toBe(true);
  });
});

describe('Appraisal — scoring, item by item', () => {
  it('keeps a comment on each scored item, counts it as a change, and shows how far the scorer has got', () => {
    const inputs = allInputs(sections);
    const values = { [inputs[0].key]: '4' };
    const notes = { [inputs[0].key]: ' Warm with every child ' };
    expect(scoresPayload(inputs, values, notes)[0]).toEqual({ criterionId: 'love', pointId: null, rawValue: 4, comment: 'Warm with every child' });
    expect(scoresPayload(inputs, values, notes)[1].comment).toBeNull();
    expect(isDirty(inputs, values, values, '', null, notes, {})).toBe(true);
    expect(notesFrom([{ criterionId: 'love', pointId: null, rawValue: 4, normalised: 80, comment: 'Kind' }])).toEqual({ [inputKey('love', null)]: 'Kind' });
    expect(progressOf(inputs, values)).toEqual({ done: 1, total: 3 });
    // A criterion is ticked once every part of it is scored.
    expect(criterionDone(sections[0].criteria[0], values)).toBe(true);
    expect(criterionDone(sections[0].criteria[1], { ...values, [inputs[1].key]: '2' })).toBe(false);
    // Not finished: the tab shows how many are still to score instead of a tick.
    expect(criterionLeft(sections[0].criteria[0], values)).toBe(0);
    expect(criterionLeft(sections[0].criteria[1], values)).toBeGreaterThan(0);
  });
});
describe('Appraisal — how it reads', () => {
  it('names the period the way its form runs', () => {
    expect(periodLabel('MONTHLY', { year: 2026, month: 9 })).toBe('October 2026');
    expect(periodLabel('QUARTERLY', { year: 2026, month: 9 })).toBe('Q4 2026 (Oct–Dec)');
    expect(periodLabel('YEARLY', { year: 2026, month: 0 })).toBe('2026');
  });

  it('ticks the steps before the current one, and all of them once it\'s done', () => {
    const stages = [{ kind: 'ASSESS' }, { kind: 'SIGN_OFF' }, { kind: 'ACKNOWLEDGE' }].map((s, i) => ({ id: `st${i}`, name: '', scope: 'ANYONE' as const, positionIds: [], kind: s.kind as never }));
    expect(stepStates(stages, 1, 'AWAITING_SIGN_OFF')).toEqual(['done', 'current', 'todo']);
    expect(stepStates(stages, null, 'COMPLETED')).toEqual(['done', 'done', 'done']);
  });

  it('shows why it was last sent back, only while it\'s waiting to be rescored', () => {
    const log = [
      { kind: 'SENT_BACK' as const, detail: 'First', authorName: 'Pat', at: '2026-11-01' },
      { kind: 'SUBMITTED' as const, detail: null, authorName: 'Sam', at: '2026-11-02' },
      { kind: 'SENT_BACK' as const, detail: 'Check Love', authorName: 'Pat', at: '2026-11-03' },
    ];
    expect(sendBackReason({ status: 'SENT_BACK', log })?.detail).toBe('Check Love');
    expect(sendBackReason({ status: 'AWAITING_SIGN_OFF', log })).toBeNull();
  });
});

const sched = (over: Partial<AppraisalSchedule>): AppraisalSchedule => ({
  id: 's', teacherId: 't-tina', teacherName: 'Tina', positionName: 'Junior EI', familyId: 'f', formName: 'Monthly', formLive: true,
  repeat: 'MONTHLY', dayOfMonth: 1, monthOfYear: null, startsOn: '2026-11-15', nextOn: '2026-12-01', status: 'ONGOING', ...over,
});

describe('Appraisal schedule', () => {
  it('reads a schedule in plain words', () => {
    expect(describeRule({ repeat: 'MONTHLY', dayOfMonth: 1, monthOfYear: null, startsOn: '2026-11-15' })).toBe('Every month on the 1st');
    expect(describeRule({ repeat: 'QUARTERLY', dayOfMonth: 22, monthOfYear: null, startsOn: '2026-11-15' })).toBe('Every quarter on the 22nd (Jan, Apr, Jul, Oct)');
    expect(describeRule({ repeat: 'YEARLY', dayOfMonth: 15, monthOfYear: 5, startsOn: '2026-11-15' })).toBe('Every year on 15 June');
    expect(describeRule({ repeat: 'ONCE', dayOfMonth: 1, monthOfYear: null, startsOn: '2026-12-03' })).toBe('Once, on 3 Dec 2026');
    expect([1, 2, 3, 11, 12, 13, 21].map(ordinal)).toEqual(['1st', '2nd', '3rd', '11th', '12th', '13th', '21st']);
  });

  it('can\'t be saved without a form, staff, a day and a start date', () => {
    expect(draftProblem(newDraft())).toBe('Pick an appraisal form.');
    expect(draftProblem(newDraft({ familyId: 'f' }))).toBe('Pick at least one staff member.');
    expect(draftProblem(newDraft({ familyId: 'f', teacherIds: ['t'], startsOn: '' }))).toBe('Pick a start date.');
    expect(draftProblem(newDraft({ familyId: 'f', teacherIds: ['t'] }))).toBeNull();
  });

  it('only lets staff in the form\'s positions be put on it, and not anyone already on a repeating schedule for it', () => {
    expect(fitsForm({ positionId: 'EI' }, ['EI', 'SEI'])).toBe(true);
    expect(fitsForm({ positionId: 'SUP' }, ['EI'])).toBe(false);
    expect(fitsForm({ positionId: null }, ['EI'])).toBe(false);
    // Listed as who can be assigned, then who can't — each A–Z.
    const staff = [{ id: 'z', name: 'Zara' }, { id: 'a', name: 'Adam' }, { id: 'b', name: 'Bella' }];
    const { assignable, notAssignable } = groupAssignable(staff, new Map([['a', 'For Junior EI only']]));
    expect([assignable.map(s => s.name), notAssignable.map(s => s.name)]).toEqual([['Bella', 'Zara'], ['Adam']]);
    expect([...alreadyScheduled([sched({ teacherId: 'b' }), sched({ teacherId: 'c', repeat: 'ONCE' })], 'f')]).toEqual(['b']);
  });

  it('lists active schedules by staff member, and counts how many each person is on', () => {
    const list = [sched({ id: '1', formName: 'Yearly review' }), sched({ id: '2' }), sched({ id: '3', teacherId: 't-ben', teacherName: 'Ben', status: 'FINISHED' })];
    expect(byStaff(list).map(r => [r.teacherName, r.schedules.map(s => s.formName)])).toEqual([['Ben', ['Monthly']], ['Tina', ['Monthly', 'Yearly review']]]);
    expect([...scheduleCounts(list)]).toEqual([['t-tina', 2]]); // a finished one-off doesn't count
  });
});

describe('HRMS → Appraisals', () => {
  it('files each scheduled appraisal by its step — pending, in progress, sign-off, staff to confirm, done — plus months recorded by hand', () => {
    const run = (id: string, stage: AppraisalStage) =>
      ({ id, formName: 'Monthly', period: { year: 2026, month: 10 }, periodType: 'MONTHLY' as const, status: 'IN_PROGRESS' as const, stage, totalScore: null });
    const row = (teacherId: string, over: Partial<AppraisalOverviewRow>): AppraisalOverviewRow => ({
      teacherId, name: teacherId, color: '', positionName: null, appraisal: null, previous: null,
      twelveMonth: { average: null, recordCount: 0, windowSize: 12 } as never, averages: { quarter: null, year: null }, yearScores: [], runs: [], ...over,
    });
    const manual = { id: 'm', teacherId: 'c', year: 2026, month: 10, score: 80, notes: null, evaluatedBy: null, createdAt: '', updatedAt: '' };
    const items = appraisalItems([
      row('a', { runs: [run('r1', 'PENDING')] }), row('b', { runs: [run('r2', 'IN_PROGRESS')] }), row('e', { runs: [run('r3', 'SIGN_OFF'), run('r4', 'CONFIRM')] }),
      row('c', { appraisal: manual }), row('d', {}),
    ]);
    expect(tabCounts(items)).toEqual({ PENDING: 1, IN_PROGRESS: 1, SIGN_OFF: 1, CONFIRM: 1, DONE: 1, ALL: 5 });
    expect(items.map(actionLabel)).toEqual(['Start', 'Continue', 'Review', 'View', 'Edit']);
    expect([inProgressNote('SENT_BACK'), inProgressNote('IN_PROGRESS')]).toEqual(['Sent back', 'Draft saved']);
  });
});

describe('HRMS → Appraisals — after saving or submitting', () => {
  it('opens on the month and tab the appraisal is now in', () => {
    expect([stageOf('IN_PROGRESS'), stageOf('IN_PROGRESS', false), stageOf('SENT_BACK'), stageOf('AWAITING_SIGN_OFF'), stageOf('AWAITING_ACKNOWLEDGEMENT'), stageOf('COMPLETED')])
      .toEqual(['IN_PROGRESS', 'PENDING', 'IN_PROGRESS', 'SIGN_OFF', 'CONFIRM', 'DONE']);
    const now = { year: 2026, month: 10 };
    expect(initialView(new URLSearchParams('year=2026&month=9&tab=SIGN_OFF'), now)).toEqual({ period: { year: 2026, month: 9 }, tab: 'SIGN_OFF' });
    expect(initialView(new URLSearchParams(''), now)).toEqual({ period: now, tab: 'PENDING' });
    expect(initialView(new URLSearchParams('month=13&tab=NOPE'), now)).toEqual({ period: now, tab: 'PENDING' });
  });
});
describe('Appraisals to do', () => {
  it('groups what\'s waiting by what to do, in the order it\'s done', () => {
    const task = (id: string, todo: AppraisalTask['todo'], teacherId = 't-tina'): AppraisalTask =>
      ({ id, teacherId, teacherName: 'Tina', formName: 'Monthly', period: { year: 2026, month: 9 }, status: 'IN_PROGRESS', todo });
    const groups = groupTasks([task('1', 'ACKNOWLEDGE'), task('2', 'SCORE'), task('3', 'SCORE')]);
    expect(groups.map(g => [g.todo, g.tasks.length])).toEqual([['SCORE', 2], ['ACKNOWLEDGE', 1]]);
    expect(taskLine(task('1', 'SCORE'), false)).toBe('Tina · Monthly · Oct 2026');
    expect(taskLine(task('1', 'ACKNOWLEDGE'), true)).toBe('Monthly · Oct 2026');
  });
});

describe('Appraisal — SOP checks', () => {
  const step = (key: string) => ({ key, criterionId: 'sop', pointId: key, name: key, kind: 'PASS_FAIL' as const, scaleConfig: null, weight: 50 });
  const gate = { name: 'Gate Duty', weight: 50, inputs: [step('a'), step('b')] };
  const lunch = { name: 'Lunch Duty', weight: 50, inputs: [step('c'), step('d')] };

  it('tells each SOP apart as not started, in progress or done, with how many passed', () => {
    expect(sopProgress(gate, {})).toEqual({ marked: 0, passed: 0, total: 2, status: 'NOT_STARTED' });
    expect(sopProgress(gate, { a: '1' })).toEqual({ marked: 1, passed: 1, total: 2, status: 'IN_PROGRESS' });
    // N/A counts as marked (it's a decision), but not as passed.
    expect(sopProgress(gate, { a: '0', b: '-1' })).toEqual({ marked: 2, passed: 0, total: 2, status: 'DONE' });
    expect(isSopCheck([gate, lunch])).toBe(true);
    expect(isSopCheck([gate])).toBe(false);
    expect(isSopCheck([gate, { ...lunch, inputs: [{ ...step('c'), kind: 'RATING' as const }] }])).toBe(false);
  });
});

describe('Appraisal — signing off', () => {
  const assess = { name: 'Score it', kind: 'ASSESS' as const };
  const principal = { name: 'Principal sign-off', kind: 'SIGN_OFF' as const };
  const head = { name: 'Head sign-off', kind: 'SIGN_OFF' as const };
  const confirm = { name: 'Staff confirms', kind: 'ACKNOWLEDGE' as const };

  it('names what signing off does next: send to the staff member, to the next approver, or complete', () => {
    expect(signOffOutcome([assess, principal, confirm], 1, 'Nabila').label).toBe('Sign off & send to Nabila');
    expect(signOffOutcome([assess, principal, confirm], 1, 'Nabila').message).toContain('Nabila will see the scores');
    expect(signOffOutcome([assess, head, principal, confirm], 1, 'Nabila').label).toBe('Sign off & send to Principal sign-off');
    expect(signOffOutcome([assess, head, principal, confirm], 1, 'Nabila').message).toContain('Nabila doesn’t see it yet');
    expect(signOffOutcome([assess, principal], 1, 'Nabila').label).toBe('Sign off & complete');
  });
});

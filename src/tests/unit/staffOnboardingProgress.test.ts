import { describe, it, expect } from 'vitest';
import { checklistFor, checklistProgress, onboardingStage } from '../../pages/staffOnboarding/progress';

// HR → Onboarding: where each new staff member is in their checklist.

const task = (name: string, done: boolean) => ({ task: name, done });

describe('Staff onboarding — progress', () => {
  it('counts ticked tasks and points at the next one to do', () => {
    expect(checklistProgress([task('IC copy', true), task('Contract', false), task('EPF', false)]))
      .toEqual({ done: 1, total: 3, nextTask: 'Contract', stage: 'inProgress' });
  });

  it('sorts people into not started, in progress and ready to complete', () => {
    expect(checklistProgress([task('IC copy', false)]).stage).toBe('notStarted');
    expect(checklistProgress([task('IC copy', true), task('Contract', false)]).stage).toBe('inProgress');
    expect(checklistProgress([task('IC copy', true), task('Contract', true)]).stage).toBe('ready');
  });

  it('treats an empty checklist as not started, never as ready', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, nextTask: null, stage: 'notStarted' });
  });

  it('is ready to complete only when both HR\'s list and their own list are done', () => {
    const allDone = [task('IC copy', true), task('Contract', true)];
    expect(onboardingStage(allDone, [task('Handbook', false)])).toBe('inProgress');
    expect(onboardingStage(allDone, [task('Handbook', true)])).toBe('ready');
    expect(onboardingStage(allDone, [])).toBe('ready'); // no own list set up — HR's alone
    expect(onboardingStage([task('IC copy', false)], [task('Handbook', false)])).toBe('notStarted');
    expect(onboardingStage([task('IC copy', false)], [task('Handbook', true)])).toBe('inProgress');
  });

  it('starts someone with no checklist on the template, and keeps an existing one as it is', () => {
    expect(checklistFor([], ['IC copy', 'Contract'])).toEqual([task('IC copy', false), task('Contract', false)]);
    const own = [task('Custom step', true)];
    expect(checklistFor(own, ['IC copy'])).toBe(own);
  });
});

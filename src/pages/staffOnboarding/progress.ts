import type { OnboardingTask } from '../../types/index.js';

// Where a new staff member is in their onboarding checklist.

export type OnboardingStage = 'notStarted' | 'inProgress' | 'ready';

export interface ChecklistProgress {
  done: number;
  total: number;
  /** The first unticked task — what HR should do next. */
  nextTask: string | null;
  stage: OnboardingStage;
}

export function checklistProgress(tasks: OnboardingTask[]): ChecklistProgress {
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const nextTask = tasks.find(t => !t.done)?.task ?? null;
  // An empty checklist is "not started" — there's nothing ticked to finish.
  const stage: OnboardingStage = total > 0 && done === total ? 'ready' : done === 0 ? 'notStarted' : 'inProgress';
  return { done, total, nextTask, stage };
}

/**
 * Where a new joiner stands across both lists. Ready only when HR's list AND
 * their own list are done — that's when HR can mark onboarding complete.
 */
export function onboardingStage(hr: OnboardingTask[], own: OnboardingTask[]): OnboardingStage {
  const h = checklistProgress(hr);
  const o = checklistProgress(own);
  const ownDone = o.total === 0 || o.stage === 'ready';
  if (h.stage === 'ready' && ownDone) return 'ready';
  if (h.done === 0 && o.done === 0) return 'notStarted';
  return 'inProgress';
}

/** True when nothing is left to tick on a list (an empty list counts as done). */
export function isListDone(tasks: OnboardingTask[]): boolean {
  return tasks.every(t => t.done);
}

/** Use the person's own checklist; if they have none yet, start them on the template. */
export function checklistFor(own: OnboardingTask[], template: string[]): OnboardingTask[] {
  return own.length > 0 ? own : template.map(task => ({ task, done: false }));
}

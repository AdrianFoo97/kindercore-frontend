import type { SopObservationStatus, TrainingItem } from '../../api/sop-observations.js';

// Teacher app → My training: SOP observations, as trainee and as trainer. Pure helpers.

/** What each status means — for the trainee, and for the trainer (whose job the first step is). */
export const TRAINING_STATUS: Record<SopObservationStatus, { trainee: string; trainer: string; done: boolean }> = {
  PENDING_TRAINER: { trainee: 'Training to do', trainer: 'To train', done: false },
  PENDING_ASSESSOR: { trainee: 'Waiting to be assessed', trainer: 'Trained — waiting for the assessor', done: false },
  CERTIFIED: { trainee: 'Certified', trainer: 'Certified', done: true },
};

/** Still open first (oldest first — waiting longest), then the certified ones, newest first. */
export function sortTraining(items: TrainingItem[]): TrainingItem[] {
  const open = items.filter(i => i.status !== 'CERTIFIED').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const done = items.filter(i => i.status === 'CERTIFIED').sort((a, b) => (b.assessorAt ?? b.createdAt).localeCompare(a.assessorAt ?? a.createdAt));
  return [...open, ...done];
}

/** Today as YYYY-MM-DD, on this device's clock. */
export function todayDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Why the training day can't be recorded yet — or null when it can (the server checks the same). */
export function trainedOnProblem(trainedOn: string, today: string): string | null {
  if (!DAY_PATTERN.test(trainedOn)) return 'Pick the day you gave the training.';
  if (trainedOn > today) return 'The training day can’t be in the future.';
  return null;
}

/** Why the assessor can't certify yet — or null (the server checks the same). */
export function certifyProblem(marks: ('PASS' | 'FAIL' | 'NA')[]): string | null {
  if (marks.some(m => m === 'FAIL')) return 'A step failed — send it back for more training instead.';
  if (!marks.some(m => m === 'PASS')) return 'Mark at least one step passed to certify.';
  return null;
}

/** Training waiting for them to give (as the trainer) — the count on Home's "My training" tile. */
export const trainingToGive = (t: { asTrainer: TrainingItem[] }): number => t.asTrainer.filter(i => i.status === 'PENDING_TRAINER').length;

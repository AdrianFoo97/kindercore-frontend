import type { StepResultValue } from '../api/sop-observations.js';

// HRMS → Practice Observations: how an observation's steps are marked — the copy
// it took of Settings → Practice observations when it was assigned. Pass / Fail /
// N/A, or levels each worth a percentage with a pass mark (at or above it passes).
// The server works out pass / fail the same way (sopTraining.logic storedMarks).

export interface MarkLevel { label: string; score: number }
export type ObservationMarking = { inputType: 'PASS_FAIL' } | { inputType: 'LEVELS'; levels: MarkLevel[]; passMark: number };
export const OBSERVATION_MARKING_KEY = 'observation_step_marking';

/** The observation's marking (pass / fail when it has none). */
export function markingOfObservation(raw: unknown): ObservationMarking {
  const m = raw as { inputType?: string; levels?: MarkLevel[]; passMark?: number } | null;
  return m?.inputType === 'LEVELS' && Array.isArray(m.levels) && m.levels.length ? { inputType: 'LEVELS', levels: m.levels, passMark: Number(m.passMark ?? 0) } : { inputType: 'PASS_FAIL' };
}

/** A level's result: at or above the pass mark passes; no level = N/A. */
export function passedForLevel(levels: MarkLevel[], passMark: number, level: number | null): StepResultValue {
  if (level == null || level < 0 || !levels[level]) return 'NA';
  return levels[level].score >= passMark ? 'PASS' : 'FAIL';
}

/** The average of the marked steps' levels (N/A left out) — null until one is marked. */
export function levelsScore(levels: MarkLevel[], marked: (number | null)[]): number | null {
  const scores = marked.filter((l): l is number => l != null && !!levels[l]).map(l => levels[l].score);
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

/** The pass mark as a level choice: "Satisfactory (60%) and above". */
export const passMarkText = (levels: MarkLevel[], passMark: number) => {
  const lowest = [...levels].sort((a, b) => a.score - b.score).find(l => l.score >= passMark);
  return lowest ? `${lowest.label} (${lowest.score}%) and above` : `${passMark}% and above`;
};

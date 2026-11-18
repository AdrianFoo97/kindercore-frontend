// How SOP steps are marked — on an SOP scoring form (and practice observations).
// Every way includes N/A, which isn't counted:
//  - Pass / Fail (pass = 100%, fail = 0%)
//  - Levels, each worth a percentage — copied from a rating scale, 1–5, or made up
//    (e.g. Fail 0%, Satisfactory 60%, Excellent 100%).
// The server checks the same rules (appraisalScoringSchemas LEVELS).

export interface MarkLevel { label: string; score: number }
/** Where a form's levels came from — kept so the editor shows the same choice again. */
export type LevelsSource = { kind: 'SCALE'; scaleId: string } | { kind: 'ONE_TO_FIVE' } | { kind: 'CUSTOM' };
export type StepMarking = { inputType: 'PASS_FAIL' } | { inputType: 'LEVELS'; levels: MarkLevel[]; source: LevelsSource };

export const PASS_FAIL: StepMarking = { inputType: 'PASS_FAIL' };
export const MIN_LEVELS = 2;
export const MAX_LEVELS = 10;
export const MAX_LEVEL_LABEL = 40;
const FULL = 100;

/** 1–5, each step of the scale worth a fifth (5 = 100%). */
export const ONE_TO_FIVE: MarkLevel[] = [1, 2, 3, 4, 5].map(n => ({ label: String(n), score: n * (FULL / 5) }));
/** Where a custom set starts. */
export const CUSTOM_STARTER: MarkLevel[] = [{ label: 'Fail', score: 0 }, { label: 'Satisfactory', score: 60 }, { label: 'Excellent', score: 100 }];

/** A rating scale's levels as marks: each named as the scale names it (or by its number), worth value ÷ max (4 of 5 = 80%). */
export function levelsFromRatingScale(scale: { max: number; levels: { value: number; label: string }[] }): MarkLevel[] {
  return Array.from({ length: scale.max }, (_, i) => {
    const value = i + 1;
    const named = scale.levels.find(l => l.value === value)?.label.trim();
    return { label: named || String(value), score: Math.round((value / scale.max) * FULL * 100) / 100 };
  });
}

/** Why these levels can't be used yet — or null. What's typed is never changed for you. */
export function levelsProblem(levels: MarkLevel[]): string | null {
  if (levels.length < MIN_LEVELS) return `Give at least ${MIN_LEVELS} levels.`;
  if (levels.length > MAX_LEVELS) return `Use at most ${MAX_LEVELS} levels.`;
  if (levels.some(l => !l.label.trim())) return 'Give every level a name.';
  if (levels.some(l => l.label.trim().length > MAX_LEVEL_LABEL)) return `Keep level names to ${MAX_LEVEL_LABEL} characters.`;
  if (new Set(levels.map(l => l.label.trim().toLowerCase())).size !== levels.length) return 'Two levels have the same name.';
  if (levels.some(l => !Number.isFinite(l.score) || l.score < 0 || l.score > FULL)) return 'Each level is worth 0 to 100%.';
  return null;
}

/** How a step (point) is saved for this marking. */
export function pointScale(m: StepMarking): { inputType: 'PASS_FAIL' | 'LEVELS'; scaleConfig: Record<string, unknown> | null } {
  return m.inputType === 'PASS_FAIL'
    ? { inputType: 'PASS_FAIL', scaleConfig: null }
    : { inputType: 'LEVELS', scaleConfig: { levels: m.levels.map(l => ({ label: l.label.trim(), score: l.score })), source: m.source } };
}

/** The marking a saved step uses (pass / fail when it isn't on levels). */
export function markingOfPoint(p: { inputType?: string; scaleConfig?: unknown } | undefined): StepMarking {
  if (p?.inputType !== 'LEVELS') return PASS_FAIL;
  const cfg = (p.scaleConfig ?? {}) as { levels?: MarkLevel[]; source?: LevelsSource };
  return { inputType: 'LEVELS', levels: cfg.levels ?? [], source: cfg.source ?? { kind: 'CUSTOM' } };
}

/** "Pass / Fail / N/A", "1–5 / N/A", "Fail · Satisfactory · Excellent / N/A" — for summaries. */
export function markingText(m: StepMarking): string {
  if (m.inputType === 'PASS_FAIL') return 'Pass / Fail / N/A';
  if (m.source.kind === 'ONE_TO_FIVE') return '1–5 / N/A';
  return `${m.levels.map(l => l.label).join(' · ')} / N/A`;
}

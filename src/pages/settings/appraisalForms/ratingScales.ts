import type { RatingScaleInput, RatingScaleTemplate } from '../../../api/appraisal-rating-scales.js';
import type { DraftScale } from './appraisalFormDraft.js';

/** Shown on Delete for a scale or scoring form an appraisal form has used. */
export const IN_USE_REASON = 'Appraisal forms have used it, so it can’t be deleted — make it inactive instead';

// Rating scales (Settings → Rating scales) and how a criterion or point uses
// one: it COPIES the scale's levels, so a form never changes when a scale does.

type Levels = Pick<DraftScale, 'ratingMax' | 'ratingLabels' | 'ratingDescriptions'>;

/** Level counts a scale can have. */
export const SCALE_SIZES = [3, 4, 5, 10] as const;
export const SCALE_NAME_NEEDED = 'Give the scale a name.';
export const LEVEL_NAME_NEEDED = 'Name every level.';

/** "1 Needs improvement · 2 Developing · … · 5 Outstanding" — the whole scale in one line. */
export const scaleSummary = (s: Pick<RatingScaleTemplate, 'levels'>) => s.levels.map(l => `${l.value} ${l.label}`).join(' · ');

/** The scale's levels as a criterion's own copy. */
export function scaleToDraft(s: Pick<RatingScaleTemplate, 'max' | 'levels'>): Levels {
  const at = (i: number) => s.levels.find(l => l.value === i + 1);
  return {
    ratingMax: s.max,
    ratingLabels: Array.from({ length: s.max }, (_, i) => at(i)?.label ?? ''),
    ratingDescriptions: Array.from({ length: s.max }, (_, i) => at(i)?.description ?? ''),
  };
}

const same = (a: Levels, b: Levels) =>
  a.ratingMax === b.ratingMax
  && Array.from({ length: a.ratingMax }).every((_, i) =>
    (a.ratingLabels[i] ?? '').trim() === (b.ratingLabels[i] ?? '').trim()
    && (a.ratingDescriptions[i] ?? '').trim() === (b.ratingDescriptions[i] ?? '').trim());

/** The scale a criterion's levels were copied from (same wording), if any. */
export const matchingScale = (c: Levels, scales: RatingScaleTemplate[]) => scales.find(s => same(c, scaleToDraft(s))) ?? null;

/** No level has a name or description yet — a plain 1…max. */
export const hasNoWording = (c: Levels) => ![...c.ratingLabels, ...c.ratingDescriptions].some(w => (w ?? '').trim());

export const defaultScaleOf = (scales: RatingScaleTemplate[]) => scales.find(s => s.isDefault) ?? scales[0] ?? null;

/** Why a scale can't be deleted — null when it can. Used ones are kept so past appraisals can always say where their levels came from. */
export function scaleDeleteBlocker(s: Pick<RatingScaleTemplate, 'isDefault' | 'inUse'>): string | null {
  if (s.isDefault) return 'The default can’t be deleted — make another one the default first';
  if (s.inUse) return IN_USE_REASON;
  return null;
}

/**
 * A new criterion or point on a rating with no wording yet takes the default
 * scale; anything already worded (or an existing plain one) stays as it is.
 */
export function withDefaultScale<T extends DraftScale>(c: T, scales: RatingScaleTemplate[], isNew: boolean): T {
  const def = defaultScaleOf(scales);
  if (!isNew || c.inputType !== 'RATING' || !hasNoWording(c) || !def) return c;
  return { ...c, ...scaleToDraft(def), scaleId: def.id };
}

/** What a scale being edited in Settings still needs. */
export function scaleIssues(s: RatingScaleInput): { name?: string; levels?: string } {
  return {
    ...(s.name.trim() ? {} : { name: SCALE_NAME_NEEDED }),
    ...(s.levels.length === s.max && s.levels.every(l => l.label.trim()) ? {} : { levels: LEVEL_NAME_NEEDED }),
  };
}

/** Resize a scale being edited, keeping the wording of the levels that remain. */
export function resizeLevels(levels: RatingScaleInput['levels'], max: number): RatingScaleInput['levels'] {
  return Array.from({ length: max }, (_, i) => levels[i] ?? { value: i + 1, label: '', description: '' });
}

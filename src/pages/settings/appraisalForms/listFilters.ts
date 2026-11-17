import type { TemplateStatus } from '../../../api/appraisal-templates.js';

// The filters on the three Appraisals settings lists: appraisal forms (live /
// draft / retired), scoring forms (active / incomplete / inactive) and rating
// scales (active / inactive). "All" shows everything.

export type FormFilter = 'all' | 'live' | 'draft' | 'retired';
/** A filter from the address (?filter=…); Live when there's none — the forms in use. */
export const formFilterFrom = (v: string | null): FormFilter => (v === 'all' || v === 'draft' || v === 'retired' ? v : 'live');
export type ScoringFormFilter = 'all' | 'active' | 'incomplete' | 'inactive';
export type ScaleFilter = 'all' | 'active' | 'inactive';

const FORM_STATUS: Record<TemplateStatus, Exclude<FormFilter, 'all'>> = { ACTIVE: 'live', DRAFT: 'draft', RETIRED: 'retired' };
export const formFilterOf = (f: { status: TemplateStatus }) => FORM_STATUS[f.status];

/** Inactive (switched off) wins; otherwise incomplete while it still has something to fix. */
export function scoringFormFilterOf(f: { isActive: boolean; problems: string[] }): Exclude<ScoringFormFilter, 'all'> {
  if (!f.isActive) return 'inactive';
  return f.problems.length ? 'incomplete' : 'active';
}

export const scaleFilterOf = (s: { isActive: boolean }): Exclude<ScaleFilter, 'all'> => (s.isActive ? 'active' : 'inactive');

/** The items for a filter, and how many each filter would show (for the labels). */
export function applyFilter<T, F extends string>(items: T[], filter: F | 'all', keyOf: (item: T) => F): { shown: T[]; counts: Record<F | 'all', number> } {
  const counts = { all: items.length } as Record<F | 'all', number>;
  for (const item of items) { const k = keyOf(item); counts[k] = (counts[k] ?? 0) + 1; }
  return { shown: filter === 'all' ? items : items.filter(i => keyOf(i) === filter), counts };
}

/** "Classroom care" → "Classroom care (copy)", within a name limit. */
export function copyName(name: string, max: number): string {
  const suffix = ' (copy)';
  return name.length + suffix.length > max ? name.slice(0, max - suffix.length) + suffix : name + suffix;
}

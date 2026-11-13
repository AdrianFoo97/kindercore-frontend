// How-To Guides → sort order for the guide list.

export type SopSort = 'name' | 'updated' | 'newest' | 'steps';

export const SOP_SORTS: { key: SopSort; label: string }[] = [
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'updated', label: 'Recently updated' },
  { key: 'newest', label: 'Newest' },
  { key: 'steps', label: 'Most steps' },
];

export const DEFAULT_SOP_SORT: SopSort = 'name';

/** A sort key from the URL, or the default for anything unknown. */
export function parseSopSort(raw: string | null): SopSort {
  return SOP_SORTS.some(s => s.key === raw) ? (raw as SopSort) : DEFAULT_SOP_SORT;
}

interface GuideLike { id: string; title: string; createdAt: string; updatedAt: string }

/**
 * The guides in the chosen order (a new array). Ties — and "Most steps" while
 * step counts are still loading — fall back to name, so the order is stable.
 */
export function sortGuides<T extends GuideLike>(guides: T[], sort: SopSort, stepCounts: Record<string, number> = {}): T[] {
  const byName = (a: T, b: T) => a.title.localeCompare(b.title);
  const compare: Record<SopSort, (a: T, b: T) => number> = {
    name: byName,
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b),
    steps: (a, b) => (stepCounts[b.id] ?? 0) - (stepCounts[a.id] ?? 0) || byName(a, b),
  };
  return [...guides].sort(compare[sort]);
}

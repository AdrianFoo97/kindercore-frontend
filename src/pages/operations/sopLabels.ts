// How-To Guides → Labels view: each label with how many guides carry it, and
// which guides to show for a chosen label. A guide can have several labels.

/** The "label" value for guides that have no label at all. */
export const NO_LABEL = 'none';

export interface LabelSummary {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface LabelLike { id: string; name: string; color: string }
interface GuideLike { categories?: { id: string }[] | null }

/** Every label in its set order with its guide count, plus how many guides have none. */
export function labelSummaries(labels: LabelLike[], guides: GuideLike[]): { labels: LabelSummary[]; unlabelled: number } {
  const counts = new Map<string, number>();
  let unlabelled = 0;
  for (const g of guides) {
    const ids = new Set((g.categories ?? []).map(c => c.id));
    if (ids.size === 0) unlabelled += 1;
    ids.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
  }
  return { labels: labels.map(l => ({ id: l.id, name: l.name, color: l.color, count: counts.get(l.id) ?? 0 })), unlabelled };
}

export type LabelSort = 'order' | 'name' | 'most' | 'fewest';

export const LABEL_SORTS: { key: LabelSort; label: string }[] = [
  { key: 'order', label: 'Your order' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'most', label: 'Most guides' },
  { key: 'fewest', label: 'Fewest guides' },
];

export const DEFAULT_LABEL_SORT: LabelSort = 'order';

/** A label sort from the URL, or the default for anything unknown. */
export function parseLabelSort(raw: string | null): LabelSort {
  return LABEL_SORTS.some(s => s.key === raw) ? (raw as LabelSort) : DEFAULT_LABEL_SORT;
}

/**
 * The labels matching a name search (case-insensitive, any part of the name),
 * in the chosen order. "Your order" keeps the order set in Settings; count
 * ties fall back to name.
 */
export function findLabels(labels: LabelSummary[], query: string, sort: LabelSort): LabelSummary[] {
  const q = query.trim().toLowerCase();
  const matching = q ? labels.filter(l => l.name.toLowerCase().includes(q)) : [...labels];
  const byName = (a: LabelSummary, b: LabelSummary) => a.name.localeCompare(b.name);
  if (sort === 'name') return matching.sort(byName);
  if (sort === 'most') return matching.sort((a, b) => b.count - a.count || byName(a, b));
  if (sort === 'fewest') return matching.sort((a, b) => a.count - b.count || byName(a, b));
  return matching;
}

/** Does this guide belong under the chosen label ('ALL' = every guide, NO_LABEL = guides without one)? */
export function guideHasLabel(guide: GuideLike, label: string): boolean {
  if (label === 'ALL') return true;
  const cats = guide.categories ?? [];
  if (label === NO_LABEL) return cats.length === 0;
  return cats.some(c => c.id === label);
}

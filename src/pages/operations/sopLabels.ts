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

/** The labels matching a name search (case-insensitive, any part of the name), A–Z by name. */
export function findLabels(labels: LabelSummary[], query: string): LabelSummary[] {
  const q = query.trim().toLowerCase();
  const matching = q ? labels.filter(l => l.name.toLowerCase().includes(q)) : [...labels];
  return matching.sort((a, b) => a.name.localeCompare(b.name));
}
/** Does this guide belong under the chosen label ('ALL' = every guide, NO_LABEL = guides without one)? */
export function guideHasLabel(guide: GuideLike, label: string): boolean {
  if (label === 'ALL') return true;
  const cats = guide.categories ?? [];
  if (label === NO_LABEL) return cats.length === 0;
  return cats.some(c => c.id === label);
}

/** Only the labels these guides actually use (keeping the labels' own order) — so a filter never offers a label with nothing behind it. */
export function labelsInUse<L extends { id: string }>(labels: L[], guides: GuideLike[]): L[] {
  const used = new Set(guides.flatMap(g => (g.categories ?? []).map(c => c.id)));
  return labels.filter(l => used.has(l.id));
}

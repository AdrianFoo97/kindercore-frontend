// "Copy to branch…" — what can be copied and what's ticked. Pure, so it's unit-tested.

export interface CopyItem { id: string; name: string; branchId?: string | null }

/** Names compared the way people read them — the same rule as the server's copy. */
const nameKey = (n: string) => n.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * For copying `items` (this branch's) to branch `to`: which ones the other
 * branch already has (same name — shown "Already there", can't be ticked),
 * which can be copied, which of those are ticked, and whether Copy is allowed.
 */
export function copyChoices(items: CopyItem[], allItems: CopyItem[], to: string, ticked: Set<string>) {
  const there = new Set(allItems.filter(i => i.branchId === to).map(i => nameKey(i.name)));
  const isThere = (i: CopyItem) => there.has(nameKey(i.name));
  const copyable = items.filter(i => !isThere(i));
  const picked = copyable.filter(i => ticked.has(i.id));
  return {
    isThere,
    copyable,
    picked,
    allOn: copyable.length > 0 && picked.length === copyable.length,
    /** Copy is off until at least one is ticked (and a branch is chosen). */
    canCopy: !!to && picked.length > 0,
  };
}

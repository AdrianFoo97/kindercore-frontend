// Whether an operating-cost amount counts toward the operating cost total
// (the Expense Ratio, profit share and bonus pools). An amount counts only if
// its group, its category and the amount itself are all included — switching
// any one off leaves the spend recorded but out of the total. The server's
// finance figures use the same rule (backend services/operatingCost.service.ts).

interface Includable { includeInOperatingCostSum: boolean }
interface CategoryRef extends Includable { id: string; groupId: string }
interface GroupRef extends Includable { id: string }

/** The rule itself. A missing category or group (not loaded yet) doesn't exclude. */
export function countsTowardOperatingCost(entryIncluded: boolean, category?: Includable | null, group?: Includable | null): boolean {
  return entryIncluded && category?.includeInOperatingCostSum !== false && group?.includeInOperatingCostSum !== false;
}

/** Just the entries that count, for totals and ratios. */
export function countedEntries<E extends { categoryId: string; includeInOperatingCostSum: boolean }>(
  entries: E[], categories: CategoryRef[] | undefined, groups: GroupRef[] | undefined,
): E[] {
  const categoryById = new Map((categories ?? []).map(c => [c.id, c]));
  const groupById = new Map((groups ?? []).map(g => [g.id, g]));
  return entries.filter(e => {
    const category = categoryById.get(e.categoryId);
    return countsTowardOperatingCost(e.includeInOperatingCostSum, category, category ? groupById.get(category.groupId) : undefined);
  });
}

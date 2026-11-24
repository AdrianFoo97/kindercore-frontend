import { describe, it, expect } from 'vitest';
import { countedEntries, countsTowardOperatingCost } from '../../utils/operatingCostInclusion.js';

describe('Operating cost — what counts toward the total', () => {
  it('counts an amount only when its group, category and the amount itself are all included', () => {
    expect(countsTowardOperatingCost(true, { includeInOperatingCostSum: true }, { includeInOperatingCostSum: true })).toBe(true);
    expect(countsTowardOperatingCost(false, { includeInOperatingCostSum: true }, { includeInOperatingCostSum: true })).toBe(false);
    expect(countsTowardOperatingCost(true, { includeInOperatingCostSum: false }, { includeInOperatingCostSum: true })).toBe(false);
    expect(countsTowardOperatingCost(true, { includeInOperatingCostSum: true }, { includeInOperatingCostSum: false })).toBe(false);
  });

  it('leaves out every amount under an excluded group or category, and an amount excluded on its own', () => {
    const groups = [{ id: 'g-run', includeInOperatingCostSum: true }, { id: 'g-hr', includeInOperatingCostSum: false }];
    const categories = [
      { id: 'c-rent', groupId: 'g-run', includeInOperatingCostSum: true },
      { id: 'c-gift', groupId: 'g-run', includeInOperatingCostSum: false },
      { id: 'c-bonus', groupId: 'g-hr', includeInOperatingCostSum: true },
    ];
    const entries = [
      { categoryId: 'c-rent', amount: 4200, includeInOperatingCostSum: true },
      { categoryId: 'c-rent', amount: 900, includeInOperatingCostSum: false }, // a one-off, excluded on its own
      { categoryId: 'c-gift', amount: 150, includeInOperatingCostSum: true },
      { categoryId: 'c-bonus', amount: 2000, includeInOperatingCostSum: true },
    ];
    expect(countedEntries(entries, categories, groups).map(e => e.amount)).toEqual([4200]);
  });
});

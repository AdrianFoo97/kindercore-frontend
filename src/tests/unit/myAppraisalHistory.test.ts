import { describe, it, expect } from 'vitest';
import { groupByQuarter, withinLastMonths } from '../../pages/myAppraisalHistory';

// Teacher app → My Appraisal: history grouped by quarter.

describe('My Appraisal history', () => {
  it('groups months by quarter, newest first, each with its average from the server', () => {
    const items = [
      { id: 'a', year: 2026, month: 9 }, { id: 'b', year: 2026, month: 1 }, { id: 'c', year: 2026, month: 10 }, { id: 'd', year: 2025, month: 11 },
    ];
    const groups = groupByQuarter(items, [{ year: 2026, quarter: 4, average: 75 }, { year: 2026, quarter: 1, average: 61 }]);
    expect(groups.map(g => [g.year, g.quarter, g.average, g.items.map(i => i.id)])).toEqual([
      [2026, 4, 75, ['c', 'a']], [2026, 1, 61, ['b']], [2025, 4, null, ['d']],
    ]);
  });

  it('shows the last 12 months at first, and more as you scroll', () => {
    const items = [{ year: 2026, month: 10 }, { year: 2025, month: 11 }, { year: 2025, month: 10 }, { year: 2024, month: 5 }];
    const now = { year: 2026, month: 10 };
    // Nov 2026 back to Dec 2025 is the last 12 months; Nov 2025 is the 13th.
    expect(withinLastMonths(items, now, 12)).toEqual([{ year: 2026, month: 10 }, { year: 2025, month: 11 }]);
    expect(withinLastMonths(items, now, 24)).toHaveLength(3);
  });
});

import { describe, it, expect } from 'vitest';
import {
  byMonthTotals,
  byCategoryMonths,
  monthsWithData,
  elapsedMonths,
  categoryRows,
  groupRollup,
  outliers,
  ratios,
} from '../../pages/analysis/operating-cost/model.js';
import type { OperatingCostCategory, OperatingCostEntry } from '../../api/operatingCost.js';
import type { FinanceMonth } from '../../api/finance.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

let seq = 0;
function entry(categoryId: string, month: number, amount: number): OperatingCostEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    year: 2026,
    month,
    categoryId,
    amount,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function category(
  id: string,
  name: string,
  groupId: string,
  groupName: string,
  monthlyBudget: number | null = null,
): OperatingCostCategory {
  return {
    id,
    name,
    groupId,
    groupName,
    groupSortOrder: groupId === 'g-admin' ? 10 : 20,
    sortOrder: 10,
    defaultAmount: null,
    monthlyBudget,
    entryCount: 0,
    entryTotal: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const RENT = category('c-rent', 'Rental', 'g-admin', 'Administrative', 4200);
const PETROL = category('c-petrol', 'Petrol', 'g-admin', 'Administrative', 550);
const EVENTS = category('c-events', 'Event Fee', 'g-sales', 'Sales & Distribution', null);
const CATEGORIES = [RENT, PETROL, EVENTS];

/** Jan–Mar recorded. Rent flat, petrol wobbling, events only in Feb. */
const ENTRIES: OperatingCostEntry[] = [
  entry('c-rent', 0, 4200), entry('c-rent', 1, 4200), entry('c-rent', 2, 4200),
  entry('c-petrol', 0, 500), entry('c-petrol', 1, 600), entry('c-petrol', 2, 400),
  entry('c-events', 1, 800),
];

const JUNE_2026 = new Date('2026-06-15T00:00:00Z');

describe('byMonthTotals / byCategoryMonths', () => {
  it('sums each month and leaves unrecorded months at zero', () => {
    const totals = byMonthTotals(ENTRIES);
    expect(totals).toHaveLength(12);
    expect(totals[0]).toBe(4700);   // 4200 + 500
    expect(totals[1]).toBe(5600);   // 4200 + 600 + 800
    expect(totals[2]).toBe(4600);   // 4200 + 400
    expect(totals[3]).toBe(0);      // nothing recorded
  });

  it('buckets by category into dense 12-slot arrays', () => {
    const byCat = byCategoryMonths(ENTRIES);
    expect(byCat.get('c-rent')).toEqual([4200, 4200, 4200, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(byCat.get('c-events')?.[1]).toBe(800);
  });

  it('ignores rows with an out-of-range month rather than corrupting the array', () => {
    const totals = byMonthTotals([...ENTRIES, entry('c-rent', 12, 9999), entry('c-rent', -1, 9999)]);
    expect(totals).toHaveLength(12);
    expect(totals.reduce((s, v) => s + v, 0)).toBe(14900); // the 9999s are excluded
  });
});

describe('elapsedMonths', () => {
  it('counts only months that are both recorded and not in the future', () => {
    expect(elapsedMonths(ENTRIES, 2026, JUNE_2026)).toEqual([0, 1, 2]);
  });

  it('excludes future months even when someone has pre-recorded them', () => {
    const withFuture = [...ENTRIES, entry('c-rent', 9, 4200)]; // Oct, ahead of "today"
    expect(elapsedMonths(withFuture, 2026, JUNE_2026)).toEqual([0, 1, 2]);
  });

  it('treats a past year as fully elapsed', () => {
    expect(elapsedMonths(ENTRIES, 2025, JUNE_2026)).toEqual([0, 1, 2]);
  });

  it('treats a future year as having nothing elapsed', () => {
    expect(elapsedMonths(ENTRIES, 2027, JUNE_2026)).toEqual([]);
  });

  it('skips gaps — an unfilled month in the middle is not elapsed', () => {
    const gappy = [entry('c-rent', 0, 100), entry('c-rent', 2, 100)];
    expect(elapsedMonths(gappy, 2026, JUNE_2026)).toEqual([0, 2]);
    expect(monthsWithData(gappy).has(1)).toBe(false);
  });
});

describe('categoryRows', () => {
  const elapsed = [0, 1, 2];
  const rows = categoryRows(ENTRIES, [], CATEGORIES, elapsed);
  const rent = rows.find(r => r.id === 'c-rent')!;
  const petrol = rows.find(r => r.id === 'c-petrol')!;
  const events = rows.find(r => r.id === 'c-events')!;

  it('sums spend over the scoped months only', () => {
    expect(rent.ytd).toBe(12600);   // 3 × 4200
    expect(petrol.ytd).toBe(1500);  // 500 + 600 + 400
  });

  it('scales the budget by the number of scoped months', () => {
    expect(rent.ytdBudget).toBe(12600);  // 4200 × 3
    expect(petrol.ytdBudget).toBe(1650); // 550 × 3
  });

  it('reports a category exactly on budget as zero variance, not a rounding artefact', () => {
    expect(rent.variance).toBe(0);
    expect(rent.variancePct).toBe(0);
  });

  it('reports under-budget as a negative variance', () => {
    expect(petrol.variance).toBe(-150);
    expect(petrol.variancePct).toBeCloseTo(-150 / 1650, 10);
  });

  it('keeps "no budget set" as null — never as a budget of zero', () => {
    expect(events.monthlyBudget).toBeNull();
    expect(events.ytdBudget).toBeNull();
    expect(events.variance).toBeNull();
    expect(events.variancePct).toBeNull();
  });

  it('scopes to a single month when the scope is a single month', () => {
    const [feb] = [1];
    const scoped = categoryRows(ENTRIES, [], CATEGORIES, [feb]);
    const r = scoped.find(x => x.id === 'c-rent')!;
    expect(r.ytd).toBe(4200);
    expect(r.ytdBudget).toBe(4200); // one month's budget, not three
    expect(r.variance).toBe(0);
  });

  it('compares year on year over the same months, and reports null when last year is empty', () => {
    const prev = [entry('c-petrol', 0, 250), entry('c-petrol', 1, 250), entry('c-petrol', 2, 250)];
    const withPrev = categoryRows(ENTRIES, prev, CATEGORIES, elapsed);
    const p = withPrev.find(r => r.id === 'c-petrol')!;
    expect(p.prevYtd).toBe(750);
    expect(p.yoyDelta).toBe(750);
    expect(p.yoyPct).toBeCloseTo(1, 10); // doubled

    const r = withPrev.find(x => x.id === 'c-rent')!;
    expect(r.prevYtd).toBe(0);
    expect(r.yoyPct).toBeNull(); // a delta measured off zero is meaningless
  });
});

describe('groupRollup', () => {
  const rows = categoryRows(ENTRIES, [], CATEGORIES, [0, 1, 2]);
  const groups = groupRollup(rows);
  const admin = groups.find(g => g.id === 'g-admin')!;
  const sales = groups.find(g => g.id === 'g-sales')!;

  it('sums spend across every category in the group', () => {
    expect(admin.ytd).toBe(14100); // 12600 rent + 1500 petrol
    expect(sales.ytd).toBe(800);
  });

  it('builds the budget only from categories that have one', () => {
    expect(admin.ytdBudget).toBe(14250); // 12600 + 1650
    expect(sales.ytdBudget).toBeNull();  // Event Fee has no budget → not a zero budget
    expect(sales.variance).toBeNull();
  });

  it('measures variance against budgeted spend only, so an unbudgeted category cannot make a group look over', () => {
    // Admin: rent on budget (0) + petrol under (−150) = −150.
    expect(admin.variance).toBe(-150);
    // Sales spent RM 800 with no budget anywhere — that is not RM 800 over.
    expect(sales.variance).toBeNull();
  });

  it('carries the full 12-month series and last year through to the group', () => {
    expect(admin.months[0]).toBe(4700);
    expect(admin.months[3]).toBe(0);
    expect(admin.prevMonths).toHaveLength(12);
  });
});

describe('outliers', () => {
  const elapsed = [0, 1, 2, 3];

  it('flags a month that departs from the category\'s own typical spend', () => {
    const cats = [category('c-x', 'Upkeep', 'g-admin', 'Administrative')];
    const spike = [
      entry('c-x', 0, 500), entry('c-x', 1, 500), entry('c-x', 2, 3000), entry('c-x', 3, 500),
    ];
    const rows = categoryRows(spike, [], cats, elapsed);
    const found = outliers(rows, elapsed);
    expect(found).toHaveLength(1);
    expect(found[0].month).toBe(2);
    expect(found[0].amount).toBe(3000);
    expect(found[0].baseline).toBe(500);  // median of the OTHER months
    expect(found[0].deltaPct).toBeCloseTo(5, 10);
  });

  it('stays quiet on a steady category', () => {
    const cats = [category('c-x', 'Rent', 'g-admin', 'Administrative')];
    const flat = [entry('c-x', 0, 4200), entry('c-x', 1, 4200), entry('c-x', 2, 4200), entry('c-x', 3, 4200)];
    expect(outliers(categoryRows(flat, [], cats, elapsed), elapsed)).toEqual([]);
  });

  it('ignores small-money wobble even when the percentage is large', () => {
    // 20 → 100 is +400%, but RM 80 is noise, not a finding.
    const cats = [category('c-x', 'Parking', 'g-admin', 'Administrative')];
    const petty = [entry('c-x', 0, 20), entry('c-x', 1, 20), entry('c-x', 2, 100), entry('c-x', 3, 20)];
    expect(outliers(categoryRows(petty, [], cats, elapsed), elapsed)).toEqual([]);
  });

  it('needs at least three recorded months before forming an opinion', () => {
    const cats = [category('c-x', 'New thing', 'g-admin', 'Administrative')];
    const thin = [entry('c-x', 0, 100), entry('c-x', 1, 5000)];
    expect(outliers(categoryRows(thin, [], cats, [0, 1]), [0, 1])).toEqual([]);
  });
});

describe('ratios', () => {
  const financeMonths = [
    { month: 'Jan', revenue: 20000, studentCount: 50 },
    { month: 'Feb', revenue: 0, studentCount: 0 },
  ] as FinanceMonth[];

  it('divides cost by revenue and by headcount', () => {
    const r = ratios(byMonthTotals(ENTRIES), financeMonths);
    expect(r[0].pctOfRevenue).toBeCloseTo(4700 / 20000, 10);
    expect(r[0].costPerStudent).toBeCloseTo(4700 / 50, 10);
  });

  it('returns null rather than dividing by zero', () => {
    const r = ratios(byMonthTotals(ENTRIES), financeMonths);
    expect(r[1].pctOfRevenue).toBeNull();
    expect(r[1].costPerStudent).toBeNull();
  });

  it('survives a missing finance summary', () => {
    const r = ratios(byMonthTotals(ENTRIES), undefined);
    expect(r[0].pctOfRevenue).toBeNull();
    expect(r[0].costPerStudent).toBeNull();
  });
});

import type { OperatingCostCategory, OperatingCostEntry } from '../../../api/operatingCost.js';
import type { FinanceMonth } from '../../../api/finance.js';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** A month is an outlier when it deviates from the category's own median by at
 *  least both thresholds — the percentage keeps small categories from screaming,
 *  the ringgit floor keeps large ones from drowning us in noise. */
export const OUTLIER_PCT = 0.4;
export const OUTLIER_MIN_RM = 200;

export type MonthAmounts = number[]; // always length 12, 0 = not recorded

export interface CategoryRow {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  groupSortOrder: number;
  sortOrder: number;
  /** null = no budget set; must not be counted as a zero budget. */
  monthlyBudget: number | null;
  months: MonthAmounts;
  prevMonths: MonthAmounts;
  /** Recorded spend across elapsed months only. */
  ytd: number;
  /** monthlyBudget × elapsed months, or null when no budget is set. */
  ytdBudget: number | null;
  /** ytd − ytdBudget. Positive = over budget. null when no budget. */
  variance: number | null;
  /** variance / ytdBudget. null when no budget or budget is zero. */
  variancePct: number | null;
  /** Same elapsed window, prior year. */
  prevYtd: number;
  yoyDelta: number;
  /** null when the prior year recorded nothing (a delta off zero is meaningless). */
  yoyPct: number | null;
}

export interface GroupRow {
  id: string;
  name: string;
  sortOrder: number;
  categories: CategoryRow[];
  months: MonthAmounts;
  prevMonths: MonthAmounts;
  /** Sum of the budgets of the categories that have one; null when none do. */
  monthlyBudget: number | null;
  ytd: number;
  ytdBudget: number | null;
  variance: number | null;
  variancePct: number | null;
  prevYtd: number;
  yoyDelta: number;
  yoyPct: number | null;
}

export interface Outlier {
  categoryId: string;
  categoryName: string;
  groupName: string;
  month: number;
  amount: number;
  baseline: number;
  delta: number;
  deltaPct: number;
}

export interface MonthRatio {
  month: number;
  operatingCost: number;
  revenue: number;
  studentCount: number;
  /** null when there's no revenue to divide by. */
  pctOfRevenue: number | null;
  /** null when there are no students to divide by. */
  costPerStudent: number | null;
}

const emptyMonths = (): MonthAmounts => Array(12).fill(0);

/** Sparse entry rows → dense 12-slot arrays keyed by category. */
export function byCategoryMonths(entries: OperatingCostEntry[]): Map<string, MonthAmounts> {
  const map = new Map<string, MonthAmounts>();
  for (const e of entries) {
    if (e.month < 0 || e.month > 11) continue;
    let arr = map.get(e.categoryId);
    if (!arr) {
      arr = emptyMonths();
      map.set(e.categoryId, arr);
    }
    arr[e.month] += e.amount;
  }
  return map;
}

export function byMonthTotals(entries: OperatingCostEntry[]): MonthAmounts {
  const totals = emptyMonths();
  for (const e of entries) {
    if (e.month < 0 || e.month > 11) continue;
    totals[e.month] += e.amount;
  }
  return totals;
}

/** Months that have at least one recorded entry. Drives the projected treatment
 *  and, with it, which months count as "elapsed" for YTD comparisons. */
export function monthsWithData(entries: OperatingCostEntry[]): Set<number> {
  const s = new Set<number>();
  for (const e of entries) if (e.month >= 0 && e.month <= 11) s.add(e.month);
  return s;
}

/**
 * Months to treat as real for YTD figures: recorded, and not in the future.
 * A month nobody has keyed in yet is neither actual nor budgeted-against —
 * counting it would drag YTD spend down and YTD budget up at the same time.
 */
export function elapsedMonths(entries: OperatingCostEntry[], year: number, today: Date): number[] {
  const currentYear = today.getFullYear();
  const lastIdx = year < currentYear ? 11 : year > currentYear ? -1 : today.getMonth();
  const recorded = monthsWithData(entries);
  const out: number[] = [];
  for (let i = 0; i <= lastIdx; i++) if (recorded.has(i)) out.push(i);
  return out;
}

const sumAt = (months: MonthAmounts, idxs: number[]) => idxs.reduce((s, i) => s + months[i], 0);

export function categoryRows(
  entries: OperatingCostEntry[],
  prevEntries: OperatingCostEntry[],
  categories: OperatingCostCategory[],
  elapsed: number[],
): CategoryRow[] {
  const cur = byCategoryMonths(entries);
  const prev = byCategoryMonths(prevEntries);

  return categories.map(c => {
    const months = cur.get(c.id) ?? emptyMonths();
    const prevMonths = prev.get(c.id) ?? emptyMonths();

    const ytd = sumAt(months, elapsed);
    const prevYtd = sumAt(prevMonths, elapsed);

    const budget = c.monthlyBudget;
    const ytdBudget = budget != null ? budget * elapsed.length : null;
    const variance = ytdBudget != null ? ytd - ytdBudget : null;
    const variancePct = ytdBudget != null && ytdBudget > 0 ? (ytd - ytdBudget) / ytdBudget : null;

    return {
      id: c.id,
      name: c.name,
      groupId: c.groupId,
      groupName: c.groupName,
      groupSortOrder: c.groupSortOrder,
      sortOrder: c.sortOrder,
      monthlyBudget: budget,
      months,
      prevMonths,
      ytd,
      ytdBudget,
      variance,
      variancePct,
      prevYtd,
      yoyDelta: ytd - prevYtd,
      yoyPct: prevYtd > 0 ? (ytd - prevYtd) / prevYtd : null,
    };
  });
}

/** Roll categories up to their main category. Categories with no budget are
 *  excluded from the group's budget total rather than counted as zero — so a
 *  group is only "over budget" on the strength of categories that have one. */
export function groupRollup(rows: CategoryRow[]): GroupRow[] {
  const groups = new Map<string, GroupRow>();

  for (const r of rows) {
    let g = groups.get(r.groupId);
    if (!g) {
      g = {
        id: r.groupId,
        name: r.groupName,
        sortOrder: r.groupSortOrder,
        categories: [],
        months: emptyMonths(),
        prevMonths: emptyMonths(),
        monthlyBudget: null,
        ytd: 0,
        ytdBudget: null,
        variance: null,
        variancePct: null,
        prevYtd: 0,
        yoyDelta: 0,
        yoyPct: null,
      };
      groups.set(r.groupId, g);
    }
    g.categories.push(r);
    for (let i = 0; i < 12; i++) {
      g.months[i] += r.months[i];
      g.prevMonths[i] += r.prevMonths[i];
    }
    g.ytd += r.ytd;
    g.prevYtd += r.prevYtd;
    if (r.ytdBudget != null) g.ytdBudget = (g.ytdBudget ?? 0) + r.ytdBudget;
    if (r.monthlyBudget != null) g.monthlyBudget = (g.monthlyBudget ?? 0) + r.monthlyBudget;
  }

  for (const g of groups.values()) {
    g.yoyDelta = g.ytd - g.prevYtd;
    g.yoyPct = g.prevYtd > 0 ? g.yoyDelta / g.prevYtd : null;
    if (g.ytdBudget != null) {
      // Variance compares only budgeted categories' spend against the budget;
      // g.ytd stays the full spend across every category in the group.
      const budgetedYtd = g.categories.reduce((s, c) => s + (c.ytdBudget != null ? c.ytd : 0), 0);
      g.variance = budgetedYtd - g.ytdBudget;
      g.variancePct = g.ytdBudget > 0 ? g.variance / g.ytdBudget : null;
    }
    g.categories.sort((a, b) => b.ytd - a.ytd);
  }

  return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * A month stands out when it departs from the category's *own* typical spend —
 * a median over its other recorded months, so one spike doesn't define the
 * baseline it's measured against. Needs ≥3 recorded months to have an opinion.
 */
export function outliers(rows: CategoryRow[], elapsed: number[]): Outlier[] {
  const found: Outlier[] = [];

  for (const r of rows) {
    const recorded = elapsed.filter(i => r.months[i] > 0);
    if (recorded.length < 3) continue;

    for (const m of recorded) {
      const others = recorded.filter(i => i !== m).map(i => r.months[i]);
      const baseline = median(others);
      if (baseline <= 0) continue;

      const amount = r.months[m];
      const delta = amount - baseline;
      if (Math.abs(delta) < OUTLIER_MIN_RM) continue;

      const deltaPct = delta / baseline;
      if (Math.abs(deltaPct) < OUTLIER_PCT) continue;

      found.push({
        categoryId: r.id,
        categoryName: r.name,
        groupName: r.groupName,
        month: m,
        amount,
        baseline,
        delta,
        deltaPct,
      });
    }
  }

  return found.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Operating cost against the revenue and headcount it supported. */
export function ratios(totals: MonthAmounts, financeMonths: FinanceMonth[] | undefined): MonthRatio[] {
  return totals.map((operatingCost, month) => {
    const f = financeMonths?.[month];
    const revenue = f?.revenue ?? 0;
    const studentCount = f?.studentCount ?? 0;
    return {
      month,
      operatingCost,
      revenue,
      studentCount,
      pctOfRevenue: revenue > 0 ? operatingCost / revenue : null,
      costPerStudent: studentCount > 0 ? operatingCost / studentCount : null,
    };
  });
}

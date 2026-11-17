// Teacher app → My Appraisal: the history grouped by quarter (newest first),
// each with its average from the server (the one rule, appraisal.service).

export interface QuarterAverage { year: number; quarter: number; average: number | null }

/** The months of each quarter, newest quarter first and newest month first within it, with the quarter's average. */
export function groupByQuarter<T extends { year: number; month: number }>(items: T[], quarters: QuarterAverage[]): { year: number; quarter: number; average: number | null; items: T[] }[] {
  const quarterOf = (m: number) => Math.floor(m / 3) + 1;
  const groups = new Map<string, { year: number; quarter: number; items: T[] }>();
  for (const it of [...items].sort((a, b) => b.year - a.year || b.month - a.month)) {
    const key = `${it.year}:${quarterOf(it.month)}`;
    const g = groups.get(key) ?? { year: it.year, quarter: quarterOf(it.month), items: [] };
    g.items.push(it);
    groups.set(key, g);
  }
  return [...groups.values()].map(g => ({ ...g, average: quarters.find(q => q.year === g.year && q.quarter === g.quarter)?.average ?? null }));
}

/** How many months the history shows at first, and how many more each time the bottom is reached. */
export const HISTORY_PAGE_MONTHS = 12;

/** The months within the last \`months\` months up to \`now\` (inclusive) — the history shown so far. */
export function withinLastMonths<T extends { year: number; month: number }>(items: T[], now: { year: number; month: number }, months: number): T[] {
  const nowIndex = now.year * 12 + now.month;
  return items.filter(it => nowIndex - (it.year * 12 + it.month) < months);
}

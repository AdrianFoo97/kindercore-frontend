// How appraisals are shown — shared by the staff record's Appraisals tab and HR → Appraisals.

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const GOOD_SCORE = 80;
const OK_SCORE = 60;
/** How far back the HR → Appraisals year dropdown goes. */
const YEARS_BACK = 5;

/** Score banding: 80+ green, 60–79 amber, under 60 red — same everywhere a score is shown. */
export function scoreColors(score: number): { bg: string; color: string } {
  if (score >= GOOD_SCORE) return { bg: '#dcfce7', color: '#15803d' };
  if (score >= OK_SCORE) return { bg: '#fef3c7', color: '#b45309' };
  return { bg: '#fee2e2', color: '#991b1b' };
}

/** Position filter value: '' = everyone; NO_POSITION = staff without a position. */
export const ALL_POSITIONS = '';
export const NO_POSITION = '__none';

/** Position filter options for the staff on screen — A–Z, with "No position" last when anyone has none. */
export function positionOptions(rows: { positionName: string | null }[]): { value: string; label: string }[] {
  const names = [...new Set(rows.map(r => r.positionName).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b));
  const options = names.map(n => ({ value: n, label: n }));
  if (rows.some(r => !r.positionName)) options.push({ value: NO_POSITION, label: 'No position' });
  return options;
}

/** Staff matching the chosen position filter. */
export function matchesPosition(row: { positionName: string | null }, filter: string): boolean {
  if (filter === ALL_POSITIONS) return true;
  if (filter === NO_POSITION) return !row.positionName;
  return row.positionName === filter;
}

/** Name search: case-insensitive, every typed word must appear somewhere in the name ("aisy rah" finds "Aisyah Rahman"). Blank matches everyone. */
export function matchesName(row: { name: string }, query: string): boolean {
  const name = row.name.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(word => name.includes(word));
}

/** Year dropdown: this year first, back YEARS_BACK years. */
export function appraisalYearOptions(now: { year: number }): number[] {
  return Array.from({ length: YEARS_BACK + 1 }, (_, i) => now.year - i);
}

/** Month dropdown for a year (0–11): the whole year in the past, only up to this month in the current year. */
export function selectableMonths(year: number, now: { year: number; month: number }): number[] {
  const last = year < now.year ? 11 : year === now.year ? now.month : -1;
  return Array.from({ length: last + 1 }, (_, m) => m);
}

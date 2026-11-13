// Small display rules for Admin → Access Log (pure, unit-tested).

export const PERIODS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
] as const;
export const DEFAULT_PERIOD_DAYS = 30;

const MALAYSIA = 'Asia/Kuala_Lumpur';

/** "11 Nov, 10:42" in Malaysian time — the year only when it isn't this year. */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameYear = new Intl.DateTimeFormat('en-MY', { timeZone: MALAYSIA, year: 'numeric' }).format(d)
    === new Intl.DateTimeFormat('en-MY', { timeZone: MALAYSIA, year: 'numeric' }).format(now);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: MALAYSIA, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: MALAYSIA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${date}, ${time}`;
}

/** "GET /api/salary/teachers" → "/salary/teachers" — the page's address, without the method and API prefix. */
export function actionLabel(action: string): string {
  return action.replace(/^[A-Z]+\s+/, '').replace(/^\/api/, '');
}

/** "1–50 of 230" for the pager. */
export function rangeLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return '0 entries';
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return `${from}–${to} of ${total}`;
}

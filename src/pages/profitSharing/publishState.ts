import type { PublicationMonth } from '../../api/profitSharePublish.js';

// Profit sharing — what each month shows, on the Analysis page (Finance) and
// on staff's Pay → Pools. Pure, so it's unit-tested.

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Analysis → Profit Sharing: a month's state, and what the person may do with it. */
export type PublishRowState = 'published' | 'ready' | 'not-finished';

export function publishRowState(m: PublicationMonth): PublishRowState {
  if (m.published) return 'published';
  return m.finished ? 'ready' : 'not-finished';
}

const sen = (n: number) => Math.round(n * 100);

/** The figures moved after it was published (e.g. costs corrected) — either pool, compared to the sen. Worth a second look. */
export function changedSincePublished(m: PublicationMonth): boolean {
  return !!m.published && (sen(m.published.poolAmount) !== sen(m.livePool) || sen(m.published.annualBonusAmount) !== sen(m.liveBonus));
}

/** Staff's Pay → Pools: a month is shown only once published; until then it's waiting (if it has ended) or upcoming. */
export type StaffMonthState = 'hit' | 'missed' | 'not-published' | 'upcoming';

export function staffMonthState(m: { monthIdx: number; hit: boolean; published?: boolean }, year: number, today: Date): StaffMonthState {
  if (m.published) return m.hit ? 'hit' : 'missed';
  const ended = year < today.getFullYear() || (year === today.getFullYear() && m.monthIdx < today.getMonth());
  return ended ? 'not-published' : 'upcoming';
}

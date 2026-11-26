import { describe, it, expect } from 'vitest';
import { changedSincePublished, publishRowState, staffMonthState } from '../../pages/profitSharing/publishState';

// Profit sharing — what each month shows: to Finance (publish or not) and to staff (only once published).

const month = (over: Partial<Parameters<typeof publishRowState>[0]> = {}) =>
  ({ monthIdx: 0, finished: true, livePool: 1000, liveBonus: 500, liveHit: true, published: null, ...over });
const published = { poolAmount: 1000, annualBonusAmount: 500, hit: true, publishedAt: '2026-02-02T00:00:00Z', byName: 'Fiona' };

describe('Profit sharing — publish states', () => {
  it('lets Finance publish a finished month, shows a published one, and waits on one that hasn’t finished', () => {
    expect(publishRowState(month())).toBe('ready');
    expect(publishRowState(month({ published }))).toBe('published');
    expect(publishRowState(month({ finished: false }))).toBe('not-finished');
  });

  it('flags a published month whose figures have moved since — either pool, to the sen', () => {
    expect(changedSincePublished(month({ published }))).toBe(false);
    expect(changedSincePublished(month({ published, livePool: 1000.004 }))).toBe(false);
    expect(changedSincePublished(month({ published, livePool: 950 }))).toBe(true);
    expect(changedSincePublished(month({ published, liveBonus: 480 }))).toBe(true);
  });

  it('shows staff a month’s result only once published — before that, “not published yet” if it has ended, else upcoming', () => {
    const today = new Date(2026, 4, 15); // 15 May 2026
    expect(staffMonthState({ monthIdx: 1, hit: true, published: true }, 2026, today)).toBe('hit');
    expect(staffMonthState({ monthIdx: 1, hit: false, published: true }, 2026, today)).toBe('missed');
    expect(staffMonthState({ monthIdx: 1, hit: false, published: false }, 2026, today)).toBe('not-published');
    expect(staffMonthState({ monthIdx: 4, hit: false, published: false }, 2026, today)).toBe('upcoming');
    expect(staffMonthState({ monthIdx: 11, hit: false, published: false }, 2025, today)).toBe('not-published');
  });
});

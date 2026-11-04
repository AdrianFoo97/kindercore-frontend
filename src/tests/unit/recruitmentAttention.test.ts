import { describe, it, expect } from 'vitest';
import { recruitmentAttention } from '../../pages/candidates/attention';

// The "needs attention" chips at the top of Recruitment.

const NOW = new Date(2026, 10, 4, 10, 0); // 4 Nov 2026, 10am local
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
const empty = { interviews: [], newApplicants: [], deciding: [], offersSent: [] };

describe('Recruitment — needs attention', () => {
  it('counts only interviews happening today', () => {
    const r = recruitmentAttention({
      ...empty,
      interviews: [
        { interviewStart: new Date(2026, 10, 4, 15, 0).toISOString() }, // later today
        { interviewStart: new Date(2026, 10, 5, 9, 0).toISOString() },  // tomorrow
      ],
    }, NOW);
    expect(r.interviewsToday).toBe(1);
  });

  it('flags new applicants nobody has contacted for 3 days or more', () => {
    const r = recruitmentAttention({
      ...empty,
      newApplicants: [{ submittedAt: daysAgo(1) }, { submittedAt: daysAgo(3) }, { submittedAt: daysAgo(10) }],
    }, NOW);
    expect(r.newWaiting).toBe(2);
  });

  it('flags offers with no reply after 7 days, out of all offers sent', () => {
    const r = recruitmentAttention({
      ...empty,
      offersSent: [{ statusChangedAt: daysAgo(2) }, { statusChangedAt: daysAgo(8) }, { statusChangedAt: null }],
    }, NOW);
    expect([r.offerSent, r.offerStale]).toEqual([3, 1]);
  });
});

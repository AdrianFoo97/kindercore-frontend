import { describe, it, expect } from 'vitest';
import {
  carriedTag, emptyPurchaseDraft, fmtMoment, fmtRM, laterOutcome, purchaseDraftProblem, purchaseDraftToInput, shiftWeek,
  timelineWithCarryOvers, weekLabel, weekStartOf, weeksCarried,
} from '../../pages/purchases/purchaseDisplay';

// Operation → Shopping List and the teacher app's Requests page: the week
// picker, money, and the request form's checks. 2026-11-09 is a Monday.

describe('Shopping list — week picker, money and the request form', () => {
  it('starts each week on Monday, on Malaysian time, like the server', () => {
    expect(weekStartOf(new Date('2026-11-11T04:00:00Z'))).toBe('2026-11-09');
    expect(weekStartOf(new Date('2026-11-15T15:59:00Z'))).toBe('2026-11-09'); // Sun 11:59pm
    expect(weekStartOf(new Date('2026-11-15T16:00:00Z'))).toBe('2026-11-16'); // Mon midnight
  });

  it('steps a week back and forward, and labels it Monday to Sunday', () => {
    expect(shiftWeek('2026-11-09', -1)).toBe('2026-11-02');
    expect(shiftWeek('2026-11-09', 1)).toBe('2026-11-16');
    expect(weekLabel('2026-11-09')).toBe('9 – 15 Nov 2026');
    expect(weekLabel('2026-10-26')).toBe('26 Oct – 1 Nov 2026');
    expect(weekLabel('2026-12-28')).toBe('28 Dec 2026 – 3 Jan 2027');
  });

  it('tags an item carried over from earlier weeks with how many weeks — amber for one, red from two', () => {
    expect(carriedTag('2026-11-10T02:00:00Z', '2026-11-09')).toEqual({ level: 'none', label: '' }); // asked this week
    expect(carriedTag('2026-11-04T02:00:00Z', '2026-11-09')).toEqual({ level: 'warn', label: 'Carried over · 1 week' });
    expect(carriedTag('2026-10-27T02:00:00Z', '2026-11-09')).toEqual({ level: 'overdue', label: 'Carried over · 2 weeks' });
    // Asked 11pm Sunday Malaysia time (15:00 UTC) still counts as the week before.
    expect(weeksCarried('2026-11-08T15:00:00Z', '2026-11-09')).toBe(1);
  });

  it('records each carry-over in the timeline, between the real steps', () => {
    const step = (kind: 'REQUESTED' | 'EDITED' | 'APPROVED' | 'BOUGHT', createdAt: string) =>
      ({ id: kind, kind, detail: null, authorName: 'Someone', createdAt });
    const history = [
      step('REQUESTED', '2026-11-03T02:00:00Z'), // Tue, week of 2 Nov
      step('EDITED', '2026-11-04T02:00:00Z'),
      step('APPROVED', '2026-11-12T02:00:00Z'), // Thu, week of 9 Nov
      step('BOUGHT', '2026-11-18T02:00:00Z'), // Wed, week of 16 Nov
    ];
    const timeline = timelineWithCarryOvers(history, new Date('2026-11-25T00:00:00Z'));
    expect(timeline.map(t => t.kind)).toEqual(['REQUESTED', 'EDITED', 'CARRIED_OVER', 'APPROVED', 'CARRIED_OVER', 'BOUGHT']);
    expect(timeline[2].detail).toBe('Not bought by the end of the week — carried over to 9 – 15 Nov 2026');
    expect(timeline[2].authorName).toBeNull();
    // Bought on the 18th — so no carry-over into the week of 23 Nov.
  });

  it('shows exact times on the Malaysian clock, and how a carried-over item turned out', () => {
    expect(fmtMoment('2026-11-05T02:10:00Z')).toBe('Thu, 5 Nov 2026, 10:10 am');
    expect(laterOutcome({ status: 'APPROVED', handledAt: null })).toBe('Still on the list');
    expect(laterOutcome({ status: 'BOUGHT', handledAt: '2026-11-11T03:00:00Z' })).toBe('Bought Wed 11 Nov');
  });

  it('shows money as RM with two decimals', () => {
    expect(fmtRM(12.5)).toBe('RM 12.50');
    expect(fmtRM('3')).toBe('RM 3.00');
  });

  it('won\'t send a request without what, how many and what for — and checks the shop link', () => {
    const d = emptyPurchaseDraft();
    expect(purchaseDraftProblem(d)).toMatch(/what needs to be bought/);
    expect(purchaseDraftProblem({ ...d, item: 'Glue' })).toMatch(/how many/);
    expect(purchaseDraftProblem({ ...d, item: 'Glue', quantity: '2' })).toMatch(/which class/);
    const ready = { ...d, item: ' Glue ', quantity: ' 2 boxes ', purpose: 'Art', note: ' ', link: '' };
    expect(purchaseDraftProblem(ready)).toBeNull();
    expect(purchaseDraftProblem({ ...ready, link: 'shopee' })).toMatch(/full shop link/);
    expect(purchaseDraftProblem({ ...ready, link: 'https://shopee.com.my/glue' })).toBeNull();
    expect(purchaseDraftToInput(ready)).toEqual({ buyer: 'SUPERVISOR', item: 'Glue', quantity: '2 boxes', purpose: 'Art', note: null, link: null });
    expect(purchaseDraftToInput({ ...ready, buyer: 'SELF' }).buyer).toBe('SELF');
  });
});

import { describe, it, expect } from 'vitest';
import { actionLabel, rangeLabel, whenLabel } from '../../pages/admin/accessLogDisplay';

// Admin → Access Log: how each entry's time, page and the pager read.

describe('Access log — display', () => {
  it('shows the time in Malaysia, adding the year only for an earlier year', () => {
    const now = new Date('2026-11-11T04:00:00Z');
    expect(whenLabel('2026-11-11T02:42:00Z', now)).toBe('11 Nov, 10:42');
    // 23:30 UTC on 31 Dec is already 1 Jan in Malaysia.
    expect(whenLabel('2025-12-31T23:30:00Z', now)).toBe('1 Jan, 07:30');
    expect(whenLabel('2025-03-02T01:00:00Z', now)).toBe('2 Mar 2025, 09:00');
  });

  it('shows the page that was opened without the method or API prefix', () => {
    expect(actionLabel('GET /api/salary/teachers')).toBe('/salary/teachers');
    expect(actionLabel('GET /api/teachers/:teacherId/allowances')).toBe('/teachers/:teacherId/allowances');
  });

  it('counts the entries on the current page', () => {
    expect(rangeLabel(1, 50, 230)).toBe('1–50 of 230');
    expect(rangeLabel(5, 50, 230)).toBe('201–230 of 230');
    expect(rangeLabel(1, 50, 0)).toBe('0 entries');
  });
});

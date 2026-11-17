import { describe, it, expect } from 'vitest';
import { appraisedInMonth } from '../../pages/appraisals/appraisalsList';

// HRMS → Appraisals → New appraisal: who already has one this month (a second is allowed, after a warning).

const run = (year: number, month: number, formName: string) => ({ period: { year, month }, formName }) as never;

describe('New appraisal — already appraised this month', () => {
  it('finds who already has an appraisal for exactly this month, and on which form', () => {
    const rows = [
      { teacherId: 'tina', runs: [run(2026, 10, 'Junior Teacher Appraisal')] },
      { teacherId: 'sam', runs: [run(2026, 9, 'Junior Teacher Appraisal')] }, // last month — doesn't count
      { teacherId: 'oli', runs: [] },
    ];
    const taken = appraisedInMonth(rows, { year: 2026, month: 10 });
    expect([...taken]).toEqual([['tina', 'Junior Teacher Appraisal']]);
  });
});

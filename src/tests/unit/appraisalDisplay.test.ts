import { describe, it, expect } from 'vitest';
import {
  ALL_POSITIONS, NO_POSITION, appraisalYearOptions, matchesName, matchesPosition, positionOptions, scoreColors, selectableMonths,
} from '../../pages/appraisals/appraisalDisplay';

// HR → Appraisals: the month / year dropdowns, and the colour each score is shown in.

const NOV_2026 = { year: 2026, month: 10 };

describe('Appraisals — month and year dropdowns, score colours', () => {
  it('offers this year and the five years before it', () => {
    expect(appraisalYearOptions(NOV_2026)).toEqual([2026, 2025, 2024, 2023, 2022, 2021]);
  });

  it('offers every month of a past year, but only up to this month in the current year', () => {
    expect(selectableMonths(2025, NOV_2026)).toHaveLength(12);
    expect(selectableMonths(2026, NOV_2026)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // Jan–Nov
    expect(selectableMonths(2027, NOV_2026)).toEqual([]);
  });

  it('filters by position, including staff with no position', () => {
    const rows = [{ positionName: 'Senior EI' }, { positionName: 'Junior EI' }, { positionName: null }, { positionName: 'Junior EI' }];
    expect(positionOptions(rows)).toEqual([
      { value: 'Junior EI', label: 'Junior EI' },
      { value: 'Senior EI', label: 'Senior EI' },
      { value: NO_POSITION, label: 'No position' },
    ]);
    expect(rows.filter(r => matchesPosition(r, 'Junior EI'))).toHaveLength(2);
    expect(rows.filter(r => matchesPosition(r, NO_POSITION))).toHaveLength(1);
    expect(rows.filter(r => matchesPosition(r, ALL_POSITIONS))).toHaveLength(4);
  });

  it('searches by name, ignoring case and word order', () => {
    const row = { name: 'Aisyah Rahman' };
    expect(matchesName(row, '')).toBe(true);
    expect(matchesName(row, '  ')).toBe(true);
    expect(matchesName(row, 'AISY')).toBe(true);
    expect(matchesName(row, 'rah aisy')).toBe(true);
    expect(matchesName(row, 'aisyah tan')).toBe(false);
  });

  it('colours 80 and above green, 60 to 79 amber, and below 60 red', () => {
    expect(scoreColors(80).color).toBe('#15803d');
    expect(scoreColors(79).color).toBe('#b45309');
    expect(scoreColors(60).color).toBe('#b45309');
    expect(scoreColors(59).color).toBe('#991b1b');
  });
});

import { describe, it, expect } from 'vitest';
import { columnCount, splitIntoColumns } from '../../pages/settings/settingsColumns';

// Settings home: group cards in even columns, in order.

describe('Settings home — card columns', () => {
  it('fits as many columns as the width allows, at least one', () => {
    expect(columnCount(1000, 300, 16)).toBe(3);
    expect(columnCount(600, 300, 16)).toBe(1);
    expect(columnCount(0, 300, 16)).toBe(1);
  });

  it('keeps the cards in order and makes the tallest column as short as it can be', () => {
    // HRMS: HR planning 3 rows, Pay 2, Recruitment 2, Training 2, Performance 4 (+1 for each heading).
    const groups = [['hr', 3], ['pay', 2], ['recruit', 2], ['training', 2], ['perf', 4]] as const;
    const cols = splitIntoColumns([...groups], g => g[1] + 1, 3).map(c => c.map(g => g[0]));
    expect(cols).toEqual([['hr', 'pay'], ['recruit', 'training'], ['perf']]);
    expect(splitIntoColumns(['a'], () => 1, 3)).toEqual([['a']]); // never an empty column
  });
});

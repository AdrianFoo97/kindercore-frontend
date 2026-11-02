import { describe, it, expect } from 'vitest';
import { monthPool, poolWeight, settingNum, splitPool } from '../../utils/poolMath';

// Profit-sharing / annual-bonus pools are real RM paid to staff. The admin
// pages and the teacher's Pay pages both use these functions.

const month = (revenue: number, staffCost: number, operatingCost: number, isForecast = false) =>
  ({ revenue, staffCost, operatingCost, isForecast });

describe('Pools — which months pay in', () => {
  it('pays into the pool only in a month whose costs are within the target', () => {
    // 60% target, 5% share. 50k revenue, 25k cost = 50% → hit.
    expect(monthPool(0, month(50_000, 20_000, 5_000), 0.6, 0.05)).toMatchObject({ hit: true, pool: 2_500, ratio: 0.5 });
    // 35k cost = 70% → missed, nothing paid in.
    expect(monthPool(1, month(50_000, 30_000, 5_000), 0.6, 0.05)).toMatchObject({ hit: false, pool: 0, projectedPool: 0 });
  });

  it('treats a month exactly on the target as a hit', () => {
    expect(monthPool(0, month(10_000, 6_000, 0), 0.6, 0.1).pool).toBe(1_000);
  });

  it('pays nothing for a forecast month, but shows what it would add', () => {
    expect(monthPool(0, month(50_000, 20_000, 5_000, true), 0.6, 0.05))
      .toMatchObject({ hit: false, pool: 0, projectedPool: 2_500, isForecast: true });
  });

  it('pays nothing for a month with no revenue or no figures yet', () => {
    expect(monthPool(0, month(0, 5_000, 1_000), 0.6, 0.05)).toMatchObject({ hit: false, pool: 0, ratio: null });
    expect(monthPool(3, undefined, 0.6, 0.05)).toMatchObject({ monthIdx: 3, pool: 0, isForecast: true });
  });

  it('uses the default when a setting is missing or out of range', () => {
    expect(settingNum('0.55', 0, 2, 0.6)).toBe(0.55);
    expect(settingNum(undefined, 0, 2, 0.6)).toBe(0.6);
    expect(settingNum(0, 0, 1, 0.05)).toBe(0.05);   // 0% would silently cancel the pool
    expect(settingNum(1.5, 0, 1, 0.05)).toBe(0.05); // over 100%
    expect(settingNum('abc', 0, 1, 0.05)).toBe(0.05);
  });
});

describe('Pools — each teacher\'s share', () => {
  it('counts a teacher\'s weight only for the months they were active', () => {
    const months = [
      { isActive: true, weight: 1 },
      { isActive: false, weight: 1 }, // resigned / not yet joined
      { isActive: true, weight: 0.5 }, // part-time
      { isActive: true, weight: 1 },   // outside the quarter
    ];
    expect(poolWeight(months, [0, 1, 2])).toBe(1.5);
  });

  it('splits the pool by weight, to the sen, and the shares add back up to the pool', () => {
    const rows = [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }, { id: 'c', weight: 1 }];
    const split = splitPool(rows, 100);
    expect(split.map(r => r.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(split.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(100, 10);
  });

  it('gives a bigger weight a bigger share', () => {
    const split = splitPool([{ id: 'part', weight: 0.5 }, { id: 'full', weight: 1.5 }], 1_000);
    expect(Object.fromEntries(split.map(r => [r.id, r.amount]))).toEqual({ full: 750, part: 250 });
  });

  it('pays nobody when no one has any weight', () => {
    expect(splitPool([{ id: 'a', weight: 0 }], 500).map(r => r.amount)).toEqual([0]);
    expect(splitPool([], 500)).toEqual([]);
  });
});

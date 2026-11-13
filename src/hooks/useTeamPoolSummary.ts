import type { PoolMonthStatus } from '../api/finance.js';
import { useTeacherPayPools } from './useTeacherPayPools.js';

export const TEAM_POOL_QUARTERS: { label: string; months: number[] }[] = [
  { label: 'Q1 · Jan – Mar', months: [0, 1, 2] },
  { label: 'Q2 · Apr – Jun', months: [3, 4, 5] },
  { label: 'Q3 · Jul – Sep', months: [6, 7, 8] },
  { label: 'Q4 · Oct – Dec', months: [9, 10, 11] },
];

export type TeamPoolMonth = PoolMonthStatus;

export interface TeamPoolSummary {
  year: number;
  quarter: { label: string; months: number[] };
  monthlyPools: TeamPoolMonth[];
  poolAmount: number;
  hitsCount: number;
  elapsedCount: number;
  isEligible: boolean;
  myShare: number;
  mySharePct: number;
  isLoading: boolean;
}

/**
 * This quarter's team profit-share pool as this teacher sees it — which
 * months hit target, the pool so far and their own estimated share. Worked
 * out on the server with the same maths as the admin Profit Sharing page,
 * so the teacher's phone never downloads the school's finance figures.
 */
export function useTeamPoolSummary(teacherId: string | undefined): TeamPoolSummary {
  const { data, isLoading } = useTeacherPayPools(teacherId);
  const now = new Date();
  const p = data?.teamPool;
  return {
    year: data?.year ?? now.getFullYear(),
    quarter: TEAM_POOL_QUARTERS[data?.quarterIdx ?? Math.floor(now.getMonth() / 3)],
    monthlyPools: p?.months ?? [],
    poolAmount: p?.poolAmount ?? 0,
    hitsCount: p?.hitsCount ?? 0,
    elapsedCount: p?.elapsedCount ?? 0,
    isEligible: p?.isEligible ?? false,
    myShare: p?.myShare ?? 0,
    mySharePct: p?.mySharePct ?? 0,
    isLoading,
  };
}

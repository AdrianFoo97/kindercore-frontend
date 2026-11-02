import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTeacherWeightsByMonth } from '../api/salary.js';
import { fetchFinanceSummary } from '../api/finance.js';
import { fetchSettings } from '../api/settings.js';
import { DEFAULT_EXPENSE_RATIO_TARGET, DEFAULT_PROFIT_SHARE_PERCENT } from '../pages/FinanceSettingsPage.js';
import { monthPool, poolWeight, settingNum, splitPool } from '../utils/poolMath.js';

export const TEAM_POOL_QUARTERS: { label: string; months: number[] }[] = [
  { label: 'Q1 · Jan – Mar', months: [0, 1, 2] },
  { label: 'Q2 · Apr – Jun', months: [3, 4, 5] },
  { label: 'Q3 · Jul – Sep', months: [6, 7, 8] },
  { label: 'Q4 · Oct – Dec', months: [9, 10, 11] },
];


export interface TeamPoolMonth {
  monthIdx: number;
  revenue: number;
  hit: boolean;
  pool: number;
  projectedPool: number;
  isForecast: boolean;
  ratio: number | null;
}

export interface TeamPoolSummary {
  year: number;
  quarter: { label: string; months: number[] };
  monthlyPools: TeamPoolMonth[];
  poolAmount: number;
  hitsCount: number;
  elapsedCount: number;
  myWeight: number;
  totalWeight: number;
  isEligible: boolean;
  myShare: number;
  mySharePct: number;
  isLoading: boolean;
}

/**
 * This quarter's team profit-share pool — how much has accrued, which
 * months hit target, and this teacher's own estimated share. Identical
 * formula to ProfitSharingPage.tsx's monthlyPools memo (same expense-
 * ratio gate + profit-share %). Extracted here (rather than duplicated
 * per page) so the Team Pool page and the Pay Breakdown preview can
 * never disagree on the number — this is the same live-money-math
 * class of function CLAUDE.md flags as highest blast radius if it
 * drifts between call sites.
 */
export function useTeamPoolSummary(teacherId: string | undefined): TeamPoolSummary {
  const year = new Date().getFullYear();
  const quarterIdx = Math.floor(new Date().getMonth() / 3);
  const quarter = TEAM_POOL_QUARTERS[quarterIdx];

  const { data: weights, isLoading: weightsLoading } = useQuery({
    queryKey: ['teacher-weights-by-month', year],
    queryFn: () => fetchTeacherWeightsByMonth(year),
  });
  const { data: finance, isLoading: financeLoading } = useQuery({
    queryKey: ['finance-summary', year],
    queryFn: () => fetchFinanceSummary(year),
  });
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const expenseTarget = settingNum(settings?.expense_ratio_target, 0, 2, DEFAULT_EXPENSE_RATIO_TARGET);
  const profitSharePct = settingNum(settings?.profit_share_percent, 0, 1, DEFAULT_PROFIT_SHARE_PERCENT);

  const monthlyPools = useMemo<TeamPoolMonth[]>(
    () => quarter.months.map(mi => monthPool(mi, finance?.months[mi], expenseTarget, profitSharePct)),
    [finance, quarter, expenseTarget, profitSharePct],
  );

  const poolAmount = monthlyPools.reduce((s, m) => s + m.pool, 0);
  const hitsCount = monthlyPools.filter(m => m.hit).length;
  const elapsedCount = monthlyPools.filter(m => !m.isForecast).length;

  // Everyone with weight this quarter — split exactly as the admin
  // Profit Sharing page does, so "my share" matches what is paid out.
  const team = useMemo(
    () => (weights?.teachers ?? [])
      .map(t => ({ teacherId: t.teacherId, weight: poolWeight(t.months, quarter.months) }))
      .filter(t => t.weight > 0),
    [weights, quarter],
  );
  const totalWeight = team.reduce((s, t) => s + t.weight, 0);
  const myWeight = team.find(t => t.teacherId === teacherId)?.weight ?? 0;
  const isEligible = myWeight > 0;

  const myShare = useMemo(
    () => splitPool(team, poolAmount).find(t => t.teacherId === teacherId)?.amount ?? 0,
    [team, poolAmount, teacherId],
  );
  const mySharePct = totalWeight > 0 ? Math.round((myWeight / totalWeight) * 100) : 0;

  return {
    year, quarter, monthlyPools, poolAmount, hitsCount, elapsedCount,
    myWeight, totalWeight, isEligible, myShare, mySharePct,
    isLoading: weightsLoading || financeLoading,
  };
}

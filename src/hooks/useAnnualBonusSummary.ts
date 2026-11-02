import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTeacherWeightsByMonth } from '../api/salary.js';
import { fetchFinanceSummary } from '../api/finance.js';
import { fetchSettings } from '../api/settings.js';
import { DEFAULT_EXPENSE_RATIO_TARGET, DEFAULT_ANNUAL_BONUS_PERCENT } from '../pages/FinanceSettingsPage.js';
import { monthPool, poolWeight, settingNum, splitPool } from '../utils/poolMath.js';

const YEAR_MONTHS = Array.from({ length: 12 }, (_, i) => i);

export interface AnnualBonusMonth {
  monthIdx: number;
  revenue: number;
  hit: boolean;
  pool: number;
  projectedPool: number;
  isForecast: boolean;
  ratio: number | null;
}

export interface AnnualBonusSummary {
  year: number;
  monthlyPools: AnnualBonusMonth[];
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
 * This year's annual bonus pool — how much has accrued across all 12
 * months, how many hit target, and this teacher's own estimated share.
 * Identical formula to AnnualBonusPage.tsx's monthlyPools memo (same
 * expense-ratio gate + annual-bonus %, full calendar year rather than
 * one quarter). Extracted here so every surface that shows this number
 * — a future full detail page and the Pay Breakdown preview — can
 * never disagree, same reasoning as useTeamPoolSummary.ts.
 */
export function useAnnualBonusSummary(teacherId: string | undefined): AnnualBonusSummary {
  const year = new Date().getFullYear();

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
  const annualBonusPct = settingNum(settings?.annual_bonus_percent, 0, 1, DEFAULT_ANNUAL_BONUS_PERCENT);

  const monthlyPools = useMemo<AnnualBonusMonth[]>(
    () => YEAR_MONTHS.map(mi => monthPool(mi, finance?.months[mi], expenseTarget, annualBonusPct)),
    [finance, expenseTarget, annualBonusPct],
  );

  const poolAmount = monthlyPools.reduce((s, m) => s + m.pool, 0);
  const hitsCount = monthlyPools.filter(m => m.hit).length;
  const elapsedCount = monthlyPools.filter(m => !m.isForecast).length;

  // Everyone with weight this year — split exactly as the admin Annual
  // Bonus page does, so "my share" matches what is paid out.
  const team = useMemo(
    () => (weights?.teachers ?? [])
      .map(t => ({ teacherId: t.teacherId, weight: poolWeight(t.months, YEAR_MONTHS) }))
      .filter(t => t.weight > 0),
    [weights],
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
    year, monthlyPools, poolAmount, hitsCount, elapsedCount,
    myWeight, totalWeight, isEligible, myShare, mySharePct,
    isLoading: weightsLoading || financeLoading,
  };
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTeacherWeightsByMonth } from '../api/salary.js';
import { fetchFinanceSummary } from '../api/finance.js';
import { fetchSettings } from '../api/settings.js';
import { DEFAULT_EXPENSE_RATIO_TARGET, DEFAULT_ANNUAL_BONUS_PERCENT } from '../pages/FinanceSettingsPage.js';

function settingNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > lo && n <= hi ? n : fallback;
}

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

  const monthlyPools = useMemo<AnnualBonusMonth[]>(() => {
    return Array.from({ length: 12 }, (_, mi) => {
      const m = finance?.months[mi];
      if (!m) return { monthIdx: mi, revenue: 0, hit: false, pool: 0, projectedPool: 0, isForecast: true, ratio: null };
      const expenses = m.staffCost + m.operatingCost;
      const ratio = m.revenue > 0 ? expenses / m.revenue : null;
      const wouldQualify = ratio !== null && ratio <= expenseTarget;
      const hit = !m.isForecast && wouldQualify;
      const projectedPool = wouldQualify ? m.revenue * annualBonusPct : 0;
      const pool = hit ? projectedPool : 0;
      return { monthIdx: mi, revenue: m.revenue, hit, pool, projectedPool, isForecast: m.isForecast, ratio };
    });
  }, [finance, expenseTarget, annualBonusPct]);

  const poolAmount = monthlyPools.reduce((s, m) => s + m.pool, 0);
  const hitsCount = monthlyPools.filter(m => m.hit).length;
  const elapsedCount = monthlyPools.filter(m => !m.isForecast).length;

  const { myWeight, totalWeight, isEligible } = useMemo(() => {
    if (!weights) return { myWeight: 0, totalWeight: 0, isEligible: false };
    let mine = 0;
    let total = 0;
    let mineFound = false;
    for (const t of weights.teachers) {
      let w = 0;
      for (let mi = 0; mi < 12; mi++) {
        const m = t.months[mi];
        if (m && m.isActive && m.weight > 0) w += m.weight;
      }
      if (w <= 0) continue;
      total += w;
      if (t.teacherId === teacherId) { mine = w; mineFound = true; }
    }
    return { myWeight: mine, totalWeight: total, isEligible: mineFound };
  }, [weights, teacherId]);

  const myShare = totalWeight > 0 ? Math.round((myWeight / totalWeight) * poolAmount * 100) / 100 : 0;
  const mySharePct = totalWeight > 0 ? Math.round((myWeight / totalWeight) * 100) : 0;

  return {
    year, monthlyPools, poolAmount, hitsCount, elapsedCount,
    myWeight, totalWeight, isEligible, myShare, mySharePct,
    isLoading: weightsLoading || financeLoading,
  };
}

import type { PoolMonthStatus } from '../api/finance.js';
import { useTeacherPayPools } from './useTeacherPayPools.js';

export type AnnualBonusMonth = PoolMonthStatus;

export interface AnnualBonusSummary {
  year: number;
  monthlyPools: AnnualBonusMonth[];
  poolAmount: number;
  hitsCount: number;
  elapsedCount: number;
  isEligible: boolean;
  myShare: number;
  mySharePct: number;
  isLoading: boolean;
}

/**
 * This year's annual bonus pool as this teacher sees it — which months hit
 * target, the pool so far and their own estimated share. Worked out on the
 * server with the same maths as the admin Annual Bonus page, so the teacher's
 * phone never downloads the school's finance figures.
 */
export function useAnnualBonusSummary(teacherId: string | undefined): AnnualBonusSummary {
  const { data, isLoading } = useTeacherPayPools(teacherId);
  const p = data?.annualBonus;
  return {
    year: data?.year ?? new Date().getFullYear(),
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

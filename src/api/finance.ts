import { apiFetch } from './client.js';

export interface FinanceMonth {
  month: string;
  revenue: number;
  staffCost: number;
  operatingCost: number;
  profit: number;
  margin: number;
  studentCount: number;
  teacherCount: number;
  isForecast: boolean;
  /** True when the month's operating cost is a projection (no saved entries). */
  operatingIsProjected: boolean;
  /** Recorded spend under categories/groups flagged out of the operating
   *  cost sum (e.g. HR Benefits) — doesn't count toward operatingCost/profit. */
  excludedOperatingCost: number;
  /** Salary + employer contributions for teachers flagged "exclude from
   *  staff cost" — doesn't count toward staffCost/profit. */
  excludedStaffCost: number;
}

export interface FinanceTotalsSplit {
  revenue: number;
  staffCost: number;
  operatingCost: number;
  profit: number;
  excludedOperatingCost: number;
  excludedStaffCost: number;
}

export interface FinanceSummary {
  year: number;
  currentMonthIdx: number;
  months: FinanceMonth[];
  totals: FinanceTotalsSplit & {
    actual: FinanceTotalsSplit;
    forecast: FinanceTotalsSplit;
  };
}

/** The school's finance summary — Finance / Analysis only (the server refuses everyone else). */
export function fetchFinanceSummary(year?: number) {
  return apiFetch<FinanceSummary>(`/api/finance/summary${year ? `?year=${year}` : ''}`);
}

// ── A teacher's own pools (Pay / Home pages) ─────────────────────────────────
// Worked out on the server: only hit / missed / upcoming per month, the pool
// so far and the teacher's own share — never the school's finance figures.

export interface PoolMonthStatus { monthIdx: number; hit: boolean; isForecast: boolean }
export interface PoolProgress {
  months: PoolMonthStatus[];
  poolAmount: number;
  hitsCount: number;
  elapsedCount: number;
  isEligible: boolean;
  myShare: number;
  mySharePct: number;
}
export interface TeacherPayPools {
  year: number;
  quarterIdx: number;
  /** This quarter's team profit-share pool. */
  teamPool: PoolProgress;
  /** This year's annual bonus pool. */
  annualBonus: PoolProgress;
}

export function fetchTeacherPayPools(teacherId: string, year: number, quarterIdx: number) {
  return apiFetch<TeacherPayPools>(`/api/teachers/${teacherId}/pay-pools?year=${year}&quarter=${quarterIdx}`);
}

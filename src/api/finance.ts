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
}

export interface FinanceTotalsSplit {
  revenue: number;
  staffCost: number;
  operatingCost: number;
  profit: number;
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

export function fetchFinanceSummary(year?: number) {
  return apiFetch<FinanceSummary>(`/api/finance/summary${year ? `?year=${year}` : ''}`);
}

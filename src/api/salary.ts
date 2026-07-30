import { apiFetch } from './client.js';
import { Position, LevelIncentive } from '../types/index.js';

export function fetchPositions() {
  return apiFetch<Position[]>('/api/salary/positions');
}

export function upsertPosition(positionId: string, data: { name: string; titleWeight: number; basicSalary: number; maxLevel: number; sortOrder?: number; inCareerProgression?: boolean; badgeUrl?: string | null; starColor?: string | null; description?: string | null; roleFocus?: string | null }) {
  return apiFetch<Position>(`/api/salary/positions/${positionId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deletePosition(positionId: string) {
  return apiFetch<void>(`/api/salary/positions/${positionId}`, { method: 'DELETE' });
}

export function fetchLevelIncentives() {
  return apiFetch<LevelIncentive[]>('/api/salary/level-incentives');
}

export function upsertLevelIncentives(matrix: { positionId: string; level: number; amount: number }[]) {
  return apiFetch<LevelIncentive[]>('/api/salary/level-incentives', { method: 'PUT', body: JSON.stringify({ matrix }) });
}

export interface TeacherWithSalary {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  positionId: string | null;
  level: number | null;
  attendanceAllowance: number | null;
  kpiAllowance: number | null;
  isFixedSalary: boolean;
  fixedSalaryAmount: number | null;
  position: Position | null;
  calculatedSalary: number;
  breakdown: { basic: number; levelIncentive: number; allowances: { typeId: string; typeName: string; amount: number; icon?: string; isGuaranteed?: boolean; parentId?: string | null }[]; totalAllowances: number } | null;
  /** True once this teacher's join date has arrived (and they haven't
   *  resigned yet) — i.e. counted in *this* calendar month's real payroll.
   *  A teacher hired with a future join date still has calculatedSalary
   *  populated (so their config is visible), but this is false until they
   *  actually start — callers summing salary into a cost total must
   *  filter on this first. */
  activeThisMonth: boolean;
}

export function fetchTeachersWithSalary() {
  return apiFetch<TeacherWithSalary[]>('/api/salary/teachers');
}

export interface TeacherWeightMonth {
  monthIdx: number;
  positionId: string | null;
  positionCode: string | null;
  positionName: string | null;
  level: number;
  baseWeight: number;
  levelWeight: number;
  /** Weight before active-days proration (full-month equivalent). */
  fullWeight: number;
  /** Final weight for the month = fullWeight × (activeDays / daysInMonth). */
  weight: number;
  activeDays: number;
  daysInMonth: number;
  activeDayRatio: number;
  isPartTime: boolean;
  isActive: boolean;
}

export interface TeacherWeightRow {
  teacherId: string;
  teacherName: string;
  color: string;
  employmentType: string;
  months: TeacherWeightMonth[];
  averageWeight: number;
  isOverride: boolean;
}

export interface TeacherWeightsByMonth {
  year: number;
  currentMonthIdx: number;
  teachers: TeacherWeightRow[];
}

export function fetchTeacherWeightsByMonth(year?: number) {
  return apiFetch<TeacherWeightsByMonth>(`/api/salary/teacher-weights-by-month${year ? `?year=${year}` : ''}`);
}

export interface PayrollByMonth {
  year: number;
  months: { month: string; total: number; teacherCount: number; isForecast: boolean }[];
  annualTotal: number;
  actualTotal: number;
  forecastTotal: number;
  currentMonthIdx: number;
}

export function fetchPayrollByMonth(year?: number) {
  return apiFetch<PayrollByMonth>(`/api/salary/payroll-by-month${year ? `?year=${year}` : ''}`);
}

export interface EmployerContributions {
  total: number;
  epf: number;
  socso: number;
  eis: number;
}

export function fetchEmployerContributions() {
  return apiFetch<EmployerContributions>('/api/salary/employer-contributions');
}

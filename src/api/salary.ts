import { apiFetch } from './client.js';
import { Position, LevelIncentive } from '../types/index.js';

export function fetchPositions() {
  return apiFetch<Position[]>('/api/salary/positions');
}

export function upsertPosition(positionId: string, data: { name: string; titleWeight: number; basicSalary: number; maxLevel: number; sortOrder?: number }) {
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
  breakdown: { basic: number; levelIncentive: number; allowances: { typeId: string; typeName: string; amount: number }[]; totalAllowances: number } | null;
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
  weight: number;
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

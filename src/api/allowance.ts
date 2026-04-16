import { apiFetch } from './client.js';
import { AllowanceType, TeacherAllowance } from '../types/index.js';

export function fetchAllowanceTypes() {
  return apiFetch<AllowanceType[]>('/api/allowance-types');
}

export function createAllowanceType(data: { name: string; sortOrder?: number }) {
  return apiFetch<AllowanceType>('/api/allowance-types', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAllowanceType(id: string, data: Partial<{ name: string; isDefault: boolean; sortOrder: number }>) {
  return apiFetch<AllowanceType>(`/api/allowance-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteAllowanceType(id: string) {
  return apiFetch<void>(`/api/allowance-types/${id}`, { method: 'DELETE' });
}

export function fetchTeacherAllowances(teacherId: string) {
  return apiFetch<TeacherAllowance[]>(`/api/teachers/${teacherId}/allowances`);
}

export function upsertTeacherAllowances(teacherId: string, allowances: { allowanceTypeId: string; amount: number }[]) {
  return apiFetch<TeacherAllowance[]>(`/api/teachers/${teacherId}/allowances`, { method: 'PUT', body: JSON.stringify({ allowances }) });
}

import { apiFetch } from './client.js';
import { CareerRecord } from '../types/index.js';

export function fetchCareerRecords(teacherId: string) {
  return apiFetch<CareerRecord[]>(`/api/teachers/${teacherId}/career`);
}

export function createCareerRecord(teacherId: string, data: { positionId: string; level: number; effectiveDate: string; notes?: string | null }) {
  return apiFetch<CareerRecord>(`/api/teachers/${teacherId}/career`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateCareerRecord(id: string, data: Partial<{ positionId: string; level: number; effectiveDate: string; notes: string | null }>) {
  return apiFetch<CareerRecord>(`/api/career/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteCareerRecord(id: string) {
  return apiFetch<void>(`/api/career/${id}`, { method: 'DELETE' });
}

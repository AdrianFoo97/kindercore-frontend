import { apiFetch } from './client.js';
import { CareerRecord } from '../types/index.js';

export function fetchCareerRecords(teacherId: string) {
  return apiFetch<CareerRecord[]>(`/api/teachers/${teacherId}/career`);
}

/** An enriched career record event for a given year — includes teacher name,
 *  position name, previous record (for diffing), and a classified eventType. */
export interface CareerEvent {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherColor: string;
  positionId: string;
  positionName: string;
  level: number;
  prevPositionId: string | null;
  prevPositionName: string | null;
  prevLevel: number | null;
  effectiveDate: string;
  notes: string | null;
  eventType: 'promotion' | 'demotion' | 'position_change' | 'assignment';
}

export function fetchCareerEventsByYear(year: number) {
  return apiFetch<CareerEvent[]>(`/api/career-records?year=${year}`);
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

import { apiFetch } from './client.js';

export interface TeacherAppraisal {
  id: string;
  teacherId: string;
  year: number;
  month: number; // 0–11
  score: number; // 0–100
  notes: string | null;
  evaluatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppraisalSummary {
  average: number | null;
  recordCount: number;
  windowSize: number;
}

export interface AppraisalListResponse {
  items: TeacherAppraisal[];
  summary: AppraisalSummary;
}

export function fetchTeacherAppraisals(teacherId: string) {
  return apiFetch<AppraisalListResponse>(`/api/teachers/${teacherId}/appraisals`);
}

export interface UpsertAppraisalPayload {
  year: number;
  month: number; // 0–11
  score: number;
  notes?: string | null;
  evaluatedBy?: string | null;
}

export function upsertTeacherAppraisal(teacherId: string, payload: UpsertAppraisalPayload) {
  return apiFetch<TeacherAppraisal>(`/api/teachers/${teacherId}/appraisals`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteTeacherAppraisal(id: string) {
  return apiFetch<void>(`/api/appraisals/${id}`, { method: 'DELETE' });
}

import { apiFetch } from './client.js';

// Admin → Access Log: who opened pay, finance, appraisal and applicant records.

export type AccessArea = 'FINANCE' | 'PAYROLL' | 'STAFF_PAY' | 'APPRAISALS' | 'APPLICANTS';

export interface AccessLogEntry {
  id: string;
  at: string;
  userName: string | null;
  userEmail: string;
  area: AccessArea;
  areaLabel: string;
  /** What was opened, e.g. "GET /api/salary/teachers". */
  action: string;
  /** Whose record, when it was one staff member's. */
  subjectName: string | null;
  ip: string | null;
}

export interface AccessLogPage {
  rows: AccessLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  areas: Record<AccessArea, string>;
  retentionDays: number;
}

export interface AccessLogQuery { days: number; area?: AccessArea | ''; q?: string; page: number }

export function fetchAccessLog({ days, area, q, page }: AccessLogQuery) {
  const params = new URLSearchParams({ days: String(days), page: String(page) });
  if (area) params.set('area', area);
  if (q?.trim()) params.set('q', q.trim());
  return apiFetch<AccessLogPage>(`/api/admin/access-log?${params}`);
}

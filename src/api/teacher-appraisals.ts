import { apiFetch } from './client.js';
import type { PeriodType, RunStatus } from './appraisal-runs.js';

export interface TeacherAppraisal {
  id: string;
  teacherId: string;
  year: number;
  month: number; // 0–11
  score: number; // 0–100
  notes: string | null;
  evaluatedBy: string | null;
  /** Scored with an appraisal form: that appraisal (open it to see the form and every score). It can't be edited by hand. */
  engineAppraisalId?: string | null;
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
  /** This year's months so far (Malaysia time), averaged. */
  yearToDate?: { year: number; average: number | null };
  /** Each quarter with appraisals, newest first, with its average (quarter 1–4). */
  quarters?: { year: number; quarter: number; average: number | null }[];
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

/** HR → Appraisals: one month's status for every current staff member. */
export interface AppraisalOverviewRow {
  teacherId: string;
  name: string;
  color: string;
  positionName: string | null;
  /** Their appraisal for the month, or null when it's still pending. */
  appraisal: TeacherAppraisal | null;
  /** Their latest appraisal before that month — the "previous mark". */
  previous: { year: number; month: number; score: number } | null;
  /** Average over the 12 months up to that month. */
  twelveMonth: AppraisalSummary;
  /** This quarter and this year so far, up to that month (null = none yet). */
  averages: { quarter: number | null; year: number | null };
  /** Each month's score this year, up to that month (0–11, oldest first) — what the averages are made of. */
  yearScores: { month: number; score: number }[];
  /** Appraisals the schedule created whose period includes that month. */
  runs: ScheduledAppraisal[];
}

/** Where a scheduled appraisal stands, step by step: not started → being scored (a draft) → waiting for sign-off → waiting for the staff member to confirm → done. */
export type AppraisalStage = 'PENDING' | 'IN_PROGRESS' | 'SIGN_OFF' | 'CONFIRM' | 'DONE';

export interface ScheduledAppraisal {
  id: string;
  formName: string;
  period: { year: number; month: number };
  periodType: PeriodType;
  status: RunStatus;
  stage: AppraisalStage;
  totalScore: number | null;
}

export interface AppraisalOverview {
  year: number;
  month: number; // 0–11
  staff: AppraisalOverviewRow[];
}

export function fetchAppraisalOverview(year: number, month: number) {
  return apiFetch<AppraisalOverview>(`/api/appraisals/overview?year=${year}&month=${month}`);
}

export function deleteTeacherAppraisal(id: string) {
  return apiFetch<void>(`/api/appraisals/${id}`, { method: 'DELETE' });
}

import { apiFetch } from './client.js';
import type { PeriodType, RunStatus } from './appraisal-runs.js';
import type { AppraisalStage } from './teacher-appraisals.js';

// HRMS → Appraisal schedule: staff on an appraisal form, repeating or once.
// The server creates each appraisal when its day comes (it then shows as
// pending on HRMS → Appraisals). HR only.

export type ScheduleRepeat = PeriodType;
/** ONGOING = will create more; PAUSED = the form isn't live or they've left; FINISHED = a one-off that's been made. */
export type ScheduleStatus = 'ONGOING' | 'PAUSED' | 'FINISHED';

export interface AppraisalSchedule {
  id: string;
  teacherId: string;
  teacherName: string;
  positionName: string | null;
  familyId: string;
  formName: string;
  formLive: boolean;
  repeat: ScheduleRepeat;
  dayOfMonth: number;
  /** YEARLY: 0–11. */
  monthOfYear: number | null;
  /** 'YYYY-MM-DD'. */
  startsOn: string;
  /** The next day it creates one ('YYYY-MM-DD'); null when it never will again. */
  nextOn: string | null;
  status: ScheduleStatus;
}

export interface ScheduleInput {
  familyId: string;
  teacherIds: string[];
  repeat: ScheduleRepeat;
  dayOfMonth: number;
  monthOfYear: number | null;
  startsOn: string;
}

/** An appraisal the schedule created. */
export interface CreatedAppraisal {
  id: string;
  teacherId: string;
  teacherName: string;
  formName: string;
  period: { year: number; month: number };
  periodType: ScheduleRepeat;
  status: RunStatus;
  stage: AppraisalStage;
  totalScore: number | null;
  createdAt: string;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const SCHEDULES_KEY = ['appraisal-schedules'] as const;

/** Someone this person may appraise, schedule or observe. */
export interface PerformanceStaff { id: string; name: string; positionId: string | null; positionName: string | null }
export const PERFORMANCE_STAFF_KEY = ['performance-staff'] as const;
/** Their team — staff who report to them, directly or further down — or everyone if their access role allows. */
export const fetchPerformanceStaff = () => apiFetch<PerformanceStaff[]>('/api/performance/staff');

export const CREATED_KEY = ['appraisal-schedules', 'created'] as const;
/** Every appraisal the schedule has created, newest first. */
export const fetchCreatedAppraisals = () => apiFetch<CreatedAppraisal[]>('/api/appraisal-schedules/created');
export const fetchAppraisalSchedules = () => apiFetch<AppraisalSchedule[]>('/api/appraisal-schedules');
export const createAppraisalSchedules = (data: ScheduleInput) => apiFetch<{ created: number }>('/api/appraisal-schedules', json('POST', data));
export const deleteAppraisalSchedule = (id: string) => apiFetch<void>(`/api/appraisal-schedules/${id}`, json('DELETE'));
/** HRMS → Appraisals → New appraisal: one for someone now, on a form, for a month (no schedule). */
/** secondAnyway: they already have one this month and HR chose to start another after the warning. */
export const startOneOffAppraisal = (data: { teacherId: string; familyId: string; year: number; month: number; secondAnyway?: boolean }) =>
  apiFetch<{ id: string }>('/api/appraisals/start', json('POST', data));
/** This period's appraisal from a schedule, now rather than on its day. */
export const createAppraisalNow = (id: string) => apiFetch<{ id: string }>(`/api/appraisal-schedules/${id}/create-now`, json('POST'));

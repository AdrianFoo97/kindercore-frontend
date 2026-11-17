import { apiFetch } from './client.js';
import type { MissingPolicy, TemplateSection, TemplateStage } from './appraisal-templates.js';

// One appraisal done with a form — created by the appraisal schedule, then
// scored (saved as a draft until submitted), signed off and confirmed by the
// staff member. The server checks who may do each step.

export type RunStatus = 'IN_PROGRESS' | 'SENT_BACK' | 'AWAITING_SIGN_OFF' | 'AWAITING_ACKNOWLEDGEMENT' | 'COMPLETED';
export interface Period { year: number; month: number }
/** What an appraisal's period is — set by the schedule that created it. ONCE covers a month. */
export type PeriodType = 'ONCE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type TaskTodo = 'SCORE' | 'SIGN_OFF' | 'ACKNOWLEDGE';
export interface AppraisalTask {
  id: string; teacherId: string; teacherName: string; formName: string; period: Period; status: RunStatus; todo: TaskTodo;
}

export interface RunScore { criterionId: string; pointId: string | null; rawValue: number | null; normalised: number | null; comment: string | null }
export interface RunLogEntry { kind: 'STARTED' | 'SUBMITTED' | 'SIGNED_OFF' | 'SENT_BACK' | 'ACKNOWLEDGED'; detail: string | null; authorName: string | null; at: string }

export interface AppraisalRun {
  id: string;
  teacherId: string;
  teacherName: string;
  period: Period;
  /** The period it covers (from its schedule): a month, quarter or year. */
  periodType: PeriodType;
  status: RunStatus;
  /** Index into form.stages of the step it's on (null once done). */
  currentStep: number | null;
  totalScore: number | null;
  /** Total from what's entered so far (null until enough is scored). */
  workingTotal: number | null;
  byCriterion: Record<string, number | null>;
  /** Criterion ids still to score. */
  missing: string[];
  comments: string | null;
  assessedByName: string | null;
  completedAt: string | null;
  /** The exact form version it's scored on — never changes after it's started. */
  form: {
    id: string; familyId: string; name: string; version: number; missingPolicy: MissingPolicy;
    sections: TemplateSection[]; stages: TemplateStage[];
  };
  scores: RunScore[];
  log: RunLogEntry[];
  can: { score: boolean; signOff: boolean; acknowledge: boolean; cancel: boolean };
  /** It's the signed-in person's own appraisal — they're the staff member, not a scorer or approver. */
  mine: boolean;
  /** They're on the sign-off step but scored it themselves — someone above them in the reporting line signs it off. */
  signOffBySomeoneAbove: boolean;
}

export interface ScoreEntry { criterionId: string; pointId: string | null; rawValue: number | null; comment?: string | null }

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const TASKS_KEY = ['appraisal-tasks'] as const;
export const runKey = (id: string) => ['appraisal-run', id] as const;

export const fetchMyAppraisalTasks = () => apiFetch<AppraisalTask[]>('/api/appraisal-runs/tasks');
export const fetchAppraisalRun = (id: string) => apiFetch<AppraisalRun>(`/api/appraisal-runs/${id}`);
export const saveAppraisalScores = (id: string, scores: ScoreEntry[], comments: string | null) =>
  apiFetch<AppraisalRun>(`/api/appraisal-runs/${id}/scores`, json('PUT', { scores, comments }));
export const submitAppraisal = (id: string) => apiFetch<AppraisalRun>(`/api/appraisal-runs/${id}/submit`, json('POST'));
export const approveAppraisal = (id: string) => apiFetch<AppraisalRun>(`/api/appraisal-runs/${id}/approve`, json('POST'));
export const sendBackAppraisal = (id: string, reason: string) =>
  apiFetch<AppraisalRun>(`/api/appraisal-runs/${id}/send-back`, json('POST', { reason }));
export const acknowledgeAppraisal = (id: string) => apiFetch<AppraisalRun>(`/api/appraisal-runs/${id}/acknowledge`, json('POST'));
export const cancelAppraisal = (id: string) => apiFetch<void>(`/api/appraisal-runs/${id}`, json('DELETE'));

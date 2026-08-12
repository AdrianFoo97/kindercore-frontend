import { apiFetch } from './client.js';

export type SopObservationStatus =
  | 'PENDING_TRAINEE' | 'PENDING_TRAINER' | 'PENDING_ASSESSOR'
  | 'PENDING_FOLLOWUP_1' | 'PENDING_FOLLOWUP_2' | 'CERTIFIED';

export type StepResultValue = 'PASS' | 'FAIL' | 'NA';

// Row shape from the list endpoint — joined with teacher/template names so
// the HR queue doesn't need N+1 lookups.
export interface SopObservation {
  id: string;
  teacherId: string;
  teacherName: string;
  sopTemplateId: string;
  templateTitle: string;
  status: SopObservationStatus;
  completedByName: string | null;
  completedAt: string | null;
  trainerName: string | null;
  trainerAt: string | null;
  assessorName: string | null;
  assessorAt: string | null;
  followUp1Name: string | null;
  followUp1At: string | null;
  followUp2Name: string | null;
  followUp2At: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SopObservationStepResult {
  id: string;
  sopStepId: string;
  passed: StepResultValue;
  note: string | null;
  section: string;
  title: string;
  detail: string | null;
  displayOrder: number;
}

export interface SopObservationDetail {
  id: string;
  teacherId: string;
  teacherName: string | null;
  sopTemplateId: string;
  templateTitle: string | null;
  templateGoal: string | null;
  status: SopObservationStatus;
  completedByName: string | null;
  completedAt: string | null;
  trainerName: string | null;
  trainerAt: string | null;
  assessorName: string | null;
  assessorAt: string | null;
  followUp1Name: string | null;
  followUp1At: string | null;
  followUp2Name: string | null;
  followUp2At: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  stepResults: SopObservationStepResult[];
}

export function fetchObservations(params?: { teacherId?: string; status?: SopObservationStatus }) {
  const qs = new URLSearchParams();
  if (params?.teacherId) qs.set('teacherId', params.teacherId);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<SopObservation[]>(`/api/sop-observations${suffix}`);
}

export function fetchObservation(id: string) {
  return apiFetch<SopObservationDetail>(`/api/sop-observations/${id}`);
}

export function createObservation(payload: { teacherId: string; sopTemplateId: string }) {
  return apiFetch<SopObservation>('/api/sop-observations', { method: 'POST', body: JSON.stringify(payload) });
}

// The required payload shape depends on the observation's CURRENT stage —
// see AdvanceStagePayload variants below. The backend re-validates the
// current status server-side, so submitting the wrong shape 400s cleanly.
export type AdvanceStagePayload =
  | { completedByName: string; completedAt: string }
  | { trainerName: string; trainerAt: string; stepResults: { stepId: string; passed: StepResultValue; note?: string | null }[] }
  | { assessorName: string; assessorAt: string; notes?: string | null }
  | { followUp1Name: string; followUp1At: string; notes?: string | null }
  | { followUp2Name: string; followUp2At: string; notes?: string | null };

export function advanceStage(id: string, payload: AdvanceStagePayload) {
  return apiFetch<SopObservation>(`/api/sop-observations/${id}/advance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

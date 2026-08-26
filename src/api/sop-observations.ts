import { apiFetch } from './client.js';

export type SopObservationStatus = 'PENDING_TRAINER' | 'PENDING_ASSESSOR' | 'CERTIFIED';

export type StepResultValue = 'PASS' | 'FAIL' | 'NA';

// Row shape from the list endpoint — joined with teacher/template names so
// the HR queue doesn't need N+1 lookups.
export interface SopObservation {
  id: string;
  teacherId: string;
  teacherName: string;
  sopTemplateId: string;
  templateTitle: string;
  trainerId: string | null;
  assignedTrainerName: string | null;
  status: SopObservationStatus;
  trainerName: string | null;
  trainerAt: string | null;
  assessorName: string | null;
  assessorAt: string | null;
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
  trainerId: string | null;
  assignedTrainerName: string | null;
  status: SopObservationStatus;
  trainerName: string | null;
  trainerAt: string | null;
  assessorName: string | null;
  assessorAt: string | null;
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

export function createObservation(payload: { teacherId: string; sopTemplateId: string; trainerId: string }) {
  return apiFetch<SopObservation>('/api/sop-observations', { method: 'POST', body: JSON.stringify(payload) });
}

// The required payload shape depends on the observation's CURRENT stage —
// see AdvanceStagePayload variants below. The backend re-validates the
// current status server-side, so submitting the wrong shape 400s cleanly.
export type AdvanceStagePayload =
  | { trainerName: string; trainerAt: string }
  | { assessorName: string; assessorAt: string; notes?: string | null; stepResults: { stepId: string; passed: StepResultValue; note?: string | null }[] };

export function advanceStage(id: string, payload: AdvanceStagePayload) {
  return apiFetch<SopObservation>(`/api/sop-observations/${id}/advance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Persists marking progress without advancing the stage — lets the assessor
// step away from a long checklist and pick up where they left off.
export function saveStepResultsDraft(id: string, stepResults: { stepId: string; passed: StepResultValue; note?: string | null }[]) {
  return apiFetch<{ ok: true }>(`/api/sop-observations/${id}/step-results`, {
    method: 'POST',
    body: JSON.stringify({ stepResults }),
  });
}

import { apiFetch } from './client.js';

/**
 * TRIAL: looks right — a supervisor is trying it in practice before deciding.
 * CHANGES_REQUESTED: a reviewer sent it back to the proposer with feedback (reviewNote).
 */
export type SopRevisionStatus = 'DRAFT' | 'PENDING' | 'TRIAL' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';

/** A reviewer's comment on one step, written while going through the suggestion. */
export interface ReviewComment {
  section: string;
  stepTitle: string;
  comment: string;
}

export interface ProposedStep {
  section: string;
  title: string;
  detail?: string | null;
  linkedTemplateId?: string | null;
}

export interface SopTemplateRevision {
  id: string;
  sopTemplateId: string | null;
  title: string;
  goal: string | null;
  videoUrl: string | null;
  icon: string | null;
  stepsJson: ProposedStep[];
  /** Why the proposer wants to improve an existing guide (step 1 of a teacher's suggestion). */
  improvementReasonsJson: string[] | null;
  categoryIdsJson: string[] | null;
  status: SopRevisionStatus;
  trialStartedAt: string | null;
  trialStartedByName: string | null;
  versionNumber: number | null;
  proposedByUserId: string;
  proposedByName: string;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** A send-back's comments on individual steps, in step order. */
  reviewCommentsJson: ReviewComment[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRevisionPayload {
  sopTemplateId?: string | null;
  title: string;
  goal?: string | null;
  videoUrl?: string | null;
  icon?: string | null;
  steps: ProposedStep[];
  categoryIds?: string[];
  /** Required when a teacher suggests changes to an existing guide. */
  improvementReasons?: string[];
  // A supervisor's own work-in-progress — see the schema comment in
  // sop-revisions.controller.ts's createRevision.
  asDraft?: boolean;
}

export function fetchRevisions(q: { status?: SopRevisionStatus; sopTemplateId?: string } = {}) {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.sopTemplateId) params.set('sopTemplateId', q.sopTemplateId);
  const qs = params.toString();
  return apiFetch<SopTemplateRevision[]>(`/api/sop-revisions${qs ? `?${qs}` : ''}`);
}

export function fetchRevision(id: string) {
  return apiFetch<SopTemplateRevision>(`/api/sop-revisions/${id}`);
}

export function createRevision(payload: CreateRevisionPayload) {
  return apiFetch<SopTemplateRevision>('/api/sop-revisions', { method: 'POST', body: JSON.stringify(payload) });
}

export interface UpdateRevisionPayload {
  title: string;
  goal?: string | null;
  videoUrl?: string | null;
  icon?: string | null;
  steps: ProposedStep[];
  categoryIds?: string[];
}

// A reviewer's own edits to a PENDING revision, saved before approving —
// see updateRevision in sop-revisions.controller.ts.
export function updateRevision(id: string, payload: UpdateRevisionPayload) {
  return apiFetch<SopTemplateRevision>(`/api/sop-revisions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function approveRevision(id: string) {
  return apiFetch<SopTemplateRevision>(`/api/sop-revisions/${id}/approve`, { method: 'POST' });
}

export function rejectRevision(id: string, reviewNote?: string | null) {
  return apiFetch<SopTemplateRevision>(`/api/sop-revisions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reviewNote: reviewNote ?? null }),
  });
}

/** A reviewer sends a suggestion back, saying what to change: step comments and/or an overall note (at least one). */
export function returnRevision(id: string, feedback: { reviewNote: string | null; comments: ReviewComment[] }) {
  return apiFetch<SopTemplateRevision>(`/api/sop-revisions/${id}/return`, { method: 'POST', body: JSON.stringify(feedback) });
}

export type ResubmitRevisionPayload = Omit<CreateRevisionPayload, 'sopTemplateId' | 'asDraft'>;

/** The proposer's changes after a send-back — puts it back in review. */
export function resubmitRevision(id: string, payload: ResubmitRevisionPayload) {
  return apiFetch<SopTemplateRevision>(`/api/sop-revisions/${id}/resubmit`, { method: 'POST', body: JSON.stringify(payload) });
}

/** Try a suggestion in practice before approving it (approval needs a trial first). */
export function startTrial(id: string) {
  return apiFetch<SopTemplateRevision>(`/api/sop-revisions/${id}/trial`, { method: 'POST' });
}

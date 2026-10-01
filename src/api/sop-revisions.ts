import { apiFetch } from './client.js';

export type SopRevisionStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

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
  categoryIdsJson: string[] | null;
  status: SopRevisionStatus;
  versionNumber: number | null;
  proposedByUserId: string;
  proposedByName: string;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
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

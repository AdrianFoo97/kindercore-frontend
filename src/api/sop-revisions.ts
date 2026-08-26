import { apiFetch } from './client.js';

export type SopRevisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
}

export function fetchRevisions(q: { status?: SopRevisionStatus; sopTemplateId?: string } = {}) {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.sopTemplateId) params.set('sopTemplateId', q.sopTemplateId);
  const qs = params.toString();
  return apiFetch<SopTemplateRevision[]>(`/api/sop-revisions${qs ? `?${qs}` : ''}`);
}

export function createRevision(payload: CreateRevisionPayload) {
  return apiFetch<SopTemplateRevision>('/api/sop-revisions', { method: 'POST', body: JSON.stringify(payload) });
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

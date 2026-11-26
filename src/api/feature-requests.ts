import { apiFetch } from './client.js';

export type FeatureRequestStatus = 'NEW' | 'REVIEWED';

export interface FeatureRequest {
  id: string;
  title: string;
  message: string;
  pageUrl: string | null;
  appVersion: string | null;
  requestedByUserId: string;
  requestedByName: string;
  status: FeatureRequestStatus;
  createdAt: string;
  updatedAt: string;
}

/** Sends an idea. The sender gets only a "sent" reply — there's no status to follow. */
export function createFeatureRequest(payload: { title: string; message: string; pageUrl?: string | null; appVersion?: string | null }) {
  return apiFetch<{ ok: true }>('/api/feature-requests', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchFeatureRequests() {
  return apiFetch<FeatureRequest[]>('/api/feature-requests');
}

export function reviewFeatureRequest(id: string) {
  return apiFetch<FeatureRequest>(`/api/feature-requests/${encodeURIComponent(id)}/review`, { method: 'POST' });
}

import { apiFetch } from './client.js';

export interface LeadLabelRecord {
  id: string;
  name: string;
  color: string;
  leadCount: number;
}

export interface UpsertLeadLabelPayload {
  name: string;
  color: string;
}

export function fetchLeadLabels() {
  return apiFetch<LeadLabelRecord[]>('/api/lead-labels');
}

export function createLeadLabel(payload: UpsertLeadLabelPayload) {
  return apiFetch<LeadLabelRecord>('/api/lead-labels', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateLeadLabel(id: string, payload: Partial<UpsertLeadLabelPayload>) {
  return apiFetch<LeadLabelRecord>(`/api/lead-labels/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteLeadLabel(id: string) {
  return apiFetch<{ ok: true }>(`/api/lead-labels/${id}`, { method: 'DELETE' });
}

export function setLeadLabels(leadId: string, labelIds: string[]) {
  return apiFetch<{ ok: true }>(`/api/leads/${leadId}/labels`, {
    method: 'PUT',
    body: JSON.stringify({ labelIds }),
  });
}

import { apiFetch } from './client.js';

export interface SopStep {
  id: string;
  sopTemplateId: string;
  section: string;
  title: string;
  detail: string | null;
  // Optional hand-off to another SOP document. Loose FK — left dangling if
  // the target template is later deleted; the caller should only render a
  // link when it can still resolve the target's title from a live list.
  linkedTemplateId: string | null;
  displayOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSopStepPayload {
  sopTemplateId: string;
  section: string;
  title: string;
  detail?: string | null;
  linkedTemplateId?: string | null;
  displayOrder?: number;
}

export function fetchSteps(sopTemplateId: string) {
  return apiFetch<SopStep[]>(`/api/sop-steps?sopTemplateId=${encodeURIComponent(sopTemplateId)}`);
}

export function createStep(payload: UpsertSopStepPayload) {
  return apiFetch<SopStep>('/api/sop-steps', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateStep(id: string, payload: Partial<UpsertSopStepPayload>) {
  return apiFetch<SopStep>(`/api/sop-steps/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteStep(id: string) {
  return apiFetch<void>(`/api/sop-steps/${id}`, { method: 'DELETE' });
}

export function reorderSteps(sopTemplateId: string, orderedIds: string[]) {
  return apiFetch<{ ok: true }>('/api/sop-steps/reorder', {
    method: 'POST',
    body: JSON.stringify({ sopTemplateId, orderedIds }),
  });
}

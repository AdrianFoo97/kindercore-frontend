import { apiFetch } from './client.js';

export interface SopTemplate {
  id: string;
  title: string;
  goal: string | null;
  displayOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSopTemplatePayload {
  title: string;
  goal?: string | null;
  displayOrder?: number;
}

export function fetchTemplates() {
  return apiFetch<SopTemplate[]>('/api/sop-templates');
}

export function createTemplate(payload: UpsertSopTemplatePayload) {
  return apiFetch<SopTemplate>('/api/sop-templates', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateTemplate(id: string, payload: Partial<UpsertSopTemplatePayload>) {
  return apiFetch<SopTemplate>(`/api/sop-templates/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteTemplate(id: string) {
  return apiFetch<void>(`/api/sop-templates/${id}`, { method: 'DELETE' });
}

export function reorderTemplates(orderedIds: string[]) {
  return apiFetch<{ ok: true }>('/api/sop-templates/reorder', {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  });
}

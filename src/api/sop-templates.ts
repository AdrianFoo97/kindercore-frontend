import { apiFetch } from './client.js';

export interface SopTemplateCategoryRef {
  id: string;
  name: string;
  color: string;
}

export interface SopTemplate {
  id: string;
  title: string;
  goal: string | null;
  // External link (YouTube/Vimeo/Drive/etc.) — not an uploaded file.
  videoUrl: string | null;
  // Bumped only when a proposed SopTemplateRevision is approved.
  currentVersion: number;
  // FA icon name (with the `fa` prefix) — see ALLOWED_ICONS in
  // sopTemplateIcons.ts for the picker allow-list.
  icon: string;
  displayOrder: number;
  // Only present on listTemplates (a joined query) — createTemplate/
  // updateTemplate return the bare row, so this is absent there. Consumers
  // should default to [] rather than assume it's always populated.
  categories?: SopTemplateCategoryRef[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSopTemplatePayload {
  title: string;
  goal?: string | null;
  videoUrl?: string | null;
  icon?: string;
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

// Full-replace — sends the complete set of category ids this template
// should have, not an incremental add/remove.
export function setTemplateCategories(id: string, categoryIds: string[]) {
  return apiFetch<{ ok: true }>(`/api/sop-templates/${id}/categories`, {
    method: 'PUT',
    body: JSON.stringify({ categoryIds }),
  });
}

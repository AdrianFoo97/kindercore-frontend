import { apiFetch, fetchPrivateFile } from './client.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

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
  /** The saved AI poster (load with fetchPosterImage) — drawn once, then reused. */
  posterImageId: string | null;
  /** The guide version the poster was drawn from — older than currentVersion = the guide changed since. */
  posterVersion: number | null;
  posterMadeAt: string | null;
  /** A newly drawn poster waiting to be checked (Use this / Discard). */
  posterDraftImageId: string | null;
  displayOrder: number;
  // Only present on listTemplates (a joined query) — createTemplate/
  // updateTemplate return the bare row, so this is absent there. Consumers
  // should default to [] rather than assume it's always populated.
  categories?: SopTemplateCategoryRef[];
  /** How many live steps it has — only on listTemplates. */
  stepCount?: number;
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

// ── AI poster (sop-templates.routes.ts → guidePoster.controller.ts) ──

export interface PosterAiStatus { available: boolean; reason: string | null }

/** Guide authors: whether "Make poster with AI" can work right now. */
export function fetchPosterAiStatus() {
  return apiFetch<PosterAiStatus>('/api/sop-templates/poster/ai-status');
}

/** Draw a new poster (takes up to a minute) — kept as a draft until accepted. */
export function drawPosterDraft(templateId: string) {
  return apiFetch<{ draftImageId: string; provider: string; model: string }>(`/api/sop-templates/${templateId}/poster/draft`, { method: 'POST' });
}

export function acceptPosterDraft(templateId: string) {
  return apiFetch<{ ok: true }>(`/api/sop-templates/${templateId}/poster/accept`, { method: 'POST' });
}

export function discardPosterDraft(templateId: string) {
  return apiFetch<{ ok: true }>(`/api/sop-templates/${templateId}/poster/draft`, { method: 'DELETE' });
}

/** The poster (or its draft) picture as a Blob — private, so fetched with the login. */
export function fetchPosterImage(templateId: string, imageId: string): Promise<Blob> {
  return fetchPrivateFile(`${BASE_URL}/api/sop-templates/${templateId}/poster/image/${encodeURIComponent(imageId)}`, 'Couldn’t load the poster.');
}

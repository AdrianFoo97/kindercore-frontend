import { apiFetch } from './client.js';
import type { SavedSection, SectionsPayload } from './appraisal-templates.js';

// Settings → Scoring forms (admin): reusable "What's scored" bodies —
// weighted sections and criteria, like an appraisal form's — that an
// appraisal criterion can be scored from (it keeps its own copy).

export interface ScoringForm {
  id: string;
  name: string;
  sections: SavedSection[];
  /** Optional: which positions it's meant for (shown when picking it — not a restriction). */
  positionIds: string[];
  /** Made from these SOPs: each step pass / fail / N/A, each SOP scored like an observation. Empty = built by hand. */
  sopTemplateIds?: string[];
  /** Inactive = kept, but not offered when picking. */
  isActive: boolean;
  /** A live or retired appraisal form used it — it can't be deleted, only made inactive. */
  inUse?: boolean;
  /** What stops it being picked, in plain words — empty when it can be. */
  problems: string[];
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const SCORING_FORMS_KEY = ['appraisal-scoring-forms'] as const;
export const scoringFormKey = (id: string) => ['appraisal-scoring-form', id] as const;

/** By name. */
export const fetchScoringForms = () => apiFetch<ScoringForm[]>('/api/appraisal-scoring-forms');
export const fetchScoringForm = (id: string) => apiFetch<ScoringForm>(`/api/appraisal-scoring-forms/${id}`);
/** A new one starts with just its name. */
export const createScoringForm = (name: string) => apiFetch<ScoringForm>('/api/appraisal-scoring-forms', json('POST', { name }));
export const updateScoringForm = (id: string, data: { name: string; sections: SectionsPayload; positionIds: string[]; sopTemplateIds?: string[] }) =>
  apiFetch<ScoringForm>(`/api/appraisal-scoring-forms/${id}`, json('PUT', data));
export const setScoringFormActive = (id: string, active: boolean) =>
  apiFetch<ScoringForm>(`/api/appraisal-scoring-forms/${id}/active`, json('PUT', { active }));
export const deleteScoringForm = (id: string) => apiFetch<void>(`/api/appraisal-scoring-forms/${id}`, json('DELETE'));

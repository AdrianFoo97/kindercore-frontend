import { apiFetch } from './client.js';
import type { RatingLevel } from './appraisal-templates.js';

// Settings → Rating scales (admin): named rating scales a criterion (or point)
// copies its level wording from. One is the default for new criteria.

export interface RatingScaleTemplate {
  id: string; name: string; max: number; levels: RatingLevel[]; isDefault: boolean;
  /** Inactive = kept, but not offered when picking a scale. */
  isActive: boolean;
  /** A live or retired appraisal form used it — it can't be deleted, only made inactive. */
  inUse?: boolean;
}
export type RatingScaleInput = Pick<RatingScaleTemplate, 'name' | 'max' | 'levels'>;

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const RATING_SCALES_KEY = ['appraisal-rating-scales'] as const;

/** Default first, then by name. */
export const fetchRatingScales = () => apiFetch<RatingScaleTemplate[]>('/api/appraisal-rating-scales');
export const createRatingScale = (data: RatingScaleInput) => apiFetch<RatingScaleTemplate>('/api/appraisal-rating-scales', json('POST', data));
export const updateRatingScale = (id: string, data: RatingScaleInput) =>
  apiFetch<RatingScaleTemplate>(`/api/appraisal-rating-scales/${id}`, json('PUT', data));
export const setRatingScaleActive = (id: string, active: boolean) =>
  apiFetch<RatingScaleTemplate>(`/api/appraisal-rating-scales/${id}/active`, json('PUT', { active }));
export const deleteRatingScale = (id: string) => apiFetch<void>(`/api/appraisal-rating-scales/${id}`, json('DELETE'));
export const setDefaultRatingScale = (id: string) =>
  apiFetch<RatingScaleTemplate[]>(`/api/appraisal-rating-scales/${id}/default`, json('POST'));

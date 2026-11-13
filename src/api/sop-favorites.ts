import { apiFetch } from './client.js';

/** The ids of the guides I've starred. */
export function fetchFavorites() {
  return apiFetch<string[]>('/api/sop-favorites');
}

/** Star or unstar a guide for me. */
export function setFavorite(sopTemplateId: string, favorite: boolean) {
  return apiFetch<{ sopTemplateId: string; favorite: boolean }>(`/api/sop-favorites/${encodeURIComponent(sopTemplateId)}`, { method: favorite ? 'PUT' : 'DELETE' });
}
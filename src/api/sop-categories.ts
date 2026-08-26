import { apiFetch } from './client.js';

export interface SopCategory {
  id: string;
  name: string;
  color: string;
  displayOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Swatch choices offered when creating/editing a category, mirroring the
// backend's default cycle (kept in sync manually — small, stable list).
export const CATEGORY_COLOR_PALETTE = ['#5a67d8', '#0d9488', '#b45309', '#be185d', '#0369a1', '#7c3aed', '#059669', '#dc2626'];

export function fetchCategories() {
  return apiFetch<SopCategory[]>('/api/sop-categories');
}

export function createCategory(name: string, color?: string) {
  return apiFetch<SopCategory>('/api/sop-categories', { method: 'POST', body: JSON.stringify({ name, color }) });
}

export function updateCategory(id: string, payload: { name?: string; color?: string }) {
  return apiFetch<SopCategory>(`/api/sop-categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteCategory(id: string) {
  return apiFetch<{ ok: true }>(`/api/sop-categories/${id}`, { method: 'DELETE' });
}

export function reorderCategories(orderedIds: string[]) {
  return apiFetch<{ ok: true }>('/api/sop-categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  });
}

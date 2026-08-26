import { apiFetch } from './client.js';

export interface SopSection {
  id: string;
  name: string;
  displayOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fetchSections() {
  return apiFetch<SopSection[]>('/api/sop-sections');
}

export function createSection(name: string) {
  return apiFetch<SopSection>('/api/sop-sections', { method: 'POST', body: JSON.stringify({ name }) });
}

export function updateSection(id: string, name: string) {
  return apiFetch<SopSection>(`/api/sop-sections/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export function deleteSection(id: string) {
  return apiFetch<{ ok: true }>(`/api/sop-sections/${id}`, { method: 'DELETE' });
}

export function reorderSections(orderedIds: string[]) {
  return apiFetch<{ ok: true }>('/api/sop-sections/reorder', {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  });
}

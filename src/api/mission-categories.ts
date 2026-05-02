import { apiFetch } from './client.js';

export interface MissionCategoryRecord {
  code: string;
  name: string;
  achievementName: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// FA icon names admin can pick from. Must match the controller's allow-list.
export const ALLOWED_ICONS = [
  'faRoad', 'faClipboardCheck', 'faCalendarDays', 'faPeopleArrows', 'faStar',
  'faBookOpen', 'faGraduationCap', 'faChalkboardUser', 'faShieldHalved',
  'faHeart', 'faTrophy', 'faMedal',
] as const;

// Curated palette of category-friendly colors. Admin picks from these via
// chips so the page palette stays cohesive.
export const COLOR_PALETTE = [
  '#1e40af', '#0e7490', '#9a3412', '#86198f', '#92400e',
  '#15803d', '#b45309', '#7c2d12', '#5b21b6', '#0f766e',
  '#a21caf', '#475569',
] as const;

export interface UpsertCategoryPayload {
  code: string;
  name: string;
  achievementName: string;
  description?: string | null;
  icon: string;
  color: string;
  sortOrder?: number;
}

export function fetchMissionCategories() {
  return apiFetch<MissionCategoryRecord[]>('/api/mission-categories');
}

export function createMissionCategory(payload: UpsertCategoryPayload) {
  return apiFetch<MissionCategoryRecord>('/api/mission-categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMissionCategory(code: string, payload: Partial<Omit<UpsertCategoryPayload, 'code'>>) {
  return apiFetch<MissionCategoryRecord>(`/api/mission-categories/${code}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteMissionCategory(code: string) {
  return apiFetch<{ ok: true }>(`/api/mission-categories/${code}`, { method: 'DELETE' });
}

export function reorderMissionCategories(orderedCodes: string[]) {
  return apiFetch<{ ok: true }>('/api/mission-categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ orderedCodes }),
  });
}

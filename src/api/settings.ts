import { apiFetch } from './client.js';
import { Settings } from '../types/index.js';

export function fetchSettings() {
  return apiFetch<Settings>('/api/settings');
}

export function patchSetting(key: string, value: string | number | boolean | null | string[]) {
  return apiFetch<{ key: string; value: unknown }>(`/api/settings/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

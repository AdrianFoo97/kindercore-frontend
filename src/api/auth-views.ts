import { apiFetch } from './client.js';
import { ModuleKey } from '../constants/authModules.js';

export interface AuthViewRecord {
  id: string;
  key: string;
  label: string;
  description: string | null;
  modules: ModuleKey[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuthViewPayload {
  key: string;
  label: string;
  description?: string | null;
  modules: ModuleKey[];
}

// `key` is deliberately absent from here — it's immutable after creation.
export interface UpdateAuthViewPayload {
  label?: string;
  description?: string | null;
  modules?: ModuleKey[];
}

export function fetchAuthViews() {
  return apiFetch<AuthViewRecord[]>('/api/auth-views');
}

export function createAuthView(payload: CreateAuthViewPayload) {
  return apiFetch<AuthViewRecord>('/api/auth-views', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAuthView(id: string, payload: UpdateAuthViewPayload) {
  return apiFetch<AuthViewRecord>(`/api/auth-views/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAuthView(id: string) {
  return apiFetch<{ ok: true }>(`/api/auth-views/${id}`, { method: 'DELETE' });
}

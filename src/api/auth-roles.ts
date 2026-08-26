import { apiFetch } from './client.js';
import { ModuleKey, ViewKey } from '../constants/authModules.js';

export interface AuthRoleRecord {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  modules: ModuleKey[];
  views: ViewKey[];
}

export interface UpsertAuthRolePayload {
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export function fetchAuthRoles() {
  return apiFetch<AuthRoleRecord[]>('/api/auth-roles');
}

export function createAuthRole(payload: UpsertAuthRolePayload) {
  return apiFetch<AuthRoleRecord>('/api/auth-roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAuthRole(id: string, payload: Partial<UpsertAuthRolePayload>) {
  return apiFetch<AuthRoleRecord>(`/api/auth-roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAuthRole(id: string) {
  return apiFetch<{ ok: true }>(`/api/auth-roles/${id}`, { method: 'DELETE' });
}

// Full-replace — sends the complete set this role should have, not an
// incremental add/remove.
export function setAuthRoleModules(id: string, modules: ModuleKey[]) {
  return apiFetch<{ ok: true }>(`/api/auth-roles/${id}/modules`, {
    method: 'PUT',
    body: JSON.stringify({ modules }),
  });
}

export function setAuthRoleViews(id: string, views: ViewKey[]) {
  return apiFetch<{ ok: true }>(`/api/auth-roles/${id}/views`, {
    method: 'PUT',
    body: JSON.stringify({ views }),
  });
}

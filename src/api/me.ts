import { apiFetch } from './client.js';
import { ModuleKey, ViewKey } from '../constants/authModules.js';

export interface MyPermissions {
  isAdmin: boolean;
  modules: ModuleKey[];
  views: ViewKey[];
}

export function fetchMyPermissions() {
  return apiFetch<MyPermissions>('/api/me/permissions');
}

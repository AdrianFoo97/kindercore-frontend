import { apiFetch } from './client.js';
import { Package } from '../types/index.js';

export interface PackagesConfig {
  programmes: string[];
  ages: number[];
}

export function fetchPackages(year?: number) {
  const qs = year !== undefined ? `?year=${year}` : '';
  return apiFetch<Package[]>(`/api/packages${qs}`);
}

export function fetchPackageYears() {
  return apiFetch<number[]>('/api/packages/years');
}

export function fetchPackagesConfig() {
  return apiFetch<PackagesConfig>('/api/packages/config');
}

export function createPackage(payload: { year: number; programme: string; age: number; name: string; price: number }) {
  return apiFetch<Package>('/api/packages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deletePackage(id: string) {
  return apiFetch<void>(`/api/packages/${id}`, { method: 'DELETE' });
}

export function patchPackageName(id: string, name: string) {
  return apiFetch<Package>(`/api/packages/${id}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function patchPackage(id: string, payload: { name?: string; price?: number }) {
  return apiFetch<Package>(`/api/packages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function upsertPackages(items: { year: number; programme: string; age: number; price: number | null }[]) {
  return apiFetch<Package[]>('/api/packages', {
    method: 'PUT',
    body: JSON.stringify(items),
  });
}

export function updateProgrammes(payload: {
  renames: { from: string; to: string }[];
  add: string[];
  remove: string[];
}) {
  return apiFetch<{ programmes: string[] }>('/api/packages/programmes', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function updateAges(payload: { add: number[]; remove: number[] }) {
  return apiFetch<{ ages: number[] }>('/api/packages/ages', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

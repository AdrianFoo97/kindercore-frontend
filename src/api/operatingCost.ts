import { apiFetch } from './client.js';

// Main category (group) — top-level bucket like "Administrative" or "Sales & Distribution"
export interface OperatingCostGroup {
  id: string;
  name: string;
  sortOrder: number;
  /** System-owned groups (e.g. HR Benefits) that can be renamed but not deleted. */
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

// Category — an individual item within a main category (e.g. "Tel, Fax, H/P and Internet")
export interface OperatingCostCategory {
  id: string;
  name: string;
  groupId: string;
  groupName: string;       // denormalized from the JOIN for convenience
  groupSortOrder: number;  // denormalized so the frontend can sort groups consistently
  sortOrder: number;
  defaultAmount: number | null;  // prefill value when recording monthly costs
  monthlyBudget: number | null;  // expected monthly spend — for variance analysis
  entryCount: number;      // number of monthly cost entries recorded under this category
  entryTotal: number;      // total RM recorded under this category
  createdAt: string;
  updatedAt: string;
}

export interface OperatingCostEntry {
  id: string;
  year: number;
  month: number;
  categoryId: string;
  amount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperatingCostEntriesResponse {
  year: number;
  rows: OperatingCostEntry[];
}

// ── Groups (main categories) ─────────────────────────────────────────────────

export function fetchOperatingCostGroups() {
  return apiFetch<OperatingCostGroup[]>('/api/operating-cost/groups');
}

export function createOperatingCostGroup(data: { name: string; sortOrder?: number }) {
  return apiFetch<OperatingCostGroup>('/api/operating-cost/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateOperatingCostGroup(id: string, data: { name?: string; sortOrder?: number }) {
  return apiFetch<OperatingCostGroup>(`/api/operating-cost/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteOperatingCostGroup(id: string) {
  return apiFetch<{ ok: true }>(`/api/operating-cost/groups/${id}`, { method: 'DELETE' });
}

// ── Categories (items within a group) ────────────────────────────────────────

export function fetchOperatingCostCategories() {
  return apiFetch<OperatingCostCategory[]>('/api/operating-cost/categories');
}

export interface OperatingCostCategoryInput {
  name?: string;
  groupId?: string;
  sortOrder?: number;
  defaultAmount?: number | null;
  monthlyBudget?: number | null;
}

export function createOperatingCostCategory(data: OperatingCostCategoryInput & { name: string; groupId: string }) {
  return apiFetch<OperatingCostCategory>('/api/operating-cost/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateOperatingCostCategory(id: string, data: OperatingCostCategoryInput) {
  return apiFetch<OperatingCostCategory>(`/api/operating-cost/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteOperatingCostCategory(id: string) {
  return apiFetch<{ ok: true }>(`/api/operating-cost/categories/${id}`, { method: 'DELETE' });
}

// ── Monthly entries ──────────────────────────────────────────────────────────

export function fetchOperatingCostEntries(year: number) {
  return apiFetch<OperatingCostEntriesResponse>(`/api/operating-cost/entries?year=${year}`);
}

export function bulkUpsertOperatingCostEntries(year: number, rows: { categoryId: string; month: number; amount: number; notes?: string | null }[]) {
  return apiFetch<OperatingCostEntriesResponse>('/api/operating-cost/entries', {
    method: 'PUT',
    body: JSON.stringify({ year, rows }),
  });
}

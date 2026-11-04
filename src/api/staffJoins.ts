import { apiFetch } from './client.js';
import type { HireCandidateInput } from './candidates.js';

// New staff who joined without going through Recruitment: they fill in the
// public /join form, HR approves (→ staff record) or rejects it.

export type StaffJoinStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StaffJoinRequest {
  id: string;
  fullName: string;
  phone: string;
  dob: string;
  email: string;
  note: string | null;
  status: StaffJoinStatus;
  teacherId: string | null;
  rejectionReason: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface StaffJoinInput {
  fullName: string;
  phone: string;
  dob: string;
  /** Gmail preferred — it's what they'll use to sign in to the app. */
  email: string;
  note?: string;
  /** Honeypot — always empty from a real person. */
  company?: string;
}

/** The public New staff form — the one link HR sends to a new joiner. */
export const joinFormUrl = (origin: string = window.location.origin) => `${origin}/join`;

export const submitStaffJoin =(input: StaffJoinInput) =>
  apiFetch<{ ok: true }>('/api/staff-joins', { method: 'POST', body: JSON.stringify(input) });

export const fetchStaffJoins = () => apiFetch<StaffJoinRequest[]>('/api/staff-joins');

export const approveStaffJoin = (id: string, details: HireCandidateInput) =>
  apiFetch<{ request: StaffJoinRequest }>(`/api/staff-joins/${id}/approve`, { method: 'POST', body: JSON.stringify(details) });

export const rejectStaffJoin = (id: string, reason?: string) =>
  apiFetch<StaffJoinRequest>(`/api/staff-joins/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

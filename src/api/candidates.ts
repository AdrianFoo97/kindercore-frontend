import { apiFetch } from './client.js';
import { Candidate, CandidatesResponse, CandidateStatus, CommuteTime } from '../types/index.js';

export interface CandidatesQuery {
  page?: number;
  pageSize?: number;
  status?: CandidateStatus | 'active' | 'closed';
  desiredPosition?: string;
  search?: string;
  sortBy?: 'submittedAt' | 'fullName' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export function fetchCandidates(q: CandidatesQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v != null && v !== '') params.append(k, String(v));
  });
  const qs = params.toString();
  return apiFetch<CandidatesResponse>(`/api/candidates${qs ? `?${qs}` : ''}`);
}

export interface CandidateStats {
  counts: Record<CandidateStatus, number>;
}

export function fetchCandidateStats() {
  return apiFetch<CandidateStats>('/api/candidates/stats');
}

/** Raw phone list across ALL non-deleted candidates — used to flag
 *  repeat applicants regardless of which pipeline tab they land on.
 *  Frontend normalises + counts (`phoneKey` in CandidatesPage). */
export function fetchCandidatePhoneIndex() {
  return apiFetch<string[]>('/api/candidates/phone-index');
}

// Upcoming scheduled interviews — used by the interview scheduler modal
// to detect clashes when the admin picks a slot.
export interface UpcomingInterview {
  id: string;
  fullName: string;
  interviewStart: string;
  interviewEnd: string | null;
}
export function fetchUpcomingInterviews() {
  return apiFetch<UpcomingInterview[]>('/api/candidates/upcoming-interviews');
}

// Interview scheduling with Google Calendar sync. Set skipCalendar=true
// as a fallback if the calendar step returns a 409/502 (no auth / API
// error) — the record still gets written to the DB.
export interface ScheduleInterviewInput {
  interviewStart: string;
  interviewEnd?: string;
  interviewLocation?: string | null;
  interviewNotes?: string | null;
  whatsappMessage?: string;
  skipCalendar?: boolean;
}
export interface ScheduleInterviewResult {
  interviewEventId: string | null;
  interviewEventLink: string | null;
  calendarSynced: boolean;
}
export function scheduleCandidateInterview(id: string, input: ScheduleInterviewInput) {
  return apiFetch<ScheduleInterviewResult>(`/api/candidates/${id}/schedule-interview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export function unscheduleCandidateInterview(id: string) {
  return apiFetch<{ ok: true }>(`/api/candidates/${id}/unschedule-interview`, {
    method: 'POST',
  });
}

export interface RecruitmentPosition {
  name: string;
  /** Nullable — admin fills in the band in Recruitment settings. When
   *  both min and max are set the form shows "Salary range: RM X – Y"
   *  as a hint below the position dropdown. */
  minSalary: number | null;
  maxSalary: number | null;
}

export interface CandidateFormOptions {
  positions: RecruitmentPosition[];
  qualifications: string[];
  experienceRanges: string[];
  referralSources: string[];
  /** The school's address, so "Commute time to our school" is answerable. */
  address: string;
}

/** Public — apply form reads this without auth. */
export function fetchCandidateFormOptions() {
  return apiFetch<CandidateFormOptions>('/api/candidates/form-options');
}

/** Public — uploads the resume file for a just-created candidate. Must be
 *  called within 60 min of the original POST (server-enforced) and only
 *  once. Returns nothing useful on success. */
export async function uploadCandidateResume(candidateId: string, file: File): Promise<void> {
  const token = localStorage.getItem('token');
  const fd = new FormData();
  fd.append('resume', file);
  const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? '';
  const res = await fetch(`${BASE_URL}/api/candidates/${candidateId}/resume`, {
    method: 'POST',
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try { message = (await res.json()).message ?? message; } catch { /* keep default */ }
    throw new Error(message);
  }
}

/** Opens a candidate's resume PDF in a new browser tab for preview.
 *
 *  Popup-blocker gotcha: browsers only allow `window.open` from a direct
 *  user gesture. If we open the tab AFTER `await fetch()`, the click has
 *  already been "consumed" and the tab gets blocked. So we open a blank
 *  `about:blank` tab SYNCHRONOUSLY inside the caller's onClick, pass the
 *  handle in here, and only redirect it once the blob is ready.
 *
 *  Convenience: if no `targetWindow` is passed we still try `window.open`
 *  as a best-effort fallback (works when there's no async hop before the
 *  call), and finally fall back to same-tab navigation. */
export async function downloadCandidateResume(
  candidateId: string,
  targetWindow?: Window | null,
): Promise<void> {
  const token = localStorage.getItem('token');
  const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? '';
  const res = await fetch(`${BASE_URL}/api/candidates/${candidateId}/resume`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    // If we pre-opened a blank tab, close it — nothing to show there.
    try { targetWindow?.close(); } catch { /* ignore */ }
    let message = `Open failed (${res.status})`;
    try { message = (await res.json()).message ?? message; } catch { /* keep */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  // Force `application/pdf` so the browser renders inline even if the
  // server sent `application/octet-stream`.
  const pdfBlob = new Blob([blob], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);

  // NB: no 'noopener' in the features list — that would force
  // window.open to return null, and we need the handle to redirect the
  // tab to the blob URL below.
  const win = targetWindow ?? window.open('', '_blank');
  if (win && !win.closed) {
    win.location.href = url;
  } else {
    // Popup blocked and no pre-opened tab — best we can do is navigate
    // the current tab. Rare in practice because callers pre-open.
    window.location.href = url;
  }
  // Blob URL kept alive long enough for the new tab to load it. Browsers
  // hold their own reference once the doc is loaded, so revoking later
  // is safe.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function fetchCandidate(id: string) {
  return apiFetch<Candidate>(`/api/candidates/${id}`);
}

export interface CreateCandidateInput {
  fullName: string;
  phone: string;
  // Screening questions — required by backend validator.
  careerGoals: string;
  whyKindergartenTeacher: string;
  /** Required. */
  expectedSalary: number;
  /** Upper bound when the applicant gave a range (import path only). */
  expectedSalaryMax?: number;
  /** Required. */
  salaryJustification: string;
  dob?: string;
  addressLocation?: string;
  commuteTime?: CommuteTime;
  desiredPosition?: string;
  availableFrom?: string;
  preferredStartDate?: string;
  experienceRange?: string;
  qualification?: string;
  qualificationOther?: string;
  howDidYouKnow?: string;
  notes?: string;
  /** utm_source URL param at apply-form load — the job-board /
   *  channel the applicant clicked from. */
  utmSource?: string;
  /** Honeypot — leave empty. */
  company?: string;
  /** Interview datetime — import-only. When set, the row lands as
   *  INTERVIEWING (unless a stronger status marker outranks it). */
  interviewStart?: string;
}

/** Public — no auth required (apply link can be shared). */
export function submitCandidateApplication(input: CreateCandidateInput) {
  return apiFetch<{ id: string; ok: true }>('/api/candidates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type UpdateCandidateInput = Partial<{
  fullName: string;
  phone: string;
  dob: string | null;
  addressLocation: string | null;
  commuteTime: CommuteTime | null;
  desiredPosition: string | null;
  expectedSalary: number | null;
  availableFrom: string | null;
  preferredStartDate: string | null;
  experienceRange: string | null;
  qualification: string | null;
  qualificationOther: string | null;
  salaryJustification: string | null;
  careerGoals: string | null;
  whyKindergartenTeacher: string | null;
  howDidYouKnow: string | null;
  status: CandidateStatus;
  isShortlisted: boolean;
  statusChangedAt: string | null;
  interviewStart: string | null;
  interviewEnd: string | null;
  interviewLocation: string | null;
  interviewNotes: string | null;
  rejectionReason: string | null;
  hiredAt: string | null;
  notes: string | null;
  adminNotes: string | null;
}>;

export function updateCandidate(id: string, patch: UpdateCandidateInput) {
  return apiFetch<Candidate>(`/api/candidates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteCandidate(id: string) {
  return apiFetch<{ ok: true }>(`/api/candidates/${id}`, { method: 'DELETE' });
}

// Admin bulk import — accepts the same CreateCandidateInput shape as the
// public /apply POST. Server sets submissionSource='imported' on each row.
export interface ImportResultItem {
  index: number;
  id?: string;
  error?: string;
}
export interface ImportResult {
  inserted: number;
  total: number;
  results: ImportResultItem[];
}
export function importCandidates(rows: Partial<CreateCandidateInput>[]) {
  return apiFetch<ImportResult>('/api/candidates/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

export function resetAllCandidates() {
  return apiFetch<{ deleted: number; filesRemoved: number }>('/api/candidates/reset-all', {
    method: 'POST',
  });
}

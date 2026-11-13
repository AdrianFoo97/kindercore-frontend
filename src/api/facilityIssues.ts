import { APP_REQUEST_HEADERS, ApiError, apiFetch, withSession } from './client.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// Facility issues — mirrors kindercore-backend's facility-issues.controller.ts.
// Any staff member reports something broken; facility managers move it
// Open → In progress → Resolved at Operation → Facilities.

export type FacilityStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type FacilityCategory =
  | 'DOOR_WINDOW' | 'PLUMBING' | 'ELECTRICAL' | 'AIRCON' | 'FURNITURE' | 'SAFETY' | 'CLEANING' | 'OTHER';
export type FacilityUrgency = 'NORMAL' | 'URGENT';

/** The AuthView that makes someone a facility manager (Admin → Views); Admins always are. */
export const FACILITY_MANAGE_VIEW = 'OPERATION_FACILITY_MANAGE';

export interface FacilityAttachment {
  id: string;
  kind: 'image' | 'video';
  mime: string;
  size: number;
  name: string;
}

export interface FacilityIssue {
  id: string;
  title: string;
  category: FacilityCategory;
  location: string;
  description: string | null;
  urgency: FacilityUrgency;
  status: FacilityStatus;
  /** Latest word from whoever is handling it — the reporter sees it too. */
  statusNote: string | null;
  /** Photos / videos from the reporter (private — load with fetchFacilityAttachment). */
  attachments: FacilityAttachment[] | null;
  reportedByUserId: string;
  reportedByName: string;
  statusUpdatedByName: string | null;
  statusUpdatedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FacilityIssueInput {
  title: string;
  category: FacilityCategory;
  location: string;
  description: string | null;
  urgency: FacilityUrgency;
}

/**
 * Sends a report with its photos / videos as multipart. Uses XHR (not
 * fetch) so the form can show upload progress — a phone video takes a while.
 * `onProgress` gets 0–1.
 */
export function reportFacilityIssue(
  input: FacilityIssueInput, files: File[] = [], onProgress?: (fraction: number) => void,
): Promise<FacilityIssue> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('category', input.category);
  form.append('location', input.location);
  form.append('urgency', input.urgency);
  if (input.description) form.append('description', input.description);
  files.forEach(f => form.append('attachments', f));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/api/facility-issues`);
    // Session cookie + the app's own header (see client.ts).
    xhr.withCredentials = true;
    Object.entries(APP_REQUEST_HEADERS).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as FacilityIssue);
      // 413 comes from a proxy in front of the server, before our own size check.
      else reject(new ApiError(xhr.status === 413 ? 'That file is too large to upload.' : body?.message ?? 'Could not send the report', xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('Unable to connect to server.', 0, 'NETWORK_ERROR'));
    xhr.send(form);
  });
}

/** One attachment as a Blob — the files are private, so an <img src> can't load them directly. */
export async function fetchFacilityAttachment(issueId: string, fileId: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/api/facility-issues/${issueId}/attachments/${encodeURIComponent(fileId)}`, withSession());
  if (!res.ok) throw new ApiError('Could not load the attachment', res.status);
  return res.blob();
}

export function fetchMyFacilityIssues(): Promise<FacilityIssue[]> {
  return apiFetch<FacilityIssue[]>('/api/facility-issues/mine');
}

export function fetchFacilityIssues(): Promise<FacilityIssue[]> {
  return apiFetch<FacilityIssue[]>('/api/facility-issues');
}

export function updateFacilityIssueStatus(id: string, body: { status: FacilityStatus; note?: string }): Promise<FacilityIssue> {
  return apiFetch<FacilityIssue>(`/api/facility-issues/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
}

import { apiFetch } from './client.js';

export type BugReportStatus = 'OPEN' | 'RESOLVED';

export interface BugReport {
  id: string;
  message: string;
  pageUrl: string | null;
  appVersion: string | null;
  reportedByUserId: string;
  reportedByName: string;
  photoUrls: string[] | null;
  status: BugReportStatus;
  createdAt: string;
  updatedAt: string;
}

export function createBugReport(payload: {
  message: string;
  pageUrl?: string | null;
  appVersion?: string | null;
  photoUrls?: string[];
}) {
  return apiFetch<BugReport>('/api/bug-reports', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchBugReports() {
  return apiFetch<BugReport[]>('/api/bug-reports');
}

export function resolveBugReport(id: string) {
  return apiFetch<BugReport>(`/api/bug-reports/${id}/resolve`, { method: 'POST' });
}

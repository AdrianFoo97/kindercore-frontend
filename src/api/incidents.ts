import { apiFetch } from './client.js';

// Incident reports — mirrors kindercore-backend's incidents.controller.ts.
// Any staff member files one (teachers from the mobile app); the Operation
// module follows it up at Operation → Incidents.

export type IncidentStatus = 'OPEN' | 'PARENT_INFORMED' | 'RESOLVED';

/** The AuthView that makes someone an incident manager (Admin → Views); Admins always are. */
export const INCIDENT_MANAGE_VIEW = 'OPERATION_INCIDENT_MANAGE';

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  OPEN: 'Open',
  PARENT_INFORMED: 'Parent informed',
  RESOLVED: 'Resolved',
};

export interface IncidentReport {
  id: string;
  /** 'YYYY-MM-DD', as reported. */
  incidentDate: string;
  /** 'HH:MM' (24-hour), as reported. */
  incidentTime: string;
  location: string;
  description: string;
  actionsTaken: string;
  otherChildren: string | null;
  status: IncidentStatus;
  reportedByUserId: string;
  reportedByName: string;
  statusUpdatedByName: string | null;
  statusUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  students: { studentId: string; childName: string }[];
  /** Follow-up log, oldest first. */
  log: IncidentLogEntry[];
}

/** How the parent took it — recorded per incident to gauge satisfaction over repeat incidents. */
export type ParentReaction = 'SATISFIED' | 'NEUTRAL' | 'CONCERNED' | 'UPSET';
export const PARENT_REACTIONS: ParentReaction[] = ['SATISFIED', 'NEUTRAL', 'CONCERNED', 'UPSET'];
export const PARENT_REACTION_LABEL: Record<ParentReaction, string> = {
  SATISFIED: 'Satisfied', NEUTRAL: 'Neutral', CONCERNED: 'Concerned', UPSET: 'Upset',
};

/**
 * One follow-up log entry. NOTE = a comment; STATUS = the status moved
 * (with an optional comment); EDIT = the details were corrected.
 */
export interface IncidentLogEntry {
  id: string;
  kind: 'NOTE' | 'STATUS' | 'EDIT';
  body: string | null;
  statusFrom: IncidentStatus | null;
  statusTo: IncidentStatus | null;
  /** How satisfied the parent was, tagged on this comment (optional). */
  parentReaction: ParentReaction | null;
  authorUserId: string;
  authorName: string;
  createdAt: string;
}

export interface IncidentInput {
  incidentDate: string;
  incidentTime: string;
  location: string;
  description: string;
  actionsTaken: string;
  studentIds: string[];
  otherChildren?: string | null;
}

/** Sorted youngest first, then by name; age is null when no birth date is on file. */
export interface IncidentStudentOption { id: string; childName: string; age: number | null }

export function createIncident(input: IncidentInput) {
  return apiFetch<IncidentReport>('/api/incidents', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchMyIncidents() {
  return apiFetch<IncidentReport[]>('/api/incidents/mine');
}

export function fetchIncidents() {
  return apiFetch<IncidentReport[]>('/api/incidents');
}

export function fetchIncidentStudentOptions() {
  return apiFetch<IncidentStudentOption[]>('/api/incidents/student-options');
}

/** Correct the details (logged as an edit). Status moves go through addIncidentLog. */
export function updateIncident(id: string, patch: Partial<IncidentInput>) {
  return apiFetch<IncidentReport>(`/api/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

/**
 * Add a comment and/or move the status — one timestamped log entry. A
 * comment can carry how satisfied the parent was (parentReaction).
 */
export function addIncidentLog(id: string, entry: { note?: string; status?: IncidentStatus; parentReaction?: ParentReaction }) {
  return apiFetch<IncidentReport>(`/api/incidents/${id}/log`, { method: 'POST', body: JSON.stringify(entry) });
}

/** The parent's satisfaction on the most recent comment that has one — the report's current reading. */
export function latestParentReaction(r: IncidentReport): ParentReaction | null {
  for (let i = r.log.length - 1; i >= 0; i--) {
    const p = r.log[i].parentReaction;
    if (p) return p;
  }
  return null;
}

/** '30 Oct, 1:20 pm' — when a log entry was written. */
export function fmtLogTime(iso: string): string {
  return new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Everyone involved: linked students, then any other children typed in. */
export function incidentChildren(r: IncidentReport): string[] {
  return [...r.students.map(s => s.childName), ...(r.otherChildren ? [r.otherChildren] : [])];
}

/** 'YYYY-MM-DD' → '5 Jan 2026'. Parsed as a plain date — no timezone shift. */
export function fmtIncidentDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** '14:05' → '2:05 pm'. */
export function fmtIncidentTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** Today in Malaysia as 'YYYY-MM-DD' — the latest date the form allows. */
export function todayInMalaysia(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

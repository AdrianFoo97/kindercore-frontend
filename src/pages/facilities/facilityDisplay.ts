import type { FacilityCategory, FacilityIssue, FacilityIssueInput, FacilityStatus, FacilityUrgency } from '../../api/facilityIssues.js';

// Facility issues — labels, the work-queue order, filters and the report
// form's checks. Shared by Operation → Facilities and the teacher app.

export const FACILITY_STATUS_LABEL: Record<FacilityStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

/** In the order the report form offers them. */
export const FACILITY_CATEGORIES: { key: FacilityCategory; label: string }[] = [
  { key: 'DOOR_WINDOW', label: 'Door / window' },
  { key: 'PLUMBING', label: 'Plumbing / leak' },
  { key: 'ELECTRICAL', label: 'Lights / power' },
  { key: 'AIRCON', label: 'Aircon / fan' },
  { key: 'FURNITURE', label: 'Furniture' },
  { key: 'SAFETY', label: 'Safety hazard' },
  { key: 'CLEANING', label: 'Cleaning / pests' },
  { key: 'OTHER', label: 'Other' },
];

export const categoryLabel = (c: FacilityCategory) => FACILITY_CATEGORIES.find(x => x.key === c)?.label ?? 'Other';

/** List filter: ACTIVE = everything not resolved yet (Open + In progress). */
export const ACTIVE = 'ACTIVE';
export type FacilityFilter = typeof ACTIVE | FacilityStatus;

export function matchesFilter(issue: { status: FacilityStatus }, filter: FacilityFilter): boolean {
  return filter === ACTIVE ? issue.status !== 'RESOLVED' : issue.status === filter;
}

/** Free-text search over title, location and reporter. Blank matches everything. */
export function matchesSearch(issue: Pick<FacilityIssue, 'title' | 'location' | 'reportedByName'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || [issue.title, issue.location, issue.reportedByName].some(s => s.toLowerCase().includes(q));
}

/**
 * Work-queue order: anything not resolved comes first — urgent before
 * normal, then whatever has waited longest. Resolved issues follow, most
 * recently resolved first.
 */
export function sortForQueue<T extends Pick<FacilityIssue, 'status' | 'urgency' | 'createdAt' | 'resolvedAt'>>(issues: T[]): T[] {
  const rank = (i: T) => (i.status === 'RESOLVED' ? 2 : i.urgency === 'URGENT' ? 0 : 1);
  return [...issues].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.status === 'RESOLVED') return (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "3 days ago" — how long since it was reported. */
export function ageLabel(iso: string, now = new Date()): string {
  const days = Math.floor((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// ── Attachments ── (same limits as the server's facilityAttachments.service)

const MB = 1024 * 1024;
export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGE_BYTES = 10 * MB;
export const MAX_VIDEO_BYTES = 50 * MB;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
/** For the file picker's `accept` — phones then offer the camera and the gallery. */
export const ATTACHMENT_ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(',');

export function fileKind(mime: string): 'image' | 'video' | null {
  if (IMAGE_TYPES.includes(mime)) return 'image';
  if (VIDEO_TYPES.includes(mime)) return 'video';
  return null;
}

/** Why these files can't be attached, or null when they're fine — checked before uploading anything. */
export function attachmentProblem(files: { type: string; size: number; name: string }[]): string | null {
  if (files.length > MAX_ATTACHMENTS) return `You can attach up to ${MAX_ATTACHMENTS} photos or videos.`;
  for (const f of files) {
    const kind = fileKind(f.type);
    if (!kind) return `“${f.name}” isn’t a photo or video we can take (JPG, PNG, WebP, GIF, MP4, MOV, WebM).`;
    const max = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (f.size > max) return `“${f.name}” is too big — each ${kind} must be under ${max / MB} MB.${kind === 'video' ? ' Try a shorter clip.' : ''}`;
  }
  return null;
}

/** "2.4 MB" / "640 KB". */
export function fileSizeLabel(bytes: number): string {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The send button while a report goes up: "Uploading 42%…" when files are on their way. */
export function sendingLabel(sending: boolean, progress: number | null, idle = 'Send Report'): string {
  if (!sending) return idle;
  if (progress == null) return 'Sending…';
  return progress >= 1 ? 'Saving…' : `Uploading ${Math.floor(progress * 100)}%…`;
}

// ── Report form ──

export interface FacilityDraft {
  title: string;
  category: FacilityCategory | '';
  location: string;
  description: string;
  urgency: FacilityUrgency;
  files: File[];
}

export const emptyFacilityDraft = (): FacilityDraft => ({ title: '', category: '', location: '', description: '', urgency: 'NORMAL', files: [] });

/** The first thing stopping the report being sent, or null when it's ready. */
export function facilityDraftProblem(d: FacilityDraft): string | null {
  if (!d.title.trim()) return 'Say what’s wrong (e.g. “Toilet door won’t lock”).';
  if (!d.category) return 'Pick what kind of problem it is.';
  if (!d.location.trim()) return 'Say where it is.';
  if (d.files.length === 0) return 'Add a photo or video of the problem.';
  return attachmentProblem(d.files);
}

export function facilityDraftToInput(d: FacilityDraft): FacilityIssueInput {
  return {
    title: d.title.trim(),
    category: d.category as FacilityCategory,
    location: d.location.trim(),
    description: d.description.trim() || null,
    urgency: d.urgency,
  };
}

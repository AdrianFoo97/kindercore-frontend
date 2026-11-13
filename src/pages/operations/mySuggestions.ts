import type { SopRevisionStatus, SopTemplateRevision } from '../../api/sop-revisions.js';

// "My guide ideas": the How-To Guide changes a teacher has sent — new guides
// and improvements — with where each one stands. (The server only ever
// returns the caller's own suggestions.)

type Sent = Exclude<SopRevisionStatus, 'DRAFT'>;
export type StatusTone = 'review' | 'action' | 'good' | 'no';

/** Teacher-facing words for each status, and its colour tone (always shown with the words). */
export const STATUS_TEXT: Record<Sent, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'In review', tone: 'review' },
  // Looks right — the supervisor is trying it in practice before deciding.
  TRIAL: { label: 'On trial', tone: 'review' },
  // Sent back by a supervisor with feedback — the teacher's move.
  CHANGES_REQUESTED: { label: 'Needs changes', tone: 'action' },
  APPROVED: { label: 'Approved', tone: 'good' },
  REJECTED: { label: 'Not approved', tone: 'no' },
};

/** "12 Nov 2026". */
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

export const kindLabel =(r: Pick<SopTemplateRevision, 'sopTemplateId'>) => (r.sopTemplateId ? 'Improvement' : 'New guide');

/** What the teacher actually sent (drafts are a supervisor's own work in progress), newest first. */
export function sentSuggestions<T extends Pick<SopTemplateRevision, 'status' | 'createdAt'>>(list: T[]): T[] {
  return list.filter(r => r.status !== 'DRAFT').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Two tabs: In progress (still open — what's sent back to the teacher first,
 * since it needs them) and Done (approved or not). Each card still shows its
 * exact status.
 */
export type SuggestionTab = 'progress' | 'done';

const TAB_STATUSES: Record<SuggestionTab, Sent[]> = {
  progress: ['CHANGES_REQUESTED', 'PENDING', 'TRIAL'],
  done: ['APPROVED', 'REJECTED'],
};

/** The ideas on a tab, in order (list arrives newest first; "Needs changes" moves to the top). */
export function suggestionsOn<T extends Pick<SopTemplateRevision, 'status'>>(list: T[], tab: SuggestionTab): T[] {
  const on = list.filter(r => (TAB_STATUSES[tab] as string[]).includes(r.status));
  const needsYou = (r: T) => (r.status === 'CHANGES_REQUESTED' ? 0 : 1);
  return on.map((r, i) => ({ r, i })).sort((a, b) => needsYou(a.r) - needsYou(b.r) || a.i - b.i).map(x => x.r);
}

/** The tab from the URL (?tab=done); In progress otherwise. */
export const parseSuggestionTab = (raw: string | null): SuggestionTab => (raw === 'done' ? 'done' : 'progress');
/** One line on where it stands, e.g. "Approved by Rina on 12 Nov 2026 — now version 4". */
export function outcomeLine(r: Pick<SopTemplateRevision, 'status' | 'reviewedByName' | 'reviewedAt' | 'versionNumber'>, fmtDate: (iso: string) => string): string {
  if (r.status === 'PENDING') return 'A supervisor will review it. The guide stays as it is until then.';
  const who = r.reviewedByName ? ` by ${r.reviewedByName}` : '';
  const when = r.reviewedAt ? ` on ${fmtDate(r.reviewedAt)}` : '';
  if (r.status === 'TRIAL') return 'Your supervisor is trying it out in practice. The guide stays as it is until they decide.';
  if (r.status === 'CHANGES_REQUESTED') return `Sent back${who}${when} — update it and send it again.`;
  if (r.status === 'APPROVED') return `Approved${who}${when}${r.versionNumber ? ` — now live as version ${r.versionNumber}` : ''}.`;
  return `Not approved${who}${when}.`;
}

/** Heading over the supervisor's note — after a resend it's the earlier feedback, kept for reference. */
export function feedbackHeading(status: SopRevisionStatus, reviewer: string | null): string {
  const who = reviewer ?? 'your supervisor';
  if (status === 'CHANGES_REQUESTED') return `What to change — from ${who}`;
  if (status === 'PENDING') return `Earlier feedback from ${who}`;
  return `Note from ${who}`;
}

/**
 * Where "Make changes" goes: the same form the idea was made with
 * (Suggest an Edit for an improvement, Suggest a Guide for a new one),
 * filled with what was sent, in resubmit mode.
 */
export function resubmitPath(r: Pick<SopTemplateRevision, 'id' | 'sopTemplateId'>, teacherApp: boolean): string {
  const base = r.sopTemplateId ? `/operations/sops/${r.sopTemplateId}/propose` : '/operations/sops/propose';
  return `${base}?resubmit=${r.id}${teacherApp ? '&app=teacher' : ''}`;
}

/** The reviewer's word for a decision already made (Improvement Inbox + review page). */
export const DECISION_WORD: Record<'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED', string> = {
  CHANGES_REQUESTED: 'Sent back',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function decisionWord(status: SopRevisionStatus): string {
  return DECISION_WORD[status as keyof typeof DECISION_WORD] ?? '';
}

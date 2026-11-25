import type { AppNotification } from '../../api/notifications.js';

// The bell, grouped like Facebook: unread ones under "New", the rest under
// "Earlier", and within each, everything of the same kind in one row —
// "5 new job applications · Shakthek, Tamilarasi and 3 others". Pure.

export interface NotificationGroup {
  /** Stable React key. */
  key: string;
  kind: string;
  /** Newest first. */
  items: AppNotification[];
  unread: boolean;
  /** Where the whole group opens: the page they all share, or null to expand and pick one. */
  link: string | null;
}

export interface NotificationSection { title: 'New' | 'Earlier'; groups: NotificationGroup[] }

/** Names shown before "and N others". */
export const NAMES_SHOWN = 2;

/** [one, many] — "1 new lead" / "3 new leads". */
const NOUN: Record<string, [string, string]> = {
  NEW_LEAD: ['new lead', 'new leads'],
  NEW_STUDENT: ['new student', 'new students'],
  STUDENT_WITHDRAWN: ['student withdrawn', 'students withdrawn'],
  ITEM_BOUGHT: ['item bought', 'items bought'],
  COSTS_RECORDED: ['month of costs recorded', 'months of costs recorded'],
  NEW_APPLICATION: ['new job application', 'new job applications'],
  NEW_STAFF_JOIN: ['new staff member joining', 'new staff members joining'],
  INCIDENT_REPORTED: ['incident reported', 'incidents reported'],
  APPRAISAL_SIGN_OFF: ['appraisal to sign off', 'appraisals to sign off'],
  ONBOARDING_SELF_DONE: ['onboarding checklist done', 'onboarding checklists done'],
  FACILITY_REPORTED: ['facility issue reported', 'facility issues reported'],
  ITEM_REQUESTED: ['item requested', 'items requested'],
  GUIDE_SUGGESTED: ['guide change suggested', 'guide changes suggested'],
  BUG_REPORTED: ['bug reported', 'bugs reported'],
  MY_REQUEST_UPDATE: ['update on your requests', 'updates on your requests'],
  MY_REPORT_UPDATE: ['update on your reports', 'updates on your reports'],
  MY_APPRAISAL_READY: ['appraisal to confirm', 'appraisals to confirm'],
  MY_POINTS: ['points grant', 'points grants'],
  MY_REWARD_DELIVERED: ['reward delivered', 'rewards delivered'],
};

/** "New lead: Cayden Ong" → "Cayden Ong" — who or what it's about, or null when the title has no subject. */
export function subjectOf(title: string): string | null {
  const at = title.indexOf(': ');
  return at > 0 ? title.slice(at + 2).trim() || null : null;
}

/** The page every item opens, when they share one ("/hr/candidates?candidate=1" and "…=2" → "/hr/candidates"). */
export function sharedLink(links: string[]): string | null {
  if (links.every(l => l === links[0])) return links[0] ?? null;
  const paths = links.map(l => l.split(/[?#]/)[0]);
  return paths.every(p => p === paths[0]) ? paths[0] : null;
}

function groupsOf(items: AppNotification[], section: string): NotificationGroup[] {
  const byKind = new Map<string, AppNotification[]>();
  for (const n of items) byKind.set(n.kind, [...(byKind.get(n.kind) ?? []), n]); // items arrive newest first; Map keeps first-seen order
  return [...byKind.entries()].map(([kind, list]) => ({
    key: `${section}:${kind}:${list[0].id}`, kind, items: list, unread: list.some(n => !n.readAt),
    link: list.length === 1 ? list[0].link : sharedLink(list.map(n => n.link)),
  }));
}

/** New (unread) and Earlier (read), each grouped by kind — empty sections left out. */
export function notificationSections(items: AppNotification[]): NotificationSection[] {
  const sections: NotificationSection[] = [
    { title: 'New', groups: groupsOf(items.filter(n => !n.readAt), 'new') },
    { title: 'Earlier', groups: groupsOf(items.filter(n => n.readAt), 'earlier') },
  ];
  return sections.filter(s => s.groups.length > 0);
}

/** A group of several, in words: "5 new job applications" + "Shakthek, Tamilarasi and 3 others". */
export function groupSummary(g: NotificationGroup): { title: string; detail: string | null } {
  const [one, many] = NOUN[g.kind] ?? ['notification', 'notifications'];
  const title = `${g.items.length} ${g.items.length === 1 ? one : many}`.replace(/^./, c => c.toUpperCase());
  const subjects = [...new Set(g.items.map(n => subjectOf(n.title)).filter((s): s is string => !!s))];
  if (!subjects.length) return { title, detail: g.items[0]?.title ?? null };
  const shown = subjects.slice(0, NAMES_SHOWN);
  const rest = subjects.length - shown.length;
  const detail = rest > 0 ? `${shown.join(', ')} and ${rest} other${rest === 1 ? '' : 's'}` : shown.join(' and ');
  return { title, detail };
}

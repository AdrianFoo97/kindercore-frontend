import type { AppraisalSchedule, ScheduleInput, ScheduleRepeat, ScheduleStatus } from '../../api/appraisal-schedules.js';

// HRMS → Appraisal schedule: how a schedule reads ("Every month on the 1st"),
// what the "Schedule appraisals" page needs before it can save, and the
// active schedules grouped by staff member.

export const REPEAT_LABEL: Record<ScheduleRepeat, string> = {
  ONCE: 'Once', MONTHLY: 'Every month', QUARTERLY: 'Every quarter', YEARLY: 'Every year',
};
export const REPEATS: ScheduleRepeat[] = ['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONCE'];
/** The how-often switch. */
export const REPEAT_SHORT: Record<ScheduleRepeat, string> = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly', ONCE: 'Once' };
export const STATUS_LABEL: Record<ScheduleStatus, string> = { ONGOING: 'Ongoing', PAUSED: 'Paused', FINISHED: 'Finished' };

/** Days 29–31 aren't in every month, so a schedule's day is 1–28 (same as the server). */
export const LAST_SCHEDULE_DAY = 28;
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = MONTH_NAMES.map(m => m.slice(0, 3));

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** 'YYYY-MM-DD' → "1 Dec 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

/** Today as 'YYYY-MM-DD' (this device's date). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

type Rule = Pick<ScheduleInput, 'repeat' | 'dayOfMonth' | 'monthOfYear' | 'startsOn'>;

/** "Every month on the 1st", "Every quarter on the 5th (Jan, Apr, Jul, Oct)", "Every year on 15 June", "Once, on 3 Dec 2026". */
export function describeRule(r: Rule): string {
  switch (r.repeat) {
    case 'ONCE': return `Once, on ${formatDate(r.startsOn)}`;
    case 'MONTHLY': return `Every month on the ${ordinal(r.dayOfMonth)}`;
    case 'QUARTERLY': return `Every quarter on the ${ordinal(r.dayOfMonth)} (Jan, Apr, Jul, Oct)`;
    case 'YEARLY': return `Every year on ${r.dayOfMonth} ${MONTH_NAMES[r.monthOfYear ?? 0]}`;
  }
}

/** The pop-up as filled in so far. */
export interface ScheduleDraft extends Rule { familyId: string; teacherIds: string[] }

export const newDraft = (over: Partial<ScheduleDraft> = {}): ScheduleDraft =>
  ({ familyId: '', teacherIds: [], repeat: 'MONTHLY', dayOfMonth: 1, monthOfYear: 0, startsOn: todayIso(), ...over });

/** Why it can't be saved yet, in plain words — null when it can (the server checks again). */
export function draftProblem(d: ScheduleDraft): string | null {
  if (!d.familyId) return 'Pick an appraisal form.';
  if (d.teacherIds.length === 0) return 'Pick at least one staff member.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startsOn)) return d.repeat === 'ONCE' ? 'Pick the date.' : 'Pick a start date.';
  if (d.repeat !== 'ONCE' && !(d.dayOfMonth >= 1 && d.dayOfMonth <= LAST_SCHEDULE_DAY)) return `Pick a day from 1 to ${LAST_SCHEDULE_DAY}.`;
  return null;
}

/** What's sent: the month only for yearly ones. */
export const draftPayload = (d: ScheduleDraft): ScheduleInput => ({
  familyId: d.familyId, teacherIds: d.teacherIds, repeat: d.repeat, dayOfMonth: d.dayOfMonth,
  monthOfYear: d.repeat === 'YEARLY' ? d.monthOfYear : null, startsOn: d.startsOn,
});

/** Staff already on a repeating schedule for this form — they can't be added to another one. */
export function alreadyScheduled(schedules: AppraisalSchedule[], familyId: string): Set<string> {
  return new Set(schedules.filter(s => s.familyId === familyId && s.repeat !== 'ONCE').map(s => s.teacherId));
}

/** A form is for the positions under "Who it's for" — only staff in one of them can be put on it. */
export const fitsForm = (staff: { positionId: string | null }, formPositionIds: string[]) =>
  !!staff.positionId && formPositionIds.includes(staff.positionId);

/** The staff list in two groups — who can be assigned, then who can't (they have a reason) — each A–Z. */
export function groupAssignable<T extends { id: string; name: string }>(staff: T[], cantBecause: Map<string, string>): { assignable: T[]; notAssignable: T[] } {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  return {
    assignable: staff.filter(s => !cantBecause.has(s.id)).sort(byName),
    notAssignable: staff.filter(s => cantBecause.has(s.id)).sort(byName),
  };
}
/** Active schedules: each staff member who has one, with their schedules (A–Z by person, then form). */
export function byStaff(schedules: AppraisalSchedule[]): { teacherId: string; teacherName: string; positionName: string | null; schedules: AppraisalSchedule[] }[] {
  const people = new Map<string, { teacherId: string; teacherName: string; positionName: string | null; schedules: AppraisalSchedule[] }>();
  for (const s of schedules) {
    const p = people.get(s.teacherId) ?? { teacherId: s.teacherId, teacherName: s.teacherName, positionName: s.positionName, schedules: [] };
    p.schedules.push(s);
    people.set(s.teacherId, p);
  }
  return [...people.values()].sort((a, b) => a.teacherName.localeCompare(b.teacherName))
    .map(p => ({ ...p, schedules: p.schedules.sort((a, b) => a.formName.localeCompare(b.formName)) }));
}

/** How many schedules each staff member is on — shown beside them when picking staff. */
export function scheduleCounts(schedules: AppraisalSchedule[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of schedules) if (s.status !== 'FINISHED') out.set(s.teacherId, (out.get(s.teacherId) ?? 0) + 1);
  return out;
}
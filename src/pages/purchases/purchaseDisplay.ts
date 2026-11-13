import type { PurchaseBuyer, PurchaseLogKind, PurchaseRequestInput, PurchaseStatus } from '../../api/purchaseRequests.js';

// Purchase requests — labels, the week picker and the request form's
// checks. Shared by Operation → Shopping List and the teacher app.

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  REQUESTED: 'Waiting for approval',
  APPROVED: 'Approved',
  BOUGHT: 'Bought',
  NOT_BUYING: 'Not buying',
  CANCELLED: 'Withdrawn',
};

export const PURCHASE_STATUS_LOOK: Record<PurchaseStatus, { fg: string; bg: string }> = {
  REQUESTED: { fg: '#b45309', bg: '#fffbeb' },
  APPROVED: { fg: '#4338ca', bg: '#eef2ff' },
  BOUGHT: { fg: '#047857', bg: '#ecfdf5' },
  NOT_BUYING: { fg: '#64748b', bg: '#f1f5f9' },
  CANCELLED: { fg: '#64748b', bg: '#f1f5f9' },
};

/** Still on the shopping list — waiting for approval, or approved and waiting to be bought. */
export const isOpen = (status: PurchaseStatus) => status === 'REQUESTED' || status === 'APPROVED';

// ── Weeks (Monday → Sunday, as the server counts them) ──

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_IN_WEEK = 7;
const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Monday ('YYYY-MM-DD') of the week containing `at`, on Malaysian time. */
export function weekStartOf(at: Date): string {
  const day = new Date(new Date(at.getTime() + MALAYSIA_OFFSET_MS).toISOString().slice(0, 10) + 'T00:00:00Z');
  const sinceMonday = (day.getUTCDay() + 6) % DAYS_IN_WEEK;
  return new Date(day.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday `weeks` weeks before (negative) or after (positive) this one. */
export function shiftWeek(weekStart: string, weeks: number): string {
  return new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + weeks * DAYS_IN_WEEK * DAY_MS).toISOString().slice(0, 10);
}

/** "9 – 15 Nov 2026", or "28 Dec 2026 – 3 Jan 2027" across a year. */
export function weekLabel(weekStart: string): string {
  const from = new Date(`${weekStart}T00:00:00Z`);
  const to = new Date(from.getTime() + (DAYS_IN_WEEK - 1) * DAY_MS);
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  if (from.getUTCFullYear() !== to.getUTCFullYear()) {
    return `${fmt(from, { day: 'numeric', month: 'short', year: 'numeric' })} – ${fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  return `${fmt(from, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} – ${fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** "Thu 5 Nov 2026, 10:10 am" — an exact moment on the Malaysian clock, for the record. */
export function fmtMoment(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur',
  }).replace(/ at /, ', ');
}

/** A record line: a saved step, or a carry-over worked out from the record ("CARRIED_OVER"). */
export type TimelineKind = PurchaseLogKind | 'CARRIED_OVER';
export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  detail: string | null;
  /** null for a carry-over — nobody did it; the week just ended. */
  authorName: string | null;
  createdAt: string;
}

const OPENS: PurchaseLogKind[] = ['REQUESTED', 'BACK_TO_LIST'];
const CLOSES: PurchaseLogKind[] = ['BOUGHT', 'NOT_BUYING', 'CANCELLED'];

/**
 * The record with each carry-over slotted in: every Monday midnight
 * (Malaysia time) the request was still on the list — asked for, not bought,
 * turned down or withdrawn yet — becomes "Carried over to 9 – 15 Nov 2026".
 * Nothing is saved when a week ends, so these are worked out from the saved steps.
 */
export function timelineWithCarryOvers(history: { id: string; kind: PurchaseLogKind; detail: string | null; authorName: string; createdAt: string }[], now = new Date()): TimelineEntry[] {
  const saved: TimelineEntry[] = history.map(h => ({ ...h }));
  if (history.length === 0) return saved;
  const carried: TimelineEntry[] = [];
  let open = false;
  let i = 0;
  // Each Monday from the first step's week onwards, up to now.
  let monday = shiftWeek(weekStartOf(new Date(history[0].createdAt)), 1);
  const mondayInstant = (w: string) => new Date(new Date(`${w}T00:00:00Z`).getTime() - MALAYSIA_OFFSET_MS);
  while (mondayInstant(monday) <= now) {
    const at = mondayInstant(monday);
    for (; i < history.length && new Date(history[i].createdAt) < at; i++) {
      if (OPENS.includes(history[i].kind)) open = true;
      if (CLOSES.includes(history[i].kind)) open = false;
    }
    if (open) {
      carried.push({ id: `carried-${monday}`, kind: 'CARRIED_OVER', detail: `Not bought by the end of the week — carried over to ${weekLabel(monday)}`, authorName: null, createdAt: at.toISOString() });
    }
    monday = shiftWeek(monday, 1);
  }
  return [...saved, ...carried].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** What each history step reads as. */
export const HISTORY_LABEL: Record<TimelineKind, string> = {
  CARRIED_OVER: 'Carried over',
  REQUESTED: 'Asked for',
  EDITED: 'Edited',
  CANCELLED: 'Withdrawn',
  APPROVED: 'Approved',
  BOUGHT: 'Ticked bought',
  BACK_TO_LIST: 'Put back on the list',
  NOT_BUYING: 'Marked not buying',
  COST: 'Cost / receipt',
  NOTE: 'Note',
};

/** How a request that waited through a past week turned out since — "Bought Wed 11 Nov", "Still on the list", … */
export function laterOutcome(r: { status: PurchaseStatus; handledAt: string | null }): string {
  if (isOpen(r.status) || !r.handledAt) return 'Still on the list';
  const day = new Date(r.handledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' });
  return `${r.status === 'BOUGHT' ? 'Bought' : 'Not buying since'} ${day}`;
}

/** "RM 12.50". */
export function fmtRM(amount: number | string): string {
  return `RM ${Number(amount).toFixed(2)}`;
}

/** Carried over this many weeks or more → the tag turns red. */
export const CARRIED_OVERDUE_WEEKS = 2;

export type CarriedLevel = 'none' | 'warn' | 'overdue';

/** How many weeks an item has been carried over: weeks between the week it was asked for and `week` (0 = asked this week). */
export function weeksCarried(createdAt: string, week: string): number {
  const asked = new Date(`${weekStartOf(new Date(createdAt))}T00:00:00Z`).getTime();
  const shown = new Date(`${week}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((shown - asked) / (DAYS_IN_WEEK * DAY_MS)));
}

/** The "carried over" tag for an item still on the list: none if asked this week, amber for 1 week, red from 2. */
export function carriedTag(createdAt: string, week: string): { level: CarriedLevel; label: string } {
  const weeks = weeksCarried(createdAt, week);
  if (weeks === 0) return { level: 'none', label: '' };
  return { level: weeks >= CARRIED_OVERDUE_WEEKS ? 'overdue' : 'warn', label: `Carried over · ${weeks} week${weeks === 1 ? '' : 's'}` };
}

export const CARRIED_LOOK: Record<Exclude<CarriedLevel, 'none'>, { fg: string; bg: string }> = {
  warn: { fg: '#b45309', bg: '#fffbeb' },
  overdue: { fg: '#b91c1c', bg: '#fef2f2' },
};

// ── Request form ──

export interface PurchaseDraft {
  /** SELF = 'I'll buy it myself' (after approval), to be paid back. */
  buyer: PurchaseBuyer;
  item: string;
  quantity: string;
  purpose: string;
  note: string;
  link: string;
}

export const emptyPurchaseDraft = (): PurchaseDraft => ({ buyer: 'SUPERVISOR', item: '', quantity: '', purpose: '', note: '', link: '' });

/** The first thing stopping the request being sent, or null when it's ready. */
export function purchaseDraftProblem(d: PurchaseDraft): string | null {
  if (!d.item.trim()) return 'Say what needs to be bought.';
  if (!d.quantity.trim()) return 'Say how many (e.g. “2 boxes”).';
  if (!d.purpose.trim()) return 'Say which class, or what it’s for.';
  const link = d.link.trim();
  if (link && !/^https?:\/\/\S+\.\S+/i.test(link)) return 'Paste the full shop link, starting with https://';
  return null;
}

export function purchaseDraftToInput(d: PurchaseDraft): PurchaseRequestInput {
  return {
    buyer: d.buyer,
    item: d.item.trim(),
    quantity: d.quantity.trim(),
    purpose: d.purpose.trim(),
    note: d.note.trim() || null,
    link: d.link.trim() || null,
  };
}

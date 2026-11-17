import type { RunStatus } from '../../api/appraisal-runs.js';
import type { AppraisalOverviewRow, AppraisalStage, ScheduledAppraisal, TeacherAppraisal } from '../../api/teacher-appraisals.js';

// HRMS → Appraisals for a month: one line per appraisal the schedule created,
// filed by the step it's at — pending (not started) → in progress (a draft
// being scored) → sign-off → staff to confirm → done — plus months recorded
// by hand before forms existed (done). Staff with neither aren't listed.

export type AppraisalTab = AppraisalStage | 'ALL';
/** In the order an appraisal goes through them. */
export const APPRAISAL_TABS: { key: AppraisalTab; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'SIGN_OFF', label: 'Sign-off' },
  { key: 'CONFIRM', label: 'Staff to confirm' },
  { key: 'DONE', label: 'Done' },
  { key: 'ALL', label: 'All' },
];

export interface AppraisalItem {
  key: string;
  row: AppraisalOverviewRow;
  stage: AppraisalStage;
  /** A scheduled appraisal (opens its page), or a month recorded by hand (edited in the pop-up). */
  run: ScheduledAppraisal | null;
  manual: TeacherAppraisal | null;
}

export function appraisalItems(rows: AppraisalOverviewRow[]): AppraisalItem[] {
  return rows.flatMap(row => {
    const runs = row.runs.map(run => ({ key: run.id, row, stage: run.stage, run, manual: null }));
    // A hand-recorded month with no form behind it (scored-with-a-form months come with their appraisal above).
    const manual = row.appraisal && !row.appraisal.engineAppraisalId && runs.length === 0
      ? [{ key: row.appraisal.id, row, stage: 'DONE' as const, run: null, manual: row.appraisal }] : [];
    return [...runs, ...manual];
  });
}

export const inTab = (item: { stage: AppraisalStage }, tab: AppraisalTab) => tab === 'ALL' || item.stage === tab;

/** How many are in each tab (works for any list of things with a stage). */
export function tabCounts(items: { stage: AppraisalStage }[]): Record<AppraisalTab, number> {
  const counts = Object.fromEntries(APPRAISAL_TABS.map(t => [t.key, 0])) as Record<AppraisalTab, number>;
  for (const i of items) counts[i.stage]++;
  counts.ALL = items.length;
  return counts;
}

/** The small label beside one that's in progress: a draft being scored, or sent back by the signer to rescore. */
export const inProgressNote = (status: RunStatus) => (status === 'SENT_BACK' ? 'Sent back' : 'Draft saved');

/** The button on a line: start scoring, carry on, review it for sign-off, or look at it. */
export function actionLabel(item: AppraisalItem): 'Start' | 'Continue' | 'Review' | 'View' | 'Edit' {
  if (item.manual) return 'Edit';
  switch (item.stage) {
    case 'PENDING': return 'Start';
    case 'IN_PROGRESS': return 'Continue';
    case 'SIGN_OFF': return 'Review';
    default: return 'View';
  }
}

/** The tab an appraisal is on, from its status (as the server files it) — something saved counts as in progress. */
export function stageOf(status: RunStatus, scoredAnything = true): AppraisalStage {
  switch (status) {
    case 'COMPLETED': return 'DONE';
    case 'AWAITING_ACKNOWLEDGEMENT': return 'CONFIRM';
    case 'AWAITING_SIGN_OFF': return 'SIGN_OFF';
    case 'SENT_BACK': return 'IN_PROGRESS';
    default: return scoredAnything ? 'IN_PROGRESS' : 'PENDING';
  }
}

/** HRMS → Appraisals opened at a month and tab from its address (?year=&month=&tab=), e.g. after saving one. */
export function initialView(search: URLSearchParams, now: { year: number; month: number }): { period: { year: number; month: number }; tab: AppraisalTab } {
  const year = Number(search.get('year'));
  const month = Number(search.get('month'));
  const tab = search.get('tab') as AppraisalTab | null;
  return {
    period: Number.isInteger(year) && year > 2000 && Number.isInteger(month) && month >= 0 && month <= 11 && search.has('month') ? { year, month } : now,
    tab: tab && APPRAISAL_TABS.some(t => t.key === tab) ? tab : 'PENDING',
  };
}
/**
 * Who already has an appraisal (on any form) for exactly this month → that form's name.
 * One appraisal per staff member per month — the server refuses a second; New appraisal warns first.
 */
export function appraisedInMonth(rows: Pick<AppraisalOverviewRow, 'teacherId' | 'runs'>[], period: { year: number; month: number }): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    const run = row.runs.find(r => r.period.year === period.year && r.period.month === period.month);
    if (run) out.set(row.teacherId, run.formName);
  }
  return out;
}

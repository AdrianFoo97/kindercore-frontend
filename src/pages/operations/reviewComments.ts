import type { ReviewComment } from '../../api/sop-revisions.js';

// Sending a guide suggestion back: the supervisor goes through the steps one
// by one and leaves a comment on each one that needs changing, as they go —
// nothing to remember until the end. Plus an optional overall note.

/** Comments being written on the review page, by the step's on-page key. */
export type DraftComments = Record<string, string>;

interface StepRef { key: string; section: string; title: string }

/** The written comments, in step order, ready to send (blank ones and removed steps dropped). */
export function commentsToSend(drafts: DraftComments, steps: StepRef[]): ReviewComment[] {
  return steps
    .map(st => ({ section: st.section, stepTitle: st.title, comment: (drafts[st.key] ?? '').trim() }))
    .filter(c => c.comment);
}

/** Something to tell the teacher — a step comment or an overall note. */
export function hasFeedback(note: string, comments: ReviewComment[]): boolean {
  return !!note.trim() || comments.length > 0;
}

/** e.g. "2 step comments". */
export function commentCountLabel(n: number): string {
  return `${n} step comment${n === 1 ? '' : 's'}`;
}

const norm = (s: string) => s.trim().toLowerCase();

/** The comment the supervisor left on this step, if any (matched by section + title). */
export function commentFor(comments: ReviewComment[] | null, step: { section: string; title: string }): string | null {
  const hit = (comments ?? []).find(c => norm(c.stepTitle) === norm(step.title) && norm(c.section) === norm(step.section));
  return hit?.comment ?? null;
}

/** Comments pinned to the teacher's steps when the form opens — by the step itself, so renaming keeps them on it. */
export interface AttachedComments { byKey: Record<string, ReviewComment>; loose: ReviewComment[] }

export function attachComments(comments: ReviewComment[] | null, steps: StepRef[]): AttachedComments {
  const byKey: Record<string, ReviewComment> = {};
  const loose: ReviewComment[] = [];
  for (const c of comments ?? []) {
    const st = steps.find(s => !byKey[s.key] && commentFor([c], s) !== null);
    if (st) byKey[st.key] = c; else loose.push(c);
  }
  return { byKey, loose };
}

/** Comments with no step to sit under (that step was removed) — shown together so none get lost. */
export function unplaced(attached: AttachedComments, steps: { key: string }[]): ReviewComment[] {
  const present = new Set(steps.map(s => s.key));
  return [...attached.loose, ...Object.entries(attached.byKey).filter(([k]) => !present.has(k)).map(([, c]) => c)];
}

/** One-line summary for lists: the overall note, or how many step comments. */
export function feedbackSummary(note: string | null, comments: ReviewComment[] | null): string | null {
  if (note) return note;
  const n = comments?.length ?? 0;
  return n ? commentCountLabel(n) : null;
}

type Side = { section: string; title: string } | null;

/** The comment for a row of the side-by-side table: on the suggested step, or the current one it replaces. */
export function rowComment(comments: ReviewComment[] | null, row: { before: Side; after: Side }): string | null {
  return (row.after && commentFor(comments, row.after)) ?? (row.before && commentFor(comments, row.before)) ?? null;
}

/** Comments that match no row of the table (their step is gone) — shown with the overall note so none get lost. */
export function commentsOffTable(comments: ReviewComment[] | null, rows: { before: Side; after: Side }[]): ReviewComment[] {
  return (comments ?? []).filter(c => !rows.some(r => rowComment([c], r) !== null));
}

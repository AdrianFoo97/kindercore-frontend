import { fitsForm } from './appraisalSchedule.js';

// Appraisals for several people at once — starting (New appraisal) and
// cancelling (the list). Each one still goes through its own request, so the
// server's rules apply to every person; this only gathers the outcome.

/** The live forms that suit every one of these people (a form for one position won't do for another). */
export function formsForAll<F extends { status: string; positionIds: string[] }>(forms: F[], people: { positionId: string | null }[]): F[] {
  if (!people.length) return [];
  return forms.filter(f => f.status === 'ACTIVE' && people.every(p => fitsForm(p, f.positionIds)));
}

export interface BulkOutcome<T> { done: { item: T; id: string }[]; failed: { item: T; message: string; error: unknown }[] }

/** Runs `work` for each item in turn (not all at once — gentle on the server), keeping going past failures. */
export async function runEach<T>(items: T[], work: (item: T) => Promise<string>): Promise<BulkOutcome<T>> {
  const out: BulkOutcome<T> = { done: [], failed: [] };
  for (const item of items) {
    try {
      out.done.push({ item, id: await work(item) });
    } catch (e) {
      out.failed.push({ item, message: e instanceof Error ? e.message : 'Something went wrong.', error: e });
    }
  }
  return out;
}

/** "Started 3 appraisals" / "Cancelled 1 appraisal" — plus how many didn't, when some failed. */
export function bulkSummary(verb: string, done: number, failed: number): string {
  const n = (k: number) => `${k} appraisal${k === 1 ? '' : 's'}`;
  return failed ? `${verb} ${n(done)} — ${failed} couldn’t be` : `${verb} ${n(done)}`;
}

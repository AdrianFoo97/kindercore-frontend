// Counts behind the Recruitment page's "needs attention" strip.

const DAY_MS = 24 * 60 * 60 * 1000;
/** A new applicant nobody has contacted for this long is worth chasing. */
export const NEW_WAITING_MS = 3 * DAY_MS;
/** An offer with no answer after this long needs a nudge. */
export const OFFER_STALE_MS = 7 * DAY_MS;

export interface RecruitmentAttention {
  interviewsToday: number;
  newWaiting: number;
  deciding: number;
  offerSent: number;
  offerStale: number;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function recruitmentAttention(input: {
  interviews: { interviewStart: string }[];
  newApplicants: { submittedAt: string }[];
  deciding: unknown[];
  offersSent: { statusChangedAt: string | null }[];
}, now: Date = new Date()): RecruitmentAttention {
  const t = now.getTime();
  return {
    interviewsToday: input.interviews.filter(i => sameDay(new Date(i.interviewStart), now)).length,
    newWaiting: input.newApplicants.filter(c => t - new Date(c.submittedAt).getTime() >= NEW_WAITING_MS).length,
    deciding: input.deciding.length,
    offerSent: input.offersSent.length,
    offerStale: input.offersSent.filter(c => c.statusChangedAt && t - new Date(c.statusChangedAt).getTime() >= OFFER_STALE_MS).length,
  };
}

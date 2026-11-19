// Settings → Team members → Invite: what blocks sending, said in plain words.

/** Something@something.something — enough to catch typos, not a full RFC check. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Why the email can't be invited yet — or null when it can. */
export function inviteEmailProblem(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Enter their email address.';
  if (!EMAIL_SHAPE.test(e)) return 'That doesn’t look like an email address.';
  return null;
}

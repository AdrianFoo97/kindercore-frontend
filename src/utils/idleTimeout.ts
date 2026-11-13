// Auto sign-out on the admin screens after a stretch without activity, so an
// office computer left unattended doesn't stay open on payroll or finance.
// Pure timing rules here; the component is components/common/IdleSignOut.tsx.

const MINUTE_MS = 60_000;
/** How long the admin screens stay signed in with nobody using them. */
export const ADMIN_IDLE_MINUTES = 15;
export const ADMIN_IDLE_MS = ADMIN_IDLE_MINUTES * MINUTE_MS;
/** The "Still there?" warning shows this long before signing out. */
export const IDLE_WARNING_MS = MINUTE_MS;
/** Activity is written down at most this often (it's shared across tabs through storage). */
export const ACTIVITY_WRITE_EVERY_MS = 5_000;
/** Storage key for the last activity, shared by every open tab of the app. */
export const LAST_ACTIVITY_KEY = 'kc_last_activity';

export type IdleState = 'active' | 'warning' | 'expired';

/** Where the session stands, given the last activity in any tab. */
export function idleStatus(lastActivityAt: number, now: number, limitMs = ADMIN_IDLE_MS, warnMs = IDLE_WARNING_MS): { state: IdleState; secondsLeft: number } {
  const leftMs = lastActivityAt + limitMs - now;
  if (leftMs <= 0) return { state: 'expired', secondsLeft: 0 };
  return { state: leftMs <= warnMs ? 'warning' : 'active', secondsLeft: Math.ceil(leftMs / 1000) };
}

/** The latest activity: this tab's, or another tab's if that was more recent. */
export function latestActivity(ownAt: number, stored: string | null): number {
  const other = stored ? Number(stored) : NaN;
  return Number.isFinite(other) && other > ownAt ? other : ownAt;
}

/** The note on the login page after an automatic sign-out. */
export const IDLE_SIGNED_OUT_NOTICE = `You were signed out after ${ADMIN_IDLE_MINUTES} minutes without activity, to keep records private on shared computers.`;

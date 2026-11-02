// "Online now" / "Last active 2h ago" for Settings → Team Members.
// lastSeenAt is stamped by the backend at most once a minute while someone
// is using the app, so a 5-minute window reads as "using it right now".

export const ONLINE_WINDOW_MS = 5 * 60_000;

export interface MemberActivity {
  online: boolean;
  label: string;
}

export function memberActivity(lastSeenAt: string | null, now: number = Date.now()): MemberActivity {
  if (!lastSeenAt) return { online: false, label: 'Never signed in' };
  const ago = Math.max(0, now - new Date(lastSeenAt).getTime());
  if (ago < ONLINE_WINDOW_MS) return { online: true, label: 'Online now' };
  const mins = Math.floor(ago / 60_000);
  if (mins < 60) return { online: false, label: `Last active ${mins} min ago` };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { online: false, label: `Last active ${hours}h ago` };
  const days = Math.floor(hours / 24);
  if (days === 1) return { online: false, label: 'Last active yesterday' };
  if (days < 30) return { online: false, label: `Last active ${days} days ago` };
  return { online: false, label: `Last active ${new Date(lastSeenAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}` };
}

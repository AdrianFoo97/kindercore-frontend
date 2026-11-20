// How the bell shows a notification's age and its unread count.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** The badge shows exact counts up to this, then "9+". */
export const BADGE_MAX = 9;

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", then the date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const ago = Math.max(0, now - new Date(iso).getTime());
  if (ago < MINUTE) return 'Just now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h ago`;
  if (ago < 2 * DAY) return 'Yesterday';
  if (ago < 7 * DAY) return `${Math.floor(ago / DAY)} days ago`;
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
}

export function badgeText(unread: number): string | null {
  if (unread <= 0) return null;
  return unread > BADGE_MAX ? `${BADGE_MAX}+` : String(unread);
}

/** Only links inside the app are followed (they come from our own server, but never trust a stored URL blindly). */
export function isAppLink(link: string): boolean {
  return link.startsWith('/') && !link.startsWith('//');
}

/** Events grouped by category, keeping the order they came in. */
export function groupByCategory<T extends { category: string }>(events: T[]): { category: string; events: T[] }[] {
  const out: { category: string; events: T[] }[] = [];
  for (const e of events) {
    const g = out.find(x => x.category === e.category);
    if (g) g.events.push(e); else out.push({ category: e.category, events: [e] });
  }
  return out;
}

/** Where the backend says staff-only "about you" notifications come from. */
export const PERSONAL_SOURCE = 'Your own work';

/** "From your role: Marketing Executive", "From your roles: Principal, Supervisor", "From your Admin account", "About your own work". */
export function sourceLabel(from: string[]): string {
  if (from.length === 1 && from[0] === 'Admin account') return 'From your Admin account';
  if (from.length === 1 && from[0] === PERSONAL_SOURCE) return 'About your own work';
  return `From your ${from.length === 1 ? 'role' : 'roles'}: ${from.join(', ')}`;
}

/** Within a category, events grouped by the role(s) that give them — in order. */
export function groupBySource<T extends { from: string[] }>(events: T[]): { label: string; events: T[] }[] {
  const out: { label: string; events: T[] }[] = [];
  for (const e of events) {
    const label = sourceLabel(e.from);
    const g = out.find(x => x.label === label);
    if (g) g.events.push(e); else out.push({ label, events: [e] });
  }
  return out;
}

import { useEffect, useState } from 'react';

// The signed-in person as the browser knows them (saved at sign-in — a
// display hint only; the server decides everything from the session cookie).
// Changing it (e.g. a new display name) tells every screen to redraw.

export interface SignedInUser {
  id: string;
  email: string;
  /** Their full name — what records use. */
  name: string;
  /** What the app calls them (My Profile) — null = their full name. */
  displayName?: string | null;
  role: string;
  teacherId?: string | null;
}

const KEY = 'user';
const CHANGED = 'kc-user-changed';

export function readSignedInUser(): SignedInUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SignedInUser) : null;
  } catch {
    return null;
  }
}

/** Update what the browser holds about them (e.g. after saving a display name), and redraw. */
export function updateSignedInUser(patch: Partial<SignedInUser>): void {
  const current = readSignedInUser();
  if (!current) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch })); } catch { /* not remembered — the screen still updates below */ }
  window.dispatchEvent(new Event(CHANGED));
}

/** The signed-in person, kept up to date when it changes (here or in another tab). */
export function useSignedInUser(): SignedInUser | null {
  const [user, setUser] = useState(readSignedInUser);
  useEffect(() => {
    const refresh = () => setUser(readSignedInUser());
    window.addEventListener(CHANGED, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(CHANGED, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  return user;
}

/** The name to show them by: their display name, else their full name. */
export function shownName(user: { name: string; displayName?: string | null } | null): string {
  return user?.displayName?.trim() || user?.name || '';
}

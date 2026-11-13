// "Take me back where I was going" after signing in — e.g. someone opening a
// shared guide link while signed out. Only paths inside this app are
// honoured, so a crafted ?next= can't bounce people to another website.

const NEXT_PARAM = 'next';

/** The /login URL that returns to `path` (pathname + search) afterwards. */
export function loginUrlReturningTo(path: string): string {
  const back = safeNextPath(path);
  return back ? `/login?${NEXT_PARAM}=${encodeURIComponent(back)}` : '/login';
}

/** `?next=` from the login page's query string, if it's a safe in-app path. */
export function nextPathFrom(search: string): string | null {
  return safeNextPath(new URLSearchParams(search).get(NEXT_PARAM));
}

// Why a session was just ended (e.g. past their last working day), carried
// across the redirect to /login so the login page can say so. Session-only;
// storage can be blocked, in which case the login page simply shows nothing.
const NOTICE_KEY = 'kc-login-notice';

export function saveLoginNotice(message: string): void {
  try { sessionStorage.setItem(NOTICE_KEY, message); } catch { /* storage blocked */ }
}
export function readLoginNotice(): string {
  try { return sessionStorage.getItem(NOTICE_KEY) ?? ''; } catch { return ''; }
}
export function clearLoginNotice(): void {
  try { sessionStorage.removeItem(NOTICE_KEY); } catch { /* storage blocked */ }
}

/** In-app paths only: starts with one "/", isn't the login page itself. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null; // protocol-relative → another site
  if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/login/')) return null;
  return raw;
}

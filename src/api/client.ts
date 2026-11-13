import { loginUrlReturningTo, saveLoginNotice } from '../utils/loginReturn.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Server code for "past their last working day" (staffAccess.service on the backend). */
export const STAFF_LEFT_CODE = 'STAFF_LEFT';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ── Session ──────────────────────────────────────────────────────────────────
// The sign-in lives in an httpOnly cookie the browser sends by itself — page
// scripts never see it, so an injected script can't steal it. Every request
// must include cookies, and changing requests carry the app's own header,
// which the server requires so another website can't act as the signed-in
// person (see the backend's csrf.middleware).
export const APP_REQUEST_HEADERS: Record<string, string> = { 'X-Requested-With': 'KinderCore' };

/** fetch options for any call to the API outside apiFetch (uploads, downloads). */
export function withSession(init: RequestInit = {}): RequestInit {
  return { ...init, credentials: 'include', headers: { ...APP_REQUEST_HEADERS, ...(init.headers as Record<string, string> | undefined) } };
}

/** Who's signed in on this browser — a display hint only; the server decides via the cookie. */
export const isSignedIn = () => !!localStorage.getItem('user');
export const rememberUser = (user: unknown) => localStorage.setItem('user', JSON.stringify(user));

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, withSession({
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> | undefined),
      },
    }));
  } catch {
    // Bubble the network error to the caller — do NOT open a native
    // alert() here. Public surfaces (apply form, landing) render their
    // own candidate-friendly copy; admin surfaces show toasts / inline
    // error state. An admin-toned "contact your administrator" alert
    // would be wildly wrong voice on the apply page.
    throw new ApiError('Unable to connect to server.', 0, 'NETWORK_ERROR');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    const body = err as { message?: string; code?: string; errors?: { message: string }[] };

    // Auto-logout on expired/invalid token (but not on the login endpoint)
    if (res.status === 401 && !path.includes('/auth/login')) {
      localStorage.removeItem('user');
      // Past their last working day: tell them why on the login page.
      if (body.code === STAFF_LEFT_CODE && body.message) saveLoginNotice(body.message);
      window.location.href = loginUrlReturningTo(window.location.pathname + window.location.search);
      throw new ApiError('Session expired. Please sign in again.', 401, 'SESSION_EXPIRED');
    }

    const detail = Array.isArray(body.errors) && body.errors.length > 0
      ? ': ' + body.errors.map(e => e.message).join(', ')
      : '';
    throw new ApiError((body.message ?? 'Request failed') + detail, res.status, body.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

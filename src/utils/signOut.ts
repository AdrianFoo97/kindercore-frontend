import { logout } from '../api/auth.js';

export const LOGIN_PATH = '/login';

/**
 * Sign out on this device. Asks the server to clear the session cookie,
 * forgets who was signed in, then fully reloads the app: everything already
 * loaded (pay, finance, staff and student records) lives in memory, and a
 * plain in-app navigation would keep it there for the next person who signs
 * in on a shared tablet or office computer.
 */
export async function signOut(
  to: string = LOGIN_PATH,
  storage: Pick<Storage, 'removeItem'> = localStorage,
  go: (url: string) => void = url => window.location.replace(url),
  endSession: () => Promise<unknown> = logout,
): Promise<void> {
  // A failed request (offline) still signs out locally; the cookie then expires on its own.
  try { await endSession(); } catch { /* signed out locally regardless */ }
  storage.removeItem('user');
  storage.removeItem('token'); // left by older versions
  go(to);
}

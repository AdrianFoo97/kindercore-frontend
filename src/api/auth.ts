import { apiFetch } from './client.js';
import { User } from '../types/index.js';

/** The session itself comes back as an httpOnly cookie — only who signed in is in the body. */
export interface LoginResponse {
  user: User;
}

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/** Ask the server to clear this browser's session cookie. */
export function logout() {
  return apiFetch<void>('/api/auth/logout', { method: 'POST', keepalive: true });
}

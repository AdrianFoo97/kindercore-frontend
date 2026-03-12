import { apiFetch } from './client.js';

export function getGoogleStatus() {
  return apiFetch<{ connected: boolean }>('/api/google/status');
}

export function getConnectToken() {
  return apiFetch<{ url: string }>('/api/google/connect-token', {
    method: 'POST',
  });
}

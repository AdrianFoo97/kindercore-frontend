import { apiFetch } from './client.js';

export function getGoogleStatus() {
  return apiFetch<{ connected: boolean; email: string | null; calendarName: string | null; calendarId: string | null }>('/api/google/status');
}

export function getConnectToken() {
  return apiFetch<{ url: string }>('/api/google/connect-token', {
    method: 'POST',
  });
}

export function listGoogleCalendars() {
  return apiFetch<{ id: string; name: string; primary: boolean }[]>('/api/google/calendars');
}

export function setGoogleCalendar(calendarId: string) {
  return apiFetch<{ calendarId: string }>('/api/google/calendar', {
    method: 'PATCH',
    body: JSON.stringify({ calendarId }),
  });
}

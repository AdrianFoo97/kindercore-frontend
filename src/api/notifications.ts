import { apiFetch } from './client.js';

export interface AppNotification {
  id: string;
  /** NEW_LEAD, NEW_APPLICATION, INCIDENT_REPORTED, BUG_REPORTED… (backend notifications.logic). */
  kind: string;
  title: string;
  body: string | null;
  /** The page that opens when it's clicked. */
  link: string;
  createdAt: string;
  readAt: string | null;
}

export const fetchNotifications = () => apiFetch<{ items: AppNotification[]; unread: number }>('/api/notifications');
export const markNotificationRead = (id: string) => apiFetch<{ ok: true }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => apiFetch<{ ok: true }>('/api/notifications/read-all', { method: 'POST' });

/** One event in Settings → Notifications. */
/** One event in your notification settings: `from` = the role(s) that give it to you ("Admin account" for admins). */
export interface NotificationEventSetting { kind: string; category: string; label: string; description: string; from: string[]; enabled: boolean }

export const fetchNotificationSettings = () => apiFetch<{ events: NotificationEventSetting[] }>('/api/notifications/settings');
/** Saves the caller's own choices — `muted` lists the events to switch off. */
export const saveNotificationSettings = (muted: string[]) =>
  apiFetch<{ events: NotificationEventSetting[] }>('/api/notifications/settings', { method: 'PUT', body: JSON.stringify({ muted }) });

import { describe, it, expect } from 'vitest';
import { badgeText, groupByCategory, groupBySource, isAppLink, sourceLabel, timeAgo } from '../../components/common/notificationDisplay.js';

describe('Notification bell', () => {
  it('says how long ago something happened in plain words', () => {
    const now = new Date('2026-11-19T10:00:00Z').getTime();
    expect(timeAgo('2026-11-19T09:59:30Z', now)).toBe('Just now');
    expect(timeAgo('2026-11-19T09:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-11-19T07:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-11-18T08:00:00Z', now)).toBe('Yesterday');
    expect(timeAgo('2026-11-15T10:00:00Z', now)).toBe('4 days ago');
  });

  it('shows the unread count up to 9, then 9+, and nothing when all are read', () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe('3');
    expect(badgeText(12)).toBe('9+');
  });

  it('only follows links inside the app', () => {
    expect(isAppLink('/leads?edit=l1')).toBe(true);
    expect(isAppLink('//evil.example')).toBe(false);
    expect(isAppLink('https://evil.example')).toBe(false);
  });

  it('groups the notification settings by category, in order', () => {
    const groups = groupByCategory([{ category: 'Marketing', k: 1 }, { category: 'HR', k: 2 }, { category: 'HR', k: 3 }]);
    expect(groups.map(g => [g.category, g.events.length])).toEqual([['Marketing', 1], ['HR', 2]]);
  });

  it('says which role gives each notification, and groups by it', () => {
    expect(sourceLabel(['Marketing Executive'])).toBe('From your role: Marketing Executive');
    expect(sourceLabel(['Principal', 'Supervisor'])).toBe('From your roles: Principal, Supervisor');
    expect(sourceLabel(['Admin account'])).toBe('From your Admin account');
    expect(sourceLabel(['Your own work'])).toBe('About your own work');
    const groups = groupBySource([{ from: ['Supervisor'], k: 1 }, { from: ['HR Manager'], k: 2 }, { from: ['Supervisor'], k: 3 }]);
    expect(groups.map(g => [g.label, g.events.length])).toEqual([['From your role: Supervisor', 2], ['From your role: HR Manager', 1]]);
  });
});

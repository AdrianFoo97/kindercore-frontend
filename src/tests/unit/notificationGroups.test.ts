import { describe, it, expect } from 'vitest';
import { groupSummary, notificationSections, sharedLink, subjectOf } from '../../components/common/notificationGroups';
import type { AppNotification } from '../../api/notifications';

// The bell, grouped like Facebook: "New" (unread) and "Earlier", one row per kind.

let seq = 0;
const n = (kind: string, title: string, link: string, read = false): AppNotification => ({
  id: `n${++seq}`, kind, title, body: null, link, createdAt: new Date(Date.UTC(2026, 10, 25, 10, 60 - seq)).toISOString(), readAt: read ? '2026-11-25T11:00:00Z' : null,
});

describe('Notification bell — grouped like Facebook', () => {
  it('puts unread under “New” and read under “Earlier”, one row per kind, newest kind first', () => {
    const items = [
      n('NEW_LEAD', 'New lead: Cayden Ong', '/leads?edit=1'),
      n('NEW_APPLICATION', 'New job application: Shakthek', '/hr/candidates?candidate=1'),
      n('NEW_LEAD', 'New lead: 詹瑞恩', '/leads?edit=2'),
      n('NEW_APPLICATION', 'New job application: Tamilarasi', '/hr/candidates?candidate=2'),
      n('NEW_LEAD', 'New lead: Old one', '/leads?edit=3', true),
    ];
    const sections = notificationSections(items);
    expect(sections.map(s => s.title)).toEqual(['New', 'Earlier']);
    expect(sections[0].groups.map(g => [g.kind, g.items.length])).toEqual([['NEW_LEAD', 2], ['NEW_APPLICATION', 2]]);
    expect(sections[1].groups.map(g => [g.kind, g.items.length])).toEqual([['NEW_LEAD', 1]]);
    expect(notificationSections([])).toEqual([]);
  });

  it('opens a group on the page its items share — or expands it when they open different pages', () => {
    expect(sharedLink(['/hr/candidates?candidate=1', '/hr/candidates?candidate=2'])).toBe('/hr/candidates');
    expect(sharedLink(['/hr/new-staff', '/hr/new-staff'])).toBe('/hr/new-staff');
    expect(sharedLink(['/students/1', '/students/2'])).toBeNull();
    const [section] = notificationSections([n('NEW_STUDENT', 'New student: Ali', '/students/1'), n('NEW_STUDENT', 'New student: Bo', '/students/2')]);
    expect(section.groups[0].link).toBeNull();
  });

  it('sums a group up in words — “5 new job applications · A, B and 3 others”', () => {
    const names = ['Shakthek', 'Tamilarasi', 'Karishini', 'Mei Ling', 'Siti'];
    const [section] = notificationSections(names.map(x => n('NEW_APPLICATION', `New job application: ${x}`, '/hr/candidates')));
    expect(groupSummary(section.groups[0])).toEqual({ title: '5 new job applications', detail: 'Shakthek, Tamilarasi and 3 others' });

    const [two] = notificationSections([n('NEW_LEAD', 'New lead: A', '/leads'), n('NEW_LEAD', 'New lead: B', '/leads')]);
    expect(groupSummary(two.groups[0])).toEqual({ title: '2 new leads', detail: 'A and B' });

    // No names in the titles ("You received 5 points") → the newest title instead.
    const [points] = notificationSections([n('MY_POINTS', 'You received 5 points', '/r'), n('MY_POINTS', 'You received 2 points', '/r')]);
    expect(groupSummary(points.groups[0])).toEqual({ title: '2 points grants', detail: 'You received 5 points' });
    expect(subjectOf('New lead: Cayden: Jr')).toBe('Cayden: Jr');
  });
});

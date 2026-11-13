import { describe, it, expect } from 'vitest';
import {
  ACTIVE, ageLabel, attachmentProblem, emptyFacilityDraft, sendingLabel, facilityDraftProblem, facilityDraftToInput, matchesFilter, matchesSearch, sortForQueue,
} from '../../pages/facilities/facilityDisplay';

// Operation → Facilities and the teacher app's Facilities page: the work-queue
// order, the filters and the report form's checks.

type Row = { id: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; urgency: 'NORMAL' | 'URGENT'; createdAt: string; resolvedAt: string | null };
const row = (id: string, status: Row['status'], urgency: Row['urgency'], createdAt: string, resolvedAt: string | null = null): Row =>
  ({ id, status, urgency, createdAt, resolvedAt });

describe('Facility issues — queue order, filters and the report form', () => {
  it('puts urgent issues first, then whatever has waited longest, and resolved ones last', () => {
    const sorted = sortForQueue([
      row('done-old', 'RESOLVED', 'URGENT', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
      row('normal-new', 'OPEN', 'NORMAL', '2026-11-05T00:00:00Z'),
      row('normal-old', 'IN_PROGRESS', 'NORMAL', '2026-11-01T00:00:00Z'),
      row('urgent', 'OPEN', 'URGENT', '2026-11-05T09:00:00Z'),
      row('done-new', 'RESOLVED', 'NORMAL', '2026-10-20T00:00:00Z', '2026-11-04T00:00:00Z'),
    ]);
    expect(sorted.map(r => r.id)).toEqual(['urgent', 'normal-old', 'normal-new', 'done-new', 'done-old']);
  });

  it('"Active" shows Open and In progress; the other filters show one status', () => {
    expect(matchesFilter({ status: 'OPEN' }, ACTIVE)).toBe(true);
    expect(matchesFilter({ status: 'IN_PROGRESS' }, ACTIVE)).toBe(true);
    expect(matchesFilter({ status: 'RESOLVED' }, ACTIVE)).toBe(false);
    expect(matchesFilter({ status: 'RESOLVED' }, 'RESOLVED')).toBe(true);
    expect(matchesFilter({ status: 'OPEN' }, 'IN_PROGRESS')).toBe(false);
  });

  it('searches the problem, the place and who reported it', () => {
    const issue = { title: 'Tap dripping', location: 'Kitchen', reportedByName: 'Tina Teacher' };
    expect(matchesSearch(issue, '')).toBe(true);
    expect(matchesSearch(issue, 'TAP')).toBe(true);
    expect(matchesSearch(issue, 'kitch')).toBe(true);
    expect(matchesSearch(issue, 'tina')).toBe(true);
    expect(matchesSearch(issue, 'aircon')).toBe(false);
  });

  it('says how long ago it was reported, in days', () => {
    const now = new Date(2026, 10, 6, 15, 0);
    expect(ageLabel(new Date(2026, 10, 6, 8, 0).toISOString(), now)).toBe('today');
    expect(ageLabel(new Date(2026, 10, 5, 23, 0).toISOString(), now)).toBe('yesterday');
    expect(ageLabel(new Date(2026, 10, 2, 9, 0).toISOString(), now)).toBe('4 days ago');
  });

  it('accepts up to four photos or videos, within each one\'s size limit', () => {
    const MB = 1024 * 1024;
    const photo = (size = MB) => ({ name: 'door.jpg', type: 'image/jpeg', size });
    const video = (size = 20 * MB) => ({ name: 'leak.mov', type: 'video/quicktime', size });
    expect(attachmentProblem([photo(), video()])).toBeNull();
    expect(attachmentProblem([photo(), photo(), photo(), photo(), photo()])).toMatch(/up to 4/);
    expect(attachmentProblem([photo(11 * MB)])).toMatch(/under 10 MB/);
    expect(attachmentProblem([video(49 * MB)])).toBeNull();
    expect(attachmentProblem([video(51 * MB)])).toMatch(/under 50 MB.*shorter clip/);
    expect(attachmentProblem([{ name: 'notes.pdf', type: 'application/pdf', size: MB }])).toMatch(/isn’t a photo or video/);
  });

  it('shows upload progress on the send button while files go up', () => {
    expect(sendingLabel(false, null)).toBe('Send Report');
    expect(sendingLabel(true, null)).toBe('Sending…');
    expect(sendingLabel(true, 0.426)).toBe('Uploading 42%…');
    expect(sendingLabel(true, 1)).toBe('Saving…');
  });

  it('won\'t send a report without what\'s wrong, the kind of problem, where, and a photo or video', () => {
    const d = emptyFacilityDraft();
    expect(facilityDraftProblem(d)).toMatch(/what’s wrong/);
    expect(facilityDraftProblem({ ...d, title: 'Door stuck' })).toMatch(/kind of problem/);
    expect(facilityDraftProblem({ ...d, title: 'Door stuck', category: 'DOOR_WINDOW' })).toMatch(/where/);
    expect(facilityDraftProblem({ ...d, title: 'Door stuck', category: 'DOOR_WINDOW', location: 'Office' })).toMatch(/photo or video/);
    const photo = new File(['x'], 'door.jpg', { type: 'image/jpeg' });
    const ready = { ...d, title: ' Door stuck ', category: 'DOOR_WINDOW' as const, location: ' Office ', description: '  ', files: [photo] };
    expect(facilityDraftProblem(ready)).toBeNull();
    expect(facilityDraftToInput(ready)).toEqual({ title: 'Door stuck', category: 'DOOR_WINDOW', location: 'Office', description: null, urgency: 'NORMAL' });
  });
});

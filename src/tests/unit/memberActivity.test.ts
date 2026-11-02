import { describe, it, expect } from 'vitest';
import { memberActivity } from '../../pages/settings/memberActivity';

// The status line under each person on Settings → Team Members.

const NOW = new Date('2026-11-02T10:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

describe('Team Members — online status', () => {
  it('shows someone active in the last 5 minutes as online now', () => {
    expect(memberActivity(ago(0), NOW)).toEqual({ online: true, label: 'Online now' });
    expect(memberActivity(ago(4 * MIN), NOW).online).toBe(true);
    expect(memberActivity(ago(5 * MIN), NOW).online).toBe(false);
  });

  it('says how long ago everyone else was last active', () => {
    expect(memberActivity(ago(12 * MIN), NOW).label).toBe('Last active 12 min ago');
    expect(memberActivity(ago(3 * 60 * MIN), NOW).label).toBe('Last active 3h ago');
    expect(memberActivity(ago(30 * 60 * MIN), NOW).label).toBe('Last active yesterday');
    expect(memberActivity(ago(6 * 24 * 60 * MIN), NOW).label).toBe('Last active 6 days ago');
  });

  it('says "Never signed in" for someone with no activity on record', () => {
    expect(memberActivity(null, NOW)).toEqual({ online: false, label: 'Never signed in' });
  });
});

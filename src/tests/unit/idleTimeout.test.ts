import { describe, it, expect } from 'vitest';
import { ADMIN_IDLE_MS, IDLE_WARNING_MS, idleStatus, latestActivity } from '../../utils/idleTimeout';

// Admin screens sign out after 15 minutes without activity, so an unattended
// office computer doesn't stay open on payroll or finance.

const MIN = 60_000;

describe('Auto sign-out after inactivity', () => {
  it('stays signed in while in use, warns in the last minute, and signs out at 15 minutes', () => {
    expect(ADMIN_IDLE_MS).toBe(15 * MIN);
    expect(idleStatus(0, 10 * MIN).state).toBe('active');
    expect(idleStatus(0, ADMIN_IDLE_MS - IDLE_WARNING_MS)).toEqual({ state: 'warning', secondsLeft: 60 });
    expect(idleStatus(0, ADMIN_IDLE_MS - 1_500)).toEqual({ state: 'warning', secondsLeft: 2 });
    expect(idleStatus(0, ADMIN_IDLE_MS)).toEqual({ state: 'expired', secondsLeft: 0 });
    // A laptop waking hours later is signed out straight away.
    expect(idleStatus(0, 3 * 60 * MIN).state).toBe('expired');
  });

  it('counts activity in any open tab, so working in one tab keeps the others signed in', () => {
    expect(latestActivity(1_000, '5000')).toBe(5_000);
    expect(latestActivity(9_000, '5000')).toBe(9_000);
    expect(latestActivity(1_000, null)).toBe(1_000);
    expect(latestActivity(1_000, 'not-a-number')).toBe(1_000);
  });
});

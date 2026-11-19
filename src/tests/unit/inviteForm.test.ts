import { describe, it, expect } from 'vitest';
import { inviteEmailProblem } from '../../pages/settings/inviteForm.js';

describe('Invite team member', () => {
  it('asks for an email, catches one that isn’t an email, and accepts a real one', () => {
    expect(inviteEmailProblem('  ')).toBe('Enter their email address.');
    expect(inviteEmailProblem('winnie@')).toMatch(/doesn’t look like an email/);
    expect(inviteEmailProblem('winnie gmail.com')).toMatch(/doesn’t look like an email/);
    expect(inviteEmailProblem(' winnie@kindertech.my ')).toBeNull();
  });
});

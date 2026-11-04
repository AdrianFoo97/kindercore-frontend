import { describe, it, expect } from 'vitest';
import { loginUrlReturningTo, nextPathFrom, safeNextPath } from '../../utils/loginReturn';

// After signing in from a shared link, people land back on the page they
// were opening — but only ever a page inside this app.

describe('Signing in — returning to the page you were opening', () => {
  it('sends you back to the shared page after you sign in', () => {
    const loginUrl = loginUrlReturningTo('/guide/abc-123');
    expect(loginUrl).toBe('/login?next=%2Fguide%2Fabc-123');
    expect(nextPathFrom(loginUrl.slice('/login'.length))).toBe('/guide/abc-123');
  });

  it('keeps the page\'s own options, like the teacher view', () => {
    const loginUrl = loginUrlReturningTo('/operations/sops/abc?app=teacher');
    expect(nextPathFrom(loginUrl.slice('/login'.length))).toBe('/operations/sops/abc?app=teacher');
  });

  it('never sends you to another website, whatever the link says', () => {
    for (const evil of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'evil.example']) {
      expect(safeNextPath(evil)).toBeNull();
    }
    expect(nextPathFrom('?next=https%3A%2F%2Fevil.example')).toBeNull();
  });

  it('ignores a return to the login page itself, or no return at all', () => {
    expect(safeNextPath('/login')).toBeNull();
    expect(safeNextPath('/login?next=%2Fx')).toBeNull();
    expect(nextPathFrom('')).toBeNull();
    expect(loginUrlReturningTo('/login')).toBe('/login');
  });
});

import { describe, it, expect } from 'vitest';
import { LOGIN_PATH, signOut } from '../../utils/signOut';

// Signing out on a shared tablet or office computer must leave nothing of the
// last person behind — not their session, and not the data already loaded.

describe('Signing out', () => {
  it('ends the session on the server, forgets who was signed in and fully reloads the app, so nothing loaded stays for the next person', async () => {
    const removed: string[] = [];
    let went = '';
    let ended = false;
    await signOut(undefined, { removeItem: k => { removed.push(k); } }, url => { went = url; }, async () => { ended = true; });
    expect(ended).toBe(true);
    expect(removed).toContain('user');
    // A full page load (not an in-app navigation) is what wipes the in-memory data.
    expect(went).toBe(LOGIN_PATH);
  });

  it('still signs out on this device when the server can\'t be reached', async () => {
    let went = '';
    await signOut(undefined, { removeItem: () => undefined }, url => { went = url; }, async () => { throw new Error('offline'); });
    expect(went).toBe(LOGIN_PATH);
  });
});

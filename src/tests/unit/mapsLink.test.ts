import { describe, it, expect } from 'vitest';
import { mapsLinkFor, withMapsLink } from '../../utils/mapsLink';

// Settings → Company → Branches: each branch gets a Google Maps link made
// from its address, stored with the branch and shown beside it.

describe('Google Maps links for addresses', () => {
  it('makes a Google Maps search link for an address, safely encoded', () => {
    expect(mapsLinkFor('12 Jalan Indah 1, Bukit Indah, Johor Bahru'))
      .toBe('https://www.google.com/maps/search/?api=1&query=12%20Jalan%20Indah%201%2C%20Bukit%20Indah%2C%20Johor%20Bahru');
    // Characters that would break a link (& # ?) are encoded, not passed through.
    expect(mapsLinkFor('Lot 5 & 6, Taman #2?')).toBe('https://www.google.com/maps/search/?api=1&query=Lot%205%20%26%206%2C%20Taman%20%232%3F');
  });

  it('tidies extra spaces and gives no link for a blank address', () => {
    expect(mapsLinkFor('  45   Jalan Skudai \n Skudai ')).toBe('https://www.google.com/maps/search/?api=1&query=45%20Jalan%20Skudai%20Skudai');
    expect(mapsLinkFor('   ')).toBe('');
  });

  it('rebuilds the link from the address, so editing the address updates it', () => {
    const before = withMapsLink({ name: 'Skudai', address: '45 Jalan Skudai' });
    const after = withMapsLink({ ...before, address: '46 Jalan Skudai' });
    expect(after.mapsUrl).toBe(mapsLinkFor('46 Jalan Skudai'));
    expect(after.name).toBe('Skudai');
  });
});

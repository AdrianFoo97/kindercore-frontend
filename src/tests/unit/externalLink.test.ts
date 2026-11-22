import { describe, it, expect } from 'vitest';
import { isSafeExternalUrl } from '../../utils/externalLink.js';

describe('Outside links — only safe ones open', () => {
  it('opens https links and refuses script, data and plain-http links', () => {
    expect(isSafeExternalUrl('https://drive.google.com/open?id=abc')).toBe(true);
    for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://drive.google.com/x', 'not a url', ''])
      expect(isSafeExternalUrl(bad), bad).toBe(false);
  });
});

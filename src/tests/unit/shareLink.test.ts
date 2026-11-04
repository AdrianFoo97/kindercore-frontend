import { describe, it, expect, vi } from 'vitest';
import { copyLink, guideShareUrl } from '../../utils/shareLink';

// The "Copy link" button on a guide — copies the link, nothing else.

describe('Guides — copying a link', () => {
  it('builds one link per guide that works for teachers and office staff alike', () => {
    expect(guideShareUrl('g-1', 'https://app.example')).toBe('https://app.example/guide/g-1');
  });

  it('copies the link to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await copyLink('https://app.example/guide/g-1', { writeText })).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://app.example/guide/g-1');
  });

  it('reports a failure when the browser blocks the clipboard', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    expect(await copyLink('https://app.example/guide/g-1', { writeText })).toBe(false);
  });
});

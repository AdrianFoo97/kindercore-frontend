import { describe, it, expect } from 'vitest';
import { hasMoreToScroll, visibleGuides } from '../../pages/operations/sopPaging';

// The Guides list, 10 at a time: page buttons on a computer, scroll-to-load on a phone.

const guides = Array.from({ length: 25 }, (_, i) => i + 1);

describe('Guides list paging', () => {
  it('shows one page of 10 at a time with page buttons on a computer', () => {
    expect(visibleGuides(guides, 1, 10, 'pages')).toEqual(guides.slice(0, 10));
    expect(visibleGuides(guides, 3, 10, 'pages')).toEqual([21, 22, 23, 24, 25]);
  });

  it('on a phone, keeps what is shown and adds 10 more each time you reach the end', () => {
    expect(visibleGuides(guides, 1, 10, 'scroll')).toHaveLength(10);
    expect(visibleGuides(guides, 2, 10, 'scroll')).toHaveLength(20);
    expect(visibleGuides(guides, 3, 10, 'scroll')).toHaveLength(25);
    expect(hasMoreToScroll(20, 25)).toBe(true);
    expect(hasMoreToScroll(25, 25)).toBe(false);
  });

  it('never asks for a page past the end', () => {
    expect(visibleGuides(guides, 9, 10, 'pages')).toEqual([21, 22, 23, 24, 25]);
    expect(visibleGuides([], 1, 10, 'scroll')).toEqual([]);
  });
});
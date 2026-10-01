import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks which of several named sections is currently at the top of
 * the nearest scrollable ancestor — the same "which chapter am I in"
 * signal iOS Contacts/Mail give via a sticky index letter. Register an
 * anchor element (anything inside the scrollable area — its parent
 * chain is walked to find the actual `overflow: auto/scroll` ancestor,
 * same technique as useScrolledPast.ts) via `anchorRef`, then register
 * each section's header element via `sectionRef(name)`. `currentSection`
 * updates to whichever registered header has most recently scrolled up
 * past `offsetPx` from the top of the scroller.
 */
export function useScrollSpySection(offsetPx = 70): {
  anchorRef: (el: HTMLElement | null) => void;
  sectionRef: (name: string) => (el: HTMLElement | null) => void;
  currentSection: string | null;
} {
  const [anchorNode, setAnchorNode] = useState<HTMLElement | null>(null);
  const anchorRef = useCallback((el: HTMLElement | null) => setAnchorNode(el), []);

  const sections = useRef<Map<string, HTMLElement>>(new Map());
  const sectionRef = useCallback((name: string) => (el: HTMLElement | null) => {
    if (el) sections.current.set(name, el);
    else sections.current.delete(name);
  }, []);

  const [currentSection, setCurrentSection] = useState<string | null>(null);

  useEffect(() => {
    if (!anchorNode) return;
    let el: HTMLElement | null = anchorNode.parentElement;
    while (el && getComputedStyle(el).overflowY !== 'auto' && getComputedStyle(el).overflowY !== 'scroll') {
      el = el.parentElement;
    }
    if (!el) return;
    const scroller = el;
    const onScroll = () => {
      // Among all registered headers, the one closest to (but still
      // above/at) the offset line wins — the section you're "in the
      // middle of" reading, not the one furthest up the page.
      let best: string | null = null;
      let bestTop = -Infinity;
      for (const [name, node] of sections.current) {
        const top = node.getBoundingClientRect().top;
        if (top <= offsetPx && top > bestTop) { bestTop = top; best = name; }
      }
      setCurrentSection(best);
    };
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [anchorNode, offsetPx]);

  return { anchorRef, sectionRef, currentSection };
}

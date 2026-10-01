import { useCallback, useEffect, useState } from 'react';

/**
 * Whether the nearest scrollable ancestor of the element you attach the
 * returned `ref` to has been scrolled past `threshold` px. Used by
 * fixed-position controls that should only pick up a background once
 * there's actually content sliding underneath them (see
 * TeacherTopBar.tsx's back chevron/"⋯" menu, and the portaled "⋯"
 * triggers in SopLibraryPage.tsx / SopTemplateStepsPage.tsx).
 *
 * A callback ref (not a plain `useRef`) on purpose: on
 * SopTemplateStepsPage.tsx in particular, the anchor element doesn't
 * exist yet on the very first render (a "not found" branch renders
 * first, without it, while the template query is still loading) — a
 * plain ref would leave the effect's one-time DOM walk permanently
 * empty, since nothing re-triggers it once the real element mounts
 * later. The callback ref re-fires (and their `node` state update
 * re-runs the effect) exactly when that attachment actually happens,
 * no matter which render it lands on.
 */
export function useScrolledPast(
  threshold = 4,
  active = true,
): { ref: (el: HTMLElement | null) => void; scrolled: boolean } {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!active || !node) { setScrolled(false); return; }
    let el: HTMLElement | null = node.parentElement;
    while (el && getComputedStyle(el).overflowY !== 'auto' && getComputedStyle(el).overflowY !== 'scroll') {
      el = el.parentElement;
    }
    if (!el) return;
    const scroller = el;
    const onScroll = () => setScrolled(scroller.scrollTop > threshold);
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [active, threshold, node]);

  return { ref, scrolled };
}

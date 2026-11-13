import { useEffect, useRef } from 'react';

/** How far before the end to start loading the next batch, so it's there before you reach it. */
const LOAD_AHEAD = '200px';

/**
 * Sits at the end of a list; calls onReach when it scrolls into view (or
 * nearly). Watches the viewport, so it works whichever ancestor scrolls.
 */
export default function LoadMoreSentinel({ onReach }: { onReach: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reach = useRef(onReach);
  reach.current = onReach;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) reach.current(); }, { rootMargin: LOAD_AHEAD });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} aria-hidden style={{ height: 1 }} />;
}
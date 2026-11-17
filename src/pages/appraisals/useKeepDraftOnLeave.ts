import { useEffect, useRef } from 'react';

/**
 * Scoring an appraisal: unsaved marks are never lost by leaving.
 * - Leaving inside the app (Back, a tab, a link): the draft is saved on the way out.
 * - Closing or reloading the tab: the browser asks first (it can't wait for a save).
 * Call the returned `settled()` once the page has saved or submitted on purpose, so leaving
 * right after doesn't save a second time.
 */
export function useKeepDraftOnLeave(unsaved: boolean, saveDraft: () => Promise<unknown>): { settled: () => void } {
  const latest = useRef({ unsaved, saveDraft });
  const done = useRef(false);
  useEffect(() => {
    latest.current = { unsaved, saveDraft };
    if (unsaved) done.current = false;
  });

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  useEffect(() => () => {
    if (latest.current.unsaved && !done.current) void latest.current.saveDraft().catch(() => { /* the browser's own warning covered a closing tab; nothing else to do */ });
  }, []);

  return { settled: () => { done.current = true; } };
}

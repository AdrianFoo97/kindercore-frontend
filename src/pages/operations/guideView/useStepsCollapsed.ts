import { useState } from 'react';

// A How-To Guide's steps: the full view (every step's details), or "Steps
// only" — each section's step titles, with one step opened at a tap. The
// choice is remembered on this device (a convenience only; it can be missing).

const STORAGE_KEY = 'kc-guide-steps-only';

function readSaved(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

export function useStepsCollapsed() {
  const [collapsed, setCollapsedState] = useState(readSaved);
  /** Steps opened one by one while collapsed. */
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    setOpened(new Set());
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* private window etc. — just not remembered */ }
  };
  const toggleStep = (id: string) => setOpened(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  return { collapsed, setCollapsed, isOpen: (id: string) => !collapsed || opened.has(id), toggleStep };
}

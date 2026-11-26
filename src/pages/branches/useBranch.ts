import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../../api/settings.js';

// Branches (Settings → Company → Branches) and which one you're looking at.
// Settings → Classes / Subjects and the Operations Planner share the choice,
// so picking Skudai in one shows Skudai in the other. Remembered on this device only.

export interface BranchOption { id: string; name: string }

const STORAGE_KEY = 'kc-branch';

function remembered(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function remember(id: string) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private window — fine */ }
}

/** The branches that have an id (every saved one does). */
export function branchesFrom(settings: Record<string, unknown> | undefined): BranchOption[] {
  const list = settings?.company_branches;
  return Array.isArray(list) ? list.filter((b): b is BranchOption => !!b && typeof b.id === 'string' && typeof b.name === 'string').map(b => ({ id: b.id, name: b.name })) : [];
}

/** Does this class / subject belong to the branch? With no branches set up, everything shows. */
export const inBranch = (item: { branchId?: string | null }, branchId: string | null): boolean => !branchId || item.branchId === branchId;

/** The branches, the one being looked at (last picked, else the first), and a setter. */
export function useBranch() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const branches = branchesFrom(data as Record<string, unknown> | undefined);
  const [picked, setPicked] = useState<string | null>(remembered);
  const current = branches.find(b => b.id === picked) ?? branches[0] ?? null;
  const pick = (id: string) => { setPicked(id); remember(id); };
  /** "N1 · Skudai" when there's more than one branch, so same-named classes can be told apart. */
  const labelOf = (name: string, branchId?: string | null) =>
    branches.length > 1 && branchId ? `${name} · ${branches.find(b => b.id === branchId)?.name ?? '?'}` : name;
  return { branches, branchId: current?.id ?? null, branchName: current?.name ?? null, pick, labelOf };
}

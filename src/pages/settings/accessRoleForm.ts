// Pure helpers for Settings → Access roles (list + editor).
import type { ModuleKey } from '../../constants/authModules.js';

export interface AccessFunction { key: string; module: ModuleKey; label: string; description: string }

export interface RoleGrants { modules: ModuleKey[]; functions: string[] }

/** Ticks or unticks a module. Unticking it also drops that module's functions. */
export function toggleModule(g: RoleGrants, m: ModuleKey, catalog: AccessFunction[]): RoleGrants {
  if (!g.modules.includes(m)) return { ...g, modules: [...g.modules, m] };
  const ofModule = new Set(catalog.filter(f => f.module === m).map(f => f.key));
  return { modules: g.modules.filter(x => x !== m), functions: g.functions.filter(f => !ofModule.has(f)) };
}

/** Ticks or unticks a function — only possible once its module is ticked. */
export function toggleFunction(g: RoleGrants, fn: AccessFunction): RoleGrants {
  if (g.functions.includes(fn.key)) return { ...g, functions: g.functions.filter(f => f !== fn.key) };
  if (!g.modules.includes(fn.module)) return g;
  return { ...g, functions: [...g.functions, fn.key] };
}

/** Groups roles by area, keeping the order they came in (areas in first-seen order). */
export function groupByArea<T extends { area: string | null }>(roles: T[]): { area: string; roles: T[] }[] {
  const out: { area: string; roles: T[] }[] = [];
  for (const r of roles) {
    const area = r.area ?? 'Other';
    let g = out.find(x => x.area === area);
    if (!g) { g = { area, roles: [] }; out.push(g); }
    g.roles.push(r);
  }
  return out;
}

/** "Used by 2 people · 1 position" — or "Not given to anyone yet". */
export function usageLine(peopleCount: number, positionCount: number): string {
  const parts: string[] = [];
  if (peopleCount) parts.push(`${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`);
  if (positionCount) parts.push(`${positionCount} ${positionCount === 1 ? 'position' : 'positions'}`);
  return parts.length ? `Used by ${parts.join(' · ')}` : 'Not given to anyone yet';
}

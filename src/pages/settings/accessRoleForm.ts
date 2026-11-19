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

/** Every module the chosen roles open between them, in the catalog's order. */
export function combinedModules<M extends string>(roles: { id: string; modules: M[] }[], chosen: string[], order: M[]): M[] {
  const open = new Set(roles.filter(r => chosen.includes(r.id)).flatMap(r => r.modules));
  return order.filter(m => open.has(m));
}

/** The role a person's linked staff record gets from its position — or null (no link, no position, or no role on it). */
export function positionRoleFor<R extends { id: string }>(
  teacherId: string | null | undefined,
  teachers: { id: string; positionId?: string | null }[],
  positions: { positionId: string; name: string; authRoleId?: string | null }[],
  roles: R[],
): { role: R; positionName: string } | null {
  const positionId = teachers.find(t => t.id === teacherId)?.positionId;
  const position = positions.find(p => p.positionId === positionId);
  const role = roles.find(r => r.id === position?.authRoleId);
  return position && role ? { role, positionName: position.name } : null;
}

/** Roles whose name or area contains the search text (case-insensitive); all of them when it's blank. */
export function searchRoles<R extends { name: string; area: string | null }>(roles: R[], query: string): R[] {
  const q = query.trim().toLowerCase();
  if (!q) return roles;
  return roles.filter(r => r.name.toLowerCase().includes(q) || (r.area ?? '').toLowerCase().includes(q));
}

/** Every extra function the chosen roles grant between them (keys, first-seen order, once each). */
export function combinedFunctions(roles: { id: string; views: string[] }[], chosen: string[]): string[] {
  return [...new Set(roles.filter(r => chosen.includes(r.id)).flatMap(r => r.views))];
}

/** True when two id lists hold the same ids, whatever the order. */
export function sameIds(a: string[], b: string[]): boolean {
  const sa = new Set(a), sb = new Set(b);
  return sa.size === sb.size && [...sa].every(x => sb.has(x));
}

import { describe, it, expect } from 'vitest';
import APP from '../../App.tsx?raw';
import { MANAGER_AREA_GROUPS, visibleManagerGroups, type ManagerAccess } from '../../pages/manage/managerAreas.js';
import type { ModuleKey, ViewKey } from '../../constants/authModules.js';

// Manager view: which tiles someone sees comes only from their access roles,
// and every tile opens a page guarded exactly like the tile.

const access = (modules: string[], views: string[] = [], hasSettings = false): ManagerAccess => ({
  hasModule: (m: ModuleKey) => modules.includes(m),
  hasView: (v: ViewKey) => views.includes(v),
  hasSettings,
});
const headings = (a: ManagerAccess) => visibleManagerGroups(a).map(g => g.heading);
const labels = (a: ManagerAccess) => visibleManagerGroups(a).flatMap(g => g.areas.map(x => x.label));

/** The <Route …> element for a path, as written in App.tsx. */
function routeFor(path: string): string | null {
  const at = APP.indexOf(`path="${path}"`);
  if (at < 0) return null;
  return APP.slice(at, APP.indexOf('/>', APP.indexOf('</', at)) + 2);
}

describe('Manager view — the areas', () => {
  it('shows a plain teacher nothing to manage', () => {
    expect(visibleManagerGroups(access(['OPERATION']))).toEqual([]);
  });

  it('shows a supervisor their guide, incident and shopping-list desks, grouped like the Operation menu', () => {
    const supervisor = access(['OPERATION'], ['OPERATION_SOP_APPROVE', 'OPERATION_INCIDENT_MANAGE', 'OPERATION_PURCHASE_MANAGE']);
    expect(headings(supervisor)).toEqual(['Guides', 'Incidents', 'Facilities']);
    expect(labels(supervisor)).toEqual(['Manage Guides', 'Author Guides', 'Improvement Inbox', 'Incident Reports', 'Shopping List']);
  });

  it('puts appraisals under Performance Management, and whole-school HR desks only with that function', () => {
    expect(headings(access(['HR']))).toEqual(['Team', 'Performance Management']);
    expect(headings(access(['HR'], ['HR_SEE_ALL_STAFF']))).toEqual(['Team', 'Recruitment & Hiring', 'Performance Management']);
  });

  it('shows Settings only to someone with a settings page', () => {
    expect(labels(access([], [], true))).toEqual(['Settings']);
    expect(labels(access([]))).toEqual([]);
  });

  it('opens every tile on a page guarded like the tile', () => {
    for (const area of MANAGER_AREA_GROUPS.flatMap(g => g.areas)) {
      const route = routeFor(area.path);
      expect(route, `${area.label}: ${area.path} isn't a route in App.tsx`).not.toBeNull();
      if (!area.module) continue;
      expect(route!.match(/RequireModule module=\{MODULES\.(\w+)\}/)?.[1], `${area.label} module`).toBe(area.module);
      const view = route!.match(/RequireView view="(\w+)"/)?.[1];
      // The page may be open to the whole module (showing a manager its full list); the tile can ask for more, never less.
      if (view) expect(area.view, `${area.label} function`).toBe(view);
    }
  });
});

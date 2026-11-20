import { describe, it, expect } from 'vitest';
// The route list as text (Vite's ?raw import).
import APP from '../../App.tsx?raw';

// Every notification opens a page. That page must be guarded by the same
// access the notification is sent to (backend notifications.logic audiences),
// so a notification never leads somewhere the person can't open. This reads
// the real route list in App.tsx.

/** The page each notification opens, and the access it should need there. */
const DESTINATIONS: { notification: string; path: string; module: string | null; view?: string }[] = [
  { notification: 'New lead', path: '/leads', module: 'MARKETING' },
  { notification: 'New student', path: '/students/:id', module: 'STUDENTS' },
  { notification: 'Student withdrawn', path: '/students/:id', module: 'STUDENTS' },
  { notification: 'Item bought', path: '/operations/operating-costs', module: 'FINANCE' },
  { notification: 'Month’s operating costs recorded', path: '/analysis/operating-cost', module: 'ANALYSIS' },
  { notification: 'New job application', path: '/hr/candidates', module: 'HR' },
  { notification: 'New staff joining', path: '/hr/new-staff', module: 'HR' },
  { notification: 'Finished onboarding checklist', path: '/hr/onboarding', module: 'HR' },
  // Sent only to the people who can sign off that appraisal; the server decides who may open it.
  { notification: 'Appraisal ready for sign-off', path: '/appraisals/:id', module: null },
  { notification: 'Incident reported', path: '/operations/incidents/:id', module: 'OPERATION' },
  { notification: 'Facility issue reported', path: '/operations/facilities', module: 'OPERATION' },
  { notification: 'Item requested', path: '/operations/shopping-list', module: 'OPERATION', view: 'OPERATION_PURCHASE_MANAGE' },
  { notification: 'Guide change suggested', path: '/hr/sop-revisions/:id', module: 'OPERATION', view: 'OPERATION_SOP_APPROVE' },
  { notification: 'Bug reported', path: '/tools/bug-reports', module: 'TOOLS' },
  // About you: your own staff pages — no module needed (the server checks it's yours).
  { notification: 'Your item requests', path: '/teachers/:id/purchases', module: null },
  { notification: 'Your reports (incident)', path: '/teachers/:id/incidents', module: null },
  { notification: 'Your reports (facility)', path: '/teachers/:id/facilities', module: null },
  { notification: 'Your appraisal', path: '/appraisals/:id', module: null },
  { notification: 'Points and rewards', path: '/teachers/:id/rewards', module: null },
  { notification: 'Notification settings in the teacher app', path: '/teachers/:id/settings/notifications', module: null },
];

/** The <Route …> element for a path, as written in App.tsx. */
function routeFor(path: string): string | null {
  const at = APP.indexOf(`path="${path}"`);
  if (at < 0) return null;
  return APP.slice(at, APP.indexOf('/>', APP.indexOf('</', at)) + 2);
}

describe('Notifications — where they open', () => {
  it('opens every notification on a page guarded like the notification', () => {
    for (const d of DESTINATIONS) {
      const route = routeFor(d.path);
      expect(route, `${d.notification}: ${d.path} isn't a route in App.tsx`).not.toBeNull();
      const module = route!.match(/RequireModule module=\{MODULES\.(\w+)\}/)?.[1] ?? null;
      const view = route!.match(/RequireView view="(\w+)"/)?.[1];
      expect(module, `${d.notification} → ${d.path} module`).toBe(d.module);
      if (d.view) expect(view, `${d.notification} → ${d.path} function`).toBe(d.view);
    }
  });
});

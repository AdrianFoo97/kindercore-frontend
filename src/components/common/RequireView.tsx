import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.js';
import { ViewKey } from '../../constants/authModules.js';

// Same shape as RequireModule.tsx, one View finer-grained — for a route
// that isn't meant for everyone sharing its parent Module (e.g. the
// Improvement Inbox reviewer workbench within Operation). Server-side
// enforcement is the real boundary (see sop-revisions.controller.ts's
// listRevisions scoping); this only stops a direct URL nav from
// momentarily rendering a page the user has no View grant for.
export function RequireView({ view, children }: { view: ViewKey; children: ReactNode }) {
  const { hasView, loading } = usePermissions();
  if (loading) return null;
  if (!hasView(view)) return <Navigate to="/no-access" replace />;
  return <>{children}</>;
}

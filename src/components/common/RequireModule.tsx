import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.js';
import { ModuleKey } from '../../constants/authModules.js';

// Server-side enforcement already exists via requireModule() on the API
// routes — this only stops a direct URL nav from momentarily rendering a
// page the user has no module grant for. Renders nothing while permissions
// are still loading rather than flashing the page then redirecting.
//
// Redirects to /no-access, not "/" — "/" is the public marketing page,
// which shows no sign of being logged in and looks identical to a failed
// login for an authenticated user who just has zero module grants.
export function RequireModule({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { hasModule, loading } = usePermissions();
  if (loading) return null;
  if (!hasModule(module)) return <Navigate to="/no-access" replace />;
  return <>{children}</>;
}
